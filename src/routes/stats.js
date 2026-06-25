/* ═════════════════════════════════════════════════════════════════
   routes/stats.js — Statistiques agrégées publiques
   Endpoint léger pour alimenter les chiffres (home, footer, "À propos").
   Routing only — logique dans controllers/stats.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const ctrl = require('../controllers/stats');
const router = express.Router();

router.get('/', ctrl.get);
router.post('/flush', ctrl.flush);

module.exports = router;
