// scripts/generate-demo-gpx.js
// Génère 4 GPX de démo via OSRM (routage cyclable) + OpenTopoData (altitudes).
// Sortie : asset/gpx/{slug}.gpx  (avesnois, cote-opale, pevele, scarpe-gravel)
//
// Usage : node scripts/generate-demo-gpx.js
// Rate-limit OpenTopoData : 1 req/s gratuit, 100 locations max par requête.

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROUTES = [
  {
    slug: 'avesnois',
    name: "Tour de l'Avesnois",
    waypoints: [
      [3.7641, 50.1268], // Maroilles
      [3.9265, 50.1213], // Avesnes-sur-Helpe
      [4.0908, 50.1722], // Solre-le-Château
      [4.0028, 50.1855], // Sars-Poteries
      [3.7641, 50.1268], // retour Maroilles
    ],
  },
  {
    slug: 'cote-opale',
    name: "Côte d'Opale — Boulogne",
    waypoints: [
      [1.6068, 50.7264], // Boulogne-sur-Mer
      [1.6086, 50.7649], // Wimereux
      [1.5867, 50.8709], // Cap Gris-Nez
      [1.6664, 50.8869], // Wissant
      [1.6068, 50.7264], // retour Boulogne
    ],
  },
  {
    slug: 'pevele',
    name: 'Boucle du Pévèle',
    waypoints: [
      [3.2419, 50.4719], // Orchies
      [3.1042, 50.4894], // Mons-en-Pévèle
      [3.2725, 50.5378], // Templeuve
      [3.2419, 50.4719], // retour Orchies
    ],
  },
  {
    slug: 'scarpe-gravel',
    name: 'La Scarpe Gravel',
    waypoints: [
      [3.4278, 50.4461], // Saint-Amand-les-Eaux
      [3.4825, 50.3933], // Raismes
      [3.4516, 50.5034], // Mortagne-du-Nord
      [3.4278, 50.4461], // retour Saint-Amand
    ],
  },
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ccs-cycling-demo-gpx-generator' } }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 200)}`));
        try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function osrmRoute(waypoints) {
  // OSRM attend lon,lat;lon,lat;...
  const coords = waypoints.map(([lon, lat]) => `${lon},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/cycling/${coords}?geometries=geojson&overview=full`;
  const data = await fetchJson(url);
  if (!data.routes?.[0]) throw new Error('OSRM: no route');
  return data.routes[0].geometry.coordinates; // [[lon,lat],...]
}

function downsample(points, target) {
  if (points.length <= target) return points;
  const step = points.length / target;
  const out = [];
  for (let i = 0; i < target; i++) {
    out.push(points[Math.floor(i * step)]);
  }
  // Toujours conserver le dernier point pour fermer la boucle proprement
  if (out[out.length - 1] !== points[points.length - 1]) {
    out.push(points[points.length - 1]);
  }
  return out;
}

async function enrichWithElevation(points) {
  // OpenTopoData : 100 locations max, 1 req/s gratuit
  const BATCH = 100;
  const elevations = new Array(points.length);
  for (let i = 0; i < points.length; i += BATCH) {
    const slice = points.slice(i, i + BATCH);
    const locs = slice.map(([lon, lat]) => `${lat},${lon}`).join('|');
    const url = `https://api.opentopodata.org/v1/srtm30m?locations=${locs}`;
    const data = await fetchJson(url);
    if (data.status !== 'OK') throw new Error('OpenTopoData: ' + data.status);
    for (let j = 0; j < slice.length; j++) {
      elevations[i + j] = data.results[j].elevation ?? 0;
    }
    // Respect du rate-limit
    if (i + BATCH < points.length) await new Promise((r) => setTimeout(r, 1100));
  }
  return elevations;
}

function distanceM([lon1, lat1], [lon2, lat2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function elevationGain(elevs) {
  let gain = 0;
  for (let i = 1; i < elevs.length; i++) {
    const d = elevs[i] - elevs[i - 1];
    if (d > 0) gain += d;
  }
  return Math.round(gain);
}

function totalDistanceKm(points) {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += distanceM(points[i - 1], points[i]);
  return Math.round((m / 1000) * 10) / 10;
}

function pointsToGpx(name, points, elevations) {
  const trkpts = points
    .map(([lon, lat], i) => {
      const ele = elevations[i] ?? 0;
      return `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><ele>${ele.toFixed(1)}</ele></trkpt>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ccs-demo-generator" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <desc>Demo route — généré via OSRM (routage cyclable) + OpenTopoData SRTM30m.</desc>
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

async function processRoute(route) {
  console.log(`\n[${route.slug}] OSRM route…`);
  let pts = await osrmRoute(route.waypoints);
  console.log(`[${route.slug}] OSRM → ${pts.length} points (${totalDistanceKm(pts)} km brut)`);

  // Downsample pour rester dans la limite OpenTopoData
  pts = downsample(pts, 200);
  console.log(`[${route.slug}] downsampled → ${pts.length} points`);

  console.log(`[${route.slug}] elevations OpenTopoData…`);
  const elevs = await enrichWithElevation(pts);

  const distKm = totalDistanceKm(pts);
  const dPlus = elevationGain(elevs);
  console.log(`[${route.slug}] ✓ ${distKm} km, D+ ${dPlus} m`);

  const gpx = pointsToGpx(route.name, pts, elevs);
  const outPath = path.join(__dirname, '..', 'public', 'asset', 'gpx', `${route.slug}.gpx`);
  fs.writeFileSync(outPath, gpx, 'utf8');
  console.log(`[${route.slug}] écrit dans ${outPath}`);

  return { slug: route.slug, distance_km: distKm, elevation_gain: dPlus };
}

(async () => {
  const results = [];
  for (const r of ROUTES) {
    try {
      results.push(await processRoute(r));
    } catch (err) {
      console.error(`[${r.slug}] ÉCHEC :`, err.message);
      results.push({ slug: r.slug, error: err.message });
    }
  }
  console.log('\n═══ Résumé ═══');
  console.table(results);
})();
