/* ═════════════════════════════════════════════════════════════════
   routes/auth.js — Authentification JWT (login, 2FA, sessions, RGPD)
   Routing only — logique dans controllers/auth.js
   (le rate-limit authLimiter est appliqué au montage dans server.js)
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/auth');

const router = express.Router();

// ── Auth de base ──
router.post('/login', ctrl.loginValidators, ctrl.login);
router.post('/register', ctrl.registerValidators, ctrl.register);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', requireAuth, ctrl.me);

// ── Équipement ──
router.post('/equipment', requireAuth, ctrl.equipmentCreateValidators, ctrl.equipmentCreate);
router.put('/equipment/:id', requireAuth, ctrl.equipmentUpdateValidators, ctrl.equipmentUpdate);
router.delete('/equipment/:id', requireAuth, ctrl.equipmentDeleteValidators, ctrl.equipmentDelete);

// ── Mot de passe + sessions ──
router.post('/change-password', requireAuth, ctrl.changePasswordValidators, ctrl.changePassword);
router.get('/sessions', requireAuth, ctrl.sessionsList);
router.delete('/sessions/:id', requireAuth, ctrl.sessionRevoke);
router.delete('/sessions', requireAuth, ctrl.sessionsRevokeAll);

// ── RGPD ──
router.delete('/account', requireAuth, ctrl.accountDeleteValidators, ctrl.accountDelete);
router.get('/export-data', requireAuth, ctrl.exportData);

// ── Réinitialisation mot de passe ──
router.post('/forgot-password', ctrl.forgotPasswordValidators, ctrl.forgotPassword);
router.post('/admin-reset/:userId', requireAuth, requireAdmin, ctrl.adminReset);
router.post('/reset-password', ctrl.resetPasswordValidators, ctrl.resetPassword);

// ── 2FA TOTP (admin) ──
router.post('/2fa/setup', requireAuth, requireAdmin, ctrl.twofaSetup);
router.post('/2fa/activate', requireAuth, requireAdmin, ctrl.twofaActivateValidators, ctrl.twofaActivate);
router.post('/2fa/disable', requireAuth, requireAdmin, ctrl.twofaDisableValidators, ctrl.twofaDisable);
router.get('/2fa/status', requireAuth, ctrl.twofaStatus);

// ── Stats perso ──
router.get('/my-stats', requireAuth, ctrl.myStats);

module.exports = router;
