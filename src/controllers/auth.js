/* ═════════════════════════════════════════════════════════════════
   controllers/auth.js — Authentification complète JWT (+ 2FA, RGPD)
   ═════════════════════════════════════════════════════════════════ */

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const otp    = require('otplib');
const qrcode = require('qrcode');
const { query, withTransaction } = require('../config/database');
const { body, param, validationResult } = require('express-validator');
const { audit } = require('../services/audit-log');
const mailer = require('../services/mailer');
const { errResponse } = require('../lib/errors');
const logger = require('../lib/logger');

// otplib v13 wrapper (verify/generateSecret/keyuri). Tolérance ±1 fenêtre 30s.
const TOTP_OPTS = { algorithm: 'sha1', digits: 6, period: 30, window: 1 };
const totpLib = {
  generateSecret: () => otp.generateSecret({ algorithm: 'sha1' }),
  verify: ({ token, secret }) => {
    try {
      const r = otp.verifySync({ token, secret, options: TOTP_OPTS });
      return !!(r && r.valid);
    } catch { return false; }
  },
  keyuri: (account, issuer, secret) =>
    otp.generateURI({ label: account, issuer, secret, options: TOTP_OPTS }),
};

// ── TTL / helpers tokens ────────────────────────────────────────
const ACCESS_TTL  = process.env.JWT_EXPIRES_IN         || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
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
  return jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
function cookieOpts(rememberMe = true) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true, secure: isProd, sameSite: 'strict', path: '/',
    ...(rememberMe ? { maxAge: REFRESH_DB_DAYS * 24 * 3600 * 1000 } : {})
  };
}
function clearCookieOpts() {
  const isProd = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: isProd, sameSite: 'strict', path: '/' };
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
function genBackupCodes() {
  const codes = [];
  const hashes = [];
  while (codes.length < 8) {
    const c = crypto.randomBytes(8).toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 10);
    if (c.length !== 10) continue;
    codes.push(c);
    hashes.push(crypto.createHash('sha256').update(c).digest('hex'));
  }
  return { codes, hashes };
}

// ── Validators (montés depuis la route) ─────────────────────────
const loginValidators = [
  body('login').notEmpty().trim().isLength({ max: 254 }),
  body('password').notEmpty().isLength({ max: 200 }),
  body('totp').optional().isString().isLength({ max: 20 }),
];
const registerValidators = [
  body('username').isLength({ min: 3, max: 30 }).trim().matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, points, tirets et underscores'),
  body('email').isEmail().normalizeEmail().isLength({ max: 254 }),
  body('password').isLength({ min: 8, max: 200 }).withMessage('Mot de passe : 8 à 200 caractères'),
  body('prenom').notEmpty().trim().isLength({ max: 50 }),
  body('nom').notEmpty().trim().isLength({ max: 50 }),
  body('licence_ffc').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('annee_adhesion').optional({ nullable: true }).isInt({ min: 1900, max: 2100 }),
];
const equipmentCreateValidators = [
  body('titre').trim().isLength({ min: 1, max: 200 }),
  body('description').optional({ checkFalsy: true }).isLength({ max: 1000 }),
];
const equipmentUpdateValidators = [
  param('id').isInt({ min: 1 }),
  body('titre').trim().isLength({ min: 1, max: 200 }),
  body('description').optional({ checkFalsy: true }).isLength({ max: 1000 }),
];
const equipmentDeleteValidators = [param('id').isInt({ min: 1 })];
const changePasswordValidators = [
  body('current_password').notEmpty().isLength({ max: 200 }),
  body('new_password').isLength({ min: 8, max: 200 })
];
const accountDeleteValidators = [
  body('password').notEmpty().withMessage('Mot de passe requis pour confirmer'),
  body('confirm').equals('SUPPRIMER').withMessage('Tapez SUPPRIMER pour confirmer'),
];
const forgotPasswordValidators = [body('email').isEmail().normalizeEmail()];
const resetPasswordValidators = [
  body('token').notEmpty().isLength({ max: 1024 }),
  body('new_password').isLength({ min: 8, max: 200 }).withMessage('Mot de passe : 8 à 200 caractères')
];
const twofaActivateValidators = [body('code').matches(/^\d{6}$/).withMessage('Code à 6 chiffres requis')];
const twofaDisableValidators = [body('password').notEmpty(), body('code').optional().matches(/^\d{6}$/)];

// ── POST /api/auth/login ────────────────────────────────────────
async function login(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const { login, password, remember, totp } = req.body;
  const rememberMe = remember !== false;
  try {
    const [user] = await query(
      `SELECT * FROM users WHERE (email = ? OR username = ?) AND actif = TRUE`,
      [login, login]
    );
    if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

    // 2FA TOTP — challenge si activé
    if (user.totp_enabled && user.totp_secret) {
      if (!totp) return res.status(401).json({ error: 'TOTP requis', mfa_required: true });
      const code = String(totp).trim();
      let mfaOk = false;
      if (/^\d{6}$/.test(code)) {
        try { mfaOk = totpLib.verify({ token: code, secret: user.totp_secret }); } catch {}
      }
      if (!mfaOk && /^[a-z0-9]{6,12}$/i.test(code) && user.totp_backup_codes) {
        const backup = (typeof user.totp_backup_codes === 'string')
          ? JSON.parse(user.totp_backup_codes) : user.totp_backup_codes;
        const codeHash = crypto.createHash('sha256').update(code.toLowerCase()).digest('hex');
        const idx = backup.indexOf(codeHash);
        if (idx >= 0) {
          mfaOk = true;
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

    const expiresAt = new Date(Date.now() + REFRESH_DB_DAYS * 24 * 3600 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, hashToken(refreshToken), expiresAt]
    );

    res.cookie('refreshToken', refreshToken, cookieOpts(rememberMe));

    req.user = { id: user.id, username: user.username };
    audit(req, 'login', 'user', user.id, { rememberMe });

    res.json({ accessToken, user: userPublic(user) });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[auth]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// ── POST /api/auth/register ─────────────────────────────────────
async function register(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    const arr = errs.array();
    return res.status(400).json({ error: arr.map(e => `${e.path || e.param}: ${e.msg}`).join(' · '), errors: arr });
  }

  const { username, email, password, prenom, nom, licence_ffc, annee_adhesion } = req.body;
  try {
    const [existing] = await query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing) return res.status(409).json({ error: 'Email ou nom d\'utilisateur déjà pris' });

    const hash = await bcrypt.hash(password, 12);
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
    errResponse(req, res, err, 500, 'Erreur lors de l\'inscription');
  }
}

// ── POST /api/auth/refresh — rotation + détection de réutilisation ──
async function refresh(req, res) {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'Refresh token manquant' });

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

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

    const [user] = await query('SELECT * FROM users WHERE id = ? AND actif = TRUE', [payload.sub]);
    if (!user) return res.status(401).json({ error: 'Compte invalide' });

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
}

// ── POST /api/auth/logout ───────────────────────────────────────
async function logout(req, res) {
  const token = req.cookies?.refreshToken;
  let userId = null, username = null;
  if (token) {
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
}

// ── GET /api/auth/me ────────────────────────────────────────────
async function me(req, res) {
  try {
    const [user] = await query(
      `SELECT u.*,
        JSON_ARRAYAGG(JSON_OBJECT('id', e.id, 'num', e.num, 'titre', e.titre, 'description', e.description, 'sort_order', e.sort_order))
          AS equipment
       FROM users u
       LEFT JOIN user_equipment e ON e.user_id = u.id
       WHERE u.id = ?
       GROUP BY u.id`,
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const pub = userPublic(user);

    pub.strava_linked = false;
    pub.inscriptions_count = 0;
    try {
      const rows = await query('SELECT 1 FROM user_strava_link WHERE user_id = ? LIMIT 1', [req.user.id]);
      pub.strava_linked = rows.length > 0;
    } catch (e) { /* table absente */ }
    try {
      const rows = await query(
        "SELECT COUNT(*) AS n FROM sortie_inscriptions WHERE user_id = ? AND statut != 'annule'",
        [req.user.id]
      );
      pub.inscriptions_count = rows[0]?.n || 0;
    } catch (e) { /* table absente */ }

    res.json(pub);
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[auth]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// ── Équipement ──────────────────────────────────────────────────
async function equipmentCreate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  try {
    const [maxRow] = await query(
      'SELECT COALESCE(MAX(sort_order), 0) AS m, COALESCE(MAX(num), 0) AS n FROM user_equipment WHERE user_id = ?',
      [req.user.id]
    );
    const sortOrder = (maxRow?.m || 0) + 10;
    const num       = (maxRow?.n || 0) + 1;
    const result = await query(
      'INSERT INTO user_equipment (user_id, num, titre, description, sort_order) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, num, req.body.titre.trim(), req.body.description?.trim() || null, sortOrder]
    );
    res.status(201).json({
      id: result.insertId, num,
      titre: req.body.titre.trim(),
      description: req.body.description?.trim() || null,
      sort_order: sortOrder,
    });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur création équipement');
  }
}
async function equipmentUpdate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  try {
    const result = await query(
      'UPDATE user_equipment SET titre = ?, description = ? WHERE id = ? AND user_id = ?',
      [req.body.titre.trim(), req.body.description?.trim() || null, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Équipement introuvable' });
    res.json({ ok: true });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur mise à jour');
  }
}
async function equipmentDelete(req, res) {
  try {
    const result = await query(
      'DELETE FROM user_equipment WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Équipement introuvable' });
    res.json({ ok: true });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur suppression');
  }
}

// ── POST /api/auth/change-password ──────────────────────────────
async function changePassword(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const { current_password, new_password } = req.body;
  try {
    const [user] = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    await query('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);
    res.clearCookie('refreshToken', clearCookieOpts());
    audit(req, 'password_reset', 'user', req.user.id, { source: 'self-change' });
    res.json({ message: 'Mot de passe modifié — reconnectez-vous' });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// ── Sessions ────────────────────────────────────────────────────
async function sessionsList(req, res) {
  try {
    const rows = await query(
      `SELECT id, token_hash, expires_at, created_at
       FROM refresh_tokens
       WHERE user_id = ? AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    const currentHash = req.cookies?.refreshToken ? hashToken(req.cookies.refreshToken) : null;
    res.json({
      sessions: rows.map(r => ({
        id: r.id,
        short_hash: r.token_hash.slice(-8),
        expires_at: r.expires_at,
        created_at: r.created_at,
        is_current: r.token_hash === currentHash,
      })),
    });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur listing sessions'); }
}
async function sessionRevoke(req, res) {
  try {
    const r = await query(`DELETE FROM refresh_tokens WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Session introuvable' });
    audit(req, 'logout', 'session', req.params.id, { source: 'self-revoke' });
    res.json({ ok: true, revoked: 1 });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur révocation'); }
}
async function sessionsRevokeAll(req, res) {
  try {
    const currentHash = req.cookies?.refreshToken ? hashToken(req.cookies.refreshToken) : null;
    let r;
    if (currentHash) {
      r = await query(`DELETE FROM refresh_tokens WHERE user_id = ? AND token_hash != ?`, [req.user.id, currentHash]);
    } else {
      r = await query(`DELETE FROM refresh_tokens WHERE user_id = ?`, [req.user.id]);
    }
    audit(req, 'logout', 'session', null, { source: 'self-revoke-all', count: r.affectedRows });
    res.json({ ok: true, revoked: r.affectedRows });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur révocation globale'); }
}

// ── DELETE /api/auth/account — RGPD Article 17 ──────────────────
async function accountDelete(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
  try {
    const [user] = await query('SELECT id, role, password_hash, username, email FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const ok = await bcrypt.compare(req.body.password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });

    if (user.role === 'admin') {
      const [{ cnt }] = await query(`SELECT COUNT(*) AS cnt FROM users WHERE role='admin' AND actif=TRUE`);
      if (cnt <= 1) {
        return res.status(409).json({ error: 'Vous êtes le dernier administrateur. Désignez un autre admin avant de supprimer votre compte.' });
      }
    }

    // Audit AVANT effacement (sinon FK cascade efface aussi l'audit_log)
    audit(req, 'delete', 'user', user.id, {
      reason: 'rgpd-article-17',
      username_was: user.username,
      email_was:    user.email,
    });

    await query('DELETE FROM users WHERE id = ?', [user.id]);
    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict' });
    res.json({ ok: true, message: 'Compte supprimé. Vous avez été déconnecté.' });
  } catch (err) { errResponse(req, res, err, 500, 'Erreur suppression compte'); }
}

// ── GET /api/auth/export-data — RGPD Article 20 ─────────────────
async function exportData(req, res) {
  try {
    const id = req.user.id;
    const [user] = await query(
      `SELECT id, numero, username, email, prenom, nom, role, bio, bio_public,
              ftp_w, km_saison, elevation_saison, licence_ffc, annee_adhesion,
              actif, created_at, updated_at
       FROM users WHERE id = ?`,
      [id]
    );
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const [equipment, inscriptions, stravaLink, stravaActivities, palmares, auditLog, refreshTokens] = await Promise.all([
      query('SELECT id, num, titre, description, sort_order FROM user_equipment WHERE user_id = ?', [id]),
      query(
        `SELECT ei.id, ei.prenom, ei.nom, ei.email, ei.categorie, ei.distance, ei.statut, ei.created_at,
                e.title AS evenement_title, e.date AS evenement_date, e.lieu AS evenement_lieu
         FROM evenement_inscriptions ei
         JOIN evenements e ON e.id = ei.evenement_id
         WHERE ei.user_id = ?`,
        [id]
      ),
      query(
        `SELECT strava_athlete_id, athlete_firstname, athlete_lastname, scope,
                connected_at, last_sync_at FROM user_strava_link WHERE user_id = ?`,
        [id]
      ).catch(() => []),
      query(
        `SELECT id, name, type, distance_m, moving_time_s, elevation_gain_m,
                start_date, start_lat, start_lng FROM strava_activities WHERE user_id = ?`,
        [id]
      ).catch(() => []),
      query(
        `SELECT id, annee, titre, evenement, categorie, rang, medaille FROM palmares
         WHERE LOWER(titre) LIKE LOWER(?)`,
        [`%${user.prenom} ${user.nom}%`]
      ).catch(() => []),
      query(
        `SELECT action, entity, entity_id, payload, ip_address, created_at FROM audit_log
         WHERE user_id = ? ORDER BY created_at DESC LIMIT 500`,
        [id]
      ).catch(() => []),
      query(`SELECT id, expires_at FROM refresh_tokens WHERE user_id = ?`, [id]).catch(() => []),
    ]);

    const payload = {
      export_metadata: {
        generated_at: new Date().toISOString(),
        rgpd_article: 'Article 20 — Droit à la portabilité',
        scope: 'Toutes les données personnelles associées à cet utilisateur, à l\'exclusion des secrets (mot de passe, tokens, 2FA secret) et des données techniques internes.',
        retention_note: 'Pour exercer votre droit à l\'effacement (Article 17), contactez le bureau du club.',
      },
      profile: { ...user, password_hash: '[redacted]', two_factor_secret: '[redacted]' },
      equipment,
      inscriptions_events: inscriptions,
      strava_link:         stravaLink[0] || null,
      strava_activities:   stravaActivities,
      palmares,
      audit_log: auditLog.map(a => ({
        ...a,
        payload: typeof a.payload === 'string' ? (() => { try { return JSON.parse(a.payload); } catch { return a.payload; } })() : a.payload,
      })),
      active_sessions: refreshTokens.length,
    };

    const filename = `ccs-export-${user.username}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    audit(req, 'export_data', 'user', id, { reason: 'rgpd-portability' });
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[export-data]');
    errResponse(req, res, err, 500, 'Erreur export données');
  }
}

// ── POST /api/auth/forgot-password (anti-énumération) ───────────
async function forgotPassword(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const { email } = req.body;
  try {
    const [user] = await query('SELECT id, prenom, nom FROM users WHERE email = ? AND actif = TRUE', [email]);

    if (user) {
      const token = jwt.sign({ sub: user.id, type: 'reset' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const baseUrl = req.headers.origin || `http://localhost:${process.env.PORT || 3000}`;
      const resetUrl = `${baseUrl}/reset-password.html?token=${token}`;

      if (mailer.isConfigured()) {
        mailer.sendPasswordReset({ to: email, prenom: user.prenom, resetUrl, expiresMinutes: 60 })
          .catch(err => logger.warn({ err: err.message }, '[forgot-password] mail échec'));
        audit(req, 'password_reset', 'user', user.id, { source: 'forgot-form-mail', email });
      } else {
        await query(
          `INSERT INTO contacts (prenom, nom, email, sujet, message, ip_address) VALUES (?, ?, ?, ?, ?, ?)`,
          [user.prenom, user.nom, email, 'Demande de réinitialisation de mot de passe',
           `L'utilisateur « ${user.prenom} ${user.nom} » (id ${user.id}) a demandé la réinitialisation de son mot de passe. SMTP non configuré — envoyer le lien manuellement.`,
           req.ip]
        );
        audit(req, 'password_reset', 'user', user.id, { source: 'forgot-form-fallback', email });
      }
    }

    res.json({ message: 'Si un compte existe avec cette adresse, un email de réinitialisation vient d\'être envoyé. Vérifiez votre boîte (et les spams).' });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[auth]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// ── POST /api/auth/admin-reset/:userId (admin) ──────────────────
async function adminReset(req, res) {
  try {
    const userId = parseInt(req.params.userId);
    const [user] = await query('SELECT id, prenom, nom, email FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const token = jwt.sign({ sub: user.id, type: 'reset' }, process.env.JWT_SECRET, { expiresIn: '24h' });
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
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// ── POST /api/auth/reset-password ───────────────────────────────
async function resetPassword(req, res) {
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
    if (payload.type !== 'reset') return res.status(401).json({ error: 'Token de mauvais type' });

    const [user] = await query('SELECT id FROM users WHERE id = ? AND actif = TRUE', [payload.sub]);
    if (!user) return res.status(401).json({ error: 'Compte invalide ou désactivé' });

    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
    await query('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);

    req.user = { id: user.id };
    audit(req, 'password_reset', 'user', user.id, { source: 'reset-link' });

    res.json({ message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
  } catch (err) {
    logger.error({ err }, '[reset-password]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// ── 2FA ─────────────────────────────────────────────────────────
async function twofaSetup(req, res) {
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
    errResponse(req, res, err, 500, 'Erreur serveur');
  }
}
async function twofaActivate(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: errs.array().map(e => e.msg).join(' · ') });
  try {
    const [user] = await query('SELECT totp_secret, totp_enabled FROM users WHERE id = ?', [req.user.id]);
    if (!user?.totp_secret) return res.status(400).json({ error: 'Pas de secret en attente — lancer /2fa/setup d\'abord' });
    if (user.totp_enabled)   return res.status(409).json({ error: '2FA déjà activée' });

    const ok = totpLib.verify({ token: String(req.body.code), secret: user.totp_secret });
    if (!ok) return res.status(401).json({ error: 'Code invalide — réessayez' });

    const { codes, hashes } = genBackupCodes();
    await query('UPDATE users SET totp_enabled = 1, totp_backup_codes = ? WHERE id = ?', [JSON.stringify(hashes), req.user.id]);
    audit(req, 'role_change', 'user', req.user.id, { event: '2fa-enabled' });
    res.json({
      message: '2FA activée — imprimez vos codes de récupération maintenant, ils ne seront plus jamais affichés.',
      backup_codes: codes,
    });
  } catch (err) {
    req.log.error({ err }, '2FA activation failed');
    errResponse(req, res, err, 500, 'Erreur serveur');
  }
}
async function twofaDisable(req, res) {
  try {
    const [user] = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const passOk = await bcrypt.compare(req.body.password, user.password_hash);
    if (!passOk) return res.status(401).json({ error: 'Mot de passe invalide' });

    if (user.totp_enabled) {
      const code = String(req.body.code || '');
      const codeOk = totpLib.verify({ token: code, secret: user.totp_secret });
      if (!codeOk) return res.status(401).json({ error: 'Code 2FA requis pour désactiver' });
    }

    await query('UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_backup_codes = NULL WHERE id = ?', [req.user.id]);
    audit(req, 'role_change', 'user', req.user.id, { event: '2fa-disabled' });
    res.json({ message: '2FA désactivée' });
  } catch (err) {
    req.log.error({ err }, '2FA disable failed');
    errResponse(req, res, err, 500, 'Erreur serveur');
  }
}
async function twofaStatus(req, res) {
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
    errResponse(req, res, err, 500, 'Erreur serveur');
  }
}

// ── GET /api/auth/my-stats ──────────────────────────────────────
async function myStats(req, res) {
  try {
    const me = req.user.id;
    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd   = `${year}-12-31`;

    const [me_row]  = await query('SELECT km_saison, elevation_saison, ftp_w FROM users WHERE id = ?', [me]);
    if (!me_row) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const [rank_row] = await query(
      `SELECT (SELECT COUNT(*) + 1 FROM users WHERE actif = TRUE AND km_saison > ?) AS rank,
              (SELECT COUNT(*) FROM users WHERE actif = TRUE) AS total_members,
              (SELECT AVG(km_saison) FROM users WHERE actif = TRUE AND km_saison > 0) AS club_avg_km`,
      [me_row.km_saison || 0]
    );

    const [sorties_row] = await query(
      `SELECT COUNT(*) AS n, COALESCE(SUM(distance_km), 0) AS total_km, COALESCE(SUM(elevation_gain), 0) AS total_dplus
       FROM sorties WHERE statut = 'passee' AND date BETWEEN ? AND ?`,
      [yearStart, yearEnd]
    );

    const [events_row] = await query(
      `SELECT COUNT(*) AS upcoming
       FROM evenements WHERE date >= CURDATE() AND statut IN ('ouvert', 'complet')`
    ).catch(() => [{ upcoming: 0 }]);

    res.json({
      me: {
        km_saison:        me_row.km_saison || 0,
        elevation_saison: me_row.elevation_saison || 0,
        ftp_w:            me_row.ftp_w || null,
      },
      rank: {
        position:         rank_row.rank,
        total:            rank_row.total_members,
        percentile:       rank_row.total_members ? Math.round(100 - (rank_row.rank / rank_row.total_members * 100)) : null,
        club_avg_km:      Math.round(rank_row.club_avg_km || 0),
      },
      club_year: {
        sorties_done:     sorties_row.n || 0,
        total_km:         Math.round(sorties_row.total_km || 0),
        total_dplus:      Math.round(sorties_row.total_dplus || 0),
        upcoming_events:  events_row.upcoming || 0,
      },
      year,
    });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur stats');
  }
}

module.exports = {
  // validators
  loginValidators, registerValidators, equipmentCreateValidators, equipmentUpdateValidators,
  equipmentDeleteValidators, changePasswordValidators, accountDeleteValidators,
  forgotPasswordValidators, resetPasswordValidators, twofaActivateValidators, twofaDisableValidators,
  // handlers
  login, register, refresh, logout, me,
  equipmentCreate, equipmentUpdate, equipmentDelete, changePassword,
  sessionsList, sessionRevoke, sessionsRevokeAll, accountDelete, exportData,
  forgotPassword, adminReset, resetPassword,
  twofaSetup, twofaActivate, twofaDisable, twofaStatus, myStats,
};
