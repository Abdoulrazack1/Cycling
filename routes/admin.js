// routes/admin.js — endpoints de diagnostic + audit admin
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { scrapeAll } = require('../services/course-scraper');
const { query } = require('../config/database');
const logger = require('../lib/logger');
const router = express.Router();

// GET /api/admin/scraper-health
// Lance un scrape complet et retourne le bilan : nombre d'events extraits
// par source, erreurs, et fallback regex déclenchés (= signal que la
// structure HTML cible a probablement bougé).
router.get('/scraper-health', requireAuth, requireAdmin, async (req, res) => {
  const startedAt = Date.now();
  try {
    const { events, errors, log, fallbacks } = await scrapeAll();
    const durationMs = Date.now() - startedAt;
    const status =
      errors.length === 0 && Object.keys(fallbacks).length === 0 ? 'healthy'
      : Object.keys(fallbacks).length > 0 ? 'degraded'
      : 'unhealthy';

    req.log.info({
      eventsCount: events.length,
      errorsCount: errors.length,
      fallbacksCount: Object.keys(fallbacks).length,
      durationMs,
      status,
    }, 'scraper-health check');

    res.json({
      status,
      durationMs,
      eventsCount: events.length,
      errorsCount: errors.length,
      fallbacks,
      errors,
      log,
    });
  } catch (err) {
    req.log.error({ err }, 'scraper-health failed');
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// GET /api/admin/metrics
// Stats process pour monitoring externe (admin-only car expose la conso
// mémoire, la version Node, l'env — infos qu'on évite de fuiter au public).
router.get('/metrics', requireAuth, requireAdmin, (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    uptime_s: Math.round(process.uptime()),
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heapTotal_mb: Math.round(mem.heapTotal / 1024 / 1024),
      heapUsed_mb: Math.round(mem.heapUsed / 1024 / 1024),
      external_mb: Math.round(mem.external / 1024 / 1024),
    },
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid,
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// GET /api/admin/audit
// Liste les N dernières actions auditées (table audit_log).
// Query params : ?limit=50 (max 200), ?user=12, ?action=update, ?entity=sortie
router.get('/audit', requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const where = [], params = [];
    if (req.query.user)   { where.push('user_id = ?'); params.push(parseInt(req.query.user, 10)); }
    if (req.query.action) { where.push('action = ?');  params.push(String(req.query.action)); }
    if (req.query.entity) { where.push('entity = ?');  params.push(String(req.query.entity)); }
    const sql = `SELECT id, user_id, username, action, entity, entity_id, payload, ip_address, created_at
                 FROM audit_log
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY id DESC
                 LIMIT ${limit}`;
    const rows = await query(sql, params);
    res.json({ count: rows.length, rows });
  } catch (err) {
    if (err.errno === 1146) {
      return res.status(503).json({ error: 'Table audit_log absente — appliquer migrations/003_audit_log.sql' });
    }
    req.log.error({ err }, 'audit listing failed');
    res.status(500).json({ error: err.sqlMessage || err.message });
  }
});

// POST /api/admin/audit/purge
// Politique de rétention : supprime les entrées plus vieilles que N jours
// (défaut 365 = 1 an, comme demandé par le brief B5).
// À déclencher manuellement OU via un cron mensuel.
router.post('/audit/purge', requireAuth, requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.body?.days, 10) || 365;
    if (days < 30) return res.status(400).json({ error: 'Rétention minimale : 30 jours' });
    const result = await query(
      'DELETE FROM audit_log WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [days]
    );
    req.log.info({ purged: result.affectedRows, days, userId: req.user.id }, 'audit log purged');
    res.json({ message: `${result.affectedRows} entrées purgées (> ${days} jours)` });
  } catch (err) {
    req.log.error({ err }, 'audit purge failed');
    res.status(500).json({ error: err.sqlMessage || err.message });
  }
});

module.exports = router;
