/* ═════════════════════════════════════════════════════════════════
   controllers/sorties.js — CRUD complet des sorties (+ GPX, photos, POIs)
   ═════════════════════════════════════════════════════════════════ */

const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const { query, withTransaction, pageClause } = require('../config/database');
const { body, validationResult } = require('express-validator');
const { parseGpx, haversineMeters } = require('../services/gpx-parser');
const { parseStravaCueSheet } = require('../utils/parse-strava-cue');
const { audit } = require('../services/audit-log');
const { GPX_DIR: ASSET_GPX_DIR, isLikelyGpx } = require('../middleware/upload');
const { errResponse } = require('../lib/errors');
const { sanitizeTitleHtml } = require('../lib/sanitize-title-html');
const { sniffImage } = require('../lib/image-sniff');
const logger = require('../lib/logger');
const { notifyMany } = require('../controllers/notifications');

// Racine des assets servis (pour résoudre photo.url / hero_img = "asset/...").
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

const GPX_MIME_TYPES_IMPORT = new Set([
  'application/gpx+xml', 'application/xml', 'text/xml',
  'application/octet-stream', '',
]);

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (parseInt(process.env.MAX_GPX_SIZE_MB) || 10) * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.gpx') {
      return cb(new Error('Extension .gpx requise'), false);
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!GPX_MIME_TYPES_IMPORT.has(mime)) {
      return cb(new Error(`MIME type invalide : ${file.mimetype}`), false);
    }
    cb(null, true);
  }
});

// Stockage photos sur disque dans public/asset/img/sorties/{sortie_id}/...
const SORTIES_PHOTOS_DIR = path.join(__dirname, '..', '..', 'public', 'asset', 'img', 'sorties');
if (!fs.existsSync(SORTIES_PHOTOS_DIR)) fs.mkdirSync(SORTIES_PHOTOS_DIR, { recursive: true });

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error('Format image accepté : JPEG, PNG, WebP, GIF'));
    }
    cb(null, true);
  },
});

// ── Middlewares d'upload (wrappés pour traduire les erreurs multer) ──
function uploadGpxPreview(req, res, next) {
  importUpload.single('gpx')(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'Upload GPX échoué : ' + err.message });
    next();
  });
}
function uploadGpxImport(req, res, next) {
  importUpload.single('gpx')(req, res, (err) => {
    if (err) {
      logger.error({ err }, '[import-gpx] multer error:');
      return res.status(400).json({ error: 'Upload GPX échoué : ' + err.message });
    }
    next();
  });
}
function uploadPhotos(req, res, next) {
  photoUpload.array('photos', 8)(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'Upload échoué : ' + err.message });
    next();
  });
}

// ── Helpers ─────────────────────────────────────────────────────
function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
function suggestDurationLabel(distance_km) {
  if (!distance_km) return null;
  const totalMin = Math.round((distance_km / 25) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

async function buildSortie(row) {
  if (!row) return null;
  const [tags, stats, segments] = await Promise.all([
    query('SELECT type, label FROM sortie_tags WHERE sortie_id = ? ORDER BY sort_order', [row.id]),
    query('SELECT label, value, unit, cls FROM sortie_stats_extra WHERE sortie_id = ? ORDER BY sort_order', [row.id]),
    query('SELECT idx, name, sub, stars, length_m, time, delta, delta_cls, `rank` FROM sortie_segments WHERE sortie_id = ? ORDER BY idx', [row.id])
  ]);
  return _shapeSortie(row, { tags, stats, segments });
}

async function buildSortiesList(rows) {
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const [allTags, allStats, allSegs] = await Promise.all([
    query(`SELECT sortie_id, type, label FROM sortie_tags WHERE sortie_id IN (${placeholders}) ORDER BY sort_order`, ids),
    query(`SELECT sortie_id, label, value, unit, cls FROM sortie_stats_extra WHERE sortie_id IN (${placeholders}) ORDER BY sort_order`, ids),
    query(`SELECT sortie_id, idx, name, sub, stars, length_m, time, delta, delta_cls, \`rank\` FROM sortie_segments WHERE sortie_id IN (${placeholders}) ORDER BY idx`, ids),
  ]);
  const groupBy = (arr, key) => {
    const m = new Map();
    for (const r of arr) {
      if (!m.has(r[key])) m.set(r[key], []);
      const { [key]: _, ...rest } = r;
      m.get(r[key]).push(rest);
    }
    return m;
  };
  const tagsBy = groupBy(allTags, 'sortie_id');
  const statsBy = groupBy(allStats, 'sortie_id');
  const segsBy = groupBy(allSegs, 'sortie_id');
  return rows.map(row => _shapeSortie(row, {
    tags:     tagsBy.get(row.id) || [],
    stats:    statsBy.get(row.id) || [],
    segments: segsBy.get(row.id) || []
  }));
}

function _shapeSortie(row, { tags, stats, segments }) {
  return {
    id: row.id, slug: row.slug, title: row.title,
    title_html: row.title_html || row.title, subtitle: row.subtitle,
    chapter: row.chapter, description: row.description,
    date: row.date, date_label: row.date_label,
    distance_km: row.distance_km, duration_label: row.duration_label,
    elevation_gain: row.elevation_gain, elevation_loss: row.elevation_loss,
    elevation_max: row.elevation_max, elevation_min: row.elevation_min,
    tss: row.tss, np_w: row.np_w, pave_km: row.pave_km, secteurs: row.secteurs,
    hero_img: row.hero_img, card_img: row.card_img,
    location: { name: row.location_name, lat: parseFloat(row.location_lat), lng: parseFloat(row.location_lng) },
    gpx_ref: row.gpx_filename, number: row.number,
    featured: !!row.featured, statut: row.statut,
    tags, stats_extra: stats, segments
  };
}

// ── Validators ──────────────────────────────────────────────────
const createValidators = [
  body('id').notEmpty().matches(/^[a-z0-9-]+$/)
    .withMessage("ID invalide : minuscules, chiffres et tirets uniquement (ex: 'tour-avesnois-2026')"),
  body('title').notEmpty().trim().withMessage('Titre requis'),
  body('title_html').optional({ nullable: true }).isLength({ max: 250 }),
  body('date').isDate().withMessage('Date au format YYYY-MM-DD requise'),
  body('distance_km').isNumeric().optional({ nullable: true }).withMessage('Distance doit être numérique'),
];
const updateValidators = [
  body('title').optional().notEmpty().trim().isLength({ max: 200 }),
  body('title_html').optional({ nullable: true }).isLength({ max: 250 }),
  body('date').optional().isDate().withMessage('Date au format YYYY-MM-DD'),
  body('distance_km').optional({ nullable: true }).isFloat({ min: 0, max: 9999 }),
  body('elevation_gain').optional({ nullable: true }).isInt({ min: 0, max: 99999 }),
  body('elevation_loss').optional({ nullable: true }).isInt({ min: 0, max: 99999 }),
  body('statut').optional().isIn(['passee','en_cours','future']),
  body('location.lat').optional({ nullable: true }).isFloat({ min: -90,  max: 90 }),
  body('location.lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
];

// ── GET /api/sorties ────────────────────────────────────────────
async function list(req, res) {
  try {
    const { statut, limit = 50, offset = 0, featured } = req.query;
    let countSql = 'SELECT COUNT(*) AS cnt FROM sorties WHERE 1=1';
    let sql      = 'SELECT * FROM sorties WHERE 1=1';
    const params = [], countParams = [];

    if (statut && statut !== 'undefined' && statut !== 'null') {
      const clause = ' AND statut = ?';
      sql += clause; countSql += clause;
      params.push(statut); countParams.push(statut);
    }
    if (featured === 'true') {
      const clause = ' AND featured = TRUE';
      sql += clause; countSql += clause;
    }
    sql += ' ORDER BY date DESC' + pageClause(limit, offset, { defaultLimit: 50, maxLimit: 200 });

    const [rows, [{ cnt }]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    const sorties = await buildSortiesList(rows);
    res.json({ sorties, total: cnt });
  } catch (err) {
    req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// ── GET /api/sorties/:id (par id puis slug) ─────────────────────
async function getOne(req, res) {
  try {
    const lookup = req.params.id;
    let rows = await query('SELECT * FROM sorties WHERE id = ?', [lookup]);
    if (rows.length === 0) {
      rows = await query('SELECT * FROM sorties WHERE slug = ? ORDER BY date DESC LIMIT 1', [lookup]);
    }
    if (rows.length === 0) return res.status(404).json({ error: `Sortie "${lookup}" introuvable` });
    const sortie = await buildSortie(rows[0]);
    res.json(sortie);
  } catch (err) {
    req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// ── POST /api/sorties ───────────────────────────────────────────
async function create(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    const arr = errs.array();
    return res.status(400).json({ error: arr.map(e => `${e.path || e.param}: ${e.msg}`).join(' · '), errors: arr });
  }

  const s = req.body;
  try {
    const existingRows = await query('SELECT id FROM sorties WHERE id = ?', [s.id]);
    if (existingRows.length > 0) return res.status(409).json({ error: `ID "${s.id}" déjà utilisé` });

    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO sorties (id, slug, title, title_html, subtitle, chapter, description,
          date, date_label, distance_km, duration_label, elevation_gain, elevation_loss,
          elevation_max, elevation_min, tss, np_w, pave_km, secteurs, hero_img, card_img,
          location_name, location_lat, location_lng, gpx_filename, number, featured, statut, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          s.id, s.slug || s.id, s.title, sanitizeTitleHtml(s.title_html) || s.title,
          s.subtitle || null, s.chapter || 'route', s.description || null,
          s.date, s.date_label || null, s.distance_km || null, s.duration_label || null,
          s.elevation_gain || null, s.elevation_loss || null,
          s.elevation_max || null, s.elevation_min || null,
          s.tss || null, s.np_w || null, s.pave_km || null, s.secteurs || null,
          s.hero_img || `asset/img/hero-${s.chapter || 'route'}.svg`, s.card_img || null,
          s.location?.name || null, s.location?.lat || null, s.location?.lng || null,
          s.gpx_ref || null, s.number || null,
          s.featured ? 1 : 0, s.statut || 'passee', req.user.id
        ]
      );

      if (s.tags?.length) {
        for (let i = 0; i < s.tags.length; i++) {
          const t = s.tags[i];
          await conn.execute('INSERT INTO sortie_tags (sortie_id, type, label, sort_order) VALUES (?,?,?,?)', [s.id, t.type, t.label, i]);
        }
      }
      if (s.stats_extra?.length) {
        for (let i = 0; i < s.stats_extra.length; i++) {
          const st = s.stats_extra[i];
          await conn.execute('INSERT INTO sortie_stats_extra (sortie_id, label, value, unit, cls, sort_order) VALUES (?,?,?,?,?,?)', [s.id, st.label, st.value, st.unit || null, st.cls || null, i]);
        }
      }
      if (s.segments?.length) {
        for (const seg of s.segments) {
          await conn.execute(
            `INSERT INTO sortie_segments (sortie_id, idx, name, sub, stars, length_m, time, delta, delta_cls, \`rank\`)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [s.id, seg.idx, seg.name, seg.sub || null, seg.stars || 3, seg.length_m || null, seg.time || null, seg.delta || null, seg.delta_cls || null, seg.rank || null]
          );
        }
      }
    });

    const sortie = await buildSortie((await query('SELECT * FROM sorties WHERE id = ?', [s.id]))[0]);
    audit(req, 'create', 'sortie', s.id, { title: s.title, date: s.date });
    res.status(201).json(sortie);
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[POST /sorties]');
    errResponse(req, res, err, 500, 'Erreur lors de la création :');
  }
}

// ── PUT /api/sorties/:id ────────────────────────────────────────
async function update(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  const { id } = req.params;
  const s = req.body;
  try {
    const [existing] = await query('SELECT id FROM sorties WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Sortie introuvable' });

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE sorties SET
          slug=?, title=?, title_html=?, subtitle=?, chapter=?, description=?,
          date=?, date_label=?, distance_km=?, duration_label=?,
          elevation_gain=?, elevation_loss=?, elevation_max=?, elevation_min=?,
          tss=?, np_w=?, pave_km=?, secteurs=?, hero_img=?, card_img=?,
          location_name=?, location_lat=?, location_lng=?,
          gpx_filename=?, number=?, featured=?, statut=?
        WHERE id=?`,
        [
          s.slug || id, s.title, sanitizeTitleHtml(s.title_html) || s.title,
          s.subtitle || null, s.chapter || null, s.description || null,
          s.date, s.date_label || null, s.distance_km || null, s.duration_label || null,
          s.elevation_gain || null, s.elevation_loss || null, s.elevation_max || null, s.elevation_min || null,
          s.tss || null, s.np_w || null, s.pave_km || null, s.secteurs || null,
          s.hero_img || null, s.card_img || null,
          s.location?.name || null, s.location?.lat || null, s.location?.lng || null,
          s.gpx_ref || null, s.number || null,
          s.featured ? 1 : 0, s.statut || 'passee', id
        ]
      );

      await conn.execute('DELETE FROM sortie_tags WHERE sortie_id = ?', [id]);
      await conn.execute('DELETE FROM sortie_stats_extra WHERE sortie_id = ?', [id]);
      await conn.execute('DELETE FROM sortie_segments WHERE sortie_id = ?', [id]);

      if (s.tags?.length) {
        for (let i = 0; i < s.tags.length; i++) {
          const t = s.tags[i];
          await conn.execute('INSERT INTO sortie_tags (sortie_id, type, label, sort_order) VALUES (?,?,?,?)', [id, t.type, t.label, i]);
        }
      }
      if (s.stats_extra?.length) {
        for (let i = 0; i < s.stats_extra.length; i++) {
          const st = s.stats_extra[i];
          await conn.execute('INSERT INTO sortie_stats_extra (sortie_id, label, value, unit, cls, sort_order) VALUES (?,?,?,?,?,?)', [id, st.label, st.value, st.unit || null, st.cls || null, i]);
        }
      }
      if (s.segments?.length) {
        for (const seg of s.segments) {
          await conn.execute(
            `INSERT INTO sortie_segments (sortie_id, idx, name, sub, stars, length_m, time, delta, delta_cls, \`rank\`)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [id, seg.idx, seg.name, seg.sub || null, seg.stars || 3, seg.length_m || null, seg.time || null, seg.delta || null, seg.delta_cls || null, seg.rank || null]
          );
        }
      }
    });

    const sortie = await buildSortie((await query('SELECT * FROM sorties WHERE id = ?', [id]))[0]);
    audit(req, 'update', 'sortie', id, { title: s.title, date: s.date, statut: s.statut });

    // Notifie les membres inscrits que la sortie a été modifiée
    try {
      const inscrits = await query(
        "SELECT user_id FROM sortie_inscriptions WHERE sortie_id = ? AND statut = 'inscrit'",
        [id]
      );
      const ids = inscrits.map(r => r.user_id);
      if (ids.length) {
        await notifyMany(ids, 'sortie.updated',
          `Sortie "${sortie.title}" mise à jour`,
          'Un changement a été apporté à cette sortie. Vérifie les détails.',
          `/sortie.html?id=${encodeURIComponent(id)}`);
      }
    } catch (e) { req.log?.warn({ err: e.message }, '[notif] sortie.updated'); }

    res.json(sortie);
  } catch (err) {
    req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// ── DELETE /api/sorties/:id (+ nettoyage GPX/photos orphelins) ──
async function remove(req, res) {
  try {
    const [row] = await query('SELECT id, title, gpx_filename FROM sorties WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Sortie introuvable' });
    await query('DELETE FROM sorties WHERE id = ?', [req.params.id]);
    audit(req, 'delete', 'sortie', row.id, { title: row.title, gpx: row.gpx_filename || null });

    // GPX : supprimé seulement s'il n'est plus référencé par AUCUNE autre sortie.
    if (row.gpx_filename) {
      try {
        const [stillUsed] = await query('SELECT 1 FROM sorties WHERE gpx_filename = ? LIMIT 1', [row.gpx_filename]);
        if (!stillUsed) {
          const gpxPath = path.join(ASSET_GPX_DIR, row.gpx_filename);
          if (fs.existsSync(gpxPath)) fs.unlinkSync(gpxPath);
        }
      } catch (cleanErr) {
        logger.warn({ err: cleanErr.message, gpx: row.gpx_filename }, '[DELETE /sorties/:id] nettoyage GPX échoué');
      }
    }
    // Photos : tout le dossier de la sortie devient orphelin.
    try {
      const photosDir = path.join(SORTIES_PHOTOS_DIR, String(row.id));
      if (fs.existsSync(photosDir)) fs.rmSync(photosDir, { recursive: true, force: true });
    } catch (cleanErr) {
      logger.warn({ err: cleanErr.message, id: row.id }, '[DELETE /sorties/:id] nettoyage photos échoué');
    }

    res.json({ message: 'Sortie supprimée', id: row.id, title: row.title });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[DELETE /sorties/:id]');
    errResponse(req, res, err, 500, 'Erreur serveur :');
  }
}

// ── Photos ──────────────────────────────────────────────────────
async function photosList(req, res) {
  try {
    const rows = await query(
      'SELECT id, url, caption, sort_order, created_at FROM sortie_photos WHERE sortie_id = ? ORDER BY sort_order, id',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur récupération photos');
  }
}

async function photosUpload(req, res) {
  try {
    const [sortie] = await query('SELECT id FROM sorties WHERE id = ?', [req.params.id]);
    if (!sortie) return res.status(404).json({ error: 'Sortie introuvable' });
    if (!req.files?.length) return res.status(400).json({ error: 'Aucune photo' });

    const dir = path.join(SORTIES_PHOTOS_DIR, req.params.id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const [maxRow] = await query('SELECT COALESCE(MAX(sort_order), 0) AS m FROM sortie_photos WHERE sortie_id = ?', [req.params.id]);
    let sortOrder = (maxRow?.m || 0) + 10;

    const inserted = [];
    for (const file of req.files) {
      // cf. AUDIT #3 — ne pas se fier au MIME déclaré : sniffer le contenu
      // réel (magic bytes) et dériver l'extension du type RÉEL, pas du nom
      // fourni par le client (bloque un .svg/<script> déguisé en image/png).
      const sniffed = sniffImage(file.buffer);
      if (!sniffed) {
        return res.status(400).json({ error: 'Fichier image invalide ou format non supporté (JPEG, PNG, WebP, GIF)' });
      }
      const ext = sniffed.ext;
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const filepath = path.join(dir, filename);
      fs.writeFileSync(filepath, file.buffer);
      const url = `asset/img/sorties/${req.params.id}/${filename}`;
      const r = await query(
        'INSERT INTO sortie_photos (sortie_id, url, caption, sort_order, created_by) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, url, req.body.caption || null, sortOrder, req.user.id]
      );
      inserted.push({ id: r.insertId, url, caption: req.body.caption || null, sort_order: sortOrder });
      sortOrder += 10;
    }
    res.status(201).json({ added: inserted.length, photos: inserted });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur upload photos');
  }
}

async function photoDelete(req, res) {
  try {
    const rows = await query(
      'SELECT id, url FROM sortie_photos WHERE id = ? AND sortie_id = ?',
      [req.params.photoId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Photo introuvable' });
    const photo = rows[0];
    // photo.url = "asset/img/sorties/{id}/{file}" → résolu sous public/.
    const filepath = path.join(PUBLIC_DIR, photo.url);
    try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); } catch {}
    await query('DELETE FROM sortie_photos WHERE id = ?', [photo.id]);
    res.json({ ok: true });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur suppression photo');
  }
}

// ── POST /api/sorties/cue-from-text ─────────────────────────────
async function cueFromText(req, res) {
  try {
    const { sortieId, ocrText, replace } = req.body || {};
    if (!sortieId) return res.status(400).json({ error: 'sortieId requis' });
    if (!ocrText) return res.status(400).json({ error: 'ocrText requis' });

    const [s] = await query('SELECT id, gpx_filename FROM sorties WHERE id = ?', [sortieId]);
    if (!s) return res.status(404).json({ error: 'Sortie introuvable' });
    if (!s.gpx_filename) return res.status(400).json({ error: 'Cette sortie n\'a pas de GPX — impossible de projeter les directions' });

    const gpxPath = path.join(ASSET_GPX_DIR, s.gpx_filename);
    if (!fs.existsSync(gpxPath)) return res.status(404).json({ error: 'GPX fichier manquant' });
    const xml = fs.readFileSync(gpxPath, 'utf8');
    const m = parseGpx(xml);
    if (!m.points?.length) return res.status(400).json({ error: 'GPX sans trackpoints' });

    // NB: ce handler utilise le parser du service strava-pdf-parser (pas celui
    // de utils/parse-strava-cue importé en tête — comportement d'origine préservé).
    const { parseStravaCueSheet, projectDirectionsOnGpx } = require('../services/strava-pdf-parser');
    const directions = parseStravaCueSheet(ocrText);
    if (!directions.length) {
      return res.status(400).json({ error: 'Aucune direction reconnue dans le texte OCR.', hint: 'Vérifier que le PDF est bien un export Strava avec cue-sheet.' });
    }

    const projected = projectDirectionsOnGpx(directions, m.points, haversineMeters);

    if (replace) {
      await query('DELETE FROM pois WHERE sortie_id = ?', [sortieId]);
    }

    let inserted = 0;
    for (const p of projected) {
      const id = 'p-cue-' + crypto.randomBytes(5).toString('hex');
      await query(
        `INSERT INTO pois (id, sortie_id, type, label, description, lat, lng, km, user_added)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
        [id, sortieId, p.type, p.label, p.description, p.lat, p.lng, p.km]
      );
      inserted++;
    }

    audit(req, 'create', 'pois-bulk', sortieId, { count: inserted, source: 'strava-cue' });
    res.json({ ok: true, directionsParsed: directions.length, poisCreated: inserted, projected });
  } catch (err) {
    req.log?.error({ err }, '[cue-from-text]');
    errResponse(req, res, err, 500, 'Erreur cue-sheet');
  }
}

// ── POST /api/sorties/preview-gpx ───────────────────────────────
async function previewGpx(req, res) {
  try {
    if (!req.file?.buffer?.length) return res.status(400).json({ error: 'Fichier GPX manquant ou vide' });
    if (!isLikelyGpx(req.file.buffer)) return res.status(400).json({ error: 'Contenu GPX invalide' });
    const xml = req.file.buffer.toString('utf8');
    let m;
    try { m = parseGpx(xml); }
    catch (err) { return res.status(400).json({ error: 'GPX invalide : ' + err.message }); }

    const nameMatch = xml.match(/<trk>\s*<name>([^<]+)<\/name>/i) || xml.match(/<metadata>[\s\S]*?<name>([^<]+)<\/name>/i);
    const suggestedTitle = nameMatch ? nameMatch[1].trim() : null;

    const warnings = [];
    if (m.points.length < 10) warnings.push('Très peu de points (' + m.points.length + ') — tracé peut-être inutilisable');
    if (m.distance_km < 1)    warnings.push('Distance courte (' + m.distance_km + ' km) — vérifier que c\'est bien le bon fichier');
    if (m.points.filter(p => p.ele != null).length < m.points.length * 0.5) {
      warnings.push('Plus de la moitié des points n\'ont pas d\'altitude — profil altimétrique limité');
    }
    if (m.distance_km > 500) warnings.push('Distance très longue (' + m.distance_km + ' km) — confirmer');

    res.json({
      ok: true,
      suggested_title: suggestedTitle,
      metrics: {
        points_count: m.points.length, distance_km: m.distance_km,
        elevation_gain: m.elevation_gain, elevation_loss: m.elevation_loss,
        start: m.start, end: m.end, bbox: m.bbox,
      },
      warnings,
      file: { name: req.file.originalname, size: req.file.size },
    });
  } catch (err) {
    req.log?.error({ err }, '[preview-gpx]');
    errResponse(req, res, err, 500, 'Erreur preview');
  }
}

// ── POST /api/sorties/import-gpx ────────────────────────────────
async function importGpx(req, res) {
  logger.info('[import-gpx] Démarrage import par user', req.user?.id, req.user?.username);
  logger.info('[import-gpx] Fields reçus:', Object.keys(req.body || {}));
  logger.info('[import-gpx] Fichier:', req.file ? `${req.file.originalname} (${req.file.size} octets)` : 'AUCUN');

  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier GPX manquant (champ "gpx" du formulaire)' });
    if (!req.file.buffer || req.file.buffer.length === 0) return res.status(400).json({ error: 'Fichier GPX vide' });
    if (!isLikelyGpx(req.file.buffer)) {
      return res.status(400).json({ error: 'Contenu GPX invalide (XML/<gpx> introuvable dans le fichier)' });
    }
    const title = req.body.title?.trim();
    const date  = req.body.date;
    if (!title) return res.status(400).json({ error: 'Titre requis' });
    if (!date)  return res.status(400).json({ error: 'Date requise (YYYY-MM-DD)' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: `Date au mauvais format : "${date}". Attendu YYYY-MM-DD.` });
    }

    const xml = req.file.buffer.toString('utf8');
    let metrics;
    try {
      metrics = parseGpx(xml);
      logger.info(`[import-gpx] GPX parsé : ${metrics.points.length} points, ${metrics.distance_km} km, D+${metrics.elevation_gain} m`);
    } catch (err) {
      logger.error({ err }, '[import-gpx] parse error:');
      return res.status(400).json({ error: `GPX invalide : ${err.message}` });
    }

    const slug = (req.body.slug?.trim() || slugify(title));
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: `Slug invalide : "${slug}". Attendu : lettres minuscules, chiffres, tirets.` });
    }
    const id = `${slug}-${date}`;
    logger.info(`[import-gpx] id="${id}", slug="${slug}"`);

    const existingRows = await query('SELECT id FROM sorties WHERE id = ? OR slug = ?', [id, slug]);
    if (existingRows.length > 0) {
      return res.status(409).json({ error: `Une sortie avec ce slug ou cet id existe déjà (${existingRows[0].id}). Changez le titre, la date ou le slug.` });
    }

    const gpxFilename = `${slug}.gpx`;
    const gpxPath     = path.join(ASSET_GPX_DIR, gpxFilename);
    try {
      fs.writeFileSync(gpxPath, req.file.buffer);
      logger.info(`[import-gpx] GPX écrit dans ${gpxPath}`);
    } catch (err) {
      return errResponse(req, res, err, 500, 'Impossible d\'écrire le fichier GPX sur le serveur');
    }

    const titleLower = title.toLowerCase();
    let chapter = req.body.chapter || 'route';
    if (/contre.?la.?montre|\bclm\b|prologue|chrono/.test(titleLower)) chapter = 'clm';
    else if (/pav[éeè]|roubaix|arenberg/.test(titleLower))             chapter = 'pave';
    else if (/mont|kemmel|flandre|hellingen/.test(titleLower))         chapter = 'monts';
    else if (/gravel|chemin|for[êe]t|scarpe/.test(titleLower))         chapter = 'gravel';
    else if (/c[ôo]te|opale|cap\b|bord de mer/.test(titleLower))       chapter = 'cote';

    const heroMap = {
      route: 'asset/img/img-route.webp', gravel: 'asset/img/img-gravel.webp',
      cote: 'asset/img/img-cote.webp', monts: 'asset/img/img-monts.webp',
      pave: 'asset/img/img-pave.webp', peloton: 'asset/img/img-peloton.webp',
      clm: 'asset/img/img-clm.webp',
    };
    const sortieData = {
      id, slug, title, title_html: title,
      subtitle: req.body.subtitle?.trim() || null, chapter,
      description: req.body.description?.trim() || null,
      date, date_label: null,
      distance_km: metrics.distance_km,
      duration_label: req.body.duration_label?.trim() || suggestDurationLabel(metrics.distance_km),
      elevation_gain: metrics.elevation_gain, elevation_loss: metrics.elevation_loss,
      elevation_max: metrics.elevation_max, elevation_min: metrics.elevation_min,
      hero_img: req.body.hero_img || heroMap[chapter] || heroMap.route,
      card_img: req.body.card_img || heroMap[chapter] || heroMap.route,
      location_name: req.body.location_name?.trim() || null,
      location_lat: metrics.start.lat, location_lng: metrics.start.lng,
      gpx_filename: gpxFilename,
      number: parseInt(req.body.number) || null,
      featured: req.body.featured === 'true' || req.body.featured === true ? 1 : 0,
      statut: req.body.statut === 'future' ? 'future' : 'passee',
    };

    try {
      await query(
        `INSERT INTO sorties (id, slug, title, title_html, subtitle, chapter, description,
          date, date_label, distance_km, duration_label, elevation_gain, elevation_loss,
          elevation_max, elevation_min, hero_img, card_img,
          location_name, location_lat, location_lng, gpx_filename, number, featured, statut, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          sortieData.id, sortieData.slug, sortieData.title, sortieData.title_html,
          sortieData.subtitle, sortieData.chapter, sortieData.description,
          sortieData.date, sortieData.date_label, sortieData.distance_km,
          sortieData.duration_label, sortieData.elevation_gain, sortieData.elevation_loss,
          sortieData.elevation_max, sortieData.elevation_min,
          sortieData.hero_img, sortieData.card_img,
          sortieData.location_name, sortieData.location_lat, sortieData.location_lng,
          sortieData.gpx_filename, sortieData.number,
          sortieData.featured, sortieData.statut, req.user.id
        ]
      );
      logger.info(`[import-gpx] INSERT OK : sortie ${id} créée`);
    } catch (err) {
      logger.error('[import-gpx] INSERT error:', err.code, err.sqlMessage || err.message);
      try { fs.unlinkSync(gpxPath); } catch {}
      errResponse(req, res, err, 500, 'Insertion en base échouée :');
    }

    // Cue sheet Strava (optionnel) → POIs directions
    let poisCreated = 0;
    const cueSheet = req.body.cue_sheet?.trim();
    if (cueSheet) {
      const directions = parseStravaCueSheet(cueSheet);
      if (directions.length > 0) {
        const pts = metrics.points;
        const kmAt = new Float64Array(pts.length);
        let acc = 0;
        for (let i = 1; i < pts.length; i++) {
          acc += haversineMeters(pts[i - 1], pts[i]);
          kmAt[i] = acc / 1000;
        }
        const gpxTotalKm = kmAt[pts.length - 1] || metrics.distance_km;
        const cueTotalKm = directions[directions.length - 1].km || gpxTotalKm;
        const scale = cueTotalKm > 0 ? gpxTotalKm / cueTotalKm : 1;

        for (let i = 0; i < directions.length; i++) {
          const d = directions[i];
          const targetKm = Math.min(d.km * scale, gpxTotalKm);
          let bestIdx = 0, bestDiff = Math.abs(kmAt[0] - targetKm);
          for (let j = 1; j < kmAt.length; j++) {
            const diff = Math.abs(kmAt[j] - targetKm);
            if (diff < bestDiff) { bestDiff = diff; bestIdx = j; }
          }
          const pt = pts[bestIdx];
          const poiId = `${slug}-d${String(i + 1).padStart(2, '0')}`;
          try {
            await query(
              `INSERT INTO pois (id, sortie_id, type, label, description, km, lat, lng, user_added, created_by)
               VALUES (?,?,?,?,?,?,?,?,FALSE,?)`,
              [poiId, id, d.type, d.label, d.desc, d.km, pt.lat, pt.lng, req.user.id]
            );
            poisCreated++;
          } catch (poiErr) {
            logger.error('[import-gpx] POI insert error:', poiErr.code, poiErr.sqlMessage || poiErr.message);
          }
        }
        logger.info(`[import-gpx] ${poisCreated}/${directions.length} POI(s) directions créés`);
      }
    }

    const [row] = await query('SELECT * FROM sorties WHERE id = ?', [id]);
    const sortie = await buildSortie(row);
    res.status(201).json({
      sortie,
      gpx_metrics: {
        points_count: metrics.points.length, distance_km: metrics.distance_km,
        elevation_gain: metrics.elevation_gain, elevation_loss: metrics.elevation_loss,
        start: metrics.start, end: metrics.end, bbox: metrics.bbox,
      },
      pois_created: poisCreated,
    });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur lors de l\'import GPX');
  }
}

// ── GET /api/sorties/orphan-gpx/list ────────────────────────────
async function orphanGpxList(req, res) {
  try {
    const files = fs.readdirSync(ASSET_GPX_DIR).filter(f => f.toLowerCase().endsWith('.gpx'));
    if (files.length === 0) return res.json({ orphans: [], total_files: 0 });

    const rows = await query('SELECT gpx_filename FROM sorties WHERE gpx_filename IS NOT NULL');
    const used = new Set(rows.map(r => r.gpx_filename));

    const orphans = [];
    for (const f of files) {
      if (used.has(f)) continue;
      const stat = fs.statSync(path.join(ASSET_GPX_DIR, f));
      let metrics = null;
      try {
        const xml = fs.readFileSync(path.join(ASSET_GPX_DIR, f), 'utf8');
        const m = parseGpx(xml);
        metrics = { distance_km: m.distance_km, elevation_gain: m.elevation_gain, points_count: m.points.length, start: m.start, name_from_gpx: m.name };
      } catch (e) {
        metrics = { error: 'GPX invalide : ' + e.message };
      }
      orphans.push({
        filename: f, size_bytes: stat.size, modified: stat.mtime.toISOString(),
        suggested_slug: f.replace(/\.gpx$/i, ''), metrics
      });
    }
    res.json({ orphans, total_files: files.length, used_count: used.size });
  } catch (err) {
    logger.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[GET /orphan-gpx]');
    errResponse(req, res, err, 500, 'Erreur serveur');
  }
}

// ── GET /api/sorties/:id/diagnose ───────────────────────────────
async function diagnose(req, res) {
  try {
    const lookup = req.params.id;
    let rows = await query('SELECT * FROM sorties WHERE id = ?', [lookup]);
    if (rows.length === 0) {
      rows = await query('SELECT * FROM sorties WHERE slug = ? ORDER BY date DESC LIMIT 1', [lookup]);
    }
    if (rows.length === 0) {
      return res.status(404).json({ error: `Sortie "${lookup}" introuvable en base`, suggestion: 'Vérifiez l\'URL ou réimportez la sortie depuis l\'admin.' });
    }
    const row = rows[0];
    const checks = [];

    if (!row.gpx_filename) {
      checks.push({ status: 'error', message: 'Champ gpx_filename est NULL en base — la sortie n\'a aucun fichier GPX rattaché.' });
    } else {
      const gpxPath = path.join(ASSET_GPX_DIR, row.gpx_filename);
      if (!fs.existsSync(gpxPath)) {
        checks.push({ status: 'error', message: `Fichier GPX "${row.gpx_filename}" déclaré en base mais ABSENT du disque (cherché dans ${gpxPath}).`, suggestion: 'Réimportez le fichier GPX depuis le formulaire admin, ou supprimez puis recréez la sortie.' });
      } else {
        const stat = fs.statSync(gpxPath);
        if (stat.size === 0) {
          checks.push({ status: 'error', message: `Fichier GPX "${row.gpx_filename}" présent mais VIDE (0 octets).` });
        } else {
          try {
            const xml = fs.readFileSync(gpxPath, 'utf8');
            const m = parseGpx(xml);
            checks.push({ status: 'ok', message: `GPX OK : ${m.points.length} points, ${m.distance_km} km, D+${m.elevation_gain} m, départ (${m.start.lat}, ${m.start.lng}).` });
          } catch (err) {
            checks.push({ status: 'error', message: `GPX corrompu : ${err.message}` });
          }
        }
      }
    }

    if (!row.location_lat || !row.location_lng) {
      checks.push({ status: 'warning', message: `Coordonnées de départ manquantes (location_lat=${row.location_lat}, location_lng=${row.location_lng}). La carte centrera sur le Nord par défaut.` });
    } else {
      checks.push({ status: 'ok', message: `Coords départ : ${row.location_lat}, ${row.location_lng}` });
    }

    if (!row.hero_img) {
      checks.push({ status: 'warning', message: 'Aucune image hero — fond noir.' });
    } else {
      const heroPath = path.join(PUBLIC_DIR, row.hero_img);
      if (fs.existsSync(heroPath)) {
        checks.push({ status: 'ok', message: `Image hero OK : ${row.hero_img}` });
      } else {
        checks.push({ status: 'warning', message: `Image hero "${row.hero_img}" introuvable sur disque.` });
      }
    }

    const pois = await query('SELECT COUNT(*) as cnt FROM pois WHERE sortie_id = ?', [row.id]);
    checks.push({ status: 'ok', message: `${pois[0].cnt} POI(s) rattaché(s) à cette sortie.` });

    const required = ['id', 'title', 'date', 'distance_km'];
    const missing = required.filter(f => row[f] === null || row[f] === undefined);
    if (missing.length) {
      checks.push({ status: 'warning', message: `Champs vides : ${missing.join(', ')}` });
    }

    res.json({
      sortie: { id: row.id, slug: row.slug, title: row.title, gpx_filename: row.gpx_filename },
      checks,
      summary: {
        errors: checks.filter(c => c.status === 'error').length,
        warnings: checks.filter(c => c.status === 'warning').length,
        ok: checks.filter(c => c.status === 'ok').length
      },
      view_url: `/sortie.html?id=${encodeURIComponent(row.id)}`
    });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur diagnostic');
  }
}

module.exports = {
  // middlewares
  uploadGpxPreview, uploadGpxImport, uploadPhotos,
  // validators
  createValidators, updateValidators,
  // handlers
  list, getOne, create, update, remove,
  photosList, photosUpload, photoDelete,
  cueFromText, previewGpx, importGpx, orphanGpxList, diagnose,
};
