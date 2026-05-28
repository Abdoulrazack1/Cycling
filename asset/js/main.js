/* ═══════════════════════════════════════════════════════════════
   Club de Cyclisme de Salouel — main.js — v12 · C.C. Salouel
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  // ── Service Worker registration (Brief C3 — PWA) ─────────────
  // Activé uniquement en HTTPS ou localhost (exigence navigateur).
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* silencieux : pas critique */ });
    });
  }

  // ── Chargement progressif des couches FX/CSS/JS ─────────────
  // CRITIQUE : seulement theme.css + theme.js (immédiat pour éviter
  // le flash de couleur au switch dark/light).
  // TOUT LE RESTE : chargé après que la page soit interactive
  // (requestIdleCallback) — n'impacte plus le LCP.
  (function loadFx() {
    function inject(tag, val) {
      if (document.querySelector(`${tag}[${tag === 'link' ? 'href' : 'src'}="${val}"]`)) return;
      const el = document.createElement(tag);
      if (tag === 'link') { el.rel = 'stylesheet'; el.href = val; }
      else { el.src = val; el.defer = true; }
      document.head.appendChild(el);
    }
    // Critical : seul le thème pour éviter le flash de couleur
    inject('link', 'asset/css/theme.css');
    inject('script', 'asset/js/theme.js');
    // Tout le reste en idle
    function loadLazy() {
      [
        'asset/css/fx.css',
        'asset/css/premium.css',
        'asset/css/journey.css',
        'asset/css/strava-ux.css',
      ].forEach(v => inject('link', v));
      [
        'asset/js/premium.js',
        'asset/js/scroll-fx.js',
        'asset/js/micro-fx.js',
        'asset/js/animations.js',
        'asset/js/member-journey.js',
        'asset/js/breadcrumbs.js',
        'asset/js/admin-palette.js',
        'asset/js/strava-ux.js',
      ].forEach(v => inject('script', v));
    }
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadLazy, { timeout: 1500 });
    } else {
      setTimeout(loadLazy, 100);
    }
  })();

  const currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  const NAV_HTML = `
    <a href="#main" class="skip-to-content">Aller au contenu</a>
    <nav id="main-nav" aria-label="Navigation principale">
      <a href="index.html" class="nav-logo" aria-label="Accueil">
        <span class="nav-monogram" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="34" height="34">
            <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.5"/>
            <line x1="16" y1="3" x2="16" y2="29" stroke="currentColor" stroke-width="0.6" opacity="0.5" stroke-linecap="round"/>
            <line x1="3" y1="16" x2="29" y2="16" stroke="currentColor" stroke-width="0.6" opacity="0.5" stroke-linecap="round"/>
            <circle cx="16" cy="16" r="1.4" fill="currentColor"/>
            <text x="16" y="22" font-family="Playfair Display, Georgia, serif" font-style="italic" font-size="16" font-weight="500"
                  fill="currentColor" text-anchor="middle"
                  style="paint-order:stroke; stroke:var(--ink, #0A1410); stroke-width:1.5px;">S</text>
          </svg>
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
        <button class="nav-search-btn" id="nav-search-btn" type="button" aria-label="Rechercher (Ctrl+K)" title="Rechercher · Ctrl+K">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <span class="nav-search-kbd" aria-hidden="true">⌘K</span>
        </button>
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
        <li><a href="mon-espace.html" class="mn-link" data-page="mon-espace.html"><span>Mon espace</span><span class="mn-num">10</span></a></li>
        <li><a href="profil.html"     class="mn-link" data-page="profil.html"><span>Mon profil</span><span class="mn-num">11</span></a></li>
        <li><a href="contact.html"    class="mn-link" data-page="contact.html"><span>Contact</span><span class="mn-num">12</span></a></li>
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
            <a href="DOCUMENTATION.md">Guide utilisateur</a>
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

      <div class="footer-newsletter" data-newsletter>
        <div class="footer-col-title">Lettre du club</div>
        <p class="footer-newsletter-sub">Une lettre tous les deux mois — sorties, calendrier, palmarès. Désabonnement en un clic.</p>
        <form class="footer-newsletter-form" id="footer-newsletter" novalidate>
          <input type="email" name="email" placeholder="votre@email.fr" required aria-label="Email" autocomplete="email">
          <button type="submit" class="btn btn-brass btn-sm">S'inscrire</button>
          <!-- Honeypot anti-spam -->
          <input type="text" name="website" aria-hidden="true" tabindex="-1" autocomplete="off"
                 style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;">
        </form>
        <div id="footer-newsletter-status" class="footer-newsletter-status" aria-live="polite"></div>
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
    // Charge la palette de recherche globale (Cmd+K / Ctrl+K) si absente
    if (!window.CCS_SEARCH && !document.querySelector('script[data-search-palette]')) {
      const s = document.createElement('script');
      s.src = 'asset/js/search-palette.js';
      s.defer = true;
      s.dataset.searchPalette = '1';
      document.head.appendChild(s);
    }
    // Maps.js : seulement si Leaflet utilisé sur la page
    if (document.querySelector('[id^="sv-fallback"], #minimap-map, #parcours-map') && !document.querySelector('script[src="asset/js/maps.js"]')) {
      const ms = document.createElement('script');
      ms.src = 'asset/js/maps.js';
      ms.defer = true;
      document.head.appendChild(ms);
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

  function initNavSearch() {
    const btn = document.getElementById('nav-search-btn');
    if (!btn) return;
    // Affiche le bon raccourci selon l'OS
    const isMac = /Mac|iPad|iPhone|iPod/.test(navigator.platform);
    const kbd   = btn.querySelector('.nav-search-kbd');
    if (kbd) kbd.textContent = isMac ? '⌘K' : 'Ctrl K';
    btn.addEventListener('click', () => {
      // search-palette.js peut être chargé en defer ; on attend qu'il soit prêt
      const tryOpen = (attempt = 0) => {
        if (window.CCS_SEARCH?.open) return window.CCS_SEARCH.open();
        if (attempt < 20) setTimeout(() => tryOpen(attempt + 1), 80);
      };
      tryOpen();
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

  // Fallback toast utilisé tant que premium.js n'est pas chargé.
  // Une fois premium.js prêt, il remplace window.toast par sa version queue (3 max, FIFO).
  if (!window.toast) {
    window.toast = function toast(msg, type = 'info') {
      // Si premium.js a fini de charger entretemps, on l'utilise.
      if (window.CCS_PREMIUM?.toast?.push) return window.CCS_PREMIUM.toast.push(msg, type);
      // Sinon, log basique — évite de polluer la page avec des markup orphelins
      // qui ne seraient plus stylés.
      console.info('[toast]', type, msg);
    };
  }

  function initFooterNewsletter() {
    const form = document.getElementById('footer-newsletter');
    if (!form) return;
    const status = document.getElementById('footer-newsletter-status');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      const website = form.website.value || '';
      if (!email) return;
      const API = window.CCS_CFG?.API || window.CCS_CONFIG?.apiBase || '/api';
      status.textContent = 'Envoi…';
      try {
        const r = await fetch(API + '/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, website, source: 'footer' }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Erreur');
        if (data.status === 'already_confirmed') {
          status.textContent = 'Vous êtes déjà inscrit. Merci !';
        } else {
          status.textContent = 'Inscription enregistrée — confirmez via l\'email reçu.';
          form.reset();
        }
        window.toast?.('Inscription enregistrée', 'success');
      } catch (err) {
        status.textContent = '';
        window.toast?.(err.message || 'Erreur inscription', 'error');
      }
    });
  }

  function boot() {
    injectChrome();
    initNavScroll();
    initMobileNav();
    initNavSearch();
    startLiveTime();
    initReveal();
    initPowerBars();
    initFooterNewsletter();
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