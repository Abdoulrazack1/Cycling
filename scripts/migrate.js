#!/usr/bin/env node
// Migration runner versionné — sans dépendance externe.
//
// Lit ./migrations/*.sql, applique celles non encore enregistrées dans la table
// `schema_migrations` (créée à la volée), en ordre lexicographique stable.
//
// Usage :
//   node scripts/migrate.js              # applique les pending
//   node scripts/migrate.js --status     # affiche l'état (sans toucher)
//   node scripts/migrate.js --dry-run    # affiche ce qui serait appliqué
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');

const MIG_DIR = path.join(__dirname, '..', 'migrations');
const FILE_RE = /^\d{3,}.*\.sql$/i;

async function _ensureTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    VARCHAR(200) PRIMARY KEY,
      applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      checksum    VARCHAR(64),
      duration_ms INT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function _checksum(sql) {
  return require('crypto').createHash('sha256').update(sql).digest('hex').slice(0, 16);
}

/**
 * Split un fichier SQL en statements, en respectant les `DELIMITER $$` etc.
 * (le driver mysql2 ne comprend pas DELIMITER — c'est une directive du
 * client mysql interactif).
 *
 * Stratégie : on lit ligne par ligne, on extrait DELIMITER xx pour
 * connaître le séparateur courant, et on split sur ce séparateur.
 * Tout est gardé dans son ordre original.
 *
 * Limitations connues : ne gère pas les délimiteurs à l'intérieur de
 * commentaires multi-lignes /* * /, mais c'est suffisant pour nos
 * migrations qui restent simples.
 */
function _splitWithDelimiters(sql) {
  const lines = sql.split(/\r?\n/);
  const out = [];
  let cur = '';
  let delim = ';';
  for (const line of lines) {
    const m = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (m) {
      if (cur.trim()) { out.push(cur); cur = ''; }
      delim = m[1];
      continue;
    }
    cur += line + '\n';
    // Si la ligne se termine par le délimiteur courant, on push le statement
    const trimmed = line.trim();
    if (trimmed.endsWith(delim)) {
      // Retire le délimiteur final
      const stmt = cur.trimEnd().slice(0, -delim.length);
      if (stmt.trim()) out.push(stmt);
      cur = '';
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

(async () => {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const statusOnly = argv.includes('--status');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, multipleStatements: true,
  });

  await _ensureTable(conn);

  const [appliedRows] = await conn.query('SELECT filename, checksum, applied_at FROM schema_migrations ORDER BY filename');
  const applied = new Map(appliedRows.map(r => [r.filename, r]));

  const files = fs.readdirSync(MIG_DIR).filter(f => FILE_RE.test(f)).sort();

  // Statut
  if (statusOnly) {
    console.log('# Migrations status\n');
    for (const f of files) {
      const a = applied.get(f);
      console.log(a ? `  ✅ ${f}  (appliquée ${a.applied_at.toISOString().slice(0, 16).replace('T', ' ')})` : `  ⏳ ${f}  (PENDING)`);
    }
    const orphans = [...applied.keys()].filter(f => !files.includes(f));
    if (orphans.length) {
      console.log('\n⚠️ Migrations enregistrées mais fichier absent :');
      for (const f of orphans) console.log(`  ❓ ${f}`);
    }
    await conn.end();
    return;
  }

  const pending = files.filter(f => !applied.has(f));
  if (pending.length === 0) {
    console.log('✅ Aucune migration en attente. Toutes appliquées.');
    await conn.end();
    return;
  }

  console.log(`📦 ${pending.length} migration(s) en attente :`);
  for (const f of pending) console.log(`  - ${f}`);

  if (dryRun) {
    console.log('\n🔍 Dry-run — rien appliqué.');
    await conn.end();
    return;
  }

  for (const f of pending) {
    const fullPath = path.join(MIG_DIR, f);
    const rawSql = fs.readFileSync(fullPath, 'utf8');
    const sum = _checksum(rawSql);
    const t0 = Date.now();
    console.log(`\n▶ ${f}…`);
    try {
      await conn.query('START TRANSACTION');
      // Le client mysql comprend `DELIMITER $$` mais pas le driver mysql2.
      // On split nous-mêmes : si DELIMITER est utilisé, on transforme chaque
      // bloc et exécute statement-par-statement.
      const statements = _splitWithDelimiters(rawSql);
      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (!trimmed) continue;
        await conn.query(trimmed);
      }
      await conn.query(
        'INSERT INTO schema_migrations (filename, checksum, duration_ms) VALUES (?, ?, ?)',
        [f, sum, Date.now() - t0]
      );
      await conn.query('COMMIT');
      console.log(`  ✅ appliquée (${Date.now() - t0} ms)`);
    } catch (err) {
      await conn.query('ROLLBACK').catch(() => {});
      console.error(`  ❌ ÉCHEC : ${err.message}`);
      console.error('  Migrations stoppées. Corrigez et relancez.');
      process.exit(1);
    }
  }
  console.log('\n🎉 Toutes les migrations en attente sont appliquées.');
  await conn.end();
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
