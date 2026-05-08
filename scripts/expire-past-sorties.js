/**
 * scripts/expire-past-sorties.js
 *
 * Nettoyage automatique des courses passées : supprime de la BDD et du
 * disque les sorties dont la date est antérieure à (aujourd'hui - GRACE_DAYS).
 *
 * Les itinéraires permanents (date = 2099-12-31, sources OSM) sont préservés.
 *
 * Configurable via .env :
 *   SCRAPE_GRACE_DAYS=7     # nombre de jours après la date de la course
 *                           # avant suppression (défaut 7)
 *
 * Usage :
 *   node scripts/expire-past-sorties.js          # vrai mode, supprime
 *   node scripts/expire-past-sorties.js --dry    # liste sans supprimer
 *
 * Idéalement à appeler :
 *   - au démarrage du serveur (cf. server.js)
 *   - via une tâche planifiée Windows / cron quotidien
 */

'use strict';
require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const GRACE_DAYS = parseInt(process.env.SCRAPE_GRACE_DAYS || '7', 10);
const PERMANENT_DATE = '2099-12-31';
const GPX_DIR = path.join(__dirname, '..', 'asset', 'gpx');

async function main() {
  const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000)
    .toISOString().slice(0, 10);

  console.log(`\n──  Nettoyage courses passées (date < ${cutoff}, grâce ${GRACE_DAYS}j) ${DRY ? '[DRY-RUN]' : ''}`);

  const db = require('../config/database');

  let toDelete;
  try {
    toDelete = await db.query(
      'SELECT id, title, date, gpx_filename FROM sorties WHERE date < ? AND date < ?',
      [cutoff, PERMANENT_DATE]
    );
  } catch (e) {
    console.error('  ❌ Lecture sorties :', e.message);
    process.exit(1);
  }

  if (!toDelete.length) {
    console.log('  ✅ Aucune course à expirer.');
    process.exit(0);
  }

  console.log(`  ${toDelete.length} course(s) candidate(s) à la suppression :`);
  toDelete.slice(0, 10).forEach(r => console.log(`    • [${r.date}] ${r.id.padEnd(40)} ${r.title}`));
  if (toDelete.length > 10) console.log(`    … et ${toDelete.length - 10} autres`);

  if (DRY) {
    console.log('\n  [DRY-RUN] Rien supprimé. Relance sans --dry pour exécuter.');
    process.exit(0);
  }

  // Suppression GPX
  let nGpx = 0;
  for (const row of toDelete) {
    if (!row.gpx_filename) continue;
    const p = path.join(GPX_DIR, row.gpx_filename);
    try { fs.unlinkSync(p); nGpx++; } catch { /* déjà absent */ }
  }

  // Suppression BDD (tables liées + sorties)
  const ids = toDelete.map(r => r.id);
  const ph = ids.map(() => '?').join(',');
  try {
    await db.query(`DELETE FROM pois WHERE sortie_id IN (${ph})`, ids).catch(() => {});
    await db.query(`DELETE FROM sortie_tags WHERE sortie_id IN (${ph})`, ids).catch(() => {});
    await db.query(`DELETE FROM sortie_segments WHERE sortie_id IN (${ph})`, ids).catch(() => {});
    await db.query(`DELETE FROM sortie_stats_extra WHERE sortie_id IN (${ph})`, ids).catch(() => {});
    await db.query(`DELETE FROM sorties WHERE id IN (${ph})`, ids);
    console.log(`\n  ✅ ${toDelete.length} course(s) supprimée(s) · ${nGpx} GPX nettoyé(s)`);
  } catch (e) {
    console.error('\n  ❌ Suppression BDD :', e.message);
    process.exit(1);
  }

  try { await db.pool?.end?.(); } catch {}
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });