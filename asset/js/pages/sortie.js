/* ═════════════════════════════════════════════════════════════════
   pages/sortie.js — Modules legers pour la page détail d'une sortie
   Branche le widget météo + la galerie photos dès que les données
   sont disponibles. La logique principale est dans asset/js/sortie.js.
   ═════════════════════════════════════════════════════════════════ */


/* ─── Widget météo : se charge dès qu'on connaît lat/lng/date du parcours ─── */
(function initWeatherWidget() {
  const tryInit = (attempt = 0) => {
    const sortie = window.CCS_SORTIE_STATE?.sortie;
    if (!sortie?.location?.lat) {
      if (attempt < 80) return setTimeout(() => tryInit(attempt + 1), 200);
      return;
    }
    if (!window.CCS_WEATHER) return;

    const panel = document.getElementById('weather-panel');
    const container = document.getElementById('weather-widget-container');
    if (!panel || !container) return;

    const _d = sortie.date;
    const dateISO = !_d ? null
      : (_d instanceof Date ? _d.toISOString().slice(0, 10) : String(_d).slice(0, 10));
    panel.hidden = false;
    window.CCS_WEATHER.renderInto(container, sortie.location.lat, sortie.location.lng, dateISO)
      .catch(() => { panel.hidden = true; });
  };
  tryInit();
})();

/* ─── Galerie photos : se charge quand on connaît l'id de la sortie ─── */
(function initPhotoGallery() {
  const tryInit = (attempt = 0) => {
    const sortie = window.CCS_SORTIE_STATE?.sortie;
    if (!sortie?.id) {
      if (attempt < 80) return setTimeout(() => tryInit(attempt + 1), 200);
      return;
    }
    if (!window.CCS_GALLERY) return;
    window.CCS_GALLERY.load(sortie.id);
  };
  tryInit();
})();

/* ─── Affichage conditionnel du bouton inscription (sortie future) ── */
(function initInscriptionVisibility() {
  const tryInit = (attempt = 0) => {
    const sortie = window.CCS_SORTIE_STATE?.sortie;
    if (!sortie) {
      if (attempt < 80) return setTimeout(() => tryInit(attempt + 1), 200);
      return;
    }
    const btn = document.getElementById('sortie-inscrire');
    if (!btn) return;
    btn.dataset.sortieId = sortie.id;
    // Affiche seulement si sortie future
    const future = sortie.statut === 'future' || (sortie.date && new Date(sortie.date) > new Date());
    btn.hidden = !future;

    // Affiche le compteur d'inscrits
    const countEl = document.getElementById('sortie-inscrits-count');
    if (countEl && future) {
      const API = window.CCS_CFG?.API || window.CCS_CONFIG?.apiBase || '/api';
      fetch(API + '/sorties/' + encodeURIComponent(sortie.id) + '/inscriptions')
        .then(r => r.json())
        .then(d => {
          const n = d.inscrits || 0;
          countEl.textContent = n > 0 ? `${n} inscrit${n > 1 ? 's' : ''}` : 'Aucun inscrit pour l\'instant';
        })
        .catch(() => {});
    }

    // Idem pour le bouton favori (initialise data-sortie-id)
    const favBtn = document.getElementById('fav-toggle');
    if (favBtn) favBtn.dataset.sortieId = sortie.id;
  };
  tryInit();
})();

/* ─── Bouton "Partager" : Web Share API (mobile) ou copie (desktop) ── */
(function initShareButton() {
  const btn = document.getElementById('copy-sortie-link');
  if (!btn) return;
  // Si l'API native est dispo, on relabelise le bouton "Partager"
  if (navigator.share) {
    const span = Array.from(btn.childNodes).find(n => n.nodeType === 3 || (n.nodeType === 1 && n.tagName === 'SPAN'));
    btn.lastChild.textContent = 'Partager';
  }
  btn.addEventListener('click', () => {
    const sortie = window.CCS_SORTIE_STATE?.sortie;
    const url = location.href;
    const title = sortie?.title || document.title;
    const text = sortie?.subtitle || sortie?.chapter || '';
    if (window.CCS_PREMIUM?.share) {
      window.CCS_PREMIUM.share({ url, title, text });
    } else if (window.CCS_PREMIUM?.copyLink) {
      window.CCS_PREMIUM.copyLink(url, 'Lien copié');
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => window.toast?.('Lien copié', 'success'));
    }
  });
})();
