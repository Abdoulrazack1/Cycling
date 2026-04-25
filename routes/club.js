// routes/club.js
const express = require('express');
const { query } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT cle, valeur FROM club_settings');
    const settings = Object.fromEntries(rows.map(r => [r.cle, r.valeur]));
    res.json(settings);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    for (const [cle, valeur] of Object.entries(req.body)) {
      await query(
        'INSERT INTO club_settings (cle, valeur) VALUES (?,?) ON DUPLICATE KEY UPDATE valeur=?',
        [cle, String(valeur), String(valeur)]
      );
    }
    const rows = await query('SELECT cle, valeur FROM club_settings');
    res.json(Object.fromEntries(rows.map(r => [r.cle, r.valeur])));
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;
