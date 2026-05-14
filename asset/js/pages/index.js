/* ── Mise à jour dynamique de la page d'accueil ───────────── */
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
    if (storyCapt && featured.number)      storyCapt.textContent = `${featured.number} — ${featured.title} · ${featured.date_label || featured.date}`;
    if (storyTitle)                        storyTitle.innerHTML  = featured.title_html || featured.title;
    if (storyDesc && featured.description) storyDesc.textContent = featured.description;
    if (storyCta)                          storyCta.href = 'sortie.html?id=' + encodeURIComponent(featured.id);
    if (storyNum && featured.number)       storyNum.textContent = `№ ${featured.number}`;

    const totalKm = sorties.reduce((s, o) => s + (parseFloat(o.distance_km) || 0), 0);
    const statKm  = document.querySelector('.stats-row .stats-cell:first-child .stats-v');
    if (statKm && totalKm > 0) statKm.innerHTML = Math.round(totalKm) + '<span class="unit">km</span>';

    const rows = document.querySelectorAll('.list-ornate .list-ornate-row');
    recent.forEach((s, i) => {
      if (!rows[i]) return;
      const a = rows[i];
      a.href = 'sortie.html?id=' + encodeURIComponent(s.id);
      const titleEl = a.querySelector('.list-ornate-title');
      const subEl   = a.querySelector('.list-ornate-sub');
      const distEl  = a.querySelector('.list-ornate-dist');
      const dateEl  = a.querySelector('.list-ornate-date');
      if (titleEl)  titleEl.innerHTML  = s.title_html || s.title;
      if (subEl)    subEl.textContent   = `${s.subtitle || ''} — sortie #${s.number || ''}`.trim().replace(/^—\s/, '');
      if (distEl && s.distance_km) distEl.innerHTML = `${Math.round(s.distance_km)}<span class="unit">km</span>`;
      if (dateEl && s.date_label)  {
        const parts = s.date_label.split(' ');
        dateEl.innerHTML = `${parts.slice(1,3).join(' ')}<span class="list-ornate-date-small">${parts[0]?.toLowerCase()}</span>`;
      }
    });
  } catch (err) {
    console.warn('[CCS] index dynamique :', err.message);
  }
})();
