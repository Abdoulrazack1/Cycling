/* ═════════════════════════════════════════════════════════════════
   services/web-push.js — Notifications Web Push (VAPID)
   ─────────────────────────────────────────────────────────────────
   - init()          : configure VAPID depuis l'env (no-op si clés absentes)
   - isEnabled()     : true si VAPID configuré ET package présent
   - publicKey()     : clé publique VAPID (exposée au frontend)
   - saveSubscription(userId, sub, ua)
   - removeSubscription(endpoint)
   - sendToUser(userId, payload)  : best-effort, purge les abos expirés (404/410)

   Tolère l'absence du package `web-push` (push simplement désactivé) afin
   de ne jamais casser le chargement des routes en prod.
   ═════════════════════════════════════════════════════════════════ */

let webpush = null;
try { webpush = require('web-push'); } catch { /* package absent → push désactivé */ }

const { query } = require('../config/database');
const logger = require('../lib/logger');

let configured = false;

function init() {
  if (!webpush) return false;
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@club-salouel.fr', pub, priv);
    configured = true;
  } catch (err) {
    logger.warn({ err: err.message }, '[web-push] clés VAPID invalides');
    configured = false;
  }
  return configured;
}
init();

function isEnabled() { return configured; }
function publicKey() { return configured ? (process.env.VAPID_PUBLIC_KEY || null) : null; }

async function saveSubscription(userId, sub, userAgent) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    throw new Error('subscription invalide');
  }
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id), p256dh = VALUES(p256dh),
       auth = VALUES(auth), user_agent = VALUES(user_agent)`,
    [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, String(userAgent || '').slice(0, 255)]
  );
}

async function removeSubscription(endpoint) {
  if (!endpoint) return;
  await query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
}

async function sendToUser(userId, payload) {
  if (!configured || !userId) return;
  let subs;
  try {
    subs = await query('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?', [userId]);
  } catch { return; }
  if (!subs?.length) return;

  const data = JSON.stringify(payload || {});
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        data
      );
    } catch (err) {
      // 404 / 410 → l'abonnement n'existe plus côté navigateur : on le purge.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        try { await query('DELETE FROM push_subscriptions WHERE endpoint = ?', [s.endpoint]); } catch {}
      } else {
        logger.warn({ err: err?.message, status: err?.statusCode }, '[web-push] envoi échoué');
      }
    }
  }));
}

module.exports = { init, isEnabled, publicKey, saveSubscription, removeSubscription, sendToUser };
