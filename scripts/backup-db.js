/**
 * scripts/backup-db.js
 *
 * Backup de la base MySQL via `mysqldump`. Produit un fichier compressé
 * dans backups/ (créé si absent), nommé YYYYMMDD-HHMMSS.sql.gz.
 *
 * Rétention configurable via .env :
 *   BACKUP_RETENTION_DAYS=14   # défaut 14 jours
 *   BACKUP_DIR=./backups       # défaut ./backups
 *
 * Prérequis :
 *   - mysqldump dans le PATH (livré avec MySQL/MariaDB/Laragon)
 *   - gzip dans le PATH (présent par défaut sur Linux/macOS ; pour Windows
 *     hors Git Bash, le script écrit en .sql non compressé)
 *
 * Usage :
 *   node scripts/backup-db.js              # backup + rotation
 *   node scripts/backup-db.js --no-rotate  # backup seul, garde tout
 *
 * Cron Linux (quotidien à 3h) :
 *   0 3 * * * cd /var/www/cycling && /usr/bin/node scripts/backup-db.js >> /var/log/cycling-backup.log 2>&1
 *
 * Planificateur Windows (Laragon) :
 *   schtasks /Create /TN "CCS Backup" /SC DAILY /ST 03:00 /TR \
 *     "node C:\laragon\www\Cycling\scripts\backup-db.js"
 */

'use strict';
require('dotenv').config();

const fs        = require('fs');
const path      = require('path');
const { spawn } = require('child_process');

const DIR      = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const KEEP     = Math.max(parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10), 1);
const NO_ROT   = process.argv.includes('--no-rotate');

const HOST = process.env.DB_HOST     || 'localhost';
const PORT = process.env.DB_PORT     || '3306';
const USER = process.env.DB_USER     || 'root';
const PASS = process.env.DB_PASSWORD || '';
const DB   = process.env.DB_NAME     || 'ccs_salouel';

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

// Nom de fichier : 20260515-143022.sql(.gz)
function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// Cherche un binaire dans le PATH ou retombe sur des chemins connus
// (Laragon sous Windows livre mysqldump dans C:\laragon\bin\mysql\<version>\bin\).
function which(cmd) {
  return new Promise((resolve) => {
    const probe = spawn(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
    probe.on('close', (code) => resolve(code === 0 ? cmd : null));
    probe.on('error', () => resolve(null));
  });
}

function findMysqldump() {
  return new Promise(async (resolve) => {
    // 1) Surcharge explicite via .env
    if (process.env.MYSQLDUMP_PATH && fs.existsSync(process.env.MYSQLDUMP_PATH)) {
      return resolve(process.env.MYSQLDUMP_PATH);
    }
    // 2) PATH système
    const inPath = await which('mysqldump');
    if (inPath) return resolve('mysqldump');
    // 3) Laragon (Windows) — pick la dernière version installée
    if (process.platform === 'win32') {
      const root = 'C:\\laragon\\bin\\mysql';
      if (fs.existsSync(root)) {
        const versions = fs.readdirSync(root)
          .map(d => path.join(root, d, 'bin', 'mysqldump.exe'))
          .filter(p => fs.existsSync(p))
          .sort()
          .reverse();
        if (versions[0]) return resolve(versions[0]);
      }
    }
    resolve(null);
  });
}

async function run() {
  const mysqldumpBin = await findMysqldump();
  if (!mysqldumpBin) {
    console.error('[backup] mysqldump introuvable (PATH ni Laragon ni MYSQLDUMP_PATH) — abort.');
    process.exit(2);
  }
  console.log(`[backup] mysqldump : ${mysqldumpBin}`);
  const hasGzip = !!(await which('gzip'));

  const ts = stamp();
  const baseName = `${DB}-${ts}.sql`;
  const sqlPath = path.join(DIR, baseName);
  const finalPath = hasGzip ? `${sqlPath}.gz` : sqlPath;

  const dumpArgs = [
    '-h', HOST, '-P', String(PORT), '-u', USER,
    ...(PASS ? [`-p${PASS}`] : []),
    '--single-transaction',           // cohérence sans verrouillage long
    '--quick',                        // ligne par ligne (pas tout en RAM)
    '--routines', '--triggers',
    '--set-gtid-purged=OFF',          // évite l'erreur si non-GTID
    '--default-character-set=utf8mb4',
    DB,
  ];

  console.log(`[backup] ${DB} → ${finalPath}`);

  const dump = spawn(mysqldumpBin, dumpArgs);
  let stderr = '';
  dump.stderr.on('data', (d) => { stderr += d.toString(); });

  if (hasGzip) {
    const gz = spawn('gzip', ['-c']);
    const out = fs.createWriteStream(finalPath);
    dump.stdout.pipe(gz.stdin);
    gz.stdout.pipe(out);
    await new Promise((resolve, reject) => {
      let dumpDone = false, gzDone = false, outDone = false;
      const maybeDone = () => { if (dumpDone && gzDone && outDone) resolve(); };
      dump.on('close', (c) => { if (c !== 0) return reject(new Error(`mysqldump exited ${c}: ${stderr}`)); dumpDone = true; maybeDone(); });
      gz.on('close', (c) => { if (c !== 0) return reject(new Error(`gzip exited ${c}`)); gzDone = true; maybeDone(); });
      out.on('finish', () => { outDone = true; maybeDone(); });
      out.on('error', reject);
    });
  } else {
    const out = fs.createWriteStream(finalPath);
    dump.stdout.pipe(out);
    await new Promise((resolve, reject) => {
      dump.on('close', (c) => { if (c !== 0) return reject(new Error(`mysqldump exited ${c}: ${stderr}`)); resolve(); });
      out.on('error', reject);
    });
  }

  const bytes = fs.statSync(finalPath).size;
  console.log(`[backup] OK — ${(bytes / 1024).toFixed(1)} Ko`);

  // Rotation : supprime les backups > KEEP jours
  if (!NO_ROT) {
    const cutoff = Date.now() - KEEP * 86_400_000;
    let removed = 0;
    for (const f of fs.readdirSync(DIR)) {
      if (!/\.sql(\.gz)?$/.test(f)) continue;
      const p = path.join(DIR, f);
      const st = fs.statSync(p);
      if (st.mtimeMs < cutoff) {
        fs.unlinkSync(p);
        removed++;
      }
    }
    if (removed > 0) console.log(`[backup] rotation — ${removed} ancien(s) backup(s) supprimé(s) (> ${KEEP} j)`);
  }
}

run().catch((err) => {
  console.error('[backup] échec :', err.message);
  process.exit(1);
});
