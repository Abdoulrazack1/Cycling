/* ═════════════════════════════════════════════════════════════════
   routes/favorites.js — Sorties favorites des membres
   ─────────────────────────────────────────────────────────────────
   GET    /api/favorites         liste des favoris du user courant
   POST   /api/favorites/:sortieId  ajoute aux favoris
   DELETE /api/favorites/:sortieId  retire des favoris
   GET    /api/favorites/check/:sortieId  → {favorite: true|false}
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { errResponse } = require('../lib/errors');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT f.sortie_id, f.created_at, s.title, s.subtitle, s.distance_km,
              s.elevation_gain, s.date, s.statut, s.chapter, s.slug, s.card_img
       FROM user_favorites f
       JOIN sorties s ON s.id = f.sortie_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ favorites: rows, total: rows.length });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur favoris');
  }
});

router.post('/:sortieId', requireAuth, async (req, res) => {
  const sortieId = req.params.sortieId;
  try {
    // Vérifie que la sortie existe (évite des favoris fantômes)
    const exists = await query('SELECT id FROM sorties WHERE id = ?', [sortieId]);
    if (!exists.length) return res.status(404).json({ error: 'Sortie inconnue' });

    await query(
      'INSERT IGNORE INTO user_favorites (user_id, sortie_id) VALUES (?, ?)',
      [req.user.id, sortieId]
    );
    res.json({ ok: true, favorite: true });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur ajout favori');
  }
});

router.delete('/:sortieId', requireAuth, async (req, res) => {
  try {
    await query(
      'DELETE FROM user_favorites WHERE user_id = ? AND sortie_id = ?',
      [req.user.id, req.params.sortieId]
    );
    res.json({ ok: true, favorite: false });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur retrait favori');
  }
});

router.get('/check/:sortieId', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      'SELECT 1 FROM user_favorites WHERE user_id = ? AND sortie_id = ? LIMIT 1',
      [req.user.id, req.params.sortieId]
    );
    res.json({ favorite: rows.length > 0 });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur check favori');
  }
});

module.exports = router;
