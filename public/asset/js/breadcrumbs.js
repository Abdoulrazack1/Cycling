/* ═════════════════════════════════════════════════════════════════
   breadcrumbs.js — Fil d'Ariane contextuel
   ─────────────────────────────────────────────────────────────────
   Détecte automatiquement la page courante et injecte un breadcrumb
   sous la nav. Désactivable en posant `data-no-breadcrumbs` sur <body>.
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (document.body?.hasAttribute('data-no-breadcrumbs')) return;

  const PAGES = {
    'index.html':         null, // pas de breadcrumb sur accueil
    'sorties.html':       [{ label: 'Sorties' }],
    'sortie.html':        [{ label: 'Sorties', href: '/sorties.html' }, { label: 'Détail', isCurrent: true }],
    'parcours.html':      [{ label: 'Parcours' }],
    'evenements.html':    [{ label: 'Événements' }],
    'evenement.html':     [{ label: 'Événements', href: '/evenements.html' }, { label: 'Détail', isCurrent: true }],
    'membres.html':       [{ label: 'Sociétaires' }],
    'membre.html':        [{ label: 'Sociétaires', href: '/membres.html' }, { label: 'Profil membre', isCurrent: true }],
    'club.html':          [{ label: 'Le Club' }],
    'palmares.html':      [{ label: 'Palmarès' }],
    'segments.html':      [{ label: 'Segments KOM' }],
    'contact.html':       [{ label: 'Contact' }],
    'profil.html':        [{ label: 'Mon profil' }],
    'admin.html':         [{ label: 'Administration' }],
    'login.html':         [{ label: 'Connexion' }],
    'mot-de-passe-oublie.html': [{ label: 'Connexion', href: '/login.html' }, { label: 'Mot de passe oublié', isCurrent: true }],
    'reset-password.html': [{ label: 'Connexion', href: '/login.html' }, { label: 'Réinitialisation', isCurrent: true }],
    'mentions-legales.html': [{ label: 'Mentions légales' }],
  };

  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const crumbs = PAGES[page];
  if (!crumbs) return;

  // Inject le breadcrumb juste après <main>, avant la première section
  function inject() {
    const main = document.getElementById('main') || document.querySelector('main');
    if (!main) return;
    if (main.querySelector('.ccs-breadcrumbs')) return;
    const nav = document.createElement('nav');
    nav.className = 'ccs-breadcrumbs ccs-breadcrumbs--injected';
    nav.setAttribute('aria-label', 'Fil d\'Ariane');
    const parts = [
      `<a href="/index.html">Accueil</a>`,
      `<span class="ccs-breadcrumbs-sep">/</span>`,
    ];
    crumbs.forEach((c, i) => {
      if (c.isCurrent || i === crumbs.length - 1) {
        parts.push(`<span class="ccs-breadcrumbs-current" aria-current="page">${escapeHtml(c.label)}</span>`);
      } else if (c.href) {
        parts.push(`<a href="${c.href}">${escapeHtml(c.label)}</a>`);
        parts.push(`<span class="ccs-breadcrumbs-sep">/</span>`);
      } else {
        parts.push(`<span class="ccs-breadcrumbs-current">${escapeHtml(c.label)}</span>`);
      }
    });
    nav.innerHTML = parts.join(' ');
    // Insère en début de main (avant le hero ou la page-head)
    main.prepend(nav);
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
