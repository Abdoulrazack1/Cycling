/* controllers/search.js — Recherche globale (palette Cmd+K) */
const { query } = require('../config/database');
const { errResponse } = require('../lib/errors');

// GET /api/search?q=...
async function search(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });
  const like = `%${q}%`;
  const LIMIT = 6; // constant en dur — mysql2 prepared statements n'acceptent pas LIMIT paramétré

  try {
    const [sorties, evenements, membres, segments] = await Promise.all([
      query(
        `SELECT id, title, subtitle, date, chapter
         FROM sorties
         WHERE title LIKE ? OR subtitle LIKE ? OR description LIKE ? OR chapter LIKE ?
         ORDER BY date DESC LIMIT ${LIMIT}`,
        [like, like, like, like]
      ),
      query(
        `SELECT id, slug, title, type, date
         FROM evenements
         WHERE title LIKE ? OR description LIKE ? OR lieu LIKE ?
         ORDER BY date DESC LIMIT ${LIMIT}`,
        [like, like, like]
      ).catch(() => []),
      query(
        `SELECT id, prenom, nom, username, role
         FROM users
         WHERE actif = TRUE AND (prenom LIKE ? OR nom LIKE ? OR username LIKE ?)
         LIMIT ${LIMIT}`,
        [like, like, like]
      ),
      query(
        `SELECT id, name, length_m
         FROM segments_global
         WHERE name LIKE ?
         LIMIT ${LIMIT}`,
        [like]
      ).catch(() => []),
    ]);

    const results = [
      ...sorties.map(s => ({
        type: 'sortie',
        id: s.id,
        title: s.title,
        subtitle: s.subtitle || (s.date ? new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''),
        url: `sortie.html?id=${encodeURIComponent(s.id)}`,
      })),
      ...evenements.map(e => ({
        type: 'evenement',
        id: e.id,
        title: e.title,
        subtitle: `${e.type || 'événement'}${e.date ? ' · ' + new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}`,
        url: `evenement.html?id=${e.slug || e.id}`,
      })),
      ...membres.map(m => ({
        type: 'membre',
        id: m.id,
        title: `${m.prenom || ''} ${m.nom || ''}`.trim(),
        subtitle: m.role === 'admin' || m.role === 'modo' ? `${m.username} · ${m.role}` : m.username,
        url: `membre.html?id=${m.id}`,
      })),
      ...segments.map(s => ({
        type: 'segment',
        id: s.id,
        title: s.name,
        subtitle: s.length_m ? `${(s.length_m / 1000).toFixed(2)} km` : 'segment',
        url: `segments.html#seg-${s.id}`,
      })),
    ];

    res.json({ q, results, total: results.length });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur recherche');
  }
}

module.exports = { search };
