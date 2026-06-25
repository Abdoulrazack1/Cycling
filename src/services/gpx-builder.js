/**
 * services/gpx-builder.js
 * 
 * Construit un fichier GPX 1.1 valide à partir d'un tracé + métadonnées.
 */

const fs = require('fs');
const path = require('path');

/**
 * @param {object} meta - { name, desc, region }
 * @param {Array<{lat,lng,ele?}>} points
 * @returns {string} contenu GPX
 */
function build(meta, points) {
  const now = new Date().toISOString();
  const trkpts = points.map(p => {
    const ele = p.ele != null ? `<ele>${p.ele.toFixed(1)}</ele>` : '';
    return `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">${ele}</trkpt>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="C.C. Salouel — auto-generator"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(meta.name || 'Course')}</name>
    <desc>${escapeXml(meta.desc || '')}</desc>
    <time>${now}</time>
  </metadata>
  <trk>
    <name>${escapeXml(meta.name || 'Course')}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

/**
 * Sauvegarde un GPX dans asset/gpx/<id>.gpx
 * @param {string} id - identifiant (sans extension)
 * @param {string} content - contenu GPX
 * @returns {string} chemin absolu du fichier
 */
function save(id, content) {
  const safeId = String(id).replace(/[^a-z0-9_-]/gi, '-');
  const dir = path.join(__dirname, '..', '..', 'public', 'asset', 'gpx');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, safeId + '.gpx');
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { build, save };
