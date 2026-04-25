// middleware/upload.js — Multer config pour GPX et images
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';
const GPX_DIR     = path.join(UPLOADS_DIR, 'gpx');

// Créer les dossiers si inexistants
[UPLOADS_DIR, GPX_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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

function gpxFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.gpx') {
    return cb(new Error('Seuls les fichiers .gpx sont acceptés'), false);
  }
  cb(null, true);
}

const uploadGpx = multer({
  storage: gpxStorage,
  fileFilter: gpxFilter,
  limits: { fileSize: (parseInt(process.env.MAX_GPX_SIZE_MB) || 10) * 1024 * 1024 }
});

// Middleware d'erreur Multer
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Fichier trop volumineux (max 10 Mo)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
}

module.exports = { uploadGpx, handleMulterError, GPX_DIR };
