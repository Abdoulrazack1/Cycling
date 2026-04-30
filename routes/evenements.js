// routes/evenements.js
const express = require('express');
const { query, withTransaction, pageClause } = require('../config/database');
const { requireAuth, requireAdmin, requireModo, optionalAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// GET /api/evenements
router.get('/', async (req, res) => {
  try {
    const { statut, limit = 20, offset = 0 } = req.query;
    let sql = 'SELECT * FROM evenements WHERE 1=1';
    const params = [];
    if (statut && statut !== 'undefined' && statut !== 'null') { sql += ' AND statut = ?'; params.push(statut); }
    sql += ' ORDER BY date ASC' + pageClause(limit, offset, { defaultLimit: 20, maxLimit: 100 });
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) { console.error('[' + req.method + ' ' + req.originalUrl + ']', err.code || '', err.sqlMessage || err.message); res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message), code: err.code }); }
});

router.get('/:id', async (req, res) => {
  try {
    const idOrSlug = req.params.id;
    // Si c'est un nombre, recherche par id ; sinon par slug
    const isNumeric = /^\d+$/.test(idOrSlug);
    const [ev] = await query(
      isNumeric
        ? 'SELECT * FROM evenements WHERE id = ?'
        : 'SELECT * FROM evenements WHERE slug = ? OR id = ?',
      isNumeric ? [parseInt(idOrSlug)] : [idOrSlug, idOrSlug]
    );
    if (!ev) return res.status(404).json({ error: 'Événement introuvable' });
    const inscrits = await query(
      'SELECT id, prenom, nom, categorie, distance, statut FROM evenement_inscriptions WHERE evenement_id = ? AND statut != "annule"',
      [ev.id]
    );
    res.json({ ...ev, inscriptions: inscrits });
  } catch (err) {
    console.error('[GET /evenements/:id]', err.code || '', err.sqlMessage || err.message);
    res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) });
  }
});

router.post('/', requireAuth, requireModo, [
  body('title').notEmpty().trim(),
  body('date').isDate(),
  body('type').isIn(['cyclosportive','gravel','criterium','course','rando','championnat','autre'])
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  const e = req.body;
  try {
    const result = await query(
      `INSERT INTO evenements (slug,title,title_html,subtitle,type,date,heure,lieu,region,
        distance_km,description,inscrits,max_inscrits,engagement_eur,sortie_id,hero_img,statut)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        e.slug || e.title.toLowerCase().replace(/\s+/g,'-').slice(0,100),
        e.title, e.title_html||e.title, e.subtitle||null, e.type,
        e.date, e.heure||null, e.lieu||null, e.region||null,
        e.distance_km||null, e.description||null,
        e.inscrits||0, e.max_inscrits||null, e.engagement_eur||null,
        e.sortie_id||null, e.hero_img||null, e.statut||'ouvert'
      ]
    );
    const [created] = await query('SELECT * FROM evenements WHERE id = ?', [result.insertId]);
    res.status(201).json(created);
  } catch (err) { console.error('[' + req.method + ' ' + req.originalUrl + ']', err.code || '', err.sqlMessage || err.message); res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message), code: err.code }); }
});

router.put('/:id', requireAuth, requireModo, async (req, res) => {
  const e = req.body;
  try {
    await query(
      `UPDATE evenements SET title=?,title_html=?,subtitle=?,type=?,date=?,heure=?,lieu=?,
        region=?,distance_km=?,description=?,max_inscrits=?,engagement_eur=?,
        sortie_id=?,hero_img=?,statut=? WHERE id=?`,
      [
        e.title, e.title_html||e.title, e.subtitle||null, e.type,
        e.date, e.heure||null, e.lieu||null, e.region||null,
        e.distance_km||null, e.description||null,
        e.max_inscrits||null, e.engagement_eur||null,
        e.sortie_id||null, e.hero_img||null, e.statut||'ouvert',
        req.params.id
      ]
    );
    const [updated] = await query('SELECT * FROM evenements WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) { console.error('[' + req.method + ' ' + req.originalUrl + ']', err.code || '', err.sqlMessage || err.message); res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) }); }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM evenements WHERE id = ?', [req.params.id]);
    res.json({ message: 'Événement supprimé' });
  } catch (err) { console.error('[' + req.method + ' ' + req.originalUrl + ']', err.code || '', err.sqlMessage || err.message); res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) }); }
});

// POST /api/evenements/:id/inscrire
router.post('/:id/inscrire', optionalAuth, [
  body('prenom').notEmpty().trim(),
  body('nom').notEmpty().trim(),
  body('email').isEmail()
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    const [ev] = await query('SELECT * FROM evenements WHERE id = ?', [req.params.id]);
    if (!ev) return res.status(404).json({ error: 'Événement introuvable' });
    if (ev.statut === 'complet') return res.status(409).json({ error: 'Événement complet' });
    if (ev.statut === 'annule') return res.status(409).json({ error: 'Événement annulé' });
    if (ev.statut === 'termine') return res.status(409).json({ error: 'Événement terminé' });

    const { prenom, nom, email, telephone, categorie, distance } = req.body;
    const result = await query(
      `INSERT INTO evenement_inscriptions (evenement_id,user_id,prenom,nom,email,telephone,categorie,distance)
       VALUES (?,?,?,?,?,?,?,?)`,
      [ev.id, req.user?.id || null, prenom, nom, email, telephone||null, categorie||null, distance||null]
    );
    // Incrémenter compteur
    await query('UPDATE evenements SET inscrits = inscrits + 1 WHERE id = ?', [ev.id]);
    // Auto-complet si max atteint
    if (ev.max_inscrits && ev.inscrits + 1 >= ev.max_inscrits) {
      await query('UPDATE evenements SET statut = "complet" WHERE id = ?', [ev.id]);
    }
    res.status(201).json({ message: 'Inscription confirmée', id: result.insertId });
  } catch (err) { console.error('[' + req.method + ' ' + req.originalUrl + ']', err.code || '', err.sqlMessage || err.message); res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message), code: err.code }); }
});

module.exports = router;
