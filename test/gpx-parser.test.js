// test/gpx-parser.test.js — Cf. AUDIT item #27
// Lancé via `npm test` (utilise `node --test`, intégré, zéro dep).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseGpx } = require('../services/gpx-parser');

const GPX_MIN = `<?xml version="1.0"?>
<gpx><trk><trkseg>
  <trkpt lat="49.0" lon="2.0"><ele>100</ele></trkpt>
  <trkpt lat="49.001" lon="2.0"><ele>110</ele></trkpt>
  <trkpt lat="49.002" lon="2.0"><ele>105</ele></trkpt>
</trkseg></trk></gpx>`;

const GPX_NO_ELE = `<?xml version="1.0"?>
<gpx><trk><trkseg>
  <trkpt lat="49.0" lon="2.0"/>
  <trkpt lat="49.001" lon="2.0"/>
</trkseg></trk></gpx>`;

const GPX_LAT_LON_INVERSED = `<?xml version="1.0"?>
<gpx><trk><trkseg>
  <trkpt lon="2.0" lat="49.0"><ele>100</ele></trkpt>
  <trkpt lon="2.0" lat="49.001"><ele>110</ele></trkpt>
</trkseg></trk></gpx>`;

describe('parseGpx', () => {

  test('parse un GPX standard avec élévation', () => {
    const m = parseGpx(GPX_MIN);
    assert.equal(m.points.length, 3);
    assert.equal(typeof m.distance_km, 'number');
    assert.ok(m.distance_km > 0 && m.distance_km < 1, `distance attendue ~0.2 km, reçu ${m.distance_km}`);
  });

  test('rejette un fichier non-GPX', () => {
    assert.throws(() => parseGpx('hello world'), /<gpx>/);
  });

  test('rejette un GPX vide (aucun trkpt)', () => {
    assert.throws(() => parseGpx('<gpx></gpx>'), /vide/);
  });

  test('rejette un GPX avec un seul point', () => {
    const oneP = `<gpx><trkpt lat="49" lon="2"/></gpx>`;
    assert.throws(() => parseGpx(oneP), /2\+/);
  });

  test('gère lat/lon inversé (Komoot et autres)', () => {
    const m = parseGpx(GPX_LAT_LON_INVERSED);
    assert.equal(m.points.length, 2);
    assert.equal(m.points[0].lat, 49.0);
    assert.equal(m.points[0].lng, 2.0);
  });

  test('gère un GPX sans élévation (D+ et D- = 0)', () => {
    const m = parseGpx(GPX_NO_ELE);
    assert.equal(m.elevation_gain, 0);
    assert.equal(m.elevation_loss, 0);
    // Les altitudes min/max ne sont pas calculées
    assert.ok(m.distance_km > 0);
  });

  test('le lissage évite les inflations sur du bruit GPS', () => {
    // Simule du bruit ±2m autour d'une élévation constante
    let xml = '<gpx><trk><trkseg>';
    for (let i = 0; i < 100; i++) {
      const lat = 49 + i * 0.001;
      const ele = 100 + (i % 2 === 0 ? -2 : 2); // bruit oscillant
      xml += `<trkpt lat="${lat}" lon="2.0"><ele>${ele}</ele></trkpt>`;
    }
    xml += '</trkseg></trk></gpx>';
    const m = parseGpx(xml);
    // Sur 100 points oscillant ±2m, sans lissage on aurait ~400m de D+.
    // Avec lissage fenêtre 10, on attend D+ < 20m.
    assert.ok(m.elevation_gain < 20,
      `D+ avec bruit attendu < 20m, reçu ${m.elevation_gain}m (ancien comportement: ~400m)`);
  });

});
