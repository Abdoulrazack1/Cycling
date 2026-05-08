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
const GPX_DIR = path.join(__dirname, '..', 'asset', 'gpx');
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
      return res.status(413).json({ error: 'Fichier trop volumineux (max ' + (parseInt(process.env.MAX_GPX_SIZE_MB) || 10) + ' Mo)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
}

module.exports = { uploadGpx, handleMulterError, GPX_DIR };
