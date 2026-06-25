/* ═════════════════════════════════════════════════════════════════
   routes/auto-courses.js — Scraping + génération automatique de courses
   (tous admin-only)
   GET  /api/auto-courses/sources    sources de scraping configurées
   GET  /api/auto-courses/scrape     scrape sans insérer (preview)
   POST /api/auto-courses/generate   génère une course (OSRM+élévation+GPX+POIs)
   POST /api/auto-courses/import     import en masse depuis un scraping
   GET  /api/auto-courses/:id        état d'une course auto-générée
   ─────────────────────────────────────────────────────────────────
   Routing only — logique dans controllers/auto-courses.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/auto-courses');

const router = express.Router();

router.get('/sources', requireAuth, requireAdmin, ctrl.sources);
router.get('/scrape', requireAuth, requireAdmin, ctrl.scrape);
router.post('/generate', requireAuth, requireAdmin, ctrl.generate);
router.post('/import', requireAuth, requireAdmin, ctrl.importEvents);
router.get('/:id', requireAuth, requireAdmin, ctrl.getOne);

module.exports = router;
