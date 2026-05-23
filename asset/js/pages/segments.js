/* ═════════════════════════════════════════════════════════════════
   pages/segments.js — Page publique des segments KOM
   Affiche les segments triés par étoiles avec stars, distance et KOM.
   ═════════════════════════════════════════════════════════════════ */

(async function loadSegments() {
  await new Promise(resolve => {
    const check = (n = 0) => {
      if (window.CCS_DATA) return resolve();
      if (n < 50) setTimeout(() => check(n + 1), 80);
      else resolve();
    };
    check();
  });
  if (!window.CCS_DATA) return;

  const tbody = document.querySelector('.seg-table tbody');
  if (!tbody) return;

  function starsHtml(n) {
    return '★'.repeat(Math.min(5, Math.max(0, n || 0)));
  }

  function rankBadge(seg) {
    if (seg.kom)      return `<span class="rank-badge rank-gold">KOM <small>${seg.rang || '1<sup>er</sup>'}</small></span>`;
    if (!seg.rang)    return '—';
    const cls = seg.rang_cls === 'neg' ? 'rank-silver' : (seg.rang_cls === 'pos' ? 'rank-pr' : 'rank-silver');
    return `<span class="rank-badge ${cls}">${seg.rang_cls === 'pr' ? 'PR ' : 'TOP 10 '}<small>${seg.rang}</small></span>`;
  }

  function deltaBadge(delta, cls) {
    if (!delta) return '—';
    const badge = cls === 'neg' ? 'neg' : (cls === 'pos' ? 'pos' : 'neu');
    return `<span class="delta-badge ${badge}">${delta}</span>`;
  }

  try {
    const segs = await window.CCS_DATA.segments();
    if (!segs?.length) return;

    tbody.innerHTML = segs.map((s, i) => `
      <tr>
        <td class="seg-table-idx">${String(i + 1).padStart(2, '0')}</td>
        <td class="seg-table-name">
          <span class="seg-table-name-main">${s.name}</span>
          <span class="seg-table-name-sub">${s.location || ''} · ${starsHtml(s.stars)}</span>
        </td>
        <td class="seg-table-stars">${starsHtml(s.stars)}</td>
        <td class="seg-table-len">${s.length_m ? (s.length_m / 1000).toFixed(1) + ' km' : '—'}</td>
        <td class="seg-table-time">${s.meilleur_temps || '—'}</td>
        <td>${deltaBadge(s.delta_moyenne, s.rang_cls)}</td>
        <td>${rankBadge(s)}</td>
      </tr>`).join('');

    const koms = segs.filter(s => s.kom).length;
    const metas = document.querySelectorAll('.page-head-meta-v');
    if (metas.length >= 1) metas[0].textContent = segs.length;
    if (metas.length >= 2) metas[1].textContent = koms;
  } catch (err) {
    console.warn('[CCS] segments dynamique :', err.message);
  }
})();
