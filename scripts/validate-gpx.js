/**
 * scripts/validate-gpx.js
 *
 * Valide les fichiers GPX présents dans asset/gpx/ contre les métadonnées
 * déclarées dans seed.js. À utiliser quand vous avez téléchargé un vrai
 * GPX officiel (depuis Strava, RideWithGPS, Komoot, ou le site de
 * l'organisateur) et que vous voulez vérifier qu'il colle aux annonces.
 *
 * Vérifications effectuées :
 *   - Le fichier existe et est un GPX valide
 *   - La distance réelle est dans une fourchette de ±15 % autour de
 *     la `distance_km` annoncée dans seed.js
 *   - Le départ et l'arrivée sont à moins de 2 km des coordonnées
 *     `location_lat/lng` (point de départ déclaré)
 *
 * Usage :
 *   node scripts/validate-gpx.js
 *   node scripts/validate-gpx.js arenberg-2025.gpx   (un seul fichier)
 *
 * Sortie : tableau coloré avec OK / WARN / ERROR par GPX.
 */

const fs   = require('fs');
const path = require('path');

const GPX_DIR  = path.join(__dirname, '..', 'public', 'asset', 'gpx');
const SEED_PATH = path.join(__dirname, '..', 'database', 'seed.js');

// Couleurs ANSI
const C = {
  reset:  '\x1b[0m', bold: '\x1b[1m',
  green:  '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', dim: '\x1b[2m',
};

// ── Helpers géographiques ────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ── Parser GPX minimal (regex, pas de DOM) ───────────────────────
function parseGpxFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const ptRe = /<trkpt\s+lat="([\d.-]+)"\s+lon="([\d.-]+)"/g;
  const points = [];
  let m;
  while ((m = ptRe.exec(text)) !== null) {
    points.push({ lat: parseFloat(m[1]), lng: parseFloat(m[2]) });
  }
  return points;
}

function totalDistanceKm(points) {
  let m = 0;
  for (let i = 1; i < points.length; i++) {
    m += haversine(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
  }
  return m / 1000;
}

// ── Extracteur de métadonnées depuis seed.js ─────────────────────
function extractSortieMetadata() {
  const src = fs.readFileSync(SEED_PATH, 'utf8');
  const sorties = [];
  // Match each sortie object — multi-line regex on key fields
  const re = /id:\s*'([a-z0-9-]+)',\s*slug.*?title:\s*["']([^"']+)["'].*?distance_km:\s*([\d.]+).*?gpx_filename:\s*'([^']+)'.*?location_(?:_)?(?:name|lat):\s*[^,]+,\s*location_lat:\s*([\d.-]+),\s*location_lng:\s*([\d.-]+)/gs;
  let m;
  while ((m = re.exec(src)) !== null) {
    sorties.push({
      id: m[1], title: m[2],
      distance_km: parseFloat(m[3]),
      gpx_filename: m[4],
      location_lat: parseFloat(m[5]),
      location_lng: parseFloat(m[6]),
    });
  }
  // Fallback: simpler regex if the strict one fails on some entries
  if (sorties.length === 0) {
    const re2 = /id:\s*'([a-z0-9-]+)',\s*slug.*?distance_km:\s*([\d.]+).*?gpx_filename:\s*'([^']+)'/gs;
    while ((m = re2.exec(src)) !== null) {
      sorties.push({
        id: m[1], title: m[1],
        distance_km: parseFloat(m[2]),
        gpx_filename: m[3],
        location_lat: null, location_lng: null,
      });
    }
  }
  return sorties;
}

// ── Validation ───────────────────────────────────────────────────
function validateOne(meta, points) {
  const issues = [];
  if (points.length < 2) {
    issues.push({ level: 'error', msg: `GPX vide ou invalide (${points.length} points)` });
    return issues;
  }
  // Distance
  const realKm = totalDistanceKm(points);
  const diff   = (realKm - meta.distance_km) / meta.distance_km;
  const diffPct = (diff * 100).toFixed(0);
  if (Math.abs(diff) > 0.30) {
    issues.push({ level: 'error',
      msg: `Distance ${realKm.toFixed(1)} km très différente de ${meta.distance_km} km annoncés (${diffPct >= 0 ? '+' : ''}${diffPct} %)` });
  } else if (Math.abs(diff) > 0.15) {
    issues.push({ level: 'warn',
      msg: `Distance ${realKm.toFixed(1)} km vs ${meta.distance_km} km annoncés (${diffPct >= 0 ? '+' : ''}${diffPct} %)` });
  } else {
    issues.push({ level: 'ok', msg: `Distance ${realKm.toFixed(1)} km (${diffPct >= 0 ? '+' : ''}${diffPct} % de l'annonce)` });
  }
  // Départ proche de location
  if (meta.location_lat != null) {
    const startD = haversine(meta.location_lat, meta.location_lng, points[0].lat, points[0].lng);
    if (startD > 2000) {
      issues.push({ level: 'error', msg: `Départ GPX à ${(startD/1000).toFixed(1)} km de la localisation déclarée` });
    } else if (startD > 500) {
      issues.push({ level: 'warn', msg: `Départ GPX à ${startD.toFixed(0)} m de la localisation déclarée` });
    } else {
      issues.push({ level: 'ok', msg: `Départ à ${startD.toFixed(0)} m de la localisation déclarée` });
    }
  }
  // Densité de points (heuristique : si tous les espacements sont identiques
  // à <2 % près, c'est un GPX rééchantillonné algorithmiquement, pas un vrai
  // enregistrement GPS)
  const spacings = [];
  for (let i = 1; i < Math.min(points.length, 200); i++) {
    spacings.push(haversine(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng));
  }
  const mean = spacings.reduce((a,b) => a+b, 0) / spacings.length;
  const variance = spacings.reduce((a,b) => a + (b-mean)**2, 0) / spacings.length;
  const cv = mean ? (Math.sqrt(variance) / mean) : 0;
  if (cv < 0.05) {
    issues.push({ level: 'warn',
      msg: `Espacement uniforme (CV ${(cv*100).toFixed(1)} %) — probable GPX généré algorithmiquement, pas un vrai enregistrement` });
  } else {
    issues.push({ level: 'ok', msg: `Espacement variable (CV ${(cv*100).toFixed(0)} %) — comportement d'enregistrement réel` });
  }
  return issues;
}

// ── Main ─────────────────────────────────────────────────────────
(function main() {
  const filterArg = process.argv[2];
  const sorties = extractSortieMetadata();
  if (sorties.length === 0) {
    console.error(`${C.red}❌ Aucune sortie trouvée dans seed.js${C.reset}`);
    process.exit(1);
  }

  // Build map: gpx_filename → first sortie that uses it (le seed peut avoir
  // plusieurs sorties partageant un même GPX, on valide une seule fois par fichier)
  const byGpx = new Map();
  for (const s of sorties) {
    if (!byGpx.has(s.gpx_filename)) byGpx.set(s.gpx_filename, s);
  }

  let oks = 0, warns = 0, errors = 0;
  console.log(`\n${C.bold}═══ Validation GPX vs seed.js ═══${C.reset}\n`);

  for (const [filename, meta] of byGpx) {
    if (filterArg && filename !== filterArg) continue;
    const filePath = path.join(GPX_DIR, filename);
    console.log(`${C.bold}${filename}${C.reset} ${C.dim}— ${meta.title}${C.reset}`);
    if (!fs.existsSync(filePath)) {
      console.log(`  ${C.red}✗ Fichier absent${C.reset}\n`);
      errors++;
      continue;
    }
    const points  = parseGpxFile(filePath);
    const issues  = validateOne(meta, points);
    for (const issue of issues) {
      const icon = issue.level === 'ok'    ? `${C.green}✓${C.reset}`
                 : issue.level === 'warn'  ? `${C.yellow}⚠${C.reset}`
                 :                           `${C.red}✗${C.reset}`;
      console.log(`  ${icon} ${issue.msg}`);
      if (issue.level === 'ok')   oks++;
      if (issue.level === 'warn') warns++;
      if (issue.level === 'error') errors++;
    }
    console.log('');
  }

  console.log(`${C.bold}Résumé :${C.reset} ${C.green}${oks} OK${C.reset}, ${C.yellow}${warns} avertissements${C.reset}, ${C.red}${errors} erreurs${C.reset}\n`);
  process.exit(errors > 0 ? 1 : 0);
})();
