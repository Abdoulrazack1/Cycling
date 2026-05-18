// routes/strava.js — OAuth + sync activités Strava
const express = require('express');
const crypto = require('crypto');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { errResponse } = require('../lib/errors');
const logger = require('../lib/logger');
const strava = require('../services/strava-client');

const router = express.Router();

// Mémoire éphémère pour les "states" OAuth (anti-CSRF). 10 min TTL.
const _oauthStates = new Map();
function _newState(userId) {
  const s = crypto.randomBytes(16).toString('hex');
  _oauthStates.set(s, { userId, ts: Date.now() });
  // GC
  for (const [k, v] of _oauthStates) {
    if (Date.now() - v.ts > 600000) _oauthStates.delete(k);
  }
  return s;
}
function _consumeState(s) {
  const v = _oauthStates.get(s);
  if (!v) return null;
  _oauthStates.delete(s);
  if (Date.now() - v.ts > 600000) return null;
  return v;
}

// ── GET /api/strava/status ───────────────────────────────────
// Renvoie l'état de connexion Strava de l'user connecté.
router.get('/status', requireAuth, async (req, res) => {
  try {
    if (!strava.isConfigured()) {
      return res.json({ configured: false, connected: false });
    }
    const rows = await query(
      `SELECT strava_athlete_id, athlete_firstname, athlete_lastname, athlete_profile,
              connected_at, last_sync_at, scope,
              (SELECT COUNT(*) FROM strava_activities WHERE user_id = ?) AS activities_count
       FROM user_strava_link WHERE user_id = ?`,
      [req.user.id, req.user.id]
    );
    if (!rows.length) return res.json({ configured: true, connected: false });
    const link = rows[0];
    res.json({
      configured: true,
      connected: true,
      athlete: {
        id: String(link.strava_athlete_id),
        firstname: link.athlete_firstname,
        lastname:  link.athlete_lastname,
        profile_url: link.athlete_profile,
      },
      scope:         link.scope,
      connected_at:  link.connected_at,
      last_sync_at:  link.last_sync_at,
      activities_count: link.activities_count,
    });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur status Strava');
  }
});

// ── GET /api/strava/connect ──────────────────────────────────
// Lance le flow OAuth — redirige vers Strava.
router.get('/connect', requireAuth, (req, res) => {
  try {
    if (!strava.isConfigured()) {
      return res.status(503).send('Strava non configuré sur ce serveur (STRAVA_CLIENT_ID manquant).');
    }
    const state = _newState(req.user.id);
    const url = strava.buildAuthorizeUrl(state);
    res.redirect(302, url);
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur connexion Strava');
  }
});

// ── GET /api/strava/callback ─────────────────────────────────
// Callback OAuth depuis Strava. Échange le code contre les tokens et stocke.
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect('/profil.html?strava=error&reason=' + encodeURIComponent(String(error)));
    }
    if (!code || !state) return res.status(400).send('Missing code or state.');

    const stateData = _consumeState(String(state));
    if (!stateData) return res.status(400).send('State invalide ou expiré. Recommencez la connexion.');

    const tokenData = await strava.exchangeCodeForToken(String(code));
    const athlete = tokenData.athlete || {};

    await query(
      `INSERT INTO user_strava_link
        (user_id, strava_athlete_id, access_token, refresh_token, expires_at, scope,
         athlete_firstname, athlete_lastname, athlete_profile)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         access_token = VALUES(access_token),
         refresh_token = VALUES(refresh_token),
         expires_at = VALUES(expires_at),
         scope = VALUES(scope),
         athlete_firstname = VALUES(athlete_firstname),
         athlete_lastname = VALUES(athlete_lastname),
         athlete_profile = VALUES(athlete_profile)`,
      [
        stateData.userId, athlete.id,
        tokenData.access_token, tokenData.refresh_token, tokenData.expires_at,
        tokenData.scope || null,
        athlete.firstname || null, athlete.lastname || null,
        athlete.profile_medium || athlete.profile || null,
      ]
    );
    logger.info({ userId: stateData.userId, athleteId: athlete.id }, '[strava] connected');

    // ── AUTO-SYNC immédiat (90 jours, 3 pages max ≈ 90 activités)
    // Évite au user de devoir cliquer "Synchroniser" après le retour OAuth.
    // Fire-and-forget pour ne pas bloquer le redirect (la sync peut prendre 5-15s).
    let imported = 0, errMsg = null;
    try {
      const since = new Date(Date.now() - 90 * 86400000);
      const result = await strava.syncActivities(stateData.userId, { since, maxPages: 3 });
      imported = result.imported || 0;
      logger.info({ userId: stateData.userId, imported, skipped: result.skipped }, '[strava] auto-sync done');
    } catch (syncErr) {
      // Sync échouée : ce n'est pas bloquant, le user pourra cliquer "Synchroniser" manuellement
      logger.warn({ err: syncErr.message }, '[strava] auto-sync failed');
      errMsg = syncErr.message;
    }

    const params = new URLSearchParams({ strava: 'connected', imported: String(imported) });
    if (errMsg) params.set('sync_error', errMsg.slice(0, 100));
    res.redirect('/profil.html?' + params.toString());
  } catch (err) {
    logger.error({ err: err.message }, '[strava] callback error');
    res.redirect('/profil.html?strava=error&reason=' + encodeURIComponent(err.message.slice(0, 200)));
  }
});

// ── POST /api/strava/disconnect ──────────────────────────────
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    await query('DELETE FROM user_strava_link WHERE user_id = ?', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur déconnexion Strava'); }
});

// ── POST /api/strava/sync ────────────────────────────────────
// Synchronise les activités récentes. Body: { since_days?, max_pages? }
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const sinceDays = parseInt(req.body?.since_days) || 90;
    const maxPages  = Math.min(10, parseInt(req.body?.max_pages) || 3);
    const since = new Date(Date.now() - sinceDays * 86400000);
    const result = await strava.syncActivities(req.user.id, { since, maxPages });
    res.json({ ok: true, ...result, since_days: sinceDays });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur sync Strava'); }
});

// ── GET /api/strava/activities ───────────────────────────────
// Liste les activités déjà importées (depuis la DB locale, pas l'API Strava).
router.get('/activities', requireAuth, async (req, res) => {
  try {
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = Math.max(0,   parseInt(req.query.offset) || 0);
    const rows = await query(
      `SELECT id, name, type, distance_m, moving_time_s, elevation_gain_m,
              average_speed_ms, average_heartrate, average_watts, start_date,
              start_lat, start_lng, polyline
       FROM strava_activities
       WHERE user_id = ?
       ORDER BY start_date DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [req.user.id]
    );
    res.json({ total: rows.length, activities: rows });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur listing activités'); }
});

// ── GET /api/strava/stats ────────────────────────────────────
// Agrégats : total km/D+ cette année, dernier mois, depuis import.
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const [agg] = await query(
      `SELECT
        COUNT(*)                                  AS total,
        SUM(distance_m)                           AS total_distance_m,
        SUM(elevation_gain_m)                     AS total_elev_m,
        SUM(moving_time_s)                        AS total_time_s,
        SUM(CASE WHEN YEAR(start_date)=? THEN distance_m       ELSE 0 END) AS year_distance_m,
        SUM(CASE WHEN YEAR(start_date)=? THEN elevation_gain_m ELSE 0 END) AS year_elev_m,
        SUM(CASE WHEN YEAR(start_date)=? THEN moving_time_s    ELSE 0 END) AS year_time_s,
        SUM(CASE WHEN start_date >= NOW() - INTERVAL 30 DAY THEN distance_m       ELSE 0 END) AS month_distance_m,
        SUM(CASE WHEN start_date >= NOW() - INTERVAL 30 DAY THEN elevation_gain_m ELSE 0 END) AS month_elev_m
       FROM strava_activities WHERE user_id = ?`,
      [year, year, year, req.user.id]
    );
    res.json(agg || {});
  } catch (err) { errResponse(req, res, err, 500, 'Erreur stats Strava'); }
});

module.exports = router;
