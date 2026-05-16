// routes/membres.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const { query, pageClause } = require('../config/database');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { audit } = require('../services/audit-log');
const { errResponse } = require('../lib/errors');
const logger = require('../lib/logger');
const router = express.Router();

// Vue publique d'un user (annuaire + fiche /membres/:id).
// La bio n'est exposée que si l'utilisateur a explicitement coché
// "rendre publique" (bio_public = 1) — opt-in RGPD.
// `viewer` est l'utilisateur qui fait la requête (peut être null) ; un
// utilisateur voit toujours sa propre bio + un admin voit toutes les bios.
function userPublic(u, viewer = null) {
  const isOwner = viewer?.id === u.id;
  const isAdmin = viewer?.role === 'admin';
  const exposeBio = isOwner || isAdmin || u.bio_public === 1;
  return {
    id: u.id, numero: u.numero, username: u.username,
    prenom: u.prenom, nom: u.nom, role: u.role,
    bio: exposeBio ? u.bio : null,
    bio_public: !!u.bio_public,
    ftp_w: u.ftp_w, km_saison: u.km_saison,
    elevation_saison: u.elevation_saison, licence_ffc: u.licence_ffc,
    annee_adhesion: u.annee_adhesion, avatar_initial: u.avatar_initial,
    actif: u.actif
  };
}

// GET /api/membres — annuaire public, paginé (cf. AUDIT item #21)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const sql = 'SELECT * FROM users WHERE actif = TRUE ORDER BY numero'
              + pageClause(limit, offset, { defaultLimit: 50, maxLimit: 200 });
    const [rows, [{ cnt }]] = await Promise.all([
      query(sql),
      query('SELECT COUNT(*) AS cnt FROM users WHERE actif = TRUE')
    ]);
    res.json({ membres: rows.map(u => userPublic(u, req.user)), total: cnt });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

// GET /api/membres/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const [user] = await query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Membre introuvable' });
    const equipment = await query(
      'SELECT num, titre, description FROM user_equipment WHERE user_id = ? ORDER BY sort_order',
      [user.id]
    );
    res.json({ ...userPublic(user, req.user), equipment });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

// PUT /api/membres/:id (self ou admin)
router.put('/:id', requireAuth, [
  body('bio').optional({ nullable: true }).trim().isLength({ max: 2000 }).withMessage('Bio : 2000 caractères max'),
  body('bio_public').optional().isBoolean(),
  body('ftp_w').optional({ nullable: true }).isInt({ min: 0, max: 2000 }),
  body('km_saison').optional({ nullable: true }).isInt({ min: 0, max: 100000 }),
  body('elevation_saison').optional({ nullable: true }).isInt({ min: 0, max: 1000000 }),
  body('licence_ffc').optional({ nullable: true }).isLength({ max: 50 }).trim(),
  body('annee_adhesion').optional({ nullable: true }).isInt({ min: 1900, max: 2100 }),
], async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (req.user.id !== targetId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  const { bio, bio_public, ftp_w, km_saison, elevation_saison, licence_ffc, annee_adhesion } = req.body;
  try {
    await query(
      `UPDATE users SET bio=?, bio_public=?, ftp_w=?, km_saison=?, elevation_saison=?, licence_ffc=?, annee_adhesion=?
       WHERE id=?`,
      [bio||null, bio_public ? 1 : 0, ftp_w||null, km_saison||0, elevation_saison||0, licence_ffc||null, annee_adhesion||null, targetId]
    );
    const [updated] = await query('SELECT * FROM users WHERE id = ?', [targetId]);
    res.json(userPublic(updated, req.user));
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

// Admin: désactiver un membre
router.patch('/:id/actif', requireAuth, requireAdmin, [
  body('actif').isBoolean().withMessage('actif doit être true ou false')
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    // Idem #18 : on ne peut pas désactiver le dernier admin actif.
    if (req.body.actif === false) {
      const [target] = await query('SELECT role FROM users WHERE id = ?', [req.params.id]);
      if (target?.role === 'admin') {
        const [{ cnt }] = await query(
          "SELECT COUNT(*) AS cnt FROM users WHERE role='admin' AND actif=TRUE"
        );
        if (cnt <= 1) {
          return res.status(409).json({ error: 'Dernier admin actif — désactivation refusée.' });
        }
      }
    }
    await query('UPDATE users SET actif = ? WHERE id = ?', [req.body.actif ? 1 : 0, req.params.id]);
    audit(req, 'update', 'user', req.params.id, { field: 'actif', value: req.body.actif });
    res.json({ message: 'Statut mis à jour' });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

// Admin: changer le rôle
router.patch('/:id/role', requireAuth, requireAdmin, [
  body('role').isIn(['admin','moderateur','membre'])
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    // Cf. AUDIT item #18 — empêcher la rétrogradation du DERNIER admin
    // actif. Sans ça, un admin pouvait se rétrograder lui-même et plus
    // personne ne pouvait administrer le site.
    if (req.body.role !== 'admin') {
      const [target] = await query('SELECT role FROM users WHERE id = ?', [req.params.id]);
      if (target?.role === 'admin') {
        const [{ cnt }] = await query(
          "SELECT COUNT(*) AS cnt FROM users WHERE role='admin' AND actif=TRUE"
        );
        if (cnt <= 1) {
          return res.status(409).json({
            error: 'Dernier admin actif — impossible de le rétrograder. Promouvez d\'abord un autre membre.'
          });
        }
      }
    }
    await query('UPDATE users SET role = ? WHERE id = ?', [req.body.role, req.params.id]);
    audit(req, 'role_change', 'user', req.params.id, { newRole: req.body.role });
    res.json({ message: 'Rôle mis à jour' });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

module.exports = router;
