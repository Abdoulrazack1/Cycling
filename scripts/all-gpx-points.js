/**
 * scripts/all-gpx-points.js
 *
 * Reset + insère TOUS les points trkpt du GPX comme POIs sur chaque
 * sortie ayant un GPX. Pas de discrimination — chaque point de la
 * trace devient un POI de type "direction".
 *
 * WARNING : Crée énormément de rows (147 + 159 ~= 300 POIs sur les
 * sorties 2JAM). Sur une longue sortie 100km avec 5000 trackpoints,
 * ça donnerait 5000 POIs.
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
  return prefix + '-' + crypto.randomBytes(5).toString('hex');
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

    // RESET : on supprime tous les POIs existants de cette sortie
    await query('DELETE FROM pois WHERE sortie_id = ?', [s.id]);

    const xml = fs.readFileSync(gpxPath, 'utf8');
    const m = parseGpx(xml);
    if (!m.points?.length) { console.log(`✗ Pas de points : ${s.id}`); continue; }

    const pts = m.points;
    let cumDist = 0;

    // Bulk insert pour performance : on prépare un tableau de placeholders
    const rows = [];
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) cumDist += haversineMeters(pts[i - 1], pts[i]);
      const km = +(cumDist / 1000).toFixed(3);
      let type = 'direction';
      let label;
      if (i === 0) { type = 'depart';  label = 'Départ'; }
      else if (i === pts.length - 1) { type = 'arrivee'; label = 'Arrivée'; }
      else { label = `Point ${i}`; }

      rows.push([
        uid('p-' + i),
        s.id, type, label,
        null,             // description (vide pour les points intermédiaires)
        pts[i].lat, pts[i].lng,
        km, false,
      ]);
    }

    // Insert en batch (par chunks de 100 pour éviter MAX_PACKET_SIZE)
    const CHUNK = 100;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?,?)').join(', ');
      const flat = chunk.flat();
      await query(
        `INSERT INTO pois (id, sortie_id, type, label, description, lat, lng, km, user_added)
         VALUES ${placeholders}`,
        flat
      );
    }

    console.log(`✓ ${s.id} : ${rows.length} POIs (${cumDist.toFixed(0)} m total)`);
  }

  const total = await query('SELECT sortie_id, COUNT(*) AS n FROM pois GROUP BY sortie_id');
  console.log('\n--- Récap ---');
  total.forEach(r => console.log(`  ${r.sortie_id} : ${r.n} POIs`));
  process.exit(0);
})().catch(err => {
  console.error('Erreur:', err.message);
  console.error(err.stack);
  process.exit(1);
});
