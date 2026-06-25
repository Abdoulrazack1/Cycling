/* ═════════════════════════════════════════════════════════════════
   routes/strava.js — Intégration Strava (OAuth + sync activités)
   GET    /status · /connect · /callback · /preview-sync · /activities
          /stats · /my-routes · /webhook (challenge)
   POST   /disconnect · /sync · /import-route/:routeId
          /import-activity/:activityId · /webhook · /resync/:activityId
   ─────────────────────────────────────────────────────────────────
   Routing only — logique dans controllers/strava.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/strava');

const router = express.Router();

router.get('/status', requireAuth, ctrl.status);
router.get('/connect', requireAuth, ctrl.connect);
router.get('/callback', ctrl.callback);
router.post('/disconnect', requireAuth, ctrl.disconnect);
router.get('/preview-sync', requireAuth, ctrl.previewSync);
router.post('/sync', requireAuth, ctrl.sync);
router.get('/activities', requireAuth, ctrl.activities);
router.get('/stats', requireAuth, ctrl.stats);
router.get('/my-routes', requireAuth, ctrl.myRoutes);
router.post('/import-route/:routeId', requireAuth, ctrl.importRoute);
router.post('/import-activity/:activityId', requireAuth, ctrl.importActivity);

// Webhook Strava (pas d'auth — vérifié par verify_token / subscription_id)
router.get('/webhook', ctrl.webhookVerify);
router.post('/webhook', ctrl.webhookEvent);

router.post('/resync/:activityId', requireAuth, ctrl.resync);

module.exports = router;
