/**
 * scripts/convert-to-webp.js
 *
 * Convertit récursivement tous les .jpg/.jpeg/.png d'un dossier en .webp
 * (à côté du fichier original — l'original n'est PAS supprimé, ce qui
 * permet de servir un fallback via <picture><source>).
 *
 * Prérequis : npm install sharp
 * Usage :
 *   node scripts/convert-to-webp.js asset/img
 *   node scripts/convert-to-webp.js uploads --quality=85
 *   node scripts/convert-to-webp.js asset/img --force  (regénère même si .webp existe)
 *
 * Pour automatiser à l'upload, importer convertOne() depuis ce module et
 * l'appeler dans le handler Multer (cf. middleware/upload.js).
 */

'use strict';

const fs = require('fs');
const path = require('path');

let sharp;
try { sharp = require('sharp'); }
catch {
  console.error('[webp] dépendance manquante — npm install sharp');
  process.exit(2);
}

const ROOT  = process.argv[2] || 'asset/img';
const FORCE = process.argv.includes('--force');
const Q     = (() => {
  const m = (process.argv.find(a => a.startsWith('--quality=')) || '').match(/=(\d+)/);
  return m ? Math.max(1, Math.min(100, parseInt(m[1], 10))) : 82;
})();

async function convertOne(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!/\.(jpe?g|png)$/i.test(ext)) return null;
  const outPath = filePath.replace(/\.(jpe?g|png)$/i, '.webp');
  if (!FORCE && fs.existsSync(outPath)) return { skipped: outPath };
  await sharp(filePath).webp({ quality: Q }).toFile(outPath);
  const inBytes  = fs.statSync(filePath).size;
  const outBytes = fs.statSync(outPath).size;
  return { src: filePath, out: outPath, in: inBytes, out_bytes: outBytes, saved: inBytes - outBytes };
}

async function walk(dir, results) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { await walk(full, results); continue; }
    if (entry.isFile()) {
      try {
        const r = await convertOne(full);
        if (r) results.push(r);
      } catch (err) {
        console.warn(`[webp] échec ${full} :`, err.message);
      }
    }
  }
}

(async () => {
  if (!fs.existsSync(ROOT)) {
    console.error(`[webp] dossier introuvable : ${ROOT}`);
    process.exit(1);
  }
  console.log(`[webp] conversion ${ROOT} (quality=${Q}${FORCE ? ', force' : ''})`);
  const results = [];
  await walk(ROOT, results);
  const converted = results.filter(r => !r.skipped);
  const skipped = results.filter(r => r.skipped).length;
  const totalSaved = converted.reduce((s, r) => s + r.saved, 0);
  console.log(`[webp] ${converted.length} converti(s), ${skipped} ignoré(s) (.webp déjà présent)`);
  if (converted.length) {
    console.log(`[webp] gain total : ${(totalSaved / 1024).toFixed(1)} Ko`);
  }
})().catch(err => { console.error('[webp] échec :', err); process.exit(1); });

module.exports = { convertOne };
