// routes/contact.js
const express = require('express');
const nodemailer = require('nodemailer');
const { query, pageClause } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { errResponse } = require('../lib/errors');
const logger = require('../lib/logger');
const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

// Échappement HTML pour insertion dans le corps du mail admin.
// Cf. AUDIT item #13 : un message de contact public sans échappement
// permettait à n'importe qui de glisser un lien de phishing dans le
// mail reçu par l'admin.
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// POST /api/contact
router.post('/', [
  body('prenom').notEmpty().trim().isLength({ max: 50 }),
  body('nom').notEmpty().trim().isLength({ max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('telephone').optional().trim().isLength({ max: 20 }).matches(/^[0-9 +\-().]*$/),
  body('sujet').notEmpty().trim().isLength({ max: 200 }),
  body('message').notEmpty().trim().isLength({ min: 10, max: 2000 })
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const { prenom, nom, email, telephone, sujet, message } = req.body;
  try {
    const result = await query(
      `INSERT INTO contacts (prenom, nom, email, telephone, sujet, message, ip_address)
       VALUES (?,?,?,?,?,?,?)`,
      [prenom, nom, email, telephone||null, sujet, message, req.ip]
    );

    // Email notification à l'admin (non-bloquant, valeurs échappées)
    if (process.env.EMAIL_ADMIN) {
      transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_ADMIN,
        subject: `[CCS Contact] ${sujet}`.slice(0, 180), // évite l'injection CRLF dans le subject
        html: `<p><b>De :</b> ${esc(prenom)} ${esc(nom)} &lt;${esc(email)}&gt;</p>
               ${telephone ? `<p><b>Tél :</b> ${esc(telephone)}</p>` : ''}
               <p><b>Sujet :</b> ${esc(sujet)}</p>
               <hr><p>${esc(message).replace(/\n/g,'<br>')}</p>
               <hr><p style="color:#888;font-size:11px;">IP : ${esc(req.ip)} · ID #${result.insertId}</p>`
      }).catch(err => logger.error({ err: err }, 'Email error:'));
    }

    res.status(201).json({ message: 'Message envoyé', id: result.insertId });
  } catch (err) {
    req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
});

// GET /api/contact (admin — liste des messages)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { statut, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT * FROM contacts WHERE 1=1';
    const params = [];
    if (statut && statut !== 'undefined' && statut !== 'null') { sql += ' AND statut = ?'; params.push(statut); }
    sql += ' ORDER BY created_at DESC' + pageClause(limit, offset, { defaultLimit: 50, maxLimit: 200 });
    const rows = await query(sql, params);
    const [{ total }] = await query('SELECT COUNT(*) AS total FROM contacts');
    res.json({ messages: rows, total });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

// PATCH /api/contact/:id/statut
router.patch('/:id/statut', requireAuth, requireAdmin, async (req, res) => {
  const { statut } = req.body;
  if (!['nouveau','lu','traite','archive'].includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  try {
    await query('UPDATE contacts SET statut=? WHERE id=?', [statut, req.params.id]);
    res.json({ message: 'Statut mis à jour' });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

module.exports = router;
