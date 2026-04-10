/* ═══════════════════════════════════════════════════════════
   C.C. SAROUEL  v8.0 — Corrections complètes
   ═══════════════════════════════════════════════════════════ */
"use strict";

/* ──────────────────────────────────────────────────────────
   DONNÉES DES SORTIES — tracés GPX réalistes par sortie
─────────────────────────────────────────────────────────── */
const RIDES = {
  "arenberg": {
    title: "Secteurs d'Arenberg",
    center: [50.435, 3.248], zoom: 11, finish_label: "Roubaix",
    route: [[49.415,2.830],[49.682,2.940],[49.980,3.040],[50.105,3.120],[50.220,3.180],[50.300,3.200],[50.355,3.210],[50.395,3.228],[50.415,3.238],[50.428,3.245],[50.435,3.248],[50.448,3.258],[50.465,3.272],[50.490,3.295],[50.512,3.310],[50.535,3.295],[50.558,3.270],[50.578,3.255],[50.598,3.230],[50.615,3.205],[50.630,3.180],[50.648,3.158],[50.658,3.140],[50.668,3.118],[50.675,3.095],[50.685,3.072],[50.692,3.048],[50.694,3.018]],
    pois: [{lat:49.415,lng:2.830,label:"DÉPART",type:"start",detail:"Compiègne · km 0"},{lat:50.435,lng:3.248,label:"Trouée d'Arenberg",type:"summit",detail:"★★★★★ · 2,4 km · km 98"},{lat:50.675,lng:3.095,label:"Carrefour de l'Arbre",type:"sprint",detail:"★★★★★ · 1,6 km · km 157"},{lat:50.694,lng:3.018,label:"VÉLODROME",type:"finish",detail:"Roubaix · km 172"}]
  },
  "flandres": {
    title: "Tour des Monts des Flandres",
    center: [50.750, 2.900], zoom: 11, finish_label: "Roubaix",
    route: [[50.640,3.050],[50.660,2.990],[50.692,2.942],[50.720,2.902],[50.748,2.870],[50.768,2.845],[50.788,2.830],[50.812,2.812],[50.835,2.800],[50.848,2.823],[50.825,2.858],[50.800,2.890],[50.775,2.910],[50.750,2.940],[50.720,2.968],[50.695,2.995],[50.672,3.018],[50.655,3.035],[50.640,3.050]],
    pois: [{lat:50.640,lng:3.050,label:"ROUBAIX",type:"start",detail:"Départ · km 0"},{lat:50.788,lng:2.830,label:"Mont Kemmel",type:"summit",detail:"156 m · km 45"},{lat:50.848,lng:2.823,label:"Mont Cassel",type:"summit",detail:"176 m · km 72"},{lat:50.640,lng:3.050,label:"ARRIVÉE",type:"finish",detail:"Roubaix · km 112"}]
  },
  "avesnois": {
    title: "Cyclo de l'Avesnois",
    center: [50.200, 3.920], zoom: 12, finish_label: "Avesnes",
    route: [[50.120,3.850],[50.142,3.870],[50.162,3.895],[50.178,3.920],[50.195,3.942],[50.215,3.960],[50.232,3.975],[50.248,3.988],[50.262,3.998],[50.278,3.985],[50.260,3.968],[50.242,3.950],[50.228,3.932],[50.208,3.912],[50.188,3.892],[50.168,3.875],[50.148,3.860],[50.120,3.850]],
    pois: [{lat:50.120,lng:3.850,label:"AVESNES",type:"start",detail:"Départ · km 0"},{lat:50.262,lng:3.998,label:"Sars-Poteries",type:"summit",detail:"200 m · km 38"},{lat:50.120,lng:3.850,label:"ARRIVÉE",type:"finish",detail:"Avesnes · km 68"}]
  },
  "valenciennes": {
    title: "Valenciennes — Amiens — Boulogne",
    center: [50.200, 2.800], zoom: 9, finish_label: "Boulogne",
    route: [[50.358,3.523],[50.310,3.380],[50.260,3.220],[50.210,3.050],[50.150,2.880],[50.090,2.720],[49.980,2.580],[49.920,2.480],[50.020,2.280],[50.130,1.980],[50.320,1.840],[50.425,1.610],[50.728,1.618]],
    pois: [{lat:50.358,lng:3.523,label:"VALENCIENNES",type:"start",detail:"Départ · km 0"},{lat:49.895,lng:2.302,label:"Amiens",type:"col",detail:"Passage · km 62"},{lat:50.728,lng:1.618,label:"BOULOGNE",type:"finish",detail:"Arrivée · km 104"}]
  },
  "scarpe": {
    title: "La Scarpe — Douai Gravel",
    center: [50.410, 3.020], zoom: 12, finish_label: "Douai",
    route: [[50.372,3.081],[50.380,3.060],[50.395,3.042],[50.412,3.028],[50.428,3.012],[50.440,2.995],[50.455,2.978],[50.462,2.958],[50.455,2.938],[50.440,2.920],[50.422,2.908],[50.405,2.918],[50.388,2.935],[50.372,2.952],[50.358,2.968],[50.345,2.988],[50.358,3.018],[50.365,3.048],[50.372,3.081]],
    pois: [{lat:50.372,lng:3.081,label:"DOUAI",type:"start",detail:"Départ · km 0"},{lat:50.462,lng:2.958,label:"Forêt Scarpe",type:"summit",detail:"Gravel · km 35"},{lat:50.372,lng:3.081,label:"ARRIVÉE",type:"finish",detail:"Douai · km 76"}]
  },
  "roubaix-recup": {
    title: "Sortie Roubaix — Récupération",
    center: [50.685, 3.090], zoom: 13, finish_label: "Roubaix",
    route: [[50.694,3.018],[50.702,3.038],[50.712,3.058],[50.718,3.080],[50.722,3.102],[50.716,3.122],[50.705,3.138],[50.692,3.148],[50.678,3.152],[50.664,3.142],[50.652,3.128],[50.648,3.108],[50.652,3.088],[50.662,3.068],[50.675,3.052],[50.688,3.040],[50.694,3.018]],
    pois: [{lat:50.694,lng:3.018,label:"ROUBAIX",type:"start",detail:"Départ · km 0"},{lat:50.722,lng:3.102,label:"Hem",type:"col",detail:"km 12"},{lat:50.694,lng:3.018,label:"ARRIVÉE",type:"finish",detail:"Roubaix · km 48"}]
  },
  "dunkerque": {
    title: "Dunkerque — Côte d'Opale",
    center: [50.880, 2.180], zoom: 10, finish_label: "Calais",
    route: [[51.035,2.378],[51.012,2.340],[50.985,2.290],[50.958,2.242],[50.930,2.195],[50.902,2.168],[50.878,2.148],[50.850,2.128],[50.825,2.110],[50.800,2.098],[50.778,2.082],[50.750,2.068],[50.728,2.058],[50.722,2.082],[50.718,2.108],[50.715,2.135],[50.720,2.162],[50.725,2.190],[50.728,2.218]],
    pois: [{lat:51.035,lng:2.378,label:"DUNKERQUE",type:"start",detail:"Départ · km 0"},{lat:50.870,lng:2.142,label:"Côte d'Opale",type:"summit",detail:"Falaises · km 65"},{lat:50.728,lng:2.218,label:"CALAIS",type:"finish",detail:"Arrivée · km 132"}]
  },
  "lille-bethune": {
    title: "Lille — La Bassée — Béthune",
    center: [50.545, 2.870], zoom: 11, finish_label: "Béthune",
    route: [[50.628,3.058],[50.612,3.022],[50.592,2.990],[50.568,2.960],[50.548,2.928],[50.528,2.900],[50.508,2.872],[50.492,2.848],[50.478,2.820],[50.462,2.798],[50.448,2.778],[50.438,2.758],[50.430,2.742],[50.435,2.722],[50.442,2.702],[50.452,2.688],[50.462,2.672]],
    pois: [{lat:50.628,lng:3.058,label:"LILLE",type:"start",detail:"Départ · km 0"},{lat:50.492,lng:2.848,label:"La Bassée",type:"col",detail:"km 48"},{lat:50.462,lng:2.672,label:"BÉTHUNE",type:"finish",detail:"Arrivée · km 94"}]
  },
  "trilogie": {
    title: "Trilogie — Arenberg, Wallers, Carrefour",
    center: [50.580, 3.180], zoom: 10, finish_label: "Cassel",
    route: [[50.358,3.523],[50.395,3.450],[50.415,3.380],[50.428,3.290],[50.435,3.248],[50.448,3.258],[50.490,3.295],[50.535,3.295],[50.558,3.270],[50.598,3.230],[50.648,3.158],[50.675,3.095],[50.694,3.018],[50.715,2.970],[50.748,2.910],[50.788,2.840],[50.835,2.800]],
    pois: [{lat:50.358,lng:3.523,label:"VALENCIENNES",type:"start",detail:"Départ · km 0"},{lat:50.435,lng:3.248,label:"Trouée d'Arenberg",type:"summit",detail:"★★★★★ · km 52"},{lat:50.675,lng:3.095,label:"Carrefour de l'Arbre",type:"sprint",detail:"★★★★★ · km 128"},{lat:50.835,lng:2.800,label:"CASSEL",type:"finish",detail:"Arrivée · km 187"}]
  },
  "plaine-flamande": {
    title: "Plaine Flamande — Endurance",
    center: [50.740, 2.870], zoom: 11, finish_label: "Roubaix",
    route: [[50.694,3.018],[50.718,2.988],[50.742,2.958],[50.765,2.928],[50.788,2.898],[50.808,2.862],[50.820,2.828],[50.812,2.792],[50.795,2.762],[50.772,2.738],[50.748,2.720],[50.725,2.710],[50.700,2.718],[50.678,2.732],[50.660,2.758],[50.650,2.790],[50.658,2.828],[50.672,2.868],[50.685,2.908],[50.692,2.958],[50.694,3.018]],
    pois: [{lat:50.694,lng:3.018,label:"ROUBAIX",type:"start",detail:"Départ · km 0"},{lat:50.820,lng:2.828,label:"Hondschoote",type:"col",detail:"Plaine · km 48"},{lat:50.694,lng:3.018,label:"ARRIVÉE",type:"finish",detail:"Roubaix · km 96"}]
  }
};

/* ──────────────────────────────────────────────────────────
   ÉLÉVATION SIMULÉE PAR SORTIE
─────────────────────────────────────────────────────────── */
const PROFILES = {
  "arenberg":       {N:88, km:172.0, baseAlt:38, maxAlt:120, style:"flat"},
  "flandres":       {N:60, km:112.0, baseAlt:40, maxAlt:180, style:"hilly"},
  "avesnois":       {N:40, km:68.0,  baseAlt:80, maxAlt:210, style:"hilly"},
  "valenciennes":   {N:56, km:104.0, baseAlt:20, maxAlt:80,  style:"flat"},
  "scarpe":         {N:44, km:76.0,  baseAlt:22, maxAlt:90,  style:"flat"},
  "roubaix-recup":  {N:30, km:48.0,  baseAlt:25, maxAlt:60,  style:"flat"},
  "dunkerque":      {N:72, km:132.0, baseAlt:10, maxAlt:100, style:"coastal"},
  "lille-bethune":  {N:52, km:94.0,  baseAlt:30, maxAlt:120, style:"flat"},
  "trilogie":       {N:96, km:187.0, baseAlt:38, maxAlt:180, style:"mixed"},
  "plaine-flamande":{N:56, km:96.0,  baseAlt:18, maxAlt:60,  style:"flat"}
};

function buildElevationData(rideKey) {
  const ride = RIDES[rideKey] || RIDES["arenberg"];
  const route = ride.route;
  const p = PROFILES[rideKey] || PROFILES["arenberg"];
  const pts = [];
  for (let i = 0; i < p.N; i++) {
    const km = (i / (p.N - 1)) * p.km;
    const t = i / (p.N - 1);
    let alt;
    if (p.style === "hilly") {
      alt = p.baseAlt + Math.sin(t * Math.PI * 3) * (p.maxAlt - p.baseAlt) * 0.6 + Math.sin(t * Math.PI * 7 + 0.5) * (p.maxAlt - p.baseAlt) * 0.3;
    } else if (p.style === "coastal") {
      alt = p.baseAlt + 5 + Math.sin(t * Math.PI * 2) * 30 + Math.sin(t * Math.PI * 5) * 20;
    } else if (p.style === "mixed") {
      alt = p.baseAlt + Math.sin(t * Math.PI * 4) * 40 + Math.sin(t * Math.PI * 8) * 25 + (t > 0.5 ? Math.sin((t - 0.5) * Math.PI * 6) * 60 : 0);
    } else {
      alt = p.baseAlt + Math.sin(t * Math.PI * 5) * 15 + Math.sin(t * Math.PI * 2) * 10;
    }
    alt = Math.max(p.baseAlt - 5, Math.min(p.maxAlt, alt));
    const grade = i > 0 ? ((alt - pts[i - 1].alt) / ((p.km / (p.N - 1)) * 1000)) * 100 : 0;
    const ri = Math.min(Math.floor(t * (route.length - 1)), route.length - 2);
    const frac = t * (route.length - 1) - ri;
    const lat = route[ri][0] + frac * (route[ri + 1][0] - route[ri][0]);
    const lng = route[ri][1] + frac * (route[ri + 1][1] - route[ri][1]);
    const hr = Math.round(Math.min(182, Math.max(110, 130 + Math.max(0, grade) * 3.5 + (Math.random() - 0.5) * 12)));
    const power = Math.round(Math.max(80, Math.min(480, 200 + grade * 18 + (Math.random() - 0.5) * 40)));
    pts.push({km: parseFloat(km.toFixed(1)), alt: Math.round(alt), grade: parseFloat(grade.toFixed(1)), power, hr, lat, lng});
  }
  return pts;
}

/* ──────────────────────────────────────────────────────────
   DÉTECTION SORTIE ACTIVE (URL ?ride=xxx ou data-ride sur body)
─────────────────────────────────────────────────────────── */
function getCurrentRideKey() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("ride");
  if (fromUrl && RIDES[fromUrl]) return fromUrl;
  const bodyKey = document.body.dataset.ride;
  if (bodyKey && RIDES[bodyKey]) return bodyKey;
  return "arenberg";
}

const CURRENT_RIDE_KEY = getCurrentRideKey();
const CURRENT_RIDE = RIDES[CURRENT_RIDE_KEY];
const MAP_CENTER = CURRENT_RIDE.center;
const ROUTE_LATLNG = CURRENT_RIDE.route;
const POIS = CURRENT_RIDE.pois;
const ELEV = buildElevationData(CURRENT_RIDE_KEY);

const TILE_LAYERS = {
  osm:       {url:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", options:{maxZoom:18, attribution:"© OpenStreetMap"}},
  topo:      {url:"https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",   options:{maxZoom:17, attribution:"© OpenTopoMap"}},
  satellite: {url:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", options:{maxZoom:18, attribution:"© Esri"}}
};

/* ── STATE ── */
let miniMap=null, mainMap=null, mainTileLayer=null, routePolyline=null;
let markersGroup=null, syncMarkerLeaflet=null, elevChart=null;
let mobileOpen=false, routeVisible=true, markersVisible=true, currentTile="osm";

/* ──────────────────────────────────────────────────────────
   BOOT
─────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initClock();
  initScrollNav();
  initReveal();
  initHamburger();
  initTilt();
  initKeyboard();
  if (document.getElementById("mini-map"))        initMiniMap();
  if (document.getElementById("main-map"))        initMainMap();
  if (document.getElementById("elevation-chart")) initElevationChart();
  if (document.getElementById("fitness-chart"))   initFitnessChart();
  if (document.getElementById("filter-chips"))    initFilterChips();
});

/* ──────────────────────────────────────────────────────────
   NAV
─────────────────────────────────────────────────────────── */
function initNav() {
  const filename = (window.location.pathname.split("/").pop() || "index.html").split("?")[0];
  document.querySelectorAll(".nl, .mn-link").forEach(a => {
    const page = (a.getAttribute("href") || "").split("/").pop().split("?")[0];
    const active = page === filename || (page === "index.html" && (filename === "" || filename === "index.html"));
    a.classList.toggle("active", active);
  });
}

function initClock() {
  const el = document.getElementById("live-time");
  if (!el) return;
  const tick = () => { const d = new Date(); el.textContent = d.toLocaleTimeString("fr-FR", {hour12:false}); el.setAttribute("datetime", d.toISOString()); };
  tick(); setInterval(tick, 1000);
}

function initScrollNav() {
  const nav = document.getElementById("main-nav");
  if (!nav) return;
  const fn = () => nav.classList.toggle("scrolled", window.scrollY > 80);
  window.addEventListener("scroll", fn, {passive:true}); fn();
}

function initHamburger() {
  const btn = document.getElementById("hamburger");
  const mob = document.getElementById("mobile-nav");
  if (!btn || !mob) return;
  const close = () => { mobileOpen=false; btn.classList.remove("open"); mob.classList.remove("open"); btn.setAttribute("aria-expanded","false"); mob.setAttribute("aria-hidden","true"); };
  btn.addEventListener("click", () => { mobileOpen=!mobileOpen; btn.classList.toggle("open",mobileOpen); mob.classList.toggle("open",mobileOpen); btn.setAttribute("aria-expanded",String(mobileOpen)); mob.setAttribute("aria-hidden",String(!mobileOpen)); });
  mob.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
  window._closeMobileMenu = close;
}

function initReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      setTimeout(() => { e.target.classList.add("in"); animateBars(e.target); }, parseInt(e.target.dataset.delay||0,10));
      io.unobserve(e.target);
    });
  }, {threshold:0.08, rootMargin:"0px 0px -24px 0px"});
  document.querySelectorAll("[data-reveal]").forEach(el => io.observe(el));
}

function animateBars(container) {
  container.querySelectorAll(".scard-fill, .z-fill, .ev-full-fill").forEach(fill => {
    const w = fill.dataset.w || "0";
    fill.style.width = "0%"; fill.getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = w + "%"; }));
  });
}

/* ──────────────────────────────────────────────────────────
   FILTRES — fonctionnels avec data-* sur les éléments
─────────────────────────────────────────────────────────── */
function initFilterChips() {
  const activeFilters = {};
  // Lire état initial
  document.querySelectorAll(".filter-chip.active[data-group]").forEach(chip => {
    activeFilters[chip.dataset.group] = chip.textContent.trim();
  });
  document.querySelectorAll(".filter-chip[data-group]").forEach(chip => {
    chip.addEventListener("click", () => {
      const g = chip.dataset.group;
      document.querySelectorAll(`.filter-chip[data-group="${g}"]`).forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilters[g] = chip.textContent.trim();
      applyFilters(activeFilters);
    });
  });
}

const NEUTRAL_VALUES = ["tous","toutes","2025","all"];

function matchesFilter(dataAttr, filterValue) {
  if (!dataAttr) return true; // pas d'attribut = toujours visible
  const v = filterValue.replace(/\s*🥇\s*/g,"").trim().toLowerCase();
  if (NEUTRAL_VALUES.includes(v)) return true;
  const values = dataAttr.toLowerCase().split(",").map(s => s.trim());
  return values.some(a => a.includes(v) || v.includes(a));
}

function applyFilters(filters) {
  // --- Sorties ---
  document.querySelectorAll(".sortie-row").forEach(row => {
    if (!row.dataset.type && !row.dataset.period && !row.dataset.intensity) return;
    let vis = true;
    for (const [g, v] of Object.entries(filters)) {
      if (!matchesFilter(row.dataset[g], v)) { vis = false; break; }
    }
    row.style.display = vis ? "" : "none";
  });

  // --- Parcours cards ---
  document.querySelectorAll(".ra-card").forEach(card => {
    if (!card.dataset.type && !card.dataset.level) return;
    let vis = true;
    for (const [g, v] of Object.entries(filters)) {
      if (!matchesFilter(card.dataset[g], v)) { vis = false; break; }
    }
    card.style.display = vis ? "" : "none";
  });
  // Masquer les stacks entièrement vides
  document.querySelectorAll(".ra-stack").forEach(stack => {
    const allHidden = Array.from(stack.querySelectorAll(".ra-card")).every(c => c.style.display === "none");
    stack.style.display = allHidden ? "none" : "";
  });
  // Masquer les routes-grid entièrement vides
  document.querySelectorAll(".routes-grid").forEach(grid => {
    const allHidden = Array.from(grid.children).every(c => c.style.display === "none");
    grid.style.display = allHidden ? "none" : "";
  });

  // --- Segments ---
  document.querySelectorAll(".seg-row").forEach(row => {
    if (!row.dataset.seg && !row.dataset.zone) return;
    let vis = true;
    for (const [g, v] of Object.entries(filters)) {
      const key = g === "seg" ? "seg" : g === "zone" ? "zone" : g;
      if (!matchesFilter(row.dataset[key], v)) { vis = false; break; }
    }
    row.style.display = vis ? "" : "none";
  });
}

/* ──────────────────────────────────────────────────────────
   MINI MAP — tracé unique à la sortie courante
─────────────────────────────────────────────────────────── */
function initMiniMap() {
  if (typeof L === "undefined") return;
  const container = document.getElementById("mini-map");
  if (!container) return;
  miniMap = L.map("mini-map", {center:MAP_CENTER, zoom:CURRENT_RIDE.zoom, zoomControl:false, scrollWheelZoom:false, dragging:false, touchZoom:false, doubleClickZoom:false, keyboard:false, attributionControl:false});
  L.tileLayer(TILE_LAYERS.topo.url, TILE_LAYERS.topo.options).addTo(miniMap);
  const poly = L.polyline(ROUTE_LATLNG, {color:"#D4291A", weight:2.5, opacity:0.9, lineJoin:"round", lineCap:"round"}).addTo(miniMap);
  miniMap.fitBounds(poly.getBounds(), {padding:[14,14]});
  // Départ (vert) + Arrivée (rouge) avec vrais labels
  const startPoi = POIS.find(p => p.type === "start");
  const finishPoi = POIS.find(p => p.type === "finish") || POIS[POIS.length - 1];
  if (startPoi) addMarker(miniMap, [startPoi.lat, startPoi.lng], "DÉPART", "#2E7D4F");
  if (finishPoi) addMarker(miniMap, [finishPoi.lat, finishPoi.lng], CURRENT_RIDE.finish_label || "ARRIVÉE", "#D4291A");
}

/* ──────────────────────────────────────────────────────────
   MAIN MAP — tracé + secteurs visibles par défaut
─────────────────────────────────────────────────────────── */
function initMainMap() {
  if (typeof L === "undefined") return;
  const container = document.getElementById("main-map");
  if (!container) return;
  mainMap = L.map("main-map", {center:MAP_CENTER, zoom:CURRENT_RIDE.zoom, zoomControl:true, scrollWheelZoom:true, attributionControl:false});
  mainMap.zoomControl.setPosition("bottomright");
  mainTileLayer = L.tileLayer(TILE_LAYERS.osm.url, TILE_LAYERS.osm.options).addTo(mainMap);
  L.polyline(ROUTE_LATLNG, {color:"#D4291A", weight:12, opacity:0.08}).addTo(mainMap);
  routePolyline = L.polyline(ROUTE_LATLNG, {color:"#D4291A", weight:2.5, opacity:0.95, lineJoin:"round", lineCap:"round"}).addTo(mainMap);
  mainMap.fitBounds(routePolyline.getBounds(), {padding:[40,40]});

  // POIs
  markersGroup = L.layerGroup();
  POIS.forEach(poi => {
    const color = (poi.type==="summit"||poi.type==="start"||poi.type==="finish") ? "#D4291A" : "#2B5FBF";
    const icon = createCustomIcon(poi.label, color, poi.type==="summit"||poi.type==="start"||poi.type==="finish");
    const marker = L.marker([poi.lat, poi.lng], {icon});
    marker.bindPopup(`<div style="padding:12px 14px;min-width:160px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:rgba(240,237,230,.35);margin-bottom:6px;">${poi.type}</div><div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:#F0EDE6;line-height:1;margin-bottom:4px;">${poi.label}</div>${poi.detail?`<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:rgba(240,237,230,.38);margin-top:4px;">${poi.detail}</div>`:""}</div>`, {closeButton:false, maxWidth:220});
    marker.addTo(markersGroup);
  });
  markersGroup.addTo(mainMap); // visible par défaut ✓

  // Sync btn Secteurs → actif par défaut
  const btnM = document.getElementById("btn-markers");
  if (btnM) { btnM.classList.add("active"); btnM.setAttribute("aria-pressed","true"); }

  // Marqueur synchro élévation
  const syncIcon = L.divIcon({html:`<div style="width:10px;height:10px;background:#D4291A;border:2px solid rgba(240,237,230,.9);border-radius:50%;box-shadow:0 0 12px rgba(212,41,26,.85);pointer-events:none;"></div>`, className:"", iconSize:[10,10], iconAnchor:[5,5]});
  syncMarkerLeaflet = L.marker(ROUTE_LATLNG[0], {icon:syncIcon, interactive:false, zIndexOffset:1000});

  mainMap.on("click", e => {
    const near = nearestPoint(e.latlng.lat, e.latlng.lng);
    if (near) L.popup().setLatLng([near.lat,near.lng]).setContent(`<div style="padding:10px 13px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#D4291A;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px;">Position sur tracé</div><div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(240,237,230,.7);">km ${near.km} · ${near.alt} m · ${near.grade>0?"+":""}${near.grade} %</div></div>`).openOn(mainMap);
  });
}

function createCustomIcon(label, color, large=false) {
  const s = large ? 10 : 7;
  return L.divIcon({html:`<div style="position:relative;"><div style="width:${s}px;height:${s}px;background:${color};border-radius:50%;border:2px solid rgba(240,237,230,.7);box-shadow:0 2px 8px ${color}88;"></div><div style="position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);background:rgba(13,13,16,.92);border:1px solid rgba(255,255,255,.1);font-family:'IBM Plex Mono',monospace;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:rgba(240,237,230,.8);padding:2px 6px;border-radius:2px;white-space:nowrap;">${label}</div></div>`, className:"", iconSize:[s,s], iconAnchor:[s/2,s/2]});
}

function addMarker(map, latlng, label, color) {
  L.marker(latlng, {icon:createCustomIcon(label,color,true), interactive:false}).addTo(map);
}

function nearestPoint(lat, lng) {
  let best=null, minD=Infinity;
  for (const p of ELEV) { const d=(p.lat-lat)**2+(p.lng-lng)**2; if(d<minD){minD=d;best=p;} }
  return best;
}

window.toggleRouteLayer = function() {
  if(!mainMap) return; routeVisible=!routeVisible;
  const btn=document.getElementById("btn-route"); btn?.classList.toggle("active",routeVisible); btn?.setAttribute("aria-pressed",String(routeVisible));
  if(routePolyline){routeVisible?routePolyline.addTo(mainMap):mainMap.removeLayer(routePolyline);}
};

window.toggleMarkersLayer = function() {
  if(!mainMap) return; markersVisible=!markersVisible;
  const btn=document.getElementById("btn-markers"); btn?.classList.toggle("active",markersVisible); btn?.setAttribute("aria-pressed",String(markersVisible));
  if(markersGroup){markersVisible?markersGroup.addTo(mainMap):mainMap.removeLayer(markersGroup);}
};

window.setTileLayer = function(style) {
  if(!mainMap||style===currentTile) return; currentTile=style;
  ["btn-osm","btn-topo","btn-satellite"].forEach(id=>{const b=document.getElementById(id);if(b){b.classList.remove("active");b.setAttribute("aria-pressed","false");}});
  const btn=document.getElementById({osm:"btn-osm",topo:"btn-topo",satellite:"btn-satellite"}[style]);
  if(btn){btn.classList.add("active");btn.setAttribute("aria-pressed","true");}
  if(mainTileLayer) mainMap.removeLayer(mainTileLayer);
  const {url,options}=TILE_LAYERS[style]||TILE_LAYERS.osm;
  mainTileLayer=L.tileLayer(url,options).addTo(mainMap);
};

window.resetMapView = function() {
  if(!mainMap||!routePolyline) return;
  mainMap.fitBounds(routePolyline.getBounds(),{padding:[40,40]});
};

/* ──────────────────────────────────────────────────────────
   ELEVATION CHART
─────────────────────────────────────────────────────────── */
function initElevationChart() {
  const canvas=document.getElementById("elevation-chart");
  if(!canvas||typeof Chart==="undefined") return;
  const ctx=canvas.getContext("2d");
  const altGrad=ctx.createLinearGradient(0,0,0,260);
  altGrad.addColorStop(0,"rgba(212,41,26,0.38)"); altGrad.addColorStop(0.55,"rgba(212,41,26,0.10)"); altGrad.addColorStop(1,"rgba(212,41,26,0.00)");
  const pwrGrad=ctx.createLinearGradient(0,0,0,260);
  pwrGrad.addColorStop(0,"rgba(43,95,191,0.32)"); pwrGrad.addColorStop(1,"rgba(43,95,191,0.00)");
  const syncPlugin={id:"randonneur-sync",afterEvent(chart,args){
    const t=args.event.type;
    if(t==="mouseout"){hideElevHUD();removeElevSync();return;}
    if(t!=="mousemove") return;
    const el=chart.getElementsAtEventForMode(args.event.native,"index",{intersect:false},false);
    if(!el.length) return;
    showElevHUD(el[0].index); syncElevMarker(el[0].index);
  }};
  elevChart=new Chart(ctx,{type:"line",plugins:[syncPlugin],data:{labels:ELEV.map(p=>p.km),datasets:[{label:"Altitude (m)",data:ELEV.map(p=>p.alt),borderColor:"#D4291A",borderWidth:2,backgroundColor:altGrad,fill:true,tension:0.38,pointRadius:0,pointHoverRadius:5,pointHoverBackgroundColor:"#D4291A",pointHoverBorderColor:"#F0EDE6",pointHoverBorderWidth:2,yAxisID:"yAlt"},{label:"Puissance (W)",data:ELEV.map(p=>p.power),borderColor:"rgba(43,95,191,0.6)",borderWidth:1.5,backgroundColor:pwrGrad,fill:true,tension:0.38,pointRadius:0,pointHoverRadius:3,pointHoverBackgroundColor:"#2B5FBF",yAxisID:"yPwr"}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{type:"linear",grid:{color:"rgba(255,255,255,0.04)"},border:{display:false},ticks:{color:"rgba(240,237,230,0.25)",font:{family:"'IBM Plex Mono'"},size:10,maxTicksLimit:12,callback:v=>`${v} km`}},yAlt:{position:"left",grid:{color:"rgba(255,255,255,0.04)"},border:{display:false},ticks:{color:"rgba(240,237,230,0.25)",font:{family:"'IBM Plex Mono'",size:10},maxTicksLimit:6,callback:v=>`${v} m`}},yPwr:{position:"right",grid:{display:false},border:{display:false},ticks:{color:"rgba(43,95,191,0.45)",font:{family:"'IBM Plex Mono'",size:10},maxTicksLimit:4,callback:v=>`${v} W`}}},animation:{duration:1800,easing:"easeOutQuart"}}});
}

function showElevHUD(idx) {
  const p=ELEV[idx]; if(!p) return;
  document.getElementById("elev-hud")?.classList.add("visible");
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  set("elev-km",`${p.km} km`); set("elev-alt",`${p.alt} m`); set("elev-grade",`${p.grade>0?"+":""}${p.grade} %`); set("elev-power",`${p.power} W`); set("elev-hr",`${p.hr} bpm`);
}
function hideElevHUD(){document.getElementById("elev-hud")?.classList.remove("visible");}
function syncElevMarker(idx){if(!mainMap||!syncMarkerLeaflet) return;const p=ELEV[idx];if(!p) return;if(!mainMap.hasLayer(syncMarkerLeaflet))syncMarkerLeaflet.addTo(mainMap);syncMarkerLeaflet.setLatLng([p.lat,p.lng]);}
function removeElevSync(){if(mainMap&&syncMarkerLeaflet&&mainMap.hasLayer(syncMarkerLeaflet))mainMap.removeLayer(syncMarkerLeaflet);}

/* ──────────────────────────────────────────────────────────
   FITNESS CHART
─────────────────────────────────────────────────────────── */
function initFitnessChart() {
  const canvas=document.getElementById("fitness-chart"); if(!canvas||typeof Chart==="undefined") return;
  const ctx=canvas.getContext("2d"), weeks=16;
  const labels=Array.from({length:weeks},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(weeks-1-i)*7);return d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});});
  const ctl=[42,45,48,52,55,60,58,62,65,68,71,74,72,76,78,80];
  const atl=[38,50,44,60,52,72,48,68,58,80,62,88,55,72,60,82];
  const tsb=ctl.map((c,i)=>c-atl[i]);
  const ctlGrad=ctx.createLinearGradient(0,0,0,200); ctlGrad.addColorStop(0,"rgba(43,95,191,0.30)"); ctlGrad.addColorStop(1,"rgba(43,95,191,0.00)");
  const atlGrad=ctx.createLinearGradient(0,0,0,200); atlGrad.addColorStop(0,"rgba(212,41,26,0.28)"); atlGrad.addColorStop(1,"rgba(212,41,26,0.00)");
  new Chart(ctx,{type:"line",data:{labels,datasets:[{label:"CTL",data:ctl,borderColor:"#2B5FBF",borderWidth:2,backgroundColor:ctlGrad,fill:true,tension:0.4,pointRadius:0,pointHoverRadius:4,yAxisID:"y"},{label:"ATL",data:atl,borderColor:"#D4291A",borderWidth:1.5,backgroundColor:atlGrad,fill:true,tension:0.4,pointRadius:0,pointHoverRadius:3,yAxisID:"y"},{label:"TSB",data:tsb,borderColor:"rgba(46,125,79,0.8)",borderWidth:1.5,backgroundColor:"transparent",fill:false,tension:0.4,pointRadius:0,yAxisID:"yTSB"}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{display:false},tooltip:{enabled:true,callbacks:{label:c=>` ${c.dataset.label}: ${c.raw}`}}},scales:{x:{grid:{color:"rgba(255,255,255,0.03)"},border:{display:false},ticks:{color:"rgba(240,237,230,0.22)",font:{family:"'IBM Plex Mono'",size:9},maxTicksLimit:8}},y:{position:"left",grid:{color:"rgba(255,255,255,0.03)"},border:{display:false},ticks:{color:"rgba(240,237,230,0.22)",font:{family:"'IBM Plex Mono'",size:9},maxTicksLimit:5}},yTSB:{position:"right",grid:{display:false},border:{display:false},ticks:{color:"rgba(46,125,79,0.5)",font:{family:"'IBM Plex Mono'",size:9},maxTicksLimit:4}}},animation:{duration:1400,easing:"easeOutQuart"}}});
}

/* ──────────────────────────────────────────────────────────
   TILT
─────────────────────────────────────────────────────────── */
function initTilt() {
  if(window.matchMedia("(hover: none)").matches) return;
  document.querySelectorAll(".scard,.ride-card,.quick-link").forEach(card=>{
    card.addEventListener("mousemove",e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transition="transform 0.07s ease,box-shadow 0.3s,background 0.3s,border-color 0.3s";card.style.transform=`translateY(-2px) perspective(600px) rotateX(${-y*3}deg) rotateY(${x*3}deg)`;});
    card.addEventListener("mouseleave",()=>{card.style.transition="transform 0.6s cubic-bezier(0.2,1,0.3,1),box-shadow 0.3s,background 0.3s,border-color 0.3s";card.style.transform="";});
  });
}

/* ──────────────────────────────────────────────────────────
   EXPORT GPX
─────────────────────────────────────────────────────────── */
window.exportGPX = function() {
  const pts=ELEV.map(p=>`    <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">\n      <ele>${p.alt}</ele>\n    </trkpt>`).join("\n");
  const gpx=`<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="C.C. Sarouel" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><n>${CURRENT_RIDE.title}</n><time>${new Date().toISOString()}</time></metadata>\n  <trk><n>${CURRENT_RIDE.title}</n><trkseg>\n${pts}\n  </trkseg></trk>\n</gpx>`;
  const a=Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([gpx],{type:"application/gpx+xml"})),download:`cc-sarouel-${CURRENT_RIDE_KEY}.gpx`});
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
};

window.scrollToSection = function(id) {
  const el=document.getElementById(id),nav=document.getElementById("main-nav");
  if(!el) return;
  window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-(nav?.offsetHeight??68)-20,behavior:"smooth"});
};

window.addEventListener("scroll",()=>{const left=document.querySelector(".hero-left,.home-hero");if(!left) return;const y=window.scrollY;if(y<window.innerHeight)left.style.transform=`translateY(${y*.04}px)`;},{passive:true});

function initKeyboard() {
  document.addEventListener("keydown",e=>{
    if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
    if(e.key==="r"||e.key==="R") window.resetMapView?.();
    if(e.key==="m"||e.key==="M") window.toggleMarkersLayer?.();
    if(e.key==="Escape"&&mobileOpen) window._closeMobileMenu?.();
  });
}

/* ── NAV DROPDOWN ── */
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".nav-dropdown").forEach(dd=>{
    const trigger=dd.querySelector(".nav-dropdown-trigger"),menu=dd.querySelector(".nav-dropdown-menu");
    if(!trigger||!menu) return;
    const path=window.location.pathname.split("/").pop()||"index.html";
    const al=menu.querySelector(`a[href="${path}"]`);
    if(al){al.classList.add("active");trigger.style.color="var(--t1)";}
    trigger.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();trigger.setAttribute("aria-expanded",String(trigger.getAttribute("aria-expanded")!=="true"));}if(e.key==="Escape"){trigger.setAttribute("aria-expanded","false");trigger.focus();}});
    menu.querySelectorAll(".nav-dd-link").forEach((link,i,all)=>{link.addEventListener("keydown",e=>{if(e.key==="Escape")trigger.focus();if(e.key==="ArrowDown"){e.preventDefault();all[Math.min(i+1,all.length-1)].focus();}if(e.key==="ArrowUp"){e.preventDefault();all[Math.max(i-1,0)].focus();}});});
    document.addEventListener("click",e=>{if(!dd.contains(e.target))trigger.setAttribute("aria-expanded","false");});
  });
});

console.log("%cC.C. SAROUEL  v8.0\n%cHauts-de-France · Leaflet · Chart.js 4 · Filtres OK · Cartes uniques","background:#D4291A;color:#F0EDE6;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:.18em;padding:6px 14px;","color:rgba(240,237,230,.5);font-size:12px;");
