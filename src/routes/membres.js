/* ═════════════════════════════════════════════════════════════════
   routes/membres.js — Annuaire + profil des sociétaires
   GET   /api/membres                  liste publique active
   GET   /api/membres/:id              fiche publique + équipement
   PUT   /api/membres/:id              édition (self ou admin)
   GET   /api/membres/me/dashboard     stats perso : rang, club avg, à venir
   PATCH /api/membres/:id/actif        désactivation (admin)
   PATCH /api/membres/:id/role         changement de rôle (admin)
   ─────────────────────────────────────────────────────────────────
   Routing only — logique dans controllers/membres.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/membres');
const router = express.Router();

router.get('/', optionalAuth, ctrl.list);
router.get('/me/dashboard', requireAuth, ctrl.myDashboard);
router.get('/:id', optionalAuth, ctrl.getOne);
router.put('/:id', requireAuth, ctrl.updateValidators, ctrl.update);
router.patch('/:id/actif', requireAuth, requireAdmin, ctrl.setActifValidators, ctrl.setActif);
router.patch('/:id/role', requireAuth, requireAdmin, ctrl.setRoleValidators, ctrl.setRole);

module.exports = router;
