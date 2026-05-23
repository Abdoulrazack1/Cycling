// tests/integration/public-endpoints.test.js
// Smoke test : tous les endpoints publics répondent < 500 + JSON valide.

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('../helper');

let srv;
test.before(async () => { srv = await startServer(); });
test.after(async () => { if (srv) await srv.stop(); });

const PUBLIC_ENDPOINTS = [
  '/api/health',
  '/api/health?deep=1',
  '/api/sorties',
  '/api/sorties?statut=passee',
  '/api/sorties?statut=future',
  '/api/sorties?statut=passee&limit=5',
  '/api/evenements',
  '/api/membres',
  '/api/club',
  '/api/segments',
  '/api/palmares',
  '/api/stats',
  '/api/search?q=salouel',
  '/api/search?q=ab', // 2 char minimum
];

for (const ep of PUBLIC_ENDPOINTS) {
  test(`GET ${ep} → < 500 + JSON valide`, async () => {
    const r = await fetch(`${srv.base}${ep}`);
    assert.ok(r.status < 500, `${ep} → status ${r.status}`);
    const ct = r.headers.get('content-type') || '';
    assert.ok(ct.includes('application/json'), `${ep} → content-type "${ct}"`);
    const data = await r.json();
    assert.ok(data !== null);
  });
}

test('GET /api/sitemap.xml → 200 + XML', async () => {
  const r = await fetch(`${srv.base}/sitemap.xml`);
  assert.equal(r.status, 200);
  const ct = r.headers.get('content-type') || '';
  assert.ok(ct.includes('xml'), `content-type "${ct}"`);
  const body = await r.text();
  assert.ok(body.includes('<urlset'), 'doit contenir <urlset>');
});

test('GET / → 200 HTML', async () => {
  const r = await fetch(`${srv.base}/`);
  assert.equal(r.status, 200);
  assert.ok((r.headers.get('content-type') || '').includes('html'));
});

test('GET /url-bidon-qui-existe-pas → 404 HTML', async () => {
  const r = await fetch(`${srv.base}/url-bidon-qui-existe-pas`);
  assert.equal(r.status, 404);
});

test('GET /api/route-bidon → 404 JSON', async () => {
  const r = await fetch(`${srv.base}/api/route-bidon`);
  assert.equal(r.status, 404);
  const ct = r.headers.get('content-type') || '';
  assert.ok(ct.includes('application/json'));
});

test('Response headers : Cache-Control sur GET publics', async () => {
  const r = await fetch(`${srv.base}/api/sorties`);
  const cc = r.headers.get('cache-control') || '';
  assert.ok(cc.length > 0, 'Cache-Control doit être défini');
});

test('GET /api/sorties limit=invalide → handled', async () => {
  const r = await fetch(`${srv.base}/api/sorties?limit=abc`);
  // Soit 400 (validé) soit 200 (limit ignoré). Pas 500.
  assert.ok(r.status < 500, `status ${r.status}`);
});
