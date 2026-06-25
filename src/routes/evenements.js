/* ═════════════════════════════════════════════════════════════════
   routes/evenements.js — Événements + inscriptions
   GET    /api/evenements                liste paginée + filtres
   GET    /api/evenements/:id/ical       export iCalendar (.ics)
   GET    /api/evenements/:id            détail + inscrits
   POST   /api/evenements                création (modo+)
   PUT    /api/evenements/:id            édition (modo+)
   DELETE /api/evenements/:id            suppression (admin)
   POST   /api/evenements/:id/inscrire   inscription publique (mail confirm)
   POST   /api/evenements/inscriptions/purge   purge RGPD événements terminés
   ─────────────────────────────────────────────────────────────────
   Routing only — logique dans controllers/evenements.js
   (le rate-limit inscriptionLimiter est appliqué au montage dans server.js)
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin, requireModo, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/evenements');
const router = express.Router();

router.get('/', ctrl.list);
router.get('/:id/ical', ctrl.ical);
router.get('/:id', ctrl.getOne);
router.post('/', requireAuth, requireModo, ctrl.createValidators, ctrl.create);
router.put('/:id', requireAuth, requireModo, ctrl.updateValidators, ctrl.update);
router.delete('/:id', requireAuth, requireAdmin, ctrl.remove);
router.post('/:id/inscrire', optionalAuth, ctrl.inscrireValidators, ctrl.inscrire);
router.post('/inscriptions/purge', requireAuth, requireAdmin, ctrl.purge);

module.exports = router;
