/* ═════════════════════════════════════════════════════════════════
   routes/membres.js — Annuaire + profil des sociétaires
   GET   /api/membres                       liste publique active
   GET   /api/membres/:id                   fiche publique + équipement
   PATCH /api/membres/:id                   édition (self ou admin)
   PATCH /api/membres/:id/actif             désactivation (admin)
   GET   /api/membres/me/dashboard          stats perso : rang, club avg, à venir
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const bcrypt  = require('bcryptjs');
const { query, pageClause } = require('../config/database');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { audit } = require('../services/audit-log');
const { errResponse } = require('../lib/errors');
const logger = require('../lib/logger');
const router = express.Router();

// Vue publique d'un user (annuaire + fiche /membres/:id).
// La bio n'est exposée que si l'utilisateur a explicitement coché
// "rendre publique" (bio_public = 1) — opt-in RGPD.
// `viewer` est l'utilisateur qui fait la requête (peut être null) ; un
// utilisateur voit toujours sa propre bio + un admin voit toutes les bios.
function userPublic(u, viewer = null) {
  const isOwner = viewer?.id === u.id;
  const isAdmin = viewer?.role === 'admin';
  const exposeBio = isOwner || isAdmin || u.bio_public === 1;
  return {
    id: u.id, numero: u.numero, username: u.username,
    prenom: u.prenom, nom: u.nom, role: u.role,
    bio: exposeBio ? u.bio : null,
    bio_public: !!u.bio_public,
    ftp_w: u.ftp_w, km_saison: u.km_saison,
    elevation_saison: u.elevation_saison, licence_ffc: u.licence_ffc,
    annee_adhesion: u.annee_adhesion, avatar_initial: u.avatar_initial,
    actif: u.actif
  };
}

// GET /api/membres — annuaire public, paginé (cf. AUDIT item #21)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const sql = 'SELECT * FROM users WHERE actif = TRUE ORDER BY numero'
              + pageClause(limit, offset, { defaultLimit: 50, maxLimit: 200 });
    const [rows, [{ cnt }]] = await Promise.all([
      query(sql),
      query('SELECT COUNT(*) AS cnt FROM users WHERE actif = TRUE')
    ]);
    res.json({ membres: rows.map(u => userPublic(u, req.user)), total: cnt });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

// GET /api/membres/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const [user] = await query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Membre introuvable' });
    const equipment = await query(
      'SELECT num, titre, description FROM user_equipment WHERE user_id = ? ORDER BY sort_order',
      [user.id]
    );
    res.json({ ...userPublic(user, req.user), equipment });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

// PUT /api/membres/:id (self ou admin)
router.put('/:id', requireAuth, [
  body('bio').optional({ nullable: true }).trim().isLength({ max: 2000 }).withMessage('Bio : 2000 caractères max'),
  body('bio_public').optional().isBoolean(),
  body('ftp_w').optional({ nullable: true }).isInt({ min: 0, max: 2000 }),
  body('km_saison').optional({ nullable: true }).isInt({ min: 0, max: 100000 }),
  body('elevation_saison').optional({ nullable: true }).isInt({ min: 0, max: 1000000 }),
  body('licence_ffc').optional({ nullable: true }).isLength({ max: 50 }).trim(),
  body('annee_adhesion').optional({ nullable: true }).isInt({ min: 1900, max: 2100 }),
], async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (req.user.id !== targetId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  const { bio, bio_public, ftp_w, km_saison, elevation_saison, licence_ffc, annee_adhesion } = req.body;
  try {
    await query(
      `UPDATE users SET bio=?, bio_public=?, ftp_w=?, km_saison=?, elevation_saison=?, licence_ffc=?, annee_adhesion=?
       WHERE id=?`,
      [bio||null, bio_public ? 1 : 0, ftp_w||null, km_saison||0, elevation_saison||0, licence_ffc||null, annee_adhesion||null, targetId]
    );
    const [updated] = await query('SELECT * FROM users WHERE id = ?', [targetId]);
    res.json(userPublic(updated, req.user));
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

// ── GET /api/membres/me/dashboard ───────────────────────────────
// Dashboard perso : km/D+/temps cette saison vs club, ranking, dernières activités.
router.get('/me/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const year = new Date().getFullYear();

    // 1. Stats personnelles (cumul activités Strava importées + déclarations users)
    const [me] = await query(
      `SELECT km_saison, elevation_saison, ftp_w FROM users WHERE id = ?`,
      [userId]
    );

    // Strava (si lié)
    const [stravaAgg] = await query(
      `SELECT
        COUNT(*) AS rides,
        ROUND(SUM(distance_m)/1000) AS km_strava,
        ROUND(SUM(elevation_gain_m)) AS dplus_strava,
        ROUND(SUM(moving_time_s)/3600, 1) AS hours_strava,
        ROUND(AVG(average_speed_ms)*3.6, 1) AS avg_kmh
       FROM strava_activities
       WHERE user_id = ? AND YEAR(start_date) = ?`,
      [userId, year]
    ).catch(() => [{}]);

    // 2. Moyennes club (sur tous membres actifs avec km_saison déclaré)
    const [clubAvg] = await query(
      `SELECT
        COUNT(*) AS members,
        ROUND(AVG(NULLIF(km_saison, 0))) AS avg_km,
        ROUND(AVG(NULLIF(elevation_saison, 0))) AS avg_dplus,
        ROUND(AVG(NULLIF(ftp_w, 0))) AS avg_ftp
       FROM users WHERE actif = TRUE AND role IN ('admin', 'moderateur', 'membre')`
    );

    // 3. Rank du user sur les km_saison + nb total de membres ranked
    const [rankRow] = await query(
      `SELECT (COUNT(*) + 1) AS rank
       FROM users
       WHERE actif = TRUE AND km_saison > (SELECT IFNULL(km_saison, 0) FROM users WHERE id = ?)`,
      [userId]
    );
    const [totalRanked] = await query(
      `SELECT COUNT(*) AS total FROM users WHERE actif = TRUE AND km_saison > 0`
    );

    // 4. Activités Strava récentes (5 dernières)
    const recentActivities = await query(
      `SELECT id, name, type, distance_m, elevation_gain_m, start_date
       FROM strava_activities WHERE user_id = ?
       ORDER BY start_date DESC LIMIT 5`,
      [userId]
    ).catch(() => []);

    // 5. Sorties club auxquelles le user est inscrit (à venir)
    const upcomingEvents = await query(
      `SELECT e.id, e.slug, e.title, e.date, e.lieu, ei.statut
       FROM evenement_inscriptions ei
       JOIN evenements e ON e.id = ei.evenement_id
       WHERE ei.user_id = ? AND e.date >= CURDATE() AND ei.statut != 'annule'
       ORDER BY e.date ASC LIMIT 5`,
      [userId]
    );

    res.json({
      year,
      personal: {
        km_declared:        me?.km_saison || 0,
        elevation_declared: me?.elevation_saison || 0,
        ftp_w:              me?.ftp_w || null,
        strava: stravaAgg && stravaAgg.rides > 0 ? {
          rides:    stravaAgg.rides,
          km:       stravaAgg.km_strava,
          dplus:    stravaAgg.dplus_strava,
          hours:    stravaAgg.hours_strava,
          avg_kmh:  stravaAgg.avg_kmh,
        } : null,
      },
      club: {
        members:   clubAvg?.members || 0,
        avg_km:    clubAvg?.avg_km || 0,
        avg_dplus: clubAvg?.avg_dplus || 0,
        avg_ftp:   clubAvg?.avg_ftp || null,
      },
      ranking: {
        rank:  rankRow?.rank || null,
        total: totalRanked?.total || 0,
      },
      recent_activities: recentActivities,
      upcoming_events:   upcomingEvents,
    });
  } catch (err) {
    req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, '[dashboard]');
    errResponse(req, res, err, 500, 'Erreur dashboard');
  }
});

// Admin: désactiver un membre
router.patch('/:id/actif', requireAuth, requireAdmin, [
  body('actif').isBoolean().withMessage('actif doit être true ou false')
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    // Idem #18 : on ne peut pas désactiver le dernier admin actif.
    if (req.body.actif === false) {
      const [target] = await query('SELECT role FROM users WHERE id = ?', [req.params.id]);
      if (target?.role === 'admin') {
        const [{ cnt }] = await query(
          "SELECT COUNT(*) AS cnt FROM users WHERE role='admin' AND actif=TRUE"
        );
        if (cnt <= 1) {
          return res.status(409).json({ error: 'Dernier admin actif — désactivation refusée.' });
        }
      }
    }
    await query('UPDATE users SET actif = ? WHERE id = ?', [req.body.actif ? 1 : 0, req.params.id]);
    audit(req, 'update', 'user', req.params.id, { field: 'actif', value: req.body.actif });
    res.json({ message: 'Statut mis à jour' });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

// Admin: changer le rôle
router.patch('/:id/role', requireAuth, requireAdmin, [
  body('role').isIn(['admin','moderateur','membre'])
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    // Cf. AUDIT item #18 — empêcher la rétrogradation du DERNIER admin
    // actif. Sans ça, un admin pouvait se rétrograder lui-même et plus
    // personne ne pouvait administrer le site.
    if (req.body.role !== 'admin') {
      const [target] = await query('SELECT role FROM users WHERE id = ?', [req.params.id]);
      if (target?.role === 'admin') {
        const [{ cnt }] = await query(
          "SELECT COUNT(*) AS cnt FROM users WHERE role='admin' AND actif=TRUE"
        );
        if (cnt <= 1) {
          return res.status(409).json({
            error: 'Dernier admin actif — impossible de le rétrograder. Promouvez d\'abord un autre membre.'
          });
        }
      }
    }
    await query('UPDATE users SET role = ? WHERE id = ?', [req.body.role, req.params.id]);
    audit(req, 'role_change', 'user', req.params.id, { newRole: req.body.role });
    res.json({ message: 'Rôle mis à jour' });
  } catch (err) { req.log.error({ err, code: err.code, sqlMessage: err.sqlMessage }, 'route error'); errResponse(req, res, err, 500, 'Erreur serveur :'); }
});

module.exports = router;
