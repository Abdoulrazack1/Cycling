/* ═════════════════════════════════════════════════════════════════
   routes/newsletter.js — Inscription newsletter (double opt-in)
   ─────────────────────────────────────────────────────────────────
   POST /api/newsletter/subscribe   {email, source?, honeypot?}
   GET  /api/newsletter/confirm?token=XXX
   GET  /api/newsletter/unsubscribe?token=XXX
   GET  /api/newsletter/list        (admin) liste paginée
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { errResponse } = require('../lib/errors');

const router = express.Router();

// Anti-spam : 5 inscriptions/heure/IP. Le honeypot est une couche
// supplémentaire (champ "website" caché, si rempli → bot).
const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop d\'inscriptions tentées, patientez 1 h' },
});

router.post('/subscribe',
  subscribeLimiter,
  body('email').trim().toLowerCase().isEmail().withMessage('Email invalide').isLength({ max: 190 }),
  body('source').optional().isLength({ max: 40 }),
  body('honeypot').optional({ checkFalsy: true }).custom((v) => {
    // Si le champ honeypot est rempli, c'est un bot. On répond 200 quand même
    // pour ne pas leur donner d'info, mais on n'enregistre rien.
    if (v && v.length > 0) throw new Error('SPAM');
    return true;
  }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Si c'est juste le honeypot, on répond 200 silencieusement (pas d'info au bot)
      if (errors.array().some(e => e.path === 'honeypot')) {
        return res.json({ ok: true });
      }
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    try {
      const { email, source } = req.body;
      const token = crypto.randomBytes(24).toString('hex');
      const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
      const ua = (req.get('user-agent') || '').slice(0, 255);

      // Si l'email existe déjà :
      //  - confirmé → on répond OK (l'utilisateur n'a pas besoin de refaire l'action)
      //  - pas confirmé → on remet à jour le token et on renvoie le nouveau lien
      //  - désabonné → on réactive (clear unsubscribed_at + nouveau token)
      const existing = await query('SELECT id, confirmed_at, unsubscribed_at FROM newsletter_subscribers WHERE email = ?', [email]);
      if (existing.length > 0) {
        const row = existing[0];
        if (row.confirmed_at && !row.unsubscribed_at) {
          return res.json({ ok: true, status: 'already_confirmed' });
        }
        await query(
          'UPDATE newsletter_subscribers SET token=?, unsubscribed_at=NULL, source=?, ip_addr=?, user_agent=? WHERE id=?',
          [token, source || 'home', ip || null, ua || null, row.id]
        );
      } else {
        await query(
          'INSERT INTO newsletter_subscribers (email, token, source, ip_addr, user_agent) VALUES (?, ?, ?, ?, ?)',
          [email, token, source || 'home', ip || null, ua || null]
        );
      }

      // En production on enverrait un email avec le lien de confirmation.
      // En dev / sans SMTP, on renvoie le token directement pour test.
      const confirmUrl = `${req.protocol}://${req.get('host')}/api/newsletter/confirm?token=${token}`;
      try {
        const mailer = require('../services/mailer');
        if (mailer.sendMail) {
          await mailer.sendMail({
            to: email,
            subject: 'Confirmer votre inscription · C.C. Salouel',
            html: `<p>Bonjour,</p>
                   <p>Merci de votre intérêt pour le club. Cliquez sur le lien suivant pour confirmer votre inscription à la lettre :</p>
                   <p><a href="${confirmUrl}">${confirmUrl}</a></p>
                   <p>Si vous n'avez pas demandé cette inscription, ignorez ce message.</p>`,
          }).catch(() => {/* mailer absent ou dry-mode */});
        }
      } catch {/* mailer non installé */}

      res.json({
        ok: true,
        status: 'pending',
        message: 'Inscription enregistrée. Confirmez via le lien envoyé par email.',
        // Le confirmUrl n'est exposé qu'en NODE_ENV != production (utile pour les tests)
        ...(process.env.NODE_ENV !== 'production' ? { _dev_confirm_url: confirmUrl } : {}),
      });
    } catch (err) {
      req.log?.error({ err }, 'newsletter subscribe failed');
      errResponse(req, res, err, 500, 'Erreur newsletter');
    }
  }
);

router.get('/confirm', async (req, res) => {
  const token = (req.query.token || '').toString();
  if (!/^[a-f0-9]{48}$/i.test(token)) {
    return res.status(400).send('<h1>Lien invalide</h1>');
  }
  try {
    const rows = await query('SELECT id FROM newsletter_subscribers WHERE token=? AND unsubscribed_at IS NULL', [token]);
    if (!rows.length) return res.status(404).send('<h1>Lien expiré ou invalide</h1>');
    await query('UPDATE newsletter_subscribers SET confirmed_at = NOW() WHERE id=?', [rows[0].id]);
    res.send(`<!doctype html><meta charset="utf-8"><title>Inscription confirmée</title>
      <body style="font-family:system-ui;background:#0A1410;color:#EDE6D3;padding:80px 24px;text-align:center;">
        <h1 style="color:#CAA35B">Merci !</h1>
        <p>Votre inscription à la lettre du Club de Cyclisme de Salouel est confirmée.</p>
        <p><a href="/" style="color:#CAA35B">← Retour au site</a></p>
      </body>`);
  } catch (err) {
    res.status(500).send('<h1>Erreur</h1>');
  }
});

router.get('/unsubscribe', async (req, res) => {
  const token = (req.query.token || '').toString();
  if (!/^[a-f0-9]{48}$/i.test(token)) return res.status(400).send('<h1>Lien invalide</h1>');
  try {
    const rows = await query('SELECT id FROM newsletter_subscribers WHERE token=?', [token]);
    if (!rows.length) return res.status(404).send('<h1>Lien invalide</h1>');
    await query('UPDATE newsletter_subscribers SET unsubscribed_at = NOW() WHERE id=?', [rows[0].id]);
    res.send(`<!doctype html><meta charset="utf-8"><title>Désabonné</title>
      <body style="font-family:system-ui;background:#0A1410;color:#EDE6D3;padding:80px 24px;text-align:center;">
        <h1 style="color:#CAA35B">À bientôt</h1>
        <p>Vous ne recevrez plus nos lettres.</p>
        <p><a href="/" style="color:#CAA35B">← Retour au site</a></p>
      </body>`);
  } catch {
    res.status(500).send('<h1>Erreur</h1>');
  }
});

router.get('/list', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, email, source, confirmed_at, unsubscribed_at, created_at
       FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 500`
    );
    res.json({
      total: rows.length,
      confirmed: rows.filter(r => r.confirmed_at && !r.unsubscribed_at).length,
      pending:   rows.filter(r => !r.confirmed_at && !r.unsubscribed_at).length,
      subscribers: rows,
    });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur liste newsletter');
  }
});

module.exports = router;
