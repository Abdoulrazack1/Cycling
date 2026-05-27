/* ═════════════════════════════════════════════════════════════════
   services/strava-client.js — Client Strava (OAuth + API)
   ─────────────────────────────────────────────────────────────────
   Wrappe l'API Strava avec :
     - Échange code → tokens
     - Auto-refresh quand l'access_token expire (TTL ~6h)
     - getValidAccessToken(userId) : retourne un token utilisable
     - stravaGet() : GET authentifié + détection rate-limit (429)
     - syncActivities() : récupère les activités récentes en BDD

   Doc Strava API : https://developers.strava.com/docs/reference/

   Variables d'env requises :
     STRAVA_CLIENT_ID      depuis https://www.strava.com/settings/api
     STRAVA_CLIENT_SECRET  idem
     STRAVA_REDIRECT_URI   ex: http://localhost:3000/api/strava/callback
                           (doit matcher EXACTEMENT l'autorisation Strava)
   ═════════════════════════════════════════════════════════════════ */

const { query } = require('../config/database');
const logger    = require('../lib/logger');


// ─── Constantes Strava ────────────────────────────────────────────
const STRAVA_AUTH_URL  = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_BASE  = 'https://www.strava.com/api/v3';
const SCOPES_DEFAULT   = 'read,activity:read';


// ─── Guard env ────────────────────────────────────────────────────
function _envCheck() {
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    throw new Error(
      'Strava non configuré : STRAVA_CLIENT_ID + STRAVA_CLIENT_SECRET requis ' +
      'dans .env. Crée ton app sur https://www.strava.com/settings/api.'
    );
  }
}


// ═════════════════════════════════════════════════════════════════
// OAUTH — authorize URL + exchange + refresh
// ═════════════════════════════════════════════════════════════════

/** URL d'autorisation OAuth — utilisée pour la première connexion */
function buildAuthorizeUrl(state, scope = SCOPES_DEFAULT) {
  _envCheck();
  const redirect = process.env.STRAVA_REDIRECT_URI || 'http://localhost:3000/api/strava/callback';
  const params = new URLSearchParams({
    client_id:     process.env.STRAVA_CLIENT_ID,
    redirect_uri:  redirect,
    response_type: 'code',
    approval_prompt: 'auto',
    scope:         scope,
    state:         state || '',
  });
  return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

/** Échange un code OAuth contre un access_token + refresh_token */
async function exchangeCodeForToken(code) {
  _envCheck();
  const body = new URLSearchParams({
    client_id:     process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    code,
    grant_type:    'authorization_code',
  });
  const r = await fetch(STRAVA_TOKEN_URL, { method: 'POST', body });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Strava token exchange failed (${r.status}) : ${txt.slice(0, 200)}`);
  }
  return r.json();
}

/** Rafraîchit un access_token expiré via le refresh_token */
async function refreshAccessToken(refreshToken) {
  _envCheck();
  const body = new URLSearchParams({
    client_id:     process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type:    'refresh_token',
  });
  const r = await fetch(STRAVA_TOKEN_URL, { method: 'POST', body });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Strava refresh failed (${r.status}) : ${txt.slice(0, 200)}`);
  }
  return r.json();
}


// ═════════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT — token valide en cache + auto-refresh
// ═════════════════════════════════════════════════════════════════

/**
 * Récupère un access_token valide pour un user — refresh automatique si expiré.
 * Lance une erreur si l'utilisateur n'est pas connecté à Strava.
 */
async function getValidAccessToken(userId) {
  const rows = await query(
    'SELECT strava_athlete_id, access_token, refresh_token, expires_at FROM user_strava_link WHERE user_id = ?',
    [userId]
  );
  if (!rows.length) throw new Error('Utilisateur non connecté à Strava');
  const link = rows[0];
  const nowSec = Math.floor(Date.now() / 1000);
  // Refresh si reste moins de 60s (marge de sécurité)
  if (link.expires_at - nowSec > 60) return link.access_token;

  logger.info({ userId }, '[strava] refreshing access token');
  const refreshed = await refreshAccessToken(link.refresh_token);
  await query(
    `UPDATE user_strava_link SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ?`,
    [refreshed.access_token, refreshed.refresh_token, refreshed.expires_at, userId]
  );
  return refreshed.access_token;
}


// ═════════════════════════════════════════════════════════════════
// API CALLS — wrappers authentifiés
// ═════════════════════════════════════════════════════════════════

/** GET authentifié sur l'API Strava avec refresh auto */
async function stravaGet(userId, pathStr, params = {}) {
  const token = await getValidAccessToken(userId);
  const url = new URL(STRAVA_API_BASE + pathStr);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.append(k, v);
  }
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 429) {
    throw new Error('Strava rate limit atteint (100 req/15min ou 1000/jour). Patientez.');
  }
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Strava API ${pathStr} → ${r.status} : ${txt.slice(0, 200)}`);
  }
  return r.json();
}

/**
 * Synchronise les activités récentes d'un utilisateur.
 * @param {number} userId
 * @param {object} opts { since: Date|number, perPage?: number, maxPages?: number }
 * @returns {Promise<{imported: number, skipped: number, total: number}>}
 */

// ═════════════════════════════════════════════════════════════════
// SYNC — import des activités en BDD locale
// ═════════════════════════════════════════════════════════════════

async function syncActivities(userId, opts = {}) {
  const perPage   = Math.min(100, opts.perPage ?? 30);
  const maxPages  = Math.min(10, opts.maxPages ?? 3);
  const sinceSec  = opts.since
    ? Math.floor((opts.since instanceof Date ? opts.since.getTime() : opts.since) / 1000)
    : 0;

  let imported = 0, skipped = 0, total = 0;
  for (let page = 1; page <= maxPages; page++) {
    const activities = await stravaGet(userId, '/athlete/activities', {
      page, per_page: perPage,
      after: sinceSec || undefined,
    });
    if (!Array.isArray(activities) || activities.length === 0) break;
    total += activities.length;

    for (const a of activities) {
      // INSERT IGNORE — si l'activité existe déjà (PK), on ne ré-importe pas
      const result = await query(
        `INSERT IGNORE INTO strava_activities
          (id, user_id, name, type, distance_m, moving_time_s, elapsed_time_s,
           elevation_gain_m, average_speed_ms, max_speed_ms, average_heartrate,
           max_heartrate, average_watts, kilojoules, start_date, start_lat, start_lng,
           polyline, raw_json)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          a.id, userId, a.name, a.type,
          Math.round(a.distance || 0),
          a.moving_time, a.elapsed_time,
          Math.round(a.total_elevation_gain || 0),
          a.average_speed, a.max_speed,
          a.average_heartrate ? Math.round(a.average_heartrate) : null,
          a.max_heartrate     ? Math.round(a.max_heartrate)     : null,
          a.average_watts     ? Math.round(a.average_watts)     : null,
          a.kilojoules        ? Math.round(a.kilojoules)        : null,
          a.start_date,
          a.start_latlng?.[0] ?? null,
          a.start_latlng?.[1] ?? null,
          a.map?.summary_polyline ?? null,
          JSON.stringify(a),
        ]
      );
      if (result.affectedRows > 0) imported++; else skipped++;
    }
    if (activities.length < perPage) break;
  }

  await query('UPDATE user_strava_link SET last_sync_at = NOW() WHERE user_id = ?', [userId]);
  return { imported, skipped, total };
}

/** Récupère le profil Strava de l'utilisateur (athlete me) */
async function getAthlete(userId) {
  return stravaGet(userId, '/athlete');
}

/** Re-sync une activité Strava précise (utilisé par le webhook et le re-sync manuel) */
async function syncSingleActivity(userId, activityId) {
  const a = await stravaGet(userId, `/activities/${activityId}`);
  if (!a || !a.id) throw new Error('Activité Strava introuvable');

  // UPSERT : on remplace les valeurs (utile pour update events du webhook)
  await query(
    `INSERT INTO strava_activities
      (id, user_id, name, type, distance_m, moving_time_s, elapsed_time_s,
       elevation_gain_m, average_speed_ms, max_speed_ms, average_heartrate,
       max_heartrate, average_watts, kilojoules, start_date, start_lat, start_lng,
       polyline, raw_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       type = VALUES(type),
       distance_m = VALUES(distance_m),
       moving_time_s = VALUES(moving_time_s),
       elapsed_time_s = VALUES(elapsed_time_s),
       elevation_gain_m = VALUES(elevation_gain_m),
       average_speed_ms = VALUES(average_speed_ms),
       max_speed_ms = VALUES(max_speed_ms),
       average_heartrate = VALUES(average_heartrate),
       max_heartrate = VALUES(max_heartrate),
       average_watts = VALUES(average_watts),
       kilojoules = VALUES(kilojoules),
       polyline = VALUES(polyline),
       raw_json = VALUES(raw_json)`,
    [
      a.id, userId, a.name, a.type,
      Math.round(a.distance || 0),
      a.moving_time, a.elapsed_time,
      Math.round(a.total_elevation_gain || 0),
      a.average_speed, a.max_speed,
      a.average_heartrate ? Math.round(a.average_heartrate) : null,
      a.max_heartrate     ? Math.round(a.max_heartrate)     : null,
      a.average_watts     ? Math.round(a.average_watts)     : null,
      a.kilojoules        ? Math.round(a.kilojoules)        : null,
      a.start_date,
      a.start_latlng?.[0] ?? null,
      a.start_latlng?.[1] ?? null,
      a.map?.summary_polyline ?? a.map?.polyline ?? null,
      JSON.stringify(a),
    ]
  );
  return { id: a.id, name: a.name, distance_m: Math.round(a.distance || 0), updated: true };
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getValidAccessToken,
  stravaGet,
  syncActivities,
  syncSingleActivity,
  getAthlete,
  isConfigured: () => !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET),
};
