/* controllers/my.js — Dashboard "Mon espace" du membre connecté */
const { query } = require('../config/database');
const { errResponse } = require('../lib/errors');

// GET /api/my/dashboard — agrège favoris + inscriptions + recently viewed + notifs
async function dashboard(req, res) {
  try {
    const [favs, inscrs, recent, notifs] = await Promise.all([
      query(
        `SELECT s.id, s.title, s.date, s.distance_km, s.elevation_gain, s.statut, s.chapter, s.slug
         FROM user_favorites f JOIN sorties s ON s.id = f.sortie_id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC
         LIMIT 6`,
        [req.user.id]
      ),
      query(
        `SELECT i.statut, i.created_at, i.note,
                s.id, s.title, s.date, s.distance_km, s.elevation_gain, s.statut AS sortie_statut, s.chapter, s.slug
         FROM sortie_inscriptions i JOIN sorties s ON s.id = i.sortie_id
         WHERE i.user_id = ? AND i.statut != 'annule'
         ORDER BY s.date DESC
         LIMIT 20`,
        [req.user.id]
      ),
      query(
        `SELECT r.viewed_at, r.view_count,
                s.id, s.title, s.date, s.distance_km, s.elevation_gain, s.statut, s.chapter, s.slug
         FROM user_recent_views r JOIN sorties s ON s.id = r.sortie_id
         WHERE r.user_id = ?
         ORDER BY r.viewed_at DESC
         LIMIT 8`,
        [req.user.id]
      ).catch(() => []),
      query(
        'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL',
        [req.user.id]
      ).then(r => r[0]?.n || 0).catch(() => 0),
    ]);

    res.json({
      favorites: favs,
      inscriptions: inscrs,
      recent_views: recent,
      unread_notifications: notifs,
    });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur dashboard membre');
  }
}

// GET /api/my/inscriptions
async function inscriptions(req, res) {
  try {
    const rows = await query(
      `SELECT i.statut, i.created_at, i.note,
              s.id, s.title, s.date, s.distance_km, s.elevation_gain, s.statut AS sortie_statut, s.chapter
       FROM sortie_inscriptions i JOIN sorties s ON s.id = i.sortie_id
       WHERE i.user_id = ?
       ORDER BY s.date DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ inscriptions: rows });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur inscriptions');
  }
}

// GET /api/my/recent
async function recent(req, res) {
  try {
    const rows = await query(
      `SELECT r.viewed_at, r.view_count,
              s.id, s.title, s.date, s.distance_km, s.elevation_gain, s.statut, s.chapter, s.slug
       FROM user_recent_views r JOIN sorties s ON s.id = r.sortie_id
       WHERE r.user_id = ?
       ORDER BY r.viewed_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    res.json({ recent: rows });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur recent');
  }
}

// POST /api/my/recent/:sortieId — track une consultation (silencieux)
async function trackRecent(req, res) {
  const sortieId = req.params.sortieId;
  try {
    // INSERT ... ON DUPLICATE KEY UPDATE pour incrémenter view_count
    await query(
      `INSERT INTO user_recent_views (user_id, sortie_id, view_count)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE viewed_at = NOW(), view_count = view_count + 1`,
      [req.user.id, sortieId]
    );
    // Trim : on garde max 50 entrées par user (efface les + anciennes)
    await query(
      `DELETE FROM user_recent_views
       WHERE user_id = ? AND viewed_at NOT IN (
         SELECT viewed_at FROM (
           SELECT viewed_at FROM user_recent_views WHERE user_id = ?
           ORDER BY viewed_at DESC LIMIT 50
         ) keep
       )`,
      [req.user.id, req.user.id]
    ).catch(() => {/* trim non bloquant */});
    res.json({ ok: true });
  } catch (err) {
    // Track-failure ne doit jamais empêcher la consultation
    res.json({ ok: false });
  }
}

module.exports = { dashboard, inscriptions, recent, trackRecent };
