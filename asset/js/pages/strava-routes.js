/* ═════════════════════════════════════════════════════════════════
   pages/strava-routes.js — Liste les itinéraires Strava sauvegardés
   ─────────────────────────────────────────────────────────────────
   Charge /api/strava/my-routes (live depuis Strava API).
   Pour chaque route : bouton "Importer comme sortie" → modal date/titre/chapter
   → POST /api/strava/import-route/:id.
   ═════════════════════════════════════════════════════════════════ */

(async function () {
  'use strict';

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
    location.href = '/login.html?redirect=' + encodeURIComponent('/strava-routes.html');
    return;
  }

  const API = window.CCS_CFG?.API || '/api';
  const token = window.CCS_AUTH?.getToken?.();
  const list  = document.getElementById('strava-routes-list');
  const empty = document.getElementById('strava-routes-empty');

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtKm(m) { return (Math.round((m || 0) / 100) / 10).toFixed(1) + ' km'; }

  function renderCard(r) {
    return `
      <article class="strava-route-card" data-id="${r.id_str}">
        <div class="strava-route-head">
          <div>
            <div class="strava-route-name">${esc(r.name)}</div>
            <div class="strava-route-meta">${r.type} · ${new Date(r.created_at).toLocaleDateString('fr-FR')}${r.starred ? ' · ★' : ''}</div>
          </div>
          <button class="btn btn-brass btn-sm" data-import="${r.id_str}" data-name="${esc(r.name)}" data-distance="${r.distance_m}" data-elev="${r.elevation_gain_m}">Importer</button>
        </div>
        ${r.description ? `<div class="strava-route-desc">${esc(r.description)}</div>` : ''}
        <div class="strava-route-stats">
          <div><span class="l">Distance</span><span class="v">${fmtKm(r.distance_m)}</span></div>
          <div><span class="l">D+</span><span class="v">${r.elevation_gain_m}<span class="unit">m</span></span></div>
          <div><span class="l">Temps estimé</span><span class="v">${Math.round((r.estimated_moving_time_s || 0) / 60)} min</span></div>
        </div>
      </article>`;
  }

  function showImportModal(routeId, name, distance, elev) {
    const modal = document.getElementById('route-import-modal');
    modal.hidden = false;
    document.getElementById('route-import-title').textContent = 'Importer "' + name + '"';
    document.getElementById('route-import-meta').textContent =
      `Distance ${fmtKm(distance)} · D+${elev} m. Le GPX complet (avec altitudes) sera téléchargé depuis Strava.`;
    const form = document.getElementById('route-import-form');
    form.date.value = new Date().toISOString().slice(0, 10);
    form.title.value = '';
    form.chapter.value = 'route';
    // Override submit
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = newForm.querySelector('button[type=submit]');
      submit.disabled = true; submit.textContent = 'Import en cours…';
      try {
        const fd = new FormData(newForm);
        const body = {
          date: fd.get('date'),
          title: fd.get('title') || undefined,
          chapter: fd.get('chapter'),
        };
        const r = await fetch(API + '/strava/import-route/' + encodeURIComponent(routeId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(body),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Erreur import');
        window.toast?.('Sortie créée : ' + data.sortie.title, 'success', 5000);
        setTimeout(() => { location.href = '/sortie.html?id=' + encodeURIComponent(data.sortie.id); }, 1500);
      } catch (err) {
        window.toast?.(err.message || 'Erreur import', 'error');
        submit.disabled = false; submit.textContent = 'Importer le GPX';
      }
    });
  }

  // Close modal listeners
  document.getElementById('route-import-modal').addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) document.getElementById('route-import-modal').hidden = true;
  });

  // Fetch routes
  try {
    const r = await fetch(API + '/strava/my-routes?per_page=50', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (r.status === 401) {
      location.href = '/login.html?redirect=' + encodeURIComponent('/strava-routes.html');
      return;
    }
    const data = await r.json();
    const routes = data.routes || [];
    if (!routes.length) {
      empty.hidden = false;
      return;
    }
    list.innerHTML = routes.map(renderCard).join('');
    list.querySelectorAll('[data-import]').forEach(btn => {
      btn.addEventListener('click', () => {
        showImportModal(
          btn.dataset.import,
          btn.dataset.name,
          parseInt(btn.dataset.distance, 10),
          parseInt(btn.dataset.elev, 10)
        );
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="ccs-empty">
      <div class="ccs-empty-title">Erreur de chargement</div>
      <div class="ccs-empty-sub">${esc(err.message)} — vérifie que ton compte Strava est connecté.</div>
      <a href="profil.html#strava-section" class="btn btn-brass btn-sm">Connecter Strava</a>
    </div>`;
  }
})();
