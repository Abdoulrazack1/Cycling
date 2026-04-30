// routes/palmares.js — Palmarès CRUD
const express = require('express');
const { query } = require('../config/database');
const { requireAuth, requireAdmin, requireModo } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// GET /api/palmares
// Retourne soit un array (par défaut, plus simple côté client),
// soit un objet groupé { palmares, byYear } si ?grouped=1.
router.get('/', async (req, res) => {
  try {
    const { annee, grouped } = req.query;
    let sql = 'SELECT * FROM palmares WHERE 1=1';
    const params = [];
    if (annee) { sql += ' AND annee = ?'; params.push(parseInt(annee)); }
    sql += ' ORDER BY annee DESC, FIELD(medaille, "gold", "silver", "bronze", "") ASC, rang ASC';
    const rows = await query(sql, params);

    if (grouped === '1') {
      const byYear = {};
      for (const row of rows) {
        if (!byYear[row.annee]) byYear[row.annee] = [];
        byYear[row.annee].push(row);
      }
      return res.json({ palmares: rows, byYear });
    }
    res.json(rows);
  } catch (err) {
    console.error('[GET /palmares]', err.code || '', err.sqlMessage || err.message);
    res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) });
  }
});

// POST /api/palmares
router.post('/', requireAuth, requireModo, [
  body('annee').isInt({ min: 1978, max: 2100 }).withMessage('Année invalide'),
  body('evenement').notEmpty().trim().withMessage('Événement requis'),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    return res.status(400).json({
      error: errs.array().map(e => e.msg).join(' · '),
      errors: errs.array()
    });
  }
  const p = req.body;
  try {
    const result = await query(
      `INSERT INTO palmares (annee, titre, evenement, categorie, rang, medaille, equipe, sortie_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [p.annee, p.titre || null, p.evenement, p.categorie || null, p.rang || null,
       p.medaille || null, p.equipe || null, p.sortie_id || null]
    );
    const [created] = await query('SELECT * FROM palmares WHERE id = ?', [result.insertId]);
    res.status(201).json(created);
  } catch (err) {
    console.error('[POST /palmares]', err.code || '', err.sqlMessage || err.message);
    res.status(500).json({ error: 'Erreur lors de l\'ajout : ' + (err.sqlMessage || err.message) });
  }
});

// PUT /api/palmares/:id
router.put('/:id', requireAuth, requireModo, async (req, res) => {
  const p = req.body;
  try {
    await query(
      `UPDATE palmares SET annee=?, titre=?, evenement=?, categorie=?, rang=?, medaille=?, equipe=?, sortie_id=?
       WHERE id=?`,
      [p.annee, p.titre || null, p.evenement || null, p.categorie || null, p.rang || null,
       p.medaille || null, p.equipe || null, p.sortie_id || null, req.params.id]
    );
    const [updated] = await query('SELECT * FROM palmares WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('[PUT /palmares/:id]', err.code || '', err.sqlMessage || err.message);
    res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) });
  }
});

// DELETE /api/palmares/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM palmares WHERE id = ?', [req.params.id]);
    res.json({ message: 'Supprimé' });
  } catch (err) {
    console.error('[DELETE /palmares/:id]', err.code || '', err.sqlMessage || err.message);
    res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) });
  }
});

module.exports = router;
