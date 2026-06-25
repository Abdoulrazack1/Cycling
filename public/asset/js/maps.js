/* ═════════════════════════════════════════════════════════════════
   maps.js — Helpers Leaflet : presets de tuiles + layer control
   ─────────────────────────────────────────────────────────────────
   Centralise les definitions de tile layers pour qu'on garde une
   palette cohérente : standard / satellite / topo / terrain / sombre.

   Expose window.CCS_MAPS :
   - tilePresets[name]  → {url, opts, label}
   - addLayerControl(map, opts?)
   - createLayer(name)
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const PRESETS = {
    standard: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      opts: { subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap, © CARTO' },
      label: 'Standard',
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      opts: { subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap, © CARTO' },
      label: 'Sombre',
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      opts: { maxZoom: 19, attribution: '© Esri, © Maxar, Earthstar Geographics' },
      label: 'Satellite',
    },
    topo: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      opts: { maxZoom: 17, attribution: '© OpenTopoMap (CC-BY-SA), SRTM | © OSM', subdomains: 'abc' },
      label: 'Topo',
    },
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      opts: { maxZoom: 19, attribution: '© OpenStreetMap', subdomains: 'abc' },
      label: 'OSM',
    },
  };

  function createLayer(name) {
    if (!window.L) return null;
    const p = PRESETS[name] || PRESETS.standard;
    return L.tileLayer(p.url, p.opts);
  }

  /* Ajoute un control Leaflet pour switcher entre les couches
     Options : defaultLayer (str), layers (array of names), position (str) */
  function addLayerControl(map, options = {}) {
    if (!window.L || !map) return null;
    const layerNames = options.layers || ['standard', 'satellite', 'topo'];
    const layers = {};
    let active = null;
    for (const name of layerNames) {
      const layer = createLayer(name);
      if (!layer) continue;
      const label = PRESETS[name].label;
      layers[label] = layer;
      if (name === (options.defaultLayer || layerNames[0])) {
        layer.addTo(map);
        active = layer;
      }
    }
    return L.control.layers(layers, null, {
      position: options.position || 'topright',
      collapsed: options.collapsed !== false,
    }).addTo(map);
  }

  /* Synchronise la couche selon le thème (dark theme → tuiles sombres
     en remplacement du "standard" CARTO Positron). */
  function bindToTheme(map, layerHolder) {
    document.addEventListener('ccs:themechange', (e) => {
      const eff = e.detail?.effective || 'dark';
      const want = eff === 'light' ? 'standard' : 'dark';
      // layerHolder est l'instance courante. On le remplace.
      if (!layerHolder.current || layerHolder.preset === want) return;
      map.removeLayer(layerHolder.current);
      const newLayer = createLayer(want);
      newLayer.addTo(map);
      layerHolder.current = newLayer;
      layerHolder.preset = want;
    });
  }

  window.CCS_MAPS = {
    presets: PRESETS,
    createLayer,
    addLayerControl,
    bindToTheme,
  };
})();
