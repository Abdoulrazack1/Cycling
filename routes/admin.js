/* ═════════════════════════════════════════════════════════════════
   routes/admin.js — Endpoints d'administration (admin role only)
   ─────────────────────────────────────────────────────────────────
   Endpoints exposés :
     GET    /admin/scraper-health       diag : santé des scrapers
     GET    /admin/audit-log            consultation du journal d'audit
     POST   /admin/audit-log/purge      purge des entrées anciennes
     GET    /admin/strava-config        état config Strava + creds (sans secret)
     POST   /admin/strava-config        set creds Strava (hot-reload env)
     DELETE /admin/strava-config        désactive l'intégration Strava
     GET    /admin/dashboard-live       agrégats live (membres / sorties / events…)
     POST   /admin/broadcast            envoi mail groupé
     GET    /admin/maintenance          état du mode maintenance
     POST   /admin/maintenance          activation/désactivation maintenance
     PATCH  /admin/users/bulk           actions de masse (deactivate / set_role)
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { scrapeAll } = require('../services/course-scraper');
const { query } = require('../config/database');
const { errResponse } = require('../lib/errors');
const { body, validationResult } = require('express-validator');
const { audit } = require('../services/audit-log');
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
    errResponse(req, res, err, 500, 'Erreur scraper-health');
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
    errResponse(req, res, err, 500, 'Erreur serveur');
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
    errResponse(req, res, err, 500, 'Erreur serveur');
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/admin/strava-config — état de la config Strava
// POST /api/admin/strava-config — set/update les credentials
// DELETE /api/admin/strava-config — désactive Strava (efface les creds)
//
// Les credentials sont persistés dans club_settings (table existante).
// Modifier ne nécessite PAS de restart : process.env est mis à jour
// en mémoire à chaque POST.
// ═══════════════════════════════════════════════════════════════════
router.get('/strava-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await query(
      "SELECT cle, valeur FROM club_settings WHERE cle IN ('strava_client_id','strava_client_secret','strava_redirect_uri')"
    );
    const map = {};
    for (const r of rows) map[r.cle] = r.valeur;
    // Ne JAMAIS retourner le secret en clair côté UI — seulement l'état
    res.json({
      configured:   !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET),
      client_id:    map.strava_client_id    || process.env.STRAVA_CLIENT_ID    || '',
      redirect_uri: map.strava_redirect_uri || process.env.STRAVA_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/api/strava/callback`,
      has_secret:   !!(map.strava_client_secret || process.env.STRAVA_CLIENT_SECRET),
      source:       process.env.STRAVA_CLIENT_ID ? (map.strava_client_id ? 'db' : 'env') : null,
    });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur lecture config Strava'); }
});

router.post('/strava-config', requireAuth, requireAdmin, [
  body('client_id').trim().matches(/^\d+$/).withMessage('Client ID doit être un nombre Strava (visible sur strava.com/settings/api)'),
  body('client_secret').trim().isLength({ min: 20, max: 100 }).withMessage('Client Secret doit faire 20-100 chars (Strava en fournit ~40)'),
  body('redirect_uri').optional({ checkFalsy: true }).isURL({ require_tld: false, protocols: ['http','https'] }),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
  try {
    const { client_id, client_secret } = req.body;
    const redirect_uri = req.body.redirect_uri?.trim() || `http://localhost:${process.env.PORT || 3000}/api/strava/callback`;

    await query(
      `INSERT INTO club_settings (cle, valeur) VALUES
         ('strava_client_id', ?), ('strava_client_secret', ?), ('strava_redirect_uri', ?)
       ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
      [client_id, client_secret, redirect_uri]
    );

    // Active immédiatement (pas besoin de restart)
    process.env.STRAVA_CLIENT_ID     = client_id;
    process.env.STRAVA_CLIENT_SECRET = client_secret;
    process.env.STRAVA_REDIRECT_URI  = redirect_uri;

    audit(req, 'update', 'strava_config', null, { client_id, source: 'admin-ui' });
    res.json({ ok: true, configured: true, redirect_uri });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur sauvegarde config Strava'); }
});

router.delete('/strava-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query(
      "DELETE FROM club_settings WHERE cle IN ('strava_client_id','strava_client_secret','strava_redirect_uri')"
    );
    delete process.env.STRAVA_CLIENT_ID;
    delete process.env.STRAVA_CLIENT_SECRET;
    delete process.env.STRAVA_REDIRECT_URI;
    audit(req, 'delete', 'strava_config', null, { source: 'admin-ui' });
    res.json({ ok: true, configured: false });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur désactivation Strava'); }
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/admin/dashboard-live — widgets stats agrégés
// Tout en un appel pour minimiser le round-trip réseau.
// ═══════════════════════════════════════════════════════════════════
router.get('/dashboard-live', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [
      [usersAgg], [sortiesAgg], [eventsAgg], [contactsAgg],
      [recentSignups], [auditAgg], [stravaAgg]
    ] = await Promise.all([
      query(`SELECT
        COUNT(*) AS total,
        SUM(actif = TRUE) AS actifs,
        SUM(role = 'admin' AND actif = TRUE) AS admins,
        SUM(DATEDIFF(NOW(), created_at) <= 30) AS new_30d
       FROM users`),
      query(`SELECT
        COUNT(*) AS total,
        SUM(date >= CURDATE()) AS upcoming,
        SUM(date >= CURDATE() - INTERVAL 7 DAY AND date < CURDATE()) AS last_7d_past,
        SUM(gpx_filename IS NOT NULL) AS with_gpx
       FROM sorties`),
      query(`SELECT
        COUNT(*) AS total,
        SUM(date >= CURDATE()) AS upcoming,
        SUM(statut = 'ouvert') AS ouverts,
        SUM(inscrits) AS total_inscrits
       FROM evenements`),
      query(`SELECT
        COUNT(*) AS total,
        SUM(statut = 'nouveau') AS nouveaux,
        SUM(DATEDIFF(NOW(), created_at) <= 7) AS last_7d
       FROM contacts`),
      query(`SELECT COUNT(*) AS cnt FROM users WHERE DATEDIFF(NOW(), created_at) <= 7 AND actif = TRUE`),
      query(`SELECT COUNT(*) AS errors_today FROM audit_log WHERE DATE(created_at) = CURDATE() AND action IN ('delete','role_change','password_reset')`)
        .catch(err => { logger.warn({ err: err.message }, '[dashboard-live] audit_log query failed'); return [{ errors_today: 0 }]; }),
      query(`SELECT COUNT(*) AS linked FROM user_strava_link`)
        .catch(err => { logger.warn({ err: err.message }, '[dashboard-live] strava_link query failed (table absente ?)'); return [{ linked: 0 }]; }),
    ]);

    res.json({
      users:   usersAgg,
      sorties: sortiesAgg,
      events:  eventsAgg,
      contacts: contactsAgg,
      recent_signups_7d: recentSignups?.cnt || 0,
      audit_sensitive_today: auditAgg?.errors_today || 0,
      strava_linked: stravaAgg?.linked || 0,
      generated_at: new Date().toISOString(),
    });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur dashboard live'); }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/admin/broadcast — envoi mail à tous les membres actifs
// Body : { subject, message, target? }
//   target : 'all' (default) | 'admins' | 'membres'
// ═══════════════════════════════════════════════════════════════════
const mailer = require('../services/mailer');
router.post('/broadcast', requireAuth, requireAdmin, [
  body('subject').trim().isLength({ min: 3, max: 200 }),
  body('message').trim().isLength({ min: 10, max: 10000 }),
  body('target').optional().isIn(['all', 'admins', 'membres']),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
  if (!mailer.isConfigured()) {
    return res.status(503).json({ error: 'SMTP non configuré (variables SMTP_* manquantes dans .env)' });
  }
  try {
    const { subject, message, target = 'all' } = req.body;
    let where = 'actif = TRUE AND email IS NOT NULL';
    if (target === 'admins')   where += " AND role IN ('admin','moderateur')";
    if (target === 'membres')  where += " AND role = 'membre'";

    const recipients = await query(`SELECT id, prenom, email FROM users WHERE ${where}`);
    if (!recipients.length) return res.status(404).json({ error: 'Aucun destinataire trouvé' });

    // Envoi en série pour ne pas saturer le SMTP (1 par 200ms ~= 5/s)
    let sent = 0, failed = 0;
    const errors = [];
    for (const r of recipients) {
      const html = `<p>Bonjour <strong>${r.prenom || ''}</strong>,</p>${message.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}<p style="margin-top:24px;">Le bureau du Club</p>`;
      const result = await mailer.sendMail({ to: r.email, subject, html });
      if (result.ok) sent++; else { failed++; if (errors.length < 5) errors.push({ to: r.email, error: result.error }); }
      await new Promise(rs => setTimeout(rs, 200));
    }
    audit(req, 'create', 'broadcast', null, { subject, target, sent, failed });
    res.json({ ok: true, total: recipients.length, sent, failed, errors });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur broadcast'); }
});

// ═══════════════════════════════════════════════════════════════════
// Maintenance mode — toggle global (stocké en club_settings)
// Quand activé, GET /api/maintenance retourne 503 et un middleware
// peut bloquer les requêtes pour les non-admins. À brancher dans server.js.
// ═══════════════════════════════════════════════════════════════════
router.get('/maintenance', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [row] = await query(`SELECT valeur FROM club_settings WHERE cle = 'maintenance_mode'`);
    const [msg] = await query(`SELECT valeur FROM club_settings WHERE cle = 'maintenance_message'`);
    res.json({
      enabled: row?.valeur === '1',
      message: msg?.valeur || '',
    });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur lecture maintenance'); }
});

router.post('/maintenance', requireAuth, requireAdmin, [
  body('enabled').isBoolean(),
  body('message').optional({ checkFalsy: true }).isLength({ max: 500 }),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
  try {
    const enabled = req.body.enabled ? '1' : '0';
    const msg     = req.body.message?.trim() || 'Site en maintenance. Reviens dans quelques minutes.';
    await query(
      `INSERT INTO club_settings (cle, valeur) VALUES ('maintenance_mode', ?), ('maintenance_message', ?)
       ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
      [enabled, msg]
    );
    process.env.MAINTENANCE_MODE = enabled;
    process.env.MAINTENANCE_MESSAGE = msg;
    audit(req, 'update', 'maintenance', null, { enabled: enabled === '1', message: msg });
    res.json({ ok: true, enabled: enabled === '1', message: msg });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur sauvegarde maintenance'); }
});

// ═══════════════════════════════════════════════════════════════════
// PATCH /api/admin/users/bulk — bulk action sur plusieurs users
// Body : { user_ids: number[], action: 'deactivate'|'activate'|'set_role', role? }
// ═══════════════════════════════════════════════════════════════════
router.patch('/users/bulk', requireAuth, requireAdmin, [
  body('user_ids').isArray({ min: 1, max: 200 }),
  body('user_ids.*').isInt({ min: 1 }),
  body('action').isIn(['deactivate', 'activate', 'set_role']),
  body('role').optional().isIn(['admin', 'moderateur', 'membre']),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
  try {
    const { user_ids, action, role } = req.body;
    // Sécurité : interdit de se modifier soi-même en bulk (évite de se locker out)
    if (user_ids.includes(req.user.id)) {
      return res.status(400).json({ error: 'Impossible de s\'appliquer une bulk-action à soi-même' });
    }
    // Si désactivation ou changement de rôle, on vérifie qu'il restera ≥ 1 admin actif
    if (action === 'deactivate' || action === 'set_role') {
      const [{ cnt }] = await query(
        `SELECT COUNT(*) AS cnt FROM users WHERE actif = TRUE AND role = 'admin' AND id NOT IN (?)`,
        [user_ids]
      );
      if (cnt < 1) {
        return res.status(409).json({ error: 'Cette action laisserait 0 admin actif. Au moins 1 admin doit rester.' });
      }
    }
    let sql, params;
    if (action === 'deactivate') { sql = `UPDATE users SET actif = FALSE WHERE id IN (?)`; params = [user_ids]; }
    if (action === 'activate')   { sql = `UPDATE users SET actif = TRUE WHERE id IN (?)`;  params = [user_ids]; }
    if (action === 'set_role')   {
      if (!role) return res.status(400).json({ error: '`role` requis pour set_role' });
      sql = `UPDATE users SET role = ? WHERE id IN (?)`; params = [role, user_ids];
    }
    const r = await query(sql, params);
    audit(req, 'update', 'user_bulk', null, { action, role: role || null, user_ids, affected: r.affectedRows });
    res.json({ ok: true, action, affected: r.affectedRows });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur bulk users'); }
});

module.exports = router;
