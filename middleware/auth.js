// middleware/auth.js — Vérification JWT + contrôle des rôles
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// ── Vérifie le token d'accès ──────────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Vérifier que l'utilisateur existe toujours et est actif
    const [user] = await query(
      'SELECT id, username, email, prenom, nom, role, actif FROM users WHERE id = ?',
      [payload.sub]
    );
    if (!user || !user.actif) {
      return res.status(401).json({ error: 'Compte invalide ou désactivé' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token invalide' });
  }
}

// ── Optionnel : attache req.user si token présent ─────────────
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [user] = await query(
      'SELECT id, username, email, prenom, nom, role, actif FROM users WHERE id = ?',
      [payload.sub]
    );
    if (user?.actif) req.user = user;
  } catch { /* ignorer */ }
  next();
}

// ── Vérification de rôle ──────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Droits insuffisants' });
    }
    next();
  };
}

const requireAdmin = requireRole('admin');
const requireModo  = requireRole('admin', 'moderateur');

module.exports = { requireAuth, optionalAuth, requireRole, requireAdmin, requireModo };
