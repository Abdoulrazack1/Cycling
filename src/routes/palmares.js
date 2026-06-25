/* ═════════════════════════════════════════════════════════════════
   routes/palmares.js — Palmarès (résultats de course)
   GET    /api/palmares        liste + filtres (annee, membre_id)
   POST   /api/palmares        ajout d'un résultat (modo+)
   PUT    /api/palmares/:id    édition (modo+)
   DELETE /api/palmares/:id    suppression (admin)
   ─────────────────────────────────────────────────────────────────
   Routing + validators — logique dans controllers/palmares.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin, requireModo } = require('../middleware/auth');
const ctrl = require('../controllers/palmares');
const router = express.Router();

router.get('/', ctrl.list);
router.post('/', requireAuth, requireModo, ctrl.createValidators, ctrl.create);
router.put('/:id', requireAuth, requireModo, ctrl.updateValidators, ctrl.update);
router.delete('/:id', requireAuth, requireAdmin, ctrl.remove);

module.exports = router;
