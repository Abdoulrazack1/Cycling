/* ═════════════════════════════════════════════════════════════════
   routes/club.js — Paramètres généraux du club (key-value)
   GET  /api/club          lecture des paramètres (publique)
   PUT  /api/club          mise à jour groupée (admin uniquement)
   ─────────────────────────────────────────────────────────────────
   Routing only — la logique est dans controllers/club.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/club');
const router = express.Router();

router.get('/', ctrl.get);
router.put('/', requireAuth, requireAdmin, ctrl.update);

module.exports = router;
