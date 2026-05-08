// services/audit-log.js — Helper pour tracer les actions admin
//
// Cf. AUDIT item #30. Usage typique :
//
//   const { audit } = require('../services/audit-log');
//   ...
//   await query('UPDATE sorties SET ... WHERE id=?', [id]);
//   audit(req, 'update', 'sortie', id, { changes: req.body });
//
// `audit` est volontairement non-bloquant (fire-and-forget) : si
// la table audit_log n'existe pas encore (migration pas appliquée),
// l'erreur est loggée mais ne fait pas échouer la requête métier.
const { query } = require('../config/database');

/**
 * Enregistre une action dans audit_log.
 * @param {object}  req       request Express (pour user, ip, ua)
 * @param {string}  action    'create' | 'update' | 'delete' | 'login' | …
 * @param {string}  entity    'sortie' | 'membre' | …
 * @param {*}       entityId  id de l'entité (string ou number, sera coercé)
 * @param {object?} payload   JSON arbitraire (sera tronqué à 64 ko)
 */
function audit(req, action, entity, entityId, payload = null) {
  // Tronque le payload pour éviter qu'un upload géant remplisse la table
  let payloadJson = null;
  if (payload != null) {
    try {
      let s = JSON.stringify(payload);
      if (s.length > 64 * 1024) s = s.slice(0, 64 * 1024 - 20) + '"_TRUNCATED_"}';
      payloadJson = s;
    } catch { payloadJson = null; }
  }

  const userId   = req.user?.id ?? null;
  const username = req.user?.username ?? null;
  const ip       = req.ip ?? null;
  const ua       = (req.get('user-agent') || '').slice(0, 255);

  // Fire-and-forget : ne JAMAIS attendre l'audit. Si la table manque
  // (migration non lancée), on log mais on ne plante pas la route.
  query(
    `INSERT INTO audit_log (user_id, username, action, entity, entity_id, payload, ip_address, user_agent)
     VALUES (?,?,?,?,?,?,?,?)`,
    [userId, username, action, entity, String(entityId ?? ''), payloadJson, ip, ua]
  ).catch(err => {
    // ER_NO_SUCH_TABLE = 1146 → migration 003 pas encore appliquée
    if (err.errno !== 1146) {
      console.error('[audit_log]', err.code || '', err.sqlMessage || err.message);
    }
  });
}

module.exports = { audit };
