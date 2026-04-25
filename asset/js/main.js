/* ═══════════════════════════════════════════════════════════════
   Club de Cyclisme de Salouel — main.js — v12 · C.C. Salouel
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  const NAV_HTML = `
    <a href="#main" class="skip-to-content">Aller au contenu</a>
    <nav id="main-nav" aria-label="Navigation principale">
      <a href="index.html" class="nav-logo" aria-label="Accueil">
        <span class="nav-monogram" aria-hidden="true">
          <span class="nav-monogram-inner">S</span>
        </span>
        <span class="nav-logo-text">
          <span class="nav-logo-name">C.C. Salouel</span>
          <span class="nav-logo-sub">Club de Cyclisme · Est. 1978</span>
        </span>
      </a>
      <ul class="nav-links" role="list">
        <li><a href="index.html"      class="nl" data-page="index.html">Accueil</a></li>
        <li><a href="sorties.html"    class="nl" data-page="sorties.html">Sorties</a></li>
        <li><a href="parcours.html"   class="nl" data-page="parcours.html">Parcours</a></li>
        <li><a href="evenements.html" class="nl" data-page="evenements.html">Événements</a></li>
        <li><a href="club.html"       class="nl" data-page="club.html">Le Club</a></li>
        <li><a href="palmares.html"   class="nl" data-page="palmares.html">Palmarès</a></li>
        <li><a href="contact.html"    class="nl" data-page="contact.html">Contact</a></li>
      </ul>
      <div class="nav-right">
        <a href="sortie.html" class="nav-cta" data-nav-sortie>
          <span class="nav-cta-dot" aria-hidden="true"></span>
          <span>Dernière sortie</span>
        </a>
        <button class="hamburger" id="hamburger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="mobile-nav">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
    <div class="mobile-nav" id="mobile-nav" aria-hidden="true">
      <ul role="list">
        <li><a href="index.html"      class="mn-link" data-page="index.html"><span>Accueil</span><span class="mn-num">01</span></a></li>
        <li><a href="sorties.html"    class="mn-link" data-page="sorties.html"><span>Sorties</span><span class="mn-num">02</span></a></li>
        <li><a href="parcours.html"   class="mn-link" data-page="parcours.html"><span>Parcours</span><span class="mn-num">03</span></a></li>
        <li><a href="sortie.html"     class="mn-link" data-page="sortie.html"><span>Dernière sortie</span><span class="mn-num">04</span></a></li>
        <li><a href="evenements.html" class="mn-link" data-page="evenements.html"><span>Événements</span><span class="mn-num">05</span></a></li>
        <li><a href="club.html"       class="mn-link" data-page="club.html"><span>Le Club</span><span class="mn-num">06</span></a></li>
        <li><a href="membres.html"    class="mn-link" data-page="membres.html"><span>Les sociétaires</span><span class="mn-num">07</span></a></li>
        <li><a href="palmares.html"   class="mn-link" data-page="palmares.html"><span>Palmarès</span><span class="mn-num">08</span></a></li>
        <li><a href="segments.html"   class="mn-link" data-page="segments.html"><span>Segments · KOM</span><span class="mn-num">09</span></a></li>
        <li><a href="profil.html"     class="mn-link" data-page="profil.html"><span>Mon profil</span><span class="mn-num">10</span></a></li>
        <li><a href="contact.html"    class="mn-link" data-page="contact.html"><span>Contact</span><span class="mn-num">11</span></a></li>
      </ul>
      <div class="mn-meta">
        <span>Salouel · Somme · 1978</span>
        <span id="live-time-mobile">--:--</span>
      </div>
    </div>
  `;

  const FOOTER_HTML = `
    <footer class="site-footer" role="contentinfo">
      <div class="footer-wordmark">
        <div class="footer-wordmark-crest">C.C.S. · est. 1978</div>
        <div class="footer-wordmark-title">Salouel<span class="it">.</span></div>
        <div class="footer-wordmark-sub">Club de Cyclisme · Hauts-de-France</div>
      </div>

      <div class="footer-grid">
        <div>
          <div class="footer-col-title">Le Club</div>
          <p class="footer-about">Association loi 1901 fondée en 1978 par cinq cheminots passionnés, le Club de Cyclisme de Salouel rassemble aujourd'hui 87 sociétaires de trois générations. Pavés, monts flamands, gravel, côte d'Opale.</p>
        </div>
        <div>
          <div class="footer-col-title">Explorer</div>
          <nav class="footer-nav" aria-label="Explorer">
            <a href="sorties.html">Les sorties</a>
            <a href="parcours.html">Les parcours</a>
            <a href="sortie.html">Dernière sortie</a>
            <a href="evenements.html">Événements</a>
            <a href="palmares.html">Palmarès</a>
            <a href="segments.html">Segments · KOM</a>
          </nav>
        </div>
        <div>
          <div class="footer-col-title">Le club</div>
          <nav class="footer-nav" aria-label="Le club">
            <a href="club.html">Qui sommes-nous</a>
            <a href="membres.html">Les sociétaires</a>
            <a href="profil.html">Mon profil</a>
            <a href="contact.html">Nous rejoindre</a>
            <a href="mentions-legales.html">Mentions légales</a>
          </nav>
        </div>
        <div>
          <div class="footer-col-title">Coordonnées</div>
          <div class="footer-meta">
            <div>
              <span class="footer-meta-l">Clubhouse</span>
              <span class="footer-meta-v">14 rue de l'Église<br>80480 Salouel</span>
            </div>
            <div>
              <span class="footer-meta-l">Contact</span>
              <span class="footer-meta-v">contact@club-salouel.fr</span>
            </div>
            <div>
              <span class="footer-meta-l">Sortie hebdomadaire</span>
              <span class="footer-meta-v">Dimanche · 8h30</span>
            </div>
          </div>
        </div>
      </div>

      <div class="footer-bar">
        <span>© 1978–2026 · C.C. Salouel</span>
        <span id="live-time-footer">--:--:--</span>
      </div>
    </footer>
  `;

  function injectChrome() {
    if (!document.getElementById('main-nav')) {
      document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
    }
    if (!document.querySelector('.site-footer')) {
      document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);
    }
    document.querySelectorAll('[data-page]').forEach(a => {
      if (a.dataset.page === currentPage) a.classList.add('active');
    });
    // Mettre à jour le lien "Dernière sortie" avec la dernière sortie passée
    initNavCta();
  }

  function initNavCta() {
    // Attendre CCS_DATA avec un polling (data.js peut être chargé après main.js)
    const waitAndUpdate = (attempt = 0) => {
      if (typeof window.CCS_DATA === 'undefined') {
        if (attempt < 40) setTimeout(() => waitAndUpdate(attempt + 1), 100);
        return;
      }
      window.CCS_DATA.sorties({ statut: 'passee', limit: 1 })
        .then(sorties => {
          const derniere = Array.isArray(sorties) ? sorties[0] : null;
          if (!derniere) return;
          const url = 'sortie.html?id=' + encodeURIComponent(derniere.id);
          // data-nav-sortie est posé sur le lien dans NAV_HTML — jamais sur le bouton auth
          document.querySelectorAll('[data-nav-sortie]').forEach(a => {
            if (!a.href.includes('?id=')) a.href = url;
          });
        })
        .catch(() => { /* fallback silencieux : on garde sortie.html */ });
    };
    waitAndUpdate();
  }

  function initNavScroll() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;
    const update = () => nav.classList.toggle('scrolled', window.scrollY > 20);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  function initMobileNav() {
    const btn = document.getElementById('hamburger');
    const panel = document.getElementById('mobile-nav');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.setAttribute('aria-hidden', String(open));
      document.body.classList.toggle('no-scroll', !open);
    });
    panel.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        btn.setAttribute('aria-expanded', 'false');
        panel.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('no-scroll');
      });
    });
  }

  function startLiveTime() {
    const ids = ['live-time', 'live-time-footer', 'live-time-mobile'];
    const els = ids.map(i => document.getElementById(i)).filter(Boolean);
    if (!els.length) return;
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      els.forEach(el => {
        el.textContent = (el.id === 'live-time-mobile') ? `${hh}:${mm}` : `${hh}:${mm}:${ss}`;
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  function initReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('revealed'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const d = parseInt(e.target.dataset.delay || '0', 10);
          e.target.style.setProperty('--d', d);
          e.target.classList.add('revealed');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px 0px 0px' });
    document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
  }

  function initPowerBars() {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const w = e.target.dataset.w || '0';
          e.target.style.width = w + '%';
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('.power-bar').forEach(el => io.observe(el));
  }

  window.toast = function toast(msg, type = 'info', duration = 3200) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('role', 'status');
    const icons = {
      success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5L20 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      error:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2"/></svg>',
      warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3l10 18H2L12 3z" stroke="currentColor" stroke-width="2"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="2"/></svg>',
      info:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v5M12 17h.01" stroke="currentColor" stroke-width="2"/></svg>'
    };
    el.innerHTML = (icons[type] || icons.info) + '<span>' + msg + '</span>';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, duration);
  };

  function boot() {
    injectChrome();
    initNavScroll();
    initMobileNav();
    startLiveTime();
    initReveal();
    initPowerBars();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* ─── Scroll to top ──────────────────────────────────────── */
(function initScrollTop() {
  const btn = document.createElement('button');
  btn.className = 'scroll-top';
  btn.setAttribute('aria-label', 'Retour en haut');
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>';
  document.body.appendChild(btn);

  const toggle = () => btn.classList.toggle('visible', window.scrollY > 400);
  window.addEventListener('scroll', toggle, { passive: true });
  toggle();

  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();