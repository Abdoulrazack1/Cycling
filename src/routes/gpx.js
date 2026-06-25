/* ═════════════════════════════════════════════════════════════════
   routes/gpx.js — Upload + listing des fichiers GPX
   GET    /api/gpx                 liste les .gpx présents sur disque
   POST   /api/gpx/upload          upload (modo+), multer disque
   GET    /api/gpx/:filename       sert un fichier GPX
   DELETE /api/gpx/:filename       suppression (admin)
   ─────────────────────────────────────────────────────────────────
   Routing + middlewares multer — logique dans controllers/gpx.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadGpx, handleMulterError, validateGpxFile } = require('../middleware/upload');
const ctrl = require('../controllers/gpx');

const router = express.Router();

router.post('/upload',
  requireAuth, requireAdmin,
  uploadGpx.single('gpx'),
  handleMulterError,
  validateGpxFile,     // sniffing du contenu (Brief B4)
  ctrl.upload
);
router.get('/', requireAuth, requireAdmin, ctrl.list);
router.get('/:filename', ctrl.serve);
router.delete('/:filename', requireAuth, requireAdmin, ctrl.remove);

module.exports = router;
