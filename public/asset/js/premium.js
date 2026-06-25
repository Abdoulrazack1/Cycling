/* ═════════════════════════════════════════════════════════════════
   premium.js — Couche d'expérience premium
   ─────────────────────────────────────────────────────────────────
   Modules autonomes, défensifs, no-deps. Chargé en defer juste après
   main.js. Tous les modules sont opt-out : ils détectent leur cible
   et ne font rien si elle n'existe pas.

   Modules exposés sur window.CCS_PREMIUM :
   - progress.start() / .done() / .inc()           bar style YouTube
   - toast.push(msg, type, duration)               file FIFO (max 3)
   - copyLink(url, label?)                         copie + toast
   - viewTransition(updateDOMFn)                   wrapper API stable
   - smoothScrollTo(elOrId, offset)                scroll avec offset nav
   - vitals                                        Core Web Vitals collectés
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const NS = (window.CCS_PREMIUM = window.CCS_PREMIUM || {});

  /* ─── 1. Progress bar globale ─────────────────────────────── */
  const Progress = (() => {
    let bar = null;
    let pct = 0;
    let timer = null;
    let activeFetches = 0;

    function ensure() {
      if (bar) return bar;
      bar = document.createElement('div');
      bar.className = 'ccs-progress';
      bar.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bar);
      return bar;
    }
    function set(p) {
      ensure();
      pct = Math.max(0, Math.min(100, p));
      bar.style.transform = `scaleX(${pct / 100})`;
      bar.classList.toggle('active', pct > 0 && pct < 100);
    }
    function start() {
      if (pct === 0) set(8);
      clearInterval(timer);
      timer = setInterval(() => {
        if (pct < 90) set(pct + (90 - pct) * 0.08);
      }, 240);
    }
    function inc(amt = 5) { set(pct + amt); }
    function done() {
      clearInterval(timer);
      set(100);
      setTimeout(() => {
        if (!bar) return;
        bar.classList.remove('active');
        bar.style.transition = 'none';
        bar.style.transform = 'scaleX(0)';
        // force reflow puis remet la transition
        bar.offsetHeight; // eslint-disable-line no-unused-expressions
        bar.style.transition = '';
        pct = 0;
      }, 260);
    }

    // Intercepte fetch() global pour piloter la barre automatiquement
    if (window.fetch && !window.__ccsFetchPatched) {
      const orig = window.fetch.bind(window);
      window.fetch = function (...args) {
        // Ignore les pings courts / health checks
        const u = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        const skip = u.includes('/api/health') || u.startsWith('data:') || u.startsWith('blob:');
        if (!skip) {
          activeFetches++;
          if (activeFetches === 1) start();
        }
        return orig(...args)
          .finally(() => {
            if (skip) return;
            activeFetches = Math.max(0, activeFetches - 1);
            if (activeFetches === 0) done();
          });
      };
      window.__ccsFetchPatched = true;
    }

    return { start, done, inc, set };
  })();
  NS.progress = Progress;

  /* ─── 2. Toast queue (FIFO, max 3 visibles) ─────────────── */
  const ToastQueue = (() => {
    const stack = [];
    let host = null;
    function ensureHost() {
      if (host) return host;
      host = document.createElement('div');
      host.className = 'ccs-toast-host';
      host.setAttribute('role', 'region');
      host.setAttribute('aria-live', 'polite');
      host.setAttribute('aria-label', 'Notifications');
      document.body.appendChild(host);
      return host;
    }
    const ICONS = {
      success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5L20 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      error:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3l10 18H2L12 3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      info:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v5M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    };
    function esc(s) {
      return String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
    }
    function push(msg, type = 'info', duration = 3400) {
      const h = ensureHost();
      // Limiter à 3 affichés simultanément — les nouveaux poussent les vieux dehors
      while (h.children.length >= 3) h.firstChild.remove();
      const el = document.createElement('div');
      el.className = `ccs-toast ccs-toast--${type}`;
      el.setAttribute('role', type === 'error' ? 'alert' : 'status');
      el.innerHTML = (ICONS[type] || ICONS.info) + `<span>${esc(msg)}</span>` +
                     `<button class="ccs-toast-x" aria-label="Fermer">×</button>`;
      h.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));

      const close = () => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 320);
      };
      el.querySelector('.ccs-toast-x').addEventListener('click', close);
      const id = setTimeout(close, duration);
      stack.push({ el, id });
      return close;
    }
    return { push };
  })();
  NS.toast = ToastQueue;

  // Remplace window.toast par la nouvelle implémentation (rétrocompatible)
  window.toast = function (msg, type, duration) {
    return ToastQueue.push(msg, type, duration);
  };

  /* ─── 2b. Web Share API (mobile-first) ─────────────────── */
  NS.share = async function share(data) {
    const payload = {
      title: data.title || document.title,
      text: data.text || (document.querySelector('meta[name="description"]')?.content || ''),
      url: data.url || location.href,
    };
    if (navigator.share && navigator.canShare?.(payload)) {
      try {
        await navigator.share(payload);
        return { ok: true, method: 'native' };
      } catch (err) {
        // L'utilisateur a annulé — ne pas afficher de toast d'erreur
        if (err?.name === 'AbortError') return { ok: false, method: 'cancelled' };
      }
    }
    // Fallback : copie le lien
    NS.copyLink(payload.url, 'Lien copié — partage prêt');
    return { ok: true, method: 'clipboard' };
  };

  /* ─── 3. Copy-link helper avec feedback ─────────────────── */
  NS.copyLink = function copyLink(url, label = 'Lien copié') {
    const text = url || location.href;
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove();
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => ToastQueue.push(label, 'success'),
        () => { fallback(); ToastQueue.push(label, 'success'); }
      );
    } else {
      fallback();
      ToastQueue.push(label, 'success');
    }
  };

  /* ─── 4. View Transitions wrapper ───────────────────────── */
  NS.viewTransition = function viewTransition(updateDOM) {
    if (document.startViewTransition) {
      return document.startViewTransition(updateDOM);
    }
    // Fallback : exécute synchrone
    const r = updateDOM();
    return { finished: Promise.resolve(r), ready: Promise.resolve(r), updateCallbackDone: Promise.resolve(r) };
  };

  // DÉSACTIVÉ : l'interception de tous les clics ajoutait un délai
  // de 140 ms avant chaque navigation, ce qui rendait le site lent
  // au quotidien. Les View Transitions natives ne fonctionnent que pour
  // les Same-Document Navigations (SPA), pas pour multi-page sans bundler
  // — le délai n'apportait donc aucun vrai bénéfice visuel ici.

  /* ─── 5. Smooth scroll avec offset auto sous la nav fixe ── */
  NS.smoothScrollTo = function smoothScrollTo(target, extraOffset = 0) {
    const el = typeof target === 'string'
      ? document.getElementById(target.replace(/^#/, ''))
      : target;
    if (!el) return;
    const nav = document.getElementById('main-nav');
    const navH = nav ? nav.offsetHeight : 0;
    const y = el.getBoundingClientRect().top + window.pageYOffset - navH - 12 - extraOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  };

  // Intercepte les ancres `#xxx` pour appliquer l'offset
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id || id === 'main') return; // skip-link géré séparément
    const t = document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    NS.smoothScrollTo(t);
    history.replaceState(null, '', '#' + id);
  });

  /* ─── 6. Core Web Vitals — collecte en localStorage ──────── */
  const Vitals = { lcp: null, cls: 0, fid: null, ttfb: null, navStart: performance.now() };
  NS.vitals = Vitals;
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) Vitals.ttfb = Math.round(nav.responseStart - nav.requestStart);
  } catch {}
  try {
    new PerformanceObserver((list) => {
      const last = list.getEntries().pop();
      if (last) Vitals.lcp = Math.round(last.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) Vitals.cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  // Sauvegarde au unload (max 1 entrée par page, dernière connue)
  window.addEventListener('pagehide', () => {
    try {
      const log = JSON.parse(localStorage.getItem('ccs.vitals') || '[]').slice(-19);
      log.push({
        path: location.pathname,
        t: Date.now(),
        lcp: Vitals.lcp, cls: +Vitals.cls.toFixed(3), ttfb: Vitals.ttfb,
      });
      localStorage.setItem('ccs.vitals', JSON.stringify(log));
    } catch {}
  });

  /* ─── 6b. Raccourcis clavier globaux ───────────────────────── */
  // g h = home, g s = sorties, g e = events, g p = profil, g c = club
  // ? = afficher les raccourcis, t = cycle theme, esc = ferme modal/menu
  const SHORTCUTS = {
    'g h': '/index.html',
    'g s': '/sorties.html',
    'g e': '/evenements.html',
    'g p': '/profil.html',
    'g c': '/club.html',
    'g m': '/membres.html',
    'g k': '/segments.html',
    'g a': '/admin.html',
  };
  let chordBuffer = '';
  let chordTimer = null;
  document.addEventListener('keydown', (e) => {
    // Ignore si dans un champ saisie
    const t = e.target;
    if (t.matches && t.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Theme cycle
    if (e.key === 't' && !e.shiftKey) {
      if (window.CCS_THEME?.cycle) {
        const next = window.CCS_THEME.cycle();
        ToastQueue.push(`Thème : ${next}`, 'info', 1800);
        e.preventDefault();
        return;
      }
    }

    // Help
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      showShortcutsHelp();
      e.preventDefault();
      return;
    }

    // Chord g+x
    if (e.key === 'g' && !chordBuffer) {
      chordBuffer = 'g ';
      clearTimeout(chordTimer);
      chordTimer = setTimeout(() => { chordBuffer = ''; }, 1100);
      return;
    }
    if (chordBuffer === 'g ') {
      const combo = chordBuffer + e.key;
      const target = SHORTCUTS[combo];
      chordBuffer = '';
      clearTimeout(chordTimer);
      if (target) {
        e.preventDefault();
        location.href = target;
      }
    }
  });

  function showShortcutsHelp() {
    let m = document.getElementById('ccs-shortcuts-modal');
    if (m) { m.remove(); return; }
    m = document.createElement('div');
    m.id = 'ccs-shortcuts-modal';
    m.innerHTML = `
      <div class="ccs-shortcuts-back"></div>
      <div class="ccs-shortcuts-card">
        <div class="ccs-shortcuts-head">
          <h3>Raccourcis clavier</h3>
          <button class="ccs-shortcuts-x" aria-label="Fermer">×</button>
        </div>
        <div class="ccs-shortcuts-body">
          <dl>
            <dt><kbd>Ctrl</kbd>+<kbd>K</kbd></dt><dd>Recherche globale</dd>
            <dt><kbd>t</kbd></dt><dd>Cycle thème (clair / sombre / auto)</dd>
            <dt><kbd>?</kbd></dt><dd>Ce panneau</dd>
            <dt><kbd>Esc</kbd></dt><dd>Fermer modal / menu</dd>
          </dl>
          <h4>Navigation rapide</h4>
          <dl>
            <dt><kbd>g</kbd> <kbd>h</kbd></dt><dd>Accueil</dd>
            <dt><kbd>g</kbd> <kbd>s</kbd></dt><dd>Sorties</dd>
            <dt><kbd>g</kbd> <kbd>e</kbd></dt><dd>Événements</dd>
            <dt><kbd>g</kbd> <kbd>m</kbd></dt><dd>Membres</dd>
            <dt><kbd>g</kbd> <kbd>c</kbd></dt><dd>Club</dd>
            <dt><kbd>g</kbd> <kbd>p</kbd></dt><dd>Profil</dd>
            <dt><kbd>g</kbd> <kbd>k</kbd></dt><dd>Segments KOM</dd>
          </dl>
        </div>
      </div>`;
    document.body.appendChild(m);
    const close = () => m.remove();
    m.querySelector('.ccs-shortcuts-back').addEventListener('click', close);
    m.querySelector('.ccs-shortcuts-x').addEventListener('click', close);
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });
  }

  /* ─── 6c. PWA install prompt ─────────────────────────────── */
  // Détecte beforeinstallprompt + propose un bouton "Installer l'app"
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Affiche un mini-banner discret en bas
    const dismissed = parseInt(localStorage.getItem('ccs.pwa.dismissed') || '0', 10);
    if (Date.now() - dismissed < 14 * 86400_000) return; // 14j de dismiss
    if (matchMedia('(display-mode: standalone)').matches) return; // déjà installé
    showInstallBanner();
  });
  function showInstallBanner() {
    if (document.getElementById('ccs-pwa-banner')) return;
    const el = document.createElement('div');
    el.id = 'ccs-pwa-banner';
    el.className = 'ccs-pwa-banner';
    el.innerHTML = `
      <div class="ccs-pwa-banner-body">
        <strong>Installer C.C. Salouel</strong>
        <span>Accès rapide + mode hors-ligne</span>
      </div>
      <button class="ccs-pwa-banner-install">Installer</button>
      <button class="ccs-pwa-banner-x" aria-label="Plus tard">×</button>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    el.querySelector('.ccs-pwa-banner-install').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      el.remove();
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        ToastQueue.push('App installée — retrouve-la sur ton écran d\'accueil', 'success', 5000);
      }
      deferredPrompt = null;
    });
    el.querySelector('.ccs-pwa-banner-x').addEventListener('click', () => {
      el.remove();
      try { localStorage.setItem('ccs.pwa.dismissed', Date.now().toString()); } catch {}
    });
  }

  /* ─── 7. Pull-to-refresh (mobile uniquement, opt-in) ─────── */
  // Activé sur <body data-ptr> uniquement, pour éviter conflits scroll.
  (function initPullToRefresh() {
    if (!document.body.hasAttribute('data-ptr')) return;
    if (!('ontouchstart' in window)) return;
    let startY = 0, dy = 0, pulling = false;
    const indicator = document.createElement('div');
    indicator.className = 'ccs-ptr';
    indicator.innerHTML = '<span class="ccs-ptr-arrow">↻</span>';
    document.body.appendChild(indicator);
    document.addEventListener('touchstart', (e) => {
      if (window.scrollY > 4) return;
      startY = e.touches[0].clientY;
      pulling = true;
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      dy = Math.max(0, Math.min(120, e.touches[0].clientY - startY));
      indicator.style.transform = `translate(-50%, ${dy - 60}px) rotate(${dy * 4}deg)`;
      indicator.classList.toggle('ready', dy > 80);
    }, { passive: true });
    document.addEventListener('touchend', () => {
      if (!pulling) return;
      pulling = false;
      const trigger = dy > 80;
      indicator.style.transition = 'transform .3s ease';
      indicator.style.transform = 'translate(-50%, -60px)';
      setTimeout(() => { indicator.style.transition = ''; }, 320);
      dy = 0;
      if (trigger) location.reload();
    });
  })();
})();
