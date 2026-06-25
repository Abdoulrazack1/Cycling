/* ═════════════════════════════════════════════════════════════════
   sortie-gallery.js — Galerie photos d'une sortie + lightbox
   ─────────────────────────────────────────────────────────────────
   Récupère GET /api/sorties/:id/photos, rend une grille de vignettes
   et ouvre un lightbox plein écran (← → Esc) au clic.

   API publique : window.CCS_GALLERY.load(sortieId)
   Styles injectés à la volée (auto-contained).
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function injectStyles() {
    if (document.getElementById('ccs-gallery-styles')) return;
    const s = document.createElement('style');
    s.id = 'ccs-gallery-styles';
    s.textContent = `
      .photos-panel {
        padding: 60px 0;
        border-top: 1px solid var(--line);
      }
      .photos-panel-head {
        display: flex; justify-content: space-between; align-items: flex-end;
        margin-bottom: 32px; gap: 24px; flex-wrap: wrap;
      }
      .photos-panel-chapter {
        font-family: var(--f-disp); font-style: italic; font-size: 14px;
        color: var(--brass); margin-bottom: 4px;
      }
      .photos-panel-title {
        font-family: var(--f-disp); font-size: clamp(2rem, 4vw, 3rem);
        color: var(--t-cream); font-weight: 400; line-height: 1;
      }
      .photos-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 8px;
      }
      .photos-grid figure {
        position: relative;
        aspect-ratio: 4 / 3;
        overflow: hidden;
        cursor: zoom-in;
        background: var(--ink-3);
        margin: 0;
      }
      .photos-grid figure img {
        width: 100%; height: 100%;
        object-fit: cover;
        transition: transform .5s var(--lux);
      }
      .photos-grid figure:hover img { transform: scale(1.04); }
      .photos-grid figcaption {
        position: absolute; left: 0; right: 0; bottom: 0;
        background: linear-gradient(to top, rgba(8,14,11,.88), transparent);
        padding: 12px;
        font-family: var(--f-sans); font-size: 12px; color: var(--t-cream);
        opacity: 0;
        transition: opacity .25s;
      }
      .photos-grid figure:hover figcaption,
      .photos-grid figure figcaption:not(:empty) { opacity: 1; }
      .photos-grid figcaption:empty { display: none; }

      /* Lightbox */
      .ccs-lightbox {
        position: fixed; inset: 0;
        background: rgba(2, 6, 4, .96);
        z-index: 9000;
        display: flex; align-items: center; justify-content: center;
        padding: 40px;
      }
      .ccs-lightbox-img {
        max-width: 100%; max-height: 100%;
        object-fit: contain;
        box-shadow: 0 24px 60px rgba(0, 0, 0, .8);
      }
      .ccs-lightbox-caption {
        position: absolute; left: 0; right: 0; bottom: 16px;
        text-align: center;
        font-family: var(--f-sans); font-size: 13px;
        color: var(--t-cream); padding: 0 60px;
      }
      .ccs-lightbox-close,
      .ccs-lightbox-prev,
      .ccs-lightbox-next {
        position: absolute;
        background: rgba(8,14,11,.55);
        border: 1px solid rgba(176,142,74,.4);
        color: var(--brass);
        font-size: 18px;
        width: 44px; height: 44px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        transition: background .2s, border-color .2s;
      }
      .ccs-lightbox-close:hover,
      .ccs-lightbox-prev:hover,
      .ccs-lightbox-next:hover { background: rgba(176,142,74,.18); border-color: var(--brass); }
      .ccs-lightbox-close { top: 20px; right: 20px; }
      .ccs-lightbox-prev  { left: 20px; top: 50%; transform: translateY(-50%); }
      .ccs-lightbox-next  { right: 20px; top: 50%; transform: translateY(-50%); }
      .ccs-lightbox-count {
        position: absolute; top: 28px; left: 50%; transform: translateX(-50%);
        font-family: var(--f-mono); font-size: 12px; color: var(--parch-2);
      }`;
    document.head.appendChild(s);
  }

  let currentPhotos = [];
  let currentIndex  = 0;

  function openLightbox(idx) {
    currentIndex = idx;
    let lb = document.getElementById('ccs-lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'ccs-lightbox';
      lb.className = 'ccs-lightbox';
      lb.innerHTML = `
        <img class="ccs-lightbox-img" id="ccs-lb-img" alt="">
        <div class="ccs-lightbox-caption" id="ccs-lb-cap"></div>
        <div class="ccs-lightbox-count" id="ccs-lb-count"></div>
        <button class="ccs-lightbox-prev" aria-label="Précédente">‹</button>
        <button class="ccs-lightbox-next" aria-label="Suivante">›</button>
        <button class="ccs-lightbox-close" aria-label="Fermer">✕</button>`;
      document.body.appendChild(lb);
      lb.querySelector('.ccs-lightbox-close').addEventListener('click', closeLightbox);
      lb.querySelector('.ccs-lightbox-prev').addEventListener('click', () => showLightbox(currentIndex - 1));
      lb.querySelector('.ccs-lightbox-next').addEventListener('click', () => showLightbox(currentIndex + 1));
      lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
      document.addEventListener('keydown', onKeyDown);
    }
    lb.style.display = 'flex';
    showLightbox(idx);
  }

  function showLightbox(idx) {
    if (!currentPhotos.length) return;
    currentIndex = ((idx % currentPhotos.length) + currentPhotos.length) % currentPhotos.length;
    const p = currentPhotos[currentIndex];
    document.getElementById('ccs-lb-img').src = p.url;
    document.getElementById('ccs-lb-cap').textContent = p.caption || '';
    document.getElementById('ccs-lb-count').textContent = `${currentIndex + 1} / ${currentPhotos.length}`;
  }

  function closeLightbox() {
    const lb = document.getElementById('ccs-lightbox');
    if (lb) lb.style.display = 'none';
  }

  function onKeyDown(e) {
    const lb = document.getElementById('ccs-lightbox');
    if (!lb || lb.style.display === 'none') return;
    if (e.key === 'Escape')      closeLightbox();
    else if (e.key === 'ArrowLeft')  showLightbox(currentIndex - 1);
    else if (e.key === 'ArrowRight') showLightbox(currentIndex + 1);
  }

  async function load(sortieId) {
    injectStyles();
    const panel = document.getElementById('photos-panel');
    const grid  = document.getElementById('photos-grid');
    const meta  = document.getElementById('photos-head-meta');
    if (!panel || !grid) return;

    try {
      const API = (window.CCS_CFG?.API) || '/api';
      const r = await fetch(`${API}/sorties/${encodeURIComponent(sortieId)}/photos`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const photos = await r.json();
      if (!photos.length) { panel.hidden = true; return; }
      currentPhotos = photos;
      panel.hidden = false;
      if (meta) meta.textContent = `${photos.length} cliché${photos.length > 1 ? 's' : ''}`;
      grid.innerHTML = photos.map((p, i) => `
        <figure data-idx="${i}">
          <img src="${esc(p.url)}" alt="${esc(p.caption || '')}" loading="lazy">
          <figcaption>${esc(p.caption || '')}</figcaption>
        </figure>`).join('');
      grid.querySelectorAll('figure').forEach((fig) => {
        fig.addEventListener('click', () => openLightbox(parseInt(fig.dataset.idx, 10)));
      });
    } catch (err) {
      console.warn('[gallery]', err);
      panel.hidden = true;
    }
  }

  window.CCS_GALLERY = { load };
})();
