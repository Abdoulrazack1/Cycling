// routes/sorties.js — CRUD complet des sorties
const express = require('express');
const { query, withTransaction, pageClause } = require('../config/database');
const { requireAuth, requireAdmin, requireModo } = require('../middleware/auth');
const { body, param, query: qv, validationResult } = require('express-validator');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────

// Reconstruit une sortie complète depuis les tables normalisées
async function buildSortie(row) {
  if (!row) return null;
  const [tags, stats, segments] = await Promise.all([
    query('SELECT type, label FROM sortie_tags WHERE sortie_id = ? ORDER BY sort_order', [row.id]),
    query('SELECT label, value, unit, cls FROM sortie_stats_extra WHERE sortie_id = ? ORDER BY sort_order', [row.id]),
    query('SELECT idx, name, sub, stars, length_m, time, delta, delta_cls, `rank` FROM sortie_segments WHERE sortie_id = ? ORDER BY idx', [row.id])
  ]);
  return {
    id:             row.id,
    slug:           row.slug,
    title:          row.title,
    title_html:     row.title_html || row.title,
    subtitle:       row.subtitle,
    chapter:        row.chapter,
    description:    row.description,
    date:           row.date,
    date_label:     row.date_label,
    distance_km:    row.distance_km,
    duration_label: row.duration_label,
    elevation_gain: row.elevation_gain,
    elevation_loss: row.elevation_loss,
    elevation_max:  row.elevation_max,
    elevation_min:  row.elevation_min,
    tss:            row.tss,
    np_w:           row.np_w,
    pave_km:        row.pave_km,
    secteurs:       row.secteurs,
    hero_img:       row.hero_img,
    card_img:       row.card_img,
    location: {
      name: row.location_name,
      lat:  parseFloat(row.location_lat),
      lng:  parseFloat(row.location_lng)
    },
    gpx_ref:        row.gpx_filename,
    number:         row.number,
    featured:       !!row.featured,
    statut:         row.statut,
    tags, stats_extra: stats, segments
  };
}

// ── GET /api/sorties ──────────────────────────────────────────
router.get('/', async (req, res) => {
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

    const [rows, [{ cnt }]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);
    const sorties = await Promise.all(rows.map(buildSortie));
    res.json({ sorties, total: cnt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /api/sorties/:id ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [row] = await query('SELECT * FROM sorties WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Sortie introuvable' });
    const sortie = await buildSortie(row);
    res.json(sortie);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/sorties ─────────────────────────────────────────
router.post('/', requireAuth, requireModo, [
  body('id').notEmpty().matches(/^[a-z0-9-]+$/),
  body('title').notEmpty().trim(),
  body('date').isDate(),
  body('distance_km').isNumeric().optional({ nullable: true }),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const s = req.body;
  try {
    // Vérifier unicité de l'id
    const [existing] = await query('SELECT id FROM sorties WHERE id = ?', [s.id]);
    if (existing) return res.status(409).json({ error: 'ID déjà utilisé' });

    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO sorties (id, slug, title, title_html, subtitle, chapter, description,
          date, date_label, distance_km, duration_label, elevation_gain, elevation_loss,
          elevation_max, elevation_min, tss, np_w, pave_km, secteurs, hero_img, card_img,
          location_name, location_lat, location_lng, gpx_filename, number, featured, statut, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          s.id, s.slug || s.id, s.title, s.title_html || s.title,
          s.subtitle || null, s.chapter || null, s.description || null,
          s.date, s.date_label || null, s.distance_km || null, s.duration_label || null,
          s.elevation_gain || null, s.elevation_loss || null,
          s.elevation_max || null, s.elevation_min || null,
          s.tss || null, s.np_w || null, s.pave_km || null, s.secteurs || null,
          s.hero_img || null, s.card_img || null,
          s.location?.name || null, s.location?.lat || null, s.location?.lng || null,
          s.gpx_ref || null, s.number || null,
          s.featured ? 1 : 0, s.statut || 'passee', req.user.id
        ]
      );

      // Tags
      if (s.tags?.length) {
        for (let i = 0; i < s.tags.length; i++) {
          const t = s.tags[i];
          await conn.execute(
            'INSERT INTO sortie_tags (sortie_id, type, label, sort_order) VALUES (?,?,?,?)',
            [s.id, t.type, t.label, i]
          );
        }
      }

      // Stats extra
      if (s.stats_extra?.length) {
        for (let i = 0; i < s.stats_extra.length; i++) {
          const st = s.stats_extra[i];
          await conn.execute(
            'INSERT INTO sortie_stats_extra (sortie_id, label, value, unit, cls, sort_order) VALUES (?,?,?,?,?,?)',
            [s.id, st.label, st.value, st.unit || null, st.cls || null, i]
          );
        }
      }

      // Segments
      if (s.segments?.length) {
        for (const seg of s.segments) {
          await conn.execute(
            `INSERT INTO sortie_segments (sortie_id, idx, name, sub, stars, length_m, time, delta, delta_cls, \`rank\`)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [s.id, seg.idx, seg.name, seg.sub || null, seg.stars || 3,
             seg.length_m || null, seg.time || null, seg.delta || null,
             seg.delta_cls || null, seg.rank || null]
          );
        }
      }
    });

    const sortie = await buildSortie((await query('SELECT * FROM sorties WHERE id = ?', [s.id]))[0]);
    res.status(201).json(sortie);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── PUT /api/sorties/:id ──────────────────────────────────────
router.put('/:id', requireAuth, requireModo, async (req, res) => {
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
          tss=?, np_w=?, pave_km=?, secteurs=?,
          hero_img=?, card_img=?,
          location_name=?, location_lat=?, location_lng=?,
          gpx_filename=?, number=?, featured=?, statut=?
        WHERE id=?`,
        [
          s.slug || id, s.title, s.title_html || s.title,
          s.subtitle || null, s.chapter || null, s.description || null,
          s.date, s.date_label || null,
          s.distance_km || null, s.duration_label || null,
          s.elevation_gain || null, s.elevation_loss || null,
          s.elevation_max || null, s.elevation_min || null,
          s.tss || null, s.np_w || null, s.pave_km || null, s.secteurs || null,
          s.hero_img || null, s.card_img || null,
          s.location?.name || null, s.location?.lat || null, s.location?.lng || null,
          s.gpx_ref || null, s.number || null,
          s.featured ? 1 : 0, s.statut || 'passee',
          id
        ]
      );

      // Supprimer et recréer les sous-tables
      await conn.execute('DELETE FROM sortie_tags WHERE sortie_id = ?', [id]);
      await conn.execute('DELETE FROM sortie_stats_extra WHERE sortie_id = ?', [id]);
      await conn.execute('DELETE FROM sortie_segments WHERE sortie_id = ?', [id]);

      if (s.tags?.length) {
        for (let i = 0; i < s.tags.length; i++) {
          const t = s.tags[i];
          await conn.execute(
            'INSERT INTO sortie_tags (sortie_id, type, label, sort_order) VALUES (?,?,?,?)',
            [id, t.type, t.label, i]
          );
        }
      }
      if (s.stats_extra?.length) {
        for (let i = 0; i < s.stats_extra.length; i++) {
          const st = s.stats_extra[i];
          await conn.execute(
            'INSERT INTO sortie_stats_extra (sortie_id, label, value, unit, cls, sort_order) VALUES (?,?,?,?,?,?)',
            [id, st.label, st.value, st.unit || null, st.cls || null, i]
          );
        }
      }
      if (s.segments?.length) {
        for (const seg of s.segments) {
          await conn.execute(
            `INSERT INTO sortie_segments (sortie_id, idx, name, sub, stars, length_m, time, delta, delta_cls, \`rank\`)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [id, seg.idx, seg.name, seg.sub || null, seg.stars || 3,
             seg.length_m || null, seg.time || null, seg.delta || null,
             seg.delta_cls || null, seg.rank || null]
          );
        }
      }
    });

    const sortie = await buildSortie((await query('SELECT * FROM sorties WHERE id = ?', [id]))[0]);
    res.json(sortie);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── DELETE /api/sorties/:id ───────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [row] = await query('SELECT id FROM sorties WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Sortie introuvable' });
    await query('DELETE FROM sorties WHERE id = ?', [req.params.id]);
    res.json({ message: 'Sortie supprimée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;