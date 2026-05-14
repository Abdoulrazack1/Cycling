// routes/club.js
const express = require('express');
const { query } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const logger = require('../lib/logger');
const router = express.Router();

// Whitelist des clés acceptées pour club_settings (cf. AUDIT item #17).
// Sans ça, n'importe quel admin pouvait polluer la table avec des clés
// arbitraires (pas une faille de sécurité grave, mais bombe à dette).
const ALLOWED_KEYS = new Set([
  'name', 'founded', 'president', 'licencies',
  'address', 'email', 'phone', 'sortie_day',
  'instagram', 'strava', 'facebook', 'twitter',
  'description', 'logo_url'
]);
const MAX_VALUE_LEN = 1000;

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT cle, valeur FROM club_settings');
    const settings = Object.fromEntries(rows.map(r => [r.cle, r.valeur]));
    res.json(settings);
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) }); }
});

router.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rejected = [];
    const accepted = [];
    for (const [cle, valeur] of Object.entries(req.body || {})) {
      if (!ALLOWED_KEYS.has(cle)) { rejected.push(cle); continue; }
      const v = String(valeur ?? '');
      if (v.length > MAX_VALUE_LEN) { rejected.push(cle + ' (>1000 chars)'); continue; }
      await query(
        'INSERT INTO club_settings (cle, valeur) VALUES (?,?) ON DUPLICATE KEY UPDATE valeur=?',
        [cle, v, v]
      );
      accepted.push(cle);
    }
    const rows = await query('SELECT cle, valeur FROM club_settings');
    res.json({
      settings: Object.fromEntries(rows.map(r => [r.cle, r.valeur])),
      accepted,
      ...(rejected.length ? { rejected, hint: 'Clés non whitelistées (cf. ALLOWED_KEYS dans routes/club.js)' } : {})
    });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); res.status(500).json({ error: 'Erreur serveur : ' + (err.sqlMessage || err.message) }); }
});

module.exports = router;
