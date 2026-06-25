/* controllers/stats.js — Statistiques agrégées publiques (cache mémoire 5 min) */
const { query } = require('../config/database');
const { errResponse } = require('../lib/errors');

// Cache mémoire 5 min — évite de retaper la BDD à chaque visite home
let _cache = { at: 0, data: null };
const TTL = 5 * 60 * 1000;

// GET /api/stats
async function get(req, res) {
  try {
    if (_cache.data && (Date.now() - _cache.at) < TTL) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(_cache.data);
    }

    // Toutes les requêtes en parallèle pour rester rapide
    const [
      sortiesAll, sortiesPassees, kmTotal, dpTotal,
      events, evtFuture, membres, membresActifs,
      poisCount, segCount, koms,
    ] = await Promise.all([
      query('SELECT COUNT(*) AS n FROM sorties').then(r => r[0]?.n || 0),
      query("SELECT COUNT(*) AS n FROM sorties WHERE statut='passee'").then(r => r[0]?.n || 0),
      query("SELECT COALESCE(SUM(distance_km),0) AS km FROM sorties WHERE statut='passee'").then(r => Math.round(r[0]?.km || 0)),
      query("SELECT COALESCE(SUM(elevation_gain),0) AS d FROM sorties WHERE statut='passee'").then(r => Math.round(r[0]?.d || 0)),
      query('SELECT COUNT(*) AS n FROM evenements').then(r => r[0]?.n || 0).catch(() => 0),
      query("SELECT COUNT(*) AS n FROM evenements WHERE date >= CURDATE()").then(r => r[0]?.n || 0).catch(() => 0),
      query('SELECT COUNT(*) AS n FROM users').then(r => r[0]?.n || 0),
      query('SELECT COUNT(*) AS n FROM users WHERE actif=TRUE').then(r => r[0]?.n || 0),
      query('SELECT COUNT(*) AS n FROM pois').then(r => r[0]?.n || 0).catch(() => 0),
      query('SELECT COUNT(*) AS n FROM segments').then(r => r[0]?.n || 0).catch(() => 0),
      query('SELECT COUNT(*) AS n FROM segments WHERE kom = 1').then(r => r[0]?.n || 0).catch(() => 0),
    ]);

    const data = {
      sorties:    { total: sortiesAll, passees: sortiesPassees },
      kilometres: kmTotal,
      denivele:   dpTotal,
      evenements: { total: events, a_venir: evtFuture },
      membres:    { total: membres, actifs: membresActifs },
      pois:       poisCount,
      segments:   { total: segCount, koms },
      generated_at: new Date().toISOString(),
    };

    _cache = { at: Date.now(), data };
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json(data);
  } catch (err) {
    req.log?.error({ err }, 'stats route error');
    errResponse(req, res, err, 500, 'Erreur stats');
  }
}

// POST /api/stats/flush — invalide le cache après une modif admin
function flush(req, res) {
  _cache = { at: 0, data: null };
  res.json({ ok: true });
}

module.exports = { get, flush };
