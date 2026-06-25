// tests/scraper.test.js
// Tests du parser MilesRepublic — fixtures HTML statiques pour détecter
// les régressions quand on touche aux regex de parsing.
//
// Exécution : node --test tests/scraper.test.js

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');

const { _internals } = require('../src/services/course-scraper');
const { parseMilesRepublic, _name, _date, _lieu, _dist, _resetFallbacks, _fallbackHits } = _internals;

const FIXTURE = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'milesrepublic-cyclo-hdf.html'),
  'utf8'
);

const SRC = { name: 'mr-cyclo-hdf', eventType: 'cyclosportive' };

test('parseMilesRepublic extrait tous les events vélo (filtre running)', () => {
  _resetFallbacks();
  const events = parseMilesRepublic(FIXTURE, SRC);
  // 5 liens dans le fixture, 1 est running → 4 attendus
  assert.equal(events.length, 4, 'devrait extraire 4 events après filtre running');
});

test('extrait les champs essentiels du 1er event (Paris-Roubaix)', () => {
  const events = parseMilesRepublic(FIXTURE, SRC);
  const pr = events.find(e => /paris-roubaix/i.test(e.name));
  assert.ok(pr, 'Paris-Roubaix doit être trouvé');
  assert.equal(pr.date, '2026-04-14');
  assert.equal(pr.lieu, 'Roubaix');
  assert.equal(pr.region, 'Nord (59)');
  assert.equal(pr.distanceKm, 145);
  assert.equal(pr.type, 'cyclosportive');
});

test('détecte le type gravel via le mot-clé', () => {
  const events = parseMilesRepublic(FIXTURE, SRC);
  const gravel = events.find(e => /gravel/i.test(e.name));
  assert.ok(gravel);
  assert.equal(gravel.type, 'gravel');
});

test('_date gère la primaire (15 mars 2026)', () => {
  _resetFallbacks();
  assert.equal(_date('Départ le 15 mars 2026 à 9h'), '2026-03-15');
  assert.equal(Object.keys(_fallbackHits).length, 0, 'pas de fallback sur format primaire');
});

test('_date utilise le fallback DD/MM/YYYY et le signale', () => {
  _resetFallbacks();
  const d = _date('Inscription jusqu\'au 15/06/2026');
  assert.equal(d, '2026-06-15');
  assert.ok(_fallbackHits['date#1'] >= 1, 'fallback#1 doit être enregistré');
});

test('_date utilise le fallback ISO YYYY-MM-DD', () => {
  _resetFallbacks();
  const d = _date('event-date: 2026-09-12 publié');
  assert.equal(d, '2026-09-12');
  assert.ok(_fallbackHits['date#2'] >= 1);
});

test('_lieu primaire "Ville (NN)"', () => {
  _resetFallbacks();
  assert.deepEqual(_lieu('Roubaix (59) circuit'), { lieu: 'Roubaix', region: 'Nord (59)' });
  assert.equal(Object.keys(_fallbackHits).length, 0);
});

test('_lieu fallback "Ville, Département"', () => {
  _resetFallbacks();
  // Pas de "Ville (NN)" en amont : la primaire doit échouer
  const r = _lieu('Roubaix, Nord — départ libre');
  assert.equal(r.lieu, 'Roubaix');
  assert.equal(r.region, 'Nord (59)');
  assert.ok(_fallbackHits['lieu#1'] >= 1);
});

test('_dist primaire "120 km" (pattern unique, espace optionnel)', () => {
  _resetFallbacks();
  assert.equal(_dist('Distance : 120 km'), 120);
  assert.equal(_dist('Distance : 120km solo'), 120);
  // Les deux passent par la primaire (\s* matche 0 ou plusieurs espaces)
  assert.equal(Object.keys(_fallbackHits).length, 0);
});

test('_dist range "120-150 km" prend la plus grande (par backtracking)', () => {
  _resetFallbacks();
  // Le regex primaire \d{2,3}\s*km\b backtrack jusqu'au "150 km" — pas
  // besoin de fallback dans ce cas. Le fallback#1 est gardé pour des
  // variantes plus exotiques (séparateur emdash, etc.).
  assert.equal(_dist('120-150 km au choix'), 150);
});

test('_name nettoie les préfixes "Achat instantané" / "Nouveau"', () => {
  assert.equal(_name('Nouveau Paris-Roubaix Challenge'), 'Paris-Roubaix Challenge');
  assert.equal(_name('Achat instantané Tour de l\'Avesnois'), 'Tour de l\'Avesnois');
});

test('parser retourne array vide sur HTML sans <a href="/event/">', () => {
  _resetFallbacks();
  const evs = parseMilesRepublic('<html><body><p>Pas d\'event ici</p></body></html>', SRC);
  assert.equal(evs.length, 0);
});

test('parser tolère HTML très court sans déclencher fallback panic', () => {
  _resetFallbacks();
  const evs = parseMilesRepublic('<html/>', SRC);
  assert.equal(evs.length, 0);
  assert.equal(_fallbackHits['link-pattern-all-failed'], undefined, 'pas de panic sur HTML < 1000 octets');
});
