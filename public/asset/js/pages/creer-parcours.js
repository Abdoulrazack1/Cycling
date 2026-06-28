/* creer-parcours.js — Créateur de parcours sur carte cliquable (admin).
   Clic = waypoint (typable), bouton Générer → POST /api/auto-courses/generate
   → rend le tracé routé (GPX) + les POIs colorés + les stats. */
(() => {
  'use strict';
  const API = window.CCS_CONFIG.apiBase;

  function apiFetch(path, opts = {}) {
    const token = window.CCS_AUTH.getToken();
    return fetch(API + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(opts.headers || {}),
      },
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || r.statusText);
      return data;
    });
  }
  function esc(s) { return String(s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

  const POI_STYLE = {
    depart:    { color: '#2e7d32', emoji: '🟢', label: 'Départ' },
    arrivee:   { color: '#c62828', emoji: '🏁', label: 'Arrivée' },
    signaleur: { color: '#f9a825', emoji: '🚩', label: 'Signaleur' },
    ravito:    { color: '#1565c0', emoji: '🥤', label: 'Ravito' },
    danger:    { color: '#d84315', emoji: '⚠️', label: 'Danger' },
    secteur:   { color: '#6a1b9a', emoji: '🧱', label: 'Secteur' },
    direction: { color: '#607d8b', emoji: '➡️', label: 'Direction' },
  };
  const TYPE_OPTIONS = [
    { v: '',          t: 'Routage seul' },
    { v: 'depart',    t: '🟢 Départ' },
    { v: 'arrivee',   t: '🏁 Arrivée' },
    { v: 'signaleur', t: '🚩 Signaleur' },
    { v: 'ravito',    t: '🥤 Ravito' },
    { v: 'danger',    t: '⚠️ Danger' },
    { v: 'secteur',   t: '🧱 Secteur' },
  ];

  let map, waypoints = [], wpLayer, lineLayer, resultLayer;

  function init() {
    map = L.map('cp-map', { scrollWheelZoom: true }).setView([50.0, 2.8], 9);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', maxZoom: 19, subdomains: 'abcd',
    }).addTo(map);
    wpLayer = L.layerGroup().addTo(map);
    lineLayer = L.layerGroup().addTo(map);
    resultLayer = L.layerGroup().addTo(map);

    map.on('click', (e) => addWaypoint(e.latlng.lat, e.latlng.lng));
    document.getElementById('cp-clear').addEventListener('click', clearAll);
    document.getElementById('cp-generate').addEventListener('click', generate);

    // Leaflet dans un conteneur grid : recalcule la taille après le layout.
    setTimeout(() => map.invalidateSize(), 200);
  }

  function addWaypoint(lat, lng) {
    const type = waypoints.length === 0 ? 'depart' : '';
    waypoints.push({ lat, lng, type, label: type ? POI_STYLE[type].label : '' });
    redraw();
    const hint = document.getElementById('cp-hint');
    if (hint && waypoints.length >= 2) hint.style.opacity = '0';
  }

  function redraw() {
    wpLayer.clearLayers();
    lineLayer.clearLayers();
    resultLayer.clearLayers(); // ajouter/déplacer un point invalide l'ancien résultat
    document.getElementById('cp-result').hidden = true;

    const pts = [];
    waypoints.forEach((wp, i) => {
      pts.push([wp.lat, wp.lng]);
      const icon = L.divIcon({ className: '', html: `<div class="cp-wp-pin"><span>${i + 1}</span></div>`, iconSize: [26, 26], iconAnchor: [13, 26] });
      const m = L.marker([wp.lat, wp.lng], { icon, draggable: true }).addTo(wpLayer);
      m.on('dragend', (e) => { const ll = e.target.getLatLng(); wp.lat = ll.lat; wp.lng = ll.lng; redraw(); });
    });
    if (pts.length >= 2) {
      L.polyline(pts, { color: '#B08E4A', weight: 2, dashArray: '6 6', opacity: .8 }).addTo(lineLayer);
    }
    renderList();
    document.getElementById('cp-count').textContent = waypoints.length;
    document.getElementById('cp-generate').disabled = waypoints.length < 2;
  }

  function renderList() {
    const list = document.getElementById('cp-wp-list');
    if (!waypoints.length) { list.innerHTML = '<li class="cp-wp-empty">Aucun point — clique sur la carte.</li>'; return; }
    list.innerHTML = '';
    waypoints.forEach((wp, i) => {
      const li = document.createElement('li');
      li.className = 'cp-wp-row';
      const opts = TYPE_OPTIONS.map(o => `<option value="${o.v}"${o.v === wp.type ? ' selected' : ''}>${o.t}</option>`).join('');
      li.innerHTML =
        `<span class="cp-wp-num">${i + 1}</span>` +
        `<select class="cp-wp-type" data-i="${i}">${opts}</select>` +
        `<button class="cp-wp-del" data-i="${i}" title="Retirer">×</button>` +
        `<input class="cp-wp-label" data-i="${i}" placeholder="Libellé (ex: Carrefour D38)" value="${esc(wp.label)}"${wp.type ? '' : ' hidden'}>`;
      list.appendChild(li);
    });
    list.querySelectorAll('.cp-wp-type').forEach(sel => sel.addEventListener('change', (e) => {
      const i = +e.target.dataset.i;
      waypoints[i].type = e.target.value;
      if (waypoints[i].type && !waypoints[i].label) waypoints[i].label = POI_STYLE[waypoints[i].type]?.label || '';
      redraw();
    }));
    list.querySelectorAll('.cp-wp-label').forEach(inp => inp.addEventListener('input', (e) => {
      waypoints[+e.target.dataset.i].label = e.target.value;
    }));
    list.querySelectorAll('.cp-wp-del').forEach(btn => btn.addEventListener('click', (e) => {
      waypoints.splice(+e.target.dataset.i, 1); redraw();
    }));
  }

  function clearAll() {
    waypoints = [];
    resultLayer.clearLayers();
    document.getElementById('cp-result').hidden = true;
    const hint = document.getElementById('cp-hint'); if (hint) hint.style.opacity = '1';
    redraw();
  }

  function parseTrkpts(xml) {
    const re = /<trkpt\s+lat="([\-\d.]+)"\s+lon="([\-\d.]+)"/g;
    const pts = []; let m;
    while ((m = re.exec(xml)) !== null) pts.push([parseFloat(m[1]), parseFloat(m[2])]);
    return pts;
  }

  async function generate() {
    const btn = document.getElementById('cp-generate');
    const out = document.getElementById('cp-result');
    btn.disabled = true; btn.textContent = 'Génération…';
    out.hidden = false; out.className = 'cp-result';
    out.innerHTML = 'Calcul de l\'itinéraire routier, du dénivelé et des POIs…';

    const body = {
      name:   document.getElementById('cp-name').value.trim() || 'Parcours sans nom',
      region: document.getElementById('cp-region').value.trim() || null,
      laps:   parseInt(document.getElementById('cp-laps').value) || 1,
      waypoints: waypoints.map(w => ({ lat: w.lat, lng: w.lng, type: w.type || null, label: w.label || '', desc: '' })),
      skipNetwork: document.getElementById('cp-offline').checked,
      persist: true,
    };

    try {
      const res = await apiFetch('/auto-courses/generate', { method: 'POST', body: JSON.stringify(body) });
      await renderResult(res);
    } catch (err) {
      out.className = 'cp-result err';
      out.innerHTML = '✗ ' + esc(err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Générer le parcours';
    }
  }

  async function renderResult(res) {
    resultLayer.clearLayers();
    lineLayer.clearLayers(); // enlève le connecteur en pointillés (trompeur une fois routé)
    const stats = res.stats || {};
    const bounds = [];

    // 1. Tracé routé (depuis le GPX généré côté serveur).
    //    ⚠️ Cache-busting OBLIGATOIRE : le Service Worker met les GPX en cache
    //    (cache-first) et resservait l'ancien tracé à chaque régénération
    //    (« le tracé reste toujours à Amiens »). Une URL unique force le réseau.
    if (res.gpxUrl) {
      try {
        const fresh = res.gpxUrl + (res.gpxUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();
        const xml = await fetch(fresh, { cache: 'no-store' }).then(r => r.text());
        const line = parseTrkpts(xml);
        if (line.length >= 2) {
          L.polyline(line, { color: '#1565c0', weight: 4, opacity: .9 }).addTo(resultLayer);
          line.forEach(p => bounds.push(p));
        }
      } catch (e) { /* tracé non critique */ }
    }

    // 2. POIs colorés par type. Les directions ("rallye") sont plus petites et
    //    avec une flèche directionnelle, pour ne pas voler la vedette aux vrais
    //    POIs (départ, ravito…).
    (res.pois || []).forEach(poi => {
      const st = POI_STYLE[poi.type] || POI_STYLE.direction;
      const isDir = poi.type === 'direction';
      let emoji = st.emoji;
      if (isDir) {
        const t = (poi.label || '').toLowerCase();
        emoji = t.includes('gauche') ? '⬅️' : t.includes('droite') ? '➡️'
              : t.includes('rond-point') ? '🔄' : t.includes('demi-tour') ? '↩️' : '⬆️';
      }
      const sz = isDir ? 20 : 24;
      const icon = L.divIcon({
        className: '',
        html: `<div class="cp-poi-pin${isDir ? ' cp-dir-pin' : ''}" style="background:${st.color}">${emoji}</div>`,
        iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
      });
      L.marker([poi.lat, poi.lng], { icon }).addTo(resultLayer)
        .bindPopup(`<b>${esc(poi.label || st.label)}</b>${poi.km != null ? `<br>km ${poi.km}` : ''}`);
      // Les repères de direction (nombreux) ne participent pas au cadrage.
      if (!isDir) bounds.push([poi.lat, poi.lng]);
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40] });

    // 3. Carnet de route (directions tour-par-tour, en LISTE — pas sur la carte)
    const dirs = res.directions || [];
    const roadbook = dirs.length
      ? `<details class="cp-roadbook">` +
          `<summary>🧭 Carnet de route — ${dirs.length} indications</summary>` +
          `<ol class="cp-cue">` +
            dirs.map(d => `<li><span class="cp-cue-km">${d.km} km</span><span>${esc(d.instruction)}</span></li>`).join('') +
          `</ol>` +
        `</details>`
      : '';

    // 4. Stats
    const out = document.getElementById('cp-result');
    out.className = 'cp-result';
    out.innerHTML =
      `<h4>✓ Parcours généré</h4>` +
      `<div class="cp-stat-grid">` +
        `<span>Distance</span><b>${stats.distanceKm ?? '—'} km</b>` +
        `<span>Dénivelé +</span><b>${stats.dPlus ?? '—'} m</b>` +
        `<span>Dénivelé −</span><b>${stats.dMinus ?? '—'} m</b>` +
        `<span>Altitude</span><b>${stats.eleMin ?? '—'} → ${stats.eleMax ?? '—'} m</b>` +
        `<span>Points</span><b>${stats.points ?? '—'}</b>` +
        `<span>POIs</span><b>${res.pois?.length || 0}</b>` +
      `</div>` +
      roadbook +
      (res.errors?.length ? `<div style="color:#e7b7b7">⚠ ${esc(res.errors.join(', '))}</div>` : '') +
      `<div style="margin-top:10px;"><a href="sortie.html?id=${esc(res.id)}" target="_blank" class="btn btn-ghost btn-sm">Voir la page sortie →</a></div>`;
    if (window.toast) window.toast('Parcours généré : ' + res.id, 'success');
  }

  // ── Boot : garde-fou admin ─────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    const waitFor = (cond, max = 60) => new Promise(r => { const t = (n) => { if (cond()) return r(true); if (n >= max) return r(false); setTimeout(() => t(n + 1), 60); }; t(0); });
    await waitFor(() => !!window.CCS_AUTH);
    if (window.CCS_AUTH.ready) { try { await window.CCS_AUTH.ready(); } catch {} }

    const ok = window.CCS_AUTH.isLoggedIn?.() && window.CCS_AUTH.isAdmin?.();
    if (!ok) { document.getElementById('cp-auth-gate').hidden = false; return; }

    document.getElementById('cp-app').hidden = false;
    init();
  });
})();
