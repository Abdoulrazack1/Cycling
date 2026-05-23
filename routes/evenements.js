/* ═════════════════════════════════════════════════════════════════
   routes/evenements.js — Événements + inscriptions
   GET    /api/evenements                liste paginée + filtres
   GET    /api/evenements/:id            détail + inscrits
   POST   /api/evenements                création (modo+)
   PUT    /api/evenements/:id            édition (modo+)
   DELETE /api/evenements/:id            suppression (admin)
   POST   /api/evenements/:id/inscrire   inscription publique (mail confirm)
   POST   /api/evenements/inscriptions/purge   purge RGPD événements terminés
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { query, withTransaction, pageClause } = require('../config/database');
const { requireAuth, requireAdmin, requireModo, optionalAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { audit } = require('../services/audit-log');
const mailer    = require('../services/mailer');
const { errResponse } = require('../lib/errors');
const logger = require('../lib/logger');
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
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
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
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[GET /evenements/:id]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
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
    audit(req, 'create', 'evenement', result.insertId, { title: e.title, date: e.date, type: e.type });
    res.status(201).json(created);
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

router.put('/:id', requireAuth, requireModo, [
  body('title').optional().notEmpty().trim().isLength({ max: 200 }),
  body('date').optional().isDate().withMessage('Date au format YYYY-MM-DD'),
  body('type').optional().isIn(['cyclosportive','gravel','criterium','course','rando','championnat','autre']),
  body('distance_km').optional({ nullable: true }).isInt({ min: 0, max: 9999 }),
  body('max_inscrits').optional({ nullable: true }).isInt({ min: 1, max: 100000 }),
  body('engagement_eur').optional({ nullable: true }).isFloat({ min: 0, max: 9999 }),
  body('statut').optional().isIn(['ouvert','complet','termine','annule','archive']),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
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
    audit(req, 'update', 'evenement', req.params.id, { title: e.title, date: e.date, statut: e.statut });
    res.json(updated);
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM evenements WHERE id = ?', [req.params.id]);
    audit(req, 'delete', 'evenement', req.params.id);
    res.json({ message: 'Événement supprimé' });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

// POST /api/evenements/:id/inscrire
//
// Cf. AUDIT item #9 — l'ancienne version avait :
//   1. INSERT puis UPDATE séparés (pas de transaction → counter peut dériver)
//   2. test « ev.inscrits + 1 >= max_inscrits » sur snapshot stale
//      (sous concurrence, deux requêtes simultanées passaient toutes les deux)
//   3. dénormalisation inutile : `inscrits` est calculable depuis la table.
// Maintenant : tout dans withTransaction, count recalculé après l'INSERT,
// auto-complet en WHERE atomique.
router.post('/:id/inscrire', optionalAuth, [
  body('prenom').notEmpty().trim().isLength({ max: 50 }),
  body('nom').notEmpty().trim().isLength({ max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('telephone').optional().trim().isLength({ max: 20 }).matches(/^[0-9 +\-().]*$/),
  body('categorie').optional().trim().isLength({ max: 50 }),
  body('distance').optional().isInt({ min: 1, max: 1000 }).toInt()
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    const result = await withTransaction(async (conn) => {
      // SELECT FOR UPDATE pour sérialiser les inscriptions concurrentes sur
      // un même événement (évite que deux clients franchissent le max ensemble).
      const [evRows] = await conn.execute(
        'SELECT id, statut, max_inscrits FROM evenements WHERE id = ? FOR UPDATE',
        [req.params.id]
      );
      const ev = evRows[0];
      if (!ev) { const e = new Error('Événement introuvable'); e.status = 404; throw e; }
      if (ev.statut === 'complet') { const e = new Error('Événement complet'); e.status = 409; throw e; }
      if (ev.statut === 'annule')  { const e = new Error('Événement annulé');  e.status = 409; throw e; }
      if (ev.statut === 'termine') { const e = new Error('Événement terminé'); e.status = 410; throw e; }

      // Recompter avant insert pour vérifier la place
      const [[{ cnt }]] = await conn.execute(
        "SELECT COUNT(*) AS cnt FROM evenement_inscriptions WHERE evenement_id = ? AND statut != 'annule'",
        [ev.id]
      );
      if (ev.max_inscrits && cnt >= ev.max_inscrits) {
        // Marquer complet et refuser
        await conn.execute("UPDATE evenements SET statut='complet' WHERE id=?", [ev.id]);
        const e = new Error('Événement complet'); e.status = 409; throw e;
      }

      const { prenom, nom, email, telephone, categorie, distance } = req.body;
      const [ins] = await conn.execute(
        `INSERT INTO evenement_inscriptions (evenement_id,user_id,prenom,nom,email,telephone,categorie,distance)
         VALUES (?,?,?,?,?,?,?,?)`,
        [ev.id, req.user?.id || null, prenom, nom, email, telephone||null, categorie||null, distance||null]
      );

      // Mettre à jour le compteur dénormalisé (gardé pour rétrocompat UI)
      // ET basculer en 'complet' si on vient d'atteindre max_inscrits.
      const newCnt = cnt + 1;
      const newStatut = (ev.max_inscrits && newCnt >= ev.max_inscrits) ? 'complet' : ev.statut;
      await conn.execute(
        'UPDATE evenements SET inscrits=?, statut=? WHERE id=?',
        [newCnt, newStatut, ev.id]
      );

      return { id: ins.insertId, inscrits: newCnt, complet: newStatut === 'complet', email, prenom, evTitle: ev.title, evDate: ev.date, evLieu: ev.lieu };
    });
    // Fire-and-forget : envoi de la confirmation par mail (ne bloque pas la réponse)
    if (result.email) {
      mailer.sendInscriptionConfirmation({
        to: result.email,
        prenom: result.prenom,
        evenementTitle: result.evTitle,
        evenementDate:  result.evDate,
        lieu:           result.evLieu,
      }).catch(err => logger.warn({ err: err.message }, '[inscription] mail échec'));
    }
    res.status(201).json({ message: 'Inscription confirmée', id: result.id, inscrits: result.inscrits, complet: result.complet });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[POST /evenements/:id/inscrire]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
});

// ── POST /api/evenements/inscriptions/purge ───────────────────
// Purge RGPD : supprime les inscriptions dont l'événement est terminé
// depuis plus de N jours (défaut 365). Réservé aux admins, à lancer
// périodiquement (cron, ou bouton dans l'admin UI).
// Cf. AUDIT item #20 — sans cette purge, les emails de non-membres
// s'accumulent indéfiniment dans `evenement_inscriptions`.
router.post('/inscriptions/purge', requireAuth, requireAdmin, async (req, res) => {
  const days = Math.max(30, parseInt(req.body?.days) || 365);
  const dryRun = req.body?.dryRun !== false; // default ON pour éviter les boulettes
  try {
    const sql = `
      SELECT i.id, i.email, i.created_at, e.title AS evenement, e.date AS evenement_date
      FROM evenement_inscriptions i
      JOIN evenements e ON e.id = i.evenement_id
      WHERE e.statut = 'termine'
        AND e.date < DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `;
    const rows = await query(sql, [days]);
    if (dryRun) {
      return res.json({ dryRun: true, count: rows.length, sample: rows.slice(0, 10) });
    }
    if (rows.length === 0) return res.json({ dryRun: false, deleted: 0 });
    const ids = rows.map(r => r.id);
    // DELETE par batch de 100 pour ne pas locker la table
    let deleted = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const placeholders = batch.map(() => '?').join(',');
      const result = await query(
        `DELETE FROM evenement_inscriptions WHERE id IN (${placeholders})`,
        batch
      );
      deleted += result.affectedRows || 0;
    }
    res.json({ dryRun: false, deleted, days });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[POST /evenements/inscriptions/purge]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
});

module.exports = router;
