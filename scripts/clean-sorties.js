/**
 * scripts/clean-sorties.js
 *
 * Vide complètement les sorties + POIs + GPX pour repartir de zéro.
 *
 * ⚠️  DESTRUCTIF — supprime TOUTES les sorties (y compris les seeded
 *     du club) et TOUS les fichiers GPX. Aucun retour arrière.
 *
 * Usage :
 *   node scripts/clean-sorties.js                    # demande confirmation
 *   node scripts/clean-sorties.js --yes              # sans confirmation
 *   node scripts/clean-sorties.js --keep-gpx         # vide la BDD seulement
 *   node scripts/clean-sorties.js --keep-db          # supprime les GPX seulement
 */

'use strict';
require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const readline = require('readline');

const args      = process.argv.slice(2);
const YES       = args.includes('--yes');
const KEEP_GPX  = args.includes('--keep-gpx');
const KEEP_DB   = args.includes('--keep-db');

const GPX_DIR = path.join(__dirname, '..', 'public', 'asset', 'gpx');

async function ask(question) {
  if (YES) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question + ' (oui/non) ', answer => {
      rl.close();
      resolve(/^(oui|o|yes|y)$/i.test(answer.trim()));
    });
  });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  C.C. Salouel — Nettoyage des sorties & GPX');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── 1) Compter ce qui sera supprimé ─────────────────────────
  let nGpx = 0;
  let dbCounts = null;

  if (!KEEP_GPX && fs.existsSync(GPX_DIR)) {
    nGpx = fs.readdirSync(GPX_DIR).filter(f => f.endsWith('.gpx')).length;
  }

  if (!KEEP_DB) {
    try {
      const db = require('../src/config/database');
      const [s] = await db.query('SELECT COUNT(*) AS n FROM sorties');
      const [p] = await db.query('SELECT COUNT(*) AS n FROM pois');
      const [t] = await db.query('SELECT COUNT(*) AS n FROM sortie_tags').catch(() => [{n:0}]);
      const [se] = await db.query('SELECT COUNT(*) AS n FROM sortie_segments').catch(() => [{n:0}]);
      const [sx] = await db.query('SELECT COUNT(*) AS n FROM sortie_stats_extra').catch(() => [{n:0}]);
      dbCounts = { sorties: s.n, pois: p.n, tags: t.n, segments: se.n, stats: sx.n };
    } catch (e) {
      console.error('  ❌ MySQL inaccessible :', e.message);
      process.exit(1);
    }
  }

  // ── 2) Récap & confirmation ─────────────────────────────────
  console.log('  À supprimer :');
  if (dbCounts) {
    console.log(`    • Sorties (BDD)        : ${dbCounts.sorties}`);
    console.log(`    • POIs (BDD)           : ${dbCounts.pois}`);
    console.log(`    • Tags                 : ${dbCounts.tags}`);
    console.log(`    • Segments             : ${dbCounts.segments}`);
    console.log(`    • Stats extra          : ${dbCounts.stats}`);
  } else if (KEEP_DB) {
    console.log(`    • BDD                  : conservée (--keep-db)`);
  }
  if (!KEEP_GPX) {
    console.log(`    • Fichiers GPX         : ${nGpx} fichier(s) dans asset/gpx/`);
  } else {
    console.log(`    • GPX                  : conservés (--keep-gpx)`);
  }

  if ((dbCounts?.sorties || 0) === 0 && nGpx === 0) {
    console.log('\n  ✅ Rien à supprimer.');
    process.exit(0);
  }

  console.log('');
  const confirmed = await ask('  ⚠️  Confirmer la suppression ?');
  if (!confirmed) {
    console.log('\n  Annulé.');
    process.exit(0);
  }

  // ── 3) Suppression BDD ──────────────────────────────────────
  if (!KEEP_DB) {
    console.log('\n  🗑️  Vidage de la base ...');
    const db = require('../src/config/database');
    // Ordre : enfants → parents (pour respecter les FK)
    const tables = [
      'pois', 'sortie_tags', 'sortie_stats_extra', 'sortie_segments', 'sorties'
    ];
    for (const t of tables) {
      try {
        const [r] = await db.query(`DELETE FROM ${t}`);
        console.log(`    ✅ ${t.padEnd(22)} vidée`);
      } catch (e) {
        console.warn(`    ⚠️  ${t} : ${e.message}`);
      }
    }
    try { await db.pool?.end?.(); } catch {}
  }

  // ── 4) Suppression GPX ──────────────────────────────────────
  if (!KEEP_GPX && fs.existsSync(GPX_DIR)) {
    console.log('\n  🗑️  Suppression des GPX ...');
    const files = fs.readdirSync(GPX_DIR).filter(f => f.endsWith('.gpx'));
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(GPX_DIR, f));
      } catch (e) {
        console.warn(`    ⚠️  ${f} : ${e.message}`);
      }
    }
    console.log(`    ✅ ${files.length} fichier(s) supprimé(s)`);
  }

  console.log('\n  ✅ Nettoyage terminé.\n');
  console.log('  Prochaines étapes :');
  console.log('    npm run scrape:save     # repeupler avec OSM HdF (tracés réels)');
  console.log('    node seed.js            # restaurer les sorties initiales du club\n');
}

main().catch(e => { console.error('\n💥', e.message); process.exit(1); });