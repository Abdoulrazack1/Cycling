// routes/auth.js — Authentification complète JWT
const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const otp      = require('otplib');
const qrcode   = require('qrcode');
const { query, withTransaction } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { audit } = require('../services/audit-log');
const logger = require('../lib/logger');

// otplib v13 API : on construit notre propre wrapper compatible avec
// la signature attendue côté code consommateur (verify/generateSecret/keyuri).
// v13 a TOUT changé : generate/verify sont async (Promise), versions sync
// = *Sync, verify renvoie { valid, delta, epoch, timeStep }, URI utilise
// `label` au lieu de `account`.
const TOTP_OPTS = { algorithm: 'sha1', digits: 6, period: 30 };
const totpLib = {
  generateSecret: () => otp.generateSecret({ algorithm: 'sha1' }),
  verify: ({ token, secret }) => {
    try {
      // Vérifier le code courant + ±1 fenêtre (manuel : v13 n'expose plus de window)
      const opts = TOTP_OPTS;
      const now = Math.floor(Date.now() / 1000);
      for (const delta of [0, -opts.period, opts.period]) {
        const r = otp.verifySync({ token, secret, options: opts, time: now + delta });
        if (r?.valid) return true;
      }
      return false;
    } catch { return false; }
  },
  keyuri: (account, issuer, secret) =>
    otp.generateURI({ label: account, issuer, secret, options: TOTP_OPTS }),
};

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────
// Politique de durée de vie (cf. AUDIT item #7) :
//   - access  : 15 min (court → limite l'impact d'un vol de token)
//   - refresh : 30 j  (équilibre confort utilisateur / risque)
//
// Surchargeable via JWT_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN dans .env,
// mais PAS de fallback géant ('365d') qui mémait l'ancienne version :
// si l'env est mal configuré, autant que ce soit visible tout de suite.
const ACCESS_TTL  = process.env.JWT_EXPIRES_IN         || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
// Durée DB du refresh token : doit matcher le TTL JWT pour rester cohérent.
// On stocke en jours pour le INSERT (Date math). Si TTL custom non-jours,
// fallback raisonnable à 30 j.
const REFRESH_DB_DAYS = (() => {
  const m = REFRESH_TTL.match(/^(\d+)d$/);
  return m ? parseInt(m[1], 10) : 30;
})();

function signAccess(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { sub: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TTL }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Options de cookie en mode same-origin.
 *
 * Politique : frontend et API sont servis depuis la même origine
 * (Express en dev, nginx reverse-proxy en prod), donc on peut utiliser
 * sameSite: 'strict' — le cookie n'est jamais envoyé cross-site, ce qui
 * supprime toute surface CSRF résiduelle.
 *
 *  - httpOnly : pas d'accès JS au refresh token (protection XSS)
 *  - secure   : true en prod (HTTPS obligatoire), false en dev HTTP local
 *  - sameSite : 'strict' (plus de cross-origin possible)
 *  - path     : '/'
 *  - pas de domain : implicite = host courant (évite le partage de cookies
 *                    accidentel entre sous-domaines)
 */
function cookieOpts(rememberMe = true) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    ...(rememberMe ? { maxAge: REFRESH_DB_DAYS * 24 * 3600 * 1000 } : {})
  };
}

function clearCookieOpts() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/'
  };
}

function userPublic(u) {
  return {
    id: u.id, numero: u.numero, username: u.username,
    email: u.email, prenom: u.prenom, nom: u.nom, role: u.role,
    bio: u.bio, ftp_w: u.ftp_w, km_saison: u.km_saison,
    elevation_saison: u.elevation_saison, licence_ffc: u.licence_ffc,
    annee_adhesion: u.annee_adhesion, avatar_initial: u.avatar_initial
  };
}

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', [
  body('login').notEmpty().trim(),
  body('password').notEmpty(),
  body('totp').optional().isString(),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const { login, password, remember, totp } = req.body;
  const rememberMe = remember !== false; // par défaut on persiste 7 jours
  try {
    const [user] = await query(
      `SELECT * FROM users WHERE (email = ? OR username = ?) AND actif = TRUE`,
      [login, login]
    );
    if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

    // ── 2FA TOTP (Brief D2) — challenge si activé sur ce compte ──
    if (user.totp_enabled && user.totp_secret) {
      if (!totp) {
        // Pas de code fourni → demander à l'app
        return res.status(401).json({ error: 'TOTP requis', mfa_required: true });
      }
      const code = String(totp).trim();
      let mfaOk = false;
      // Tenter d'abord un code TOTP standard
      if (/^\d{6}$/.test(code)) {
        try { mfaOk = totpLib.verify({ token: code, secret: user.totp_secret }); } catch {}
      }
      // Sinon, essayer un code de récupération (8 caractères alphanum)
      if (!mfaOk && /^[a-z0-9]{8,12}$/i.test(code) && user.totp_backup_codes) {
        const backup = (typeof user.totp_backup_codes === 'string')
          ? JSON.parse(user.totp_backup_codes) : user.totp_backup_codes;
        const codeHash = crypto.createHash('sha256').update(code.toLowerCase()).digest('hex');
        const idx = backup.indexOf(codeHash);
        if (idx >= 0) {
          mfaOk = true;
          // Consumer le code (one-time use)
          backup.splice(idx, 1);
          await query('UPDATE users SET totp_backup_codes = ? WHERE id = ?', [JSON.stringify(backup), user.id]);
          req.user = { id: user.id, username: user.username };
          audit(req, 'login', 'user', user.id, { method: 'totp-backup-code', remaining: backup.length });
        }
      }
      if (!mfaOk) {
        logger.warn({ userId: user.id, ip: req.ip }, '2FA verification failed');
        return res.status(401).json({ error: 'Code 2FA invalide', mfa_required: true });
      }
    }

    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);

    // Stocker le refresh token (hashé)
    const expiresAt = new Date(Date.now() + REFRESH_DB_DAYS * 24 * 3600 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, hashToken(refreshToken), expiresAt]
    );

    // Cookie httpOnly pour le refresh token (sameSite: lax en dev, none en prod)
    res.cookie('refreshToken', refreshToken, cookieOpts(rememberMe));

    // Audit avec user injecté à la main (audit() lit req.user pour user_id/username)
    req.user = { id: user.id, username: user.username };
    audit(req, 'login', 'user', user.id, { rememberMe });

    res.json({
      accessToken,
      user: userPublic(user)
    });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[auth]');
    res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) });
  }
});

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', [
  body('username').isLength({ min: 3, max: 30 }).trim().matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, points, tirets et underscores'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('prenom').notEmpty().trim().isLength({ max: 50 }),
  body('nom').notEmpty().trim().isLength({ max: 50 })
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    const arr = errs.array();
    return res.status(400).json({
      error: arr.map(e => `${e.path || e.param}: ${e.msg}`).join(' · '),
      errors: arr
    });
  }

  const { username, email, password, prenom, nom, licence_ffc, annee_adhesion } = req.body;
  try {
    // Vérifier unicité
    const [existing] = await query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    if (existing) return res.status(409).json({ error: 'Email ou nom d\'utilisateur déjà pris' });

    const hash = await bcrypt.hash(password, 12);

    // Numéro automatique
    const [maxRow] = await query('SELECT MAX(numero) as m FROM users');
    const numero = (maxRow?.m || 0) + 1;

    const result = await query(
      `INSERT INTO users (numero, username, email, password_hash, prenom, nom, licence_ffc, annee_adhesion, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'membre')`,
      [numero, username, email, hash, prenom, nom, licence_ffc || null, annee_adhesion || null]
    );

    const [user] = await query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);

    const expiresAt = new Date(Date.now() + REFRESH_DB_DAYS * 24 * 3600 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, hashToken(refreshToken), expiresAt]
    );

    res.cookie('refreshToken', refreshToken, cookieOpts(true));

    res.status(201).json({ accessToken, user: userPublic(user) });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[register]');
    res.status(500).json({ error: 'Erreur lors de l\'inscription : ' + (err.sqlMessage || err.message) });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────
// Rotation : on supprime l'ancien token DB et on en émet un nouveau.
// Sécurité supplémentaire — détection de réutilisation :
//   Si le JWT est valide MAIS le hash n'est plus en base, ça veut dire
//   qu'il a déjà été rotaté. Deux scénarios :
//    (a) bug réseau → l'utilisateur a un ancien cookie tournant
//    (b) compromission → un attaquant a volé le cookie et l'utilise
//        après que la victime a rafraîchi (ou inversement).
//   Dans le doute, on invalide TOUTES les sessions de cet utilisateur
//   et on logge l'incident (Brief refresh-rotation).
router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'Refresh token manquant' });

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    // Vérifier en BDD
    const [stored] = await query(
      'SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW() AND user_id = ?',
      [hashToken(token), payload.sub]
    );
    if (!stored) {
      // JWT valide mais hash absent → réutilisation potentielle. Wipe + audit.
      await query('DELETE FROM refresh_tokens WHERE user_id = ?', [payload.sub]);
      req.user = { id: payload.sub };
      audit(req, 'logout', 'user', payload.sub, { reason: 'refresh-token-reuse-detected' });
      logger.warn({ userId: payload.sub, ip: req.ip }, 'refresh token reuse — all sessions wiped');
      res.clearCookie('refreshToken', clearCookieOpts());
      return res.status(401).json({ error: 'Session invalidée par sécurité — reconnectez-vous' });
    }

    const [user] = await query(
      'SELECT * FROM users WHERE id = ? AND actif = TRUE',
      [payload.sub]
    );
    if (!user) return res.status(401).json({ error: 'Compte invalide' });

    // Rotation atomique : DELETE + INSERT dans la même transaction pour
    // éviter de perdre la session si le serveur crashe entre les deux.
    const newRefresh = signRefresh(user);
    const expiresAt  = new Date(Date.now() + REFRESH_DB_DAYS * 24 * 3600 * 1000);

    await withTransaction(async (conn) => {
      await conn.execute('DELETE FROM refresh_tokens WHERE id = ?', [stored.id]);
      await conn.execute(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [user.id, hashToken(newRefresh), expiresAt]
      );
    });

    res.cookie('refreshToken', newRefresh, cookieOpts(true));

    res.json({ accessToken: signAccess(user), user: userPublic(user) });
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', async (req, res) => {
  const token = req.cookies?.refreshToken;
  let userId = null, username = null;
  if (token) {
    // Récupérer user_id + username avant suppression pour l'audit
    const [row] = await query(
      `SELECT rt.user_id, u.username
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = ?`,
      [hashToken(token)]
    );
    if (row) { userId = row.user_id; username = row.username; }
    await query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hashToken(token)]);
  }
  res.clearCookie('refreshToken', clearCookieOpts());
  if (userId) {
    req.user = { id: userId, username };
    audit(req, 'logout', 'user', userId);
  }
  res.json({ message: 'Déconnecté' });
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [user] = await query(
      `SELECT u.*, 
        JSON_ARRAYAGG(JSON_OBJECT('num', e.num, 'titre', e.titre, 'description', e.description))
          AS equipment
       FROM users u
       LEFT JOIN user_equipment e ON e.user_id = u.id
       WHERE u.id = ?
       GROUP BY u.id`,
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(userPublic(user));
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[auth]');
    res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) });
  }
});

// ── POST /api/auth/change-password ───────────────────────────
router.post('/change-password', requireAuth, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8 })
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const { current_password, new_password } = req.body;
  try {
    const [user] = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    // Invalider tous les refresh tokens
    await query('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);
    res.clearCookie('refreshToken', clearCookieOpts());
    audit(req, 'password_reset', 'user', req.user.id, { source: 'self-change' });
    res.json({ message: 'Mot de passe modifié — reconnectez-vous' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) });
  }
});

// ── POST /api/auth/forgot-password ────────────────────────────
// Enregistre la demande comme un message de contact (type "mot de passe oublié").
// Pour une vraie implémentation, il faudrait envoyer un mail avec un token
// de réinitialisation. Ici on tient informé l'admin qui peut réinitialiser
// manuellement depuis le panneau d'administration.
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const { email } = req.body;
  try {
    // Vérifier si l'email existe (sans révéler la réponse pour ne pas
    // permettre l'énumération de comptes)
    const [user] = await query(
      'SELECT id, prenom, nom FROM users WHERE email = ? AND actif = TRUE',
      [email]
    );

    if (user) {
      await query(
        `INSERT INTO contacts (prenom, nom, email, sujet, message, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          user.prenom, user.nom, email,
          'Demande de réinitialisation de mot de passe',
          `L'utilisateur « ${user.prenom} ${user.nom} » (id ${user.id}) a demandé la réinitialisation de son mot de passe. Merci de lui envoyer un lien ou un nouveau mot de passe temporaire.`,
          req.ip
        ]
      );
      // Audit anonyme (pas de req.user en contexte public, mais on trace l'IP)
      audit(req, 'password_reset', 'user', user.id, { source: 'forgot-form', email });
    }

    // Réponse neutre dans tous les cas (anti-énumération)
    res.json({
      message: 'Si un compte existe avec cette adresse, un administrateur vous contactera sous 48 h.'
    });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[auth]');
    res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) });
  }
});

// ── POST /api/auth/admin-reset/:userId ──────────────────────────
// Réservé admin : génère un token de reset (JWT 24h) qu'il peut copier-
// coller dans un email pour l'utilisateur. Le lien est de la forme :
// http://localhost:3000/reset-password.html?token=...
router.post('/admin-reset/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const [user] = await query('SELECT id, prenom, nom, email FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const token = jwt.sign(
      { sub: user.id, type: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    const baseUrl = req.headers.origin || `http://localhost:${process.env.PORT || 3000}`;
    const resetLink = `${baseUrl}/reset-password.html?token=${token}`;

    audit(req, 'password_reset', 'user', user.id, { source: 'admin-reset', adminId: req.user.id });

    res.json({
      user: { id: user.id, prenom: user.prenom, nom: user.nom, email: user.email },
      reset_link: resetLink,
      expires_in: '24 heures'
    });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[auth]');
    res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) });
  }
});

// ── POST /api/auth/reset-password ───────────────────────────────
// L'utilisateur arrive avec un token (lien généré par admin-reset ou
// envoyé par email) et choisit un nouveau mot de passe.
router.post('/reset-password', [
  body('token').notEmpty(),
  body('new_password').isLength({ min: 8 }).withMessage('Mot de passe : 8 caractères minimum')
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    const arr = errs.array();
    return res.status(400).json({ error: arr.map(e => e.msg).join(' · '), errors: arr });
  }

  const { token, new_password } = req.body;
  try {
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Le lien a expiré. Demandez-en un nouveau.' });
      }
      return res.status(401).json({ error: 'Lien invalide' });
    }
    if (payload.type !== 'reset') {
      return res.status(401).json({ error: 'Token de mauvais type' });
    }

    const [user] = await query('SELECT id FROM users WHERE id = ? AND actif = TRUE', [payload.sub]);
    if (!user) return res.status(401).json({ error: 'Compte invalide ou désactivé' });

    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);

    // Invalider les sessions actives
    await query('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);

    req.user = { id: user.id };
    audit(req, 'password_reset', 'user', user.id, { source: 'reset-link' });

    res.json({ message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
  } catch (err) {
    logger.error({ err }, '[reset-password]');
    res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) });
  }
});

// ═══════════════════════════════════════════════════════════════
//  2FA TOTP (Brief D2)
//
//  Flow d'activation :
//    1. POST /api/auth/2fa/setup   → renvoie { secret, qrDataUrl }
//                                    (génère + sauve un secret en attente,
//                                     totp_enabled reste à 0)
//    2. POST /api/auth/2fa/activate { code } → vérifie le code, met
//                                              totp_enabled=1, génère
//                                              8 backup codes one-time
//    3. POST /api/auth/2fa/disable { password, code } → désactive
// ═══════════════════════════════════════════════════════════════

function genBackupCodes() {
  // 8 codes de 10 caractères a-z0-9. On stocke les hashs sha256, on
  // renvoie les codes clairs UNE SEULE FOIS (à imprimer).
  const codes = [];
  const hashes = [];
  for (let i = 0; i < 8; i++) {
    const c = crypto.randomBytes(6).toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 10);
    codes.push(c);
    hashes.push(crypto.createHash('sha256').update(c).digest('hex'));
  }
  return { codes, hashes };
}

// POST /api/auth/2fa/setup — réservé admin (élargir à tous si tu veux)
router.post('/2fa/setup', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [user] = await query('SELECT username, email, totp_enabled FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.totp_enabled) return res.status(409).json({ error: '2FA déjà activée — désactivez d\'abord' });

    const secret = totpLib.generateSecret();
    await query('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?', [secret, req.user.id]);

    const issuer = 'C.C. Salouel';
    const label = `${issuer}:${user.email || user.username}`;
    const otpauth = totpLib.keyuri(user.email || user.username, issuer, secret);
    const qrDataUrl = await qrcode.toDataURL(otpauth, { errorCorrectionLevel: 'M', margin: 1, width: 280 });

    res.json({ secret, otpauth, qrDataUrl, label });
  } catch (err) {
    req.log.error({ err }, '2FA setup failed');
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/2fa/activate — { code }
router.post('/2fa/activate', requireAuth, requireAdmin, [
  body('code').matches(/^\d{6}$/).withMessage('Code à 6 chiffres requis')
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: errs.array().map(e => e.msg).join(' · ') });
  try {
    const [user] = await query('SELECT totp_secret, totp_enabled FROM users WHERE id = ?', [req.user.id]);
    if (!user?.totp_secret) return res.status(400).json({ error: 'Pas de secret en attente — lancer /2fa/setup d\'abord' });
    if (user.totp_enabled)   return res.status(409).json({ error: '2FA déjà activée' });

    const ok = totpLib.verify({ token: String(req.body.code), secret: user.totp_secret });
    if (!ok) return res.status(401).json({ error: 'Code invalide — réessayez' });

    const { codes, hashes } = genBackupCodes();
    await query(
      'UPDATE users SET totp_enabled = 1, totp_backup_codes = ? WHERE id = ?',
      [JSON.stringify(hashes), req.user.id]
    );
    audit(req, 'role_change', 'user', req.user.id, { event: '2fa-enabled' });
    res.json({
      message: '2FA activée — imprimez vos codes de récupération maintenant, ils ne seront plus jamais affichés.',
      backup_codes: codes,
    });
  } catch (err) {
    req.log.error({ err }, '2FA activation failed');
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/2fa/disable — { password, code } (sécurité : re-prouver l'identité)
router.post('/2fa/disable', requireAuth, requireAdmin, [
  body('password').notEmpty(),
  body('code').optional().matches(/^\d{6}$/),
], async (req, res) => {
  try {
    const [user] = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const passOk = await bcrypt.compare(req.body.password, user.password_hash);
    if (!passOk) return res.status(401).json({ error: 'Mot de passe invalide' });

    // Si TOTP actuellement actif, exiger aussi un code valide
    if (user.totp_enabled) {
      const code = String(req.body.code || '');
      const codeOk = totpLib.verify({ token: code, secret: user.totp_secret });
      if (!codeOk) return res.status(401).json({ error: 'Code 2FA requis pour désactiver' });
    }

    await query(
      'UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_backup_codes = NULL WHERE id = ?',
      [req.user.id]
    );
    audit(req, 'role_change', 'user', req.user.id, { event: '2fa-disabled' });
    res.json({ message: '2FA désactivée' });
  } catch (err) {
    req.log.error({ err }, '2FA disable failed');
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/2fa/status — état pour le frontend
router.get('/2fa/status', requireAuth, async (req, res) => {
  try {
    const [user] = await query(
      'SELECT totp_enabled, totp_secret IS NOT NULL AS has_secret, JSON_LENGTH(totp_backup_codes) AS backup_remaining FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({
      enabled: !!user?.totp_enabled,
      pending_setup: !user?.totp_enabled && !!user?.has_secret,
      backup_codes_remaining: user?.backup_remaining || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
