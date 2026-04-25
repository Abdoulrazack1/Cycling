// routes/segments.js
const express = require('express');
const { query } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM segments_global ORDER BY stars DESC, name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const s = req.body;
  try {
    const result = await query(
      `INSERT INTO segments_global (name, location, stars, length_m, meilleur_temps,
        delta_moyenne, rang, rang_cls, kom, sortie_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [s.name, s.location||null, s.stars||3, s.length_m||null,
       s.meilleur_temps||null, s.delta_moyenne||null, s.rang||null,
       s.rang_cls||null, s.kom?1:0, s.sortie_id||null]
    );
    const [created] = await query('SELECT * FROM segments_global WHERE id = ?', [result.insertId]);
    res.status(201).json(created);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const s = req.body;
  try {
    await query(
      `UPDATE segments_global SET name=?, location=?, stars=?, length_m=?, meilleur_temps=?,
        delta_moyenne=?, rang=?, rang_cls=?, kom=?, sortie_id=? WHERE id=?`,
      [s.name, s.location||null, s.stars||3, s.length_m||null,
       s.meilleur_temps||null, s.delta_moyenne||null, s.rang||null,
       s.rang_cls||null, s.kom?1:0, s.sortie_id||null, req.params.id]
    );
    const [updated] = await query('SELECT * FROM segments_global WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM segments_global WHERE id = ?', [req.params.id]);
    res.json({ message: 'Segment supprimé' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;
