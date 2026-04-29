// routes/auth.js — Authentification complète JWT
const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const { query, withTransaction } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────
function signAccess(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { sub: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Construit l'objet d'options pour res.cookie() compatible cross-origin
 * en développement (localhost:5500 ↔ localhost:3000) et secure en prod.
 *
 * Règles navigateur :
 *  - sameSite: 'strict' interdit l'envoi cross-site (cas Live Server)
 *  - sameSite: 'none' impose secure: true (HTTPS obligatoire)
 *  - sameSite: 'lax'  fonctionne pour les requêtes top-level same-site
 *
 * En dev sans HTTPS, on utilise 'lax' pour permettre le développement
 * tout en restant raisonnable côté sécurité. localhost:5500 et localhost:3000
 * sont considérés same-site (même registrable domain), donc lax suffit
 * pour la plupart des navigateurs modernes.
 *
 * Le token d'accès étant aussi persisté en sessionStorage côté frontend
 * (cf. asset/js/auth.js), une défaillance du cookie ne casse plus la
 * navigation : seule la persistance long-terme (7 j) est affectée.
 */
function cookieOpts(rememberMe = true) {
  const isProd = process.env.NODE_ENV === 'production';
  const useSecure = isProd || process.env.COOKIE_SECURE === 'true';
  const opts = {
    httpOnly: true,
    secure: useSecure,
    sameSite: useSecure ? 'none' : 'lax',
    path: '/',
    // Si "se souvenir de moi" non coché : cookie de session (sans maxAge)
    ...(rememberMe ? { maxAge: 7 * 24 * 3600 * 1000 } : {})
  };
  // Domaine explicite optionnel (rarement utile, parfois nécessaire si
  // backend et frontend tournent sur sous-domaines différents en prod).
  if (process.env.COOKIE_DOMAIN) opts.domain = process.env.COOKIE_DOMAIN;
  return opts;
}

function clearCookieOpts() {
  const isProd = process.env.NODE_ENV === 'production';
  const useSecure = isProd || process.env.COOKIE_SECURE === 'true';
  const opts = {
    httpOnly: true,
    secure: useSecure,
    sameSite: useSecure ? 'none' : 'lax',
    path: '/'
  };
  if (process.env.COOKIE_DOMAIN) opts.domain = process.env.COOKIE_DOMAIN;
  return opts;
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
  body('password').notEmpty()
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const { login, password, remember } = req.body;
  const rememberMe = remember !== false; // par défaut on persiste 7 jours
  try {
    const [user] = await query(
      `SELECT * FROM users WHERE (email = ? OR username = ?) AND actif = TRUE`,
      [login, login]
    );
    if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);

    // Stocker le refresh token (hashé)
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, hashToken(refreshToken), expiresAt]
    );

    // Cookie httpOnly pour le refresh token (sameSite: lax en dev, none en prod)
    res.cookie('refreshToken', refreshToken, cookieOpts(rememberMe));

    res.json({
      accessToken,
      user: userPublic(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
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
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

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

    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, hashToken(refreshToken), expiresAt]
    );

    res.cookie('refreshToken', refreshToken, cookieOpts(true));

    res.status(201).json({ accessToken, user: userPublic(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────
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
    if (!stored) return res.status(401).json({ error: 'Session expirée' });

    const [user] = await query(
      'SELECT * FROM users WHERE id = ? AND actif = TRUE',
      [payload.sub]
    );
    if (!user) return res.status(401).json({ error: 'Compte invalide' });

    // Rotation du refresh token
    const newRefresh = signRefresh(user);
    const expiresAt  = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    await query('DELETE FROM refresh_tokens WHERE id = ?', [stored.id]);
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, hashToken(newRefresh), expiresAt]
    );

    res.cookie('refreshToken', newRefresh, cookieOpts(true));

    res.json({ accessToken: signAccess(user), user: userPublic(user) });
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hashToken(token)]);
  }
  res.clearCookie('refreshToken', clearCookieOpts());
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
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
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
    res.json({ message: 'Mot de passe modifié — reconnectez-vous' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
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
    }

    // Réponse neutre dans tous les cas (anti-énumération)
    res.json({
      message: 'Si un compte existe avec cette adresse, un administrateur vous contactera sous 48 h.'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
