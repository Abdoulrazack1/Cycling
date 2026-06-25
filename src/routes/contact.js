/* ═════════════════════════════════════════════════════════════════
   routes/contact.js — Formulaire de contact public + boîte admin
   POST   /api/contact              soumission du formulaire (rate-limited)
   GET    /api/contact              boîte de réception (admin)
   PATCH  /api/contact/:id/statut   nouveau / lu / traité / archive
   ─────────────────────────────────────────────────────────────────
   Routing + validators — logique dans controllers/contact.js
   (le rate-limit contactLimiter est appliqué au montage dans server.js)
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/contact');
const router = express.Router();

router.post('/', ctrl.submitValidators, ctrl.submit);
router.get('/', requireAuth, requireAdmin, ctrl.inbox);
router.patch('/:id/statut', requireAuth, requireAdmin, ctrl.updateStatut);

module.exports = router;
