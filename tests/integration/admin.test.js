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
  // Crée un user non-admin
  const suf = Date.now().toString(36);
  await fetch(`${srv.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prenom: 'NonAdmin', nom: 'Test',
      username: `na_${suf}`,
      email: `nonadmin__ccstest__${suf}@example.com`,
      password: 'NonAdminPass1',
    }),
  });
  const loginR = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: `nonadmin__ccstest__${suf}@example.com`, password: 'NonAdminPass1' }),
  });
  const { accessToken } = await loginR.json();

  const r = await fetch(`${srv.base}/api/admin/scraper-health`, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  assert.equal(r.status, 403);
});
