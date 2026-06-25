/* ═════════════════════════════════════════════════════════════════
   gpx-drop.js — Zone de drag & drop GPX avec preview
   ─────────────────────────────────────────────────────────────────
   Composant réutilisable pour la page admin (import sortie +
   future fonction "ajouter un parcours").

   Usage : <div data-gpx-drop data-target="#hidden-file-input"></div>
   ou window.CCS_GPX_DROP.attach(elem, { onParse: fn, onError: fn })

   Affiche zone drop + bouton "Choisir un fichier" + preview metrics
   (distance, D+, points) après parse côté serveur (/api/sorties/preview-gpx).
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const NS = (window.CCS_GPX_DROP = window.CCS_GPX_DROP || {});

  function apiBase() {
    return window.CCS_CFG?.API || window.CCS_CONFIG?.apiBase || '/api';
  }
  function token() {
    return window.CCS_AUTH?.getToken?.() || null;
  }

  function attach(host, opts = {}) {
    if (!host || host.dataset.gpxDropInit === '1') return;
    host.dataset.gpxDropInit = '1';
    host.classList.add('ccs-gpx-drop');
    host.innerHTML = `
      <div class="ccs-gpx-drop-zone" tabindex="0" role="button" aria-label="Déposer un fichier GPX">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <div class="ccs-gpx-drop-text">
          <strong>Glissez un fichier .gpx ici</strong>
          <span>ou cliquez pour parcourir — max 50 Mo</span>
        </div>
        <input type="file" accept=".gpx,application/gpx+xml" hidden>
      </div>
      <div class="ccs-gpx-preview" hidden></div>
      <div class="ccs-gpx-warnings" hidden></div>
    `;
    const zone = host.querySelector('.ccs-gpx-drop-zone');
    const input = host.querySelector('input[type=file]');
    const preview = host.querySelector('.ccs-gpx-preview');
    const warnings = host.querySelector('.ccs-gpx-warnings');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (f) handleFile(f);
    });
    zone.addEventListener('dragenter', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const f = e.dataTransfer.files?.[0];
      if (f) {
        // Synchronise l'input pour que le formulaire parent puisse soumettre
        const dt = new DataTransfer();
        dt.items.add(f);
        input.files = dt.files;
        handleFile(f);
      }
    });

    async function handleFile(f) {
      // Validation rapide côté client
      if (!f.name.toLowerCase().endsWith('.gpx')) {
        showError('Le fichier doit avoir l\'extension .gpx');
        return;
      }
      if (f.size > 50 * 1024 * 1024) {
        showError('Fichier trop volumineux (>50 Mo)');
        return;
      }
      preview.hidden = false;
      preview.innerHTML = `
        <div class="ccs-gpx-loading">
          <div class="ccs-spinner"></div>
          <span>Analyse du fichier…</span>
        </div>`;
      warnings.hidden = true;

      // POST vers /preview-gpx
      try {
        const fd = new FormData();
        fd.append('gpx', f);
        const r = await fetch(apiBase() + '/sorties/preview-gpx', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token() },
          body: fd,
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Erreur preview');
        renderPreview(data);
        if (opts.onParse) opts.onParse(data);
      } catch (err) {
        showError(err.message);
        if (opts.onError) opts.onError(err);
      }
    }

    function renderPreview(data) {
      const m = data.metrics;
      preview.innerHTML = `
        <div class="ccs-gpx-preview-grid">
          <div class="ccs-gpx-preview-cell">
            <div class="ccs-gpx-preview-l">Distance</div>
            <div class="ccs-gpx-preview-v">${m.distance_km}<span class="unit">km</span></div>
          </div>
          <div class="ccs-gpx-preview-cell">
            <div class="ccs-gpx-preview-l">Dénivelé +</div>
            <div class="ccs-gpx-preview-v">${m.elevation_gain}<span class="unit">m</span></div>
          </div>
          <div class="ccs-gpx-preview-cell">
            <div class="ccs-gpx-preview-l">Points</div>
            <div class="ccs-gpx-preview-v">${m.points_count.toLocaleString('fr-FR')}</div>
          </div>
          <div class="ccs-gpx-preview-cell">
            <div class="ccs-gpx-preview-l">Fichier</div>
            <div class="ccs-gpx-preview-v" style="font-size:13px;">${escapeHtml(data.file?.name || '')}<br><span style="font-size:11px;color:var(--parch-3);">${formatBytes(data.file?.size || 0)}</span></div>
          </div>
        </div>
        ${data.suggested_title ? `<div class="ccs-gpx-suggest">Titre suggéré : <strong>${escapeHtml(data.suggested_title)}</strong></div>` : ''}
      `;
      if (data.warnings?.length) {
        warnings.hidden = false;
        warnings.innerHTML = '<ul>' + data.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('') + '</ul>';
      }
    }

    function showError(msg) {
      preview.hidden = false;
      preview.innerHTML = `<div class="ccs-gpx-error">Erreur : ${escapeHtml(msg)}</div>`;
      warnings.hidden = true;
    }
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatBytes(n) {
    if (n < 1024) return n + ' o';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' Ko';
    return (n / 1024 / 1024).toFixed(1) + ' Mo';
  }

  // Auto-init pour les éléments [data-gpx-drop]
  function autoInit() {
    document.querySelectorAll('[data-gpx-drop]').forEach(el => attach(el));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  NS.attach = attach;
})();
