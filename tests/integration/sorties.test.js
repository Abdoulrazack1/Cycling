// tests/integration/sorties.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('../helper');

let srv;
test.before(async () => { srv = await startServer(); });
test.after(async () => { if (srv) await srv.stop(); });

test('GET /api/sorties → 200 + array', async () => {
  const r = await fetch(`${srv.base}/api/sorties`);
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.ok(Array.isArray(data) || Array.isArray(data.sorties), 'doit renvoyer un array');
});

test('GET /api/sorties/inexistante → 404', async () => {
  const r = await fetch(`${srv.base}/api/sorties/inexistante-zzz-9999`);
  assert.equal(r.status, 404);
});

test('GET /api/club → 200 + champ name', async () => {
  const r = await fetch(`${srv.base}/api/club`);
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.ok(data.name || data.nom, 'doit avoir un nom');
});
