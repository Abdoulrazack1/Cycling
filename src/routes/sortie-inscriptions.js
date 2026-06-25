/* ═════════════════════════════════════════════════════════════════
   routes/sortie-inscriptions.js — Inscription 1-clic membre à une sortie
   (monté sur /api/sorties/:id, mergeParams)
   GET    /inscriptions          liste des inscrits (public)
   GET    /inscription/me        statut d'inscription du user courant
   POST   /inscription           inscription 1-clic (member-only)
   PATCH  /inscription/:userId   modif statut (admin)
   DELETE /inscription           désinscription
   ─────────────────────────────────────────────────────────────────
   Routing only — logique dans controllers/sortie-inscriptions.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/sortie-inscriptions');

const router = express.Router({ mergeParams: true });

router.get('/inscriptions', ctrl.listInscrits);
router.get('/inscription/me', requireAuth, ctrl.getMyStatus);
router.post('/inscription', requireAuth, ctrl.registerValidators, ctrl.register);
router.patch('/inscription/:userId', requireAuth, requireAdmin, ctrl.adminPatchValidators, ctrl.adminPatch);
router.delete('/inscription', requireAuth, ctrl.unregister);

module.exports = router;
