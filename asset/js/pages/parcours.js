/* ═════════════════════════════════════════════════════════════════
   pages/parcours.js — Catalogue des parcours
   Fetch sorties avec GPX, déduit le type (pavé/monts/gravel/route…)
   et rend en cards avec badge Street View au survol.
   ═════════════════════════════════════════════════════════════════ */

(async function loadParcours() {
  const earlyGrid = document.getElementById('parcours-grid');
  // Skeleton initial — uniquement si le grid est vide (pas de fallback statique)
  let staticFallback = earlyGrid?.innerHTML || '';
  if (earlyGrid && !staticFallback.trim()) {
    earlyGrid.innerHTML = Array(6).fill('<div class="skeleton skeleton-card"></div>').join('');
  }
  await new Promise(resolve => {
    const check = (n = 0) => {
      if (window.CCS_DATA) return resolve();
      if (n < 50) setTimeout(() => check(n + 1), 80);
      else resolve();
    };
    check();
  });
  if (!window.CCS_DATA) return;

  const grid = document.getElementById('parcours-grid');
  if (!grid) return;

  function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function deduceType(s) {
    const ch = (s.chapter || '').toLowerCase();
    const tags = (s.tags || []).map(t => (t.label || '').toLowerCase()).join(' ');
    const title = (s.title || '').toLowerCase();
    if (/clm|contre.la.montre|prologue|chrono/.test(title + ' ' + ch)) return 'clm';
    if (s.pave_km > 0 || /pavé|pave|roubaix/.test(ch + ' ' + tags)) return 'pave';
    if (/mont|flandre|cassel/.test(ch + ' ' + tags)) return 'monts';
    if (/gravel|scarpe|raismes/.test(ch + ' ' + tags)) return 'gravel';
    if (/opale|côte|boulogne|cap/.test(ch + ' ' + tags + ' ' + (s.location?.name || '').toLowerCase())) return 'cote';
    return 'autre';
  }

  const TYPE_STYLES = {
    pave:   { color: '#8B3726', label: 'Pavé' },
    monts:  { color: '#B08E4A', label: 'Monts' },
    gravel: { color: '#CAA35B', label: 'Gravel' },
    cote:   { color: '#C7BC9E', label: 'Côte' },
    clm:    { color: '#4A6B8B', label: 'CLM' },
    autre:  { color: '#B08E4A', label: 'Route' }
  };

  const PHOTO_BY_TYPE = {
    pave:   { url: 'asset/img/img-pave.webp',   svg: 'asset/img/hero-pave.svg' },
    mont:   { url: 'asset/img/img-monts.webp',  svg: 'asset/img/hero-monts.svg' },
    monts:  { url: 'asset/img/img-monts.webp',  svg: 'asset/img/hero-monts.svg' },
    gravel: { url: 'asset/img/img-gravel.webp', svg: 'asset/img/hero-gravel.svg' },
    cote:   { url: 'asset/img/img-cote.webp',   svg: 'asset/img/hero-cote.svg' },
    route:  { url: 'asset/img/img-route.webp',  svg: 'asset/img/hero-route.svg' },
    autre:  { url: 'asset/img/img-route.webp',  svg: 'asset/img/hero-route.svg' },
    clm:    { url: 'asset/img/img-clm.webp',    svg: 'asset/img/hero-route.svg' },
  };

  function renderCard(s, i) {
    const type = deduceType(s);
    const style = TYPE_STYLES[type] || TYPE_STYLES.autre;
    const photo = PHOTO_BY_TYPE[type] || PHOTO_BY_TYPE.autre;
    const imgSrc = s.card_img || s.hero_img || photo.url;
    return `
      <a href="sortie.html?id=${encodeURIComponent(s.id)}" class="rc" data-type="${type}">
        <div class="rc-img">
          <img src="${imgSrc}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${photo.svg}'">
          <div class="rc-img-frame"></div>
          <div class="rc-sv-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Street View
          </div>
          <div class="rc-tags"><span class="tag tag-brass" style="background:${style.color}20;color:${style.color};border-color:${style.color}40;">${style.label}</span></div>
          <div class="rc-number">№ ${String(i + 1).padStart(2, '0')}</div>
          ${s.date_label ? `<div class="rc-caption"><em>${escHtml(s.date_label)}</em></div>` : ''}
        </div>
        <div class="rc-body">
          <h3 class="rc-title">${s.title_html || escHtml(s.title)}</h3>
          <p class="rc-sub">${escHtml(s.subtitle || '')}</p>
          <div class="rc-stats">
            ${s.distance_km ? `<div class="rc-stat"><div class="rc-stat-v">${Math.round(s.distance_km)}<span class="unit">km</span></div><div class="rc-stat-l">Distance</div></div>` : ''}
            ${s.elevation_gain ? `<div class="rc-stat"><div class="rc-stat-v">${s.elevation_gain}<span class="unit">m</span></div><div class="rc-stat-l">D+</div></div>` : ''}
            ${s.pave_km ? `<div class="rc-stat"><div class="rc-stat-v">${s.pave_km}<span class="unit">km</span></div><div class="rc-stat-l">Pavé</div></div>` :
              (s.duration_label ? `<div class="rc-stat"><div class="rc-stat-v">${escHtml(s.duration_label)}</div><div class="rc-stat-l">Durée</div></div>` : '')}
          </div>
        </div>
      </a>`;
  }

  let allParcours = [];
  let activeFilter = 'all';

  function renderGrid() {
    let filtered = allParcours;
    if (activeFilter !== 'all') {
      filtered = allParcours.filter(s => deduceType(s) === activeFilter);
    }
    if (!filtered.length) {
      grid.innerHTML = '<div class="admin-empty" style="grid-column:1/-1;padding:48px;text-align:center;font-family:var(--f-sans);font-size:13px;color:var(--parch-2);">Aucun parcours dans cette catégorie</div>';
      return;
    }
    grid.innerHTML = filtered.map(renderCard).join('');
  }

  try {
    const sorties = await window.CCS_DATA.sorties({ limit: 50 });
    if (!sorties?.length) {
      grid.innerHTML = staticFallback;
      return;
    }
    allParcours = sorties.filter(s => s.statut !== 'future' || s.gpx_ref);

    document.querySelectorAll('.filter-chip[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderGrid();
      });
    });

    renderGrid();

    const totalKm   = allParcours.reduce((s, o) => s + (parseFloat(o.distance_km) || 0), 0);
    const plusLong  = allParcours.reduce((m, o) => Math.max(m, parseFloat(o.distance_km) || 0), 0);
    const dPlusMax  = allParcours.reduce((m, o) => Math.max(m, parseInt(o.elevation_gain) || 0), 0);
    const metas = document.querySelectorAll('.page-head-meta-v');
    if (metas.length >= 1) metas[0].textContent = allParcours.length;
    if (metas.length >= 2) metas[1].innerHTML = `${Math.round(totalKm).toLocaleString('fr-FR')}<span class="unit">km</span>`;
    if (metas.length >= 3) metas[2].innerHTML = `${Math.round(plusLong)}<span class="unit">km</span>`;
    if (metas.length >= 4) metas[3].innerHTML = `${dPlusMax.toLocaleString('fr-FR')}<span class="unit">m</span>`;
  } catch (err) {
    console.warn('[CCS] parcours dynamique :', err.message);
  }
})();
