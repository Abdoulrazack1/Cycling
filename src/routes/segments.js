/* ═════════════════════════════════════════════════════════════════
   routes/segments.js — Segments KOM (lecture publique + CRUD admin)
   GET    /api/segments        liste paginée + filtre par sortie_id
   POST   /api/segments        création (admin)
   PUT    /api/segments/:id    édition (admin)
   DELETE /api/segments/:id    suppression (admin)
   ─────────────────────────────────────────────────────────────────
   Routing only — logique dans controllers/segments.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/segments');
const router = express.Router();

router.get('/', ctrl.list);
router.post('/', requireAuth, requireAdmin, ctrl.create);
router.put('/:id', requireAuth, requireAdmin, ctrl.update);
router.delete('/:id', requireAuth, requireAdmin, ctrl.remove);

module.exports = router;
