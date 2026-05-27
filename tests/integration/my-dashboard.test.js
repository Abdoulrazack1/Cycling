// tests/integration/my-dashboard.test.js
// Couvre /api/my/* (dashboard, inscriptions, recent) + Strava webhook GET.

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, dbConn } = require('../helper');

let srv;
let accessToken;
const PREFIX = 'mydash__ccstest__';

test.before(async () => {
  srv = await startServer();
  const email = `${PREFIX}${Date.now().toString(36)}@example.com`;
  const r = await fetch(`${srv.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prenom: 'Test', nom: 'Dash',
      username: `td_${Date.now().toString(36)}`,
      email, password: 'TestDash123',
    }),
  });
  accessToken = (await r.json()).accessToken;
});

test.after(async () => {
  if (srv) await srv.stop();
  const c = await dbConn();
  try { await c.query("DELETE FROM users WHERE email LIKE ?", [`%${PREFIX}%`]); }
  finally { await c.end(); }
});

function authed(path, opts = {}) {
  return fetch(`${srv.base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken,
      ...(opts.headers || {}),
    },
  });
}

test('GET /api/my/dashboard sans auth → 401', async () => {
  const r = await fetch(`${srv.base}/api/my/dashboard`);
  assert.equal(r.status, 401);
});

test('GET /api/my/dashboard avec auth → structure complète', async () => {
  const r = await authed('/api/my/dashboard');
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(Array.isArray(d.favorites));
  assert.ok(Array.isArray(d.inscriptions));
  assert.ok(Array.isArray(d.recent_views));
  assert.ok(typeof d.unread_notifications === 'number');
});

test('GET /api/my/inscriptions → liste', async () => {
  const r = await authed('/api/my/inscriptions');
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(Array.isArray(d.inscriptions));
});

test('GET /api/my/recent → liste', async () => {
  const r = await authed('/api/my/recent');
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(Array.isArray(d.recent));
});

test('POST /api/my/recent/:sortieId → 200 (silencieux même si sortie inconnue)', async () => {
  const r = await authed('/api/my/recent/sortie-inconnue-zzz', { method: 'POST' });
  assert.equal(r.status, 200);
});

/* ─── Strava webhook ───────────────────────────────────────── */

test('GET /api/strava/webhook avec challenge correct → renvoie le challenge', async () => {
  const r = await fetch(`${srv.base}/api/strava/webhook?hub.mode=subscribe&hub.challenge=CHALLENGE_123&hub.verify_token=CCS_STRAVA_WEBHOOK`);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d['hub.challenge'], 'CHALLENGE_123');
});

test('GET /api/strava/webhook avec mauvais token → 403', async () => {
  const r = await fetch(`${srv.base}/api/strava/webhook?hub.mode=subscribe&hub.challenge=X&hub.verify_token=WRONG`);
  assert.equal(r.status, 403);
});

test('POST /api/strava/webhook → 200 (ack rapide)', async () => {
  const r = await fetch(`${srv.base}/api/strava/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object_type: 'activity',
      object_id: 12345,
      aspect_type: 'create',
      owner_id: 99999, // athlete non lié, le handler doit silently no-op
    }),
  });
  assert.equal(r.status, 200);
});

/* ─── GPX preview (admin-only) ─────────────────────────────── */

test('POST /api/sorties/preview-gpx sans auth → 401', async () => {
  const r = await fetch(`${srv.base}/api/sorties/preview-gpx`, { method: 'POST' });
  assert.equal(r.status, 401);
});
