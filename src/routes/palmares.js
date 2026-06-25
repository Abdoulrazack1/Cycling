/* ═════════════════════════════════════════════════════════════════
   routes/palmares.js — Palmarès (résultats de course)
   GET    /api/palmares        liste + filtres (annee, membre_id)
   POST   /api/palmares        ajout d'un résultat (modo+)
   PUT    /api/palmares/:id    édition (modo+)
   DELETE /api/palmares/:id    suppression (admin)
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { query, pageClause } = require('../config/database');
const { requireAuth, requireAdmin, requireModo } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { audit } = require('../services/audit-log');
const { errResponse } = require('../lib/errors');
const logger = require('../lib/logger');
const router = express.Router();

// GET /api/palmares
// Retourne soit un array (par défaut, plus simple côté client),
// soit un objet groupé { palmares, byYear } si ?grouped=1.
router.get('/', async (req, res) => {
  try {
    const { annee, grouped, limit = 100, offset = 0 } = req.query;
    let sql = 'SELECT * FROM palmares WHERE 1=1';
    const params = [];
    if (annee) { sql += ' AND annee = ?'; params.push(parseInt(annee)); }
    sql += ' ORDER BY annee DESC, FIELD(medaille, "gold", "silver", "bronze", "") ASC, rang ASC';
    sql += pageClause(limit, offset, { defaultLimit: 100, maxLimit: 500 });
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
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[GET /palmares]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
});

// POST /api/palmares
router.post('/', requireAuth, requireModo, [
  body('annee').isInt({ min: 1978, max: 2100 }).withMessage('Année invalide'),
  body('evenement').notEmpty().trim().withMessage('Événement requis'),
  // Cf. AUDIT item #10 — refuser 'or'/'argent' côté API plutôt que de
  // s'en remettre au sql_mode pour rejeter les valeurs ENUM invalides.
  body('medaille').optional({ nullable: true }).isIn(['gold','silver','bronze'])
    .withMessage("medaille doit être 'gold', 'silver' ou 'bronze'"),
  body('rang').optional({ nullable: true }).isLength({ max: 20 }),
  body('categorie').optional({ nullable: true }).isLength({ max: 100 }),
  body('equipe').optional({ nullable: true }).isLength({ max: 50 }),
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
    audit(req, 'create', 'palmares', result.insertId, { annee: p.annee, evenement: p.evenement, medaille: p.medaille });
    res.status(201).json(created);
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur lors de l\'ajout');
  }
});

// PUT /api/palmares/:id
router.put('/:id', requireAuth, requireModo, [
  body('annee').optional().isInt({ min: 1978, max: 2100 }),
  body('medaille').optional({ nullable: true }).isIn(['gold','silver','bronze']),
  body('rang').optional({ nullable: true }).isLength({ max: 20 }),
  body('equipe').optional({ nullable: true }).isLength({ max: 50 }),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  const p = req.body;
  try {
    await query(
      `UPDATE palmares SET annee=?, titre=?, evenement=?, categorie=?, rang=?, medaille=?, equipe=?, sortie_id=?
       WHERE id=?`,
      [p.annee, p.titre || null, p.evenement || null, p.categorie || null, p.rang || null,
       p.medaille || null, p.equipe || null, p.sortie_id || null, req.params.id]
    );
    const [updated] = await query('SELECT * FROM palmares WHERE id = ?', [req.params.id]);
    audit(req, 'update', 'palmares', req.params.id, { annee: p.annee, evenement: p.evenement });
    res.json(updated);
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[PUT /palmares/:id]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
});

// DELETE /api/palmares/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM palmares WHERE id = ?', [req.params.id]);
    audit(req, 'delete', 'palmares', req.params.id);
    res.json({ message: 'Supprimé' });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[DELETE /palmares/:id]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
});

module.exports = router;
