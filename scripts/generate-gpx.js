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

  // ═════════════════════════════════════════════════════════════════
  // ROUTES — parcours linéaires (départ ≠ arrivée ou boucle multi-villes)
  // ═════════════════════════════════════════════════════════════════
  // Pour chaque sortie : waypoints = points-clés vérifiables (villes,
  // monuments, secteurs pavés iconiques). OSRM trace les routes cyclables
  // entre eux. Coordonnées sourcées depuis Wikipédia / OpenStreetMap.
  // ═════════════════════════════════════════════════════════════════

  // Reconnaissance Paris-Roubaix : Compiègne → Vélodrome de Roubaix
  // via les pavés mythiques. ~190 km via OSRM (proche du tracé officiel).
  // Trouée d'Arenberg : 50.399, 3.4125 (Wikipédia, secteur 19).
  'arenberg-2025': {
    name: 'Reconnaissance Paris-Roubaix 2025',
    desc: 'Compiègne → Vélodrome de Roubaix · pavés mythiques',
    laps: 1,
    lap: [
      { lat: 49.4179, lng: 2.8262, name: 'Départ — Compiègne, place du Général de Gaulle' },
      { lat: 49.8480, lng: 3.2876, name: 'Saint-Quentin' },
      { lat: 50.1083, lng: 3.4250, name: 'Troisvilles à Inchy (secteur 30, km 95)' },
      { lat: 50.0764, lng: 3.4636, name: 'Quiévy à Saint-Python (secteur 28)' },
      { lat: 50.1764, lng: 3.2350, name: 'Cambrai' },
      { lat: 50.3083, lng: 3.4889, name: 'Quérénaing à Maing (secteur 22)' },
      { lat: 50.3856, lng: 3.4356, name: 'Haveluy à Wallers (secteur 20)' },
      { lat: 50.3990, lng: 3.4125, name: "Trouée d'Arenberg (secteur 19, ★★★★★)" },
      { lat: 50.4053, lng: 3.3958, name: 'Wallers à Hélesmes (secteur 18)' },
      { lat: 50.4861, lng: 3.1058, name: 'Mons-en-Pévèle (secteur 11, ★★★★★)' },
      { lat: 50.5814, lng: 3.1742, name: "Carrefour de l'Arbre (secteur 4, ★★★★★)" },
      { lat: 50.6857, lng: 3.1786, name: 'Arrivée — Vélodrome de Roubaix' },
    ]
  },

  // Monts des Flandres : Cassel → Mont des Cats → Mont Noir → Kemmelberg
  // Coordonnées Wikipédia : Mont des Cats (50.7806, 2.7286), Kemmelberg (50.7878, 2.8255).
  'monts-flandres': {
    name: 'Monts des Flandres',
    desc: 'Cassel · Mont des Cats · Mont Noir · Kemmelberg · 95 km',
    laps: 1,
    lap: [
      { lat: 50.8012, lng: 2.4854, name: 'Départ — Cassel, place du Général de Gaulle' },
      { lat: 50.7944, lng: 2.5742, name: 'Mont des Récollets' },
      { lat: 50.7806, lng: 2.7286, name: 'Mont des Cats (abbaye)' },
      { lat: 50.7700, lng: 2.7158, name: 'Mont Noir' },
      { lat: 50.7878, lng: 2.8255, name: 'Kemmelberg (sommet, BE)' },
      { lat: 50.7717, lng: 2.8508, name: 'Monteberg' },
      { lat: 50.7825, lng: 2.7611, name: 'Baneberg (descente)' },
      { lat: 50.7972, lng: 2.6817, name: 'Steenvoorde (passage)' },
      { lat: 50.8211, lng: 2.5511, name: 'Watou (passage)' },
      { lat: 50.8012, lng: 2.4854, name: 'Arrivée — Cassel' },
    ]
  },

  // Tour de l'Avesnois : Maroilles → Avesnes → Solre-le-Château → Sars-Poteries
  'avesnois': {
    name: "Tour de l'Avesnois",
    desc: 'Maroilles · Avesnes · Solre-le-Château · Sars-Poteries · 112 km',
    laps: 1,
    lap: [
      { lat: 50.1268, lng: 3.7641, name: 'Départ — Maroilles, place de la Mairie' },
      { lat: 50.1389, lng: 3.8078, name: 'Landrecies (passage)' },
      { lat: 50.1242, lng: 3.9314, name: 'Avesnes-sur-Helpe (ravito)' },
      { lat: 50.0844, lng: 4.0681, name: 'Mur de Liessies' },
      { lat: 50.1989, lng: 4.0850, name: 'Solre-le-Château' },
      { lat: 50.2589, lng: 4.0250, name: 'Sars-Poteries' },
      { lat: 50.2086, lng: 3.9264, name: 'Beaufort (descente)' },
      { lat: 50.1483, lng: 3.8736, name: 'Marbaix' },
      { lat: 50.1268, lng: 3.7641, name: 'Arrivée — Maroilles' },
    ]
  },

  // Gravel de la Scarpe : forêt domaniale de Saint-Amand-Raismes
  // Boucle dans la forêt avec gravel/sentiers. OSRM cycling routera sur
  // les chemins forestiers cartographiés OpenStreetMap.
  'scarpe-gravel': {
    name: 'Gravel de la Scarpe',
    desc: 'Saint-Amand-les-Eaux · Forêt de Raismes · 68-82 km',
    laps: 1,
    lap: [
      { lat: 50.4461, lng: 3.4278, name: 'Départ — Saint-Amand, Tour Abbatiale' },
      { lat: 50.4319, lng: 3.4561, name: 'Étang de la Mare-à-Goriaux' },
      { lat: 50.4156, lng: 3.4982, name: 'Traverse du Mortier' },
      { lat: 50.4080, lng: 3.5180, name: 'Mont des Bruyères' },
      { lat: 50.3961, lng: 3.4986, name: 'Raismes (centre)' },
      { lat: 50.4136, lng: 3.4181, name: 'Hasnon (lisière)' },
      { lat: 50.4400, lng: 3.4036, name: 'Vicoigne' },
      { lat: 50.4461, lng: 3.4278, name: 'Arrivée — Saint-Amand' },
    ]
  },

  // Côte d'Opale : Boulogne → Cap Gris-Nez → Cap Blanc-Nez
  // Cap Gris-Nez (50.8722, 1.5856) et Cap Blanc-Nez (50.9264, 1.7203) :
  // coordonnées IGN officielles. Ce parcours longe la D940 cyclable.
  'cote-opale': {
    name: "Côte d'Opale",
    desc: 'Boulogne · Cap Gris-Nez · Cap Blanc-Nez · 104 km',
    laps: 1,
    lap: [
      { lat: 50.7264, lng: 1.6068, name: 'Départ — Boulogne-sur-Mer, port' },
      { lat: 50.7656, lng: 1.6094, name: 'Wimereux (côte de Wimereux)' },
      { lat: 50.7861, lng: 1.5917, name: 'Ambleteuse' },
      { lat: 50.8550, lng: 1.6128, name: 'Audinghen (ravito)' },
      { lat: 50.8722, lng: 1.5856, name: 'Cap Gris-Nez (phare)' },
      { lat: 50.8866, lng: 1.6675, name: 'Wissant (baie)' },
      { lat: 50.9264, lng: 1.7203, name: 'Cap Blanc-Nez (sommet)' },
      { lat: 50.9286, lng: 1.7625, name: 'Sangatte' },
      { lat: 50.7969, lng: 1.6358, name: 'Wimille (retour)' },
      { lat: 50.7264, lng: 1.6068, name: 'Arrivée — Boulogne-sur-Mer' },
    ]
  },

  // Boucle du Cambrésis : Cambrai · Caudry · Boussières
  'cambresis': {
    name: 'Boucle du Cambrésis',
    desc: 'Cambrai · Caudry · Boussières · 100 km',
    laps: 1,
    lap: [
      { lat: 50.1762, lng: 3.2350, name: 'Départ — Cambrai, place Aristide-Briand' },
      { lat: 50.1278, lng: 3.4036, name: 'Caudry' },
      { lat: 50.0833, lng: 3.4111, name: 'Beauvois-en-Cambrésis' },
      { lat: 50.1818, lng: 3.4986, name: 'Solesmes (ravito)' },
      { lat: 50.2658, lng: 3.4339, name: 'Vendegies-sur-Écaillon' },
      { lat: 50.2467, lng: 3.3147, name: 'Bouchain' },
      { lat: 50.2097, lng: 3.2289, name: 'Iwuy' },
      { lat: 50.1762, lng: 3.2350, name: 'Arrivée — Cambrai' },
    ]
  },

  // Pavé de la Pévèle : Orchies · Mons-en-Pévèle · Templeuve
  // Mons-en-Pévèle est le secteur pavé 5 étoiles à 50.4861, 3.1058.
  'pevele': {
    name: 'Boucle du Pévèle',
    desc: 'Orchies · Mons-en-Pévèle · Templeuve · 84 km',
    laps: 1,
    lap: [
      { lat: 50.4719, lng: 3.2419, name: 'Départ — Orchies, place de la République' },
      { lat: 50.4892, lng: 3.0972, name: 'Mons-en-Pévèle (★★★★★)' },
      { lat: 50.5189, lng: 3.1064, name: 'Pont-à-Marcq (ravito)' },
      { lat: 50.5403, lng: 3.1697, name: 'Templeuve' },
      { lat: 50.5269, lng: 3.2406, name: 'Cysoing' },
      { lat: 50.5036, lng: 3.2606, name: 'Bourghelles' },
      { lat: 50.4778, lng: 3.2367, name: 'Beuvry-la-Forêt' },
      { lat: 50.4719, lng: 3.2419, name: 'Arrivée — Orchies' },
    ]
  },

  // ═════════════════════════════════════════════════════════════════
  // CIRCUITS — boucles fermées répétées (critériums, courses sur circuit)
  // ═════════════════════════════════════════════════════════════════

  // Critérium de Salouel — circuit fermé Z.I. Nord, 8 tours x 5 km = 40 km
  'criterium-salouel': {
    name: 'Critérium de Salouel — Z.I. Nord',
    desc: 'Critérium FFC sur circuit fermé · 8 tours x 5 km',
    laps: 8,
    lap: [
      { lat: 49.86440, lng: 2.22650, name: "Départ — av. de l'Étoile" },
      { lat: 49.86570, lng: 2.23120, name: 'Carrefour rue de la Paix' },
      { lat: 49.86250, lng: 2.23450, name: 'Rond-point ZI Nord' },
      { lat: 49.85890, lng: 2.23250, name: 'Intersection D210' },
      { lat: 49.85780, lng: 2.22810, name: 'Virage chicane' },
      { lat: 49.86120, lng: 2.22480, name: 'Retour parcours' },
      { lat: 49.86440, lng: 2.22650, name: "Ligne d'arrivée" },
    ]
  },

  // Grand Prix de Salouel — circuit ville centre, 10 tours x 6,5 km = 65 km
  'grand-prix-salouel': {
    name: 'Grand Prix de Salouel — Centre-ville',
    desc: 'Course FSGT · 10 tours x 6,5 km',
    laps: 10,
    lap: [
      { lat: 49.85770, lng: 2.23470, name: "Départ — Place de l'Église" },
      { lat: 49.86010, lng: 2.23950, name: 'Rue de la République' },
      { lat: 49.85850, lng: 2.24500, name: 'Carrefour Pont-de-Metz' },
      { lat: 49.85410, lng: 2.24320, name: "Avenue de l'Europe" },
      { lat: 49.85130, lng: 2.23720, name: 'Boulevard du Sud' },
      { lat: 49.85320, lng: 2.23080, name: 'Rond-point Bel-Air' },
      { lat: 49.85610, lng: 2.23280, name: 'Retour Centre' },
      { lat: 49.85770, lng: 2.23470, name: "Ligne d'arrivée" },
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
  const outPath = path.join(__dirname, '..', 'public', 'asset', 'gpx', `${presetKey}.gpx`);
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
