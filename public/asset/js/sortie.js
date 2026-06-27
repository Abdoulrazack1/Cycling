/* ═══════════════════════════════════════════════════════════════
   Club de Cyclisme de Salouel — sortie.js — v13
   Moteur dynamique : id lu dans l'URL, rendu complet du header,
   stats, segments + cartes + street view + POIs + elevation
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const MAPILLARY_TOKEN = '';

  /* ─── ID lu depuis l'URL (?id=...) puis dataset, puis défaut ─ */
  function readSortieId() {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get('id');
    if (fromUrl) return fromUrl;
    const fromBody = document.body.dataset.sortieId;
    if (fromBody) return fromBody;
    return 'arenberg-2025-04-05';
  }
  const SORTIE_ID = readSortieId();

  /**
   * Coerce un km en Number ; tolérant aux strings, aux nulls, aux undefined.
   * MySQL retourne les DECIMAL comme strings, donc on doit toujours caster
   * avant tout calcul ou .toFixed().
   */
  const numKm = v => {
    const n = (v == null) ? 0 : (typeof v === 'number' ? v : parseFloat(v));
    return Number.isFinite(n) ? n : 0;
  };

  const POI_LABELS = {
    signaleur: 'Signaleur',
    ravito:    'Ravitaillement',
    danger:    'Danger',
    secteur:   'Secteur',
    depart:    'Départ',
    arrivee:   'Arrivée',
    direction: 'Direction'
  };
  const POI_COLORS = {
    signaleur: '#8B3726',
    ravito:    '#B08E4A',
    danger:    '#CAA35B',
    secteur:   '#B08E4A',
    depart:    '#C7BC9E',
    arrivee:   '#C7BC9E',
    direction: '#7A9BB5'
  };

  const state = {
    sortie: null, pois: [], routePoints: [],
    cursorFrac: 0, activeFilter: 'all', addingPoi: false,
    mapMini: null, satMap: null, mapFallback: null,
    posMarkerMini: null, posMarkerSat: null, posMarkerFb: null,
    mlyViewer: null, mlyLastKey: null, mlyLoadTimer: null,
    svMode: 'gsv', gsvReady: false,
    _gsvLastLat: null, _gsvLastLng: null,
    playing: false, playTimer: null
  };

  /* ─── Géo ─────────────────────────────────────────────────── */
  function haversine(a, b) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat), la2 = toRad(b.lat);
    const x = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  async function parseGpx(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) {
        console.error('[parseGpx] HTTP', r.status, 'pour', url);
        throw new Error('GPX ' + r.status + ' (fichier introuvable ?)');
      }
      const text = await r.text();
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      const parserErr = xml.querySelector('parsererror');
      if (parserErr) {
        console.error('[parseGpx] XML invalide:', parserErr.textContent.slice(0, 200));
        return [];
      }
      const pts = xml.querySelectorAll('trkpt, rtept, wpt');
      const raw = [];
      pts.forEach(p => {
        const lat = parseFloat(p.getAttribute('lat'));
        const lng = parseFloat(p.getAttribute('lon'));
        const ele = parseFloat(p.querySelector('ele')?.textContent) || 0;
        if (!isNaN(lat) && !isNaN(lng)) raw.push({ lat, lng, ele });
      });
      if (!raw.length) {
        console.warn('[parseGpx] Aucun trkpt trouvé dans le GPX', url);
        return [];
      }
      // Tente OSRM pour lisser le tracé sur les routes réelles, mais ne
      // bloque jamais le rendu : si OSRM échoue, on prend les points GPX bruts.
      let routed = raw;
      try {
        routed = await routeOnRealRoads(raw);
        if (!Array.isArray(routed) || routed.length < 2) routed = raw;
      } catch { routed = raw; }
      const arr = [];
      let accumM = 0, prev = null;
      routed.forEach(pt => {
        const p = { ...pt, distAccum: 0 };
        if (prev) { accumM += haversine(prev, p); p.distAccum = accumM; }
        arr.push(p); prev = p;
      });
      return arr;
    } catch (err) { console.warn('[parseGpx] Erreur:', err.message, 'URL:', url); return []; }
  }

  /**
   * Prend les waypoints clés du GPX et les route sur les vraies routes cyclables
   * via l'API OSRM publique (appelée depuis le navigateur de l'utilisateur).
   * Sous-échantillonne à ~15 waypoints pour rester dans les limites de l'API.
   *
   * Optionnel : si OSRM échoue ou met trop de temps, on retourne les
   * points bruts du GPX. Le profil altimétrique reste affichable dans tous
   * les cas — c'est le fix principal du bug "profil en cours de finalisation".
   *
   * Timeout court (3 s) : OSRM est souvent lent et ce n'est qu'un nice-to-have.
   * AbortController classique (pas AbortSignal.timeout) pour compatibilité Safari < 16.
   */
  async function routeOnRealRoads(rawPoints) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    try {
      // Sous-échantillonner : garder ~15 points répartis uniformément
      const MAX_WP = 15;
      const step = Math.max(1, Math.floor(rawPoints.length / MAX_WP));
      const sampled = [];
      for (let i = 0; i < rawPoints.length; i += step) sampled.push(rawPoints[i]);
      // Toujours inclure le dernier point
      const last = rawPoints[rawPoints.length - 1];
      if (sampled[sampled.length - 1] !== last) sampled.push(last);

      const coords = sampled.map(p => `${p.lng},${p.lat}`).join(';');
      const osrmUrl = `https://router.project-osrm.org/route/v1/cycling/${coords}?overview=full&geometries=geojson&steps=false`;
      const resp = await fetch(osrmUrl, { signal: ctrl.signal });
      if (!resp.ok) throw new Error('OSRM ' + resp.status);
      const data = await resp.json();
      if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('OSRM no route');

      const routeCoords = data.routes[0].geometry.coordinates; // [lng, lat]
      // Reconstruire avec élévation interpolée depuis les points GPX d'origine
      return routeCoords.map(([lng, lat]) => {
        let minD = Infinity, ele = 50;
        for (const p of rawPoints) {
          const d = Math.abs(p.lat - lat) + Math.abs(p.lng - lng);
          if (d < minD) { minD = d; ele = p.ele; }
        }
        return { lat, lng, ele };
      });
    } catch (err) {
      console.info('Routage OSRM indisponible, tracé GPX brut utilisé:', err.message);
      return rawPoints; // Fallback : GPX brut
    } finally {
      clearTimeout(timer);
    }
  }

  function pointAt(frac) {
    if (!state.routePoints.length) return null;
    const totalM = state.routePoints[state.routePoints.length - 1].distAccum;
    const targetM = frac * totalM;
    for (let i = 0; i < state.routePoints.length - 1; i++) {
      if (state.routePoints[i + 1].distAccum >= targetM) {
        const a = state.routePoints[i], b = state.routePoints[i + 1];
        const span = b.distAccum - a.distAccum || 1;
        const t = (targetM - a.distAccum) / span;
        return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, ele: a.ele + (b.ele - a.ele) * t };
      }
    }
    const last = state.routePoints[state.routePoints.length - 1];
    return { lat: last.lat, lng: last.lng, ele: last.ele };
  }

  /* ─── Markers & popups ────────────────────────────────────── */
  function buildMarker(poi, num) {
    return L.divIcon({
      className: 'map-marker',
      html: `<div class="poi-pin type-${poi.type || 'signaleur'}"><div class="poi-pin-shape"></div><div class="poi-pin-inner">${num}</div></div>`,
      iconSize: [34, 40], iconAnchor: [17, 40], popupAnchor: [0, -38]
    });
  }

  function popupHtml(poi) {
    const type = POI_LABELS[poi.type] || poi.type;
    const contact = poi.contact
      ? `<div class="poi-popup-contact"><b>${poi.contact.name || ''}</b>${poi.contact.phone ? ' · <a href="tel:' + poi.contact.phone.replace(/\s/g,'') + '">' + poi.contact.phone + '</a>' : ''}</div>`
      : '';
    return `
      <div class="poi-popup-head">
        <span class="poi-popup-type" style="color:${POI_COLORS[poi.type] || '#B08E4A'}">${type}</span>
        <span class="poi-popup-km">${numKm(poi.km).toFixed(1)}<span style="font-family:'Archivo',sans-serif;font-size:.5em;font-style:normal;margin-left:2px;letter-spacing:.1em;"> km</span></span>
      </div>
      <div class="poi-popup-body">
        <div class="poi-popup-title">${poi.label || '—'}</div>
        ${poi.desc ? `<div class="poi-popup-desc">${poi.desc}</div>` : ''}
        ${contact}
      </div>`;
  }

  /* ─── Cartes ──────────────────────────────────────────────── */
  function initMaps() {
    if (!window.L) return;
    const center = state.routePoints.length ? [state.routePoints[0].lat, state.routePoints[0].lng] : [state.sortie?.location?.lat || 50.43, state.sortie?.location?.lng || 3.2];

    if (document.getElementById('sv-fallback-map')) {
      state.mapFallback = L.map('sv-fallback-map', { center, zoom: 11 });
      // Si maps.js est chargé, on utilise le layer-control avec satellite/topo/standard
      // Sinon fallback sur la tuile CARTO standard.
      if (window.CCS_MAPS) {
        window.CCS_MAPS.addLayerControl(state.mapFallback, {
          defaultLayer: 'standard',
          layers: ['standard', 'satellite', 'topo'],
          position: 'topright',
        });
      } else {
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap, © CARTO'
        }).addTo(state.mapFallback);
      }
      drawRoute(state.mapFallback);
      drawPois(state.mapFallback, true);
      state.mapFallback.on('click', onMapClick);
    }

    if (document.getElementById('sv-fallback-sat')) {
      state.satMap = L.map('sv-fallback-sat', { center, zoom: 13, zoomControl: false });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: '© Esri'
      }).addTo(state.satMap);
      const pane = state.satMap.getPane('tilePane');
      if (pane) pane.style.filter = 'none';
      drawRoute(state.satMap);
    }

    if (document.getElementById('minimap-map')) {
      state.mapMini = L.map('minimap-map', {
        center, zoom: 10,
        zoomControl: false, attributionControl: false,
        dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(state.mapMini);
      drawRoute(state.mapMini);
      drawPois(state.mapMini, false);
      // Permettre le clic sur la mini-carte aussi pour placer un POI
      state.mapMini.on('click', onMapClick);
    }
  }

  function drawRoute(map) {
    if (!map || !state.routePoints.length) return;
    // Nettoyage des polylines existantes pour éviter les doublons après re-draw
    if (map._ccsRouteLayers) {
      map._ccsRouteLayers.forEach(l => map.removeLayer(l));
    }
    const coords = state.routePoints.map(p => [p.lat, p.lng]);
    // Triple polyline pour un effet "halo + ombre + tracé" très visible :
    // 1) Ombre noire large pour ressortir sur fond clair
    // 2) Halo jaune doux pour visibilité sur fond foncé
    // 3) Trait jaune vif fin au centre
    const l1 = L.polyline(coords, { color: '#000',    opacity: .55, weight: 9,   lineJoin: 'round', lineCap: 'round' }).addTo(map);
    const l2 = L.polyline(coords, { color: '#FFD93D', opacity: .35, weight: 7,   lineJoin: 'round', lineCap: 'round' }).addTo(map);
    const l3 = L.polyline(coords, { color: '#FFD93D', opacity: 1,   weight: 3.5, lineJoin: 'round', lineCap: 'round' }).addTo(map);
    map._ccsRouteLayers = [l1, l2, l3];
    try { map.fitBounds(L.latLngBounds(coords).pad(0.1)); } catch {}
  }

  function drawPois(map, interactive) {
    if (!map) return;
    // Nettoyer les markers POI existants (mais préserver le pos-marker mobile)
    map.eachLayer(l => { if (l instanceof L.Marker && !l._isPosMarker) map.removeLayer(l); });
    const list = filteredPois();
    list.forEach((poi, idx) => {
      const m = L.marker([poi.lat, poi.lng], { icon: buildMarker(poi, idx + 1) }).addTo(map);
      if (interactive) {
        m.bindPopup(popupHtml(poi), { className: 'ccs-popup', maxWidth: 320, minWidth: 220 });
        m.on('click', () => { highlightPoi(poi.id); seekToPoi(poi.id); });
      }
    });
  }

  function redrawAllPois() {
    [state.mapFallback, state.mapMini].forEach(m => {
      if (!m) return;
      m.eachLayer(l => { if (l instanceof L.Marker && !l._isPosMarker) m.removeLayer(l); });
    });
    if (state.mapFallback) drawPois(state.mapFallback, true);
    if (state.mapMini)     drawPois(state.mapMini, false);
  }

  function updatePosMarkers(frac) {
    const pt = pointAt(frac) || state._noGpxLoc || null;
    if (!pt) return null;

    // Calculer le cap (heading) au point courant pour orienter la flèche
    const heading = state.routePoints.length ? _estimateHeading(pt.lat, pt.lng) : 0;

    // Marker en flèche directionnelle (rotation selon heading)
    const icon = L.divIcon({
      className: 'map-marker',
      html: `<div class="pos-marker" style="transform:rotate(${heading}deg)"><div class="pos-marker-arrow"></div></div>`,
      iconSize: [24, 24], iconAnchor: [12, 12]
    });

    [
      { map: state.mapFallback, which: 'posMarkerFb' },
      { map: state.mapMini,     which: 'posMarkerMini' },
      { map: state.satMap,      which: 'posMarkerSat' }
    ].forEach(({ map, which }) => {
      if (!map) return;
      if (state[which]) {
        state[which].setLatLng([pt.lat, pt.lng]);
        state[which].setIcon(icon);
      } else {
        state[which] = L.marker([pt.lat, pt.lng], { icon, interactive: false, zIndexOffset: 1000 }).addTo(map);
        state[which]._isPosMarker = true;
      }
    });
    if (state.mapMini) state.mapMini.setView([pt.lat, pt.lng], state.mapMini.getZoom(), { animate: false });
    if (state.satMap)  state.satMap.setView([pt.lat, pt.lng], Math.max(state.satMap.getZoom(), 14), { animate: true });
    return pt;
  }

  /* ═══════════════════════════════════════════════════════════════
     Street View — Système hybride :
     1. Mapillary (interactif, libre) si token fourni
     2. Google Street View via URL directe (sans clé API)
     3. Fallback cartes OSM/Satellite Leaflet
     ═══════════════════════════════════════════════════════════════ */

  function initMapillary() {
    const viewerEl = document.getElementById('mly-viewer');
    const empty    = document.getElementById('sv-empty');
    const scene    = document.querySelector('.explorer-sv');
    if (!viewerEl) return;

    // ── Cas 1 : Mapillary avec token ──────────────────────────────
    if (MAPILLARY_TOKEN && window.mapillary) {
      try {
        state.mlyViewer = new window.mapillary.Viewer({
          accessToken: MAPILLARY_TOKEN, container: 'mly-viewer',
          component: { cover: false, bearing: false, zoom: false }
        });
        state.svMode = 'mapillary';
        return;
      } catch { /* fall through */ }
    }

    // ── Cas 2 : pas de token Mapillary → repli Street View ────────
    // ⚠️ L'embed "sans clé" de Google (maps.google.com/...output=svembed) a été
    // désactivé par Google : il renvoie 301 + X-Frame-Options: SAMEORIGIN, donc
    // le navigateur REFUSE de l'afficher en iframe. On n'insère plus d'iframe
    // vide : on affiche le panneau de repli et on ouvre la vraie Street View
    // immersive dans un nouvel onglet (Maps URLs API, fiable et sans clé).
    state.svMode = 'gsv';
    state.gsvReady = false;

    const svEmpty = document.getElementById('sv-empty');
    if (svEmpty) svEmpty.hidden = false;

    state._openRealStreetView = () => {
      const lat = state._gsvLastLat || state.sortie?.location?.lat || state.sortie?.lat;
      const lng = state._gsvLastLng || state.sortie?.location?.lng || state.sortie?.lng;
      if (lat && lng) {
        window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`, '_blank', 'noopener');
      }
    };
    const openMapsBtn = document.getElementById('sv-open-maps');
    if (openMapsBtn) openMapsBtn.addEventListener('click', state._openRealStreetView);

    // Position de départ (mise à jour ensuite par updateStreetView au scrub).
    const loc0 = state.sortie?.location;
    if (loc0) { state._gsvLastLat = loc0.lat; state._gsvLastLng = loc0.lng; }
  }

  async function findNearestImage(lat, lng) {
    if (!MAPILLARY_TOKEN) return null;
    try {
      const d = 0.004;
      const url = `https://graph.mapillary.com/images?access_token=${MAPILLARY_TOKEN}&fields=id,geometry&bbox=${lng-d},${lat-d},${lng+d},${lat+d}&limit=20`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const data = await r.json();
      if (!data?.data?.length) return null;
      let best = null, bestD = Infinity;
      data.data.forEach(img => {
        if (!img.geometry?.coordinates) return;
        const [lg, la] = img.geometry.coordinates;
        const dist = haversine({ lat, lng }, { lat: la, lng: lg });
        if (dist < bestD) { bestD = dist; best = img; }
      });
      return best?.id || null;
    } catch { return null; }
  }

  function updateStreetView(lat, lng) {
    if (state.mlyLoadTimer) clearTimeout(state.mlyLoadTimer);

    // ── Mode Mapillary ────────────────────────────────────────────
    if (state.svMode === 'mapillary' && state.mlyViewer) {
      state.mlyLoadTimer = setTimeout(async () => {
        const key = await findNearestImage(lat, lng);
        const empty = document.getElementById('sv-empty');
        if (!key) { if (empty) empty.hidden = false; return; }
        if (key === state.mlyLastKey) return;
        state.mlyLastKey = key;
        try { await state.mlyViewer.moveTo(key); if (empty) empty.hidden = true; }
        catch { if (empty) empty.hidden = false; }
      }, 300);
      return;
    }

    // ── Mode Google Street View (embed keyless bloqué par Google) ──
    // On ne charge plus d'iframe : on mémorise juste la position courante du
    // curseur pour que le bouton "Ouvrir la Street View" pointe au bon endroit.
    if (state.svMode === 'gsv') {
      state._gsvLastLat = Math.round(lat * 5000) / 5000;
      state._gsvLastLng = Math.round(lng * 5000) / 5000;
    }
  }

  /**
   * Construit directement une URL Google Maps Street View embed fiable.
   * N'utilise plus GeoPhotoService (endpoint interne bloqué par CORS en production).
   * Le format cbll+cbp est l'URL officielle de partage Google Maps Street View.
   * @returns {Promise<{panoId:string, lat:number, lng:number}|null>}
   */
  async function _fetchPanoId(lat, lng) {
    // On retourne un objet virtuel — l'URL sera construite depuis les coords directement
    return { panoId: null, lat, lng };
  }

  /**
   * Construit l'URL embed Google Maps Street View depuis des coordonnées.
   * Format officiel cbll/cbp — fonctionne sans pano ID, sans clé API.
   */
  function _gsvUrlFromPanoId(panoId, heading, lat, lng) {
    // Si on a des coordonnées, utiliser le format embed standard par coordonnées
    const useLat  = lat  || state._gsvLastLat;
    const useLng  = lng  || state._gsvLastLng;
    const h = Math.round(heading || 0);
    if (useLat && useLng) {
      return `https://maps.google.com/maps?q=&layer=c&cbll=${useLat},${useLng}&cbp=12,${h},0,0,0&output=svembed&hl=fr`;
    }
    // Fallback si pas de coords
    return `https://maps.google.com/maps?q=&layer=c&cbll=50.4351,3.2481&cbp=12,0,0,0,0&output=svembed&hl=fr`;
  }

  /**
   * Estime le cap (heading) en degrés depuis la position sur le tracé GPX.
   * Utilise la formule du rhumb line : heading = atan2(sin(Δλ)·cos(φ₂), cos(φ₁)·sin(φ₂) - sin(φ₁)·cos(φ₂)·cos(Δλ))
   * Look-ahead de ~50 m (ou plusieurs points) pour stabiliser le cap.
   */
  function _estimateHeading(lat, lng) {
    if (!state.routePoints.length) return 0;

    // 1) Trouver l'index du point le plus proche sur le tracé
    let minD = Infinity, idx = 0;
    for (let i = 0; i < state.routePoints.length; i++) {
      const p = state.routePoints[i];
      const dLat = p.lat - lat;
      const dLng = p.lng - lng;
      const d = dLat*dLat + dLng*dLng;  // distance² (pas besoin de sqrt pour comparer)
      if (d < minD) { minD = d; idx = i; }
    }

    // 2) Look-ahead progressif : trouver un point ~50 m plus loin pour stabiliser
    const a = state.routePoints[idx];
    let b = null;
    let accumDist = 0;
    for (let i = idx + 1; i < state.routePoints.length && accumDist < 50; i++) {
      const seg = haversine(state.routePoints[i-1], state.routePoints[i]);
      accumDist += seg;
      b = state.routePoints[i];
    }
    if (!b) {
      // Fin du tracé : prendre la direction depuis le point précédent
      if (idx > 0) {
        const prev = state.routePoints[idx - 1];
        return _bearingDeg(prev, a);
      }
      return 0;
    }
    return _bearingDeg(a, b);
  }

  /** Bearing initial entre deux points (formule grand cercle) */
  function _bearingDeg(p1, p2) {
    const toRad = d => d * Math.PI / 180;
    const φ1 = toRad(p1.lat), φ2 = toRad(p2.lat);
    const Δλ = toRad(p2.lng - p1.lng);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return Math.round(((θ * 180 / Math.PI) + 360) % 360);
  }

  /* ─── Liste POI ──────────────────────────────────────────── */
  // Pipeline : filter(type) → filter(search) → sort(option)
  function filteredPois() {
    let pois = state.activeFilter === 'all'
      ? state.pois.slice()
      : state.pois.filter(p => p.type === state.activeFilter);
    const q = (state.poiSearch || '').trim().toLowerCase();
    if (q) {
      pois = pois.filter(p => {
        const hay = [p.label, p.desc, p.contact?.name, p.contact?.phone, p.type]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    const sort = state.poiSort || 'km';
    if (sort === 'km')        pois.sort((a, b) => numKm(a.km) - numKm(b.km));
    else if (sort === 'km-desc') pois.sort((a, b) => numKm(b.km) - numKm(a.km));
    else if (sort === 'type')    pois.sort((a, b) => (a.type || '').localeCompare(b.type || '') || numKm(a.km) - numKm(b.km));
    else if (sort === 'title')   pois.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'fr'));
    return pois;
  }

  function renderPoiList() {
    const list = document.getElementById('poi-items');
    if (!list) return;
    const pois = filteredPois();
    // SÉCURITÉ : les POIs sont créés par n'importe quel membre via
    // POST /api/sorties/:sortieId/pois — sans escape on aurait du
    // stored-XSS (cf. AUDIT item #5). Utiliser esc() partout.
    list.innerHTML = pois.map((p, i) => {
      // 1) Masquer le type "DIRECTION" répétitif : il n'apparaît que pour
      //    les types saillants (départ, arrivée, signaleur, ravito, danger, secteur)
      const showType = p.type !== 'direction';

      // 2) Extraire l'action (verbe) et la transformer en chip court.
      //    Ex: desc "Poursuivre sur Grande Rue" + label "Grande Rue"
      //         → chip "Poursuivre", on masque la phrase complète redondante
      //    Si desc ajoute de l'info (ex. "Passage hors route", "Salouel · départ contre-la-montre"),
      //    on garde la desc complète sans chip.
      const cleanLabel = (p.label || '').replace(/^[→←↺⇗⇖↗⇒\s]+/, '').trim();
      let actionChip = '';
      let descToShow = p.desc || '';
      if (p.desc && cleanLabel) {
        const re = new RegExp(
          '^(continuer|poursuivre|droite|gauche|faites\\s+demi-tour|demi-tour|l[ée]g[èe]re?\\s+(droite|gauche)|prendre(?:\\s+(?:la\\s+)?sortie|\\s+direction)?)\\s+(?:sur\\s+)?' +
          cleanLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$',
          'i'
        );
        const m = p.desc.match(re);
        if (m) {
          // Normalise le verbe à une forme courte
          const verb = m[1].toLowerCase();
          if (/faites\s+demi-tour|demi-tour/.test(verb)) actionChip = 'Demi-tour';
          else if (/^l[ée]g[èe]re?\s+droite/.test(verb)) actionChip = 'Légère droite';
          else if (/^l[ée]g[èe]re?\s+gauche/.test(verb)) actionChip = 'Légère gauche';
          else if (/^prendre/.test(verb))                actionChip = 'Sortie';
          else                                            actionChip = verb.charAt(0).toUpperCase() + verb.slice(1);
          descToShow = '';
        }
      }

      return `
      <div class="poi-item poi-item--${esc(p.type)}" data-poi-id="${esc(p.id)}" role="button" tabindex="0">
        <div class="poi-item-num type-${esc(p.type)}">${i + 1}</div>
        <div class="poi-item-body">
          ${showType ? `<div class="poi-item-type">${esc(POI_LABELS[p.type] || p.type)}</div>` : ''}
          <div class="poi-item-title">
            ${actionChip ? `<span class="poi-action-chip">${esc(actionChip)}</span>` : ''}
            ${esc(p.label || '—')}
          </div>
          ${descToShow ? `<div class="poi-item-desc">${esc(descToShow)}</div>` : ''}
          ${p.contact ? `<div class="poi-item-contact"><b>${esc(p.contact.name || '')}</b>${p.contact.phone ? ' · <a href="tel:' + esc(String(p.contact.phone).replace(/\s/g,'')) + '">' + esc(p.contact.phone) + '</a>' : ''}</div>` : ''}
        </div>
        <div class="poi-item-right">
          <div class="poi-item-km">${numKm(p.km).toFixed(1)}<span class="unit">km</span></div>
          ${p._userAdded ? `<button class="poi-del-btn" data-del="${esc(p.id)}" aria-label="Supprimer">✕</button>` : ''}
        </div>
      </div>`;
    }).join('');

    const counter = document.getElementById('poi-counter');
    if (counter) {
      const totalKm = state.sortie?.distance_km || 0;
      // Density : un point tous les X mètres
      let density = '';
      if (totalKm > 0 && state.pois.length > 1) {
        const mPerPoi = Math.round((totalKm * 1000) / state.pois.length);
        density = ` · <span style="opacity:.6;">~1 point / ${mPerPoi >= 1000 ? (mPerPoi/1000).toFixed(1)+'km' : mPerPoi+'m'}</span>`;
      }
      counter.innerHTML = `<b>${pois.length}</b> point${pois.length > 1 ? 's' : ''} · total ${state.pois.length}${density}`;
    }

    const summary = document.getElementById('poi-summary-list');
    if (summary) {
      const types = ['direction', 'signaleur', 'ravito', 'secteur', 'danger', 'depart', 'arrivee'];
      summary.innerHTML = types.map(t => {
        const c = state.pois.filter(p => p.type === t).length;
        if (!c) return '';
        return `<div class="poi-sum-row"><span class="poi-sum-label"><span class="poi-sum-dot" style="background:${POI_COLORS[t]}"></span>${POI_LABELS[t]}</span><span class="poi-sum-count">${c}</span></div>`;
      }).filter(Boolean).join('');
    }

    list.querySelectorAll('.poi-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('poi-del-btn')) return;
        highlightPoi(el.dataset.poiId);
        seekToPoi(el.dataset.poiId);
      });
    });
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.CCS_DATA.deletePoi(SORTIE_ID, btn.dataset.del);
        state.pois = state.pois.filter(p => p.id !== btn.dataset.del);
        renderPoiList(); redrawAllPois(); renderScrubTicks();
        if (window.toast) window.toast('Point supprimé', 'info');
      });
    });
  }

  function highlightPoi(id) {
    document.querySelectorAll('.poi-item').forEach(el => el.classList.toggle('active', el.dataset.poiId === id));
  }

  function seekToPoi(id) {
    const poi = state.pois.find(p => p.id === id);
    if (!poi) return;
    const totalKm = state.routePoints.length ? state.routePoints[state.routePoints.length - 1].distAccum / 1000 : (state.sortie?.distance_km || 1);
    setCursor(Math.min(1, Math.max(0, (poi.km || 0) / totalKm)));
  }

  /* ─── Boutons de mode de vue (Street View / Satellite / OSM) ─ */
  function initViewModeButtons() {
    const btnGsv = document.getElementById('sv-btn-gsv');
    const btnSat = document.getElementById('sv-btn-sat');
    const btnOsm = document.getElementById('sv-btn-osm');
    const labelEl = document.getElementById('sv-source-label');
    const scene = document.querySelector('.explorer-sv');

    function setActiveBtn(active) {
      [btnGsv, btnSat, btnOsm].forEach(b => b && b.classList.remove('active'));
      if (active) active.classList.add('active');
    }

    // Helper : récupère la position courante (sur le tracé ou au départ)
    function currentLatLng() {
      const frac = state.cursorFrac || 0;
      if (state.routePoints.length) {
        const idx = Math.round(frac * (state.routePoints.length - 1));
        const pt = state.routePoints[Math.min(idx, state.routePoints.length - 1)];
        return { lat: pt.lat, lng: pt.lng };
      }
      if (state.sortie?.location) {
        return { lat: state.sortie.location.lat, lng: state.sortie.location.lng };
      }
      return null;
    }

    // Helper : bascule la vue active + rafraîchit la carte Leaflet correspondante
    function switchView(mode, map, zoom) {
      state.svMode = mode;
      if (scene) scene.dataset.view = mode === 'gsv' ? 'gsv' : mode;

      if (labelEl) {
        labelEl.textContent = {
          gsv:       'Google Street View',
          satellite: 'Vue satellite · Esri World Imagery',
          osm:       'Carte · OpenStreetMap'
        }[mode] || '';
      }

      // Laisser le navigateur faire le reflow avant d'invalider les dimensions
      // Leaflet ne peut mesurer qu'après que le conteneur soit visible (opacité + dimensions réelles).
      if (map) {
        requestAnimationFrame(() => {
          map.invalidateSize(true);
          // Re-dessiner le tracé après invalidateSize :
          // les polylines ajoutées dans un conteneur masqué/zéro-sized peuvent ne pas
          // s'afficher correctement même après invalidateSize. On re-injecte proprement.
          drawRoute(map);
          if (mode === 'sat' && map === state.satMap) {
            drawPois(map, false);
          }
          const pos = currentLatLng();
          if (pos) map.setView([pos.lat, pos.lng], zoom, { animate: false });
        });
      }
    }

    if (btnGsv) btnGsv.addEventListener('click', () => {
      setActiveBtn(btnGsv);
      switchView('gsv', null);
      // Embed keyless mort → on affiche le panneau de repli (avec son bouton
      // "Ouvrir la Street View") et on mémorise la position courante.
      const pos = currentLatLng();
      if (pos) { state._gsvLastLat = pos.lat; state._gsvLastLng = pos.lng; }
      const svEmpty = document.getElementById('sv-empty');
      if (svEmpty) svEmpty.hidden = false;
    });

    if (btnSat) btnSat.addEventListener('click', () => {
      setActiveBtn(btnSat);
      switchView('sat', state.satMap, 16);
    });

    if (btnOsm) btnOsm.addEventListener('click', () => {
      setActiveBtn(btnOsm);
      switchView('osm', state.mapFallback, 14);
    });
  }

  function initFilters() {
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeFilter = btn.dataset.filter;
        renderPoiList(); redrawAllPois();
      });
    });
    // Recherche live (debounced)
    const searchInput = document.getElementById('poi-search-input');
    const clearBtn = document.getElementById('poi-search-clear');
    if (searchInput) {
      let t;
      searchInput.addEventListener('input', () => {
        clearTimeout(t);
        const val = searchInput.value;
        clearBtn.hidden = !val;
        t = setTimeout(() => {
          state.poiSearch = val;
          renderPoiList();
        }, 120);
      });
      clearBtn?.addEventListener('click', () => {
        searchInput.value = '';
        state.poiSearch = '';
        clearBtn.hidden = true;
        renderPoiList();
        searchInput.focus();
      });
    }
    // Tri
    const sortSel = document.getElementById('poi-sort');
    if (sortSel) {
      sortSel.addEventListener('change', () => {
        state.poiSort = sortSel.value;
        renderPoiList();
      });
    }
  }

  /* ─── Formulaire ajout POI ────────────────────────────────── */
  function initPoiForm() {
    const toggleBtn = document.getElementById('poi-add-toggle');
    const hint = document.getElementById('poi-form-hint');
    const form = document.getElementById('poi-form');
    const coords = document.getElementById('poi-form-coords');
    const cancelBtn = document.getElementById('poi-form-cancel');
    const saveBtn = document.getElementById('poi-form-save');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        // Vérifier que l'utilisateur est connecté avant d'activer le mode
        if (!state.addingPoi && window.CCS_AUTH && !window.CCS_AUTH.isLoggedIn()) {
          if (window.toast) window.toast('Connectez-vous pour ajouter un point d\'intérêt', 'warning');
          else alert('Connectez-vous pour ajouter un point d\'intérêt');
          return;
        }
        state.addingPoi = !state.addingPoi;
        if (hint) {
          hint.classList.toggle('active', state.addingPoi);
          hint.textContent = state.addingPoi
            ? "→ Cliquez sur la carte (mini-carte ci-dessous ou plan de l'explorateur) pour positionner le point"
            : "Mode désactivé — activez-le pour cliquer sur la carte";
        }
        toggleBtn.textContent = state.addingPoi ? 'Annuler' : 'Cliquer sur la carte';
        toggleBtn.classList.toggle('btn-brass', state.addingPoi);
        toggleBtn.classList.toggle('btn-ghost', !state.addingPoi);
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        state.addingPoi = false;
        form?.reset();
        if (coords) coords.value = '';
        if (hint) { hint.classList.remove('active'); hint.textContent = "Mode désactivé — activez-le pour cliquer sur la carte"; }
        if (toggleBtn) { toggleBtn.textContent = 'Cliquer sur la carte'; toggleBtn.classList.remove('btn-brass'); toggleBtn.classList.add('btn-ghost'); }
      });
    }
    if (saveBtn && form) {
      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const type = document.getElementById('poi-form-type')?.value || 'signaleur';
        const label = document.getElementById('poi-form-label')?.value?.trim();
        const desc = document.getElementById('poi-form-desc')?.value?.trim();
        const name = document.getElementById('poi-form-contact-name')?.value?.trim();
        const phone = document.getElementById('poi-form-contact-phone')?.value?.trim();
        const cv = coords?.value;

        // Validation explicite avec feedback
        if (!cv) {
          if (window.toast) window.toast("Cliquez d'abord sur la carte pour positionner le POI", 'warning');
          else alert("Cliquez d'abord sur la carte pour positionner le POI");
          return;
        }
        if (!label) {
          if (window.toast) window.toast('Le libellé est obligatoire', 'warning');
          else alert('Le libellé est obligatoire');
          document.getElementById('poi-form-label')?.focus();
          return;
        }

        const [lat, lng] = cv.split(',').map(parseFloat);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          if (window.toast) window.toast('Coordonnées invalides — recliquez sur la carte', 'error');
          return;
        }

        // Calcul du km le plus proche sur le parcours
        let km = 0;
        if (state.routePoints && state.routePoints.length) {
          let best = Infinity, bestIdx = 0;
          state.routePoints.forEach((pt, i) => {
            const d = haversine({ lat, lng }, pt);
            if (d < best) { best = d; bestIdx = i; }
          });
          km = (state.routePoints[bestIdx].distAccum || 0) / 1000;
        }

        const newPoi = {
          type, label, desc, lat, lng,
          km: +km.toFixed(1),
          contact: (name || phone) ? { name, phone } : undefined
        };

        // Désactiver le bouton pendant l'envoi
        const originalLabel = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Envoi…';

        try {
          const saved = await window.CCS_DATA.addPoi(SORTIE_ID, newPoi);
          if (!saved) throw new Error('Réponse serveur vide');

          state.pois.push(saved);
          state.pois.sort((a, b) => (a.km || 0) - (b.km || 0));
          renderPoiList();
          redrawAllPois();
          renderScrubTicks();

          if (window.toast) window.toast('Point ajouté', 'success');
          form.reset();
          if (coords) coords.value = '';
          state.addingPoi = false;
          if (hint) {
            hint.classList.remove('active');
            hint.textContent = "Mode désactivé — activez-le pour cliquer sur la carte";
          }
          if (toggleBtn) {
            toggleBtn.textContent = 'Cliquer sur la carte';
            toggleBtn.classList.remove('btn-brass');
            toggleBtn.classList.add('btn-ghost');
          }
        } catch (err) {
          console.error('[POI add] error:', err);
          let msg = err.message || 'Erreur inconnue';
          if (err.status === 401) {
            msg = 'Vous devez être connecté pour ajouter un point.';
          } else if (err.status === 403) {
            msg = "Vous n'avez pas les droits pour ajouter un point sur cette sortie.";
          } else if (err.status === 404) {
            msg = "Sortie introuvable — la page est peut-être obsolète, rechargez.";
          } else if (err.status === 400) {
            msg = 'Données invalides : ' + msg;
          }
          if (window.toast) window.toast(msg, 'error');
          else alert(msg);
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = originalLabel || 'Enregistrer';
        }
      });
    }
  }

  function onMapClick(e) {
    if (!state.addingPoi) return;
    const coords = document.getElementById('poi-form-coords');
    if (coords) coords.value = `${e.latlng.lat.toFixed(6)},${e.latlng.lng.toFixed(6)}`;
    if (window.toast) window.toast(`Position : ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`, 'success');
  }

  function initMinimapExpand() {
    const wrap = document.querySelector('.minimap-wrap');
    const btn = document.getElementById('minimap-expand');
    if (!wrap || !btn) return;
    const setState = (expanded) => {
      wrap.classList.toggle('expanded', expanded);
      btn.setAttribute('aria-label', expanded ? 'Réduire la carte' : 'Agrandir la carte');
      btn.setAttribute('title', expanded ? 'Réduire (Échap)' : 'Agrandir');
      if (state.mapMini) setTimeout(() => state.mapMini.invalidateSize(), 300);
    };
    btn.addEventListener('click', () => setState(!wrap.classList.contains('expanded')));
    // Fermeture au clavier (le bug "impossible de refermer" en mode étendu).
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && wrap.classList.contains('expanded')) setState(false);
    });
  }

  /* ─── Frise de scrub ─────────────────────────────────────── */
  function renderScrubTicks() {
    const ticks = document.getElementById('scrub-ticks');
    if (!ticks) return;
    if (!state.pois.length) { ticks.innerHTML = ''; return; }
    const totalKm = state.routePoints.length ? state.routePoints[state.routePoints.length - 1].distAccum / 1000 : (state.sortie?.distance_km || 1);
    ticks.innerHTML = state.pois.map(p => {
      const frac = Math.min(1, Math.max(0, (p.km || 0) / totalKm));
      return `<div class="scrub-tick" style="left:${(frac * 100).toFixed(2)}%; background:${POI_COLORS[p.type] || '#B08E4A'};" title="${p.label}"></div>`;
    }).join('');
  }

  function setCursor(frac) {
    state.cursorFrac = Math.min(1, Math.max(0, frac));
    const fill = document.getElementById('scrub-fill');
    const thumb = document.getElementById('scrub-thumb');
    const kmEl = document.getElementById('scrub-km');
    if (fill) fill.style.width = (state.cursorFrac * 100).toFixed(2) + '%';
    if (thumb) thumb.style.left = (state.cursorFrac * 100).toFixed(2) + '%';
    const totalKm = state.routePoints.length ? state.routePoints[state.routePoints.length - 1].distAccum / 1000 : (state.sortie?.distance_km || 0);
    if (kmEl) kmEl.innerHTML = (state.cursorFrac * totalKm).toFixed(1) + '<span class="unit">km</span>';
    const pt = updatePosMarkers(state.cursorFrac);
    if (pt) updateStreetView(pt.lat, pt.lng);
    updateElevCursor();
  }

  function initScrub() {
    const rail = document.getElementById('scrub-rail');
    const btnBack = document.getElementById('scrub-back');
    const btnPlay = document.getElementById('scrub-play');
    const btnFwd  = document.getElementById('scrub-fwd');
    if (rail) {
      const handle = (e) => {
        const rect = rail.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        setCursor(x / rect.width);
      };
      rail.addEventListener('click', handle);
      let dragging = false;
      rail.addEventListener('pointerdown', (e) => { dragging = true; rail.setPointerCapture(e.pointerId); handle(e); });
      rail.addEventListener('pointermove', (e) => { if (dragging) handle(e); });
      rail.addEventListener('pointerup', () => { dragging = false; });
    }
    if (btnBack) btnBack.addEventListener('click', () => setCursor(state.cursorFrac - 0.05));
    if (btnFwd)  btnFwd.addEventListener('click',  () => setCursor(state.cursorFrac + 0.05));
    if (btnPlay) btnPlay.addEventListener('click', togglePlay);
    document.addEventListener('keydown', (e) => {
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setCursor(state.cursorFrac - 0.02); }
      if (e.key === 'ArrowRight') { e.preventDefault(); setCursor(state.cursorFrac + 0.02); }
      if (e.key === ' ')          { e.preventDefault(); togglePlay(); }
    });
  }

  function togglePlay() {
    const btn = document.getElementById('scrub-play');
    if (state.playing) {
      state.playing = false;
      clearInterval(state.playTimer);
      if (btn) btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    } else {
      state.playing = true;
      if (state.cursorFrac >= 1) state.cursorFrac = 0;
      if (btn) btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
      // state.playSpeed = multiplicateur (0.25 = très lent → 4 = très rapide)
      // Step de base 0.0008 toutes les 100 ms ≈ 125 s à 1× (2 min) pour parcourir 100 %
      // À 0.5× (par défaut), 4 minutes ; à 4×, 30 secondes.
      const speed = state.playSpeed || 0.5;
      const step = 0.0008 * speed;
      state.playTimer = setInterval(() => {
        setCursor(state.cursorFrac + step);
        if (state.cursorFrac >= 1) togglePlay();
      }, 100);
    }
  }

  /* ─── Slider de vitesse de lecture ────────────────────────── */
  function initSpeedControl() {
    const slider = document.getElementById('scrub-speed');
    const label  = document.getElementById('scrub-speed-label');
    if (!slider) return;
    // Vitesse par défaut : 0.5× (plus lente, plus immersive)
    if (slider.value === '1' || !slider.value) slider.value = '0.5';
    state.playSpeed = parseFloat(slider.value) || 0.5;

    const update = () => {
      state.playSpeed = parseFloat(slider.value) || 0.5;
      if (label) label.textContent = state.playSpeed + '×';
      // Si en cours de lecture, redémarrer avec la nouvelle vitesse
      if (state.playing) {
        clearInterval(state.playTimer);
        const step = 0.0008 * state.playSpeed;
        state.playTimer = setInterval(() => {
          setCursor(state.cursorFrac + step);
          if (state.cursorFrac >= 1) togglePlay();
        }, 100);
      }
    };
    slider.addEventListener('input', update);
    if (label) label.textContent = state.playSpeed + '×';
  }

  /* ─── Profil altimétrique amélioré ─────────────────────────
     Affiche :
       - Surface remplie avec gradient vertical
       - Trait principal du profil
       - Marquages de pente (couleur selon pourcentage)
       - Grille horizontale + verticale
       - Échelle altitude (gauche) + distance (bas)
       - Indicateurs min/max + D+ total
     ──────────────────────────────────────────────────────── */
  function drawElevation() {
    const canvas = document.getElementById('elev-canvas');
    if (!canvas || !state.routePoints.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (rect.width < 50 || rect.height < 50) {
      requestAnimationFrame(() => drawElevation());
      return;
    }

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const pts = state.routePoints;
    const eles = pts.map(p => p.ele);
    const minE = Math.min(...eles), maxE = Math.max(...eles);
    // Padding altitudes (10% du range haut & bas)
    const eleRange = (maxE - minE) || 1;
    const ePad = eleRange * 0.1;
    const yMinE = minE - ePad;
    const yMaxE = maxE + ePad;
    const yRange = (yMaxE - yMinE) || 1;

    const totalM = pts[pts.length - 1].distAccum || 1;
    const padTop = 28, padBot = 30, padL = 42, padR = 12;
    const W = rect.width - padL - padR;
    const H = rect.height - padTop - padBot;
    const xFor = m => padL + (m / totalM) * W;
    const yFor = e => padTop + H - ((e - yMinE) / yRange) * H;

    // Calculer D+ et D−
    let dPlus = 0, dMinus = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = (pts[i].ele || 0) - (pts[i - 1].ele || 0);
      if (d > 0) dPlus += d; else dMinus -= d;
    }

    // ── 1) GRILLE HORIZONTALE (lignes altitude) ──
    ctx.strokeStyle = 'rgba(176,142,74,0.08)';
    ctx.lineWidth = 1;
    const eleSteps = 4; // 5 lignes (0 à 4)
    for (let i = 0; i <= eleSteps; i++) {
      const e = yMinE + (yRange * i / eleSteps);
      const y = yFor(e);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + W, y);
      ctx.stroke();
      // Label altitude à gauche
      ctx.fillStyle = 'rgba(199,188,158,0.55)';
      ctx.font = '10px "Archivo", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(e) + ' m', padL - 6, y + 3);
    }

    // ── 2) GRILLE VERTICALE (lignes distance) ──
    const km = totalM / 1000;
    const step = km < 30 ? 5 : km < 80 ? 10 : km < 150 ? 20 : 30;
    for (let k = 0; k <= km; k += step) {
      const x = xFor(k * 1000);
      ctx.strokeStyle = 'rgba(176,142,74,0.05)';
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + H);
      ctx.stroke();
      // Label km en bas
      ctx.fillStyle = 'rgba(199,188,158,0.55)';
      ctx.font = '10px "Archivo", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(k + ' km', x, padTop + H + 16);
    }

    // ── 3) SURFACE REMPLIE (gradient brass) ──
    ctx.beginPath();
    ctx.moveTo(xFor(0), padTop + H);
    pts.forEach(p => ctx.lineTo(xFor(p.distAccum), yFor(p.ele)));
    ctx.lineTo(xFor(totalM), padTop + H);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + H);
    grad.addColorStop(0, 'rgba(176,142,74,0.45)');
    grad.addColorStop(0.6, 'rgba(176,142,74,0.18)');
    grad.addColorStop(1, 'rgba(176,142,74,0.04)');
    ctx.fillStyle = grad;
    ctx.fill();

    // ── 4) SEGMENTS COLORÉS PAR PENTE (par tranche) ──
    // Couleur selon le grade : flat (laiton), moyen (orange), raide (rouge)
    function colorForGrade(g) {
      const ag = Math.abs(g);
      if (ag < 3) return '#B08E4A';      // plat / faible
      if (ag < 6) return '#D49B3C';      // doux
      if (ag < 9) return '#E27E2C';      // moyen
      return '#D9543E';                   // raide
    }

    // Calculer pente entre points consécutifs et dessiner segments
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dDist = b.distAccum - a.distAccum;
      const dEle = (b.ele || 0) - (a.ele || 0);
      const grade = dDist > 0 ? (dEle / dDist) * 100 : 0;
      ctx.strokeStyle = colorForGrade(grade);
      ctx.beginPath();
      ctx.moveTo(xFor(a.distAccum), yFor(a.ele));
      ctx.lineTo(xFor(b.distAccum), yFor(b.ele));
      ctx.stroke();
    }

    // ── 5) STATS EN HAUT (Min, Max, D+, D−) ──
    ctx.fillStyle = 'rgba(199,188,158,0.85)';
    ctx.font = 'bold 11px "Archivo", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`D+ ${Math.round(dPlus)} m`, padL, padTop - 12);
    ctx.fillStyle = 'rgba(199,188,158,0.55)';
    ctx.font = '10px "Archivo", sans-serif';
    ctx.fillText(`D− ${Math.round(dMinus)} m`, padL + 70, padTop - 12);
    ctx.textAlign = 'right';
    ctx.fillText(`min ${Math.round(minE)} m · max ${Math.round(maxE)} m`, padL + W, padTop - 12);

    // ── 6) LÉGENDE COULEURS PENTE (en bas à droite) ──
    const legendY = padTop + H + 16;
    const legendX = padL + W - 200;
    ctx.fillStyle = 'rgba(199,188,158,0.45)';
    ctx.font = '9px "Archivo", sans-serif';
    ctx.textAlign = 'left';
    const legend = [
      { label: '< 3 %', color: '#B08E4A' },
      { label: '3-6 %', color: '#D49B3C' },
      { label: '6-9 %', color: '#E27E2C' },
      { label: '> 9 %', color: '#D9543E' },
    ];
    let lx = legendX;
    legend.forEach(l => {
      ctx.fillStyle = l.color;
      ctx.fillRect(lx, legendY - 6, 8, 8);
      ctx.fillStyle = 'rgba(199,188,158,0.5)';
      ctx.fillText(l.label, lx + 12, legendY);
      lx += 50;
    });

    // Mettre à jour les stats du panneau head
    const headStats = document.getElementById('elev-head-stats');
    if (headStats) {
      headStats.innerHTML = `
        <span class="elev-stat"><span class="elev-stat-l">D+</span> <span class="elev-stat-v">${Math.round(dPlus)}</span> m</span>
        <span class="elev-stat"><span class="elev-stat-l">Max</span> <span class="elev-stat-v">${Math.round(maxE)}</span> m</span>
        <span class="elev-stat"><span class="elev-stat-l">Min</span> <span class="elev-stat-v">${Math.round(minE)}</span> m</span>
      `;
    }
  }

  function updateElevCursor() {
    const wrap = document.getElementById('elev-canvas-wrap');
    if (!wrap) return;
    const cursor = document.getElementById('elev-cursor');
    if (cursor) {
      cursor.style.left = (state.cursorFrac * wrap.getBoundingClientRect().width) + 'px';
      cursor.classList.add('active');
    }
  }

  function initElevHover() {
    const wrap = document.getElementById('elev-canvas-wrap');
    if (!wrap) return;
    const cursor = document.getElementById('elev-cursor');
    const tooltip = document.getElementById('elev-tooltip');

    wrap.addEventListener('pointermove', (e) => {
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const frac = Math.max(0, Math.min(1, x / rect.width));
      if (cursor) { cursor.style.left = x + 'px'; cursor.classList.add('active'); }
      const pt = pointAt(frac);
      if (pt && tooltip) {
        const totalKm = state.routePoints[state.routePoints.length - 1].distAccum / 1000;
        tooltip.classList.add('active');
        tooltip.style.left = Math.min(rect.width - 150, Math.max(10, x + 12)) + 'px';
        tooltip.style.top = '10px';
        tooltip.innerHTML = `
          <div class="elev-tooltip-row"><span>Distance</span><b>${(frac * totalKm).toFixed(1)} km</b></div>
          <div class="elev-tooltip-row"><span>Altitude</span><b>${Math.round(pt.ele)} m</b></div>`;
      }
    });
    wrap.addEventListener('pointerleave', () => {
      if (cursor) cursor.classList.remove('active');
      if (tooltip) tooltip.classList.remove('active');
      updateElevCursor();
    });
    wrap.addEventListener('click', (e) => {
      const rect = wrap.getBoundingClientRect();
      setCursor((e.clientX - rect.left) / rect.width);
    });
  }

  /* ─── Export GPX & ouverture Strava ──────────────────────── */
  function initExport() {
    const btn = document.getElementById('export-gpx');
    if (btn) {
      btn.addEventListener('click', () => {
        if (!state.routePoints.length) { if (window.toast) window.toast('Aucun tracé à exporter', 'warning'); return; }
        const pts = state.routePoints.map(p => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${p.ele.toFixed(1)}</ele></trkpt>`).join('\n');
        const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Club de Cyclisme de Salouel" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${state.sortie?.title || 'Sortie'}</name></metadata>\n  <trk><name>${state.sortie?.title || 'Sortie'}</name><trkseg>\n${pts}\n  </trkseg></trk>\n</gpx>\n`;
        const blob = new Blob([gpx], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = (state.sortie?.id || 'sortie') + '.gpx'; a.click();
        URL.revokeObjectURL(url);
        if (window.toast) window.toast('GPX exporté', 'success');
      });
    }
    const stravaBtn = document.getElementById('open-strava');
    if (stravaBtn) stravaBtn.addEventListener('click', () => window.open('https://www.strava.com/routes', '_blank', 'noopener'));

    const rbBtn = document.getElementById('export-roadbook');
    if (rbBtn) {
      rbBtn.addEventListener('click', () => {
        // Marque le mode impression : un CSS dédié va masquer tout sauf le hero + directions
        document.body.classList.add('print-roadbook');
        // Petit délai pour laisser le browser appliquer les styles avant la dialog
        setTimeout(() => {
          window.print();
          document.body.classList.remove('print-roadbook');
        }, 80);
      });
    }
  }

  /* ─── Rendu dynamique du header & sections ──────────────── */
  function renderHeader() {
    if (!state.sortie) return;
    const s = state.sortie;
    document.title = s.number
      ? `${s.title} · № ${s.number} — Club de Cyclisme de Salouel`
      : `${s.title} — Club de Cyclisme de Salouel`;

    // Hero image dans le page-head
    const heroEl = document.getElementById('sortie-head-hero');
    if (heroEl) {
      const src = s.hero_img || s.card_img;
      if (src) heroEl.src = src;
    }

    // Breadcrumb sortie nº
    const crumb = document.getElementById('crumb-current');
    if (crumb) crumb.textContent = s.number ? `Sortie № ${s.number}` : s.title;

    // Tags
    const tagsEl = document.getElementById('sortie-tags');
    if (tagsEl && s.tags) {
      // tags peuvent venir d'un membre via PUT sortie ; échapper t.label
      tagsEl.innerHTML = s.tags.map(t => {
        if (t.type === 'live')  return `<span class="tag tag-live"><span class="tag-dot"></span>${esc(t.label)}</span>`;
        if (t.type === 'brass') return `<span class="tag tag-brass">${esc(t.label)}</span>`;
        return `<span class="tag">${esc(t.label)}</span>`;
      }).join('');
    }

    // Chapter, title, subtitle
    const chapterEl = document.getElementById('sortie-chapter');
    if (chapterEl) chapterEl.innerHTML = `<em>${esc(s.chapter)}</em>`;
    const titleEl = document.getElementById('sortie-title');
    // title_html est INTENTIONNELLEMENT non-échappé : il sert à insérer
    // les <span class="it"> pour la mise en forme typographique.
    // Seuls les modos peuvent éditer (cf. routes/sorties.js requireModo).
    if (titleEl) titleEl.innerHTML = s.title_html || esc(s.title);
    const subEl = document.getElementById('sortie-sub');
    if (subEl) subEl.textContent = s.description;

    // Stats
    const statsEl = document.getElementById('sortie-stats');
    if (statsEl) {
      const baseStats = [
        { label: 'Distance', value: String(s.distance_km), unit: 'km' },
        { label: 'Durée',    value: s.duration_label || '—' },
        { label: 'D+',       value: String(s.elevation_gain), unit: 'm' }
      ];
      const all = baseStats.concat(s.stats_extra || []);
      // stats_extra : label + unit configurés par modo via API → on échappe quand même.
      // cls est aussi mis dans un attribut class, donc on filtre les caractères dangereux.
      statsEl.innerHTML = all.map(st => `
        <div class="sh-stat">
          <div class="sh-stat-l">${esc(st.label)}</div>
          <div class="sh-stat-v ${esc(st.cls || '').replace(/[^a-zA-Z0-9_ -]/g,'')}">${esc(st.value)}${st.unit ? '<span class="unit">' + esc(st.unit) + '</span>' : ''}</div>
        </div>`).join('');
    }

    // Stats panneau elevation
    const elevHead = document.getElementById('elev-head-stats');
    if (elevHead) {
      elevHead.innerHTML = `
        <div class="elev-head-stat"><div class="elev-head-stat-v pos">+${s.elevation_gain}<span class="unit">m</span></div><div class="elev-head-stat-l">D+</div></div>
        <div class="elev-head-stat"><div class="elev-head-stat-v neg">−${s.elevation_loss}<span class="unit">m</span></div><div class="elev-head-stat-l">D−</div></div>
        <div class="elev-head-stat"><div class="elev-head-stat-v">${s.elevation_max}<span class="unit">m</span></div><div class="elev-head-stat-l">Max</div></div>
        <div class="elev-head-stat"><div class="elev-head-stat-v">${s.elevation_min}<span class="unit">m</span></div><div class="elev-head-stat-l">Min</div></div>
      `;
    }

    // Total km dans la barre de scrub
    const scrubTotal = document.getElementById('scrub-total');
    if (scrubTotal) scrubTotal.textContent = '/ ' + s.distance_km + ' km';
  }

  function renderSegments() {
    const tbody = document.getElementById('seg-tbody');
    const head = document.getElementById('seg-head-meta');
    if (!tbody || !state.sortie) return;
    const segs = state.sortie.segments || [];
    if (head) {
      const totalSec = segs.length;
      const majeurs = segs.filter(s => s.stars >= 4).length;
      head.textContent = `${totalSec} segments suivis · ${majeurs} majeurs`;
    }
    if (!segs.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; opacity:.5;">Aucun segment pour cette sortie</td></tr>';
      return;
    }
    const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
    tbody.innerHTML = segs.map(seg => `
      <tr>
        <td class="seg-table-idx">${String(seg.idx).padStart(2, '0')}</td>
        <td><div class="seg-table-name">${esc(seg.name)}</div><div class="seg-table-name-sub">${esc(seg.sub)}</div></td>
        <td class="seg-table-stars">${stars(seg.stars)}</td>
        <td class="seg-table-len">${(seg.length_m || 0).toLocaleString('fr-FR')} m</td>
        <td class="seg-table-time">${esc(seg.time)}</td>
        <td><span class="seg-delta ${esc(seg.delta_cls || '').replace(/[^a-zA-Z0-9_-]/g,'')}">${esc(seg.delta)}</span></td>
        <td><span class="seg-rank">${esc(seg.rank)}</span></td>
      </tr>`).join('');
  }

  /* ─── Boot ───────────────────────────────────────────────── */
  async function boot() {
    if (!window.CCS_DATA) return;

    state.sortie = await window.CCS_DATA.sortie(SORTIE_ID);
    // Exposer le state minimal pour les autres scripts (météo, etc.)
    window.CCS_SORTIE_STATE = state;
    if (!state.sortie) {
      console.warn('Sortie introuvable:', SORTIE_ID);
      const body = document.querySelector('.sortie-head-title');
      if (body) body.textContent = 'Sortie introuvable';
      return;
    }
    state.pois = await window.CCS_DATA.pois(SORTIE_ID);
    if (state.sortie?.gpx_ref) {
      console.log('[sortie] Tentative chargement GPX:', 'asset/gpx/' + state.sortie.gpx_ref);
      state.routePoints = await parseGpx('asset/gpx/' + state.sortie.gpx_ref);
      console.log('[sortie] GPX chargé:', state.routePoints.length, 'points');
    } else {
      console.warn('[sortie] Pas de gpx_ref pour cette sortie. Champ DB gpx_filename probablement null.');
    }

    renderHeader();
    // Fix 3 — sync scrub total with real GPX distance (overrides distance_km from data)
    if (state.routePoints.length) {
      const realKm = (state.routePoints[state.routePoints.length - 1].distAccum / 1000).toFixed(1);
      const scrubTotal = document.getElementById('scrub-total');
      if (scrubTotal) scrubTotal.textContent = '/ ' + realKm + ' km';
    }
    // Pas de GPX officiel — message clair sans génération approximative
    if (!state.routePoints.length) {
      const canvas = document.getElementById('elev-canvas');
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.parentElement?.offsetWidth || 600;
        const H = canvas.parentElement?.offsetHeight || 120;
        canvas.width = W * dpr; canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(176,142,74,0.2)';
        ctx.lineWidth = 1; ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.moveTo(24, H / 2); ctx.lineTo(W - 24, H / 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(199,188,158,0.45)';
        ctx.font = '13px "Archivo",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Parcours officiel en cours de finalisation', W / 2, H / 2 - 8);
        ctx.fillStyle = 'rgba(176,142,74,0.55)';
        ctx.font = 'italic 11px "EB Garamond",serif';
        ctx.fillText('Sera publié quelques jours avant le départ — ' + (state.sortie?.date_label || ''), W / 2, H / 2 + 14);
      }
      const loc = state.sortie?.location;
      if (loc) {
        state._noGpxLoc = { lat: loc.lat, lng: loc.lng, ele: 0 };
      }
    }
    renderSegments();
    initMaps();
    // Attendre que mapillary-js soit chargé si token défini, sinon GSV direct
    if (MAPILLARY_TOKEN) {
      const tryInit = (attempt) => {
        if (window.mapillary || attempt > 20) { initMapillary(); return; }
        setTimeout(() => tryInit(attempt + 1), 150);
      };
      tryInit(0);
    } else {
      initMapillary();
    }
    initViewModeButtons();
    // Street View immersive en-page indisponible sans clé (Google a bloqué
    // l'embed keyless) → on démarre sur la vue satellite haute-définition.
    document.getElementById('sv-btn-sat')?.click();
    renderPoiList();
    renderScrubTicks();
    initScrub();
    initSpeedControl();
    initFilters();
    initPoiForm();
    initMinimapExpand();
    drawElevation();
    initElevHover();
    initExport();
    setCursor(0);

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        drawElevation();
        updateElevCursor();
        if (state.mapMini)     state.mapMini.invalidateSize();
        if (state.satMap)      state.satMap.invalidateSize();
        if (state.mapFallback) state.mapFallback.invalidateSize();
      }, 200);
    });
  }

  function waitForDataAndBoot() {
    if (window.CCS_DATA) {
      boot();
    } else {
      // CCS_DATA not ready yet — poll briefly (data.js may still be parsing)
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.CCS_DATA) {
          clearInterval(interval);
          boot();
        } else if (attempts > 50) {
          clearInterval(interval);
          console.error('CCS_DATA non disponible après 5 secondes');
        }
      }, 100);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForDataAndBoot);
  else waitForDataAndBoot();
})();