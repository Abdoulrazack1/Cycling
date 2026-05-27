/* ═════════════════════════════════════════════════════════════════
   member-journey.js — Renforce le parcours membre
   ─────────────────────────────────────────────────────────────────
   - NotificationBell  : cloche dans la nav avec compteur unread + panneau
   - FavoriteToggle    : étoile sur la page sortie (favorites toggle)
   - InscriptionButton : bouton 1-clic d'inscription à une sortie
   - OnboardingChecklist : checklist visible sur profil pour les nouveaux

   Tous les modules sont auto-init au DOMContentLoaded et détectent
   leur cible. No-op si pas d'auth ou si target absent.

   Expose window.CCS_JOURNEY (helpers réutilisables).
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const NS = (window.CCS_JOURNEY = window.CCS_JOURNEY || {});

  function apiBase() {
    return window.CCS_CFG?.API || window.CCS_CONFIG?.apiBase || '/api';
  }
  function token() {
    return window.CCS_AUTH?.getToken?.() || null;
  }
  function isLogged() {
    return !!token();
  }
  async function api(path, opts = {}) {
    const t = token();
    const body = opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body;
    const r = await fetch(apiBase() + path, {
      ...opts,
      body,
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: 'Bearer ' + t } : {}),
        ...(opts.headers || {}),
      },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }
  NS.api = api;

  /* ─── 1. Notification bell + panel ────────────────────────────── */
  const Bell = (() => {
    let bellEl, badgeEl, panelEl;
    let unread = 0;
    let opened = false;
    let pollTimer = null;

    async function init() {
      if (!isLogged()) return;
      // Wait for the nav to be injected
      const navRight = await waitFor(() => document.querySelector('.nav-right'), 30);
      if (!navRight) return;
      if (navRight.querySelector('.ccs-bell')) return;

      bellEl = document.createElement('button');
      bellEl.type = 'button';
      bellEl.className = 'ccs-bell';
      bellEl.setAttribute('aria-label', 'Notifications');
      bellEl.title = 'Notifications';
      bellEl.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        <span class="ccs-bell-badge" aria-hidden="true" hidden>0</span>
      `;
      badgeEl = bellEl.querySelector('.ccs-bell-badge');

      // Insère avant le hamburger
      const hamburger = navRight.querySelector('.hamburger');
      if (hamburger) navRight.insertBefore(bellEl, hamburger);
      else navRight.appendChild(bellEl);

      bellEl.addEventListener('click', toggle);
      await refresh();
      pollTimer = setInterval(refresh, 60_000); // 1 minute
    }

    async function refresh() {
      try {
        const data = await api('/notifications/unread');
        unread = data.unread || 0;
        updateBadge();
      } catch {}
    }

    function updateBadge() {
      if (!badgeEl) return;
      if (unread > 0) {
        badgeEl.hidden = false;
        badgeEl.textContent = unread > 99 ? '99+' : String(unread);
        bellEl.classList.add('has-unread');
      } else {
        badgeEl.hidden = true;
        bellEl.classList.remove('has-unread');
      }
    }

    async function toggle() {
      if (opened) return close();
      opened = true;
      try {
        const data = await api('/notifications?limit=20');
        showPanel(data.notifications);
        unread = 0;
        updateBadge();
        // Marque tout comme lu
        api('/notifications/read-all', { method: 'POST' }).catch(() => {});
      } catch (err) {
        window.toast?.(err.message || 'Erreur notifications', 'error');
      }
    }

    function close() {
      opened = false;
      if (panelEl) panelEl.remove();
      panelEl = null;
    }

    function showPanel(items) {
      if (panelEl) panelEl.remove();
      panelEl = document.createElement('div');
      panelEl.className = 'ccs-notif-panel';
      panelEl.innerHTML = `
        <div class="ccs-notif-head">
          <span class="ccs-notif-title">Notifications</span>
          <button class="ccs-notif-x" aria-label="Fermer">×</button>
        </div>
        <div class="ccs-notif-list">
          ${items.length ? items.map(renderItem).join('') :
            '<div class="ccs-notif-empty">Aucune notification.</div>'}
        </div>
      `;
      // Positionne sous la cloche
      const rect = bellEl.getBoundingClientRect();
      panelEl.style.top = (rect.bottom + 8) + 'px';
      panelEl.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
      document.body.appendChild(panelEl);

      panelEl.querySelector('.ccs-notif-x').addEventListener('click', close);
      // Click outside
      setTimeout(() => {
        document.addEventListener('click', onOutside, { once: true });
      }, 50);
    }

    function onOutside(e) {
      if (!opened) return;
      if (panelEl && (panelEl.contains(e.target) || bellEl?.contains(e.target))) {
        document.addEventListener('click', onOutside, { once: true });
        return;
      }
      close();
    }

    function renderItem(n) {
      const dateLabel = formatRelative(n.created_at);
      const unreadCls = n.read_at ? '' : 'unread';
      const href = n.url ? n.url : '#';
      const escTitle = escapeHtml(n.title);
      const escBody  = n.body ? escapeHtml(n.body) : '';
      const tag = href === '#' ? 'div' : 'a';
      return `
        <${tag} class="ccs-notif-item ${unreadCls}" ${href !== '#' ? `href="${href}"` : ''}>
          <span class="ccs-notif-dot" data-type="${escapeHtml(n.type || '')}"></span>
          <div>
            <div class="ccs-notif-item-title">${escTitle}</div>
            ${escBody ? `<div class="ccs-notif-item-body">${escBody}</div>` : ''}
            <div class="ccs-notif-item-time">${dateLabel}</div>
          </div>
        </${tag}>`;
    }
    return { init, refresh };
  })();
  NS.bell = Bell;

  /* ─── 2. Favorite toggle (page sortie) ───────────────────────── */
  const Fav = (() => {
    async function init() {
      const btn = document.getElementById('fav-toggle');
      if (!btn) return;
      if (!isLogged()) { btn.hidden = true; return; }
      const sortieId = btn.dataset.sortieId || (new URLSearchParams(location.search)).get('id');
      if (!sortieId) return;
      btn.hidden = false;
      // Charge le statut initial
      try {
        const s = await api('/favorites/check/' + encodeURIComponent(sortieId));
        applyState(btn, s.favorite);
      } catch {}
      btn.addEventListener('click', async () => {
        const current = btn.classList.contains('is-fav');
        try {
          if (current) {
            await api('/favorites/' + encodeURIComponent(sortieId), { method: 'DELETE' });
            applyState(btn, false);
            window.toast?.('Retiré des favoris', 'info');
          } else {
            await api('/favorites/' + encodeURIComponent(sortieId), { method: 'POST' });
            applyState(btn, true);
            window.toast?.('Ajouté aux favoris', 'success');
          }
        } catch (err) {
          window.toast?.(err.message || 'Erreur favori', 'error');
        }
      });
    }
    function applyState(btn, isFav) {
      btn.classList.toggle('is-fav', isFav);
      btn.setAttribute('aria-pressed', String(isFav));
      btn.title = isFav ? 'Retirer des favoris' : 'Ajouter aux favoris';
    }
    return { init };
  })();
  NS.fav = Fav;

  /* ─── 3. Inscription button sortie (1-clic) ────────────────── */
  const Inscription = (() => {
    async function init() {
      const btn = document.getElementById('sortie-inscrire');
      if (!btn) return;
      const sortieId = btn.dataset.sortieId || (new URLSearchParams(location.search)).get('id');
      if (!sortieId) return;
      if (!isLogged()) {
        btn.textContent = 'Connectez-vous pour vous inscrire';
        btn.disabled = true;
        return;
      }
      try {
        const s = await api('/sorties/' + encodeURIComponent(sortieId) + '/inscription/me');
        applyState(btn, s.inscription);
      } catch {}
      btn.addEventListener('click', async () => {
        const isInscrit = btn.classList.contains('is-inscrit');
        btn.disabled = true;
        try {
          if (isInscrit) {
            await api('/sorties/' + encodeURIComponent(sortieId) + '/inscription', { method: 'DELETE' });
            applyState(btn, null);
            window.toast?.('Désinscription enregistrée', 'info');
          } else {
            await api('/sorties/' + encodeURIComponent(sortieId) + '/inscription', { method: 'POST', body: {} });
            applyState(btn, { statut: 'inscrit' });
            window.toast?.('Inscription confirmée', 'success');
            // Refresh notification bell badge
            Bell.refresh?.();
          }
        } catch (err) {
          window.toast?.(err.message || 'Erreur', 'error');
        } finally {
          btn.disabled = false;
        }
      });
    }
    function applyState(btn, inscription) {
      const isInscrit = inscription && inscription.statut === 'inscrit';
      btn.classList.toggle('is-inscrit', isInscrit);
      btn.textContent = isInscrit ? '✓ Inscrit·e — Se désinscrire' : "S'inscrire à cette sortie";
    }
    return { init };
  })();
  NS.inscription = Inscription;

  /* ─── 4. Onboarding checklist (profil) ───────────────────────── */
  const Onboarding = (() => {
    async function init() {
      if (!isLogged()) return;
      const host = document.getElementById('onboarding-checklist');
      if (!host) return;
      // Récupère l'utilisateur enrichi pour vérifier les checks
      try {
        const user = await api('/auth/me');
        const checks = computeChecks(user);
        const done = checks.filter(c => c.done).length;
        if (done === checks.length) {
          host.hidden = true;
          return;
        }
        host.hidden = false;
        host.innerHTML = renderChecklist(checks, done);
        host.querySelectorAll('[data-action]').forEach(el => {
          el.addEventListener('click', () => {
            const target = el.dataset.action;
            if (target.startsWith('#')) {
              document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              location.href = target;
            }
          });
        });
        // Bouton "Tout caché — rappeler plus tard"
        host.querySelector('[data-dismiss-onboarding]')?.addEventListener('click', () => {
          localStorage.setItem('ccs.onboarding.dismissed', '1');
          host.hidden = true;
        });
      } catch {}
    }
    function computeChecks(u) {
      return [
        { id: 'profil',    label: 'Compléter ton profil (date de naissance, photo)',
          done: !!(u.date_naissance && (u.avatar_url || u.bio)),
          action: '#profil-form-section' },
        { id: 'equipement', label: 'Renseigner ton vélo et ta FTP',
          done: !!(u.velo_modele || u.ftp_watts),
          action: '#equipement-section' },
        { id: 'strava',     label: 'Connecter ton compte Strava',
          done: !!u.strava_linked,
          action: '#strava-section' },
        { id: 'inscription', label: "S'inscrire à une sortie future",
          done: !!u.inscriptions_count,
          action: '/sorties.html?statut=future' },
      ];
    }
    function renderChecklist(checks, done) {
      const total = checks.length;
      const pct = Math.round((done / total) * 100);
      return `
        <div class="ccs-onboard">
          <div class="ccs-onboard-head">
            <div>
              <div class="ccs-onboard-chapter">Bienvenue au club</div>
              <h3 class="ccs-onboard-title">Premiers pas — ${done}/${total}</h3>
            </div>
            <button class="ccs-onboard-x" data-dismiss-onboarding aria-label="Masquer">×</button>
          </div>
          <div class="ccs-onboard-bar"><div class="ccs-onboard-bar-fill" style="width:${pct}%"></div></div>
          <ul class="ccs-onboard-list">
            ${checks.map(c => `
              <li class="ccs-onboard-item ${c.done ? 'done' : ''}">
                <span class="ccs-onboard-check">${c.done ? '✓' : ''}</span>
                <span class="ccs-onboard-label">${c.label}</span>
                ${!c.done ? `<button class="ccs-onboard-go" data-action="${c.action}">Faire</button>` : ''}
              </li>`).join('')}
          </ul>
        </div>`;
    }
    return { init };
  })();
  NS.onboarding = Onboarding;

  /* ─── Helpers ───────────────────────────────────────────────── */
  function waitFor(predicate, maxAttempts = 30, intervalMs = 80) {
    return new Promise((resolve) => {
      let n = 0;
      const tick = () => {
        const r = predicate();
        if (r) return resolve(r);
        if (++n >= maxAttempts) return resolve(null);
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatRelative(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "à l'instant";
    if (diff < 3600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3600_000)} h`;
    if (diff < 604_800_000) return `il y a ${Math.floor(diff / 86_400_000)} j`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  /* ─── 5. Tracker "Récemment vues" (sortie pages) ─────────────── */
  const RecentTracker = (() => {
    function init() {
      if (!isLogged()) return;
      // Détecte si on est sur sortie.html avec un ID
      const m = location.pathname.match(/sortie\.html$/i);
      if (!m) return;
      const id = (new URLSearchParams(location.search)).get('id');
      if (!id) return;
      // Track après 3 secondes (le user a vraiment regardé la page)
      setTimeout(() => {
        api('/my/recent/' + encodeURIComponent(id), { method: 'POST' }).catch(() => {});
      }, 3000);
    }
    return { init };
  })();
  NS.recentTracker = RecentTracker;

  /* ─── Boot ──────────────────────────────────────────────────── */
  function boot() {
    // Attend que CCS_AUTH soit prêt
    if (window.CCS_AUTH?.ready) {
      window.CCS_AUTH.ready().then(() => {
        Bell.init().catch(() => {});
        Fav.init().catch(() => {});
        Inscription.init().catch(() => {});
        Onboarding.init().catch(() => {});
        RecentTracker.init();
      });
    } else {
      // Pas d'auth chargée : on init quand même les composants public
      Fav.init().catch(() => {});
      Inscription.init().catch(() => {});
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
