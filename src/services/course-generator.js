/**
 * services/course-generator.js
 * 
 * Pipeline de génération automatique d'une course à partir de ses données minimales.
 * 
 * INPUT : { name, region, distanceKm, waypoints: [{lat,lng, type?, label?, desc?}, ...], laps? }
 * OUTPUT : { id, gpxPath, gpxFilename, points, pois, stats }
 * 
 * Étapes :
 *   1. Slugifier le nom → id
 *   2. Router les waypoints via OSRM (cycling) → tracé densifié
 *      Fallback : densification manuelle si OSRM indisponible
 *   3. Récupérer les altitudes Open-Meteo → tracé enrichi
 *      Fallback : altitude des waypoints interpolée
 *   4. Calculer km cumulé, D+/D-
 *   5. Extraire les POIs (waypoints typés) en associant le km calculé
 *   6. Construire et sauvegarder le fichier GPX
 *   7. Optionnellement : INSERT en base
 */

const fs = require('fs');
const path = require('path');

const routing  = require('./routing');
const elevation = require('./elevation');
const gpxBuilder = require('./gpx-builder');

/**
 * Slugifie un nom de course en identifiant safe pour les filenames + URLs
 */
function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // supprimer accents
    .replace(/[^a-z0-9]+/g, '-')        // espaces/ponctuation → tiret
    .replace(/^-+|-+$/g, '')            // tirets de bord
    .substring(0, 60);
}

/**
 * Génère une course complète depuis ses waypoints clés.
 * 
 * @param {object} input
 * @param {string} input.name - Nom de la course
 * @param {string} [input.id] - Identifiant (sinon dérivé de name)
 * @param {string} [input.region] - "Nord (59)", "Pas-de-Calais (62)", etc.
 * @param {number} [input.distanceKm] - Distance officielle (info)
 * @param {Array<Waypoint>} input.waypoints - Points-clés
 * @param {number} [input.laps] - Nombre de tours (course en circuit)
 * @param {object} [opts]
 * @param {boolean} [opts.skipRouting=false] - Si true, n'utilise pas OSRM (test/offline)
 * @param {boolean} [opts.skipElevation=false] - Si true, n'utilise pas Open-Meteo
 * @returns {Promise<GeneratedCourse>}
 */
async function generate(input, opts = {}) {
  if (!input?.waypoints?.length || input.waypoints.length < 2) {
    throw new Error('Au moins 2 waypoints requis');
  }

  const id = input.id || slugify(input.name || 'course');
  const errors = [];
  const log = [];
  const startTime = Date.now();

  // 1) Multiplier les waypoints pour les courses en boucle (laps)
  let workingWaypoints = input.waypoints;
  if (input.laps && input.laps > 1) {
    let multi = [...input.waypoints];
    for (let l = 1; l < input.laps; l++) {
      multi = multi.concat(input.waypoints.slice(1)); // pas le 1er pour éviter doublon
    }
    workingWaypoints = multi;
    log.push(`laps × ${input.laps} → ${workingWaypoints.length} waypoints`);
  }

  // 2) Router via OSRM (+ directions tour-par-tour)
  let trackPoints, osrmDirections = [];
  if (opts.skipRouting) {
    trackPoints = routing.densify(workingWaypoints, 50);
    log.push(`OSRM skip → densification manuelle (${trackPoints.length} pts)`);
  } else {
    try {
      const justLatLng = workingWaypoints.map(w => ({ lat: w.lat, lng: w.lng }));
      const routed = await routing.routeFull(justLatLng, { profile: 'cycling' });
      trackPoints = routed.track;
      osrmDirections = routed.directions || [];
      log.push(`OSRM cycling → ${trackPoints.length} pts, ${osrmDirections.length} directions`);
    } catch (e) {
      errors.push(`OSRM: ${e.message}`);
      trackPoints = routing.densify(workingWaypoints, 50);
      log.push(`OSRM fallback → densification (${trackPoints.length} pts)`);
    }
  }

  // 3) Récupérer les altitudes
  if (opts.skipElevation) {
    // Interpoler l'altitude depuis les waypoints fournis
    _interpolateElevations(trackPoints, workingWaypoints);
    log.push(`Élévations skip → interpolation manuelle`);
  } else {
    try {
      const elevs = await elevation.fetchElevations(trackPoints);
      for (let i = 0; i < trackPoints.length; i++) {
        trackPoints[i].ele = elevs[i] != null ? elevs[i] : 0;
      }
      log.push(`Open-Meteo → ${trackPoints.length} altitudes`);
    } catch (e) {
      errors.push(`Open-Meteo: ${e.message}`);
      _interpolateElevations(trackPoints, workingWaypoints);
      log.push(`Open-Meteo fallback → interpolation`);
    }
  }

  // 4) Calculer km cumulé
  let totalDistM = 0;
  trackPoints[0].kmAccum = 0;
  for (let i = 1; i < trackPoints.length; i++) {
    totalDistM += routing.haversine(trackPoints[i - 1], trackPoints[i]);
    trackPoints[i].kmAccum = totalDistM / 1000;
  }
  const totalKm = totalDistM / 1000;

  // 5) D+ et D-
  const elevs = trackPoints.map(p => p.ele || 0);
  const { dPlus, dMinus } = elevation.computeDplus(elevs);

  // 6) Extraire les POIs depuis les waypoints typés
  const pois = _extractPois(input.waypoints, trackPoints, id);
  log.push(`POIs extraits: ${pois.length}`);

  // 6b) Directions tour-par-tour OSRM → CARNET DE ROUTE (liste, comme Strava).
  // ⚠️ PAS des POIs sur la carte : elles encombraient le tracé (50-80 flèches).
  // La carte ne garde que les vrais POIs (départ, arrivée, ravito…) ; les
  // directions sont une liste à part (re-dérivable du tracé).
  let directions = [];
  if (osrmDirections.length) {
    directions = _buildDirections(osrmDirections, trackPoints);
    log.push(`Directions (carnet de route): ${directions.length}`);
  }

  // 7) Construire et sauver le GPX
  const gpxContent = gpxBuilder.build({
    name: input.name || id,
    desc: `${input.region || ''} · ${totalKm.toFixed(1)} km · D+${dPlus} m`,
  }, trackPoints);
  const gpxPath = gpxBuilder.save(id, gpxContent);

  const stats = {
    points: trackPoints.length,
    distanceKm: +totalKm.toFixed(1),
    dPlus,
    dMinus,
    eleMin: Math.round(Math.min(...elevs)),
    eleMax: Math.round(Math.max(...elevs)),
    durationMs: Date.now() - startTime,
  };

  return {
    id,
    name: input.name,
    region: input.region,
    gpxPath,
    gpxFilename: path.basename(gpxPath),
    pois,
    directions,
    stats,
    log,
    errors,
    waypoints: input.waypoints,
  };
}

/**
 * Interpolation linéaire des altitudes des waypoints sur la route densifiée.
 * Pour chaque point routé, trouver les 2 waypoints les plus proches en index
 * et interpoler.
 */
function _interpolateElevations(trackPoints, waypoints) {
  // Pour chaque waypoint, trouver le point routé le plus proche
  const wpIndices = waypoints.map(wp => {
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < trackPoints.length; i++) {
      const d = (trackPoints[i].lat - wp.lat) ** 2 + (trackPoints[i].lng - wp.lng) ** 2;
      if (d < bestD) { bestD = d; bestI = i; }
    }
    return { idx: bestI, ele: wp.ele != null ? wp.ele : 0 };
  });

  for (let s = 0; s < wpIndices.length - 1; s++) {
    const a = wpIndices[s], b = wpIndices[s + 1];
    if (b.idx <= a.idx) continue;
    for (let i = a.idx; i <= b.idx; i++) {
      const t = (i - a.idx) / Math.max(1, b.idx - a.idx);
      trackPoints[i].ele = a.ele + (b.ele - a.ele) * t;
    }
  }
  // Combler les bords
  for (let i = 0; i < trackPoints.length; i++) {
    if (trackPoints[i].ele == null) {
      trackPoints[i].ele = wpIndices[0]?.ele || 0;
    }
  }
}

/**
 * Extrait les POIs des waypoints typés (depart/arrivee/secteur/ravito/danger/signaleur)
 * en calculant leur km cumulé sur le tracé routé.
 */
function _extractPois(originalWaypoints, trackPoints, idPrefix) {
  const pois = [];
  let counter = 1;
  const prefix = idPrefix.split('-').slice(0, 2).join('-').substring(0, 10);

  for (const wp of originalWaypoints) {
    if (!wp.type || !wp.label) continue;

    // Trouver le point routé le plus proche
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < trackPoints.length; i++) {
      const d = (trackPoints[i].lat - wp.lat) ** 2 + (trackPoints[i].lng - wp.lng) ** 2;
      if (d < bestD) { bestD = d; bestI = i; }
    }
    let km = trackPoints[bestI].kmAccum || 0;
    if (wp.type === 'arrivee') {
      km = trackPoints[trackPoints.length - 1].kmAccum || 0;
    }

    pois.push({
      id: `${prefix}-${counter++}`,
      type: wp.type,
      label: wp.label,
      desc: wp.desc || '',
      km: Math.round(km * 10) / 10,
      lat: wp.lat,
      lng: wp.lng,
      contact: wp.contact || null,
    });
  }
  return pois;
}

/**
 * Construit le CARNET DE ROUTE (liste de directions tour-par-tour) depuis les
 * manœuvres OSRM. Chaque manœuvre est snappée au point routé le plus proche
 * pour son km cumulé. Renvoie une liste triée par km — PAS des POIs de carte.
 */
function _buildDirections(directions, trackPoints) {
  const out = directions.map(d => {
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < trackPoints.length; i++) {
      const dd = (trackPoints[i].lat - d.lat) ** 2 + (trackPoints[i].lng - d.lng) ** 2;
      if (dd < bestD) { bestD = dd; bestI = i; }
    }
    return {
      km: Math.round((trackPoints[bestI].kmAccum || 0) * 10) / 10,
      instruction: d.instruction,
      road: d.road || '',
      lat: d.lat,
      lng: d.lng,
    };
  });
  out.sort((a, b) => a.km - b.km);
  // Dédoublonnage : enlève deux directions identiques quasi au même km.
  return out.filter((d, i) => i === 0 || d.instruction !== out[i - 1].instruction || (d.km - out[i - 1].km) > 0.1);
}

module.exports = { generate, slugify };
