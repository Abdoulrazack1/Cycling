/**
 * scripts/ocr-2jam-pdfs.js
 *
 * Variante de extract-2jam-pdfs.js qui ajoute l'OCR Tesseract.js
 * pour les PDFs scannés (sans texte natif).
 *
 * Étapes :
 *   1. pdf-to-img : rend chaque page PDF en PNG buffer
 *   2. Tesseract.js (lang fra) : OCR sur chaque page
 *   3. Concatène le texte de toutes les pages
 *   4. parseStravaCueSheet → projection sur GPX → POIs
 */
'use strict';
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pdf } = require('pdf-to-img');
const { createWorker } = require('tesseract.js');
const { query } = require('../src/config/database');
const { parseGpx, haversineMeters } = require('../src/services/gpx-parser');
const { parseStravaCueSheet, projectDirectionsOnGpx } = require('../src/services/strava-pdf-parser');

const PDF_DIR = path.join(__dirname, '..', 'uploads', 'pdf');
const GPX_DIR = path.join(__dirname, '..', 'public', 'asset', 'gpx');

const MAPPING = [
  { pdf: 'clm-2jam.pdf',     sortieId: 'clm-2jam-2026-05-17',  gpx: 'clm-2jam.gpx' },
  { pdf: '2jam-etape-2.pdf', sortieId: '2jam-etape-2-2026',    gpx: '2jam-etape-2.gpx' },
  { pdf: '2jam-etape-1.pdf', sortieId: '2jam-etape-1-2026',    gpx: null },
];

async function ocrPdf(pdfPath, worker) {
  console.log(`  Rendu PDF en images…`);
  const document = await pdf(pdfPath, { scale: 2 });
  console.log(`  ${document.length} page(s)`);
  let fullText = '';
  let i = 0;
  for await (const png of document) {
    i++;
    console.log(`  OCR page ${i}/${document.length}…`);
    const { data: { text } } = await worker.recognize(png);
    fullText += '\n' + text;
  }
  return fullText;
}

(async () => {
  // Init un seul worker Tesseract pour toutes les pages
  console.log('Init Tesseract worker (fra)…');
  const worker = await createWorker('fra');

  for (const { pdf: pdfName, sortieId, gpx } of MAPPING) {
    console.log(`\n═══ ${sortieId} (${pdfName}) ═══`);
    const pdfPath = path.join(PDF_DIR, pdfName);
    if (!fs.existsSync(pdfPath)) { console.log(`  ✗ PDF manquant`); continue; }

    let text;
    try {
      text = await ocrPdf(pdfPath, worker);
    } catch (err) {
      console.log(`  ✗ Erreur OCR : ${err.message}`);
      continue;
    }
    console.log(`  Texte OCR : ${text.length} caractères`);

    // Sauvegarde texte pour debug
    const dumpPath = path.join(PDF_DIR, pdfName.replace('.pdf', '.txt'));
    fs.writeFileSync(dumpPath, text, 'utf8');
    console.log(`  Dump texte : ${dumpPath}`);

    // Parse
    const directions = parseStravaCueSheet(text);
    console.log(`  Directions reconnues : ${directions.length}`);
    if (directions.length === 0) {
      console.log('  ⚠ Aucune direction. Voici 20 lignes pour debug :');
      text.split('\n').filter(l => l.trim()).slice(0, 20).forEach((l, i) =>
        console.log(`    ${i+1}: ${l.slice(0, 120)}`)
      );
      continue;
    }
    directions.slice(0, 8).forEach(d =>
      console.log(`    ${d.km.toFixed(2)} km · ${d.action}${d.street ? ' — ' + d.street.slice(0, 60) : ''}`)
    );
    if (directions.length > 8) console.log(`    ... et ${directions.length - 8} autres`);

    // Si pas de GPX, on insère quand même avec lat/lng du départ
    if (!gpx) {
      const [s] = await query('SELECT location_lat, location_lng FROM sorties WHERE id = ?', [sortieId]);
      if (!s?.location_lat) { console.log('  ✗ Pas de GPS de départ, skip'); continue; }
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
      console.log(`  ✓ ${inserted} POIs insérés (au départ — pas de GPX)`);
      continue;
    }

    // Avec GPX : projection
    const gpxPath = path.join(GPX_DIR, gpx);
    const m = parseGpx(fs.readFileSync(gpxPath, 'utf8'));
    const projected = projectDirectionsOnGpx(directions, m.points, haversineMeters);
    console.log(`  Projetés : ${projected.length}/${directions.length}`);

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

  await worker.terminate();
  const totals = await query('SELECT sortie_id, COUNT(*) AS n FROM pois GROUP BY sortie_id ORDER BY sortie_id');
  console.log('\n═══ RÉCAP ═══');
  totals.forEach(r => console.log(`  ${r.sortie_id} : ${r.n} POIs`));
  process.exit(0);
})().catch(err => {
  console.error('Erreur:', err.message);
  console.error(err.stack);
  process.exit(1);
});
