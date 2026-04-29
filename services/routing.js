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
async function route(waypoints, opts = {}) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    throw new Error('Au moins 2 waypoints requis');
  }
  const profile = opts.profile || 'cycling';

  // OSRM accepte au max ~25 waypoints par requête.
  // Si plus, découper en chunks et concaténer.
  const MAX_WP = 25;
  if (waypoints.length <= MAX_WP) {
    return _routeSingle(waypoints, profile);
  }

  // Chunking : on garde un point de chevauchement entre chaque chunk
  const chunks = [];
  for (let i = 0; i < waypoints.length - 1; i += MAX_WP - 1) {
    chunks.push(waypoints.slice(i, Math.min(i + MAX_WP, waypoints.length)));
  }
  let result = [];
  for (const chunk of chunks) {
    const seg = await _routeSingle(chunk, profile);
    if (result.length > 0) result = result.concat(seg.slice(1)); // éviter doublon point pivot
    else result = seg;
  }
  return result;
}

async function _routeSingle(waypoints, profile) {
  const coords = waypoints.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `${OSRM_BASE}/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OSRM_TIMEOUT);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) {
      throw new Error(`OSRM no route: ${data.code || 'unknown'}`);
    }
    return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  } finally {
    clearTimeout(timer);
  }
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

module.exports = { route, densify, haversine };
