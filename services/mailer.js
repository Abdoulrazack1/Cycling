/* ═════════════════════════════════════════════════════════════════
   services/mailer.js — Service mail transactionnel centralisé
   ─────────────────────────────────────────────────────────────────
   Toutes les routes qui envoient un mail importent ce module au
   lieu de recréer un transporter nodemailer chacune.

   Variables d'env (.env) :
     SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
     EMAIL_FROM    expéditeur affiché
     EMAIL_ADMIN   destinataire des alertes système

   Si aucun SMTP_HOST n'est défini, les mails sont seulement loggués
   (mode "dry") — pratique en dev pour ne pas spammer.
   ═════════════════════════════════════════════════════════════════ */

const nodemailer = require('nodemailer');
const logger     = require('../lib/logger');


// ─── Constantes ────────────────────────────────────────────────────
const FROM      = process.env.EMAIL_FROM  || 'C.C. Salouel <noreply@club-salouel.fr>';
const ADMIN_TO  = process.env.EMAIL_ADMIN || null;
const SITE_NAME = 'Club de Cyclisme de Salouel';


// ─── Transporter (lazy + cached) ───────────────────────────────────
let _transporter = null;

function _getTransporter() {
  if (_transporter) return _transporter;
  if (!process.env.SMTP_HOST) return null;

  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth:   (process.env.SMTP_USER && process.env.SMTP_PASS)
              ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
              : undefined,
  });
  return _transporter;
}


// ═════════════════════════════════════════════════════════════════
// TEMPLATE HTML — wrapper email avec en-tête + footer cohérents
// ═════════════════════════════════════════════════════════════════

function _wrap(html, title) {
  // Template HTML minimal, sobre, brand cohérente.
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0c1714;font-family:Georgia,serif;color:#ede6d3;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c1714;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#13211c;border:1px solid #2a3a32;max-width:600px;width:100%;">
        <tr><td style="padding:32px 36px 24px;border-bottom:1px solid #2a3a32;">
          <div style="font-style:italic;font-size:13px;color:#b08e4a;letter-spacing:.16em;text-transform:uppercase;">${SITE_NAME}</div>
          <h1 style="font-size:24px;color:#ede6d3;margin:8px 0 0;font-weight:400;">${title}</h1>
        </td></tr>
        <tr><td style="padding:24px 36px;font-size:15px;line-height:1.62;color:#c0bfaa;">
          ${html}
        </td></tr>
        <tr><td style="padding:18px 36px;border-top:1px solid #2a3a32;font-size:11px;color:#7a7864;letter-spacing:.05em;">
          ${SITE_NAME} · Salouel · 80480 · ${new Date().getFullYear()}<br>
          Cet email est généré automatiquement. Si vous l'avez reçu par erreur, ignorez-le.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Envoi générique. Retourne { ok, messageId? } ou { ok:false, error }.
 * Si SMTP non configuré, log seulement.
 */

// ═════════════════════════════════════════════════════════════════
// SEND — envoi générique avec fallback dry-mode
// ═════════════════════════════════════════════════════════════════

async function sendMail({ to, subject, html, text, from }) {
  if (!to) return { ok: false, error: 'to manquant' };
  const transporter = _getTransporter();
  if (!transporter) {
    logger.info({ to, subject }, '[mailer] SMTP non configuré — mail simulé (dry)');
    return { ok: true, dry: true };
  }
  try {
    const info = await transporter.sendMail({
      from: from || FROM,
      to,
      subject,
      html: html ? _wrap(html, subject) : undefined,
      text: text || (html ? html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : undefined),
    });
    logger.info({ to, subject, messageId: info.messageId }, '[mailer] envoyé');
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    logger.error({ err: err.message, to, subject }, '[mailer] échec');
    return { ok: false, error: err.message };
  }
}


// ═════════════════════════════════════════════════════════════════
// TEMPLATES — emails transactionnels prêts à l'emploi
// ═════════════════════════════════════════════════════════════════

async function sendInscriptionConfirmation({ to, prenom, evenementTitle, evenementDate, lieu }) {
  const dateStr = evenementDate
    ? new Date(evenementDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'date à confirmer';
  const html = `
    <p>Bonjour <strong>${prenom || ''}</strong>,</p>
    <p>Votre inscription à l'événement <strong>${evenementTitle}</strong> est confirmée.</p>
    <ul>
      <li><strong>Date :</strong> ${dateStr}</li>
      ${lieu ? `<li><strong>Lieu :</strong> ${lieu}</li>` : ''}
    </ul>
    <p>Vous recevrez un rappel 48 h avant l'événement.</p>
    <p>À très vite,<br>Le bureau du Club</p>`;
  return sendMail({ to, subject: `Inscription confirmée — ${evenementTitle}`, html });
}

async function sendSortieCancellation({ to, prenom, sortieTitle, sortieDate, reason }) {
  const dateStr = sortieDate
    ? new Date(sortieDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const html = `
    <p>Bonjour <strong>${prenom || ''}</strong>,</p>
    <p>La sortie prévue ${dateStr ? 'le <strong>' + dateStr + '</strong> ' : ''}— <strong>${sortieTitle}</strong> — est <strong style="color:#c08080;">annulée</strong>.</p>
    ${reason ? `<p><em>Motif :</em> ${reason}</p>` : ''}
    <p>Le calendrier sera mis à jour sur le site et un mail de remplacement vous sera envoyé si une date de report est arrêtée.</p>
    <p>Bonnes routes,<br>Le bureau du Club</p>`;
  return sendMail({ to, subject: `Sortie annulée — ${sortieTitle}`, html });
}

async function sendPasswordReset({ to, prenom, resetUrl, expiresMinutes = 60 }) {
  const html = `
    <p>Bonjour <strong>${prenom || ''}</strong>,</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe sur le site du Club.</p>
    <p><a href="${resetUrl}" style="display:inline-block;background:#b08e4a;color:#0c1714;padding:12px 24px;text-decoration:none;font-weight:500;">Réinitialiser mon mot de passe</a></p>
    <p>Ou copiez ce lien dans votre navigateur :<br>
    <code style="background:#0c1714;padding:6px 8px;font-size:12px;">${resetUrl}</code></p>
    <p>Ce lien expire dans <strong>${expiresMinutes} minutes</strong>. Si vous n'avez pas fait cette demande, ignorez ce mail.</p>`;
  return sendMail({ to, subject: 'Réinitialisation de votre mot de passe', html });
}

async function sendAdminAlert({ subject, message }) {
  if (!ADMIN_TO) return { ok: false, error: 'EMAIL_ADMIN non configuré' };
  return sendMail({ to: ADMIN_TO, subject: `[CCS] ${subject}`, html: `<p>${message}</p>` });
}

module.exports = {
  sendMail,
  sendInscriptionConfirmation,
  sendSortieCancellation,
  sendPasswordReset,
  sendAdminAlert,
  isConfigured: () => !!process.env.SMTP_HOST,
};
