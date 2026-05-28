/**
 * scripts/reproject-2jam.js
 *
 * Re-parse les .txt déjà dumpés par ocr-2jam-pdfs.js (évite de
 * relancer Tesseract qui prend 30s).
 */
'use strict';
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('../config/database');
const { parseGpx, haversineMeters } = require('../services/gpx-parser');
const { parseStravaCueSheet, projectDirectionsOnGpx } = require('../services/strava-pdf-parser');

const PDF_DIR = path.join(__dirname, '..', 'uploads', 'pdf');
const GPX_DIR = path.join(__dirname, '..', 'asset', 'gpx');

const MAPPING = [
  { txt: 'clm-2jam.txt',     sortieId: 'clm-2jam-2026-05-17',  gpx: 'clm-2jam.gpx' },
  { txt: '2jam-etape-2.txt', sortieId: '2jam-etape-2-2026',    gpx: '2jam-etape-2.gpx' },
  { txt: '2jam-etape-1.txt', sortieId: '2jam-etape-1-2026',    gpx: null },
];

(async () => {
  for (const { txt, sortieId, gpx } of MAPPING) {
    console.log(`\n═══ ${sortieId} ═══`);
    const txtPath = path.join(PDF_DIR, txt);
    if (!fs.existsSync(txtPath)) { console.log(`  ✗ ${txt} manquant`); continue; }
    const text = fs.readFileSync(txtPath, 'utf8');

    const directions = parseStravaCueSheet(text);
    console.log(`  Directions extraites : ${directions.length}`);
    directions.slice(0, 15).forEach(d =>
      console.log(`    ${d.km.toFixed(2)} km · ${d.action}${d.street ? ' — ' + d.street.slice(0, 80) : ''}`)
    );
    if (directions.length > 15) console.log(`    ... et ${directions.length - 15} autres`);

    if (directions.length === 0) { console.log('  ⚠ Aucune direction'); continue; }

    // Si pas de GPX, on insère sans projection
    if (!gpx) {
      const [s] = await query('SELECT location_lat, location_lng FROM sorties WHERE id = ?', [sortieId]);
      if (!s?.location_lat) { console.log('  ✗ Pas de location_lat, skip'); continue; }
      await query('DELETE FROM pois WHERE sortie_id = ?', [sortieId]);
      let inserted = 0;
      for (const d of directions) {
        await query(
          `INSERT INTO pois (id, sortie_id, type, label, description, lat, lng, km, user_added)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
          ['p-cue-' + crypto.randomBytes(5).toString('hex'),
           sortieId, d.type, d.action + (d.street ? ' — ' + d.street : ''),
           d.raw, s.location_lat, s.location_lng, d.km]
        );
        inserted++;
      }
      console.log(`  ✓ ${inserted} POIs (au point de départ, faute de GPX)`);
      continue;
    }

    // Avec GPX : projection
    const gpxPath = path.join(GPX_DIR, gpx);
    const m = parseGpx(fs.readFileSync(gpxPath, 'utf8'));
    const projected = projectDirectionsOnGpx(directions, m.points, haversineMeters);
    console.log(`  Projetés sur le tracé : ${projected.length}/${directions.length}`);

    await query('DELETE FROM pois WHERE sortie_id = ?', [sortieId]);
    let inserted = 0;
    for (const p of projected) {
      await query(
        `INSERT INTO pois (id, sortie_id, type, label, description, lat, lng, km, user_added)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
        ['p-cue-' + crypto.randomBytes(5).toString('hex'),
         sortieId, p.type, p.label, p.description, p.lat, p.lng, p.km]
      );
      inserted++;
    }
    console.log(`  ✓ ${inserted} POIs insérés`);
  }

  const totals = await query('SELECT sortie_id, COUNT(*) AS n FROM pois GROUP BY sortie_id ORDER BY sortie_id');
  console.log('\n═══ RÉCAP BDD ═══');
  totals.forEach(r => console.log(`  ${r.sortie_id} : ${r.n} POIs`));
  process.exit(0);
})().catch(err => { console.error('Erreur:', err.message); process.exit(1); });
