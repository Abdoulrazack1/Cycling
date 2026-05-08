// services/gpx-parser.js
// Parse un fichier GPX 1.0 ou 1.1 (texte) et calcule les metrics.
// Pure regex, pas de dépendance XML.

/**
 * @typedef {Object} GpxPoint
 * @property {number} lat
 * @property {number} lng
 * @property {number=} ele
 */

/**
 * @typedef {Object} GpxMetrics
 * @property {GpxPoint[]} points
 * @property {number} distance_km
 * @property {number} elevation_gain   D+ en mètres
 * @property {number} elevation_loss   D- en mètres
 * @property {number|null} elevation_min
 * @property {number|null} elevation_max
 * @property {GpxPoint|null} start
 * @property {GpxPoint|null} end
 * @property {{minLat:number,maxLat:number,minLng:number,maxLng:number}|null} bbox
 * @property {string|null} name        nom déclaré dans <metadata><name>
 */

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

/**
 * @param {string} xml
 * @returns {GpxMetrics}
 * @throws Error si le fichier n'est pas un GPX valide ou ne contient aucun trkpt
 */
function parseGpx(xml) {
  if (typeof xml !== 'string' || !xml.includes('<gpx')) {
    throw new Error('Fichier GPX invalide : balise <gpx> absente');
  }

  // Extract <trkpt lat=".." lon=".."> ... <ele>..</ele> .. </trkpt>
  // Tolère aussi <trkpt lon=".." lat=".."> (Komoot inverse parfois).
  const ptRe =
    /<trkpt\s+(?:lat="([\-\d.]+)"\s+lon="([\-\d.]+)"|lon="([\-\d.]+)"\s+lat="([\-\d.]+)"|lat='([\-\d.]+)'\s+lon='([\-\d.]+)')\s*(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
  const eleRe = /<ele>([\-\d.]+)<\/ele>/;

  const points = [];
  let m;
  while ((m = ptRe.exec(xml)) !== null) {
    // Selon le pattern qui a matché, lat/lon sont à des index différents
    let lat, lng;
    if (m[1] !== undefined)      { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
    else if (m[3] !== undefined) { lng = parseFloat(m[3]); lat = parseFloat(m[4]); }
    else                          { lat = parseFloat(m[5]); lng = parseFloat(m[6]); }
    const inner = m[7] ?? '';
    const eleMatch = inner.match(eleRe);
    /** @type {GpxPoint} */
    const p = { lat, lng };
    if (eleMatch) p.ele = parseFloat(eleMatch[1]);
    points.push(p);
  }

  if (points.length < 2) {
    throw new Error(
      `Fichier GPX vide ou invalide : ${points.length} point(s) trouvé(s), 2+ requis`
    );
  }

  // Distance totale + élévations
  // Cf. AUDIT item #22 : l'ancienne version cumulait CHAQUE diff d'élévation,
  // bruit GPS inclus → D+ inflaté de 30-50% vs Strava/Komoot.
  // Maintenant : moyenne glissante sur ~10 points qui élimine le bruit haute
  // fréquence sans masquer les vraies montées. Aucun seuil sur les diffs
  // (les seuils marchent mal sur les GPX synthétiques où chaque pas fait <1 m).
  const SMOOTH_WIN = 10;
  const eles = points.map(p => (typeof p.ele === 'number' && Number.isFinite(p.ele)) ? p.ele : null);
  const smoothed = eles.map((_, i) => {
    const start = Math.max(0, i - Math.floor(SMOOTH_WIN / 2));
    const end   = Math.min(eles.length, i + Math.ceil(SMOOTH_WIN / 2));
    let sum = 0, n = 0;
    for (let j = start; j < end; j++) {
      if (eles[j] !== null) { sum += eles[j]; n++; }
    }
    return n > 0 ? sum / n : null;
  });

  let distM = 0;
  let dPlus = 0;
  let dMinus = 0;
  let eMin = null;
  let eMax = null;
  for (let i = 0; i < points.length; i++) {
    const e = smoothed[i];
    if (e !== null) {
      if (eMin === null || e < eMin) eMin = e;
      if (eMax === null || e > eMax) eMax = e;
    }
    if (i > 0) {
      distM += haversineMeters(points[i - 1], points[i]);
      const prevE = smoothed[i - 1];
      if (e !== null && prevE !== null) {
        const d = e - prevE;
        if (d > 0) dPlus  += d;
        else       dMinus += -d;
      }
    }
  }

  // Bounding box
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  // Nom optionnel
  const nameMatch = xml.match(
    /<metadata>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/metadata>/
  );

  return {
    points,
    distance_km: Math.round((distM / 1000) * 10) / 10,
    elevation_gain: Math.round(dPlus),
    elevation_loss: Math.round(dMinus),
    elevation_min: eMin !== null ? Math.round(eMin) : null,
    elevation_max: eMax !== null ? Math.round(eMax) : null,
    start: points[0],
    end: points[points.length - 1],
    bbox: { minLat, maxLat, minLng, maxLng },
    name: nameMatch ? nameMatch[1].trim() : null,
  };
}

module.exports = { parseGpx, haversineMeters };
