/**
 * services/routing.js
 * 
 * Routage cyclable RÉEL via OSRM publique (router.project-osrm.org).
 * Étant donné une liste de waypoints clés, retourne un tracé qui suit
 * les vraies routes cyclables (pas une ligne droite).
 * 
 * Documentation OSRM : https://project-osrm.org/docs/v5.24.0/api/
 * Profil cycling : préfère petites routes, évite autoroutes.
 */

const OSRM_BASE = process.env.OSRM_BASE || 'https://router.project-osrm.org';
const OSRM_TIMEOUT = 15_000;

/**
 * Calcule la distance haversine entre deux points (en mètres)
 */
function haversine(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

/**
 * Route entre une liste de waypoints via OSRM cycling.
 * 
 * @param {Array<{lat,lng}>} waypoints - Liste de points-clés
 * @param {object} opts
 * @param {string} opts.profile - 'cycling' (défaut) | 'driving' | 'foot'
 * @returns {Promise<Array<{lat,lng}>>} Tracé densifié
 * @throws {Error} si OSRM injoignable / pas de route trouvée
 */
// Renvoie uniquement le tracé densifié (rétro-compatible).
async function route(waypoints, opts = {}) {
  const { track } = await routeFull(waypoints, opts);
  return track;
}

/**
 * Comme route() mais renvoie AUSSI les directions tour-par-tour
 * (manœuvres OSRM traduites en français : « Tourner à droite », etc.).
 * @returns {Promise<{track: Array<{lat,lng}>, directions: Array<{instruction,lat,lng,road}>}>}
 */
async function routeFull(waypoints, opts = {}) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    throw new Error('Au moins 2 waypoints requis');
  }
  const profile = opts.profile || 'cycling';

  // OSRM accepte au max ~25 waypoints par requête → chunking au-delà.
  const MAX_WP = 25;
  if (waypoints.length <= MAX_WP) {
    return _routeSingle(waypoints, profile);
  }
  const chunks = [];
  for (let i = 0; i < waypoints.length - 1; i += MAX_WP - 1) {
    chunks.push(waypoints.slice(i, Math.min(i + MAX_WP, waypoints.length)));
  }
  let track = [], directions = [];
  for (const chunk of chunks) {
    const seg = await _routeSingle(chunk, profile);
    if (track.length > 0) track = track.concat(seg.track.slice(1)); // éviter doublon pivot
    else track = seg.track;
    directions = directions.concat(seg.directions);
  }
  return { track, directions };
}

async function _routeSingle(waypoints, profile) {
  const coords = waypoints.map(p => `${p.lng},${p.lat}`).join(';');
  // steps=true → manœuvres tour-par-tour (turn/continue/roundabout…).
  const url = `${OSRM_BASE}/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=true`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OSRM_TIMEOUT);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) {
      throw new Error(`OSRM no route: ${data.code || 'unknown'}`);
    }
    const r = data.routes[0];
    const track = r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    return { track, directions: _extractDirections(r) };
  } finally {
    clearTimeout(timer);
  }
}

// ── Directions tour-par-tour (manœuvres OSRM → français) ────────
const _MOD_FR = {
  left: 'à gauche', right: 'à droite',
  'slight left': 'légèrement à gauche', 'slight right': 'légèrement à droite',
  'sharp left': 'franchement à gauche', 'sharp right': 'franchement à droite',
  straight: 'tout droit', uturn: 'demi-tour',
};
function _maneuverToFr(m, road) {
  const mod = _MOD_FR[m.modifier] || '';
  const on = road ? ` sur ${road}` : '';
  // "turning" = vraie décision (gauche/droite/franchement/demi-tour), pas "tout droit".
  const turning = m.modifier && m.modifier !== 'straight';
  switch (m.type) {
    case 'turn':            return turning ? `Tourner ${mod}`.trim() + on : null;
    case 'fork':            return turning ? `Au croisement, ${mod}`.trim() + on : null;
    case 'end of road':     return `Au bout de la route, ${mod || 'tout droit'}`.trim() + on;
    case 'merge':           return turning ? `S'insérer ${mod}`.trim() + on : null;
    case 'on ramp':         return `Prendre la bretelle ${mod}`.trim();
    case 'off ramp':        return `Sortir ${mod}`.trim();
    case 'roundabout':
    case 'rotary':          return `Au rond-point, ${m.exit || '?'}ᵉ sortie`;
    case 'roundabout turn': return `Au rond-point, ${mod}`.trim();
    case 'continue':        return turning ? `Continuer ${mod}`.trim() + on : null;
    // Ignorés (pas des repères utiles) : 'new name' (la rue change de nom),
    // 'depart'/'arrive' (gérés par les POIs), et tout ce qui est "tout droit".
    default:                return null;
  }
}
function _extractDirections(routeObj) {
  const out = [];
  for (const leg of (routeObj.legs || [])) {
    for (const step of (leg.steps || [])) {
      const m = step.maneuver || {};
      const instr = _maneuverToFr(m, step.name);
      if (!instr) continue;
      const loc = m.location || [];
      if (!Number.isFinite(loc[1]) || !Number.isFinite(loc[0])) continue;
      out.push({ instruction: instr, lat: loc[1], lng: loc[0], road: step.name || '' });
    }
  }
  return out;
}

/**
 * Densifie un tracé en interpolant des points intermédiaires (pas régulier).
 * Utile en fallback si OSRM est inaccessible.
 * 
 * @param {Array<{lat,lng,ele?}>} waypoints
 * @param {number} stepMeters - distance cible entre points (défaut 50 m)
 */
function densify(waypoints, stepMeters = 50) {
  if (!waypoints.length) return [];
  const out = [waypoints[0]];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i + 1];
    const dist = haversine(a, b);
    const n = Math.max(1, Math.round(dist / stepMeters));
    for (let j = 1; j <= n; j++) {
      const t = j / n;
      out.push({
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
        ele: a.ele != null && b.ele != null ? a.ele + (b.ele - a.ele) * t : undefined,
      });
    }
  }
  return out;
}

module.exports = { route, routeFull, densify, haversine };
