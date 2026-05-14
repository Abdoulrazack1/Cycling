// config/database.js — Pool de connexions MySQL avec reconnexion auto
const mysql = require('mysql2/promise');
const logger = require('../lib/logger');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306'),
  user:               process.env.DB_USER     || 'ccs_user',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'ccs_salouel',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
  timezone:           '+00:00',
  // IMPORTANT : retourner les colonnes DATE/DATETIME comme STRINGS
  // (sinon JSON.stringify produit "2025-04-05T22:00:00.000Z" au lieu de
  //  "2025-04-05" — ce qui casse Open-Meteo et toute comparaison de date côté frontend).
  dateStrings:        ['DATE', 'DATETIME'],
  // IMPORTANT : convertir les DECIMAL en Number plutôt qu'en string.
  // Sans ça, distance_km, lat, lng, km de POI etc. arrivent comme strings
  // côté JS, et tout `.toFixed()` ou calcul plante avec un cryptique
  // "toFixed is not a function".
  decimalNumbers:     true,
  // Reconnexion automatique
  enableKeepAlive:    true,
  keepAliveInitialDelay: 0,
});

// Vérification au démarrage — ne coupe pas le serveur si la DB est down
// (le health-check et les routes renverront 500 le moment venu)
pool.getConnection()
  .then(conn => {
    logger.info('✅ MySQL connecté :', process.env.DB_NAME);
    conn.release();
  })
  .catch(err => {
    logger.error({ err: err }, '❌ MySQL connexion échouée :');
    logger.error('   Vérifiez DB_HOST / DB_USER / DB_PASSWORD dans .env');
    logger.error('   Le serveur continue de tourner — la base sera réessayée à chaque requête.');
  });

// Helper : exécuter une requête avec gestion d'erreur
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (err) {
    logger.error('DB Error:', err.message, '| SQL:', sql.slice(0, 100));
    throw err;
  }
}

/**
 * Construit une clause "LIMIT n OFFSET m" sûre, à interpoler directement.
 *
 * Pourquoi ne pas passer en placeholder ? mysql2 utilise des prepared
 * statements via pool.execute(), et MySQL n'accepte PAS les paramètres
 * entiers en placeholder pour LIMIT/OFFSET (les valeurs arrivent comme
 * des strings binaires et le parseur SQL refuse). On les interpole
 * nous-mêmes après un parseInt strict — pas de risque d'injection
 * puisque ce sont des entiers garantis.
 *
 * @param {*} limit  valeur brute (souvent req.query.limit)
 * @param {*} offset valeur brute
 * @param {object} opts { defaultLimit?: number, maxLimit?: number }
 * @returns {string} ex: ' LIMIT 50 OFFSET 0'
 */
function pageClause(limit, offset, opts = {}) {
  const defLimit = opts.defaultLimit ?? 50;
  const maxLimit = opts.maxLimit     ?? 200;
  let n = parseInt(limit, 10);
  if (!Number.isFinite(n) || n <= 0) n = defLimit;
  if (n > maxLimit) n = maxLimit;
  let o = parseInt(offset, 10);
  if (!Number.isFinite(o) || o < 0) o = 0;
  return ` LIMIT ${n} OFFSET ${o}`;
}

// Helper : transaction
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await fn(conn);
    await conn.commit();
    conn.release();
    return result;
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

module.exports = { pool, query, withTransaction, pageClause };
