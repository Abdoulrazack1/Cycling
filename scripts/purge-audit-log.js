/**
 * scripts/purge-audit-log.js
 *
 * Politique de rétention pour la table audit_log (Brief B5).
 * Supprime les entrées plus vieilles que AUDIT_RETENTION_DAYS jours.
 *
 * Configurable via .env :
 *   AUDIT_RETENTION_DAYS=365   # défaut 1 an
 *
 * Usage :
 *   node scripts/purge-audit-log.js          # supprime
 *   node scripts/purge-audit-log.js --dry    # liste seulement
 *
 * Branché en cron mensuel dans server.js (cf. runAuditPurge).
 */

'use strict';
require('dotenv').config();

const DRY = process.argv.includes('--dry');
const DAYS = Math.max(parseInt(process.env.AUDIT_RETENTION_DAYS || '365', 10), 30);

async function main() {
  const { query } = require('../config/database');

  try {
    if (DRY) {
      const [{ cnt }] = await query(
        'SELECT COUNT(*) AS cnt FROM audit_log WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [DAYS]
      );
      console.log(`[audit purge] [DRY] ${cnt} entrées seraient supprimées (> ${DAYS} jours)`);
      process.exit(0);
    }

    const result = await query(
      'DELETE FROM audit_log WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [DAYS]
    );
    console.log(`[audit purge] ${result.affectedRows} entrées supprimées (> ${DAYS} jours)`);
    process.exit(0);
  } catch (err) {
    if (err.errno === 1146) {
      // Table absente : pas une erreur fatale (migration pas encore appliquée)
      console.warn('[audit purge] table audit_log absente — skip');
      process.exit(0);
    }
    console.error('[audit purge] échec :', err.message);
    process.exit(1);
  }
}

main();
