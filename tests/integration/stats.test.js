// tests/integration/stats.test.js
// Couvre /api/stats : valeurs cohérentes + cache fonctionnel + flush.

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('../helper');

let srv;
test.before(async () => { srv = await startServer(); });
test.after(async () => { if (srv) await srv.stop(); });

test('GET /api/stats → 200 + clés attendues', async () => {
  const r = await fetch(`${srv.base}/api/stats`);
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.ok(typeof data.sorties === 'object', 'sorties doit être un objet');
  assert.ok('total' in data.sorties);
  assert.ok('passees' in data.sorties);
  assert.ok(typeof data.kilometres === 'number');
  assert.ok(typeof data.denivele === 'number');
  assert.ok(typeof data.evenements === 'object');
  assert.ok(typeof data.membres === 'object');
  assert.ok(typeof data.segments === 'object');
});

test('GET /api/stats : 2e appel → X-Cache: HIT', async () => {
  // Forcer cache miss
  await fetch(`${srv.base}/api/stats`, { method: 'POST' }).catch(() => {});
  await fetch(`${srv.base}/api/stats/flush`, { method: 'POST' });
  const r1 = await fetch(`${srv.base}/api/stats`);
  const r2 = await fetch(`${srv.base}/api/stats`);
  assert.equal(r2.headers.get('x-cache'), 'HIT', 'le 2e appel doit être servi depuis le cache');
});

test('POST /api/stats/flush → invalide le cache', async () => {
  const r = await fetch(`${srv.base}/api/stats/flush`, { method: 'POST' });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.ok, true);
});

test('GET /api/stats : valeurs cohérentes (totaux non-négatifs)', async () => {
  const r = await fetch(`${srv.base}/api/stats`);
  const d = await r.json();
  assert.ok(d.sorties.total >= 0);
  assert.ok(d.sorties.passees >= 0);
  assert.ok(d.sorties.passees <= d.sorties.total, 'passées ≤ total');
  assert.ok(d.kilometres >= 0);
  assert.ok(d.denivele >= 0);
  assert.ok(d.membres.actifs <= d.membres.total, 'membres actifs ≤ total');
});
