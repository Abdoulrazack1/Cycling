// tests/integration/gpx.test.js
// Test léger : on parse les GPX de démo générés par scripts/generate-demo-gpx.js
// pour s'assurer que la structure XML est correcte et que les altitudes sont là.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GPX_DIR = path.join(__dirname, '..', '..', 'asset', 'gpx');

function countTrkpts(xml) {
  return (xml.match(/<trkpt\b/g) || []).length;
}
function countEle(xml) {
  return (xml.match(/<ele>/g) || []).length;
}

// Liste dynamique des GPX présents dans asset/gpx/.
// Les anciens fichiers de démo (avesnois, cote-opale, pevele, scarpe-gravel)
// ont été remplacés par les vrais GPX des sorties du club.
const gpxFiles = fs.existsSync(GPX_DIR)
  ? fs.readdirSync(GPX_DIR).filter(f => f.endsWith('.gpx'))
  : [];

test('asset/gpx contient au moins un fichier GPX valide', () => {
  assert.ok(gpxFiles.length > 0, 'au moins un .gpx attendu dans asset/gpx/');
  // On vérifie que le premier GPX est bien formé
  const xml = fs.readFileSync(path.join(GPX_DIR, gpxFiles[0]), 'utf8');
  assert.ok(xml.startsWith('<?xml'), 'doit commencer par <?xml');
  assert.ok(xml.includes('<gpx'), 'doit contenir une balise <gpx>');
  const pts = countTrkpts(xml);
  assert.ok(pts > 10, `au moins 10 trkpts attendus, ${pts} trouvés`);
});

test('chaque GPX présent a des altitudes sur chaque trkpt', () => {
  for (const file of gpxFiles) {
    const xml = fs.readFileSync(path.join(GPX_DIR, file), 'utf8');
    const pts = countTrkpts(xml);
    const eles = countEle(xml);
    // Tolérance : on accepte 90 %+ des points avec altitude (les GPX importés
    // de Strava ou OSM peuvent avoir des points sans ele)
    assert.ok(eles >= Math.floor(pts * 0.9), `${file}: ${eles}/${pts} altitudes (>=90% attendu)`);
  }
});
