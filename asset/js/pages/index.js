/* ═════════════════════════════════════════════════════════════════
   pages/index.js — Mise à jour dynamique de la page d'accueil
   Hydrate les sections "dernière sortie" et "prochains événements"
   depuis CCS_DATA après le rendu HTML statique.
   ═════════════════════════════════════════════════════════════════ */

(async function indexDynamic() {
  if (!window.CCS_DATA) return;
  try {
    const sorties = await window.CCS_DATA.sorties({ statut: 'passee', limit: 6 });
    if (!sorties?.length) return;

    const featured = sorties.find(s => s.featured) || sorties[0];
    const recent   = sorties.filter(s => s.id !== featured.id).slice(0, 4);

    document.querySelectorAll('a[href*="arenberg-2025-04-05"]').forEach(a => {
      if (a.href.includes('sortie.html')) {
        a.href = 'sortie.html?id=' + encodeURIComponent(featured.id);
      }
    });

    const storyImg    = document.querySelector('.story-two .story-img img');
    const storyCapt   = document.querySelector('.story-img-caption');
    const storyTitle  = document.querySelector('.story-body h3');
    const storyDesc   = document.querySelector('.story-body .lede');
    const storyCta    = document.querySelector('.story-cta a.btn-brass');
    const storyNum    = document.querySelector('.sec-head-marker');

    if (storyImg && featured.hero_img)     storyImg.src = featured.hero_img;
    if (storyCapt) storyCapt.textContent = `${featured.title} · ${featured.date_label || (featured.date ? new Date(featured.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '')}`;
    if (storyTitle)                        storyTitle.innerHTML  = featured.title_html || featured.title;
    if (storyDesc)                          storyDesc.textContent = featured.description || featured.subtitle || '';
    if (storyCta)                          storyCta.href = 'sortie.html?id=' + encodeURIComponent(featured.id);
    if (storyNum && featured.number)       storyNum.textContent = `№ ${featured.number}`;

    // Hydrate les 3 meta items du featured
    const metaItems = document.querySelectorAll('#home-featured .story-meta-item .story-meta-v');
    if (metaItems[0]) metaItems[0].innerHTML = featured.distance_km ? Math.round(featured.distance_km) + '<span class="unit">km</span>' : '—';
    if (metaItems[1]) metaItems[1].innerHTML = featured.elevation_gain ? featured.elevation_gain + '<span class="unit">m</span>' : '—';
    if (metaItems[2]) metaItems[2].textContent = featured.date ? new Date(featured.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—';

    // Hydratation des stats du club : on consomme /api/stats (cache 5 min)
    // qui agrège côté serveur tous les compteurs sur la base ENTIÈRE,
    // pas juste les 6 sorties qu'on a fetchées pour le hero.
    try {
      const API = window.CCS_CFG?.API || '/api';
      const stats = await fetch(API + '/stats').then(r => r.json()).catch(() => null);
      if (stats) {
        const cells = document.querySelectorAll('.stats-row .stats-cell .stats-v');
        if (cells[0]) cells[0].innerHTML = (stats.kilometres || 0).toLocaleString('fr-FR') + '<span class="unit">km</span>';
        if (cells[1]) cells[1].textContent = stats.sorties?.passees || 0;
        if (cells[2]) cells[2].textContent = stats.membres?.actifs || 0;
        if (cells[3]) cells[3].innerHTML = (stats.denivele || 0).toLocaleString('fr-FR') + '<span class="unit">m</span>';
      }
    } catch (err) { /* silencieux — les valeurs en dur restent */ }

    // Hydrate aussi la "Featured CTA"
    const featuredCta = document.getElementById('featured-cta');
    if (featuredCta && featured?.id) {
      featuredCta.href = 'sortie.html?id=' + encodeURIComponent(featured.id);
    }

    // Hydratation de la grille "Quatre parcours signatures"
    const routesGrid = document.getElementById('home-routes-grid');
    if (routesGrid) {
      const TYPE_IMG = {
        clm:    'asset/img/img-clm.webp',
        pave:   'asset/img/img-pave.webp',
        monts:  'asset/img/img-monts.webp',
        gravel: 'asset/img/img-gravel.webp',
        cote:   'asset/img/img-cote.webp',
        route:  'asset/img/img-route.webp',
      };
      function deduceType(s) {
        const t = ((s.chapter || '') + ' ' + (s.title || '')).toLowerCase();
        if (/clm|contre.la.montre|chrono/.test(t)) return 'clm';
        if (/pavé|pave|roubaix/.test(t)) return 'pave';
        if (/mont|flandre|cassel/.test(t)) return 'monts';
        if (/gravel|scarpe/.test(t)) return 'gravel';
        if (/opale|côte|cap|boulogne/.test(t)) return 'cote';
        return 'route';
      }
      function escI(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      }
      const card = (s, i) => {
        const type = deduceType(s);
        const img = s.card_img || s.hero_img || TYPE_IMG[type] || TYPE_IMG.route;
        return `
          <a href="sortie.html?id=${encodeURIComponent(s.id)}" class="rc" data-type="${type}">
            <div class="rc-img">
              <img loading="lazy" decoding="async" src="${img}" onerror="this.onerror=null;this.src='asset/img/hero-route.svg'" alt="">
              <div class="rc-img-frame" aria-hidden="true"></div>
              <div class="rc-tags"><span class="tag tag-brass">${escI(s.chapter || 'Route')}</span></div>
              <div class="rc-number">№ ${String(i + 1).padStart(2, '0')}</div>
              ${s.date_label ? `<div class="rc-caption"><em>${escI(s.date_label)}</em></div>` : ''}
            </div>
            <div class="rc-body">
              <h3 class="rc-title">${s.title_html || escI(s.title)}</h3>
              <p class="rc-sub">${escI(s.subtitle || '')}</p>
              <div class="rc-stats">
                ${s.distance_km ? `<div class="rc-stat"><div class="rc-stat-v">${Math.round(s.distance_km)}<span class="unit">km</span></div><div class="rc-stat-l">Distance</div></div>` : ''}
                ${s.elevation_gain ? `<div class="rc-stat"><div class="rc-stat-v">${s.elevation_gain}<span class="unit">m</span></div><div class="rc-stat-l">D+</div></div>` : ''}
              </div>
            </div>
          </a>`;
      };
      if (sorties.length) {
        routesGrid.innerHTML = sorties.slice(0, 4).map(card).join('');
      } else {
        routesGrid.innerHTML = '<div class="ccs-empty" style="grid-column:1/-1;padding:32px;"><div class="ccs-empty-sub">Aucun parcours encore. <a href="profil.html#strava-section" style="color:var(--brass);">Connecter Strava</a> pour importer.</div></div>';
      }
    }

    // Hydratation de la liste "Sorties récentes" : rend les vraies sorties
    // depuis l'API au lieu de garder les cards de démo dans le HTML.
    const listEl = document.getElementById('home-recent-list');
    if (listEl) {
      function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      }
      function rowHtml(s) {
        const d = s.date ? new Date(s.date) : null;
        const dayName  = d ? d.toLocaleDateString('fr-FR', { weekday: 'long' }) : '';
        const dayMonth = d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : (s.date_label || '');
        const dist     = s.distance_km ? Math.round(s.distance_km) : '—';
        return `
          <a href="sortie.html?id=${encodeURIComponent(s.id)}" class="list-ornate-row">
            <div class="list-ornate-date">${esc(dayMonth)}<span class="list-ornate-date-small">${esc(dayName)}</span></div>
            <div>
              <div class="list-ornate-title">${s.title_html || esc(s.title)}</div>
              <div class="list-ornate-sub">${esc(s.subtitle || s.chapter || '')}</div>
            </div>
            <div class="list-ornate-meta">
              ${s.elevation_gain ? `<b>+${s.elevation_gain} m</b> D+<br>` : ''}
              <span>${esc(s.location_name || s.location?.name || '')}</span>
            </div>
            <div class="list-ornate-dist">${dist}<span class="unit">km</span></div>
            <div class="list-ornate-arrow">→</div>
          </a>`;
      }
      const head = listEl.querySelector('.list-ornate-head')?.outerHTML || '';
      const allRows = sorties.slice(0, 4).map(rowHtml).join('');
      if (allRows) {
        listEl.innerHTML = head + allRows;
      } else {
        // Fallback : aucune sortie en base
        listEl.innerHTML = head + '<div class="ccs-empty" style="padding:32px;"><div class="ccs-empty-sub">Aucune sortie pour le moment. <a href="profil.html#strava-section" style="color:var(--brass);">Connecter Strava</a> pour importer.</div></div>';
      }
    }
  } catch (err) {
    console.warn('[CCS] index dynamique :', err.message);
  }
})();
