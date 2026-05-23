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

/* ─── Bouton "Copier lien" : copie l'URL canonique de la sortie ──── */
(function initCopyLink() {
  const btn = document.getElementById('copy-sortie-link');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const sortie = window.CCS_SORTIE_STATE?.sortie;
    const url = location.href;
    const label = sortie?.title ? `Lien copié — ${sortie.title}` : 'Lien copié';
    if (window.CCS_PREMIUM?.copyLink) {
      window.CCS_PREMIUM.copyLink(url, label);
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => window.toast?.(label, 'success'));
    }
  });
})();
