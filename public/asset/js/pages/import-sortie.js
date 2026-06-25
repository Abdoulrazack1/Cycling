/* ═════════════════════════════════════════════════════════════════
   pages/import-sortie.js — Workflow combiné GPX + PDF Strava
   ─────────────────────────────────────────────────────────────────
   Étape 1 : drop GPX → POST /api/sorties/preview-gpx → métriques
   Étape 2 : drop PDF Strava → OCR client-side (ocr-pdf.js) → texte
   Étape 3 : form metadata → POST /api/sorties/import-gpx (multipart)
   Étape 4 : si PDF présent → POST /api/sorties/cue-from-text avec
             le sortieId créé pour générer les POIs sur le tracé.
   ═════════════════════════════════════════════════════════════════ */

(async function () {
  'use strict';

  // Attend auth
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
  if (!user || user.role !== 'admin') {
    location.href = '/login.html?redirect=' + encodeURIComponent('/import-sortie.html');
    return;
  }

  const API = window.CCS_CFG?.API || '/api';
  const token = window.CCS_AUTH?.getToken?.();

  // ─── State ────────────────────────────────────────────────────
  let gpxFile = null;         // File du GPX uploadé
  let gpxPreview = null;      // Réponse de /preview-gpx
  let pdfText = null;         // Texte OCR du PDF
  let pdfDirections = null;   // Résultat preview du parser (côté serveur)

  // ─── Hook GPX drop ───────────────────────────────────────────
  const gpxHost = document.querySelector('[data-gpx-drop]');
  if (gpxHost && window.CCS_GPX_DROP) {
    window.CCS_GPX_DROP.attach(gpxHost, {
      onParse: (data) => {
        // Récupère le File réel via l'input du drop
        const input = gpxHost.querySelector('input[type=file]');
        gpxFile = input?.files?.[0] || null;
        gpxPreview = data;
        // Pré-remplit titre + slug
        const titleEl = document.getElementById('im-title');
        if (titleEl && !titleEl.value && data.suggested_title) titleEl.value = data.suggested_title;
        // Display summary
        const sum = document.getElementById('gpx-preview-summary');
        if (sum) {
          const m = data.metrics;
          sum.hidden = false;
          sum.innerHTML = `<b>${m.distance_km} km</b> · D+ ${m.elevation_gain} m · ${m.points_count} points`
                       + (data.warnings?.length ? `<br><span style="color:#E0B065;">⚠ ${data.warnings.length} warning(s) : ${data.warnings.join(' · ')}</span>` : '');
        }
        updateSubmit();
      },
      onError: () => { gpxFile = null; gpxPreview = null; updateSubmit(); },
    });
  }

  // ─── PDF drop ────────────────────────────────────────────────
  const pdfZone   = document.querySelector('.pdf-drop-zone');
  const pdfInput  = document.getElementById('pdf-file');
  const pdfStatus = document.getElementById('pdf-status');
  const pdfDirsEl = document.getElementById('pdf-directions-preview');

  function setPdfStatus(msg, type) {
    if (!pdfStatus) return;
    pdfStatus.hidden = false;
    pdfStatus.className = 'pdf-status ' + (type || '');
    pdfStatus.textContent = msg;
  }

  async function handlePdfFile(f) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setPdfStatus('Fichier doit être .pdf', 'error');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setPdfStatus('PDF trop volumineux (>20 Mo)', 'error');
      return;
    }
    setPdfStatus('Chargement de pdf.js…', '');
    try {
      // ocr-pdf.js fournit l'API
      if (!window.CCS_OCR) {
        setPdfStatus('Module OCR non chargé (recharge la page)', 'error');
        return;
      }
      const result = await window.CCS_OCR.extractPdfText(f, {
        onProgress: (stage, ratio) => {
          setPdfStatus(`${stage} — ${Math.round(ratio * 100)} %`, '');
        },
      });
      pdfText = result.text;
      const lines = pdfText.split('\n').slice(0, 20).join('\n');
      setPdfStatus(`Texte extrait (${result.source}) — ${pdfText.length} caractères`, 'success');

      // Prévisualisation de ce qui sera projeté (parsing côté client identique au serveur)
      const directions = parseStravaCueSheetClient(pdfText);
      pdfDirections = directions;
      if (directions.length === 0) {
        pdfDirsEl.hidden = false;
        pdfDirsEl.innerHTML = '<em style="color:var(--parch-3);">Aucune direction reconnue dans le texte du PDF. Vérifie que c\'est bien un cue-sheet Strava.</em>';
      } else {
        pdfDirsEl.hidden = false;
        pdfDirsEl.innerHTML = '<b style="color:var(--brass);">' + directions.length + ' direction(s) extraite(s) :</b><ul>' +
          directions.map(d => `<li><span class="km">${d.km.toFixed(2)} km</span> ${esc(d.action)}${d.street ? ' — ' + esc(d.street) : ''}</li>`).join('') +
          '</ul>';
      }
    } catch (err) {
      setPdfStatus('Erreur extraction : ' + err.message, 'error');
      pdfText = null;
      pdfDirections = null;
    }
  }
  pdfZone?.addEventListener('click', () => pdfInput.click());
  pdfZone?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pdfInput.click(); } });
  pdfInput?.addEventListener('change', () => handlePdfFile(pdfInput.files?.[0]));
  ['dragenter', 'dragover'].forEach(ev => pdfZone?.addEventListener(ev, (e) => {
    e.preventDefault(); pdfZone.classList.add('drag-over');
  }));
  pdfZone?.addEventListener('dragleave', () => pdfZone.classList.remove('drag-over'));
  pdfZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    pdfZone.classList.remove('drag-over');
    handlePdfFile(e.dataTransfer.files?.[0]);
  });

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Parser client minimal (miroir du serveur) — juste pour la preview
  function parseStravaCueSheetClient(text) {
    const out = [];
    const KM = /(?:^|\s)(\d+[.,]\d+|\d+)\s*(?:km|mi(?:les?)?)\b/i;
    const ACTIONS = [
      [/^(départ|depart|start)\b/i, 'Départ'],
      [/^(arrivée|arrivee|finish|arrival)\b/i, 'Arrivée'],
      [/^(continuer|poursuivre)\b/i, 'Continuer'],
      [/^(faites?\s+demi-?tour)\b/i, 'Demi-tour'],
      [/^l[ée]g[èe]re?\s+(?:à\s+)?gauche/i, 'Légère gauche'],
      [/^l[ée]g[èe]re?\s+(?:à\s+)?droite/i, 'Légère droite'],
      [/^(?:tourner\s+)?(?:à\s+)?gauche\b/i, 'Gauche'],
      [/^(?:tourner\s+)?(?:à\s+)?droite\b/i, 'Droite'],
      [/^turn\s+left\b/i, 'Gauche'],
      [/^turn\s+right\b/i, 'Droite'],
    ];
    let lastKm = -1;
    for (const raw of text.split('\n').map(l => l.trim()).filter(Boolean)) {
      const m = raw.match(KM);
      if (!m) continue;
      const km = parseFloat(m[1].replace(',', '.'));
      if (!isFinite(km) || km < 0 || km > 1000) continue;
      if (Math.abs(km - lastKm) < 0.005) continue;
      const after = raw.slice(m.index + m[0].length).trim();
      if (!after) continue;
      let action = 'Continuer';
      for (const [re, a] of ACTIONS) { if (re.test(after)) { action = a; break; } }
      let street = after.replace(/^(sur|on|onto|into)\s+/i, '').trim();
      out.push({ km, action, street });
      lastKm = km;
    }
    return out;
  }

  function updateSubmit() {
    const btn = document.getElementById('im-submit');
    if (btn) btn.disabled = !gpxFile;
  }

  // ─── Submit ──────────────────────────────────────────────────
  document.getElementById('import-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('im-submit');
    const msg = document.getElementById('im-msg');
    btn.disabled = true; btn.textContent = 'Import GPX en cours…';
    msg.textContent = '';
    try {
      const fd = new FormData();
      fd.append('gpx', gpxFile);
      fd.append('title', document.getElementById('im-title').value.trim());
      fd.append('date', document.getElementById('im-date').value);
      const chapter = document.getElementById('im-chapter').value;
      if (chapter) fd.append('chapter', chapter);
      const slug = document.getElementById('im-slug').value.trim();
      if (slug) fd.append('slug', slug);
      const sub = document.getElementById('im-subtitle').value.trim();
      if (sub) fd.append('subtitle', sub);

      const r = await fetch(API + '/sorties/import-gpx', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur import GPX');
      const sortieId = data.sortie?.id;
      msg.textContent = '✓ Sortie créée : ' + sortieId;

      // Étape 2 : si on a un PDF, projette les directions
      if (pdfText && sortieId) {
        btn.textContent = 'Projection PDF → POIs…';
        const r2 = await fetch(API + '/sorties/cue-from-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ sortieId, ocrText: pdfText, replace: true }),
        });
        const data2 = await r2.json();
        if (!r2.ok) {
          msg.innerHTML = '✓ Sortie créée mais PDF échoué : ' + esc(data2.error || 'erreur');
        } else {
          msg.innerHTML = `✓ Sortie créée + <b>${data2.poisCreated}</b> POIs projetés depuis le PDF`;
        }
      }

      btn.textContent = 'Voir la sortie';
      btn.disabled = false;
      btn.type = 'button';
      btn.onclick = () => { location.href = '/sortie.html?id=' + encodeURIComponent(sortieId); };
    } catch (err) {
      msg.textContent = '✗ ' + err.message;
      btn.disabled = false;
      btn.textContent = 'Importer la sortie';
    }
  });
})();
