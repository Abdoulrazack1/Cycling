/**
 * scripts/auto-pois.js
 *
 * Genere automatiquement des POIs minimaux sur chaque sortie ayant un GPX :
 *   - Depart (km 0)
 *   - Arrivee (dernier point)
 *   - Bornes kilometriques tous les 2 km (km 2, 4, 6, ...)
 *
 * Idempotent : ne re-cree pas si depart/arrivee/borne km existe deja.
 */
'use strict';
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('../src/config/database');
const { parseGpx, haversineMeters } = require('../src/services/gpx-parser');

const GPX_DIR = path.join(__dirname, '..', 'public', 'asset', 'gpx');

function uid(prefix) {
  return prefix + '-' + crypto.randomBytes(4).toString('hex');
}

(async () => {
  const sorties = await query('SELECT id, gpx_filename, title FROM sorties WHERE gpx_filename IS NOT NULL');
  if (!sorties.length) {
    console.log('Aucune sortie avec GPX.');
    process.exit(0);
  }

  for (const s of sorties) {
    const gpxPath = path.join(GPX_DIR, s.gpx_filename);
    if (!fs.existsSync(gpxPath)) {
      console.log(`✗ GPX manquant : ${s.gpx_filename}`);
      continue;
    }
    const xml = fs.readFileSync(gpxPath, 'utf8');
    const m = parseGpx(xml);
    if (!m.points?.length) { console.log(`✗ Pas de points : ${s.id}`); continue; }

    // Calcule la distance cumulee pour chaque point
    const pts = m.points;
    let cumDist = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cumDist += haversineMeters(pts[i - 1], pts[i]);
      cum.push(cumDist);
    }
    const totalKm = cumDist / 1000;

    const existing = await query('SELECT id, type FROM pois WHERE sortie_id = ?', [s.id]);
    const existingTypes = new Set(existing.map(p => p.type));

    let added = 0;

    // 1. Depart
    if (!existingTypes.has('depart')) {
      await query(
        `INSERT INTO pois (id, sortie_id, type, label, lat, lng, km, user_added)
         VALUES (?,?,?,?,?,?,?,FALSE)`,
        [uid('p-depart'), s.id, 'depart', 'Départ', pts[0].lat, pts[0].lng, 0]
      );
      added++;
    }

    // 2. Arrivee
    if (!existingTypes.has('arrivee')) {
      const last = pts[pts.length - 1];
      await query(
        `INSERT INTO pois (id, sortie_id, type, label, lat, lng, km, user_added)
         VALUES (?,?,?,?,?,?,?,FALSE)`,
        [uid('p-arrivee'), s.id, 'arrivee', 'Arrivée', last.lat, last.lng, +totalKm.toFixed(2)]
      );
      added++;
    }

    // 3. Bornes kilometriques tous les 2 km
    for (let target = 2; target < totalKm; target += 2) {
      const targetM = target * 1000;
      // Cherche le point le plus proche de cette distance cumulee
      let idx = 0;
      for (let i = 0; i < cum.length; i++) {
        if (cum[i] >= targetM) { idx = i; break; }
      }
      const p = pts[idx];
      // On verifie qu'il n'existe pas deja une borne km a cet endroit (a 100m pres)
      const dup = await query(
        `SELECT id FROM pois WHERE sortie_id = ? AND type = 'direction'
         AND ABS(km - ?) < 0.1 LIMIT 1`,
        [s.id, target]
      );
      if (dup.length) continue;
      await query(
        `INSERT INTO pois (id, sortie_id, type, label, description, lat, lng, km, user_added)
         VALUES (?,?,?,?,?,?,?,?,FALSE)`,
        [uid('p-km'), s.id, 'direction', `Km ${target}`, `Borne kilométrique`,
         p.lat, p.lng, target]
      );
      added++;
    }

    console.log(`✓ ${s.id} : +${added} POI (total ${totalKm.toFixed(1)} km)`);
  }

  const total = await query('SELECT sortie_id, COUNT(*) AS n FROM pois GROUP BY sortie_id');
  console.log('\n--- Récap par sortie ---');
  total.forEach(r => console.log(`  ${r.sortie_id} : ${r.n} POI`));
  process.exit(0);
})().catch(err => {
  console.error('Erreur:', err.message);
  console.error(err.stack);
  process.exit(1);
});
