// routes/membres.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const { query } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

function userPublic(u) {
  return {
    id: u.id, numero: u.numero, username: u.username,
    prenom: u.prenom, nom: u.nom, role: u.role,
    bio: u.bio, ftp_w: u.ftp_w, km_saison: u.km_saison,
    elevation_saison: u.elevation_saison, licence_ffc: u.licence_ffc,
    annee_adhesion: u.annee_adhesion, avatar_initial: u.avatar_initial,
    actif: u.actif
  };
}

// GET /api/membres
router.get('/', async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM users WHERE actif = TRUE ORDER BY numero',
    );
    res.json(rows.map(userPublic));
  } catch (err) { console.error('[' + req.method + ' ' + req.originalUrl + ']', err.code || '', err.sqlMessage || err.message); res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) }); }
});

// GET /api/membres/:id
router.get('/:id', async (req, res) => {
  try {
    const [user] = await query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Membre introuvable' });
    const equipment = await query(
      'SELECT num, titre, description FROM user_equipment WHERE user_id = ? ORDER BY sort_order',
      [user.id]
    );
    res.json({ ...userPublic(user), equipment });
  } catch (err) { console.error('[' + req.method + ' ' + req.originalUrl + ']', err.code || '', err.sqlMessage || err.message); res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) }); }
});

// PUT /api/membres/:id (self ou admin)
router.put('/:id', requireAuth, [
  body('bio').optional().trim(),
  body('ftp_w').optional().isInt({ min: 0, max: 2000 }),
], async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (req.user.id !== targetId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  const { bio, ftp_w, km_saison, elevation_saison, licence_ffc, annee_adhesion } = req.body;
  try {
    await query(
      `UPDATE users SET bio=?, ftp_w=?, km_saison=?, elevation_saison=?, licence_ffc=?, annee_adhesion=?
       WHERE id=?`,
      [bio||null, ftp_w||null, km_saison||0, elevation_saison||0, licence_ffc||null, annee_adhesion||null, targetId]
    );
    const [updated] = await query('SELECT * FROM users WHERE id = ?', [targetId]);
    res.json(userPublic(updated));
  } catch (err) { console.error('[' + req.method + ' ' + req.originalUrl + ']', err.code || '', err.sqlMessage || err.message); res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) }); }
});

// Admin: désactiver un membre
router.patch('/:id/actif', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('UPDATE users SET actif = ? WHERE id = ?', [req.body.actif ? 1 : 0, req.params.id]);
    res.json({ message: 'Statut mis à jour' });
  } catch (err) { console.error('[' + req.method + ' ' + req.originalUrl + ']', err.code || '', err.sqlMessage || err.message); res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) }); }
});

// Admin: changer le rôle
router.patch('/:id/role', requireAuth, requireAdmin, [
  body('role').isIn(['admin','moderateur','membre'])
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    await query('UPDATE users SET role = ? WHERE id = ?', [req.body.role, req.params.id]);
    res.json({ message: 'Rôle mis à jour' });
  } catch (err) { console.error('[' + req.method + ' ' + req.originalUrl + ']', err.code || '', err.sqlMessage || err.message); res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) }); }
});

module.exports = router;
