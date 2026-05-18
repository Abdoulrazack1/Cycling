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
    const sql = fs.readFileSync(fullPath, 'utf8');
    const sum = _checksum(sql);
    const t0 = Date.now();
    console.log(`\n▶ ${f}…`);
    try {
      await conn.query('START TRANSACTION');
      await conn.query(sql);
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
