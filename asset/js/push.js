/* ═════════════════════════════════════════════════════════════════
   push.js — Abonnement aux notifications Web Push (côté navigateur)
   ─────────────────────────────────────────────────────────────────
   Expose window.CCS_PUSH : { isSupported, state, enable, disable, toggle }.
   Câble automatiquement tout bouton portant l'attribut [data-push-toggle]
   et reflète l'état (off / on / refusé / non supporté).

   Nécessite un contexte sécurisé (HTTPS ou localhost) + un utilisateur
   connecté (les endpoints /subscribe sont protégés par requireAuth).
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SUPPORTED =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function currentSub() {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function state() {
    if (!SUPPORTED) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    try {
      const sub = await currentSub();
      return sub ? 'on' : 'off';
    } catch { return 'off'; }
  }

  async function enable() {
    if (!SUPPORTED) throw new Error('Notifications non supportées par ce navigateur');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Permission refusée');

    const keyRes = await fetch('/api/notifications/push/key', { credentials: 'include' });
    const { key, enabled } = await keyRes.json();
    if (!enabled || !key) throw new Error('Le serveur n’a pas de clé VAPID configurée');

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    const res = await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ subscription: sub }),
    });
    if (!res.ok) throw new Error('Échec de l’enregistrement côté serveur');
    return true;
  }

  async function disable() {
    const sub = await currentSub();
    if (sub) {
      try {
        await fetch('/api/notifications/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      } catch { /* le désabonnement local reste prioritaire */ }
      await sub.unsubscribe();
    }
    return true;
  }

  async function toggle() {
    const s = await state();
    if (s === 'on') { await disable(); return 'off'; }
    await enable();
    return 'on';
  }

  window.CCS_PUSH = { isSupported: () => SUPPORTED, state, enable, disable, toggle };

  // ─── Auto-câblage d'un bouton [data-push-toggle] ───────────────
  function wire() {
    const btn = document.querySelector('[data-push-toggle]');
    if (!btn) return;

    async function refresh() {
      const s = await state();
      btn.dataset.state = s;
      btn.disabled = (s === 'denied' || s === 'unsupported');
      btn.textContent =
        s === 'on'          ? 'Notifications activées ✓' :
        s === 'denied'      ? 'Notifications bloquées (réglages navigateur)' :
        s === 'unsupported' ? 'Notifications non supportées' :
                              'Activer les notifications push';
    }

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const next = await toggle();
        if (window.toast) window.toast(next === 'on' ? 'Notifications activées' : 'Notifications désactivées', 'success');
      } catch (e) {
        if (window.toast) window.toast(e.message || 'Action impossible', 'error');
      }
      await refresh();
    });

    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
