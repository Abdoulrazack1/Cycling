/**
 * scripts/backup-cleanup.js
 *
 * Rotation échelonnée des backups MySQL (Brief D3) :
 *   - Garde TOUS les backups < 7 jours    (rotation quotidienne)
 *   - Garde 1 par semaine sur 4 semaines  (rotation hebdomadaire)
 *   - Garde 1 par mois sur 6 mois         (rotation mensuelle)
 *   - Tout le reste est supprimé
 *
 * À lancer après backup-db.js (ou avant le suivant) :
 *   node scripts/backup-cleanup.js
 *   node scripts/backup-cleanup.js --dry   # liste seulement
 *
 * Cron Linux (quotidien 3h30) — chaîné après le backup :
 *   0 3 * * * cd /var/www/cycling && node scripts/backup-db.js && node scripts/backup-cleanup.js
 */

'use strict';
require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const DRY = process.argv.includes('--dry');

if (!fs.existsSync(DIR)) {
  console.error(`[cleanup] BACKUP_DIR introuvable : ${DIR}`);
  process.exit(1);
}

const DAY = 86_400_000;
const now = Date.now();
const DAILY_DAYS = 7;
const WEEKLY_COUNT = 4;
const MONTHLY_COUNT = 6;

// Liste tous les fichiers backup, triés du + récent au + ancien
const files = fs.readdirSync(DIR)
  .filter(n => /\.sql(\.gz)?$/i.test(n))
  .map(n => {
    const full = path.join(DIR, n);
    return { name: n, full, mtime: fs.statSync(full).mtimeMs };
  })
  .sort((a, b) => b.mtime - a.mtime);

if (files.length === 0) {
  console.log('[cleanup] aucun backup à analyser');
  process.exit(0);
}

const keep = new Set();
const weeklyBuckets = new Map();  // key: weekIndex (depuis epoch) → fichier le + récent
const monthlyBuckets = new Map(); // key: 'YYYY-MM' → fichier le + récent

for (const f of files) {
  const ageDays = (now - f.mtime) / DAY;

  // 1) Quotidien — tout sur 7 derniers jours
  if (ageDays <= DAILY_DAYS) {
    keep.add(f.full);
    continue;
  }

  // 2) Hebdomadaire — semaine ISO depuis epoch
  const weekIdx = Math.floor(f.mtime / (DAY * 7));
  if (!weeklyBuckets.has(weekIdx) && weeklyBuckets.size < WEEKLY_COUNT && ageDays <= DAILY_DAYS + WEEKLY_COUNT * 7) {
    weeklyBuckets.set(weekIdx, f);
    keep.add(f.full);
    continue;
  }

  // 3) Mensuel — clé YYYY-MM
  const d = new Date(f.mtime);
  const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
  if (!monthlyBuckets.has(monthKey) && monthlyBuckets.size < MONTHLY_COUNT) {
    monthlyBuckets.set(monthKey, f);
    keep.add(f.full);
    continue;
  }
}

const toDelete = files.filter(f => !keep.has(f.full));
const totalSize = toDelete.reduce((s, f) => s + fs.statSync(f.full).size, 0);

console.log(`[cleanup] ${files.length} backups total — gardés : ${keep.size}, à supprimer : ${toDelete.length} (${(totalSize/1024/1024).toFixed(1)} Mo)`);
console.log(`[cleanup] répartition : ${[...keep].filter(p => (now - fs.statSync(p).mtimeMs)/DAY <= DAILY_DAYS).length} quot. + ${weeklyBuckets.size} hebdo + ${monthlyBuckets.size} mensuel(s)`);

if (toDelete.length === 0) process.exit(0);

if (DRY) {
  console.log('[cleanup] DRY-RUN — fichiers qui seraient supprimés :');
  for (const f of toDelete) console.log('  ', f.name);
  process.exit(0);
}

for (const f of toDelete) {
  fs.unlinkSync(f.full);
}
console.log(`[cleanup] ✓ ${toDelete.length} fichier(s) supprimé(s)`);
