/* ═════════════════════════════════════════════════════════════════
   animations.js — Animations premium via anime.js (CDN)
   ─────────────────────────────────────────────────────────────────
   - Charge anime.js depuis cdn.jsdelivr.net (déjà whitelist CSP)
   - Counters animés (chiffres compteurs des stats)
   - Hero parallax 3D au scroll
   - Card 3D tilt au hover (mouse-move)
   - Stagger reveal des cartes et listes
   - Number-flip pour les compteurs live (live-time)

   Expose window.CCS_ANIM = { animate, stagger, ready }
   Respecte prefers-reduced-motion (désactive tout sauf opacity)
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = (window.CCS_ANIM = window.CCS_ANIM || {});
  let _readyResolve;
  NS.ready = new Promise((r) => { _readyResolve = r; });

  /* ─── Charge anime.js v3 depuis CDN si pas déjà présent ─────── */
  function loadAnime() {
    return new Promise((resolve, reject) => {
      if (window.anime) return resolve(window.anime);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js';
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve(window.anime);
      s.onerror = () => reject(new Error('anime.js failed to load'));
      document.head.appendChild(s);
    });
  }

  /* ─── Helpers internes ───────────────────────────────────────── */
  function animate(opts) {
    if (!window.anime) return Promise.resolve();
    if (reducedMotion) {
      // En mode réduit, applique juste les valeurs finales sans animation
      const targets = (typeof opts.targets === 'string')
        ? document.querySelectorAll(opts.targets)
        : (Array.isArray(opts.targets) ? opts.targets : [opts.targets]);
      const finalProps = {};
      for (const k in opts) {
        if (['targets','duration','delay','easing','complete','begin','update','direction','loop'].includes(k)) continue;
        const v = Array.isArray(opts[k]) ? opts[k][opts[k].length - 1] : opts[k];
        finalProps[k] = v;
      }
      targets.forEach(t => {
        if (!t || !t.style) return;
        for (const k in finalProps) {
          const v = typeof finalProps[k] === 'number' ? finalProps[k] + (k === 'opacity' ? '' : 'px') : finalProps[k];
          if (k in t.style) t.style[k] = v;
        }
      });
      return Promise.resolve();
    }
    return window.anime(opts).finished;
  }
  NS.animate = animate;

  /* ─── 1. Counters : anime les chiffres .stat-card-value, .page-head-meta-v ─── */
  function initCounters() {
    if (!window.anime) return;
    const targets = document.querySelectorAll('[data-counter], .page-head-meta-v, .stats-v, .stat-card-value');
    if (!targets.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.dataset.counted === '1') return;
        // Cherche le premier nombre dans le textContent
        const raw = el.textContent.replace(/\s/g, '');
        const m = raw.match(/[\d.,-]+/);
        if (!m) { io.unobserve(el); return; }
        const finalVal = parseFloat(m[0].replace(/,/g, '.'));
        if (isNaN(finalVal) || finalVal === 0) { io.unobserve(el); return; }
        const isFloat = m[0].includes('.') || m[0].includes(',');
        const suffix = raw.slice(m.index + m[0].length);
        const prefix = raw.slice(0, m.index);
        el.dataset.counted = '1';
        const obj = { v: 0 };
        window.anime({
          targets: obj,
          v: finalVal,
          duration: reducedMotion ? 1 : 1400,
          easing: 'easeOutCubic',
          round: isFloat ? 100 : 1,
          update: () => {
            const formatted = isFloat
              ? obj.v.toFixed(1).replace('.', ',')
              : Math.round(obj.v).toLocaleString('fr-FR');
            // Préserve le markup interne si présent (ex: <span class="unit">)
            const unitEl = el.querySelector('.unit');
            if (unitEl) {
              el.firstChild.textContent = prefix + formatted;
            } else {
              el.textContent = prefix + formatted + suffix;
            }
          },
        });
        io.unobserve(el);
      });
    }, { threshold: 0.3 });
    targets.forEach(t => io.observe(t));
  }

  /* ─── 2. Hero parallax 3D au scroll ────────────────────────────── */
  function initHeroParallax() {
    const heroBg = document.querySelector('.hero-bg img');
    const heroTitle = document.querySelector('.hero-title');
    if (!heroBg && !heroTitle) return;
    if (reducedMotion) return;
    let ticking = false;
    function update() {
      const y = window.scrollY;
      const max = window.innerHeight;
      const ratio = Math.min(1, y / max);
      if (heroBg) {
        heroBg.style.transform = `translateY(${y * 0.3}px) scale(${1 + ratio * 0.05})`;
        heroBg.style.opacity = String(1 - ratio * 0.4);
      }
      if (heroTitle) {
        heroTitle.style.transform = `translateY(${y * 0.15}px)`;
        heroTitle.style.opacity = String(1 - ratio * 0.7);
      }
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
  }

  /* ─── 3. 3D card tilt au hover (cards .rc, .stat-card) ────────── */
  function init3DTilt() {
    if (reducedMotion) return;
    const cards = document.querySelectorAll('.rc, .stat-card, .member-card, [data-tilt]');
    cards.forEach(card => {
      if (card.dataset.tiltInit === '1') return;
      card.dataset.tiltInit = '1';
      card.style.transformStyle = 'preserve-3d';
      card.style.willChange = 'transform';

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        const maxTilt = 6; // degrés — subtil
        card.style.transform = `perspective(900px) rotateY(${x * maxTilt}deg) rotateX(${-y * maxTilt}deg) translateZ(0)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ─── 4. Stagger reveal — entrée séquentielle des items ──────── */
  function initStaggerReveal() {
    if (!window.anime) return;
    const groups = document.querySelectorAll('[data-stagger]');
    if (!groups.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const group = entry.target;
        const children = group.children;
        if (group.dataset.staggered === '1') return;
        group.dataset.staggered = '1';
        window.anime({
          targets: children,
          opacity: [0, 1],
          translateY: reducedMotion ? 0 : [24, 0],
          delay: window.anime.stagger(60),
          duration: reducedMotion ? 1 : 700,
          easing: 'easeOutCubic',
        });
        io.unobserve(group);
      });
    }, { threshold: 0.1 });
    groups.forEach(g => io.observe(g));
  }

  /* ─── 5. Hero title letter-by-letter (premium) ────────────────── */
  function initHeroTitleReveal() {
    if (reducedMotion || !window.anime) return;
    const title = document.querySelector('.hero-title');
    if (!title || title.dataset.revealed === '1') return;
    title.dataset.revealed = '1';
    // Split chaque .line en spans de mots
    const lines = title.querySelectorAll('.line');
    if (!lines.length) return;
    lines.forEach(line => {
      const words = line.textContent.trim().split(/\s+/);
      // Ne pas split si déjà splitté
      if (line.querySelector('.ccs-word')) return;
      line.innerHTML = words.map(w =>
        `<span class="ccs-word" style="display:inline-block;opacity:0;transform:translateY(20px) rotateX(-20deg);">${w}</span>`
      ).join(' ');
    });
    window.anime({
      targets: title.querySelectorAll('.ccs-word'),
      opacity: [0, 1],
      translateY: [20, 0],
      rotateX: [-20, 0],
      delay: window.anime.stagger(70, { start: 150 }),
      duration: 900,
      easing: 'easeOutCubic',
    });
  }

  /* ─── 6. Number-flip subtil pour le live-time ───────────────── */
  function initLiveTimeFlip() {
    // Le live-time est mis à jour par main.js. On observe les mutations
    // pour ajouter un effet subtil de scale au changement de seconde.
    if (reducedMotion) return;
    const el = document.getElementById('live-time-footer');
    if (!el) return;
    let last = el.textContent;
    setInterval(() => {
      if (el.textContent !== last) {
        last = el.textContent;
        el.style.transition = 'transform .1s ease';
        el.style.transform = 'scale(1.05)';
        setTimeout(() => { el.style.transform = ''; }, 110);
      }
    }, 1000);
  }

  /* ─── Boot ──────────────────────────────────────────────────── */
  function boot() {
    loadAnime().then(() => {
      _readyResolve();
      initHeroTitleReveal();
      initCounters();
      initStaggerReveal();
      // Désactivé par défaut pour ne pas surcharger : à activer via data-tilt
      // init3DTilt();
      initHeroParallax();
      initLiveTimeFlip();

      // Active 3D tilt sur les cartes home + stat seulement
      // (sinon ça devient too much sur toutes les .rc des listes)
      if (document.body.classList.contains('home') || document.querySelector('.stat-card')) {
        init3DTilt();
      }
    }).catch(() => {
      // anime.js n'a pas chargé — pas grave, on continue sans
      _readyResolve();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
