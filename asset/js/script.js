/* ============================================================
   SCRIPT.JS — Cercle Cycliste Dashboard · HIGH-IMPACT v2.0
   Modules:
     - Map (Mapbox 3D + fallback SVG)
     - Elevation Chart (Chart.js + map sync)
     - NP Power Chart
     - Zone Chart
     - IF Gauge
     - Route Sparklines
     - Topo Tabs
     - Route Selector
     - 3D Toggle
     - Scroll Reveal
     - Counter Animation
   ============================================================ */

"use strict";

/* ────────────────────────────────────────────────────────────
   MAPBOX TOKEN — Remplacez par votre token depuis mapbox.com
   ──────────────────────────────────────────────────────────── */
const MAPBOX_TOKEN = ""; // <-- collez votre token ici

/* ────────────────────────────────────────────────────────────
   ROUTE DATA — GeoJSON réels + profils d'élévation
   ──────────────────────────────────────────────────────────── */
const ROUTES = {
  tourmalet: {
    name: "Col du Tourmalet",
    dist: "19.2 km", elev: "1 404 m D+", grad: "7.4% moy.",
    distNum: 19.2, elevNum: 1404, speedNum: "6.12", cat: "Hors Cat.",
    center: [0.1409, 42.9086], zoom: 11.5, bearing: 25, pitch: 68,
    color: "#00C2FF",
    coords: [
      [0.2218,42.9177],[0.2065,42.9158],[0.1920,42.9143],[0.1790,42.9132],
      [0.1668,42.9120],[0.1556,42.9108],[0.1452,42.9096],[0.1355,42.9087],
      [0.1262,42.9081],[0.1175,42.9085],[0.1090,42.9090],[0.1015,42.9100],
      [0.0942,42.9113],[0.0875,42.9120],[0.0812,42.9128]
    ],
    elevation: [711,775,845,920,1010,1110,1230,1365,1490,1620,1740,1855,1940,2020,2115]
  },
  alpedhuez: {
    name: "Alpe d'Huez",
    dist: "13.8 km", elev: "1 071 m D+", grad: "8.1% moy.",
    distNum: 13.8, elevNum: 1071, speedNum: "5.85", cat: "Hors Cat.",
    center: [6.053, 45.090], zoom: 12, bearing: -15, pitch: 62,
    color: "#FF9F00",
    coords: [
      [6.0340,45.0563],[6.0355,45.0593],[6.0370,45.0625],[6.0385,45.0660],
      [6.0360,45.0695],[6.0325,45.0725],[6.0295,45.0758],[6.0325,45.0790],
      [6.0380,45.0820],[6.0435,45.0850],[6.0470,45.0885],[6.0510,45.0912],
      [6.0540,45.0940],[6.0562,45.0965],[6.0580,45.0990]
    ],
    elevation: [789,840,895,955,1015,1075,1140,1210,1285,1360,1435,1510,1585,1655,1720,1790,1860]
  },
  full: {
    name: "Parcours Complet",
    dist: "184 km", elev: "4 200 m D+", grad: "—",
    distNum: 184, elevNum: 4200, speedNum: "6.12", cat: "Hors Cat.",
    center: [2.8, 43.5], zoom: 7.5, bearing: 5, pitch: 42,
    color: "#39FF14",
    coords: [
      [0.2218,42.9177],[0.5500,42.9700],[0.9000,43.0500],[1.2000,43.1800],
      [1.5000,43.3200],[1.8000,43.5000],[2.2000,43.6500],[2.7000,43.8000],
      [3.3000,43.9500],[3.9000,44.1000],[4.5000,44.2500],[5.0000,44.4500],
      [5.5000,44.6500],[6.0580,45.0990]
    ],
    elevation: [
      300,340,380,430,480,540,590,640,690,740,800,860,920,980,
      1040,1100,1165,1230,1300,1380,1460,1540,1620,1700,1775,1855,1930,2000,
      2050,2100,2060,1900,1750,1600,1520,1460,1720,1860
    ]
  },

  /* ── Cartes Route Selector ── */
  geant: {
    name: "Boucle du Géant",
    dist: "42.0 km", elev: "980 m D+", grad: "5.2%",
    distNum: 42, elevNum: 980, speedNum: "7.40", cat: "Cat. 1",
    center: [6.25, 45.35], zoom: 11, bearing: 10, pitch: 57,
    color: "#FF9F00",
    coords: [
      [6.1000,45.2500],[6.1500,45.2800],[6.2000,45.3100],[6.2500,45.3400],
      [6.3000,45.3700],[6.3500,45.3900],[6.3200,45.4200],[6.2600,45.4400],
      [6.2000,45.4100],[6.1600,45.3800],[6.1200,45.3400],[6.1000,45.3100],
      [6.0800,45.2800],[6.1000,45.2500]
    ],
    elevation: [850,920,990,1060,1130,1200,1270,1310,1280,1220,1150,1070,990,920,850]
  },
  tranchee: {
    name: "La Tranchée",
    dist: "28.5 km", elev: "650 m D+", grad: "6.1%",
    distNum: 28.5, elevNum: 650, speedNum: "7.90", cat: "Cat. 2",
    center: [5.98, 45.16], zoom: 12, bearing: -10, pitch: 54,
    color: "#39FF14",
    coords: [
      [5.9200,45.1100],[5.9500,45.1300],[5.9800,45.1500],[6.0100,45.1700],
      [6.0400,45.1900],[6.0700,45.2100],[6.0500,45.2400],[6.0100,45.2600],
      [5.9700,45.2400],[5.9400,45.2100],[5.9200,45.1800],[5.9200,45.1100]
    ],
    elevation: [620,680,740,800,860,920,980,1040,1000,940,870,800,720,650]
  },
  corniche: {
    name: "Corniche Latérale",
    dist: "19.0 km", elev: "410 m D+", grad: "4.8%",
    distNum: 19, elevNum: 410, speedNum: "8.60", cat: "Cat. 3",
    center: [6.02, 45.05], zoom: 12.5, bearing: 30, pitch: 52,
    color: "#00C2FF",
    coords: [
      [5.9800,45.0300],[6.0000,45.0400],[6.0200,45.0500],[6.0400,45.0600],
      [6.0600,45.0700],[6.0800,45.0800],[6.0700,45.0950],[6.0500,45.1050],
      [6.0300,45.0950],[6.0100,45.0800],[5.9800,45.0600],[5.9800,45.0300]
    ],
    elevation: [780,810,840,870,900,940,980,1000,980,940,900,860,820,780]
  },
  nocturne: {
    name: "Circuit Nocturne",
    dist: "35.0 km", elev: "820 m D+", grad: "7.2%",
    distNum: 35, elevNum: 820, speedNum: "6.70", cat: "Cat. 1",
    center: [6.10, 45.20], zoom: 11, bearing: -20, pitch: 62,
    color: "#9B6FFF",
    coords: [
      [6.0500,45.1500],[6.0800,45.1700],[6.1100,45.1900],[6.1400,45.2100],
      [6.1700,45.2300],[6.2000,45.2500],[6.1800,45.2800],[6.1400,45.3000],
      [6.1000,45.2800],[6.0700,45.2500],[6.0500,45.2200],[6.0500,45.1500]
    ],
    elevation: [900,970,1040,1110,1180,1250,1320,1360,1310,1240,1160,1080,1000,920]
  }
};

/* ── State global ── */
let mapInstance  = null;
let mapMarker    = null;
let elevChart    = null;
let currentRoute = "tourmalet";
let is3D         = true;

/* ════════════════════════════════════════════════════════════
   NAV — Effet scroll + glassmorphism
   ════════════════════════════════════════════════════════════ */
function initNavScroll() {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  const onScroll = () => {
    nav.classList.toggle("nav--scrolled", window.scrollY > 40);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

/* ════════════════════════════════════════════════════════════
   MAPBOX MAP — 3D Terrain + Golden Hour Lighting
   ════════════════════════════════════════════════════════════ */
function initMap() {
  const el = document.getElementById("map");
  if (!el) return;

  if (!MAPBOX_TOKEN) {
    renderFallbackMap(el);
    return;
  }

  mapboxgl.accessToken = MAPBOX_TOKEN;
  const r = ROUTES[currentRoute];

  mapInstance = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/dark-v11",
    center: r.center,
    zoom: r.zoom,
    bearing: r.bearing,
    pitch: r.pitch,
    antialias: true,
    projection: "globe"
  });

  mapInstance.on("load", () => {
    /* ── DEM Terrain haute résolution ── */
    mapInstance.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14
    });

    /* Exagération terrain x2.0 pour impact visuel maximal */
    mapInstance.setTerrain({ source: "mapbox-dem", exaggeration: 2.0 });

    /* ── Ciel "Golden Hour" dramatique ── */
    mapInstance.addLayer({
      id: "sky",
      type: "sky",
      paint: {
        "sky-type": "atmosphere",
        "sky-atmosphere-sun": [10, 55],       /* angle rasant = golden hour */
        "sky-atmosphere-sun-intensity": 15,    /* très lumineux */
        "sky-atmosphere-color": "rgba(10,14,32,1)",
        "sky-atmosphere-halo-color": "rgba(0,140,220,0.25)",
        "sky-horizon-blend": 0.07
      }
    });

    /* ── Brume atmosphérique premium ── */
    mapInstance.setFog({
      color: "rgba(5,8,20,0.85)",
      "high-color": "rgba(22,32,90,0.55)",
      "horizon-blend": 0.07,
      "space-color": "#00000a",
      "star-intensity": 0.18
    });

    loadRouteOnMap(currentRoute, false);
  });

  /* ── Marker lumineux ── */
  const markerEl = document.createElement("div");
  markerEl.style.cssText = `
    width:14px; height:14px;
    background: #00C2FF;
    border: 2.5px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 4px rgba(0,194,255,0.35), 0 0 24px rgba(0,194,255,0.9);
    transition: transform 0.12s ease-out;
    pointer-events: none;
    will-change: transform;
  `;
  mapMarker = new mapboxgl.Marker({ element: markerEl, anchor: "center" });
}

/* ── Chargement / mise à jour de la route sur la carte ── */
function loadRouteOnMap(routeKey, animate = true) {
  if (!mapInstance) return;

  const r = ROUTES[routeKey];
  const geojson = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: r.coords }
    }]
  };

  /* Nettoyage des layers/source précédents */
  ["route-outer-glow", "route-outer", "route-inner"].forEach(id => {
    if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
  });
  if (mapInstance.getSource("route")) mapInstance.removeSource("route");

  mapInstance.addSource("route", { type: "geojson", data: geojson });

  /* Glow large — ambiance */
  mapInstance.addLayer({
    id: "route-outer-glow",
    type: "line",
    source: "route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": r.color, "line-width": 22, "line-opacity": 0.09, "line-blur": 16 }
  });

  /* Glow moyen */
  mapInstance.addLayer({
    id: "route-outer",
    type: "line",
    source: "route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": r.color, "line-width": 8, "line-opacity": 0.24, "line-blur": 5 }
  });

  /* Ligne précise nette */
  mapInstance.addLayer({
    id: "route-inner",
    type: "line",
    source: "route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": r.color, "line-width": 2.8, "line-opacity": 0.98 }
  });

  /* Marker au départ */
  if (mapMarker) {
    mapMarker.setLngLat(r.coords[0]).addTo(mapInstance);
    const mEl = mapMarker.getElement();
    mEl.style.background  = r.color;
    mEl.style.boxShadow   = `0 0 0 4px ${hexToRgba(r.color, 0.35)}, 0 0 24px ${hexToRgba(r.color, 0.85)}`;
  }

  /* FlyTo cinématique ease-out */
  if (animate) {
    mapInstance.flyTo({
      center:   r.center,
      zoom:     r.zoom,
      bearing:  r.bearing,
      pitch:    r.pitch,
      duration: 3400,
      essential: true,
      curve:    1.45,
      speed:    0.88,
      easing:   t => 1 - Math.pow(1 - t, 4)  /* quartic ease-out = parfait */
    });
  }
}

/* ── Carte de repli SVG (sans token Mapbox) ── */
function renderFallbackMap(el) {
  const r     = ROUTES["tourmalet"];
  const color = r.color;

  el.style.cssText = "position:relative;overflow:hidden;background:#060c14;";

  el.innerHTML = `
  <svg viewBox="0 0 560 300" fill="none" xmlns="http://www.w3.org/2000/svg"
       style="width:100%;height:100%;position:absolute;inset:0">
    <defs>
      <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#080c14"/>
        <stop offset="100%" stop-color="#030508"/>
      </linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="${color}" stop-opacity="0.3"/>
        <stop offset="50%"  stop-color="${color}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.65"/>
      </linearGradient>
    </defs>
    <rect width="560" height="300" fill="url(#mg)"/>
    <!-- Grille topo -->
    ${[55,110,165,220].map(y =>
      `<line x1="0" y1="${y}" x2="560" y2="${y}" stroke="rgba(0,194,255,0.04)" stroke-width="1"/>`
    ).join("")}
    ${[112,224,336,448].map(x =>
      `<line x1="${x}" y1="0" x2="${x}" y2="300" stroke="rgba(0,194,255,0.04)" stroke-width="1"/>`
    ).join("")}
    <!-- Contours topographiques -->
    <ellipse cx="290" cy="130" rx="240" ry="120" stroke="rgba(0,194,255,0.05)" stroke-width="1" fill="none"/>
    <ellipse cx="290" cy="130" rx="190" ry="95"  stroke="rgba(0,194,255,0.07)" stroke-width="1" fill="none"/>
    <ellipse cx="290" cy="130" rx="140" ry="70"  stroke="rgba(0,194,255,0.09)" stroke-width="1" fill="none"/>
    <ellipse cx="290" cy="130" rx="90"  ry="45"  stroke="rgba(0,194,255,0.12)" stroke-width="1" fill="none"/>
    <ellipse cx="290" cy="130" rx="45"  ry="22"  stroke="rgba(0,194,255,0.17)" stroke-width="1" fill="none"/>
    <!-- Glow route -->
    <path d="M40 258 C85 225 130 235 175 202 C215 172 248 140 284 112 C318 85 350 95 385 82 C420 68 450 84 500 58"
          stroke="${color}" stroke-width="16" stroke-linecap="round" fill="none" opacity="0.08"/>
    <!-- Route principale -->
    <path d="M40 258 C85 225 130 235 175 202 C215 172 248 140 284 112 C318 85 350 95 385 82 C420 68 450 84 500 58"
          stroke="url(#routeGrad)" stroke-width="2.8" stroke-linecap="round" fill="none"/>
    <!-- Zone sous la courbe -->
    <path d="M40 258 C85 225 130 235 175 202 C215 172 248 140 284 112 C318 85 350 95 385 82 C420 68 450 84 500 58 L500 290 L40 290 Z"
          fill="${color}" fill-opacity="0.05"/>
    <!-- Marqueur sommet -->
    <circle cx="284" cy="112" r="8" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.65"/>
    <circle cx="284" cy="112" r="3.5" fill="${color}" filter="url(#glow)"/>
    <!-- Marqueur départ -->
    <circle cx="40" cy="258" r="6" fill="none" stroke="#39FF14" stroke-width="1.5" opacity="0.75"/>
    <circle cx="40" cy="258" r="2.5" fill="#39FF14"/>
    <!-- Labels altitude -->
    <text x="278" y="104" fill="rgba(0,194,255,0.7)" font-size="10" font-family="monospace">2115m</text>
    <text x="46"  y="272" fill="rgba(57,255,20,0.65)" font-size="9" font-family="monospace">711m</text>
    <!-- Axe KM -->
    <line x1="40" y1="278" x2="500" y2="278" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    ${["0","5","10","15","19.2"].map((km, i) =>
      `<text x="${40 + i * 115}" y="292" fill="rgba(255,255,255,0.15)" font-size="8" font-family="monospace">${km}km</text>`
    ).join("")}
  </svg>`;

  /* Notice token */
  const notice = document.createElement("div");
  notice.style.cssText = `
    position:absolute;bottom:46px;left:50%;transform:translateX(-50%);
    background:rgba(5,8,16,0.92);border:1px solid rgba(0,194,255,0.12);
    border-radius:7px;padding:9px 18px;
    font-family:'DM Mono',monospace;font-size:11px;color:#4a505e;
    white-space:nowrap;z-index:2;letter-spacing:0.05em;
    backdrop-filter:blur(8px);
  `;
  notice.innerHTML = `Mode statique · Ajoutez <code style="color:#00C2FF;font-size:11px">MAPBOX_TOKEN</code> pour la carte 3D`;
  el.appendChild(notice);
}

/* ════════════════════════════════════════════════════════════
   ELEVATION CHART — Gradient luxe + sync carte
   Survol du graphique → déplacement curseur lumineux sur la carte
   ════════════════════════════════════════════════════════════ */
function initElevChart(routeKey = "tourmalet") {
  const canvas = document.getElementById("elevChart");
  if (!canvas) return;

  const r      = ROUTES[routeKey];
  const data   = r.elevation;
  const n      = data.length;
  const labels = data.map((_, i) => {
    const km = ((i / (n - 1)) * r.distNum).toFixed(1);
    return `${km} km`;
  });

  /* Destruction du graphique précédent */
  if (elevChart) { elevChart.destroy(); elevChart = null; }

  const ctx = canvas.getContext("2d");

  /* Gradient sous la courbe */
  const makeGradient = (chart) => {
    const { chartArea, ctx: c } = chart;
    if (!chartArea) return "transparent";
    const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    g.addColorStop(0,    hexToRgba(r.color, 0.45));
    g.addColorStop(0.50, hexToRgba(r.color, 0.12));
    g.addColorStop(1,    hexToRgba(r.color, 0.00));
    return g;
  };

  elevChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Altitude (m)",
        data,
        borderColor: r.color,
        borderWidth: 2.8,
        pointRadius: 0,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: r.color,
        pointHoverBorderColor: "#ffffff",
        pointHoverBorderWidth: 2.5,
        fill: true,
        backgroundColor(context) { return makeGradient(context.chart); },
        tension: 0.42,
        cubicInterpolationMode: "monotone"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          /* Tooltip grand, sombre, lisible */
          backgroundColor: "rgba(8,10,18,0.97)",
          borderColor: "rgba(255,255,255,0.10)",
          borderWidth: 1,
          padding: { x: 18, y: 13 },
          cornerRadius: 8,
          titleFont: { family: "'Barlow Condensed',sans-serif", size: 12, weight: "600" },
          titleColor: "#4a505e",
          bodyFont:  { family: "'DM Mono',monospace", size: 15 },
          bodyColor: "#f0f2f5",
          displayColors: false,
          callbacks: {
            label: item => `↑ ${item.raw} m  ·  ${labels[item.dataIndex]}`
          }
        }
      },
      /* Synchronisation carte — ease-out sur le marker */
      onHover(_, elements) {
        if (!elements.length) { hideMapCoords(); return; }
        const idx    = elements[0].index;
        const coords = ROUTES[currentRoute].coords;
        const t      = idx / (data.length - 1);
        const ci     = Math.min(Math.floor(t * (coords.length - 1)), coords.length - 2);
        const frac   = t * (coords.length - 1) - ci;
        const lng    = coords[ci][0] + (coords[ci + 1][0] - coords[ci][0]) * frac;
        const lat    = coords[ci][1] + (coords[ci + 1][1] - coords[ci][1]) * frac;

        if (mapMarker && mapInstance) {
          mapMarker.setLngLat([lng, lat]);
          /* Micro-animation ease-out sur le marker */
          const mEl = mapMarker.getElement();
          mEl.style.transform = "scale(1.35)";
          setTimeout(() => { mEl.style.transform = "scale(1)"; }, 180);
        }
        showMapCoords(lat, lng, data[idx], labels[idx]);
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
          ticks: {
            color: "#3a4050",
            font: { family: "'DM Mono',monospace", size: 10 },
            maxTicksLimit: 8,
            maxRotation: 0
          },
          border: { display: false }
        },
        y: {
          grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
          ticks: {
            color: "#3a4050",
            font: { family: "'DM Mono',monospace", size: 10 },
            callback: v => `${v}m`,
            maxTicksLimit: 4
          },
          border: { display: false }
        }
      },
      animation: { duration: 720, easing: "easeInOutQuart" }
    }
  });
}

/* ── Mise à jour de l'overlay flottant ── */
function showMapCoords(lat, lng, alt, km) {
  const f = document.getElementById("mapFooter");
  if (!f) return;
  f.style.opacity = "1";
  const latEl = document.getElementById("coordLat");
  const lonEl = document.getElementById("coordLon");
  const altEl = document.getElementById("coordAlt");
  const kmEl  = document.getElementById("coordKm");
  if (latEl) latEl.textContent = `LAT ${lat.toFixed(5)}`;
  if (lonEl) lonEl.textContent = `LON ${lng.toFixed(5)}`;
  if (altEl) altEl.textContent = `ALT ${alt} m`;
  if (kmEl)  kmEl.textContent  = km;
}

function hideMapCoords() {
  const f = document.getElementById("mapFooter");
  if (f) f.style.opacity = "0.38";
}

/* ════════════════════════════════════════════════════════════
   MISE À JOUR STATS (changement de route)
   ════════════════════════════════════════════════════════════ */
function updateEnferStats(routeKey) {
  const r = ROUTES[routeKey];
  if (!r) return;
  const statVals = document.querySelectorAll(".stat-blk__val");
  if (statVals.length >= 4) {
    animateValue(statVals[0], parseFloat(statVals[0].textContent) || 0, r.distNum, "km", false);
    animateValue(statVals[1], 0, r.elevNum, "m", false);
    const v2 = statVals[2];
    if (v2) v2.innerHTML = `${r.speedNum}<em>km/h</em>`;
    const v3 = statVals[3];
    if (v3) v3.innerHTML = r.cat;
  }
}

function animateValue(el, from, to, unit, hasDecimal) {
  if (!el) return;
  const suffix = el.innerHTML.includes("<em>")
    ? el.innerHTML.slice(el.innerHTML.indexOf("<em>"))
    : `<em>${unit}</em>`;
  const start = performance.now();
  const dur   = 960;
  function tick(now) {
    const p    = Math.min((now - start) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const val  = from + (to - from) * ease;
    el.innerHTML = (hasDecimal ? val.toFixed(1) : Math.round(val).toLocaleString("fr-FR")) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ════════════════════════════════════════════════════════════
   NP POWER CHART — dégradé vert fluo
   ════════════════════════════════════════════════════════════ */
function initNPChart() {
  const canvas = document.getElementById("npChart");
  if (!canvas) return;
  const ctx  = canvas.getContext("2d");
  const pts  = 32;
  const data = Array.from({ length: pts }, (_, i) => {
    const base = 105 + Math.sin(i * 0.38) * 24 + Math.cos(i * 0.18) * 12;
    return Math.max(60, Math.round(base + (i > 12 && i < 22 ? 22 : 0)));
  });

  /* Dégradé vertical luxe */
  const gradient = ctx.createLinearGradient(0, 0, 0, 90);
  gradient.addColorStop(0, "rgba(57,255,20,0.42)");
  gradient.addColorStop(1, "rgba(57,255,20,0.00)");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: "#39FF14",
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        backgroundColor: gradient,
        tension: 0.44,
        cubicInterpolationMode: "monotone"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(8,10,18,0.97)",
          borderColor: "rgba(255,255,255,0.09)",
          borderWidth: 1,
          cornerRadius: 7,
          bodyFont: { family: "'DM Mono',monospace", size: 14 },
          bodyColor: "#f0f2f5",
          displayColors: false,
          callbacks: { label: item => `${item.raw} W` }
        }
      },
      scales: {
        x: { display: false },
        y: {
          display: true,
          grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
          ticks: {
            color: "#2e3540",
            font: { family: "'DM Mono',monospace", size: 9 },
            maxTicksLimit: 3
          },
          border: { display: false }
        }
      }
    }
  });
}

/* ════════════════════════════════════════════════════════════
   ZONE CHART — barres avec dégradés zones cardiaques
   ════════════════════════════════════════════════════════════ */
function initZoneChart() {
  const canvas = document.getElementById("zoneChart");
  if (!canvas) return;
  const ctx    = canvas.getContext("2d");
  const zones  = ["Z1","Z2","Z3","Z4","Z5"];
  const values = [8, 18, 25, 57, 12];
  /* Couleurs zones : des plus claires aux plus vives */
  const colors = ["#1e2535","#253045","#00C2FF","#FF9F00","#FF4D4D"];

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: zones,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(8,10,18,0.97)",
          borderColor: "rgba(255,255,255,0.09)",
          borderWidth: 1,
          cornerRadius: 7,
          bodyFont: { family: "'DM Mono',monospace", size: 14 },
          bodyColor: "#f0f2f5",
          titleFont: { family: "'Barlow Condensed',sans-serif", size: 12 },
          titleColor: "#4a505e",
          displayColors: false,
          callbacks: { label: item => `${item.raw} min` }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#4a505e",
            font: { family: "'DM Mono',monospace", size: 10 }
          },
          border: { display: false }
        },
        y: { display: false }
      },
      animation: {
        delay: (context) => context.dataIndex * 90,
        duration: 850,
        easing: "easeOutQuart"
      }
    }
  });
}

/* ════════════════════════════════════════════════════════════
   IF GAUGE — Doughnut avec gradient bleu électrique
   ════════════════════════════════════════════════════════════ */
function initIFGauge() {
  const canvas = document.getElementById("ifGauge");
  if (!canvas) return;
  const ctx  = canvas.getContext("2d");
  const val  = 82;
  const rest = 100 - val;

  /* Gradient arc bleu → cyan */
  const grad = ctx.createLinearGradient(0, 0, 150, 150);
  grad.addColorStop(0, "#007AFF");
  grad.addColorStop(1, "#00C2FF");

  new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [val, rest],
        backgroundColor: [grad, "rgba(255,255,255,0.035)"],
        borderWidth: 0,
        hoverOffset: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "74%",
      rotation: -120,
      circumference: 240,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      animation: { animateRotate: true, duration: 1500, easing: "easeInOutQuart" }
    }
  });
}

/* ════════════════════════════════════════════════════════════
   ROUTE SPARKLINES — mini graphiques d'élévation
   ════════════════════════════════════════════════════════════ */
function initRouteSparklines() {
  document.querySelectorAll(".rc__chart").forEach(canvas => {
    const color = canvas.dataset.color || "#fff";
    const pts   = (canvas.dataset.pts || "50").split(",").map(Number);
    const ctx   = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, 68);
    gradient.addColorStop(0, hexToRgba(color, 0.40));
    gradient.addColorStop(1, hexToRgba(color, 0.00));

    new Chart(ctx, {
      type: "line",
      data: {
        labels: pts.map((_, i) => i),
        datasets: [{
          data: pts,
          borderColor: color,
          borderWidth: 2.2,
          pointRadius: 0,
          fill: true,
          backgroundColor: gradient,
          tension: 0.44,
          cubicInterpolationMode: "monotone"
        }]
      },
      options: {
        responsive: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        animation: { duration: 950, easing: "easeInOutQuart" }
      }
    });

    const card = canvas.closest(".rc");
    if (card) card.style.setProperty("--accent-clr", color);
  });
}

/* ════════════════════════════════════════════════════════════
   TOPO TABS — Switch élévation + route carte
   ════════════════════════════════════════════════════════════ */
function initTopoTabs() {
  document.querySelectorAll(".topo__tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".topo__tab").forEach(b => {
        b.classList.remove("topo__tab--active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("topo__tab--active");
      btn.setAttribute("aria-selected", "true");
      const routeKey = btn.dataset.route;
      currentRoute   = routeKey;
      initElevChart(routeKey);
      if (mapInstance) loadRouteOnMap(routeKey, true);
    });
  });
}

/* ════════════════════════════════════════════════════════════
   ROUTE SELECTOR — Sync complète : carte + élévation + stats
   ════════════════════════════════════════════════════════════ */
function initRouteSelector() {
  document.querySelectorAll(".rc").forEach(card => {
    const routeData = card.dataset.route;

    card.addEventListener("click", () => {
      document.querySelectorAll(".rc").forEach(c => {
        c.classList.remove("rc--active");
        c.setAttribute("aria-pressed", "false");
      });
      card.classList.add("rc--active");
      card.setAttribute("aria-pressed", "true");

      if (!ROUTES[routeData]) return;
      currentRoute = routeData;

      /* 1. Mise à jour carte */
      if (mapInstance) {
        loadRouteOnMap(routeData, true);
      } else {
        renderFallbackMap(document.getElementById("map"));
      }

      /* 2. Mise à jour profil d'élévation */
      initElevChart(routeData);

      /* 3. Mise à jour stats */
      updateEnferStats(routeData);

      /* 4. Scroll doux vers la section carte */
      const mapSection = document.querySelector(".enfer");
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); }
    });
  });
}

/* ════════════════════════════════════════════════════════════
   TOGGLE 3D — Basculer entre vue plate et 3D
   ════════════════════════════════════════════════════════════ */
function init3DToggle() {
  const btn = document.getElementById("btn3d");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (!mapInstance) return;
    is3D = !is3D;
    const r = ROUTES[currentRoute];
    mapInstance.easeTo({
      pitch:   is3D ? r.pitch   : 0,
      bearing: is3D ? r.bearing : 0,
      duration: 900,
      easing:   t => 1 - Math.pow(1 - t, 3)
    });
    btn.style.color     = is3D ? "#00C2FF" : "";
    btn.style.boxShadow = is3D ? "0 0 18px rgba(0,194,255,0.35)" : "";
  });
}

/* ════════════════════════════════════════════════════════════
   SCROLL REVEAL — Intersection Observer
   ════════════════════════════════════════════════════════════ */
function initReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.07, rootMargin: "0px 0px -28px 0px" });

  document.querySelectorAll([
    ".enfer__left", ".enfer__right",
    ".topo",
    ".plan__left", ".plan__right",
    ".infos__head", ".infos__strip", ".infos__cols",
    ".donnees__head", ".donnees__grid",
    ".carto__head", ".carto__grid"
  ].join(",")).forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${(i % 3) * 0.09}s`;
    observer.observe(el);
  });
}

/* ════════════════════════════════════════════════════════════
   COUNTER ANIMATION — Compte des chiffres clés
   ════════════════════════════════════════════════════════════ */
function animateCounters() {
  document.querySelectorAll(".stat-blk__val").forEach(el => {
    const raw   = el.textContent.trim();
    const match = raw.match(/^([\d\s,.]+)/);
    if (!match) return;
    const numStr     = match[1].replace(/[\s\u00a0]/g, "");
    const target     = parseFloat(numStr.replace(",", "."));
    if (isNaN(target)) return;
    const hasDecimal = numStr.includes(".") || numStr.includes(",");
    const suffix     = el.innerHTML.replace(match[0], "");
    const start      = performance.now();
    const dur        = 1300;
    function tick(now) {
      const p    = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const val  = target * ease;
      el.innerHTML = (hasDecimal ? val.toFixed(2) : Math.floor(val)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

/* ════════════════════════════════════════════════════════════
   UTILITY
   ════════════════════════════════════════════════════════════ */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ════════════════════════════════════════════════════════════
   BOOT — Initialisation ordonnée au DOMContentLoaded
   ════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initNavScroll();
  initMap();
  initElevChart("tourmalet");
  initNPChart();
  initZoneChart();
  initIFGauge();
  initRouteSparklines();
  initTopoTabs();
  initRouteSelector();
  init3DToggle();
  initReveal();
  /* Délai léger pour laisser le layout se stabiliser */
  setTimeout(animateCounters, 380);
});