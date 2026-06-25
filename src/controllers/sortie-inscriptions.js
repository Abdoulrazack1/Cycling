/* ═════════════════════════════════════════════════════════════════
   controllers/sortie-inscriptions.js — Inscription 1-clic à une sortie
   (monté sur /api/sorties/:id, mergeParams)
   ═════════════════════════════════════════════════════════════════ */

const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { errResponse } = require('../lib/errors');
const { audit } = require('../services/audit-log');
const { notify } = require('../controllers/notifications');

// ── Helper : auto-promote du premier waitlist quand une place se libère ──
async function autoPromoteWaitlist(sortieId, reqLog) {
  try {
    const wait = await query(
      "SELECT id, user_id FROM sortie_inscriptions WHERE sortie_id = ? AND statut = 'liste-attente' ORDER BY created_at ASC LIMIT 1",
      [sortieId]
    );
    if (!wait.length) return null;
    await query("UPDATE sortie_inscriptions SET statut = 'inscrit', updated_at = NOW() WHERE id = ?", [wait[0].id]);
    const s = await query('SELECT title FROM sorties WHERE id = ?', [sortieId]);
    if (s.length) {
      try {
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

const registerValidators = [body('note').optional().isLength({ max: 500 })];
const adminPatchValidators = [body('statut').isIn(['inscrit', 'liste-attente', 'annule'])];

// GET /inscriptions — liste publique (sans email/tel)
async function listInscrits(req, res) {
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
}

// GET /inscription/me
async function getMyStatus(req, res) {
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
}

// POST /inscription — inscription 1-clic (member-only)
async function register(req, res) {
  const sortieId = req.params.id || req.params.sortieId;
  try {
    const s = await query(
      "SELECT id, title, date, statut, capacity_max, inscription_ouverte FROM sorties WHERE id = ?",
      [sortieId]
    );
    if (!s.length) return res.status(404).json({ error: 'Sortie introuvable' });
    if (s[0].statut === 'passee') return res.status(400).json({ error: 'Sortie déjà passée' });
    if (s[0].inscription_ouverte === 0) {
      return res.status(403).json({ error: 'Inscriptions fermées pour cette sortie' });
    }

    const countRows = await query(
      "SELECT COUNT(*) AS n FROM sortie_inscriptions WHERE sortie_id = ? AND statut = 'inscrit'",
      [sortieId]
    );
    const inscritsCount = countRows[0]?.n || 0;
    const capacityMax = s[0].capacity_max;
    const targetStatut = (capacityMax != null && inscritsCount >= capacityMax)
      ? 'liste-attente'
      : 'inscrit';

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

    try {
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

// PATCH /inscription/:userId — admin
async function adminPatch(req, res) {
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

    try {
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

// DELETE /inscription — désinscription (+ auto-promote waitlist)
async function unregister(req, res) {
  const sortieId = req.params.id || req.params.sortieId;
  try {
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

    let promotedUserId = null;
    if (wasInscrit) {
      promotedUserId = await autoPromoteWaitlist(sortieId, req.log);
    }
    res.json({ ok: true, status: 'cancelled', promoted_user: promotedUserId });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur annulation');
  }
}

module.exports = {
  listInscrits, getMyStatus, register, adminPatch, unregister,
  registerValidators, adminPatchValidators, autoPromoteWaitlist,
};
