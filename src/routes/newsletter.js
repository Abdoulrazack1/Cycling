/* ═════════════════════════════════════════════════════════════════
   routes/newsletter.js — Inscription newsletter (double opt-in)
   POST /api/newsletter/subscribe   {email, source?, honeypot?}
   GET  /api/newsletter/confirm?token=XXX
   GET  /api/newsletter/unsubscribe?token=XXX
   GET  /api/newsletter/list        (admin) liste paginée
   ─────────────────────────────────────────────────────────────────
   Routing + rate-limit — logique dans controllers/newsletter.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/newsletter');

const router = express.Router();

// Anti-spam : 5 inscriptions/heure/IP (le honeypot est une 2e couche).
const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop d\'inscriptions tentées, patientez 1 h' },
});

router.post('/subscribe', subscribeLimiter, ctrl.subscribeValidators, ctrl.subscribe);
router.get('/confirm', ctrl.confirm);
router.get('/unsubscribe', ctrl.unsubscribe);
router.get('/list', requireAuth, requireAdmin, ctrl.list);

module.exports = router;
