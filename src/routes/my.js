/* ═════════════════════════════════════════════════════════════════
   routes/my.js — Dashboard "Mon espace" pour le membre connecté
   GET  /api/my/dashboard        agrège favoris + inscriptions + recently viewed
   GET  /api/my/inscriptions     liste de toutes les inscriptions
   GET  /api/my/recent           dernières sorties consultées
   POST /api/my/recent/:sortieId track une vue (silencieux)
   ─────────────────────────────────────────────────────────────────
   Routing only — logique dans controllers/my.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/my');
const router = express.Router();

router.get('/dashboard', requireAuth, ctrl.dashboard);
router.get('/inscriptions', requireAuth, ctrl.inscriptions);
router.get('/recent', requireAuth, ctrl.recent);
router.post('/recent/:sortieId', requireAuth, ctrl.trackRecent);

module.exports = router;
