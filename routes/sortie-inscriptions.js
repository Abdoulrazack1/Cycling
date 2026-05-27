/* ═════════════════════════════════════════════════════════════════
   routes/sortie-inscriptions.js — Inscription 1-clic membre à une sortie
   ─────────────────────────────────────────────────────────────────
   Plus simple que evenement_inscriptions : juste un toggle, le membre
   est déjà identifié (req.user). Pas de formulaire.

   GET    /api/sorties/:id/inscriptions     liste des inscrits (public sorties)
   GET    /api/sorties/:id/inscription/me   statut d'inscription du user courant
   POST   /api/sorties/:id/inscription      inscription 1-clic (member-only)
   DELETE /api/sorties/:id/inscription      désinscription
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { errResponse } = require('../lib/errors');
const { audit } = require('../services/audit-log');

const router = express.Router({ mergeParams: true });

// Charge la liste des inscrits — visible par tout le monde (public),
// mais sans email/téléphone. Juste prenom/nom/numero/statut.
router.get('/inscriptions', async (req, res) => {
  const sortieId = req.params.id || req.params.sortieId;
  try {
    const rows = await query(
      `SELECT i.id, i.statut, i.note, i.created_at,
              u.id AS user_id, u.prenom, u.nom, u.username, u.numero
       FROM sortie_inscriptions i
       JOIN users u ON u.id = i.user_id
       WHERE i.sortie_id = ? AND i.statut != 'annule'
       ORDER BY i.created_at ASC`,
      [sortieId]
    );
    const inscrits = rows.filter(r => r.statut === 'inscrit');
    const attente  = rows.filter(r => r.statut === 'liste-attente');
    res.json({
      inscriptions: rows,
      total: rows.length,
      inscrits: inscrits.length,
      en_attente: attente.length,
    });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur inscriptions');
  }
});

router.get('/inscription/me', requireAuth, async (req, res) => {
  const sortieId = req.params.id || req.params.sortieId;
  try {
    const rows = await query(
      'SELECT id, statut, note, created_at FROM sortie_inscriptions WHERE sortie_id = ? AND user_id = ?',
      [sortieId, req.user.id]
    );
    res.json({ inscription: rows[0] || null });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur statut');
  }
});

router.post('/inscription',
  requireAuth,
  body('note').optional().isLength({ max: 500 }),
  async (req, res) => {
    const sortieId = req.params.id || req.params.sortieId;
    try {
      // Vérifie sortie existe + n'est pas passée
      const s = await query(
        "SELECT id, title, date, statut FROM sorties WHERE id = ?",
        [sortieId]
      );
      if (!s.length) return res.status(404).json({ error: 'Sortie introuvable' });
      if (s[0].statut === 'passee') return res.status(400).json({ error: 'Sortie déjà passée' });

      // Insert ou update si déjà annulée
      const existing = await query(
        'SELECT id, statut FROM sortie_inscriptions WHERE sortie_id = ? AND user_id = ?',
        [sortieId, req.user.id]
      );
      const note = req.body.note || null;
      if (existing.length) {
        if (existing[0].statut === 'annule') {
          await query(
            "UPDATE sortie_inscriptions SET statut = 'inscrit', note = ?, updated_at = NOW() WHERE id = ?",
            [note, existing[0].id]
          );
        } else if (existing[0].statut === 'inscrit') {
          return res.json({ ok: true, status: 'already_registered' });
        }
      } else {
        await query(
          "INSERT INTO sortie_inscriptions (sortie_id, user_id, statut, note) VALUES (?, ?, 'inscrit', ?)",
          [sortieId, req.user.id, note]
        );
      }

      audit(req, 'inscription', 'sortie', sortieId);

      // Notifie le user pour traçabilité
      try {
        const { notify } = require('./notifications');
        await notify(req.user.id, 'inscription.confirmed',
          `Inscription à "${s[0].title}" confirmée`,
          `Tu es inscrit·e à la sortie ${s[0].title}. Annulation possible jusqu'au départ.`,
          `/sortie.html?id=${encodeURIComponent(sortieId)}`
        );
      } catch {}

      res.json({ ok: true, status: 'registered' });
    } catch (err) {
      errResponse(req, res, err, 500, 'Erreur inscription');
    }
  }
);

// Admin : passe une inscription en liste d'attente ou la confirme
const { requireAdmin } = require('../middleware/auth');
router.patch('/inscription/:userId', requireAuth, requireAdmin,
  body('statut').isIn(['inscrit', 'liste-attente', 'annule']),
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
    const sortieId = req.params.id || req.params.sortieId;
    const { userId } = req.params;
    const { statut } = req.body;
    try {
      const r = await query(
        "UPDATE sortie_inscriptions SET statut = ?, updated_at = NOW() WHERE sortie_id = ? AND user_id = ?",
        [statut, sortieId, userId]
      );
      if (r.affectedRows === 0) return res.status(404).json({ error: 'Inscription introuvable' });
      audit(req, 'update', 'inscription', `${sortieId}/${userId}`, { statut });

      // Notifie le user concerné
      try {
        const { notify } = require('./notifications');
        const msg = statut === 'inscrit'      ? 'Ton inscription est confirmée'
                  : statut === 'liste-attente' ? 'Tu es placé sur liste d\'attente'
                  : 'Inscription annulée';
        await notify(parseInt(userId, 10), 'inscription.status_changed',
          `Sortie : ${msg}`, null,
          `/sortie.html?id=${encodeURIComponent(sortieId)}`);
      } catch {}

      res.json({ ok: true, statut });
    } catch (err) {
      errResponse(req, res, err, 500, 'Erreur update inscription');
    }
  }
);

router.delete('/inscription', requireAuth, async (req, res) => {
  const sortieId = req.params.id || req.params.sortieId;
  try {
    const r = await query(
      "UPDATE sortie_inscriptions SET statut = 'annule', updated_at = NOW() WHERE sortie_id = ? AND user_id = ?",
      [sortieId, req.user.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Pas inscrit' });
    audit(req, 'annulation', 'sortie', sortieId);
    res.json({ ok: true, status: 'cancelled' });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur annulation');
  }
});

module.exports = router;
