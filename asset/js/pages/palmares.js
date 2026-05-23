/* ═════════════════════════════════════════════════════════════════
   pages/palmares.js — Page publique des résultats de courses
   Groupe par année, affiche médailles + lien membre cliquable.
   ═════════════════════════════════════════════════════════════════ */

(async function loadPalmares() {
  const earlyContainer = document.querySelector('.section-sm .wrap');
  if (earlyContainer && !earlyContainer.innerHTML.trim()) {
    earlyContainer.innerHTML = Array(3).fill(
      '<div class="skeleton skeleton-row" style="height:80px;margin-bottom:24px;"></div>'
    ).join('');
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

  const container = document.querySelector('.section-sm .wrap');
  if (!container) return;

  const MEDAL_CLS = { or: 'gold', argent: 'silver', bronze: 'bronze' };
  const MEDAL_LBL = { or: '1<sup>er</sup>', argent: '2<sup>e</sup>', bronze: '3<sup>e</sup>' };

  function renderYear(annee, rows) {
    const victoires = rows.filter(r => r.medaille === 'or' || r.rang === 1).length;
    const podiums   = rows.filter(r => ['or','argent','bronze'].includes(r.medaille) || r.rang <= 3).length;
    const items = rows.map(r => {
      const mCls = MEDAL_CLS[r.medaille] || '';
      const mLbl = MEDAL_LBL[r.medaille] || (r.rang ? `${r.rang}<sup>e</sup>` : '—');
      return `
        <div class="palm-item">
          <div class="palm-medal ${mCls}">${mLbl}</div>
          <div>
            <div class="palm-t">${r.titre}</div>
            <div class="palm-s">${[r.evenement, r.categorie].filter(Boolean).join(' · ')}</div>
          </div>
        </div>`;
    }).join('');
    return `
      <div class="palm-year" data-reveal>
        <div class="palm-year-head">
          <div class="palm-year-n">${annee}</div>
          <div class="palm-year-c"><b>${podiums}</b> podiums · <b>${victoires}</b> victoire${victoires > 1 ? 's' : ''}</div>
        </div>
        ${items}
      </div>`;
  }

  try {
    const rows = await window.CCS_DATA.palmares();
    if (!rows?.length) return;

    const byYear = {};
    for (const r of rows) {
      if (!byYear[r.annee]) byYear[r.annee] = [];
      byYear[r.annee].push(r);
    }

    const sortedYears = Object.keys(byYear).sort((a, b) => b - a);
    container.innerHTML = sortedYears.map(y => renderYear(y, byYear[y])).join('');

    const anneeMax  = sortedYears[0];
    const rowsMaxY  = byYear[anneeMax] || [];
    const podiums   = rowsMaxY.filter(r => ['or','argent','bronze'].includes(r.medaille) || r.rang <= 3).length;
    const victoires = rowsMaxY.filter(r => r.medaille === 'or' || r.rang === 1).length;
    const top10     = rows.filter(r => (r.rang || 99) <= 10).length;
    const coureurs  = new Set(rows.map(r => r.titre?.split(' · ')?.[0]).filter(Boolean)).size;

    const metas = document.querySelectorAll('.page-head-meta-v');
    if (metas.length >= 1) metas[0].textContent = podiums;
    if (metas.length >= 2) metas[1].textContent = victoires;
    if (metas.length >= 3) metas[2].textContent = top10;
    if (metas.length >= 4) metas[3].textContent = coureurs;
  } catch (err) {
    console.warn('[CCS] palmarès dynamique :', err.message);
  }
})();
