/* ═══════════════════════════════════════════════════════════
   RANDONNEUR — script.js — v3.0 Pro
   Corrections v3 :
   - Bug MAP_CENTER corrigé (condition inutile supprimée)
   - Double rAF + force reflow pour toutes les transitions CSS
   - initCountUp synchronisé avec IntersectionObserver (data-reveal)
   - Curseur glow desktop
   - toggleFlythrough : reset flyStep si flythrough terminé
   - setMapStyle : guard mapStyle déjà actif
   - nearestPoint : distance euclidienne en degrés (suffisant pour le cas)
   - syncMarker : guard mainMap chargé
   - Keyboard shortcuts : Escape ferme aussi le menu mobile
   - exportGPX : balise <name> correcte (était <n>)
   ═══════════════════════════════════════════════════════════ */

"use strict";

/* ──────────────────────────────────────────────────────────
   CONFIG & CONSTANTS
─────────────────────────────────────────────────────────── */

// Token public de démo Mapbox — remplace par le tien : https://account.mapbox.com
const MAPBOX_TOKEN =
  "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

// BUG FIX v3 : MAP_CENTER était [6.428, 6.428 < 0 ? 45.13 : 45.13]
// la condition était toujours vraie → valeur correcte, mais code trompeur.
const MAP_CENTER = [6.428, 45.13]; // [lng, lat]

// Tracé GPX simulé du Galibier (28 points lng/lat)
const ROUTE = [
  [6.350,45.050],[6.370,45.068],[6.382,45.088],[6.393,45.107],
  [6.402,45.118],[6.410,45.128],[6.416,45.134],[6.420,45.140],
  [6.425,45.145],[6.430,45.150],[6.435,45.155],[6.440,45.160],
  [6.443,45.163],[6.446,45.166],[6.449,45.169],[6.452,45.172],
  [6.454,45.174],[6.456,45.176],[6.458,45.178],[6.460,45.180],
  [6.462,45.182],[6.464,45.183],[6.465,45.184],[6.466,45.1848],
  [6.4672,45.1854],[6.4682,45.186],[6.4692,45.1864],[6.470,45.1868]
];

const MAP_STYLES = {
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  terrain:   "mapbox://styles/mapbox/outdoors-v12",
  dark:      "mapbox://styles/mapbox/dark-v11"
};

/* ──────────────────────────────────────────────────────────
   ELEVATION DATA GENERATION
─────────────────────────────────────────────────────────── */
function buildElevationData() {
  const N = 88;
  const KM_TOTAL = 87.4;
  const pts = [];

  for (let i = 0; i < N; i++) {
    const km = (i / (N - 1)) * KM_TOTAL;
    let alt;

    if      (km < 10) alt = 1200 + km * 30;
    else if (km < 18) alt = 1500 + Math.sin((km - 10) * 0.3) * 80;
    else if (km < 35) alt = 1560 + (km - 18) * 28 + Math.sin(km * 1.2) * 40;
    else if (km < 38) alt = 2040 + Math.sin((km - 35) * 2) * 20;
    else if (km < 55) alt = 2060 + (km - 38) * 34 + Math.sin(km * 0.9) * 50;
    else if (km < 58) alt = 2600 + Math.sin((km - 55) * 1.5) * 42;
    else if (km < 68) alt = 2580 - (km - 58) * 95 + Math.sin(km * 1.4) * 30;
    else if (km < 74) alt = 1630 - (km - 68) * 20 + Math.sin(km * 2) * 20;
    else              alt = 1500 - (km - 74) * 22  + Math.sin(km * 1.1) * 15;

    const grade = i > 0
      ? ((alt - pts[i - 1].alt) / ((KM_TOTAL / (N - 1)) * 1000)) * 100
      : 0;

    // Interpolation lat/lng linéaire le long de ROUTE
    const t    = i / (N - 1);
    const ri   = Math.min(Math.floor(t * (ROUTE.length - 1)), ROUTE.length - 2);
    const frac = t * (ROUTE.length - 1) - ri;
    const lng  = ROUTE[ri][0] + frac * (ROUTE[ri + 1][0] - ROUTE[ri][0]);
    const lat  = ROUTE[ri][1] + frac * (ROUTE[ri + 1][1] - ROUTE[ri][1]);

    // FC simulée : plus haute sur les montées
    const hrBase = 130 + Math.max(0, grade) * 3.5;
    const hr = Math.round(Math.min(182, Math.max(110, hrBase + (Math.random() - 0.5) * 12)));

    const power = Math.round(Math.max(80, Math.min(480,
      200 + grade * 18 + (Math.random() - 0.5) * 40
    )));

    pts.push({
      km:    parseFloat(km.toFixed(1)),
      alt:   Math.round(alt),
      grade: parseFloat(grade.toFixed(1)),
      power,
      hr,
      lat,
      lng
    });
  }
  return pts;
}

const ELEV = buildElevationData();

/* ──────────────────────────────────────────────────────────
   STATE
─────────────────────────────────────────────────────────── */
let miniMap     = null;
let mainMap     = null;
let elevChart   = null;
let routeMarker = null;   // Marker sur la carte synchronisé avec le survol du graphique
let flyInterval = null;   // ID de l'interval pour le survol animé
let flyStep     = 0;
let is3D        = true;
let mapStyle    = "satellite";
let mobileOpen  = false;
let mainMapLoaded = false; // Guard : carte principale entièrement chargée

/* ──────────────────────────────────────────────────────────
   BOOT
─────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  initClock();
  initScrollNav();
  initReveal();
  initHamburger();
  initMiniMap();
  initMainMap();
  initElevationChart();
  initCountUp();
  initTilt();
  initCursorGlow();
  initKeyboard();
});

/* ──────────────────────────────────────────────────────────
   LIVE CLOCK
─────────────────────────────────────────────────────────── */
function initClock() {
  const el = document.getElementById("live-time");
  if (!el) return;

  const tick = () => {
    const d = new Date();
    el.textContent = d.toLocaleTimeString("fr-FR", { hour12: false });
    el.setAttribute("datetime", d.toISOString());
  };

  tick();
  setInterval(tick, 1000);
}

/* ──────────────────────────────────────────────────────────
   SCROLL — NAV ACTIVE STATE
─────────────────────────────────────────────────────────── */
function initScrollNav() {
  const nav   = document.getElementById("main-nav");
  const links = document.querySelectorAll(".nl, .mn-link");
  const ids   = ["hero", "stats", "elevation", "map-section", "segments", "events", "routes"];

  const onScroll = () => {
    nav.classList.toggle("scrolled", window.scrollY > 80);

    let active = "hero";
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 130) active = id;
    }

    links.forEach(a => {
      const s = a.dataset.s || a.getAttribute("href")?.replace("#", "");
      a.classList.toggle("active", s === active);
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ──────────────────────────────────────────────────────────
   HAMBURGER MENU
─────────────────────────────────────────────────────────── */
function initHamburger() {
  const btn    = document.getElementById("hamburger");
  const mobile = document.getElementById("mobile-nav");
  if (!btn || !mobile) return;

  const close = () => {
    mobileOpen = false;
    btn.classList.remove("open");
    mobile.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    mobile.setAttribute("aria-hidden", "true");
  };

  btn.addEventListener("click", () => {
    mobileOpen = !mobileOpen;
    btn.classList.toggle("open", mobileOpen);
    mobile.classList.toggle("open", mobileOpen);
    btn.setAttribute("aria-expanded", String(mobileOpen));
    mobile.setAttribute("aria-hidden", String(!mobileOpen));
  });

  // Fermeture sur clic d'un lien
  mobile.querySelectorAll(".mn-link").forEach(a => {
    a.addEventListener("click", close);
  });

  // Stocker close pour les raccourcis clavier
  window._closeMobileMenu = close;
}

/* ──────────────────────────────────────────────────────────
   INTERSECTION OBSERVER — SCROLL REVEAL
─────────────────────────────────────────────────────────── */
function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const delay = parseInt(entry.target.dataset.delay || 0, 10);
      setTimeout(() => {
        entry.target.classList.add("in");
        animateBarInside(entry.target);
      }, delay);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -32px 0px" });

  document.querySelectorAll("[data-reveal]").forEach(el => io.observe(el));
}

/* ──────────────────────────────────────────────────────────
   ANIMATE BARS — double rAF + force reflow
   Le single rAF était insuffisant : la transition ne se
   déclenchait pas car le moteur n'avait pas encore calculé
   width:0 avant de la modifier. Le force-reflow via
   getBoundingClientRect() garantit que le navigateur a
   bien peint width:0 avant d'appliquer la valeur cible.
─────────────────────────────────────────────────────────── */
function animateBarInside(container) {

  // Stat card bars
  container.querySelectorAll(".scard-fill").forEach(fill => {
    const targetW = (parseInt(fill.dataset.w, 10) || 0) + "%";
    fill.style.width = "0%";
    fill.getBoundingClientRect(); // force reflow
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fill.style.width = targetW;
      });
    });
  });

  // Zone fills
  container.querySelectorAll(".z-fill").forEach(fill => {
    const targetW = (parseInt(fill.dataset.w, 10) || 0) + "%";
    fill.style.width = "0%";
    fill.getBoundingClientRect();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fill.style.width = targetW;
      });
    });
  });

  // MMP fills — height
  container.querySelectorAll(".mmp-fill").forEach(fill => {
    const targetH = (parseInt(fill.dataset.h, 10) || 0) + "%";
    fill.style.height = "0%";
    fill.getBoundingClientRect();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fill.style.height = targetH;
      });
    });
  });
}

/* ──────────────────────────────────────────────────────────
   COUNT-UP — NP VALUE (247 W)
   BUG FIX v3 : l'observer attendait que #np-counter soit
   visible, mais il est INSIDE .np-block[data-reveal] qui
   est opacité:0 → n'est jamais "visible" seul.
   Solution : observer le .np-block parent directement,
   et déclencher le count-up quand il entre en vue.
─────────────────────────────────────────────────────────── */
function initCountUp() {
  const el     = document.getElementById("np-counter");
  const block  = el ? el.closest("[data-reveal]") : null;
  if (!el) return;

  const TARGET   = 247;
  const DURATION = 1600;

  let started = false;

  const runCountUp = () => {
    if (started) return;
    started = true;
    const start = performance.now();

    const tick = (now) => {
      const p = Math.min((now - start) / DURATION, 1);
      // Ease-out cubique
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * TARGET);
      if (p < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  if (block) {
    // Observer le bloc parent qui déclenche la révélation
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        // Petit délai pour laisser la transition d'opacité démarrer
        setTimeout(runCountUp, 200);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });

    io.observe(block);
  } else {
    // Fallback : observer #np-counter directement
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        runCountUp();
        io.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    io.observe(el);
  }
}

/* ──────────────────────────────────────────────────────────
   MINI MAP (HERO)
─────────────────────────────────────────────────────────── */
function initMiniMap() {
  if (typeof mapboxgl === "undefined") return;
  const container = document.getElementById("mini-map");
  if (!container) return;

  mapboxgl.accessToken = MAPBOX_TOKEN;

  miniMap = new mapboxgl.Map({
    container: "mini-map",
    style:      MAP_STYLES.satellite,
    center:     MAP_CENTER,
    zoom:       10.8,
    pitch:      58,
    bearing:    -18,
    interactive: false,
    attributionControl: false,
    logoPosition: "bottom-left"
  });

  miniMap.on("load", () => {
    addTerrain(miniMap);
    addSky(miniMap);
    addRoute(miniMap, "mini");
  });

  miniMap.on("error", e => console.warn("[Mapbox mini-map]", e.error?.message));
}

/* ──────────────────────────────────────────────────────────
   MAIN MAP (3D SECTION)
─────────────────────────────────────────────────────────── */
function initMainMap() {
  if (typeof mapboxgl === "undefined") return;
  const container = document.getElementById("main-map");
  if (!container) return;

  mapboxgl.accessToken = MAPBOX_TOKEN;

  mainMap = new mapboxgl.Map({
    container:   "main-map",
    style:        MAP_STYLES.satellite,
    center:       MAP_CENTER,
    zoom:         11.2,
    pitch:        64,
    bearing:      -28,
    antialias:    true,
    attributionControl: false
  });

  mainMap.on("load", () => {
    mainMapLoaded = true;
    addTerrain(mainMap);
    addSky(mainMap);
    addRoute(mainMap, "main");
    addEndpoints(mainMap);
  });

  // HUD coordonnées au survol
  const hud     = document.getElementById("map-hud");
  const coordEl = document.getElementById("mct-coords");
  const altEl   = document.getElementById("mct-alt");

  mainMap.on("mousemove", (e) => {
    if (!hud) return;
    hud.classList.add("show");
    const { lat, lng } = e.lngLat;
    if (coordEl) coordEl.textContent = `${lat.toFixed(4)}° N  ${lng.toFixed(4)}° E`;
    const near = nearestPoint(lat, lng);
    if (near && altEl) altEl.textContent = `${near.alt} m · km ${near.km}`;
  });

  // BUG FIX v3 : mouseleave sur le container (Mapbox n'expose pas d'event mouseleave)
  container.addEventListener("mouseleave", () => {
    hud?.classList.remove("show");
  });

  mainMap.on("error", e => console.warn("[Mapbox main]", e.error?.message));
}

/* ── Helpers layers ──────────────────────────────────────── */
function addTerrain(map) {
  if (!map.getSource("dem")) {
    map.addSource("dem", {
      type:     "raster-dem",
      url:      "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom:  14
    });
  }
  map.setTerrain({ source: "dem", exaggeration: 2.0 });
}

function addSky(map) {
  if (map.getLayer("sky")) return;
  map.addLayer({
    id:   "sky",
    type: "sky",
    paint: {
      "sky-type":                       "atmosphere",
      "sky-atmosphere-sun":             [0, 90],
      "sky-atmosphere-sun-intensity":   14,
      "sky-atmosphere-color":           "rgba(10, 18, 30, 1)",
      "sky-atmosphere-halo-color": "rgba(190,255,74,0.20)"
    }
  });
}

function addRoute(map, prefix) {
  const srcId  = `${prefix}-src`;
  const glowId = `${prefix}-glow`;
  const lineId = `${prefix}-line`;

  const geojson = {
    type:     "Feature",
    geometry: { type: "LineString", coordinates: ROUTE }
  };

  if (!map.getSource(srcId)) {
    map.addSource(srcId, { type: "geojson", data: geojson });
  }
  if (!map.getLayer(glowId)) {
    map.addLayer({
      id:     glowId,
      type:   "line",
      source: srcId,
      paint: {
        "line-color":   "#BEFF4A",
        "line-width":   14,
        "line-blur":    10,
        "line-opacity": 0.36
      }
    });
  }
  if (!map.getLayer(lineId)) {
    map.addLayer({
      id:     lineId,
      type:   "line",
      source: srcId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color":   "#BEFF4A",
        "line-width":   2.5,
        "line-opacity": 1
      }
    });
  }
}

function addEndpoints(map) {
  new mapboxgl.Marker({ element: makeMarkerEl("DÉPART", "#00E87A") })
    .setLngLat(ROUTE[0])
    .addTo(map);

  new mapboxgl.Marker({ element: makeMarkerEl("2 642 m", "#BEFF4A") })
    .setLngLat(ROUTE[Math.floor(ROUTE.length * 0.72)])
    .addTo(map);
}

function makeMarkerEl(label, color) {
  const el = document.createElement("div");
  el.textContent = label;
  Object.assign(el.style, {
    background:  color,
    color:       "#fff",
    fontFamily:  "'JetBrains Mono', monospace",
    fontSize:    "9px",
    letterSpacing: "0.1em",
    padding:     "4px 9px",
    borderRadius: "3px",
    boxShadow:   `0 3px 14px ${color}66`,
    cursor:      "default",
    whiteSpace:  "nowrap",
    userSelect:  "none"
  });
  return el;
}

function nearestPoint(lat, lng) {
  let best = null;
  let minD = Infinity;
  for (const p of ELEV) {
    const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
    if (d < minD) { minD = d; best = p; }
  }
  return best;
}

/* ──────────────────────────────────────────────────────────
   MAP CONTROLS — globaux (appelés depuis le HTML)
─────────────────────────────────────────────────────────── */
window.toggle3D = function () {
  if (!mainMap) return;
  is3D = !is3D;
  const btn = document.getElementById("btn-3d");
  btn?.classList.toggle("active", is3D);
  btn?.setAttribute("aria-pressed", String(is3D));
  mainMap.easeTo({
    pitch:    is3D ? 64 : 0,
    bearing:  is3D ? -28 : 0,
    duration: 1400,
    easing:   t => 1 - Math.pow(1 - t, 3)
  });
};

window.toggleFlythrough = function () {
  const btn = document.getElementById("btn-fly");
  if (flyInterval) {
    // Stop
    clearInterval(flyInterval);
    flyInterval = null;
    flyStep = 0;
    btn?.classList.remove("active");
    btn?.setAttribute("aria-pressed", "false");
    return;
  }
  // Start
  btn?.classList.add("active");
  btn?.setAttribute("aria-pressed", "true");
  flyStep = 0;

  flyInterval = setInterval(() => {
    if (!mainMap) return;
    if (flyStep >= ROUTE.length) {
      clearInterval(flyInterval);
      flyInterval = null;
      flyStep = 0;
      btn?.classList.remove("active");
      btn?.setAttribute("aria-pressed", "false");
      return;
    }
    mainMap.easeTo({
      center:   ROUTE[flyStep],
      zoom:     13.8,
      pitch:    70,
      bearing:  -28 + flyStep * 2.5,
      duration: 800,
      essential: false
    });
    flyStep++;
  }, 820);
};

window.resetMapView = function () {
  if (!mainMap) return;
  if (flyInterval) {
    clearInterval(flyInterval);
    flyInterval = null;
    flyStep = 0;
    document.getElementById("btn-fly")?.classList.remove("active");
    document.getElementById("btn-fly")?.setAttribute("aria-pressed", "false");
  }
  mainMap.flyTo({
    center:   MAP_CENTER,
    zoom:     11.2,
    pitch:    64,
    bearing:  -28,
    duration: 1800,
    essential: true
  });
};

window.setMapStyle = function (style) {
  // BUG FIX v3 : guard — ne rien faire si le style est déjà actif
  if (!mainMap || style === mapStyle) return;
  mapStyle = style;

  // Mettre à jour les boutons
  document.querySelectorAll(".msb").forEach(b => {
    b.classList.remove("active");
    b.setAttribute("aria-pressed", "false");
  });
  const idMap = { satellite: "style-sat", terrain: "style-ter", dark: "style-drk" };
  const btn = document.getElementById(idMap[style]);
  if (btn) { btn.classList.add("active"); btn.setAttribute("aria-pressed", "true"); }

  mainMapLoaded = false;
  mainMap.setStyle(MAP_STYLES[style]);
  // Rattacher les layers après chargement du nouveau style
  mainMap.once("style.load", () => {
    mainMapLoaded = true;
    addTerrain(mainMap);
    addSky(mainMap);
    addRoute(mainMap, "main");
    addEndpoints(mainMap);
  });
};

window.exportGPX = function () {
  const pts = ELEV.map(p =>
    `    <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">\n      <ele>${p.alt}</ele>\n    </trkpt>`
  ).join("\n");

  // BUG FIX v3 : balise <name> (était <n>, invalide en GPX 1.1)
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RANDONNEUR" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Col du Galibier — Sortie 247</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>Col du Galibier</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const a = Object.assign(document.createElement("a"), {
    href:     URL.createObjectURL(blob),
    download: "randonneur-galibier.gpx"
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
};

/* ──────────────────────────────────────────────────────────
   ELEVATION CHART (Chart.js)
─────────────────────────────────────────────────────────── */
function initElevationChart() {
  const canvas = document.getElementById("elevation-chart");
  if (!canvas || typeof Chart === "undefined") return;

  const ctx = canvas.getContext("2d");

  const altGrad = ctx.createLinearGradient(0, 0, 0, 270);
  altGrad.addColorStop(0,   "rgba(190,255,74,0.42)");
  altGrad.addColorStop(0.5, "rgba(46,91,255,0.12)");
  altGrad.addColorStop(1,   "rgba(13,15,18,0.0)");

  const pwrGrad = ctx.createLinearGradient(0, 0, 0, 270);
  pwrGrad.addColorStop(0, "rgba(46,91,255,0.38)");
  pwrGrad.addColorStop(1, "rgba(46,91,255,0.0)");

  const labels = ELEV.map(p => p.km);
  const alts   = ELEV.map(p => p.alt);
  const pwrs   = ELEV.map(p => p.power);

  // Plugin custom : synchro HUD + marker carte
  const syncPlugin = {
    id: "randonneur-sync",
    afterEvent(chart, args) {
      const type = args.event.type;
      if (type !== "mousemove" && type !== "mouseout") return;
      if (type === "mouseout") { hideElevHUD(); return; }

      const elements = chart.getElementsAtEventForMode(
        args.event.native, "index", { intersect: false }, false
      );
      if (!elements.length) return;

      const idx = elements[0].index;
      showElevHUD(idx);
      syncMarker(idx);
    }
  };

  elevChart = new Chart(ctx, {
    type: "line",
    plugins: [syncPlugin],
    data: {
      labels,
      datasets: [
        {
          label: "Altitude (m)",
          data: alts,
          borderColor: "#BEFF4A",
          borderWidth: 2,
          backgroundColor: altGrad,
          fill: true,
          tension: 0.38,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: "#BEFF4A",
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2,
          yAxisID: "yAlt"
        },
        {
          label: "Puissance (W)",
          data: pwrs,
          borderColor: "rgba(46,91,255,0.65)",
          borderWidth: 1.5,
          backgroundColor: pwrGrad,
          fill: true,
          tension: 0.38,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: "#2E5BFF",
          yAxisID: "yPwr"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend:  { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: {
          type: "linear",
          grid:  { color: "rgba(255,255,255,0.04)" },
          border: { display: false },
          ticks: {
            color: "rgba(237,237,234,0.28)",
            font:  { family: "'JetBrains Mono'", size: 10 },
            maxTicksLimit: 12,
            callback: v => `${v} km`
          }
        },
        yAlt: {
          position: "left",
          grid:  { color: "rgba(255,255,255,0.04)" },
          border: { display: false },
          ticks: {
            color: "rgba(237,237,234,0.28)",
            font:  { family: "'JetBrains Mono'", size: 10 },
            maxTicksLimit: 6,
            callback: v => `${v} m`
          }
        },
        yPwr: {
          position: "right",
          grid:  { display: false },
          border: { display: false },
          ticks: {
            color: "rgba(46,91,255,0.5)",
            font:  { family: "'JetBrains Mono'", size: 10 },
            maxTicksLimit: 4,
            callback: v => `${v} W`
          }
        }
      },
      animation: { duration: 1600, easing: "easeOutQuart" }
    }
  });
}

function showElevHUD(idx) {
  const p = ELEV[idx];
  if (!p) return;

  document.getElementById("elev-hud")?.classList.add("visible");
  const km  = document.getElementById("elev-km");
  const alt = document.getElementById("elev-alt");
  const gr  = document.getElementById("elev-grade");
  const pw  = document.getElementById("elev-power");
  const hr  = document.getElementById("elev-hr");

  if (km)  km.textContent  = `${p.km} km`;
  if (alt) alt.textContent = `${p.alt} m`;
  if (gr)  gr.textContent  = `${p.grade > 0 ? "+" : ""}${p.grade} %`;
  if (pw)  pw.textContent  = `${p.power} W`;
  if (hr)  hr.textContent  = `${p.hr} bpm`;
}

function hideElevHUD() {
  document.getElementById("elev-hud")?.classList.remove("visible");
}

/* Synchro marker carte — pas de camera panning */
function syncMarker(idx) {
  // BUG FIX v3 : guard — ne rien faire si la carte n'est pas encore chargée
  if (!mainMap || !mainMapLoaded) return;

  const p = ELEV[idx];
  if (!p) return;

  if (routeMarker) {
    routeMarker.setLngLat([p.lng, p.lat]);
  } else {
    const el = document.createElement("div");
    Object.assign(el.style, {
      width:        "12px",
      height:       "12px",
      background:   "#BEFF4A",
      border:       "2px solid #fff",
      borderRadius: "50%",
      boxShadow:    "0 0 14px rgba(190,255,74,.85)",
      transition:   "all 0.15s ease",
      pointerEvents: "none"
    });
    routeMarker = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat([p.lng, p.lat])
      .addTo(mainMap);
  }
}

/* ──────────────────────────────────────────────────────────
   3D TILT on stat cards (desktop only)
─────────────────────────────────────────────────────────── */
function initTilt() {
  // Ne pas activer sur tactile
  if (window.matchMedia("(hover: none)").matches) return;

  document.querySelectorAll(".scard").forEach(card => {
    card.addEventListener("mousemove", e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left)  / r.width  - 0.5;
      const y = (e.clientY - r.top)   / r.height - 0.5;
      card.style.transition = "transform 0.08s ease, box-shadow 0.35s ease, background 0.35s ease, border-color 0.35s ease";
      card.style.transform  = `translateY(-3px) perspective(600px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transition = "transform 0.65s cubic-bezier(0.2,1,0.3,1), box-shadow 0.35s ease, background 0.35s ease, border-color 0.35s ease";
      card.style.transform  = "";
    });
  });
}

/* ──────────────────────────────────────────────────────────
   CURSEUR GLOW (desktop)
─────────────────────────────────────────────────────────── */
function initCursorGlow() {
  // Uniquement sur périphériques avec souris
  if (window.matchMedia("(hover: none)").matches) return;

  const glow = document.getElementById("cursor-glow");
  if (!glow) return;

  let mouseX = -999;
  let mouseY = -999;
  let currentX = -999;
  let currentY = -999;
  let rafId;

  const lerp = (a, b, t) => a + (b - a) * t;

  const animate = () => {
    currentX = lerp(currentX, mouseX, 0.08);
    currentY = lerp(currentY, mouseY, 0.08);
    glow.style.left = `${currentX}px`;
    glow.style.top  = `${currentY}px`;
    rafId = requestAnimationFrame(animate);
  };

  window.addEventListener("mousemove", e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    glow.style.opacity = "1";
  }, { passive: true });

  document.addEventListener("mouseleave", () => {
    glow.style.opacity = "0";
  });

  rafId = requestAnimationFrame(animate);
  // Nettoyage si jamais la page est déchargée
  window.addEventListener("pagehide", () => cancelAnimationFrame(rafId));
}

/* ──────────────────────────────────────────────────────────
   SCROLL HELPER
─────────────────────────────────────────────────────────── */
window.scrollToSection = function (id) {
  const el  = document.getElementById(id);
  const nav = document.getElementById("main-nav");
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY
            - (nav?.offsetHeight ?? 72) - 24;
  window.scrollTo({ top, behavior: "smooth" });
};

/* ──────────────────────────────────────────────────────────
   SUBTLE HERO PARALLAX
─────────────────────────────────────────────────────────── */
window.addEventListener("scroll", () => {
  const left = document.querySelector(".hero-left");
  if (!left) return;
  const y = window.scrollY;
  if (y < window.innerHeight) {
    left.style.transform = `translateY(${y * 0.07}px)`;
  }
}, { passive: true });

/* ──────────────────────────────────────────────────────────
   KEYBOARD SHORTCUTS
─────────────────────────────────────────────────────────── */
function initKeyboard() {
  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    switch (e.key) {
      case "3":
        window.toggle3D();
        break;
      case "f":
      case "F":
        window.toggleFlythrough();
        break;
      case "r":
      case "R":
        window.resetMapView();
        break;
      case "Escape":
        // BUG FIX v3 : Escape ferme aussi le menu mobile
        if (flyInterval) window.toggleFlythrough();
        if (mobileOpen && window._closeMobileMenu) window._closeMobileMenu();
        break;
    }
  });
}

/* ──────────────────────────────────────────────────────────
   CONSOLE SIGNATURE
─────────────────────────────────────────────────────────── */
console.log(
  "%cRANDONNEUR%c  v3.0 Pro\n%cMapbox GL JS v3  ·  Chart.js 4  ·  Col du Galibier 2642m",
  "background:#BEFF4A;color:#08090D;font-family:'Bebas Neue',sans-serif;font-size:16px;font-weight:700;letter-spacing:.18em;padding:6px 14px;",
  "color:rgba(237,237,234,.6);font-size:12px;font-weight:400;",
  "color:rgba(237,237,234,.3);font-size:10px;"
);