/* controllers/segments.js — Segments KOM (lecture publique + CRUD admin) */
const { query, pageClause } = require('../config/database');
const { audit } = require('../services/audit-log');
const { errResponse } = require('../lib/errors');
const logger = require('../lib/logger');

// GET /api/segments — liste paginée
async function list(req, res) {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const sql = 'SELECT * FROM segments_global ORDER BY stars DESC, name'
              + pageClause(limit, offset, { defaultLimit: 50, maxLimit: 200 });
    const [rows, [{ cnt }]] = await Promise.all([
      query(sql),
      query('SELECT COUNT(*) AS cnt FROM segments_global')
    ]);
    res.json({ segments: rows, total: cnt });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[GET /segments]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// POST /api/segments — création (admin)
async function create(req, res) {
  const s = req.body;
  if (!s.name) return res.status(400).json({ error: 'Nom requis' });
  try {
    const result = await query(
      `INSERT INTO segments_global (name, location, stars, length_m, meilleur_temps,
        delta_moyenne, rang, rang_cls, kom, sortie_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [s.name, s.location||null, s.stars||3, s.length_m||null,
       s.meilleur_temps||null, s.delta_moyenne||null, s.rang||null,
       s.rang_cls||null, s.kom||null, s.sortie_id||null]
    );
    const [created] = await query('SELECT * FROM segments_global WHERE id = ?', [result.insertId]);
    audit(req, 'create', 'segment', result.insertId, { name: s.name, location: s.location });
    res.status(201).json(created);
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[POST /segments]');
    errResponse(req, res, err, 500, 'Erreur lors de l\'ajout');
  }
}

// PUT /api/segments/:id — édition (admin)
async function update(req, res) {
  const s = req.body;
  try {
    await query(
      `UPDATE segments_global SET name=?, location=?, stars=?, length_m=?, meilleur_temps=?,
        delta_moyenne=?, rang=?, rang_cls=?, kom=?, sortie_id=? WHERE id=?`,
      [s.name, s.location||null, s.stars||3, s.length_m||null,
       s.meilleur_temps||null, s.delta_moyenne||null, s.rang||null,
       s.rang_cls||null, s.kom||null, s.sortie_id||null, req.params.id]
    );
    const [updated] = await query('SELECT * FROM segments_global WHERE id = ?', [req.params.id]);
    audit(req, 'update', 'segment', req.params.id, { name: s.name });
    res.json(updated);
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[PUT /segments/:id]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// DELETE /api/segments/:id — suppression (admin)
async function remove(req, res) {
  try {
    await query('DELETE FROM segments_global WHERE id = ?', [req.params.id]);
    audit(req, 'delete', 'segment', req.params.id);
    res.json({ message: 'Segment supprimé' });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[DELETE /segments/:id]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

module.exports = { list, create, update, remove };
