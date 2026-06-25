/* ═════════════════════════════════════════════════════════════════
   controllers/evenements.js — Événements + inscriptions
   ═════════════════════════════════════════════════════════════════ */

const { query, withTransaction, pageClause } = require('../config/database');
const { body, validationResult } = require('express-validator');
const { audit } = require('../services/audit-log');
const mailer = require('../services/mailer');
const { errResponse } = require('../lib/errors');
const logger = require('../lib/logger');

const createValidators = [
  body('title').notEmpty().trim(),
  body('date').isDate(),
  body('type').isIn(['cyclosportive','gravel','criterium','course','rando','championnat','autre'])
];
const updateValidators = [
  body('title').optional().notEmpty().trim().isLength({ max: 200 }),
  body('date').optional().isDate().withMessage('Date au format YYYY-MM-DD'),
  body('type').optional().isIn(['cyclosportive','gravel','criterium','course','rando','championnat','autre']),
  body('distance_km').optional({ nullable: true }).isInt({ min: 0, max: 9999 }),
  body('max_inscrits').optional({ nullable: true }).isInt({ min: 1, max: 100000 }),
  body('engagement_eur').optional({ nullable: true }).isFloat({ min: 0, max: 9999 }),
  body('statut').optional().isIn(['ouvert','complet','termine','annule','archive']),
];
const inscrireValidators = [
  body('prenom').notEmpty().trim().isLength({ max: 50 }),
  body('nom').notEmpty().trim().isLength({ max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('telephone').optional().trim().isLength({ max: 20 }).matches(/^[0-9 +\-().]*$/),
  body('categorie').optional().trim().isLength({ max: 50 }),
  body('distance').optional().isInt({ min: 1, max: 1000 }).toInt()
];

// GET /api/evenements
async function list(req, res) {
  try {
    const { statut, limit = 20, offset = 0 } = req.query;
    let sql = 'SELECT * FROM evenements WHERE 1=1';
    const params = [];
    if (statut && statut !== 'undefined' && statut !== 'null') { sql += ' AND statut = ?'; params.push(statut); }
    sql += ' ORDER BY date ASC' + pageClause(limit, offset, { defaultLimit: 20, maxLimit: 100 });
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
}

// GET /api/evenements/:id/ical — export iCalendar (.ics)
async function ical(req, res) {
  try {
    const idOrSlug = req.params.id;
    const isNumeric = /^\d+$/.test(idOrSlug);
    const [ev] = await query(
      isNumeric
        ? 'SELECT * FROM evenements WHERE id = ?'
        : 'SELECT * FROM evenements WHERE slug = ? OR id = ?',
      isNumeric ? [parseInt(idOrSlug)] : [idOrSlug, idOrSlug]
    );
    if (!ev) return res.status(404).send('Événement introuvable');

    function fmtUtc(d) {
      return new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    }
    function esc(s) {
      // Échappement iCal RFC 5545
      return String(s ?? '').replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n');
    }
    const start = ev.date;
    const startUtc = fmtUtc(start);
    const endDate = new Date(start);
    endDate.setHours(endDate.getHours() + 4); // durée par défaut 4h
    const endUtc = fmtUtc(endDate);
    const uid = `${ev.slug || ev.id}@cc-salouel.fr`;
    const url = `${req.protocol}://${req.get('host')}/evenement.html?id=${encodeURIComponent(ev.slug || ev.id)}`;

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//C.C. Salouel//Evenements//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${fmtUtc(new Date())}`,
      `DTSTART:${startUtc}`,
      `DTEND:${endUtc}`,
      `SUMMARY:${esc(ev.title)}`,
      ev.description ? `DESCRIPTION:${esc(ev.description)}` : '',
      ev.lieu ? `LOCATION:${esc(ev.lieu)}` : '',
      `URL:${esc(url)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${ev.slug || ev.id}.ics"`);
    res.send(ics);
  } catch (err) {
    req.log?.error({ err }, '[ical export]');
    res.status(500).send('Erreur génération iCal');
  }
}

// GET /api/evenements/:id — détail + inscrits
async function getOne(req, res) {
  try {
    const idOrSlug = req.params.id;
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
}

// POST /api/evenements — création (modo+)
async function create(req, res) {
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
}

// PUT /api/evenements/:id — édition (modo+)
async function update(req, res) {
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
}

// DELETE /api/evenements/:id — suppression (admin)
async function remove(req, res) {
  try {
    await query('DELETE FROM evenements WHERE id = ?', [req.params.id]);
    audit(req, 'delete', 'evenement', req.params.id);
    res.json({ message: 'Événement supprimé' });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
}

// POST /api/evenements/:id/inscrire — inscription publique (transactionnelle)
// Cf. AUDIT item #9 : SELECT FOR UPDATE + recompte atomique pour éviter le
// dépassement de capacité sous concurrence.
async function inscrire(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    const result = await withTransaction(async (conn) => {
      const [evRows] = await conn.execute(
        'SELECT id, statut, max_inscrits, title, date, lieu FROM evenements WHERE id = ? FOR UPDATE',
        [req.params.id]
      );
      const ev = evRows[0];
      if (!ev) { const e = new Error('Événement introuvable'); e.status = 404; throw e; }
      if (ev.statut === 'complet') { const e = new Error('Événement complet'); e.status = 409; throw e; }
      if (ev.statut === 'annule')  { const e = new Error('Événement annulé');  e.status = 409; throw e; }
      if (ev.statut === 'termine') { const e = new Error('Événement terminé'); e.status = 410; throw e; }

      const [[{ cnt }]] = await conn.execute(
        "SELECT COUNT(*) AS cnt FROM evenement_inscriptions WHERE evenement_id = ? AND statut != 'annule'",
        [ev.id]
      );
      if (ev.max_inscrits && cnt >= ev.max_inscrits) {
        await conn.execute("UPDATE evenements SET statut='complet' WHERE id=?", [ev.id]);
        const e = new Error('Événement complet'); e.status = 409; throw e;
      }

      const { prenom, nom, email, telephone, categorie, distance } = req.body;
      const [ins] = await conn.execute(
        `INSERT INTO evenement_inscriptions (evenement_id,user_id,prenom,nom,email,telephone,categorie,distance)
         VALUES (?,?,?,?,?,?,?,?)`,
        [ev.id, req.user?.id || null, prenom, nom, email, telephone||null, categorie||null, distance||null]
      );

      const newCnt = cnt + 1;
      const newStatut = (ev.max_inscrits && newCnt >= ev.max_inscrits) ? 'complet' : ev.statut;
      await conn.execute(
        'UPDATE evenements SET inscrits=?, statut=? WHERE id=?',
        [newCnt, newStatut, ev.id]
      );

      return { id: ins.insertId, inscrits: newCnt, complet: newStatut === 'complet', email, prenom, evTitle: ev.title, evDate: ev.date, evLieu: ev.lieu };
    });
    // Fire-and-forget : confirmation par mail (ne bloque pas la réponse)
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
}

// POST /api/evenements/inscriptions/purge — purge RGPD (admin)
async function purge(req, res) {
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
}

module.exports = {
  list, ical, getOne, create, update, remove, inscrire, purge,
  createValidators, updateValidators, inscrireValidators,
};
