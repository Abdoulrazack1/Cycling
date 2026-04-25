// routes/palmares.js — Palmarès CRUD
const express = require('express');
const { query } = require('../config/database');
const { requireAuth, requireAdmin, requireModo } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// GET /api/palmares
router.get('/', async (req, res) => {
  try {
    const { annee } = req.query;
    let sql = 'SELECT * FROM palmares WHERE 1=1';
    const params = [];
    if (annee) { sql += ' AND annee = ?'; params.push(parseInt(annee)); }
    sql += ' ORDER BY annee DESC, medaille ASC, rang ASC';
    const rows = await query(sql, params);

    // Grouper par année
    const byYear = {};
    for (const row of rows) {
      if (!byYear[row.annee]) byYear[row.annee] = [];
      byYear[row.annee].push(row);
    }
    res.json({ palmares: rows, byYear });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// POST /api/palmares
router.post('/', requireAuth, requireModo, [
  body('annee').isInt({ min: 1978, max: 2100 }),
  body('titre').notEmpty().trim(),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  const p = req.body;
  try {
    const result = await query(
      `INSERT INTO palmares (annee, titre, evenement, categorie, rang, medaille, equipe, sortie_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [p.annee, p.titre, p.evenement||null, p.categorie||null, p.rang||null,
       p.medaille||null, p.equipe?1:0, p.sortie_id||null]
    );
    const [created] = await query('SELECT * FROM palmares WHERE id = ?', [result.insertId]);
    res.status(201).json(created);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// PUT /api/palmares/:id
router.put('/:id', requireAuth, requireModo, async (req, res) => {
  const p = req.body;
  try {
    await query(
      `UPDATE palmares SET annee=?, titre=?, evenement=?, categorie=?, rang=?, medaille=?, equipe=?, sortie_id=?
       WHERE id=?`,
      [p.annee, p.titre, p.evenement||null, p.categorie||null, p.rang||null,
       p.medaille||null, p.equipe?1:0, p.sortie_id||null, req.params.id]
    );
    const [updated] = await query('SELECT * FROM palmares WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// DELETE /api/palmares/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM palmares WHERE id = ?', [req.params.id]);
    res.json({ message: 'Supprimé' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;
