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

// ── Helper : auto-promote du premier waitlist quand une place se libère ──
async function autoPromoteWaitlist(sortieId, reqLog) {
  try {
    // Trouve la première personne en liste d'attente (FIFO)
    const wait = await query(
      "SELECT id, user_id FROM sortie_inscriptions WHERE sortie_id = ? AND statut = 'liste-attente' ORDER BY created_at ASC LIMIT 1",
      [sortieId]
    );
    if (!wait.length) return null;
    // Promeut → inscrit
    await query("UPDATE sortie_inscriptions SET statut = 'inscrit', updated_at = NOW() WHERE id = ?", [wait[0].id]);
    // Notifie l'heureux promu
    const s = await query('SELECT title FROM sorties WHERE id = ?', [sortieId]);
    if (s.length) {
      try {
        const { notify } = require('./notifications');
        await notify(wait[0].user_id, 'inscription.promoted',
          `Place libérée pour "${s[0].title}"`,
          `Une place s'est libérée ! Tu es maintenant inscrit·e sur cette sortie.`,
          `/sortie.html?id=${encodeURIComponent(sortieId)}`);
      } catch {}
    }
    return wait[0].user_id;
  } catch (err) {
    reqLog?.warn({ err: err.message }, '[autoPromoteWaitlist]');
    return null;
  }
}

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
      // Vérifie sortie existe + n'est pas passée + inscription ouverte
      const s = await query(
        "SELECT id, title, date, statut, capacity_max, inscription_ouverte FROM sorties WHERE id = ?",
        [sortieId]
      );
      if (!s.length) return res.status(404).json({ error: 'Sortie introuvable' });
      if (s[0].statut === 'passee') return res.status(400).json({ error: 'Sortie déjà passée' });
      if (s[0].inscription_ouverte === 0) {
        return res.status(403).json({ error: 'Inscriptions fermées pour cette sortie' });
      }

      // Compte les inscrits actuels (statut "inscrit")
      const countRows = await query(
        "SELECT COUNT(*) AS n FROM sortie_inscriptions WHERE sortie_id = ? AND statut = 'inscrit'",
        [sortieId]
      );
      const inscritsCount = countRows[0]?.n || 0;
      const capacityMax = s[0].capacity_max;
      // Si capacité définie et atteinte → placement automatique en liste d'attente
      const targetStatut = (capacityMax != null && inscritsCount >= capacityMax)
        ? 'liste-attente'
        : 'inscrit';

      // Insert ou update si déjà annulée
      const existing = await query(
        'SELECT id, statut FROM sortie_inscriptions WHERE sortie_id = ? AND user_id = ?',
        [sortieId, req.user.id]
      );
      const note = req.body.note || null;
      if (existing.length) {
        if (existing[0].statut === 'annule') {
          await query(
            "UPDATE sortie_inscriptions SET statut = ?, note = ?, updated_at = NOW() WHERE id = ?",
            [targetStatut, note, existing[0].id]
          );
        } else if (existing[0].statut === 'inscrit' || existing[0].statut === 'liste-attente') {
          return res.json({ ok: true, status: 'already_registered', statut: existing[0].statut });
        }
      } else {
        await query(
          "INSERT INTO sortie_inscriptions (sortie_id, user_id, statut, note) VALUES (?, ?, ?, ?)",
          [sortieId, req.user.id, targetStatut, note]
        );
      }

      audit(req, 'inscription', 'sortie', sortieId, { statut: targetStatut });

      // Notifie le user pour traçabilité (notifs différentes selon statut)
      try {
        const { notify } = require('./notifications');
        if (targetStatut === 'inscrit') {
          await notify(req.user.id, 'inscription.confirmed',
            `Inscription à "${s[0].title}" confirmée`,
            `Tu es inscrit·e à la sortie ${s[0].title}. Annulation possible jusqu'au départ.`,
            `/sortie.html?id=${encodeURIComponent(sortieId)}`
          );
        } else {
          await notify(req.user.id, 'inscription.waitlist',
            `Liste d'attente pour "${s[0].title}"`,
            `La sortie est complète, tu es sur liste d'attente. Tu seras notifié·e si une place se libère.`,
            `/sortie.html?id=${encodeURIComponent(sortieId)}`
          );
        }
      } catch {}

      res.json({ ok: true, status: 'registered', statut: targetStatut });
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
    // Récupère le statut avant pour savoir si on libère une place "inscrit"
    const before = await query(
      "SELECT statut FROM sortie_inscriptions WHERE sortie_id = ? AND user_id = ?",
      [sortieId, req.user.id]
    );
    const wasInscrit = before.length && before[0].statut === 'inscrit';

    const r = await query(
      "UPDATE sortie_inscriptions SET statut = 'annule', updated_at = NOW() WHERE sortie_id = ? AND user_id = ?",
      [sortieId, req.user.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Pas inscrit' });
    audit(req, 'annulation', 'sortie', sortieId);

    // Si l'utilisateur était inscrit (pas en liste d'attente), une place se libère :
    // on auto-promeut le premier en file d'attente.
    let promotedUserId = null;
    if (wasInscrit) {
      promotedUserId = await autoPromoteWaitlist(sortieId, req.log);
    }
    res.json({ ok: true, status: 'cancelled', promoted_user: promotedUserId });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur annulation');
  }
});

module.exports = router;
