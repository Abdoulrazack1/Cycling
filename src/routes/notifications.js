/* ═════════════════════════════════════════════════════════════════
   routes/notifications.js — Flux de notifications membres + Web Push
   GET    /api/notifications           liste paginée (latest 30)
   GET    /api/notifications/unread    count des non-lues
   POST   /api/notifications/read-all  marque tout comme lu
   POST   /api/notifications/:id/read  marque une notif comme lue
   DELETE /api/notifications/:id       supprime une notif
   POST   /api/notifications           (admin) crée une notif pour user(s)
   GET    /api/notifications/push/key  · POST .../subscribe · .../unsubscribe
   ─────────────────────────────────────────────────────────────────
   Routing only — logique dans controllers/notifications.js.
   notify()/notifyMany() sont re-exportés pour les autres modules.
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/notifications');
const router = express.Router();

router.get('/', requireAuth, ctrl.list);
router.get('/unread', requireAuth, ctrl.unread);
router.post('/read-all', requireAuth, ctrl.readAll);
router.post('/:id/read', requireAuth, ctrl.readOne);
router.delete('/:id', requireAuth, ctrl.remove);
router.post('/', requireAuth, requireAdmin, ctrl.createValidators, ctrl.createAdmin);

// Web Push
router.get('/push/key', ctrl.pushKey);
router.post('/push/subscribe', requireAuth, ctrl.pushSubscribe);
router.post('/push/unsubscribe', requireAuth, ctrl.pushUnsubscribe);

module.exports = router;
// Helpers réutilisés par d'autres modules (sorties, inscriptions, strava…)
module.exports.notify = ctrl.notify;
module.exports.notifyMany = ctrl.notifyMany;
