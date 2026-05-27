/* ═════════════════════════════════════════════════════════════════
   theme.js — Switch clair / sombre / auto (suit l'OS)
   ─────────────────────────────────────────────────────────────────
   - Persistance localStorage ('ccs.theme': 'light'|'dark'|'auto')
   - Détection prefers-color-scheme pour le mode auto
   - Injection précoce (avant DOMContentLoaded) pour éviter le FOUC
   - Expose window.CCS_THEME.set('light'|'dark'|'auto') / .get() / .cycle()
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const KEY = 'ccs.theme';
  const VALID = ['light', 'dark', 'auto'];
  const root = document.documentElement;

  function read() {
    const v = localStorage.getItem(KEY);
    return VALID.includes(v) ? v : 'dark';
  }
  function write(v) {
    try { localStorage.setItem(KEY, v); } catch {}
  }
  function effectiveMode(stored) {
    if (stored !== 'auto') return stored;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function apply(theme, withTransition = false) {
    if (!VALID.includes(theme)) theme = 'dark';
    if (withTransition) {
      root.classList.add('theme-transition');
      setTimeout(() => root.classList.remove('theme-transition'), 420);
    }
    root.setAttribute('data-theme', theme);
    // Met à jour le meta theme-color pour la barre de status mobile
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const eff = effectiveMode(theme);
      meta.setAttribute('content', eff === 'light' ? '#F4EFE0' : '#0A1410');
    }
    // Notifie les autres modules (cartes, etc.)
    document.dispatchEvent(new CustomEvent('ccs:themechange', {
      detail: { theme, effective: effectiveMode(theme) },
    }));
  }

  // Application synchrone immédiate (évite le flash)
  apply(read(), false);

  // Watch les changements OS quand on est en mode auto
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (read() === 'auto') apply('auto', true);
  });

  // ─── API publique ──────────────────────────────────────────────
  const API = {
    get() { return read(); },
    getEffective() { return effectiveMode(read()); },
    set(theme) {
      if (!VALID.includes(theme)) return;
      write(theme);
      apply(theme, true);
      updateToggleUI();
    },
    cycle() {
      const cur = read();
      const next = cur === 'light' ? 'dark' : cur === 'dark' ? 'auto' : 'light';
      API.set(next);
      return next;
    },
  };
  window.CCS_THEME = API;

  // ─── Injection du switcher dans la nav ─────────────────────────
  function injectSwitcher() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight || document.querySelector('.theme-toggle')) return;
    const wrap = document.createElement('div');
    wrap.className = 'theme-toggle';
    wrap.setAttribute('role', 'radiogroup');
    wrap.setAttribute('aria-label', 'Thème');
    wrap.innerHTML = `
      <button class="theme-toggle-btn" data-theme-set="light" role="radio" aria-label="Mode clair" title="Mode clair">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      </button>
      <button class="theme-toggle-btn" data-theme-set="auto" role="radio" aria-label="Mode système" title="Suivre le système">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
      </button>
      <button class="theme-toggle-btn" data-theme-set="dark" role="radio" aria-label="Mode sombre" title="Mode sombre">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    `;
    // Insère AVANT le hamburger (s'il existe), sinon en premier
    const hamburger = navRight.querySelector('.hamburger');
    if (hamburger) navRight.insertBefore(wrap, hamburger);
    else navRight.prepend(wrap);

    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme-set]');
      if (!btn) return;
      API.set(btn.dataset.themeSet);
    });
    updateToggleUI();
  }
  function updateToggleUI() {
    const cur = read();
    document.querySelectorAll('.theme-toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.themeSet === cur);
      b.setAttribute('aria-checked', String(b.dataset.themeSet === cur));
    });
  }

  // Polling court car main.js peut injecter la nav après nous
  let attempts = 0;
  const interval = setInterval(() => {
    if (document.querySelector('.nav-right')) {
      injectSwitcher();
      clearInterval(interval);
    } else if (++attempts > 50) {
      clearInterval(interval);
    }
  }, 80);
})();
