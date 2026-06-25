/* controllers/pois.js — Points d'intérêt d'une sortie (relatif à :sortieId) */
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { body, validationResult } = require('express-validator');
const { errResponse } = require('../lib/errors');

function formatPoi(row) {
  return {
    id: row.id, type: row.type, label: row.label,
    desc: row.description,
    km: row.km != null ? parseFloat(row.km) : null,
    lat: parseFloat(row.lat), lng: parseFloat(row.lng),
    contact: (row.contact_name || row.contact_phone)
      ? { name: row.contact_name, phone: row.contact_phone }
      : undefined,
    _userAdded: !!row.user_added
  };
}

const createValidators = [
  body('type').isIn(['signaleur','ravito','danger','secteur','depart','arrivee']),
  body('label').notEmpty().trim(),
  body('lat').isFloat({ min: -90,  max: 90  }),
  body('lng').isFloat({ min: -180, max: 180 }),
  body('km').isFloat({ min: 0 }).optional({ nullable: true })
];

// GET /api/sorties/:sortieId/pois
async function list(req, res) {
  try {
    const rows = await query(
      'SELECT * FROM pois WHERE sortie_id = ? ORDER BY km',
      [req.params.sortieId]
    );
    res.json(rows.map(formatPoi));
  } catch (err) {
    req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// POST /api/sorties/:sortieId/pois
async function create(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const { type, label, desc, km, lat, lng, contact } = req.body;
  const { sortieId } = req.params;

  try {
    // Vérifier que la sortie existe
    const [sortie] = await query('SELECT id FROM sorties WHERE id = ?', [sortieId]);
    if (!sortie) return res.status(404).json({ error: 'Sortie introuvable' });

    const id = 'user-' + uuidv4().slice(0, 8);
    await query(
      `INSERT INTO pois (id, sortie_id, type, label, description, km, lat, lng,
        contact_name, contact_phone, user_added, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, sortieId, type, label, desc || null,
        km ?? null, lat, lng,
        contact?.name || null, contact?.phone || null,
        1, req.user.id
      ]
    );

    const [row] = await query('SELECT * FROM pois WHERE id = ?', [id]);
    res.status(201).json(formatPoi(row));
  } catch (err) {
    req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// POST /api/sorties/:sortieId/pois/bulk — remplace les POIs système (admin)
async function bulkReplace(req, res) {
  const { pois } = req.body;
  if (!Array.isArray(pois)) return res.status(400).json({ error: 'pois doit être un tableau' });
  const { sortieId } = req.params;

  try {
    // Supprimer les POIs non-utilisateur
    await query('DELETE FROM pois WHERE sortie_id = ? AND user_added = FALSE', [sortieId]);

    for (const p of pois) {
      await query(
        `INSERT INTO pois (id, sortie_id, type, label, description, km, lat, lng,
          contact_name, contact_phone, user_added, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          p.id || 'sys-' + uuidv4().slice(0,8),
          sortieId, p.type, p.label, p.desc || null,
          p.km ?? null, p.lat, p.lng,
          p.contact?.name || null, p.contact?.phone || null,
          0, req.user.id
        ]
      );
    }
    const rows = await query('SELECT * FROM pois WHERE sortie_id = ? ORDER BY km', [sortieId]);
    res.json(rows.map(formatPoi));
  } catch (err) {
    req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// PUT /api/sorties/:sortieId/pois/:poiId
async function update(req, res) {
  const { sortieId, poiId } = req.params;
  try {
    const [poi] = await query('SELECT * FROM pois WHERE id = ? AND sortie_id = ?', [poiId, sortieId]);
    if (!poi) return res.status(404).json({ error: 'POI introuvable' });

    // Seul l'admin/modo peut modifier les POIs système ; un membre ne peut modifier que les siens
    const isAdmin = ['admin','moderateur'].includes(req.user.role);
    if (!isAdmin && poi.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const { type, label, desc, km, lat, lng, contact } = req.body;
    await query(
      `UPDATE pois SET type=?, label=?, description=?, km=?, lat=?, lng=?,
        contact_name=?, contact_phone=? WHERE id=?`,
      [type, label, desc || null, km ?? null, lat, lng,
       contact?.name || null, contact?.phone || null, poiId]
    );

    const [updated] = await query('SELECT * FROM pois WHERE id = ?', [poiId]);
    res.json(formatPoi(updated));
  } catch (err) {
    req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// DELETE /api/sorties/:sortieId/pois/:poiId
async function remove(req, res) {
  const { sortieId, poiId } = req.params;
  try {
    const [poi] = await query('SELECT * FROM pois WHERE id = ? AND sortie_id = ?', [poiId, sortieId]);
    if (!poi) return res.status(404).json({ error: 'POI introuvable' });

    const isAdmin = ['admin','moderateur'].includes(req.user.role);
    if (!isAdmin && poi.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    await query('DELETE FROM pois WHERE id = ?', [poiId]);
    res.json({ message: 'POI supprimé' });
  } catch (err) {
    req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

module.exports = { formatPoi, createValidators, list, create, bulkReplace, update, remove };
