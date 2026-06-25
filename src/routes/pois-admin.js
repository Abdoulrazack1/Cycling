/* ═════════════════════════════════════════════════════════════════
   routes/pois-admin.js — Vue cross-sortie des POIs (panel admin)
   GET    /api/pois            liste tous les POIs + sortie associée
   DELETE /api/pois/:id        suppression individuelle (admin)
   ─────────────────────────────────────────────────────────────────
   Routing only — logique dans controllers/pois-admin.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/pois-admin');
const router = express.Router();

router.get('/', requireAuth, requireAdmin, ctrl.list);
router.delete('/:id', requireAuth, requireAdmin, ctrl.remove);

module.exports = router;
