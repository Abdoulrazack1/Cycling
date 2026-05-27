/* ═════════════════════════════════════════════════════════════════
   admin-palette.js — Palette de commandes admin (Ctrl+Shift+P)
   ─────────────────────────────────────────────────────────────────
   Donne accès en 1 raccourci à toutes les actions admin fréquentes :
   - Nouveau membre / sortie / événement
   - Broadcast email
   - Toggle maintenance
   - Voir audit log
   - Lancer scraper
   - Export base de données
   - etc.

   Activée uniquement si l'utilisateur connecté est admin.
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let paletteEl = null;
  let activeIdx = 0;
  let filteredCmds = [];

  // ── Liste des commandes (toutes admin) ────────────────────────
  const COMMANDS = [
    { id: 'new-sortie',    label: 'Nouvelle sortie',            icon: '🚴', kw: 'sortie ajouter creer add new course parcours',
      action: () => { location.href = '/admin.html#tab-sorties&new'; } },
    { id: 'new-evenement', label: 'Nouvel événement',           icon: '📅', kw: 'evenement ajouter creer event new',
      action: () => { location.href = '/admin.html#tab-evenements&new'; } },
    { id: 'new-membre',    label: 'Nouveau membre',             icon: '👤', kw: 'membre user ajouter creer add invite',
      action: () => { location.href = '/admin.html#tab-membres&new'; } },
    { id: 'broadcast',     label: 'Broadcast email',            icon: '📧', kw: 'broadcast email mail envoi communique',
      action: () => { location.href = '/admin.html#tab-outils'; } },
    { id: 'maintenance',   label: 'Toggle mode maintenance',    icon: '🔧', kw: 'maintenance mode bloque offline',
      action: () => { location.href = '/admin.html#tab-outils'; } },
    { id: 'audit-log',     label: 'Audit log',                  icon: '📜', kw: 'audit log trace historique journal',
      action: () => { location.href = '/admin.html#tab-audit'; } },
    { id: 'scraper',       label: 'Lancer scraper sorties OSM', icon: '⬇',  kw: 'scraper import osm scrape rafraichir',
      action: () => { location.href = '/admin.html#tab-import'; } },
    { id: 'strava-config', label: 'Configuration Strava',       icon: '🔗', kw: 'strava api config oauth',
      action: () => { location.href = '/admin.html#tab-strava'; } },
    { id: 'newsletter',    label: 'Voir abonnés newsletter',    icon: '✉',  kw: 'newsletter abonnes mailing list',
      action: () => { location.href = '/admin.html#tab-newsletter'; } },
    { id: 'dashboard',     label: 'Dashboard live',             icon: '📊', kw: 'dashboard stats live home admin',
      action: () => { location.href = '/admin.html#tab-dashboard'; } },
    { id: 'photos',        label: 'Galerie photos',             icon: '📷', kw: 'photos galerie images upload',
      action: () => { location.href = '/admin.html#tab-photos'; } },
    { id: 'palmares',      label: 'Gérer palmarès',             icon: '🏆', kw: 'palmares medaille victoire course',
      action: () => { location.href = '/admin.html#tab-palmares'; } },
    { id: 'segments',      label: 'Gérer segments',             icon: '🎯', kw: 'segments kom strava chrono',
      action: () => { location.href = '/admin.html#tab-segments'; } },
    { id: 'contacts',      label: 'Messages de contact',        icon: '💬', kw: 'contact message support formulaire',
      action: () => { location.href = '/admin.html#tab-contact'; } },
    { id: 'goto-sortie',   label: 'Aller à la page sortie publique',  icon: '→', kw: 'goto navigate aller',
      action: () => { location.href = '/sorties.html'; } },
    { id: 'goto-membres',  label: 'Aller à la liste des membres',     icon: '→', kw: 'goto navigate aller',
      action: () => { location.href = '/membres.html'; } },
    { id: 'goto-profil',   label: 'Mon profil',                  icon: '→', kw: 'profil profile compte',
      action: () => { location.href = '/profil.html'; } },
    { id: 'theme-toggle',  label: 'Changer de thème',           icon: '🌗', kw: 'theme dark light sombre clair mode',
      action: () => { window.CCS_THEME?.cycle?.(); } },
    { id: 'shortcuts',     label: 'Voir tous les raccourcis clavier', icon: '⌨', kw: 'aide help raccourci clavier shortcuts',
      action: () => { /* déclenche le ? */ document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })); } },
  ];

  function isAdmin() {
    return !!window.CCS_AUTH?.getUser?.()?.role && window.CCS_AUTH.getUser().role === 'admin';
  }

  function fuzzyMatch(text, query) {
    text = text.toLowerCase();
    query = query.toLowerCase().trim();
    if (!query) return 1;
    // Bonus si match exact substring
    if (text.includes(query)) return 1;
    // Sinon match char-par-char (fuzzy souple)
    let i = 0;
    for (const c of query) {
      i = text.indexOf(c, i);
      if (i === -1) return 0;
      i++;
    }
    return 0.5;
  }

  function rank(cmds, query) {
    if (!query.trim()) return cmds;
    return cmds
      .map(c => ({ c, score: Math.max(
        fuzzyMatch(c.label, query) * 2,
        fuzzyMatch(c.kw || '', query),
      )}))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.c);
  }

  function render(query = '') {
    filteredCmds = rank(COMMANDS, query);
    activeIdx = 0;
    const list = paletteEl.querySelector('.ccs-cmd-list');
    if (!filteredCmds.length) {
      list.innerHTML = '<div class="ccs-cmd-empty">Aucune commande</div>';
      return;
    }
    list.innerHTML = filteredCmds.map((c, i) => `
      <div class="ccs-cmd-item ${i === activeIdx ? 'active' : ''}" data-idx="${i}">
        <span class="ccs-cmd-item-icon">${c.icon || '·'}</span>
        <span class="ccs-cmd-item-label">${escapeHtml(c.label)}</span>
        <span class="ccs-cmd-item-hint">${i === 0 ? '↵' : ''}</span>
      </div>`).join('');
    list.querySelectorAll('.ccs-cmd-item').forEach(el => {
      el.addEventListener('mouseenter', () => {
        activeIdx = parseInt(el.dataset.idx, 10);
        updateActive();
      });
      el.addEventListener('click', () => execute());
    });
  }

  function updateActive() {
    paletteEl.querySelectorAll('.ccs-cmd-item').forEach((el, i) => {
      el.classList.toggle('active', i === activeIdx);
      if (i === activeIdx) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function open() {
    if (paletteEl) return;
    paletteEl = document.createElement('div');
    paletteEl.className = 'ccs-cmd-palette';
    paletteEl.innerHTML = `
      <div class="ccs-cmd-back"></div>
      <div class="ccs-cmd-card">
        <input class="ccs-cmd-input" type="text" placeholder="Taper une commande… (échap pour fermer)" autofocus>
        <div class="ccs-cmd-list"></div>
      </div>`;
    document.body.appendChild(paletteEl);
    const input = paletteEl.querySelector('.ccs-cmd-input');
    render('');
    setTimeout(() => input.focus(), 10);
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); e.preventDefault(); }
      else if (e.key === 'ArrowDown') {
        activeIdx = Math.min(filteredCmds.length - 1, activeIdx + 1);
        updateActive(); e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        activeIdx = Math.max(0, activeIdx - 1);
        updateActive(); e.preventDefault();
      } else if (e.key === 'Enter') {
        execute(); e.preventDefault();
      }
    });
    paletteEl.querySelector('.ccs-cmd-back').addEventListener('click', close);
  }

  function close() {
    if (!paletteEl) return;
    paletteEl.remove();
    paletteEl = null;
  }

  function execute() {
    const cmd = filteredCmds[activeIdx];
    if (!cmd) return;
    close();
    try { cmd.action(); } catch (err) {
      window.toast?.(err.message || 'Erreur commande', 'error');
    }
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ─── Wiring : Ctrl+Shift+P ou Cmd+Shift+P ────────────────────
  document.addEventListener('keydown', (e) => {
    // Ne déclenche que pour admins (vérif au moment du keystroke)
    if (!isAdmin()) return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      paletteEl ? close() : open();
    }
  });

  // Expose pour usage externe (bouton dans admin.html)
  window.CCS_ADMIN_PALETTE = { open, close };
})();
