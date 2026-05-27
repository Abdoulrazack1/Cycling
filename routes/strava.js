/* ═════════════════════════════════════════════════════════════════
   routes/strava.js — Intégration Strava (OAuth + sync activités)
   ─────────────────────────────────────────────────────────────────
   Endpoints exposés :
     GET    /api/strava/status        état de connexion de l'user
     GET    /api/strava/connect       lance le flow OAuth (redirect Strava)
     GET    /api/strava/callback      retour OAuth + stockage tokens + auto-sync
     POST   /api/strava/disconnect    efface le lien user_strava_link
     POST   /api/strava/sync          sync manuel des activités récentes
     GET    /api/strava/activities    liste les activités importées en BDD
     GET    /api/strava/stats         agrégats km/D+/temps (année + 30j)
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const crypto  = require('crypto');

const { query }         = require('../config/database');
const { requireAuth }   = require('../middleware/auth');
const { errResponse }   = require('../lib/errors');
const logger            = require('../lib/logger');
const strava            = require('../services/strava-client');

const router = express.Router();


// ═════════════════════════════════════════════════════════════════
// OAUTH STATE — anti-CSRF (mémoire éphémère, 10 min TTL)
// ═════════════════════════════════════════════════════════════════

const _oauthStates = new Map();

function _newState(userId) {
  const s = crypto.randomBytes(16).toString('hex');
  _oauthStates.set(s, { userId, ts: Date.now() });

  // GC opportuniste : on profite de l'appel pour évincer les entrées périmées
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

// ═══════════════════════════════════════════════════════════════════
// GET /api/strava/my-routes — Liste les routes Strava de l'utilisateur
// connecté (les "Itinéraires" sauvegardés sur Strava). Idéal pour qu'un
// admin/président parcoure ses routes et les transforme en sorties.
// ═══════════════════════════════════════════════════════════════════
router.get('/my-routes', requireAuth, async (req, res) => {
  try {
    const perPage = Math.min(50, parseInt(req.query.per_page) || 30);
    const page    = Math.max(1, parseInt(req.query.page) || 1);
    const routes  = await strava.stravaGet(req.user.id, '/athlete/routes', { page, per_page: perPage });
    // On normalise et on ne renvoie que les champs utiles (économise les tokens UI)
    const out = (routes || []).map(r => ({
      id:         r.id,
      id_str:     r.id_str || String(r.id),
      name:       r.name,
      description: r.description || null,
      type:       r.type === 1 ? 'ride' : (r.type === 2 ? 'run' : 'other'),
      sub_type:   r.sub_type, // 1=road, 2=mtb, 3=cx, 4=trail, 5=mixed
      distance_m: Math.round(r.distance || 0),
      elevation_gain_m: Math.round(r.elevation_gain || 0),
      estimated_moving_time_s: r.estimated_moving_time,
      created_at: r.created_at,
      starred:    !!r.starred,
      private:    !!r.private,
      summary_polyline: r.map?.summary_polyline || null,
    }));
    res.json({ routes: out, page, per_page: perPage });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur listing routes Strava');
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/strava/import-route/:routeId — En 1 appel :
//  1. Télécharge le GPX de la route Strava
//  2. Écrit le fichier dans asset/gpx/{slug}.gpx
//  3. Crée une nouvelle sortie en BDD avec métadonnées extraites
//  4. Retourne la sortie créée
//
// Body : { date, title?, statut?, chapter? }
//   date  : YYYY-MM-DD (requis, pour fixer la date de la sortie)
//   title : si absent, utilise le nom de la route
// ═══════════════════════════════════════════════════════════════════
const fs   = require('fs');
const path = require('path');
const { parseGpx } = require('../services/gpx-parser');
const { GPX_DIR: ASSET_GPX_DIR } = require('../middleware/upload');

function _slugify(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

router.post('/import-route/:routeId', requireAuth, async (req, res) => {
  try {
    const routeId = req.params.routeId;
    const date    = req.body?.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date requise (YYYY-MM-DD)' });
    }

    // 1. Fetch metadata Strava
    const meta = await strava.stravaGet(req.user.id, `/routes/${routeId}`);
    const title    = (req.body?.title || meta.name || `Route ${routeId}`).trim();
    const chapter  = req.body?.chapter || 'route';
    const statut   = req.body?.statut === 'future' ? 'future' : (new Date(date) > new Date() ? 'future' : 'passee');
    const slug     = _slugify(title) || `route-${routeId}`;
    const sortieId = `${slug}-${date}`;

    // Vérif unicité
    const existing = await query('SELECT id FROM sorties WHERE id = ? OR slug = ?', [sortieId, slug]);
    if (existing.length) {
      return res.status(409).json({ error: `Sortie déjà existante : ${existing[0].id}. Changez le titre ou la date.` });
    }

    // 2. Télécharge le GPX (endpoint Strava /routes/{id}/export_gpx)
    const token = await strava.getValidAccessToken(req.user.id);
    const gpxResp = await fetch(`https://www.strava.com/api/v3/routes/${routeId}/export_gpx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!gpxResp.ok) {
      const t = await gpxResp.text();
      return res.status(502).json({ error: `Téléchargement GPX Strava échoué (${gpxResp.status})`, detail: t.slice(0, 200) });
    }
    const gpxText = await gpxResp.text();

    // 3. Parse GPX pour métriques + bbox
    const metrics = parseGpx(gpxText);

    // 4. Écrit le fichier GPX
    const gpxFilename = `${slug}.gpx`;
    const gpxPath = path.join(ASSET_GPX_DIR, gpxFilename);
    fs.writeFileSync(gpxPath, gpxText);

    // 5. INSERT sortie
    const heroMap = {
      route: 'asset/img/img-route.webp',  gravel: 'asset/img/img-gravel.webp',
      cote:  'asset/img/img-cote.webp',   monts: 'asset/img/img-monts.webp',
      pave:  'asset/img/img-pave.webp',   peloton: 'asset/img/img-peloton.webp',
      clm:   'asset/img/img-clm.webp',
    };
    const heroImg = heroMap[chapter] || heroMap.route;
    await query(
      `INSERT INTO sorties (id, slug, title, title_html, subtitle, chapter, description,
         date, date_label, distance_km, elevation_gain, elevation_loss, elevation_max, elevation_min,
         hero_img, card_img, location_name, location_lat, location_lng, gpx_filename, statut, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        sortieId, slug, title, title,
        meta.description || `Importé depuis Strava (route ${routeId})`,
        chapter,
        meta.description || null,
        date, null,
        metrics.distance_km, metrics.elevation_gain, metrics.elevation_loss,
        metrics.elevation_max, metrics.elevation_min,
        heroImg, heroImg,
        null, metrics.start.lat, metrics.start.lng,
        gpxFilename, statut, req.user.id,
      ]
    );

    logger.info({ userId: req.user.id, routeId, sortieId, distance: metrics.distance_km }, '[strava] route imported as sortie');
    res.status(201).json({
      ok: true,
      sortie: {
        id: sortieId, slug, title,
        distance_km: metrics.distance_km,
        elevation_gain: metrics.elevation_gain,
        gpx_filename: gpxFilename,
        statut, date,
      },
      strava_route: { id: routeId, name: meta.name },
    });
  } catch (err) {
    logger.error({ err: err.message }, '[strava] import-route error');
    errResponse(req, res, err, 500, 'Erreur import route Strava');
  }
});

// ── GET /api/strava/webhook ─────────────────────────────────
// Validation du webhook par Strava à l'enregistrement (challenge GET).
// Cf. https://developers.strava.com/docs/webhooks/
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const token = req.query['hub.verify_token'];
  const expected = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'CCS_STRAVA_WEBHOOK';
  if (mode === 'subscribe' && token === expected) {
    return res.json({ 'hub.challenge': challenge });
  }
  return res.status(403).json({ error: 'Forbidden' });
});

// ── POST /api/strava/webhook ────────────────────────────────
// Reçoit les évents Strava en temps réel.
// Body : { object_type, object_id, aspect_type, owner_id, subscription_id, event_time, ... }
// Cf. https://developers.strava.com/docs/webhooks/#event-data
router.post('/webhook', async (req, res) => {
  // Réponse en < 2s exigée par Strava — on traite en async
  res.status(200).json({ ok: true });
  try {
    const { object_type, aspect_type, object_id, owner_id } = req.body || {};
    if (!object_type || !object_id || !owner_id) return;

    // On ne traite que les activités (pas les athletes)
    if (object_type !== 'activity') return;

    // Cherche le user lié à cet athlete Strava
    const { query } = require('../config/database');
    const rows = await query(
      'SELECT user_id FROM user_strava_link WHERE strava_athlete_id = ? LIMIT 1',
      [owner_id]
    );
    if (!rows.length) return;
    const userId = rows[0].user_id;

    if (aspect_type === 'create' || aspect_type === 'update') {
      // Re-sync de cette activité spécifique
      await strava.syncSingleActivity(userId, object_id).catch(err => {
        req.log?.warn({ err: err.message }, '[strava webhook] sync échec');
      });
      // Notifie le user (s'il a une notif déjà → idempotence par titre)
      try {
        const { notify } = require('./notifications');
        await notify(userId, 'strava.synced',
          aspect_type === 'create' ? 'Nouvelle activité Strava' : 'Activité Strava mise à jour',
          'Une activité a été synchronisée depuis Strava.', '/profil.html#strava-section');
      } catch {}
    } else if (aspect_type === 'delete') {
      await query('DELETE FROM strava_activities WHERE user_id = ? AND strava_id = ?', [userId, object_id]);
    }
  } catch (err) {
    req.log?.error({ err: err.message }, '[strava webhook] erreur');
  }
});

// ── POST /api/strava/resync/:activityId ─────────────────────
// Re-synchronise une activité Strava unique (debug / fix data drift).
router.post('/resync/:activityId', requireAuth, async (req, res) => {
  try {
    const activityId = parseInt(req.params.activityId, 10);
    if (!activityId) return res.status(400).json({ error: 'Activity ID invalide' });
    const result = await strava.syncSingleActivity(req.user.id, activityId);
    res.json({ ok: true, activity: result });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur re-sync activité');
  }
});

module.exports = router;
