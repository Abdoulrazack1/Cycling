/**
 * services/routing.js
 *
 * Routage cyclable RÉEL, avec chaîne de repli robuste :
 *   1. BRouter (https://brouter.de/brouter) — routeur DÉDIÉ vélo, gratuit,
 *      sans clé. Renvoie un tracé qui suit les vraies petites routes cyclables
 *      + l'altitude par point (coord 3D) + des indications de direction.
 *   2. OSRM public (fallback) — profil "driving" en réalité (le serveur de
 *      démo public ignore le profil de l'URL et route TOUJOURS en voiture).
 *      Suit les routes mais privilégie les grands axes → moins bon à vélo.
 *   3. Densification ligne droite (dernier recours, hors-ligne) — via densify().
 *
 * ⚠️ Historique : l'ancien code appelait OSRM en "cycling", mais le serveur
 *    public router.project-osrm.org ne sert QUE le réseau voiture — d'où des
 *    tracés "hors sujet" (grands axes) et, quand il throttlait, des lignes
 *    droites. BRouter corrige les deux problèmes.
 *
 * Config (env) :
 *   BROUTER_BASE     défaut https://brouter.de/brouter
 *   ROUTING_PROFILE  défaut "trekking" (allowlist ci-dessous)
 *   OSRM_BASE        défaut https://router.project-osrm.org
 */

const OSRM_BASE    = process.env.OSRM_BASE    || 'https://router.project-osrm.org';
const BROUTER_BASE = process.env.BROUTER_BASE || 'https://brouter.de/brouter';
const DEFAULT_PROFILE = process.env.ROUTING_PROFILE || 'trekking';
const TIMEOUT = 20_000;
const UA = 'CCSalouel-RouteBuilder/1.0 (club cycling route generator)';

// Profils BRouter exposés (allowlist — évite d'envoyer un nom arbitraire).
//   trekking  : route mixte polyvalente (défaut, bon pour la plupart des sorties)
//   fastbike  : privilégie le bitume roulant, évite chemins/pavés → route
//   gravel    : accepte chemins blancs / gravel
//   shortest  : au plus court (dépannage)
const BROUTER_PROFILES = new Set(['trekking', 'fastbike', 'gravel', 'shortest']);

/** Distance haversine entre deux points {lat,lng} (mètres). */
function haversine(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

/** Valide que chaque waypoint a des coordonnées numériques dans les bornes. */
function _assertValidCoords(waypoints) {
  for (const p of waypoints) {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) ||
        p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
      throw new Error('Coordonnée invalide pour le routage');
    }
  }
}

/**
 * Route entre une liste de waypoints. Essaie BRouter (vélo) puis OSRM.
 *
 * @param {Array<{lat,lng}>} waypoints  ≥ 2 points
 * @param {object} [opts]
 * @param {string} [opts.brouterProfile]  profil BRouter (allowlist)
 * @param {boolean} [opts.preferOsrm]     forcer OSRM (tests)
 * @returns {Promise<{track:Array<{lat,lng,ele?}>, directions:Array, provider:string, hasElevation:boolean}>}
 * @throws {Error} si tous les routeurs échouent (l'appelant retombe sur densify)
 */
async function routeFull(waypoints, opts = {}) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    throw new Error('Au moins 2 waypoints requis');
  }
  _assertValidCoords(waypoints);

  const errors = [];

  // 1) BRouter (sauf si on force OSRM)
  if (!opts.preferOsrm) {
    try {
      const profile = BROUTER_PROFILES.has(opts.brouterProfile) ? opts.brouterProfile : DEFAULT_PROFILE;
      return await _routeBrouter(waypoints, profile);
    } catch (e) {
      errors.push(`BRouter: ${e.message}`);
    }
  }

  // 2) OSRM public (fallback)
  try {
    return await _routeOsrmChunked(waypoints);
  } catch (e) {
    errors.push(`OSRM: ${e.message}`);
  }

  throw new Error(errors.join(' | ') || 'Aucun routeur disponible');
}

/** Rétro-compat : renvoie uniquement le tracé. */
async function route(waypoints, opts = {}) {
  const { track } = await routeFull(waypoints, opts);
  return track;
}

// ═════════════════════════════════════════════════════════════════
// BRouter — routeur vélo dédié
// ═════════════════════════════════════════════════════════════════

async function _routeBrouter(waypoints, profile) {
  const lonlats = waypoints.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join('|');
  const url = `${BROUTER_BASE}?lonlats=${lonlats}&profile=${encodeURIComponent(profile)}`
            + `&alternativeidx=0&format=geojson&timode=2`;

  const data = await _fetchJson(url, 'BRouter');
  const feat = data?.features?.[0];
  const coords = feat?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new Error('réponse sans tracé (points hors réseau routier ?)');
  }

  // coords = [[lng, lat, ele], ...] — l'altitude est intégrée.
  const track = coords.map(c => ({
    lat: c[1], lng: c[0],
    ele: Number.isFinite(c[2]) ? c[2] : undefined,
  }));
  const hasElevation = track.some(p => p.ele != null);

  const directions = _brouterDirections(feat.properties?.voicehints || [], track);
  return { track, directions, provider: 'brouter', hasElevation };
}

/**
 * voicehints BRouter = [ [nodeIdx, cmd, exitNumber, distToNext, angle], ... ].
 * On dérive l'instruction depuis l'ANGLE (robuste et géométrique) :
 *   signe < 0 = gauche, > 0 = droite ; magnitude = netteté du virage.
 * exitNumber > 0 = rond-point.
 */
function _brouterDirections(voicehints, track) {
  const out = [];
  for (const vh of voicehints) {
    const idx = vh[0];
    const exit = vh[2] || 0;
    const angle = vh[4];
    const instr = _brouterHintToFr(angle, exit);
    if (!instr) continue;
    const pt = track[idx] || track[Math.min(idx, track.length - 1)];
    if (!pt) continue;
    out.push({ instruction: instr, lat: pt.lat, lng: pt.lng, road: '' });
  }
  return out;
}

function _ordinalSortie(n) {
  return n === 1 ? '1ʳᵉ sortie' : `${n}ᵉ sortie`;
}
function _brouterHintToFr(angle, exit) {
  if (exit > 0) return `Au rond-point, ${_ordinalSortie(exit)}`;
  if (!Number.isFinite(angle)) return null;
  const abs = Math.abs(angle);
  const dir = angle < 0 ? 'à gauche' : 'à droite';
  if (abs <= 22)  return null;                       // tout droit / simple courbe
  if (abs <= 45)  return `Légèrement ${dir}`;
  if (abs <= 115) return `Tourner ${dir}`;
  if (abs <= 160) return `Tourner franchement ${dir}`;
  return 'Demi-tour';
}

// ═════════════════════════════════════════════════════════════════
// OSRM — fallback (route voiture en pratique)
// ═════════════════════════════════════════════════════════════════

async function _routeOsrmChunked(waypoints) {
  const MAX_WP = 25; // limite pratique OSRM
  if (waypoints.length <= MAX_WP) return _routeOsrm(waypoints);

  const chunks = [];
  for (let i = 0; i < waypoints.length - 1; i += MAX_WP - 1) {
    chunks.push(waypoints.slice(i, Math.min(i + MAX_WP, waypoints.length)));
  }
  let track = [], directions = [];
  for (const chunk of chunks) {
    const seg = await _routeOsrm(chunk);
    track = track.length ? track.concat(seg.track.slice(1)) : seg.track;
    directions = directions.concat(seg.directions);
  }
  return { track, directions, provider: 'osrm', hasElevation: false };
}

async function _routeOsrm(waypoints) {
  const coords = waypoints.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
  const data = await _fetchJson(url, 'OSRM');
  if (data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error(`pas de route (${data.code || 'inconnu'})`);
  }
  const r = data.routes[0];
  const track = r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  return { track, directions: _osrmDirections(r), provider: 'osrm', hasElevation: false };
}

const _MOD_FR = {
  left: 'à gauche', right: 'à droite',
  'slight left': 'légèrement à gauche', 'slight right': 'légèrement à droite',
  'sharp left': 'franchement à gauche', 'sharp right': 'franchement à droite',
  straight: 'tout droit', uturn: 'demi-tour',
};
function _osrmManeuverToFr(m, road) {
  const mod = _MOD_FR[m.modifier] || '';
  const on = road ? ` sur ${road}` : '';
  const turning = m.modifier && m.modifier !== 'straight';
  switch (m.type) {
    case 'turn':            return turning ? `Tourner ${mod}`.trim() + on : null;
    case 'fork':            return turning ? `Au croisement, ${mod}`.trim() + on : null;
    case 'end of road':     return `Au bout de la route, ${mod || 'tout droit'}`.trim() + on;
    case 'merge':           return turning ? `S'insérer ${mod}`.trim() + on : null;
    case 'roundabout':
    case 'rotary':          return m.exit ? `Au rond-point, ${_ordinalSortie(m.exit)}` : 'Au rond-point';
    case 'roundabout turn': return `Au rond-point, ${mod}`.trim();
    case 'continue':        return turning ? `Continuer ${mod}`.trim() + on : null;
    default:                return null;
  }
}
function _osrmDirections(routeObj) {
  const out = [];
  for (const leg of (routeObj.legs || [])) {
    for (const step of (leg.steps || [])) {
      const m = step.maneuver || {};
      const instr = _osrmManeuverToFr(m, step.name);
      if (!instr) continue;
      const loc = m.location || [];
      if (!Number.isFinite(loc[1]) || !Number.isFinite(loc[0])) continue;
      out.push({ instruction: instr, lat: loc[1], lng: loc[0], road: step.name || '' });
    }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════
// Utilitaires
// ═════════════════════════════════════════════════════════════════

async function _fetchJson(url, who) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const resp = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    // BRouter renvoie parfois du texte d'erreur brut (pas du JSON) → message clair.
    try { return JSON.parse(text); }
    catch { throw new Error(text.slice(0, 120).trim() || 'réponse illisible'); }
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`${who} timeout (${TIMEOUT / 1000}s)`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Densifie un tracé en ligne droite (fallback hors-ligne / OSRM+BRouter KO).
 * @param {Array<{lat,lng,ele?}>} waypoints
 * @param {number} stepMeters
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

module.exports = { route, routeFull, densify, haversine, BROUTER_PROFILES };
