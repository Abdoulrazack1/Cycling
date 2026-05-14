// routes/pois-admin.js — Vue globale des POIs (admin)
const express = require('express');
const { query } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const logger = require('../lib/logger');
const router = express.Router();

// ── GET /api/pois — Tous les POIs avec contexte sortie ──────────
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { sortie_id, type, q } = req.query;
    let sql = `
      SELECT p.*, s.title AS sortie_title, s.slug AS sortie_slug,
             u.prenom AS creator_prenom, u.nom AS creator_nom
      FROM pois p
      LEFT JOIN sorties s ON s.id = p.sortie_id
      LEFT JOIN users u   ON u.id = p.created_by
      WHERE 1=1`;
    const params = [];
    if (sortie_id) { sql += ' AND p.sortie_id = ?'; params.push(sortie_id); }
    if (type)      { sql += ' AND p.type = ?';      params.push(type); }
    if (q)         { sql += ' AND (p.label LIKE ? OR p.description LIKE ?)';
                     params.push('%'+q+'%', '%'+q+'%'); }
    sql += ' ORDER BY p.created_at DESC';
    const rows = await query(sql, params);
    res.json(rows.map(r => ({
      id: r.id,
      sortie_id: r.sortie_id,
      sortie_title: r.sortie_title || '(sortie supprimée)',
      sortie_slug: r.sortie_slug,
      type: r.type,
      label: r.label,
      description: r.description,
      km: r.km,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lng),
      contact_name: r.contact_name,
      contact_phone: r.contact_phone,
      user_added: !!r.user_added,
      created_by: r.created_by,
      creator: r.creator_prenom ? `${r.creator_prenom} ${r.creator_nom || ''}`.trim() : null,
      created_at: r.created_at,
    })));
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[GET /pois]');
    res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) });
  }
});

// ── DELETE /api/pois/:id — Suppression directe par admin ────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await query('DELETE FROM pois WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'POI introuvable' });
    res.json({ message: 'POI supprimé' });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[DELETE /pois/:id]');
    res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) });
  }
});

module.exports = router;
