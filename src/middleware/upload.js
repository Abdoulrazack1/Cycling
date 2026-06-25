// middleware/upload.js — Multer config pour GPX
//
// Cf. AUDIT item #8 : avant, ce middleware écrivait dans ./uploads/gpx/
// alors que routes/sorties.js#import-gpx écrivait dans ./asset/gpx/ et
// que sorties.gpx_filename pointait sur ./asset/gpx/. Résultat : les
// fichiers uploadés via /api/gpx n'étaient jamais utilisables.
// Maintenant tout passe par ./asset/gpx/ — une seule source de vérité.
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Dossier unique pour TOUS les GPX (uploads admin + import-gpx + bundle).
// Servi statiquement par Express via app.use(express.static(...)).
const GPX_DIR = path.join(__dirname, '..', '..', 'public', 'asset', 'gpx');
if (!fs.existsSync(GPX_DIR)) fs.mkdirSync(GPX_DIR, { recursive: true });

// L'ancien dossier ./uploads/ reste utilisable pour d'autres types
// d'uploads futurs (images, PDF, …) mais N'EST PLUS la cible des GPX.
const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Stockage GPX ─────────────────────────────────────────────
const gpxStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, GPX_DIR),
  filename: (req, file, cb) => {
    // Sanitize + timestamper le nom
    const base = path.basename(file.originalname, path.extname(file.originalname))
      .toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60);
    cb(null, `${base}.gpx`);
  }
});

// MIME types acceptés pour les uploads GPX. Le MIME n'est PAS fiable
// (le client peut envoyer ce qu'il veut), donc on cumule extension +
// MIME + sniffing du contenu réel après upload.
const GPX_MIME_TYPES = new Set([
  'application/gpx+xml',
  'application/xml',
  'text/xml',
  'application/octet-stream', // certains navigateurs n'envoient pas de MIME
  '', // certains uploads sans MIME du tout
]);

function gpxFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.gpx') {
    return cb(new Error('Extension .gpx requise'), false);
  }
  const mime = (file.mimetype || '').toLowerCase();
  if (!GPX_MIME_TYPES.has(mime)) {
    return cb(new Error(`MIME type invalide : ${file.mimetype}`), false);
  }
  cb(null, true);
}

const uploadGpx = multer({
  storage: gpxStorage,
  fileFilter: gpxFilter,
  limits: {
    fileSize: (parseInt(process.env.MAX_GPX_SIZE_MB) || 10) * 1024 * 1024,
    files: 1,
  }
});

/**
 * Vérifie que le contenu binaire ressemble à un vrai GPX (XML + balise <gpx>).
 * Le MIME peut être falsifié, l'extension renommée — seul le sniffing du
 * contenu donne une garantie raisonnable.
 *
 * @param {Buffer|string} buffer  Premiers octets du fichier (>= 200 conseillé)
 * @returns {boolean}
 */
function isLikelyGpx(buffer) {
  const head = (typeof buffer === 'string' ? buffer : buffer.toString('utf8', 0, Math.min(buffer.length, 2048)))
    .replace(/^﻿/, ''); // BOM UTF-8 éventuel
  if (!/^\s*<\?xml/i.test(head)) return false;
  if (!/<gpx\b/i.test(head)) return false;
  return true;
}

/**
 * Middleware post-multer (disque) : lit les 2 premiers Ko du fichier
 * uploadé et vérifie qu'il s'agit d'un GPX valide. Sinon le fichier est
 * supprimé et la requête est refusée avec un 400.
 *
 * À utiliser après `uploadGpx.single(...)` quand multer écrit sur disque.
 */
function validateGpxFile(req, res, next) {
  if (!req.file?.path) return next();
  try {
    const fd = fs.openSync(req.file.path, 'r');
    const buf = Buffer.alloc(2048);
    const n = fs.readSync(fd, buf, 0, 2048, 0);
    fs.closeSync(fd);
    if (!isLikelyGpx(buf.slice(0, n))) {
      // Nettoyage du fichier rejeté
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ error: 'Contenu GPX invalide (XML/<gpx> introuvable)' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Erreur de lecture du fichier uploadé' });
  }
  next();
}

// Middleware d'erreur Multer
function handleMulterError(err, req, res, next) {
  const logger = require('../lib/logger');
  if (err instanceof multer.MulterError) {
    logger.warn({ code: err.code, field: err.field }, 'multer rejected upload');
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Fichier trop volumineux (max ' + (parseInt(process.env.MAX_GPX_SIZE_MB) || 10) + ' Mo)' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Un seul fichier à la fois' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    logger.warn({ err }, 'upload rejected');
    return res.status(400).json({ error: err.message });
  }
  next();
}

module.exports = { uploadGpx, handleMulterError, validateGpxFile, isLikelyGpx, GPX_DIR };
