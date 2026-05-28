/**
 * scripts/extract-2jam-pdfs.js
 *
 * Extrait les directions des 3 PDFs Strava 2JAM et les projette sur
 * le GPX correspondant de chaque sortie. Crée les POIs en BDD.
 *
 * Mapping :
 *   uploads/pdf/clm-2jam.pdf      → sortie clm-2jam-2026-05-17     (gpx clm-2jam.gpx)
 *   uploads/pdf/2jam-etape-2.pdf  → sortie 2jam-etape-2-2026       (gpx 2jam-etape-2.gpx)
 *   uploads/pdf/2jam-etape-1.pdf  → sortie 2jam-etape-1-2026       (pas de GPX, on extrait quand même les directions)
 */
'use strict';
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pdfParse = require('pdf-parse-fork');
const { query } = require('../config/database');
const { parseGpx, haversineMeters } = require('../services/gpx-parser');
const { parseStravaCueSheet, projectDirectionsOnGpx } = require('../services/strava-pdf-parser');

const PDF_DIR = path.join(__dirname, '..', 'uploads', 'pdf');
const GPX_DIR = path.join(__dirname, '..', 'asset', 'gpx');

const MAPPING = [
  { pdf: 'clm-2jam.pdf',     sortieId: 'clm-2jam-2026-05-17',  gpx: 'clm-2jam.gpx' },
  { pdf: '2jam-etape-2.pdf', sortieId: '2jam-etape-2-2026',    gpx: '2jam-etape-2.gpx' },
  { pdf: '2jam-etape-1.pdf', sortieId: '2jam-etape-1-2026',    gpx: null }, // pas de GPX dispo
];

(async () => {
  for (const { pdf, sortieId, gpx } of MAPPING) {
    console.log(`\n═══ ${sortieId} (${pdf}) ═══`);

    // 1. Extraire texte du PDF
    const pdfPath = path.join(PDF_DIR, pdf);
    if (!fs.existsSync(pdfPath)) {
      console.log(`  ✗ PDF manquant : ${pdfPath}`);
      continue;
    }
    const buf = fs.readFileSync(pdfPath);
    let pdfData;
    try {
      pdfData = await pdfParse(buf);
    } catch (err) {
      console.log(`  ✗ Erreur lecture PDF : ${err.message}`);
      continue;
    }
    const text = pdfData.text || '';
    console.log(`  PDF : ${pdfData.numpages} pages, ${text.length} caractères de texte`);
    if (process.env.SHOW_TEXT) {
      console.log('  --- Texte brut ---');
      console.log(text.slice(0, 2000));
      console.log('  --- /Texte ---');
    }

    // 2. Parse cue-sheet
    const directions = parseStravaCueSheet(text);
    console.log(`  Directions reconnues : ${directions.length}`);
    if (directions.length === 0) {
      console.log('  ⚠ Aucune direction détectée. Le PDF n\'est peut-être pas un cue-sheet standard.');
      // Affiche les 10 premières lignes pour debug
      console.log('  --- 10 premières lignes ---');
      text.split('\n').slice(0, 10).forEach((l, i) => console.log(`    ${i+1}: ${l.slice(0, 100)}`));
      continue;
    }
    directions.slice(0, 5).forEach(d => {
      console.log(`    ${d.km.toFixed(2)} km · ${d.action}${d.street ? ' — ' + d.street.slice(0, 60) : ''}`);
    });
    if (directions.length > 5) console.log(`    ... et ${directions.length - 5} autres`);

    // 3. Charger le GPX (si dispo) pour projection
    if (!gpx) {
      console.log(`  ℹ Pas de GPX pour cette sortie — les directions seront sauvegardées sans coordonnées GPS.`);
      // On peut quand même insérer les POIs en BDD avec lat/lng du départ de la sortie
      const [s] = await query('SELECT location_lat, location_lng FROM sorties WHERE id = ?', [sortieId]);
      if (!s?.location_lat) { console.log('  ✗ Pas non plus de location_lat — skip'); continue; }
      // Reset POIs existants
      await query('DELETE FROM pois WHERE sortie_id = ?', [sortieId]);
      let inserted = 0;
      for (const d of directions) {
        const id = 'p-cue-' + crypto.randomBytes(5).toString('hex');
        await query(
          `INSERT INTO pois (id, sortie_id, type, label, description, lat, lng, km, user_added)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
          [id, sortieId, d.type, d.action + (d.street ? ' — ' + d.street : ''),
           d.raw, s.location_lat, s.location_lng, d.km]
        );
        inserted++;
      }
      console.log(`  ✓ ${inserted} POIs insérés (tous au point de départ, faute de GPX)`);
      continue;
    }

    const gpxPath = path.join(GPX_DIR, gpx);
    if (!fs.existsSync(gpxPath)) {
      console.log(`  ✗ GPX manquant : ${gpxPath}`);
      continue;
    }
    const xml = fs.readFileSync(gpxPath, 'utf8');
    const m = parseGpx(xml);
    if (!m.points?.length) {
      console.log(`  ✗ GPX sans trackpoints`);
      continue;
    }
    console.log(`  GPX : ${m.points.length} trackpoints, ${m.distance_km} km`);

    // 4. Projection
    const projected = projectDirectionsOnGpx(directions, m.points, haversineMeters);
    console.log(`  Projetés sur le tracé : ${projected.length}`);

    // 5. Reset POIs existants et insert
    await query('DELETE FROM pois WHERE sortie_id = ?', [sortieId]);
    let inserted = 0;
    for (const p of projected) {
      const id = 'p-cue-' + crypto.randomBytes(5).toString('hex');
      await query(
        `INSERT INTO pois (id, sortie_id, type, label, description, lat, lng, km, user_added)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
        [id, sortieId, p.type, p.label, p.description, p.lat, p.lng, p.km]
      );
      inserted++;
    }
    console.log(`  ✓ ${inserted} POIs insérés pour ${sortieId}`);
  }

  // Récap final
  const totals = await query('SELECT sortie_id, COUNT(*) AS n FROM pois GROUP BY sortie_id ORDER BY sortie_id');
  console.log('\n═══ RÉCAP ═══');
  totals.forEach(r => console.log(`  ${r.sortie_id} : ${r.n} POIs`));

  process.exit(0);
})().catch(err => {
  console.error('Erreur:', err.message);
  console.error(err.stack);
  process.exit(1);
});
