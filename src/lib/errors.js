/**
 * lib/errors.js — Formatage des réponses d'erreur HTTP
 *
 * En dev : renvoie un message détaillé (utile pour le debug).
 * En prod : message générique + correlation id (pour cross-référencer
 *           le log côté serveur sans exposer la structure de la BDD,
 *           les noms de colonnes, ni des messages SQL bruts).
 *
 * Usage :
 *   const { errResponse } = require('../lib/errors');
 *   ...
 *   } catch (err) {
 *     return errResponse(req, res, err, 500, 'Erreur lors de la création');
 *   }
 */

const crypto = require('crypto');

function shortId() {
  return crypto.randomBytes(6).toString('hex');
}

function isProd() {
  return process.env.NODE_ENV === 'production';
}

// Codes d'erreur signalant une base de données injoignable (MySQL down,
// trop de connexions, host introuvable…). On les traduit en 503 plutôt
// qu'en 500 : c'est transitoire, et ça aide le monitoring à distinguer
// "bug applicatif" de "infra indisponible".
const DB_DOWN_CODES = new Set([
  'ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR',
  'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
]);

/**
 * Renvoie une réponse d'erreur HTTP propre.
 *
 * @param {*} req Express request
 * @param {*} res Express response
 * @param {Error} err Erreur à logger
 * @param {number} status HTTP code (défaut 500)
 * @param {string} userMsg Message générique sûr à montrer à l'utilisateur
 */
function errResponse(req, res, err, status = 500, userMsg = 'Erreur serveur') {
  // Base injoignable → 503 (transitoire) plutôt qu'un 500 trompeur.
  if (err && DB_DOWN_CODES.has(err.code)) {
    status = 503;
    userMsg = 'Service temporairement indisponible (base de données injoignable). Réessayez dans un instant.';
  }
  const correlationId = shortId();
  // Logger TOUJOURS les détails (avec id pour cross-ref)
  if (req?.log) {
    req.log.error({ err, code: err?.code, sqlMessage: err?.sqlMessage, correlationId }, userMsg);
  } else {
    // Fallback si pas de req.log (rare)
    const logger = require('./logger');
    logger.error({ err, correlationId }, userMsg);
  }
  const body = { error: userMsg, correlationId };
  // En dev seulement : ajouter les détails utiles
  if (!isProd()) {
    body.detail = err?.sqlMessage || err?.message || String(err);
    if (err?.code) body.code = err.code;
  }
  return res.status(status).json(body);
}

module.exports = { errResponse, shortId, isProd };
