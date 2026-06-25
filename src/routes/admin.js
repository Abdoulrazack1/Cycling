/* ═════════════════════════════════════════════════════════════════
   routes/admin.js — Endpoints d'administration (admin role only)
   GET    /scraper-health · GET /metrics · GET /audit · POST /audit/purge
   GET/POST/DELETE /strava-config · GET /dashboard-live · POST /broadcast
   GET/POST /maintenance · PATCH /users/bulk
   ─────────────────────────────────────────────────────────────────
   Routing only — logique dans controllers/admin.js
   (le rate-limit adminLimiter est appliqué au montage dans server.js)
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/admin');
const router = express.Router();

// Toutes les routes admin exigent requireAuth + requireAdmin.
router.use(requireAuth, requireAdmin);

router.get('/scraper-health', ctrl.scraperHealth);
router.get('/metrics', ctrl.metrics);
router.get('/audit', ctrl.auditList);
router.post('/audit/purge', ctrl.auditPurge);

router.get('/strava-config', ctrl.getStravaConfig);
router.post('/strava-config', ctrl.setStravaConfigValidators, ctrl.setStravaConfig);
router.delete('/strava-config', ctrl.deleteStravaConfig);

router.get('/dashboard-live', ctrl.dashboardLive);
router.post('/broadcast', ctrl.broadcastValidators, ctrl.broadcast);

router.get('/maintenance', ctrl.getMaintenance);
router.post('/maintenance', ctrl.setMaintenanceValidators, ctrl.setMaintenance);

router.patch('/users/bulk', ctrl.usersBulkValidators, ctrl.usersBulk);

module.exports = router;
