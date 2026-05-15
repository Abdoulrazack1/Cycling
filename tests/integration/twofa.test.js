// tests/integration/twofa.test.js
// Couvre le flow 2FA complet : setup → activate → challenge login → disable.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const otp = require('otplib');
const { startServer, dbConn, cleanupTestUsers } = require('../helper');

const TOTP_OPTS = { algorithm: 'sha1', digits: 6, period: 30 };

let srv, db;
const created = []; // user IDs créés par ce fichier (cleanup)

test.before(async () => {
  await cleanupTestUsers();
  srv = await startServer();
  db  = await dbConn();
});

test.after(async () => {
  // Cleanup additionnel des users créés
  if (created.length) {
    await db.query('DELETE FROM refresh_tokens WHERE user_id IN (?)', [created]);
    await db.query('DELETE FROM audit_log WHERE user_id IN (?)', [created]);
    await db.query('DELETE FROM users WHERE id IN (?)', [created]);
  }
  await db?.end();
  await cleanupTestUsers();
  if (srv) await srv.stop();
});

function rnd() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

async function createAdminUser() {
  const suf = rnd();
  const email = `2fa__ccstest__${suf}@example.com`;
  const password = 'Twofa12345';

  // 1) Register normal
  const reg = await fetch(`${srv.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prenom: 'TwoFA', nom: 'Test', username: `tfa_${suf}`, email, password }),
  });
  assert.ok(reg.status === 200 || reg.status === 201, `register: ${reg.status}`);
  const { user, accessToken } = await reg.json();

  // 2) Promote to admin via direct DB (pas d'API publique pour ça)
  await db.query('UPDATE users SET role = ? WHERE id = ?', ['admin', user.id]);
  created.push(user.id);

  // 3) Re-login pour obtenir un access token avec role:admin (le précédent
  //    encode role:membre → requireAdmin va refuser)
  const login = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: email, password }),
  });
  assert.equal(login.status, 200);
  const lj = await login.json();

  return { email, password, accessToken: lj.accessToken, userId: user.id };
}

test('POST /2fa/setup renvoie un secret + QR data URL', async () => {
  const u = await createAdminUser();
  const r = await fetch(`${srv.base}/api/auth/2fa/setup`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + u.accessToken },
  });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.ok(data.secret && data.secret.length >= 16, 'secret base32 attendu');
  assert.ok(data.qrDataUrl?.startsWith('data:image/png;base64,'), 'QR data URL PNG attendu');
  assert.ok(data.otpauth?.startsWith('otpauth://totp/'), 'URI otpauth attendu');
});

test('POST /2fa/activate avec code invalide → 401', async () => {
  const u = await createAdminUser();
  // setup d'abord
  await fetch(`${srv.base}/api/auth/2fa/setup`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + u.accessToken },
  });
  // mauvais code
  const r = await fetch(`${srv.base}/api/auth/2fa/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.accessToken },
    body: JSON.stringify({ code: '000000' }),
  });
  assert.equal(r.status, 401);
});

test('Flow complet : setup → activate → login challenge', async () => {
  const u = await createAdminUser();

  // 1) Setup
  const setup = await fetch(`${srv.base}/api/auth/2fa/setup`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + u.accessToken },
  });
  const { secret } = await setup.json();
  assert.ok(secret);

  // 2) Activate avec un code valide généré depuis le secret
  const validCode = otp.generateSync({ secret, options: TOTP_OPTS });
  const act = await fetch(`${srv.base}/api/auth/2fa/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.accessToken },
    body: JSON.stringify({ code: validCode }),
  });
  assert.equal(act.status, 200);
  const actJson = await act.json();
  assert.equal(actJson.backup_codes?.length, 8, '8 backup codes attendus');

  // 3) Login SANS TOTP → 401 + mfa_required:true
  const loginNo2fa = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: u.email, password: u.password }),
  });
  assert.equal(loginNo2fa.status, 401);
  const noJson = await loginNo2fa.json();
  assert.equal(noJson.mfa_required, true);

  // 4) Login AVEC TOTP valide → 200
  const fresh = otp.generateSync({ secret, options: TOTP_OPTS });
  const loginOk = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: u.email, password: u.password, totp: fresh }),
  });
  assert.equal(loginOk.status, 200);
  const okJson = await loginOk.json();
  assert.ok(okJson.accessToken);

  // 5) Login avec un backup code → 200 + le code est consommé
  const backupCode = actJson.backup_codes[0];
  const loginBackup = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: u.email, password: u.password, totp: backupCode }),
  });
  assert.equal(loginBackup.status, 200);

  // 6) Re-utiliser le MÊME backup code → 401 (one-time)
  const loginReuse = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: u.email, password: u.password, totp: backupCode }),
  });
  assert.equal(loginReuse.status, 401);
});

test('GET /2fa/status reflète l\'état activé', async () => {
  const u = await createAdminUser();
  // Avant setup : enabled=false
  const before = await fetch(`${srv.base}/api/auth/2fa/status`, {
    headers: { Authorization: 'Bearer ' + u.accessToken },
  }).then(r => r.json());
  assert.equal(before.enabled, false);

  // Activer
  const setup = await fetch(`${srv.base}/api/auth/2fa/setup`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + u.accessToken },
  });
  const { secret } = await setup.json();
  await fetch(`${srv.base}/api/auth/2fa/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.accessToken },
    body: JSON.stringify({ code: otp.generateSync({ secret, options: TOTP_OPTS }) }),
  });

  const after = await fetch(`${srv.base}/api/auth/2fa/status`, {
    headers: { Authorization: 'Bearer ' + u.accessToken },
  }).then(r => r.json());
  assert.equal(after.enabled, true);
  assert.equal(after.backup_codes_remaining, 8);
});

test('POST /2fa/disable requiert password + code valide', async () => {
  const u = await createAdminUser();
  // Setup + activate
  const setup = await fetch(`${srv.base}/api/auth/2fa/setup`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + u.accessToken },
  });
  const { secret } = await setup.json();
  await fetch(`${srv.base}/api/auth/2fa/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.accessToken },
    body: JSON.stringify({ code: otp.generateSync({ secret, options: TOTP_OPTS }) }),
  });

  // Sans password → 400
  const noPw = await fetch(`${srv.base}/api/auth/2fa/disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.accessToken },
    body: JSON.stringify({}),
  });
  assert.ok(noPw.status >= 400);

  // Mauvais password → 401
  const wrongPw = await fetch(`${srv.base}/api/auth/2fa/disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.accessToken },
    body: JSON.stringify({ password: 'wrong', code: otp.generateSync({ secret, options: TOTP_OPTS }) }),
  });
  assert.equal(wrongPw.status, 401);

  // Bon password + bon code → 200
  const ok = await fetch(`${srv.base}/api/auth/2fa/disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.accessToken },
    body: JSON.stringify({ password: u.password, code: otp.generateSync({ secret, options: TOTP_OPTS }) }),
  });
  assert.equal(ok.status, 200);
});
