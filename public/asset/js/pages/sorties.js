/* ═════════════════════════════════════════════════════════════════
   pages/sorties.js — Liste publique des sorties + modal Street View
   ─────────────────────────────────────────────────────────────────
   - Cards triées par date avec photo, type (chapter), distance/D+
   - Modal Street View au clic sur le badge "Vue rue"
   - Fetch CCS_DATA.sorties() + pickPhoto() pour le visuel par catégorie
   ═════════════════════════════════════════════════════════════════ */

(function () {
  const modal   = document.getElementById('gsv-modal');
  const backdrop= document.getElementById('gsv-modal-backdrop');
  const iframe  = document.getElementById('gsv-modal-iframe');
  const titleEl = document.getElementById('gsv-modal-title');
  const locEl   = document.getElementById('gsv-modal-loc');
  const openA   = document.getElementById('gsv-modal-open');
  const closeBtn= document.getElementById('gsv-modal-close');

  function openModal(lat, lng, title, loc) {
    titleEl.textContent = title;
    locEl.textContent   = loc;
    const url = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=12,0,0,0,0&output=svembed&hl=fr`;
    iframe.src = url;
    openA.href = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}`;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    iframe.src = 'about:blank';
  }

  document.querySelectorAll('.gsv-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openModal(
        this.dataset.lat,
        this.dataset.lng,
        this.dataset.title,
        this.dataset.loc
      );
    });
  });

  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.style.display !== 'none') closeModal();
  });
})();

/* ── Chargement dynamique des sorties depuis l'API ─────────── */
(async function loadSortiesDynamic() {
  // Skeleton immédiat (avant l'attente CCS_DATA) — évite le trou blanc
  const earlyGrid = document.getElementById('sorties-grid');
  if (earlyGrid && !earlyGrid.innerHTML.trim()) {
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
  const grid = document.getElementById('sorties-grid');
  if (!grid) return;

  const staticContent = grid.innerHTML;

  function tagLabel(type) {
    const map = { live: 'Live', date: null, brass: null, plain: null, ox: 'Pavé' };
    return map[type] ?? null;
  }

  const PHOTO_POOL = {
    pave:    { url: 'asset/img/img-pave.webp',    svg: 'asset/img/hero-pave.svg' },
    monts:   { url: 'asset/img/img-monts.webp',   svg: 'asset/img/hero-monts.svg' },
    gravel:  { url: 'asset/img/img-gravel.webp',  svg: 'asset/img/hero-gravel.svg' },
    cote:    { url: 'asset/img/img-cote.webp',    svg: 'asset/img/hero-cote.svg' },
    peloton: { url: 'asset/img/img-peloton.webp', svg: 'asset/img/hero-peloton.svg' },
    route:   { url: 'asset/img/img-route.webp',   svg: 'asset/img/hero-route.svg' },
    clm:     { url: 'asset/img/img-clm.webp',     svg: 'asset/img/hero-route.svg' },
  };
  function pickPhoto(s) {
    const haystack = ((s.title || '') + ' ' + (s.chapter || '') + ' ' + (s.subtitle || '') + ' ' + (s.slug || '')).toLowerCase();
    if (/clm|contre.la.montre|prologue|chrono/.test(haystack)) return PHOTO_POOL.clm;
    if (/pav[éeè]|roubaix|arenberg/.test(haystack)) return PHOTO_POOL.pave;
    if (/mont|kemmel|flandre|hellingen/.test(haystack)) return PHOTO_POOL.monts;
    if (/gravel|chemin|for[êe]t|scarpe/.test(haystack)) return PHOTO_POOL.gravel;
    if (/c[ôo]te|opale|cap|bord|mer/.test(haystack)) return PHOTO_POOL.cote;
    if (/peloton|sortie|groupe/.test(haystack)) return PHOTO_POOL.peloton;
    return PHOTO_POOL.route;
  }

  function renderCard(s) {
    const tags = (s.tags || []).filter(t => t.type === 'live' || t.type === 'brass').slice(0, 1);
    const tagHtml = tags.map(t =>
      t.type === 'live'
        ? `<span class="tag tag-live"><span class="tag-dot"></span>${t.label}</span>`
        : `<span class="tag tag-brass">${t.label}</span>`
    ).join('');
    const lat = s.location?.lat || '';
    const lng = s.location?.lng || '';
    const photo = pickPhoto(s);
    const imgSrc = s.card_img || s.hero_img || photo.url;
    return `
      <div class="rc-wrap">
        <a href="sortie.html?id=${encodeURIComponent(s.id)}" class="rc">
          <div class="rc-img">
            <img src="${imgSrc}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${photo.svg}'">
            <div class="rc-img-frame"></div>
            <div class="rc-sv-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Street View
            </div>
            ${tagHtml ? `<div class="rc-tags">${tagHtml}</div>` : ''}
            ${s.number ? `<div class="rc-number">№ ${s.number}</div>` : ''}
            <div class="rc-caption"><em>${s.date_label || s.date || ''}</em></div>
          </div>
          <div class="rc-body">
            <h3 class="rc-title">${s.title_html || s.title}</h3>
            <p class="rc-sub">${s.subtitle || ''}</p>
            <div class="rc-stats">
              ${s.distance_km ? `<div class="rc-stat"><div class="rc-stat-v">${Math.round(s.distance_km)}<span class="unit">km</span></div><div class="rc-stat-l">Distance</div></div>` : ''}
              ${s.elevation_gain ? `<div class="rc-stat"><div class="rc-stat-v">${s.elevation_gain}<span class="unit">m</span></div><div class="rc-stat-l">D+</div></div>` : ''}
              ${s.duration_label ? `<div class="rc-stat"><div class="rc-stat-v">${s.duration_label}</div><div class="rc-stat-l">Durée</div></div>` : ''}
            </div>
          </div>
        </a>
        ${lat && lng ? `
        <button class="gsv-btn" data-lat="${lat}" data-lng="${lng}" data-title="${(s.title || '').replace(/"/g,'')}" data-loc="${(s.location?.name || '').replace(/"/g,'')} · Point de départ" aria-label="Vue Street View">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
          Street View
        </button>` : ''}
      </div>`;
  }

  let allSorties = [];
  let activeType = 'all';

  function openGsvModal(lat, lng, title, loc) {
    const modal = document.getElementById('gsv-modal');
    if (!modal) return;
    document.getElementById('gsv-modal-title').textContent = title;
    document.getElementById('gsv-modal-loc').textContent   = loc;
    const url = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=12,0,0,0,0&output=svembed&hl=fr`;
    document.getElementById('gsv-modal-iframe').src = url;
    document.getElementById('gsv-modal-open').href = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}`;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function renderGrid() {
    let filtered = allSorties;
    if (activeType === 'passee') filtered = allSorties.filter(s => s.statut === 'passee');
    else if (activeType === 'future') filtered = allSorties.filter(s => s.statut === 'future');
    else if (activeType === 'gravel') filtered = allSorties.filter(s =>
      s.tags?.some(t => t.label?.toLowerCase().includes('gravel')) ||
      s.chapter?.toLowerCase().includes('gravel'));
    else if (activeType === 'pavee') filtered = allSorties.filter(s =>
      s.tags?.some(t => t.type === 'ox' || t.label?.toLowerCase().includes('pavé')) ||
      s.chapter?.toLowerCase().includes('pavé') || (s.pave_km && s.pave_km > 0));

    if (!filtered.length) {
      grid.innerHTML = `<div class="admin-empty" style="grid-column:1/-1;padding:48px;text-align:center;font-family:var(--f-sans);font-size:13px;color:var(--parch-2);">Aucune sortie dans cette catégorie</div>`;
      return;
    }
    grid.innerHTML = filtered.map(renderCard).join('');

    grid.querySelectorAll('.gsv-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        openGsvModal(this.dataset.lat, this.dataset.lng, this.dataset.title, this.dataset.loc);
      });
    });
  }

  try {
    const sorties = await window.CCS_DATA.sorties({ limit: 50 });
    if (!sorties?.length) {
      grid.innerHTML = `
        <div class="ccs-empty" style="grid-column:1/-1;padding:64px 24px;">
          <div class="ccs-empty-icon">—</div>
          <div class="ccs-empty-title">Aucune sortie pour l'instant</div>
          <div class="ccs-empty-sub">Connecte ton compte Strava et importe tes premières activités pour les voir apparaître ici.</div>
          <a href="profil.html#strava-section" class="btn btn-brass btn-sm">Connecter Strava</a>
        </div>`;
      const metas = document.querySelectorAll('.page-head-meta-v');
      metas.forEach(m => { m.textContent = '0'; });
      return;
    }
    allSorties = sorties;

    document.querySelectorAll('.filter-chip[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeType = btn.dataset.type;
        renderGrid();
      });
    });

    renderGrid();

    const totalKm = sorties.reduce((s, o) => s + (parseFloat(o.distance_km) || 0), 0);
    const totalD  = sorties.reduce((s, o) => s + (parseInt(o.elevation_gain) || 0), 0);
    const passees = sorties.filter(s => s.statut === 'passee');
    const daysSince = passees.length ? Math.floor((Date.now() - new Date(passees[0].date)) / 86400000) : 0;

    document.querySelectorAll('.page-head-meta-item').forEach((el, i) => {
      const v = el.querySelector('.page-head-meta-v');
      if (!v) return;
      if (i === 0) v.textContent = passees.length;
      if (i === 1) v.innerHTML = `${totalKm > 0 ? Math.round(totalKm).toLocaleString('fr-FR') : '—'}<span class="unit">km</span>`;
      if (i === 2) v.innerHTML = `${totalD.toLocaleString('fr-FR')}<span class="unit">m</span>`;
      if (i === 3) v.textContent = daysSince <= 0 ? 'J−0' : `J−${daysSince}`;
    });
  } catch (err) {
    console.warn('[CCS] sorties dynamique :', err.message);
  }
})();
