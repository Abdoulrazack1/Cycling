/* ═════════════════════════════════════════════════════════════════
   strava-ux.js — Facilite le linkage Strava + import
   ─────────────────────────────────────────────────────────────────
   1. Banner inline "Connecter Strava" auto-injecté pour les users
      connectés non-strava (sur profil + dashboard).
   2. Modal "Connect Strava" qui présente les bénéfices + permissions
      avant de partir sur OAuth.
   3. Sync UI améliorée : choix période + preview avant import.
   4. Page "Mes activités Strava" : liste + bouton import → sortie.
   5. Page "Mes itinéraires Strava" : liste + bouton import → sortie.

   Auto-init au DOMContentLoaded — injecte sur tous les éléments
   data-strava-banner et expose window.CCS_STRAVA_UX.
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const NS = (window.CCS_STRAVA_UX = window.CCS_STRAVA_UX || {});

  function apiBase() {
    return window.CCS_CFG?.API || window.CCS_CONFIG?.apiBase || '/api';
  }
  function token() {
    return window.CCS_AUTH?.getToken?.() || null;
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
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ─── Modal "Connecter Strava" ───────────────────────────────── */
  function showConnectModal() {
    let m = document.getElementById('ccs-strava-modal');
    if (m) { m.remove(); return; }
    m = document.createElement('div');
    m.id = 'ccs-strava-modal';
    m.className = 'ccs-strava-modal';
    m.innerHTML = `
      <div class="ccs-strava-modal-back"></div>
      <div class="ccs-strava-modal-card">
        <button class="ccs-strava-modal-x" aria-label="Fermer">×</button>
        <div class="ccs-strava-modal-head">
          <div class="ccs-strava-modal-chapter">Strava · Connexion</div>
          <h3>Lier ton compte Strava</h3>
        </div>
        <p class="ccs-strava-modal-intro">Ça prend 10 secondes et tu n'as rien à entrer. Tu garderas toujours le contrôle.</p>
        <ul class="ccs-strava-modal-list">
          <li>
            <span class="ccs-strava-modal-icon">→</span>
            <div><strong>Tes 90 derniers jours d'activités</strong> sont importés automatiquement.</div>
          </li>
          <li>
            <span class="ccs-strava-modal-icon">→</span>
            <div><strong>Tes stats personnelles</strong> alimentent ton classement saison sur la page profil.</div>
          </li>
          <li>
            <span class="ccs-strava-modal-icon">→</span>
            <div><strong>Tes itinéraires sauvegardés</strong> sont disponibles pour création de sorties club (si admin).</div>
          </li>
        </ul>
        <div class="ccs-strava-modal-perms">
          <div class="ccs-strava-modal-perms-title">Permissions demandées</div>
          <div class="ccs-strava-modal-perms-grid">
            <div><span class="dot ok"></span>Lecture activités &amp; profil public</div>
            <div><span class="dot ok"></span>Lecture itinéraires sauvegardés</div>
            <div><span class="dot ko"></span>Aucune écriture sur ton compte</div>
            <div><span class="dot ko"></span>Aucune publication automatique</div>
          </div>
        </div>
        <div class="ccs-strava-modal-actions">
          <a href="/api/strava/connect" class="btn btn-brass btn-lg ccs-strava-modal-go">
            Autoriser sur Strava
            <span class="btn-arrow">→</span>
          </a>
          <button type="button" class="btn btn-ghost btn-sm" id="ccs-strava-modal-cancel">Plus tard</button>
        </div>
        <p class="ccs-strava-modal-foot">Tu pourras te déconnecter à tout moment depuis ton profil.</p>
      </div>
    `;
    document.body.appendChild(m);
    const close = () => m.remove();
    m.querySelector('.ccs-strava-modal-x').addEventListener('click', close);
    m.querySelector('.ccs-strava-modal-back').addEventListener('click', close);
    m.querySelector('#ccs-strava-modal-cancel').addEventListener('click', close);
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });
  }
  NS.showConnectModal = showConnectModal;

  /* ─── Banner "Connecter Strava" inline ───────────────────────── */
  async function injectBanner(host) {
    if (!host || host.dataset.stravaBannerInit === '1') return;
    if (!token()) return;
    try {
      const s = await api('/strava/status');
      // Affiche le banner uniquement si configuré côté serveur ET non connecté
      if (!s.configured || s.connected) return;
      host.dataset.stravaBannerInit = '1';
      host.innerHTML = `
        <div class="ccs-strava-banner">
          <div class="ccs-strava-banner-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066M9.828 8.172L13.223 15h4.344L9.828 0 2 15h4.347"/></svg>
          </div>
          <div class="ccs-strava-banner-body">
            <div class="ccs-strava-banner-title">Connecte ton Strava</div>
            <div class="ccs-strava-banner-sub">Importe tes 90 derniers jours en 1 clic — sans saisir tes identifiants.</div>
          </div>
          <button type="button" class="btn btn-brass btn-sm ccs-strava-banner-cta">Connecter</button>
          <button type="button" class="ccs-strava-banner-x" aria-label="Masquer">×</button>
        </div>`;
      host.querySelector('.ccs-strava-banner-cta').addEventListener('click', showConnectModal);
      host.querySelector('.ccs-strava-banner-x').addEventListener('click', () => {
        host.remove();
        try { localStorage.setItem('ccs.strava-banner-dismissed', Date.now().toString()); } catch {}
      });
    } catch {
      // Pas connecté ou erreur API — pas de banner
    }
  }
  NS.injectBanner = injectBanner;

  /* ─── Modal "Importer plus" : choix période ─────────────────── */
  async function showSyncModal(currentBtn) {
    const m = document.createElement('div');
    m.className = 'ccs-strava-modal';
    m.innerHTML = `
      <div class="ccs-strava-modal-back"></div>
      <div class="ccs-strava-modal-card" style="max-width:480px;">
        <button class="ccs-strava-modal-x" aria-label="Fermer">×</button>
        <div class="ccs-strava-modal-head">
          <div class="ccs-strava-modal-chapter">Strava · Synchroniser</div>
          <h3>Importer des activités</h3>
        </div>
        <p class="ccs-strava-modal-intro">Choisis la période à importer. Le sync ne ré-importe pas les activités déjà connues.</p>
        <div class="ccs-strava-period">
          <button data-days="30">30 jours</button>
          <button data-days="90" class="active">90 jours</button>
          <button data-days="180">6 mois</button>
          <button data-days="365">1 an</button>
        </div>
        <div id="ccs-strava-preview" class="ccs-strava-preview"></div>
        <div class="ccs-strava-modal-actions">
          <button class="btn btn-brass btn-lg" id="ccs-strava-run-sync">Lancer la synchronisation</button>
          <button class="btn btn-ghost btn-sm" id="ccs-strava-cancel-sync">Annuler</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    const close = () => m.remove();
    m.querySelector('.ccs-strava-modal-x').addEventListener('click', close);
    m.querySelector('.ccs-strava-modal-back').addEventListener('click', close);
    m.querySelector('#ccs-strava-cancel-sync').addEventListener('click', close);
    let sinceDays = 90;

    const previewEl = m.querySelector('#ccs-strava-preview');
    async function preview(days) {
      previewEl.innerHTML = '<div class="ccs-spinner"></div> Analyse…';
      try {
        const p = await api('/strava/preview-sync?since_days=' + days + '&max_pages=1');
        let html = `<div class="ccs-strava-preview-head">
          <div><strong>${p.will_import}</strong> nouvelle${p.will_import > 1 ? 's' : ''} activité${p.will_import > 1 ? 's' : ''} à importer</div>
          <div class="ccs-strava-preview-sub">${p.already_imported} déjà en base · ${p.total_scanned} scannées au total</div>
        </div>`;
        if (p.preview && p.preview.length) {
          html += '<ul class="ccs-strava-preview-list">';
          for (const a of p.preview) {
            html += `<li>
              <span class="ccs-strava-preview-name">${esc(a.name)}</span>
              <span class="ccs-strava-preview-meta">${a.distance_km} km · ${new Date(a.date).toLocaleDateString('fr-FR')}</span>
            </li>`;
          }
          if (p.will_import > 5) html += `<li class="ccs-strava-preview-more">…et ${p.will_import - 5} autres</li>`;
          html += '</ul>';
        } else if (p.will_import === 0) {
          html += '<div class="ccs-strava-preview-empty">Tout est déjà à jour sur cette période.</div>';
        }
        previewEl.innerHTML = html;
      } catch (err) {
        previewEl.innerHTML = `<div class="ccs-strava-preview-error">${esc(err.message || 'Erreur preview')}</div>`;
      }
    }
    m.querySelectorAll('.ccs-strava-period button').forEach(btn => {
      btn.addEventListener('click', () => {
        m.querySelectorAll('.ccs-strava-period button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sinceDays = parseInt(btn.dataset.days, 10);
        preview(sinceDays);
      });
    });
    preview(sinceDays);

    m.querySelector('#ccs-strava-run-sync').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true; btn.textContent = 'Sync en cours…';
      try {
        const r = await api('/strava/sync', {
          method: 'POST',
          body: { since_days: sinceDays, max_pages: 5 },
        });
        window.toast?.(`${r.imported} activités importées (${r.skipped} déjà connues)`, 'success', 5000);
        close();
        // Refresh le panel parent si présent
        currentBtn?.dispatchEvent?.(new CustomEvent('ccs:strava-synced'));
        if (typeof window.loadStrava === 'function') window.loadStrava();
        else if (location.pathname.includes('profil')) setTimeout(() => location.reload(), 600);
      } catch (err) {
        window.toast?.('Erreur sync : ' + err.message, 'error');
        btn.disabled = false; btn.textContent = 'Lancer la synchronisation';
      }
    });
  }
  NS.showSyncModal = showSyncModal;

  /* ─── Auto-init ────────────────────────────────────────────── */
  function autoInit() {
    // Banner inline pour tout host [data-strava-banner]
    document.querySelectorAll('[data-strava-banner]').forEach(host => {
      // Ne ré-afficher pas si l'utilisateur l'a fermé récemment (< 7j)
      try {
        const dismissed = parseInt(localStorage.getItem('ccs.strava-banner-dismissed') || '0', 10);
        if (Date.now() - dismissed < 7 * 86400_000) return;
      } catch {}
      injectBanner(host);
    });

    // Wire les boutons [data-strava-connect] (modal au lieu de lien direct)
    document.querySelectorAll('[data-strava-connect]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showConnectModal();
      });
    });
    // Wire les boutons [data-strava-sync-modal]
    document.querySelectorAll('[data-strava-sync-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showSyncModal(btn);
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
