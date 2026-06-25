/* ═════════════════════════════════════════════════════════════════
   controllers/notifications.js — Flux de notifications membres + Web Push
   ─────────────────────────────────────────────────────────────────
   Exporte aussi les helpers notify() / notifyMany() réutilisés par
   d'autres controllers/routes (sortie update, inscription, broadcast).
   ═════════════════════════════════════════════════════════════════ */

const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { errResponse } = require('../lib/errors');
const webpush = require('../services/web-push');

// ─── Helpers réutilisables ───────────────────────────────────────
async function notify(userId, type, title, bodyText = null, url = null) {
  if (!userId) return null;
  const r = await query(
    'INSERT INTO notifications (user_id, type, title, body, url) VALUES (?, ?, ?, ?, ?)',
    [userId, type, String(title).slice(0, 200), bodyText, url]
  );
  // Push navigateur best-effort — n'interrompt jamais le flux applicatif.
  webpush.sendToUser(userId, { type, title: String(title).slice(0, 200), body: bodyText, url }).catch(() => {});
  return r.insertId;
}

async function notifyMany(userIds, type, title, bodyText = null, url = null) {
  if (!userIds?.length) return 0;
  const rows = userIds.map(id => [id, type, String(title).slice(0, 200), bodyText, url]);
  const placeholders = rows.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const flat = rows.flat();
  await query(
    `INSERT INTO notifications (user_id, type, title, body, url) VALUES ${placeholders}`,
    flat
  );
  // Push navigateur best-effort vers chaque destinataire.
  for (const id of userIds) {
    webpush.sendToUser(id, { type, title: String(title).slice(0, 200), body: bodyText, url }).catch(() => {});
  }
  return userIds.length;
}

// ─── Handlers ────────────────────────────────────────────────────
async function list(req, res) {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const rows = await query(
      `SELECT id, type, title, body, url, read_at, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      [req.user.id]
    );
    const unread = rows.filter(r => !r.read_at).length;
    res.json({ notifications: rows, total: rows.length, unread });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur notifications');
  }
}

async function unread(req, res) {
  try {
    const r = await query(
      'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL',
      [req.user.id]
    );
    res.json({ unread: r[0]?.n || 0 });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur unread');
  }
}

async function readAll(req, res) {
  try {
    await query(
      'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur read-all');
  }
}

async function readOne(req, res) {
  try {
    await query(
      'UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur read');
  }
}

async function remove(req, res) {
  try {
    await query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur delete');
  }
}

// Admin : pousse une notif vers user_id ou "all"
const createValidators = [
  body('target').isString(),
  body('type').isLength({ min: 1, max: 40 }),
  body('title').isLength({ min: 1, max: 200 }),
  body('body').optional().isLength({ max: 2000 }),
  body('url').optional().isLength({ max: 255 }),
];
async function createAdmin(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  const { target, type, title, body: txt, url } = req.body;
  try {
    let userIds = [];
    if (target === 'all') {
      const rows = await query('SELECT id FROM users WHERE actif = TRUE');
      userIds = rows.map(r => r.id);
    } else {
      userIds = [parseInt(target, 10)].filter(Boolean);
    }
    const n = await notifyMany(userIds, type, title, txt, url);
    res.json({ ok: true, sent: n });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur notif admin');
  }
}

// ─── Web Push ────────────────────────────────────────────────────
function pushKey(req, res) {
  res.json({ key: webpush.publicKey(), enabled: webpush.isEnabled() });
}

async function pushSubscribe(req, res) {
  try {
    const sub = req.body?.subscription;
    if (!sub?.endpoint) return res.status(400).json({ error: 'subscription manquante' });
    await webpush.saveSubscription(req.user.id, sub, req.headers['user-agent']);
    res.json({ ok: true });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur abonnement push');
  }
}

async function pushUnsubscribe(req, res) {
  try {
    await webpush.removeSubscription(req.body?.endpoint);
    res.json({ ok: true });
  } catch (err) {
    errResponse(req, res, err, 500, 'Erreur désabonnement push');
  }
}

module.exports = {
  notify, notifyMany,
  list, unread, readAll, readOne, remove, createValidators, createAdmin,
  pushKey, pushSubscribe, pushUnsubscribe,
};
