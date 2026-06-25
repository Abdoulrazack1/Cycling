/* ═════════════════════════════════════════════════════════════════
   micro-fx.js — Micro-interactions premium
   ─────────────────────────────────────────────────────────────────
   - Magnetic buttons : suivent légèrement le curseur au hover
   - Ink ripple : ondulation au click sur les boutons brass
   - Cursor spotlight : halo discret qui suit le curseur sur certaines sections
   - Image hover reveals : overlay avec texte au hover sur les cards
   - Char-by-char text reveal pour [data-split-text]
   - Glow on focus pour les inputs

   Tous les modules détectent prefers-reduced-motion et se neutralisent
   ou tournent en mode soft (juste les transitions CSS).
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = matchMedia('(hover: none)').matches;
  const NS = (window.CCS_MICRO_FX = window.CCS_MICRO_FX || {});

  /* ─── 1. Magnetic buttons ─────────────────────────────────── */
  // [data-magnetic] sur n'importe quel élément (bouton, lien…)
  function initMagnetic() {
    if (reducedMotion || isTouch) return;
    const targets = document.querySelectorAll('[data-magnetic], .btn-brass, .nav-cta');
    targets.forEach(el => {
      if (el.dataset.magneticInit === '1') return;
      el.dataset.magneticInit = '1';
      const strength = parseFloat(el.dataset.magnetic) || 0.25;
      el.style.willChange = 'transform';

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const dx = (e.clientX - rect.left - rect.width / 2) * strength;
        const dy = (e.clientY - rect.top - rect.height / 2) * strength;
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* ─── 2. Ink ripple au click ──────────────────────────────── */
  function initRipple() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-brass, .btn-ghost, .btn, [data-ripple]');
      if (!btn || btn.disabled) return;
      if (reducedMotion) return;
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ccs-ripple';
      const size = Math.max(rect.width, rect.height) * 2;
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
      // S'assurer que le parent peut contenir l'overlay
      const computedPos = getComputedStyle(btn).position;
      if (computedPos === 'static') btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    });
  }

  /* ─── 3. Cursor spotlight (sections [data-spotlight]) ────── */
  // Halo discret qui suit le curseur dans une section
  function initSpotlight() {
    if (reducedMotion || isTouch) return;
    const sections = document.querySelectorAll('[data-spotlight]');
    sections.forEach(s => {
      if (s.dataset.spotlightInit === '1') return;
      s.dataset.spotlightInit = '1';
      s.style.position = s.style.position || 'relative';
      s.style.overflow = s.style.overflow || 'hidden';
      const layer = document.createElement('div');
      layer.className = 'ccs-spotlight-layer';
      layer.setAttribute('aria-hidden', 'true');
      s.appendChild(layer);

      s.addEventListener('mousemove', (e) => {
        const rect = s.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        layer.style.setProperty('--mx', x + 'px');
        layer.style.setProperty('--my', y + 'px');
        layer.style.opacity = '1';
      });
      s.addEventListener('mouseleave', () => {
        layer.style.opacity = '0';
      });
    });
  }

  /* ─── 4. Char-by-char text reveal pour [data-split-text] ─── */
  // Split le textContent en spans de chars, anime à l'arrivée en vue
  function initSplitText() {
    if (!('IntersectionObserver' in window)) return;
    const targets = document.querySelectorAll('[data-split-text]');
    if (!targets.length) return;
    targets.forEach(el => {
      if (el.dataset.splitDone === '1') return;
      el.dataset.splitDone = '1';
      const text = el.textContent;
      el.textContent = '';
      // Split par mot, chaque mot wrap dans un span avec chars
      const words = text.split(/(\s+)/);
      for (const w of words) {
        if (/^\s+$/.test(w)) { el.appendChild(document.createTextNode(' ')); continue; }
        const wordSpan = document.createElement('span');
        wordSpan.className = 'ccs-split-word';
        wordSpan.style.display = 'inline-block';
        for (const c of w) {
          const charSpan = document.createElement('span');
          charSpan.className = 'ccs-split-char';
          charSpan.style.display = 'inline-block';
          charSpan.textContent = c;
          wordSpan.appendChild(charSpan);
        }
        el.appendChild(wordSpan);
      }
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const chars = entry.target.querySelectorAll('.ccs-split-char');
        chars.forEach((c, i) => {
          c.style.setProperty('--char-delay', (i * 0.022) + 's');
          c.classList.add('ccs-split-in');
        });
        io.unobserve(entry.target);
      });
    }, { threshold: 0.3 });
    targets.forEach(el => io.observe(el));
  }

  /* ─── 5. Link underline draw on hover ─────────────────────── */
  // Activé sur tous les <a> de .nav-links + footer + body (avec opt-out)
  function initLinkUnderlines() {
    // Géré purement en CSS via .ccs-link-fancy → on n'active que le marker
    document.querySelectorAll('.nav-links a, .footer-nav a').forEach(a => {
      if (!a.classList.contains('ccs-link-fancy') && !a.classList.contains('nav-cta')) {
        a.classList.add('ccs-link-fancy');
      }
    });
  }

  /* ─── 6. Image overlay reveal au hover ────────────────────── */
  // Active sur [data-img-reveal] : ajoute un overlay avec texte au hover
  function initImageReveal() {
    document.querySelectorAll('[data-img-reveal]').forEach(el => {
      if (el.dataset.imgRevealInit === '1') return;
      el.dataset.imgRevealInit = '1';
      const text = el.dataset.imgReveal;
      const overlay = document.createElement('div');
      overlay.className = 'ccs-img-overlay';
      overlay.innerHTML = `<span>${text}</span>`;
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.style.overflow = 'hidden';
      el.appendChild(overlay);
    });
  }

  /* ─── 7. Custom cursor (optional, opt-in via <body data-cursor>) ── */
  // Pas activé par défaut — peut sembler intrusif. Active via data-cursor.
  function initCustomCursor() {
    if (reducedMotion || isTouch) return;
    if (!document.body.hasAttribute('data-cursor')) return;
    const cursor = document.createElement('div');
    cursor.className = 'ccs-cursor';
    cursor.innerHTML = '<span class="ccs-cursor-dot"></span><span class="ccs-cursor-ring"></span>';
    document.body.appendChild(cursor);
    let x = 0, y = 0;
    document.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; });
    let rx = 0, ry = 0;
    function tick() {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      cursor.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(tick);
    }
    tick();
    // Quand on hover un lien/bouton, agrandit le cursor
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('a, button, [role=button]')) cursor.classList.add('hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest('a, button, [role=button]')) cursor.classList.remove('hover');
    });
  }

  /* ─── 8. Glow on focus for inputs ────────────────────────── */
  // Pure CSS — on ajoute juste une classe sur les inputs/textareas/selects
  function initFocusGlow() {
    document.querySelectorAll('input:not([type=hidden]), textarea, select').forEach(el => {
      el.classList.add('ccs-focus-glow');
    });
  }

  /* ─── Boot ──────────────────────────────────────────────── */
  function boot() {
    initMagnetic();
    initRipple();
    initSpotlight();
    initSplitText();
    initLinkUnderlines();
    initImageReveal();
    initCustomCursor();
    initFocusGlow();
  }
  NS.boot = boot;
  NS.initMagnetic = initMagnetic;
  NS.initSplitText = initSplitText;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
