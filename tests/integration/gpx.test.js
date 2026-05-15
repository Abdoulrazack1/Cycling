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

test('asset/gpx/avesnois.gpx existe + a >100 trkpts avec altitudes', () => {
  const xml = fs.readFileSync(path.join(GPX_DIR, 'avesnois.gpx'), 'utf8');
  assert.ok(xml.startsWith('<?xml'), 'doit commencer par <?xml');
  assert.ok(xml.includes('<gpx '), 'doit avoir balise <gpx>');
  const pts = countTrkpts(xml);
  assert.ok(pts > 100, `>100 trkpts attendus, ${pts} trouvés`);
  assert.equal(countEle(xml), pts, 'chaque trkpt doit avoir <ele>');
});

test('les 4 GPX de démo sont présents', () => {
  for (const slug of ['avesnois', 'cote-opale', 'pevele', 'scarpe-gravel']) {
    const p = path.join(GPX_DIR, `${slug}.gpx`);
    assert.ok(fs.existsSync(p), `${slug}.gpx manquant`);
  }
});
