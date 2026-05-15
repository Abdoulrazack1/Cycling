// tests/integration/admin.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('../helper');

let srv;
test.before(async () => { srv = await startServer(); });
test.after(async () => { if (srv) await srv.stop(); });

test('GET /api/admin/scraper-health sans token → 401', async () => {
  const r = await fetch(`${srv.base}/api/admin/scraper-health`);
  assert.equal(r.status, 401);
});

test('GET /api/admin/scraper-health avec token non-admin → 403', async () => {
  // Crée un user non-admin (avec username/email uniques)
  const suf = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const email = `nonadmin__ccstest__${suf}@example.com`;
  const password = 'NonAdminPass1';
  const reg = await fetch(`${srv.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prenom: 'NonAdmin', nom: 'Test',
      username: `na_${suf}`,
      email, password,
    }),
  });
  assert.ok(reg.status === 200 || reg.status === 201, `register status: ${reg.status}`);

  const loginR = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: email, password }),
  });
  assert.equal(loginR.status, 200, `login failed: ${loginR.status}`);
  const { accessToken } = await loginR.json();
  assert.ok(accessToken, 'accessToken doit être présent');

  const r = await fetch(`${srv.base}/api/admin/scraper-health`, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  assert.equal(r.status, 403);
});
