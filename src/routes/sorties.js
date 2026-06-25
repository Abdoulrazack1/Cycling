/* ═════════════════════════════════════════════════════════════════
   routes/sorties.js — CRUD complet des sorties (+ GPX, photos, POIs)
   Routing only — logique dans controllers/sorties.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin, requireModo } = require('../middleware/auth');
const ctrl = require('../controllers/sorties');

const router = express.Router();

// ── CRUD ──
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', requireAuth, requireModo, ctrl.createValidators, ctrl.create);
router.put('/:id', requireAuth, requireModo, ctrl.updateValidators, ctrl.update);
router.delete('/:id', requireAuth, requireAdmin, ctrl.remove);

// ── Photos ──
router.get('/:id/photos', ctrl.photosList);
router.post('/:id/photos', requireAuth, requireModo, ctrl.uploadPhotos, ctrl.photosUpload);
router.delete('/:id/photos/:photoId', requireAuth, requireModo, ctrl.photoDelete);

// ── GPX / cue-sheet / diagnostic (admin) ──
router.post('/cue-from-text', requireAuth, requireAdmin, ctrl.cueFromText);
router.post('/preview-gpx', requireAuth, requireAdmin, ctrl.uploadGpxPreview, ctrl.previewGpx);
router.post('/import-gpx', requireAuth, requireAdmin, ctrl.uploadGpxImport, ctrl.importGpx);
router.get('/orphan-gpx/list', requireAuth, requireAdmin, ctrl.orphanGpxList);
router.get('/:id/diagnose', requireAuth, requireAdmin, ctrl.diagnose);

module.exports = router;
