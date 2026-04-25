/**
 * scripts/generate-gpx.js
 * 
 * Génère un GPX routé depuis une liste de waypoints, avec altitudes réelles.
 * À utiliser pour créer le parcours officiel d'une nouvelle course :
 *   1) Le parcours-officiel-de-l-organisateur est défini comme une liste de
 *      points clés (carrefours, lieux de passage)
 *   2) OSRM route entre ces points sur les vraies routes cyclables
 *   3) Open-Meteo récupère les altitudes réelles
 *   4) Le résultat est sauvé comme vrai fichier .gpx dans asset/gpx/
 * 
 * Usage :
 *   node scripts/generate-gpx.js <preset>
 * 
 * Presets disponibles : criterium-salouel, grand-prix-salouel
 * 
 * Pour ajouter un nouveau preset, éditer le tableau PRESETS ci-dessous avec
 * les waypoints réels du parcours fourni par l'organisateur.
 */

const fs   = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// PRESETS — waypoints officiels fournis par les organisateurs
// ═══════════════════════════════════════════════════════════════
// Pour chaque course, on entre les points-clés du parcours réel :
// départ, intersections importantes, secteurs spéciaux, arrivée.
// OSRM se charge de tracer entre ces points sur les vraies routes.

const PRESETS = {

  // ─────────────────────────────────────────────────────────────
  // Critérium de Salouel — circuit fermé Z.I. Nord, 40 km
  // 8 tours d'un circuit de 5 km dans la zone industrielle
  // Circuit reconnu par la commission FFC Hauts-de-France
  // ─────────────────────────────────────────────────────────────
  'criterium-salouel': {
    name: 'Critérium de Salouel — Z.I. Nord',
    desc: 'Critérium FFC sur circuit fermé · 8 tours x 5 km',
    laps: 8,
    // Un seul tour décrit ; sera répété pour atteindre 40 km
    lap: [
      { lat: 49.86440, lng: 2.22650, name: 'Départ — av. de l\'Étoile' },
      { lat: 49.86570, lng: 2.23120, name: 'Carrefour rue de la Paix' },
      { lat: 49.86250, lng: 2.23450, name: 'Rond-point ZI Nord' },
      { lat: 49.85890, lng: 2.23250, name: 'Intersection D210' },
      { lat: 49.85780, lng: 2.22810, name: 'Virage chicane' },
      { lat: 49.86120, lng: 2.22480, name: 'Retour parcours' },
      { lat: 49.86440, lng: 2.22650, name: 'Ligne d\'arrivée' },
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // Grand Prix de Salouel — circuit ville centre, 65 km
  // 10 tours d'un circuit de 6,5 km dans le centre-ville
  // Course FSGT 1re/2e/3e cat
  // ─────────────────────────────────────────────────────────────
  'grand-prix-salouel': {
    name: 'Grand Prix de Salouel — Centre-ville',
    desc: 'Course FSGT · 10 tours x 6,5 km',
    laps: 10,
    lap: [
      { lat: 49.85770, lng: 2.23470, name: 'Départ — Place de l\'Église' },
      { lat: 49.86010, lng: 2.23950, name: 'Rue de la République' },
      { lat: 49.85850, lng: 2.24500, name: 'Carrefour Pont-de-Metz' },
      { lat: 49.85410, lng: 2.24320, name: 'Avenue de l\'Europe' },
      { lat: 49.85130, lng: 2.23720, name: 'Boulevard du Sud' },
      { lat: 49.85320, lng: 2.23080, name: 'Rond-point Bel-Air' },
      { lat: 49.85610, lng: 2.23280, name: 'Retour Centre' },
      { lat: 49.85770, lng: 2.23470, name: 'Ligne d\'arrivée' },
    ]
  },
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function haversine(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

async function osrmRoute(waypoints) {
  const coords = waypoints.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/cycling/${coords}?overview=full&geometries=geojson`;
  console.log(`  → OSRM route (${waypoints.length} waypoints)…`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('OSRM HTTP ' + resp.status);
  const data = await resp.json();
  if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('OSRM: pas de route trouvée');
  return data.routes[0].geometry.coordinates.map(([lo, la]) => ({ lat: la, lng: lo }));
}

async function openMeteoElevations(points) {
  // Open-Meteo accepte max 100 points par requête
  const MAX = 100;
  const out = new Array(points.length).fill(0);

  for (let start = 0; start < points.length; start += MAX) {
    const slice = points.slice(start, start + MAX);
    const lats = slice.map(p => p.lat.toFixed(6)).join(',');
    const lngs = slice.map(p => p.lng.toFixed(6)).join(',');
    const url  = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;
    console.log(`  → Open-Meteo elevation [${start}-${start + slice.length}]…`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Open-Meteo HTTP ' + resp.status);
    const data = await resp.json();
    const elevs = data.elevation || [];
    for (let i = 0; i < slice.length; i++) out[start + i] = elevs[i] || 0;
    // Éviter de saturer l'API
    if (start + MAX < points.length) await new Promise(r => setTimeout(r, 500));
  }
  return out;
}

function buildGpx(name, desc, points) {
  const now = new Date().toISOString();
  const trkpts = points.map(p =>
    `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${(p.ele ?? 0).toFixed(1)}</ele></trkpt>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="C.C. Salouel — generate-gpx.js"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    <desc>${desc}</desc>
    <time>${now}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function generate(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) {
    console.error(`❌ Preset inconnu : ${presetKey}`);
    console.error(`   Disponibles : ${Object.keys(PRESETS).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n📍 Génération du GPX officiel : ${preset.name}`);
  console.log(`   ${preset.lap.length - 1} segments × ${preset.laps} tours\n`);

  // 1) Router un tour via OSRM
  const oneLap = await osrmRoute(preset.lap);
  const lapDist = oneLap.reduce((sum, pt, i) => i === 0 ? 0 : sum + haversine(oneLap[i-1], pt), 0);
  console.log(`  → Un tour : ${oneLap.length} points, ${(lapDist/1000).toFixed(2)} km`);

  // 2) Répéter pour atteindre le nombre de tours
  let allPoints = [];
  for (let lap = 0; lap < preset.laps; lap++) {
    // Pour les tours suivants, on enlève le 1er point pour éviter doublon
    allPoints = allPoints.concat(lap === 0 ? oneLap : oneLap.slice(1));
  }
  console.log(`  → Total : ${allPoints.length} points, ${(lapDist * preset.laps / 1000).toFixed(1)} km`);

  // 3) Récupérer les altitudes en batch
  const elevs = await openMeteoElevations(allPoints);
  for (let i = 0; i < allPoints.length; i++) allPoints[i].ele = elevs[i];

  // 4) Calculer D+ / D− pour info
  let dPlus = 0, dMinus = 0;
  for (let i = 1; i < allPoints.length; i++) {
    const d = allPoints[i].ele - allPoints[i-1].ele;
    if (d > 0) dPlus += d; else dMinus -= d;
  }
  console.log(`  → Altitude min ${Math.min(...elevs).toFixed(0)} m, max ${Math.max(...elevs).toFixed(0)} m, D+${dPlus.toFixed(0)} m, D−${dMinus.toFixed(0)} m`);

  // 5) Sauver le GPX
  const gpx = buildGpx(preset.name, preset.desc, allPoints);
  const outPath = path.join(__dirname, '..', 'asset', 'gpx', `${presetKey}.gpx`);
  fs.writeFileSync(outPath, gpx, 'utf8');
  console.log(`\n✅ Sauvé : ${outPath}\n`);
}

// CLI
(async () => {
  const arg = process.argv[2];
  if (!arg || arg === '--all') {
    // Générer tous les presets
    for (const key of Object.keys(PRESETS)) {
      try { await generate(key); }
      catch (err) { console.error(`❌ ${key} : ${err.message}\n`); }
    }
  } else {
    try { await generate(arg); }
    catch (err) { console.error(`❌ ${err.message}`); process.exit(1); }
  }
})();
