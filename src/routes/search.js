/* ═════════════════════════════════════════════════════════════════
   routes/search.js — Recherche globale (palette Cmd+K)
   GET /api/search?q=...   → { results: [{type, id, title, subtitle, url}] }
   Routing only — logique dans controllers/search.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const ctrl = require('../controllers/search');
const router = express.Router();

router.get('/', ctrl.search);

module.exports = router;
