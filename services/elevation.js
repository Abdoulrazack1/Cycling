/**
 * services/elevation.js
 * 
 * Service d'élévation via Open-Meteo Elevation API.
 * Gratuit, sans clé. Limite 100 points par requête, on batch automatiquement.
 * 
 * https://open-meteo.com/en/docs/elevation-api
 */

const ELEVATION_BASE = 'https://api.open-meteo.com/v1/elevation';
const TIMEOUT = 10_000;
const BATCH_SIZE = 100;

/**
 * Récupère l'altitude (en mètres) pour une liste de points.
 * Sous-échantillonne si trop nombreux puis interpole.
 * 
 * @param {Array<{lat,lng}>} points
 * @returns {Promise<Array<number>>} altitudes (même longueur que points)
 * @throws {Error} si l'API échoue
 */
async function fetchElevations(points) {
  if (!Array.isArray(points) || points.length === 0) return [];

  // Si peu de points : un seul appel
  if (points.length <= BATCH_SIZE) {
    return _fetchBatch(points);
  }

  // Sous-échantillonner pour respecter la limite, puis interpoler
  const step = Math.ceil(points.length / BATCH_SIZE);
  const sampled = [];
  for (let i = 0; i < points.length; i += step) {
    sampled.push({ idx: i, ...points[i] });
  }
  if (sampled[sampled.length - 1].idx !== points.length - 1) {
    sampled.push({ idx: points.length - 1, ...points[points.length - 1] });
  }

  const sampledElevs = await _fetchBatch(sampled);
  if (sampledElevs.length !== sampled.length) {
    throw new Error('Réponse Open-Meteo incohérente');
  }

  // Interpoler entre les points échantillonnés
  const out = new Array(points.length);
  for (let s = 0; s < sampled.length - 1; s++) {
    const a = sampled[s], b = sampled[s + 1];
    const eA = sampledElevs[s], eB = sampledElevs[s + 1];
    for (let i = a.idx; i <= b.idx; i++) {
      const t = (i - a.idx) / Math.max(1, b.idx - a.idx);
      out[i] = eA + (eB - eA) * t;
    }
  }
  return out;
}

async function _fetchBatch(points) {
  const lats = points.map(p => p.lat.toFixed(6)).join(',');
  const lngs = points.map(p => p.lng.toFixed(6)).join(',');
  const url = `${ELEVATION_BASE}?latitude=${lats}&longitude=${lngs}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) throw new Error(`Open-Meteo HTTP ${resp.status}`);
    const data = await resp.json();
    return data.elevation || [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calcule D+ et D- à partir d'une liste d'altitudes ordonnées
 */
function computeDplus(elevations) {
  let dPlus = 0, dMinus = 0;
  for (let i = 1; i < elevations.length; i++) {
    const d = elevations[i] - elevations[i - 1];
    if (d > 0) dPlus += d;
    else dMinus -= d;
  }
  return { dPlus: Math.round(dPlus), dMinus: Math.round(dMinus) };
}

module.exports = { fetchElevations, computeDplus };
