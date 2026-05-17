// Palette de recherche globale (Cmd+K / Ctrl+K)
// Recherche en parallèle sur sorties, événements, membres, segments.
(function () {
  'use strict';

  const ICONS = {
    sortie:    '🚴',
    evenement: '📅',
    membre:    '👤',
    segment:   '📍',
  };
  const TYPE_LABEL = {
    sortie:    'Sortie',
    evenement: 'Événement',
    membre:    'Membre',
    segment:   'Segment',
  };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function injectStyles() {
    if (document.getElementById('ccs-search-palette-styles')) return;
    const s = document.createElement('style');
    s.id = 'ccs-search-palette-styles';
    s.textContent = `
      .ccs-sp-backdrop {
        position: fixed; inset: 0;
        background: rgba(8, 14, 11, .82);
        backdrop-filter: blur(10px);
        z-index: 9999;
        display: flex; align-items: flex-start; justify-content: center;
        padding-top: 12vh;
      }
      .ccs-sp-modal {
        width: min(640px, 92vw);
        background: var(--ink-2);
        border: 1px solid var(--line);
        box-shadow: 0 24px 60px rgba(0, 0, 0, .55);
        font-family: var(--f-sans);
      }
      .ccs-sp-input-wrap {
        display: flex; align-items: center; gap: 12px;
        padding: 14px 18px;
        border-bottom: 1px solid var(--line);
      }
      .ccs-sp-input-wrap::before {
        content: '⌕';
        color: var(--brass);
        font-size: 20px;
        line-height: 1;
      }
      .ccs-sp-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: var(--t-cream);
        font-family: var(--f-sans);
        font-size: 15px;
        padding: 4px 0;
      }
      .ccs-sp-shortcut {
        font-family: var(--f-mono);
        font-size: 11px;
        color: var(--parch-3);
        border: 1px solid var(--line);
        padding: 2px 6px;
      }
      .ccs-sp-results {
        max-height: 60vh;
        overflow-y: auto;
        padding: 6px 0;
      }
      .ccs-sp-empty,
      .ccs-sp-hint {
        padding: 28px 18px;
        text-align: center;
        font-size: 12px;
        color: var(--parch-3);
      }
      .ccs-sp-group-title {
        padding: 10px 18px 4px;
        font-size: 10px;
        letter-spacing: .18em;
        text-transform: uppercase;
        color: var(--brass);
        opacity: .8;
      }
      .ccs-sp-item {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 18px;
        cursor: pointer;
        transition: background .12s;
      }
      .ccs-sp-item.active,
      .ccs-sp-item:hover {
        background: rgba(176, 142, 74, .12);
      }
      .ccs-sp-icon {
        font-size: 16px;
        line-height: 1;
        width: 22px; text-align: center;
      }
      .ccs-sp-text { flex: 1; min-width: 0; }
      .ccs-sp-title {
        color: var(--t-cream);
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ccs-sp-sub {
        color: var(--parch-3);
        font-size: 11px;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ccs-sp-type {
        font-size: 9px;
        letter-spacing: .12em;
        text-transform: uppercase;
        color: var(--parch-3);
        opacity: .7;
      }
      .ccs-sp-footer {
        padding: 8px 18px;
        font-size: 10px;
        color: var(--parch-3);
        border-top: 1px solid var(--line);
        display: flex; gap: 16px; justify-content: center;
        opacity: .7;
      }
      .ccs-sp-footer kbd {
        font-family: var(--f-mono);
        font-size: 10px;
        border: 1px solid var(--line);
        padding: 1px 5px;
        margin: 0 2px;
      }`;
    document.head.appendChild(s);
  }

  function injectDom() {
    if (document.getElementById('ccs-search-palette')) return;
    const div = document.createElement('div');
    div.id = 'ccs-search-palette';
    div.hidden = true;
    div.innerHTML = `
      <div class="ccs-sp-backdrop">
        <div class="ccs-sp-modal" role="dialog" aria-label="Recherche">
          <div class="ccs-sp-input-wrap">
            <input id="ccs-sp-input" class="ccs-sp-input" type="text" placeholder="Rechercher une sortie, un événement, un membre, un segment…" autocomplete="off" />
            <span class="ccs-sp-shortcut" id="ccs-sp-os">Ctrl K</span>
          </div>
          <div class="ccs-sp-results" id="ccs-sp-results">
            <div class="ccs-sp-hint">Tapez au moins 2 caractères pour rechercher.</div>
          </div>
          <div class="ccs-sp-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
            <span><kbd>↵</kbd> ouvrir</span>
            <span><kbd>Esc</kbd> fermer</span>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div);
    const isMac = /Mac|iPad|iPhone|iPod/.test(navigator.platform);
    document.getElementById('ccs-sp-os').textContent = isMac ? '⌘ K' : 'Ctrl K';
  }

  let activeIndex = 0;
  let flatResults = [];
  let abortCtrl = null;
  let debounceTimer = null;

  function isOpen() {
    const el = document.getElementById('ccs-search-palette');
    return el && !el.hidden;
  }
  function open() {
    injectDom();
    const root = document.getElementById('ccs-search-palette');
    root.hidden = false;
    const input = document.getElementById('ccs-sp-input');
    input.value = '';
    input.focus();
    renderResults({ q: '', results: [] }, true);
  }
  function close() {
    const root = document.getElementById('ccs-search-palette');
    if (root) root.hidden = true;
    if (abortCtrl) abortCtrl.abort();
  }

  async function doSearch(q) {
    if (abortCtrl) abortCtrl.abort();
    if (!q || q.length < 2) {
      renderResults({ q, results: [] }, true);
      return;
    }
    abortCtrl = new AbortController();
    try {
      const API = (window.CCS_CFG?.API) || '/api';
      const r = await fetch(`${API}/search?q=${encodeURIComponent(q)}`, { signal: abortCtrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      renderResults(data, false);
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('[search]', err);
    }
  }

  function renderResults(data, initial) {
    const el = document.getElementById('ccs-sp-results');
    if (!el) return;
    if (initial) {
      el.innerHTML = `<div class="ccs-sp-hint">Tapez au moins 2 caractères pour rechercher.</div>`;
      flatResults = [];
      return;
    }
    if (!data.results.length) {
      el.innerHTML = `<div class="ccs-sp-empty">Aucun résultat pour <b>${esc(data.q)}</b></div>`;
      flatResults = [];
      return;
    }

    // Grouper par type pour l'affichage
    const groups = {};
    data.results.forEach(r => { (groups[r.type] = groups[r.type] || []).push(r); });

    flatResults = [];
    activeIndex = 0;
    let html = '';
    const order = ['sortie', 'evenement', 'membre', 'segment'];
    for (const type of order) {
      if (!groups[type]?.length) continue;
      html += `<div class="ccs-sp-group-title">${TYPE_LABEL[type] || type}</div>`;
      for (const item of groups[type]) {
        const idx = flatResults.length;
        flatResults.push(item);
        html += `
          <div class="ccs-sp-item" data-idx="${idx}" data-url="${esc(item.url)}">
            <span class="ccs-sp-icon">${ICONS[type] || '·'}</span>
            <div class="ccs-sp-text">
              <div class="ccs-sp-title">${esc(item.title || '—')}</div>
              ${item.subtitle ? `<div class="ccs-sp-sub">${esc(item.subtitle)}</div>` : ''}
            </div>
          </div>`;
      }
    }
    el.innerHTML = html;
    el.querySelectorAll('.ccs-sp-item').forEach(it => {
      it.addEventListener('click', () => navigateTo(parseInt(it.dataset.idx, 10)));
      it.addEventListener('mouseenter', () => setActive(parseInt(it.dataset.idx, 10)));
    });
    setActive(0);
  }

  function setActive(i) {
    if (i < 0 || i >= flatResults.length) return;
    activeIndex = i;
    document.querySelectorAll('.ccs-sp-item').forEach(it => {
      it.classList.toggle('active', parseInt(it.dataset.idx, 10) === i);
    });
    const active = document.querySelector('.ccs-sp-item.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function navigateTo(i) {
    if (i < 0 || i >= flatResults.length) return;
    const url = flatResults[i].url;
    close();
    if (url) location.href = url;
  }

  function onInputKeydown(e) {
    if (e.key === 'ArrowDown')      { e.preventDefault(); setActive(Math.min(activeIndex + 1, flatResults.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
    else if (e.key === 'Enter')     { e.preventDefault(); navigateTo(activeIndex); }
  }

  function init() {
    injectStyles();
    injectDom();
    const input = document.getElementById('ccs-sp-input');
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = input.value.trim();
      debounceTimer = setTimeout(() => doSearch(q), 180);
    });
    input.addEventListener('keydown', onInputKeydown);

    const backdrop = document.querySelector('#ccs-search-palette .ccs-sp-backdrop');
    backdrop?.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  }

  // Raccourci global Cmd+K / Ctrl+K + Esc
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (isOpen()) close(); else open();
      init();
    } else if (e.key === 'Escape' && isOpen()) {
      close();
    }
  });

  window.CCS_SEARCH = { open, close };
})();
