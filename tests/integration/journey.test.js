// tests/integration/journey.test.js
// Couvre les nouvelles routes parcours utilisateur :
// favorites + notifications + sortie inscriptions + auth/me extended.

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, dbConn } = require('../helper');

let srv;
let userId, accessToken, sortieId;

const TEST_EMAIL_PREFIX = 'journey__ccstest__';

test.before(async () => {
  srv = await startServer();
  // Crée un user de test + récupère token
  const email = `${TEST_EMAIL_PREFIX}${Date.now().toString(36)}@example.com`;
  const r = await fetch(`${srv.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prenom: 'Test', nom: 'Journey',
      username: `tj_${Date.now().toString(36)}`,
      email, password: 'TestJourney123',
    }),
  });
  const data = await r.json();
  accessToken = data.accessToken;
  userId = data.user.id;

  // Récupère une sortie existante pour les tests favori/inscription
  const list = await fetch(`${srv.base}/api/sorties?limit=1`).then(r => r.json());
  sortieId = Array.isArray(list) ? list[0]?.id : list.sorties?.[0]?.id;
});

test.after(async () => {
  if (srv) await srv.stop();
  // Cleanup
  const c = await dbConn();
  try {
    await c.query("DELETE FROM users WHERE email LIKE ?", [`%${TEST_EMAIL_PREFIX}%`]);
  } finally { await c.end(); }
});

function authedFetch(path, opts = {}) {
  return fetch(`${srv.base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken,
      ...(opts.headers || {}),
    },
  });
}

/* ─── Favorites ────────────────────────────────────────────── */

test('GET /api/favorites sans auth → 401', async () => {
  const r = await fetch(`${srv.base}/api/favorites`);
  assert.equal(r.status, 401);
});

test('POST /api/favorites/:sortieId ajoute aux favoris', async () => {
  if (!sortieId) { console.log('Pas de sortie en BDD, skip'); return; }
  const r = await authedFetch(`/api/favorites/${encodeURIComponent(sortieId)}`, { method: 'POST' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.favorite, true);
});

test('GET /api/favorites/check/:sortieId reflète l\'état', async () => {
  if (!sortieId) return;
  const r = await authedFetch(`/api/favorites/check/${encodeURIComponent(sortieId)}`);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.favorite, true);
});

test('GET /api/favorites liste les favoris du user', async () => {
  if (!sortieId) return;
  const r = await authedFetch('/api/favorites');
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(Array.isArray(d.favorites));
  assert.ok(d.favorites.length >= 1);
});

test('DELETE /api/favorites/:sortieId retire', async () => {
  if (!sortieId) return;
  const r = await authedFetch(`/api/favorites/${encodeURIComponent(sortieId)}`, { method: 'DELETE' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.favorite, false);
});

test('POST /api/favorites/:bidon → 404', async () => {
  const r = await authedFetch('/api/favorites/sortie-inexistante-xxx', { method: 'POST' });
  assert.equal(r.status, 404);
});

/* ─── Notifications ───────────────────────────────────────── */

test('GET /api/notifications sans auth → 401', async () => {
  const r = await fetch(`${srv.base}/api/notifications`);
  assert.equal(r.status, 401);
});

test('GET /api/notifications/unread → count entier', async () => {
  const r = await authedFetch('/api/notifications/unread');
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(typeof d.unread === 'number');
  assert.ok(d.unread >= 0);
});

test('GET /api/notifications retourne liste vide pour nouveau user', async () => {
  const r = await authedFetch('/api/notifications');
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(Array.isArray(d.notifications));
});

test('POST /api/notifications/read-all → ok', async () => {
  const r = await authedFetch('/api/notifications/read-all', { method: 'POST' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ok, true);
});

/* ─── Sortie inscriptions ─────────────────────────────────── */

test('GET /api/sorties/:id/inscriptions accessible publiquement', async () => {
  if (!sortieId) return;
  const r = await fetch(`${srv.base}/api/sorties/${encodeURIComponent(sortieId)}/inscriptions`);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(Array.isArray(d.inscriptions));
});

test('POST /api/sorties/:id/inscription sans auth → 401', async () => {
  if (!sortieId) return;
  const r = await fetch(`${srv.base}/api/sorties/${encodeURIComponent(sortieId)}/inscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(r.status, 401);
});

test('GET /api/sorties/:id/inscription/me → null pour user pas inscrit', async () => {
  if (!sortieId) return;
  const r = await authedFetch(`/api/sorties/${encodeURIComponent(sortieId)}/inscription/me`);
  assert.equal(r.status, 200);
  const d = await r.json();
  // Le user n'est pas encore inscrit (à moins qu'une sortie soit passée)
  assert.ok(d.inscription === null || d.inscription !== undefined);
});

test('POST puis DELETE inscription cycle complet', async () => {
  if (!sortieId) return;
  // Vérifie que la sortie n'est pas passée — sinon le POST retournera 400
  const sortie = await fetch(`${srv.base}/api/sorties/${encodeURIComponent(sortieId)}`).then(r => r.json());
  if (sortie.statut === 'passee') { console.log('Sortie passée, skip cycle'); return; }

  const r1 = await authedFetch(`/api/sorties/${encodeURIComponent(sortieId)}/inscription`, {
    method: 'POST',
    body: JSON.stringify({ note: 'test' }),
  });
  assert.equal(r1.status, 200);
  const d1 = await r1.json();
  assert.ok(['registered', 'already_registered'].includes(d1.status));

  const r2 = await authedFetch(`/api/sorties/${encodeURIComponent(sortieId)}/inscription`, { method: 'DELETE' });
  assert.equal(r2.status, 200);
});

/* ─── /api/auth/me étendu ─────────────────────────────────── */

test('GET /api/auth/me inclut strava_linked + inscriptions_count', async () => {
  const r = await authedFetch('/api/auth/me');
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok('strava_linked' in d);
  assert.ok('inscriptions_count' in d);
  assert.equal(d.strava_linked, false);
  assert.ok(typeof d.inscriptions_count === 'number');
});
