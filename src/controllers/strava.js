/* ═════════════════════════════════════════════════════════════════
   controllers/strava.js — Intégration Strava (OAuth + sync activités)
   ═════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const { query } = require('../config/database');
const { errResponse } = require('../lib/errors');
const logger = require('../lib/logger');
const strava = require('../services/strava-client');
const { parseGpx } = require('../services/gpx-parser');
const { GPX_DIR: ASSET_GPX_DIR } = require('../middleware/upload');
const { notify } = require('../controllers/notifications');

// ── OAuth state — anti-CSRF (mémoire éphémère, 10 min TTL) ──────
const _oauthStates = new Map();

function _newState(userId) {
  const s = crypto.randomBytes(16).toString('hex');
  _oauthStates.set(s, { userId, ts: Date.now() });
  // GC opportuniste
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

function _slugify(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Décode un polyline Google (algorithme standard utilisé par Strava)
function decodePolyline(str) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([lat * 1e-5, lng * 1e-5]);
  }
  return points;
}

function buildGpxFromCoords(coords, name, startDate) {
  const safeName = String(name).replace(/[<>&]/g, '');
  const dateIso = (startDate instanceof Date ? startDate : new Date()).toISOString();
  const trkpts = coords.map(([lat, lng]) =>
    `  <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"></trkpt>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CCS Salouel (Strava import)" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${safeName}</name><time>${dateIso}</time></metadata>
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

const HERO_MAP = {
  route: 'asset/img/img-route.webp',  gravel: 'asset/img/img-gravel.webp',
  cote:  'asset/img/img-cote.webp',   monts: 'asset/img/img-monts.webp',
  pave:  'asset/img/img-pave.webp',   peloton: 'asset/img/img-peloton.webp',
  clm:   'asset/img/img-clm.webp',
};

// ── Handlers ────────────────────────────────────────────────────

// GET /api/strava/status
async function status(req, res) {
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
}

// GET /api/strava/connect — redirige vers Strava
function connect(req, res) {
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
}

// GET /api/strava/callback — échange code → tokens + auto-sync
async function callback(req, res) {
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

    // Auto-sync immédiat (fire-and-forget non bloquant pour le redirect)
    let imported = 0, errMsg = null;
    try {
      const since = new Date(Date.now() - 90 * 86400000);
      const result = await strava.syncActivities(stateData.userId, { since, maxPages: 3 });
      imported = result.imported || 0;
      logger.info({ userId: stateData.userId, imported, skipped: result.skipped }, '[strava] auto-sync done');
    } catch (syncErr) {
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
}

// POST /api/strava/disconnect
async function disconnect(req, res) {
  try {
    await query('DELETE FROM user_strava_link WHERE user_id = ?', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur déconnexion Strava'); }
}

// GET /api/strava/preview-sync
async function previewSync(req, res) {
  try {
    const sinceDays = Math.max(1, parseInt(req.query.since_days) || 90);
    const maxPages  = Math.min(5, parseInt(req.query.max_pages) || 1);
    const sinceSec  = Math.floor((Date.now() - sinceDays * 86400000) / 1000);

    let total = 0;
    let firstPage = [];
    for (let page = 1; page <= maxPages; page++) {
      const acts = await strava.stravaGet(req.user.id, '/athlete/activities', {
        page, per_page: 30, after: sinceSec,
      });
      if (!Array.isArray(acts) || acts.length === 0) break;
      total += acts.length;
      if (page === 1) firstPage = acts;
      if (acts.length < 30) break;
    }

    const ids = firstPage.map(a => a.id);
    let already = [];
    if (ids.length) {
      already = await query(
        `SELECT id FROM strava_activities WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
        [req.user.id, ...ids]
      );
    }
    const alreadySet = new Set(already.map(r => r.id));
    const willImport = firstPage.filter(a => !alreadySet.has(a.id));

    res.json({
      ok: true,
      since_days: sinceDays,
      total_scanned: total,
      already_imported: alreadySet.size,
      will_import: willImport.length,
      preview: willImport.slice(0, 5).map(a => ({
        id: a.id, name: a.name, type: a.type,
        distance_km: Math.round(((a.distance || 0) / 100)) / 10,
        date: a.start_date,
      })),
    });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur preview sync');
  }
}

// POST /api/strava/sync
async function sync(req, res) {
  try {
    const sinceDays = parseInt(req.body?.since_days) || 90;
    const maxPages  = Math.min(10, parseInt(req.body?.max_pages) || 3);
    const since = new Date(Date.now() - sinceDays * 86400000);
    const result = await strava.syncActivities(req.user.id, { since, maxPages });
    res.json({ ok: true, ...result, since_days: sinceDays });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur sync Strava'); }
}

// GET /api/strava/activities
async function activities(req, res) {
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
}

// GET /api/strava/stats
async function stats(req, res) {
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
}

// GET /api/strava/my-routes
async function myRoutes(req, res) {
  try {
    const perPage = Math.min(50, parseInt(req.query.per_page) || 30);
    const page    = Math.max(1, parseInt(req.query.page) || 1);
    const routes  = await strava.stravaGet(req.user.id, '/athlete/routes', { page, per_page: perPage });
    const out = (routes || []).map(r => ({
      id:         r.id,
      id_str:     r.id_str || String(r.id),
      name:       r.name,
      description: r.description || null,
      type:       r.type === 1 ? 'ride' : (r.type === 2 ? 'run' : 'other'),
      sub_type:   r.sub_type,
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
}

// POST /api/strava/import-route/:routeId
async function importRoute(req, res) {
  try {
    const routeId = req.params.routeId;
    const date    = req.body?.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date requise (YYYY-MM-DD)' });
    }

    const meta = await strava.stravaGet(req.user.id, `/routes/${routeId}`);
    const title    = (req.body?.title || meta.name || `Route ${routeId}`).trim();
    const chapter  = req.body?.chapter || 'route';
    const statut   = req.body?.statut === 'future' ? 'future' : (new Date(date) > new Date() ? 'future' : 'passee');
    const slug     = _slugify(title) || `route-${routeId}`;
    const sortieId = `${slug}-${date}`;

    const existing = await query('SELECT id FROM sorties WHERE id = ? OR slug = ?', [sortieId, slug]);
    if (existing.length) {
      return res.status(409).json({ error: `Sortie déjà existante : ${existing[0].id}. Changez le titre ou la date.` });
    }

    const token = await strava.getValidAccessToken(req.user.id);
    const gpxResp = await fetch(`https://www.strava.com/api/v3/routes/${routeId}/export_gpx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!gpxResp.ok) {
      const t = await gpxResp.text();
      return res.status(502).json({ error: `Téléchargement GPX Strava échoué (${gpxResp.status})`, detail: t.slice(0, 200) });
    }
    const gpxText = await gpxResp.text();
    const metrics = parseGpx(gpxText);

    const gpxFilename = `${slug}.gpx`;
    const gpxPath = path.join(ASSET_GPX_DIR, gpxFilename);
    fs.writeFileSync(gpxPath, gpxText);

    const heroImg = HERO_MAP[chapter] || HERO_MAP.route;
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
}

// POST /api/strava/import-activity/:activityId
async function importActivity(req, res) {
  try {
    // Modérateur+ requis (déjà passé par requireAuth)
    if (!['admin', 'moderateur'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Modérateur+ requis pour transformer une activité en sortie' });
    }
    const activityId = parseInt(req.params.activityId, 10);
    if (!activityId) return res.status(400).json({ error: 'Activity ID invalide' });

    let act = await query(
      'SELECT * FROM strava_activities WHERE id = ? AND user_id = ? LIMIT 1',
      [activityId, req.user.id]
    );
    if (!act.length) {
      await strava.syncSingleActivity(req.user.id, activityId);
      act = await query('SELECT * FROM strava_activities WHERE id = ? AND user_id = ? LIMIT 1', [activityId, req.user.id]);
      if (!act.length) return res.status(404).json({ error: 'Activité Strava introuvable' });
    }
    const a = act[0];

    const startDate = new Date(a.start_date);
    const date  = req.body?.date || startDate.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date invalide (YYYY-MM-DD)' });
    }
    const title    = (req.body?.title || a.name || `Activité ${activityId}`).trim();
    const chapter  = req.body?.chapter || 'route';
    const statut   = new Date(date) > new Date() ? 'future' : 'passee';
    const slug     = _slugify(title) || `activity-${activityId}`;
    const sortieId = `${slug}-${date}`;

    const existing = await query('SELECT id FROM sorties WHERE id = ? OR slug = ?', [sortieId, slug]);
    if (existing.length) {
      return res.status(409).json({ error: `Sortie déjà existante : ${existing[0].id}.` });
    }

    if (!a.polyline) return res.status(400).json({ error: "Activité sans tracé (polyline absent) — l'import GPX n'est pas possible." });
    const coords = decodePolyline(a.polyline);
    if (!coords.length) return res.status(400).json({ error: 'Polyline invalide ou vide.' });

    const gpxXml = buildGpxFromCoords(coords, title, startDate);
    const gpxFilename = `${slug}.gpx`;
    const gpxPath = path.join(ASSET_GPX_DIR, gpxFilename);
    fs.writeFileSync(gpxPath, gpxXml);

    const heroImg = HERO_MAP[chapter] || HERO_MAP.route;
    const distanceKm = Math.round((a.distance_m || 0) / 100) / 10;
    await query(
      `INSERT INTO sorties (id, slug, title, title_html, subtitle, chapter, description,
         date, date_label, distance_km, elevation_gain,
         hero_img, card_img, location_name, location_lat, location_lng, gpx_filename, statut, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        sortieId, slug, title, title,
        `Importé depuis activité Strava ${a.id}`,
        chapter,
        a.name || null,
        date, null,
        distanceKm,
        Math.round(a.elevation_gain_m || 0),
        heroImg, heroImg,
        null, a.start_lat, a.start_lng,
        gpxFilename, statut, req.user.id,
      ]
    );

    logger.info({ userId: req.user.id, activityId, sortieId, distance: distanceKm }, '[strava] activity imported as sortie');
    res.status(201).json({
      ok: true,
      sortie: {
        id: sortieId, slug, title,
        distance_km: distanceKm,
        elevation_gain: Math.round(a.elevation_gain_m || 0),
        gpx_filename: gpxFilename,
        statut, date,
      },
      from_activity: { id: a.id, name: a.name },
      url: `/sortie.html?id=${encodeURIComponent(sortieId)}`,
    });
  } catch (err) {
    req.log?.error({ err }, '[strava] import-activity');
    errResponse(req, res, err, 500, 'Erreur import activité Strava');
  }
}

// GET /api/strava/webhook — challenge de validation Strava
function webhookVerify(req, res) {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const token = req.query['hub.verify_token'];
  const expected = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'CCS_STRAVA_WEBHOOK';
  if (mode === 'subscribe' && token === expected) {
    return res.json({ 'hub.challenge': challenge });
  }
  return res.status(403).json({ error: 'Forbidden' });
}

// POST /api/strava/webhook — events temps réel
async function webhookEvent(req, res) {
  // Réponse en < 2s exigée par Strava — on traite en async
  res.status(200).json({ ok: true });
  try {
    const { object_type, aspect_type, object_id, owner_id, subscription_id } = req.body || {};
    if (!object_type || !object_id || !owner_id) return;

    // Anti-injection : rejette les events au subscription_id inattendu (si configuré).
    const expectedSub = process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID;
    if (expectedSub && String(subscription_id) !== String(expectedSub)) {
      req.log?.warn({ subscription_id }, '[strava webhook] subscription_id inattendu — event ignoré');
      return;
    }

    if (object_type !== 'activity') return;

    const rows = await query(
      'SELECT user_id FROM user_strava_link WHERE strava_athlete_id = ? LIMIT 1',
      [owner_id]
    );
    if (!rows.length) return;
    const userId = rows[0].user_id;

    if (aspect_type === 'create' || aspect_type === 'update') {
      await strava.syncSingleActivity(userId, object_id).catch(err => {
        req.log?.warn({ err: err.message }, '[strava webhook] sync échec');
      });
      try {
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
}

// POST /api/strava/resync/:activityId
async function resync(req, res) {
  try {
    const activityId = parseInt(req.params.activityId, 10);
    if (!activityId) return res.status(400).json({ error: 'Activity ID invalide' });
    const result = await strava.syncSingleActivity(req.user.id, activityId);
    res.json({ ok: true, activity: result });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur re-sync activité');
  }
}

module.exports = {
  status, connect, callback, disconnect, previewSync, sync, activities, stats,
  myRoutes, importRoute, importActivity, webhookVerify, webhookEvent, resync,
};
