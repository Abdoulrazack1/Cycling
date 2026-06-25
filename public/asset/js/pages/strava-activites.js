/* ═════════════════════════════════════════════════════════════════
   pages/strava-activites.js — Liste des activités Strava du membre
   ─────────────────────────────────────────────────────────────────
   Charge /api/strava/activities (DB locale) et offre :
   - Filtrage par type + recherche live
   - Pour modérateurs : bouton "Importer comme sortie" sur chaque ligne
   ═════════════════════════════════════════════════════════════════ */

(async function () {
  'use strict';

  // Attend CCS_AUTH
  await new Promise(r => {
    const tick = (n = 0) => {
      if (window.CCS_AUTH?.ready) return r();
      if (n > 50) return r();
      setTimeout(() => tick(n + 1), 80);
    };
    tick();
  });
  await window.CCS_AUTH?.ready?.();

  const user = window.CCS_AUTH?.getUser?.();
  if (!user) {
    location.href = '/login.html?redirect=' + encodeURIComponent('/strava-activites.html');
    return;
  }
  const isModoOrAdmin = ['admin', 'moderateur'].includes(user.role);

  const API = window.CCS_CFG?.API || '/api';
  const token = window.CCS_AUTH?.getToken?.();
  const list  = document.getElementById('strava-acts-list');
  const empty = document.getElementById('strava-acts-empty');
  const toolbar = document.getElementById('strava-acts-toolbar');
  const countEl = document.getElementById('strava-acts-count');
  const searchInput = document.getElementById('strava-acts-search');
  const typeSelect  = document.getElementById('strava-acts-type');

  let allActs = [];
  let activeSearch = '';
  let activeType = '';

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtKm(m) {
    return (Math.round((m || 0) / 100) / 10).toFixed(1) + ' km';
  }
  function fmtH(s) {
    if (!s) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return (h ? h + 'h' : '') + String(m).padStart(2, '0') + (h ? '' : 'min');
  }
  function fmtSpeed(ms) {
    if (!ms) return '—';
    return (ms * 3.6).toFixed(1) + ' km/h';
  }

  function renderRow(a) {
    const date = new Date(a.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    const importBtn = isModoOrAdmin ? `
      <button class="btn btn-ghost btn-sm" data-import="${a.id}">Importer → Sortie</button>
    ` : '';
    return `
      <article class="strava-act-row" data-name="${esc(a.name).toLowerCase()}" data-type="${esc(a.type)}">
        <div class="strava-act-main">
          <div class="strava-act-name">${esc(a.name)}</div>
          <div class="strava-act-meta">${date} · <span style="color:var(--brass);">${esc(a.type)}</span></div>
        </div>
        <div class="strava-act-stats">
          <div><span class="l">Distance</span><span class="v">${fmtKm(a.distance_m)}</span></div>
          <div><span class="l">D+</span><span class="v">${Math.round(a.elevation_gain_m || 0)}<span class="unit">m</span></span></div>
          <div><span class="l">Temps</span><span class="v">${fmtH(a.moving_time_s)}</span></div>
          <div><span class="l">Vitesse moy.</span><span class="v">${fmtSpeed(a.average_speed_ms)}</span></div>
        </div>
        <div class="strava-act-actions">${importBtn}</div>
      </article>`;
  }

  function render() {
    let arr = allActs;
    if (activeType) arr = arr.filter(a => a.type === activeType);
    if (activeSearch) {
      const q = activeSearch.toLowerCase();
      arr = arr.filter(a => (a.name || '').toLowerCase().includes(q));
    }
    if (countEl) countEl.textContent = `${arr.length} affichée${arr.length > 1 ? 's' : ''} / ${allActs.length} total`;
    if (!arr.length) {
      list.innerHTML = '<div class="ccs-empty" style="padding:32px;"><div class="ccs-empty-sub">Aucune activité ne correspond à ce filtre.</div></div>';
      return;
    }
    list.innerHTML = arr.map(renderRow).join('');

    // Wire les boutons importer
    list.querySelectorAll('[data-import]').forEach(btn => {
      btn.addEventListener('click', () => importActivity(btn.dataset.import, btn));
    });
  }

  async function importActivity(activityId, btn) {
    if (!confirm('Transformer cette activité en sortie club ? Le polyline sera converti en GPX. Les altitudes ne sont pas incluses (sauf si tu les saisis ensuite).')) return;
    btn.disabled = true;
    btn.textContent = 'Import…';
    try {
      const r = await fetch(API + '/strava/import-activity/' + encodeURIComponent(activityId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur import');
      window.toast?.('Sortie créée : ' + data.sortie.title, 'success', 5000);
      btn.textContent = 'Importée';
      // Lien direct vers la sortie créée
      setTimeout(() => { location.href = data.url; }, 1500);
    } catch (err) {
      window.toast?.(err.message || 'Erreur import', 'error');
      btn.disabled = false;
      btn.textContent = 'Importer → Sortie';
    }
  }

  // Fetch
  try {
    const r = await fetch(API + '/strava/activities?limit=100', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (r.status === 401) {
      location.href = '/login.html?redirect=' + encodeURIComponent('/strava-activites.html');
      return;
    }
    const data = await r.json();
    allActs = data.activities || [];
    if (!allActs.length) {
      empty.hidden = false;
      return;
    }
    toolbar.hidden = false;
    render();
  } catch (err) {
    list.innerHTML = '<div class="ccs-empty"><div class="ccs-empty-sub">Erreur : ' + esc(err.message) + '</div></div>';
  }

  // Search + filter
  let t;
  searchInput?.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { activeSearch = searchInput.value.trim(); render(); }, 150);
  });
  typeSelect?.addEventListener('change', () => { activeType = typeSelect.value; render(); });
})();
