/* ═════════════════════════════════════════════════════════════════
   scroll-fx.js — Effets scroll-driven avancés
   ─────────────────────────────────────────────────────────────────
   Ce module ajoute :
   - Barre de progression scroll en haut de page (style article long)
   - Parallax multi-couches sur les éléments [data-parallax]
   - Parallax sur les images des cards (hero image bouge moins vite)
   - Scroll-linked animations sur [data-scroll-anim]
   - Velocity-aware marquees (la vitesse de la marquee suit le scroll)
   - Section reveal en cascade (chaque enfant a un delay)
   - Sticky section headers qui se condensent au scroll

   Tout est rAF-batched pour rester à 60fps même avec beaucoup d'éléments.
   Respecte prefers-reduced-motion : tout est neutralisé.
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = (window.CCS_SCROLL_FX = window.CCS_SCROLL_FX || {});

  // Pose le marqueur "js-fx" immédiatement : la CSS l'utilise pour cacher
  // les éléments [data-scroll-anim] avant l'animation, MAIS seulement si
  // JS est prêt (sinon dégradation propre).
  document.documentElement.classList.add('js-fx');

  /* ─── 1. Barre de progression scroll ──────────────────────── */
  function initScrollProgress() {
    if (document.getElementById('ccs-scroll-progress')) return;
    const bar = document.createElement('div');
    bar.id = 'ccs-scroll-progress';
    bar.className = 'ccs-scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    let ticking = false;
    function update() {
      const doc = document.documentElement;
      const scrolled = doc.scrollTop;
      const max = Math.max(1, doc.scrollHeight - doc.clientHeight);
      const ratio = Math.min(1, Math.max(0, scrolled / max));
      bar.style.transform = `scaleX(${ratio})`;
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ─── 2. Parallax multi-couches ────────────────────────────── */
  // [data-parallax="0.3"] → l'élément bouge à 30% de la vitesse du scroll
  // [data-parallax-direction="x|y"] (par défaut y)
  function initParallax() {
    if (reducedMotion) return;
    const targets = Array.from(document.querySelectorAll('[data-parallax]'));
    if (!targets.length) return;

    // Stocke les rects pour éviter de les recalculer constamment (recalc on resize)
    let rects = [];
    function refreshRects() {
      rects = targets.map(el => ({
        el,
        speed: parseFloat(el.dataset.parallax) || 0.3,
        direction: (el.dataset.parallaxDirection || 'y'),
        rect: el.getBoundingClientRect(),
        offset: window.pageYOffset + el.getBoundingClientRect().top,
      }));
    }
    refreshRects();
    window.addEventListener('resize', refreshRects, { passive: true });

    let ticking = false;
    function update() {
      const scrollY = window.pageYOffset;
      const vh = window.innerHeight;
      for (const t of rects) {
        // L'élément est-il visible dans la viewport ?
        const top = t.offset - scrollY;
        if (top > vh || top + t.rect.height < 0) continue;
        // Distance depuis le centre du viewport
        const center = top + t.rect.height / 2 - vh / 2;
        const delta = -center * t.speed;
        if (t.direction === 'x') {
          t.el.style.transform = `translate3d(${delta}px, 0, 0)`;
        } else {
          t.el.style.transform = `translate3d(0, ${delta}px, 0)`;
        }
      }
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ─── 3. Card image parallax ──────────────────────────────── */
  // Les images dans .rc-img bougent à 80% du scroll pour donner de la profondeur
  function initCardImageParallax() {
    if (reducedMotion) return;
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const card = entry.target;
        if (entry.isIntersecting) card.dataset.inView = '1';
        else delete card.dataset.inView;
      });
    }, { threshold: 0 });

    document.querySelectorAll('.rc-img, .story-img, [data-card-parallax]').forEach(el => {
      const img = el.querySelector('img');
      if (!img) return;
      el.dataset.cardParallaxInit = '1';
      img.style.willChange = 'transform';
      io.observe(el);
    });

    let ticking = false;
    function update() {
      const vh = window.innerHeight;
      document.querySelectorAll('[data-in-view="1"]').forEach(el => {
        const img = el.querySelector('img');
        if (!img) return;
        const rect = el.getBoundingClientRect();
        // Position relative dans la viewport (-1 = sous l'écran, +1 = au-dessus)
        const center = (rect.top + rect.height / 2 - vh / 2) / vh;
        // Translate l'image entre -8% et +8%
        img.style.transform = `translate3d(0, ${center * 8}%, 0) scale(1.08)`;
      });
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }

  /* ─── 4. Stagger reveal en cascade pour [data-cascade] ───── */
  function initCascadeReveal() {
    if (reducedMotion) return;
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-cascade] > *').forEach(el => el.classList.add('cascade-in'));
      return;
    }
    function trigger(parent) {
      if (parent.dataset.cascadeDone === '1') return;
      parent.dataset.cascadeDone = '1';
      parent.querySelectorAll(':scope > *').forEach((child, i) => {
        child.style.setProperty('--cascade-delay', (i * 0.07) + 's');
        // RAF pour laisser peindre l'état initial avant la transition
        requestAnimationFrame(() => {
          requestAnimationFrame(() => child.classList.add('cascade-in'));
        });
      });
    }
    const vh = window.innerHeight;
    document.querySelectorAll('[data-cascade]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.85) trigger(el);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          trigger(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('[data-cascade]').forEach(el => io.observe(el));
  }

  /* ─── 5. Scroll-linked animations ─────────────────────────── */
  // [data-scroll-anim="fade-up"] et autres variants.
  // Note importante : IO peut prendre 1-2 frames pour signaler les
  // intersections initiales. Pour éviter un flash sur les éléments
  // au-dessus du fold, on ajoute immédiatement la classe aux éléments
  // dont la position initiale est dans la viewport.
  function initScrollAnim() {
    if (!('IntersectionObserver' in window)) {
      // Fallback : tout visible direct
      document.querySelectorAll('[data-scroll-anim]').forEach(el => el.classList.add('scroll-anim-in'));
      return;
    }
    const targets = document.querySelectorAll('[data-scroll-anim]');
    const vh = window.innerHeight;
    // Pass 1 : marque immédiatement ce qui est déjà au-dessus du fold
    targets.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.85) {
        // Petit délai pour laisser le navigateur peindre l'état initial
        // avant d'enclencher la transition (sinon pas d'anim visible)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => el.classList.add('scroll-anim-in'));
        });
      }
    });
    // Pass 2 : IO classique pour le reste, avec stagger par index pour
    // un effet plus dynamique quand plusieurs sections sont proches.
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Si déjà animé par la pass 1, no-op
          if (!entry.target.classList.contains('scroll-anim-in')) {
            entry.target.classList.add('scroll-anim-in');
          }
          if (!entry.target.dataset.scrollAnimRepeat) io.unobserve(entry.target);
        } else if (entry.target.dataset.scrollAnimRepeat) {
          entry.target.classList.remove('scroll-anim-in');
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
    targets.forEach(el => io.observe(el));
  }

  /* ─── 6. Velocity-aware marquees ───────────────────────────── */
  // .marquee voit sa vitesse accélérer/inverser au scroll
  function initMarqueeVelocity() {
    if (reducedMotion) return;
    const tracks = document.querySelectorAll('.marquee-track, [data-marquee-velocity]');
    if (!tracks.length) return;
    let lastScroll = window.pageYOffset;
    let velocity = 0;
    let ticking = false;

    function updateVelocity() {
      const cur = window.pageYOffset;
      const delta = cur - lastScroll;
      lastScroll = cur;
      // Lisse la vélocité (ease vers 0)
      velocity = velocity * 0.7 + delta * 0.3;
      const factor = Math.max(-3, Math.min(3, 1 + velocity * 0.04));
      tracks.forEach(t => {
        t.style.animationDuration = (60 / Math.abs(factor)) + 's';
        t.style.animationDirection = factor < 0 ? 'reverse' : 'normal';
      });
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(updateVelocity); ticking = true; }
    }, { passive: true });
  }

  /* ─── 7. Nav scroll : condensation au scroll ──────────────── */
  // Nav devient plus compacte après 80px de scroll
  function initNavCondense() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;
    let ticking = false;
    function update() {
      const condensed = window.pageYOffset > 80;
      nav.classList.toggle('condensed', condensed);
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ─── 8. Active section indicator dans la nav ─────────────── */
  // Ajoute .nav-active sur le lien correspondant à la section visible
  function initSectionTracker() {
    const sections = document.querySelectorAll('section[id], main [id]');
    if (sections.length < 2) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          document.querySelectorAll('[data-nav-section]').forEach(a => {
            a.classList.toggle('nav-active', a.dataset.navSection === id);
          });
        }
      });
    }, { threshold: 0.5 });
    sections.forEach(s => io.observe(s));
  }

  /* ─── 9. Auto-apply : ajoute data-scroll-anim aux sections ─── */
  // Pour que l'effet fade-up se voie partout sans toucher chaque HTML.
  function autoApplyAnims() {
    if (reducedMotion) return;
    const tag = (el, attr, val = '') => {
      if (!el.hasAttribute(attr)) el.setAttribute(attr, val);
    };
    // a) Toutes les sections .section / .section-sm
    document.querySelectorAll('.section, .section-sm').forEach(el => {
      if (el.hasAttribute('data-scroll-anim') || el.hasAttribute('data-reveal')) return;
      el.setAttribute('data-scroll-anim', 'fade-up');
    });
    // b) Story blocks
    document.querySelectorAll('.story-two, .story-three').forEach(el => {
      if (el.hasAttribute('data-scroll-anim') || el.hasAttribute('data-reveal')) return;
      el.setAttribute('data-scroll-anim', 'fade-up');
    });
    // c) Story image : parallax doux
    document.querySelectorAll('.story-img').forEach(el => tag(el, 'data-card-parallax', '1'));
    // d) Grids de cards : data-cascade pour l'entrée en cascade
    document.querySelectorAll('.row-cards, [data-cards], .sec-cards, .stats-row, .members-grid, .list-ornate').forEach(el => tag(el, 'data-cascade'));
    // e) Card images : data-card-parallax
    document.querySelectorAll('.rc-img, .rc-image').forEach(el => tag(el, 'data-card-parallax', '1'));
    // f) Hero h1 / titres principaux → fade-up
    document.querySelectorAll('.hero-title, .page-head-title, .d-l, .d-xl, .d-m').forEach(el => {
      if (el.hasAttribute('data-scroll-anim') || el.hasAttribute('data-reveal')) return;
      el.setAttribute('data-scroll-anim', 'fade-up');
    });
    // g) section heads (sec-head)
    document.querySelectorAll('.sec-head').forEach(el => {
      if (el.hasAttribute('data-scroll-anim') || el.hasAttribute('data-reveal')) return;
      el.setAttribute('data-scroll-anim', 'fade-up');
    });
    // h) Images héro : parallax MARQUÉ pour effet profondeur
    document.querySelectorAll('.hero-bg, .page-head-hero, [data-hero-bg]').forEach(el => {
      tag(el, 'data-parallax', '0.4');
    });
    // i) Footers, mentions : zoom-in subtil
    document.querySelectorAll('.site-footer, footer.site-footer').forEach(el => {
      tag(el, 'data-scroll-anim', 'fade-up');
    });
  }

  /* ─── Boot ──────────────────────────────────────────────── */
  function boot() {
    // L'auto-apply doit tourner AVANT les init pour que les IO observent
    // les bons éléments (ils sont scannés au init).
    autoApplyAnims();
    initScrollProgress();
    initParallax();
    initCardImageParallax();
    initCascadeReveal();
    initScrollAnim();
    initNavCondense();
    initSectionTracker();
    // Marquee velocity désactivé par défaut — trop intrusif sur certains layouts.
    // Active manuellement via window.CCS_SCROLL_FX.initMarqueeVelocity()
  }
  NS.initMarqueeVelocity = initMarqueeVelocity;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
