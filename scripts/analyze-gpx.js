// Quick GPX analyzer — distances, D+, start/end
const fs = require('fs');
const path = require('path');

function haversine(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

function analyzeGpx(file, label) {
  const absFile = path.resolve(file);
  if (!fs.existsSync(absFile)) { console.error(`  ✗ Fichier absent : ${absFile}`); return; }
  const xml = fs.readFileSync(absFile, 'utf8');
  const pts = [];
  const re = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<ele>([^<]+)<\/ele>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    pts.push({ lat: parseFloat(m[1]), lng: parseFloat(m[2]), ele: parseFloat(m[3]) });
  }
  if (pts.length < 2) { console.error(`  ✗ ${label} : ${pts.length} points — fichier invalide`); return; }
  let dist = 0, dPlus = 0, dMinus = 0;
  let minEle = pts[0].ele, maxEle = pts[0].ele;
  for (let i = 1; i < pts.length; i++) {
    dist += haversine(pts[i-1], pts[i]);
    const d = pts[i].ele - pts[i-1].ele;
    if (d > 0) dPlus += d; else dMinus -= d;
    if (pts[i].ele < minEle) minEle = pts[i].ele;
    if (pts[i].ele > maxEle) maxEle = pts[i].ele;
  }
  const start = pts[0], end = pts[pts.length-1];
  console.log(`\n=== ${label} ===`);
  console.log(`  Points   : ${pts.length}`);
  console.log(`  Distance : ${(dist/1000).toFixed(2)} km`);
  console.log(`  D+       : ${dPlus.toFixed(0)} m`);
  console.log(`  D-       : ${dMinus.toFixed(0)} m`);
  console.log(`  Ele min  : ${minEle.toFixed(1)} m`);
  console.log(`  Ele max  : ${maxEle.toFixed(1)} m`);
  console.log(`  Start    : lat ${start.lat.toFixed(5)}, lon ${start.lng.toFixed(5)}`);
  console.log(`  End      : lat ${end.lat.toFixed(5)}, lon ${end.lng.toFixed(5)}`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node analyze-gpx.js <file1.gpx> [file2.gpx ...]');
  process.exit(1);
}
for (const f of args) analyzeGpx(f, path.basename(f));
