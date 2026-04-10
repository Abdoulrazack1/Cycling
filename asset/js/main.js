/* ═══════════════════════════════════════════════════════════
   C.C. SAROUEL  v9.0 — Tracés GPS réels via OSRM
   ═══════════════════════════════════════════════════════════ */
"use strict";

/* ──────────────────────────────────────────────────────────
   ROUTING — OSRM public API (appelé depuis le navigateur)
   Pas de clé API requise. Fallback sur coordonnées de repli.
─────────────────────────────────────────────────────────── */

const OSRM_SERVERS = [
  "https://router.project-osrm.org",
  "https://routing.openstreetmap.de"
];

/**
 * Appelle OSRM pour obtenir un tracé vélo réel entre des waypoints.
 * Retourne un tableau [[lat,lng], ...] ou null si échec.
 */
async function fetchOSRMRoute(waypoints, profile = "cycling") {
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");

  for (const server of OSRM_SERVERS) {
    const url = `${server}/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=false`;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes?.[0]) continue;
      // GeoJSON: [lng, lat] → on inverse en [lat, lng]
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    } catch (e) {
      console.warn(`[OSRM] ${server} echec:`, e.message);
    }
  }
  return null;
}

function cacheKey(rideKey) { return `ccs_route_v2_${rideKey}`; }

/**
 * Charge un tracé : cache localStorage → OSRM → fallback intégré.
 */
async function loadRoute(rideKey) {
  const ride = RIDES[rideKey];
  if (!ride) return null;

  // 1. Cache localStorage (expire 30 jours)
  try {
    const cached = localStorage.getItem(cacheKey(rideKey));
    if (cached) {
      const { route, ts } = JSON.parse(cached);
      if (Date.now() - ts < 30 * 24 * 3600 * 1000 && route?.length > 5) {
        console.log(`[OSRM] Cache: ${rideKey} (${route.length} pts)`);
        return route;
      }
    }
  } catch (e) {}

  // 2. OSRM temps réel
  console.log(`[OSRM] Fetch: ${rideKey}…`);
  showMapLoader(true);
  const osrmRoute = await fetchOSRMRoute(ride.waypoints, ride.profile || "cycling");
  showMapLoader(false);

  if (osrmRoute && osrmRoute.length > 5) {
    console.log(`[OSRM] OK ${rideKey}: ${osrmRoute.length} pts`);
    try {
      localStorage.setItem(cacheKey(rideKey), JSON.stringify({ route: osrmRoute, ts: Date.now() }));
    } catch (e) {}
    return osrmRoute;
  }

  // 3. Fallback intégré
  console.warn(`[OSRM] Fallback: ${rideKey}`);
  return ride.route;
}

function showMapLoader(visible) {
  document.querySelectorAll(".map-loader").forEach(el => {
    el.style.display = visible ? "flex" : "none";
  });
}

/* ──────────────────────────────────────────────────────────
   DONNÉES DES SORTIES
─────────────────────────────────────────────────────────── */
const RIDES = {
  "arenberg": {
    title: "Secteurs d'Arenberg",
    center: [50.435, 3.248], zoom: 10, finish_label: "Roubaix", profile: "cycling",
    waypoints: [
      [49.4153, 2.8225],
      [49.9302, 3.0000],
      [50.1748, 3.2347],
      [50.3584, 3.3205],
      [50.4352, 3.2489],
      [50.4388, 3.2510],
      [50.5362, 3.2088],
      [50.6742, 3.0952],
      [50.6942, 3.0182]
    ],
    route: [[49.415,2.822],[49.682,2.940],[49.980,3.040],[50.175,3.234],[50.358,3.320],[50.435,3.248],[50.536,3.209],[50.674,3.095],[50.694,3.018]],
    pois: [
      {lat:49.4153,lng:2.8225,label:"DÉPART",type:"start",detail:"Compiègne · km 0"},
      {lat:50.4352,lng:3.2489,label:"Trouée d'Arenberg",type:"summit",detail:"★★★★★ · 2,4 km · km 98"},
      {lat:50.6742,lng:3.0952,label:"Carrefour de l'Arbre",type:"sprint",detail:"★★★★★ · 1,6 km · km 157"},
      {lat:50.6942,lng:3.0182,label:"VÉLODROME",type:"finish",detail:"Roubaix · km 172"}
    ]
  },
  "flandres": {
    title: "Tour des Monts des Flandres",
    center: [50.750, 2.900], zoom: 11, finish_label: "Roubaix", profile: "cycling",
    waypoints: [
      [50.6942, 3.0182],
      [50.7482, 2.9288],
      [50.7882, 2.8498],
      [50.8478, 2.8228],
      [50.8208, 2.8580],
      [50.7802, 2.9040],
      [50.7402, 2.9620],
      [50.6942, 3.0182]
    ],
    route: [[50.694,3.018],[50.748,2.929],[50.788,2.850],[50.848,2.822],[50.820,2.858],[50.780,2.904],[50.740,2.962],[50.694,3.018]],
    pois: [
      {lat:50.6942,lng:3.0182,label:"ROUBAIX",type:"start",detail:"Départ · km 0"},
      {lat:50.7882,lng:2.8498,label:"Mont Kemmel",type:"summit",detail:"156 m · km 45"},
      {lat:50.8478,lng:2.8228,label:"Mont Cassel",type:"summit",detail:"176 m · km 72"},
      {lat:50.6942,lng:3.0182,label:"ARRIVÉE",type:"finish",detail:"Roubaix · km 112"}
    ]
  },
  "avesnois": {
    title: "Cyclo de l'Avesnois",
    center: [50.200, 3.920], zoom: 12, finish_label: "Avesnes", profile: "cycling",
    waypoints: [
      [50.1228, 3.8302],
      [50.2018, 3.9180],
      [50.2618, 3.9978],
      [50.2018, 3.9380],
      [50.1622, 3.8952],
      [50.1228, 3.8302]
    ],
    route: [[50.122,3.830],[50.202,3.918],[50.262,3.998],[50.202,3.938],[50.162,3.895],[50.122,3.830]],
    pois: [
      {lat:50.1228,lng:3.8302,label:"AVESNES",type:"start",detail:"Départ · km 0"},
      {lat:50.2618,lng:3.9978,label:"Sars-Poteries",type:"summit",detail:"200 m · km 38"},
      {lat:50.1228,lng:3.8302,label:"ARRIVÉE",type:"finish",detail:"Avesnes · km 68"}
    ]
  },
  "valenciennes": {
    title: "Valenciennes — Amiens — Boulogne",
    center: [50.200, 2.800], zoom: 9, finish_label: "Boulogne", profile: "cycling",
    waypoints: [
      [50.3580, 3.5232],
      [50.1748, 3.2347],
      [49.8942, 2.2958],
      [50.4282, 1.7622],
      [50.7282, 1.6182]
    ],
    route: [[50.358,3.523],[50.175,3.235],[49.894,2.296],[50.428,1.762],[50.728,1.618]],
    pois: [
      {lat:50.3580,lng:3.5232,label:"VALENCIENNES",type:"start",detail:"Départ · km 0"},
      {lat:49.8942,lng:2.2958,label:"Amiens",type:"col",detail:"Passage · km 62"},
      {lat:50.7282,lng:1.6182,label:"BOULOGNE",type:"finish",detail:"Arrivée · km 104"}
    ]
  },
  "scarpe": {
    title: "La Scarpe — Douai Gravel",
    center: [50.410, 3.020], zoom: 12, finish_label: "Douai", profile: "cycling",
    waypoints: [
      [50.3722, 3.0818],
      [50.4122, 3.0120],
      [50.4622, 2.9382],
      [50.4482, 2.9150],
      [50.4202, 2.9280],
      [50.3852, 2.9680],
      [50.3722, 3.0818]
    ],
    route: [[50.372,3.081],[50.412,3.012],[50.462,2.938],[50.448,2.915],[50.420,2.928],[50.385,2.968],[50.372,3.081]],
    pois: [
      {lat:50.3722,lng:3.0818,label:"DOUAI",type:"start",detail:"Départ · km 0"},
      {lat:50.4622,lng:2.9382,label:"Forêt Marchiennes",type:"summit",detail:"Gravel · km 35"},
      {lat:50.3722,lng:3.0818,label:"ARRIVÉE",type:"finish",detail:"Douai · km 76"}
    ]
  },
  "roubaix-recup": {
    title: "Sortie Roubaix — Récupération",
    center: [50.685, 3.090], zoom: 13, finish_label: "Roubaix", profile: "cycling",
    waypoints: [
      [50.6942, 3.0182],
      [50.7142, 3.0680],
      [50.7222, 3.0982],
      [50.7042, 3.1282],
      [50.6782, 3.1522],
      [50.6522, 3.1182],
      [50.6482, 3.0882],
      [50.6692, 3.0422],
      [50.6942, 3.0182]
    ],
    route: [[50.694,3.018],[50.714,3.068],[50.722,3.102],[50.692,3.148],[50.652,3.108],[50.658,3.068],[50.694,3.018]],
    pois: [
      {lat:50.6942,lng:3.0182,label:"ROUBAIX",type:"start",detail:"Départ · km 0"},
      {lat:50.7222,lng:3.0982,label:"Hem",type:"col",detail:"km 12"},
      {lat:50.6942,lng:3.0182,label:"ARRIVÉE",type:"finish",detail:"Roubaix · km 48"}
    ]
  },
  "dunkerque": {
    title: "Dunkerque — Côte d'Opale",
    center: [50.880, 2.180], zoom: 10, finish_label: "Calais", profile: "cycling",
    waypoints: [
      [51.0352, 2.3782],
      [50.9882, 2.3022],
      [50.8982, 2.1918],
      [50.8452, 2.1282],
      [50.8022, 2.1182],
      [50.7282, 2.2182]
    ],
    route: [[51.035,2.378],[50.988,2.302],[50.898,2.192],[50.845,2.128],[50.802,2.118],[50.728,2.218]],
    pois: [
      {lat:51.0352,lng:2.3782,label:"DUNKERQUE",type:"start",detail:"Départ · km 0"},
      {lat:50.8452,lng:2.1282,label:"Cap Blanc-Nez",type:"summit",detail:"Falaises · km 65"},
      {lat:50.7282,lng:2.2182,label:"CALAIS",type:"finish",detail:"Arrivée · km 132"}
    ]
  },
  "lille-bethune": {
    title: "Lille — La Bassée — Béthune",
    center: [50.545, 2.870], zoom: 11, finish_label: "Béthune", profile: "cycling",
    waypoints: [
      [50.6282, 3.0582],
      [50.5482, 2.9582],
      [50.4922, 2.8482],
      [50.4622, 2.6722]
    ],
    route: [[50.628,3.058],[50.548,2.958],[50.492,2.848],[50.462,2.672]],
    pois: [
      {lat:50.6282,lng:3.0582,label:"LILLE",type:"start",detail:"Départ · km 0"},
      {lat:50.4922,lng:2.8482,label:"La Bassée",type:"col",detail:"km 48"},
      {lat:50.4622,lng:2.6722,label:"BÉTHUNE",type:"finish",detail:"Arrivée · km 94"}
    ]
  },
  "trilogie": {
    title: "Trilogie — Arenberg, Wallers, Carrefour",
    center: [50.580, 3.180], zoom: 10, finish_label: "Cassel", profile: "cycling",
    waypoints: [
      [50.3580, 3.5232],
      [50.4352, 3.2489],
      [50.4388, 3.2510],
      [50.6742, 3.0952],
      [50.6942, 3.0182],
      [50.7882, 2.8498],
      [50.8352, 2.8002]
    ],
    route: [[50.358,3.523],[50.435,3.248],[50.439,3.251],[50.674,3.095],[50.694,3.018],[50.788,2.850],[50.835,2.800]],
    pois: [
      {lat:50.3580,lng:3.5232,label:"VALENCIENNES",type:"start",detail:"Départ · km 0"},
      {lat:50.4352,lng:3.2489,label:"Trouée d'Arenberg",type:"summit",detail:"★★★★★ · km 52"},
      {lat:50.6742,lng:3.0952,label:"Carrefour de l'Arbre",type:"sprint",detail:"★★★★★ · km 128"},
      {lat:50.8352,lng:2.8002,label:"CASSEL",type:"finish",detail:"Arrivée · km 187"}
    ]
  },
  "plaine-flamande": {
    title: "Plaine Flamande — Endurance",
    center: [50.740, 2.870], zoom: 11, finish_label: "Roubaix", profile: "cycling",
    waypoints: [
      [50.6942, 3.0182],
      [50.7482, 2.9288],
      [50.8202, 2.8282],
      [50.7722, 2.7382],
      [50.7002, 2.7182],
      [50.6502, 2.7902],
      [50.6582, 2.8282],
      [50.6942, 3.0182]
    ],
    route: [[50.694,3.018],[50.748,2.929],[50.820,2.828],[50.772,2.738],[50.700,2.718],[50.650,2.790],[50.658,2.828],[50.694,3.018]],
    pois: [
      {lat:50.6942,lng:3.0182,label:"ROUBAIX",type:"start",detail:"Départ · km 0"},
      {lat:50.8202,lng:2.8282,label:"Merville",type:"col",detail:"Plaine · km 48"},
      {lat:50.6942,lng:3.0182,label:"ARRIVÉE",type:"finish",detail:"Roubaix · km 96"}
    ]
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

function buildElevationData(rideKey, routeCoords) {
  const route = routeCoords || RIDES[rideKey]?.route || RIDES["arenberg"].route;
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
   DÉTECTION SORTIE ACTIVE
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
const POIS = CURRENT_RIDE.pois;

let ROUTE_LATLNG = CURRENT_RIDE.route;
let ELEV = buildElevationData(CURRENT_RIDE_KEY, ROUTE_LATLNG);

const TILE_LAYERS = {
  osm:       {url:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", options:{maxZoom:18, attribution:"© OpenStreetMap"}},
  topo:      {url:"https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",   options:{maxZoom:17, attribution:"© OpenTopoMap"}},
  satellite: {url:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", options:{maxZoom:18, attribution:"© Esri"}}
};

let miniMap=null, mainMap=null, mainTileLayer=null, routePolyline=null;
let markersGroup=null, syncMarkerLeaflet=null, elevChart=null;
let mobileOpen=false, routeVisible=true, markersVisible=true, currentTile="osm";

/* ──────────────────────────────────────────────────────────
   BOOT
─────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  initNav();
  initClock();
  initScrollNav();
  initReveal();
  initHamburger();
  initTilt();
  initKeyboard();
  if (document.getElementById("filter-chips")) initFilterChips();
  if (document.getElementById("fitness-chart")) initFitnessChart();

  const hasMap = document.getElementById("mini-map") || document.getElementById("main-map") || document.getElementById("elevation-chart");
  if (hasMap) {
    // Injecte loader immédiatement
    document.querySelectorAll("#mini-map,#main-map").forEach(c => injectMapLoader(c));

    const realRoute = await loadRoute(CURRENT_RIDE_KEY);
    if (realRoute && realRoute.length > 5) {
      ROUTE_LATLNG = realRoute;
      ELEV = buildElevationData(CURRENT_RIDE_KEY, realRoute);
    }
    if (document.getElementById("mini-map"))        initMiniMap();
    if (document.getElementById("main-map"))        initMainMap();
    if (document.getElementById("elevation-chart")) initElevationChart();
  }
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
  const els = document.querySelectorAll("[data-reveal]");
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { const d = e.target.dataset.delay || 0; setTimeout(() => e.target.classList.add("in"), +d); obs.unobserve(e.target); } });
  }, {threshold:0.12, rootMargin:"0px 0px -40px 0px"});
  els.forEach(el => obs.observe(el));
}

/* ──────────────────────────────────────────────────────────
   FILTER CHIPS
─────────────────────────────────────────────────────────── */
function initFilterChips() {
  const bar = document.getElementById("filter-chips");
  if (!bar) return;
  const state = {type:"tous", level:"tous"};
  bar.querySelectorAll(".filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.group;
      bar.querySelectorAll(`.filter-chip[data-group="${group}"]`).forEach(b => { b.classList.remove("active"); b.setAttribute("aria-pressed","false"); });
      btn.classList.add("active"); btn.setAttribute("aria-pressed","true");
      state[group] = btn.textContent.trim().toLowerCase();
      applyFilters(state);
    });
  });
}

function applyFilters(state) {
  document.querySelectorAll("[data-type]").forEach(card => {
    const values = (card.dataset.type||"").toLowerCase().split(",").map(s => s.trim());
    const level  = (card.dataset.level||"").toLowerCase();
    const ok = (state.type==="tous" || values.includes(state.type)) && (state.level==="tous" || level===state.level);
    card.style.display = ok ? "" : "none";
  });
  document.querySelectorAll(".routes-grid").forEach(grid => {
    const visible = [...grid.querySelectorAll("[data-type]")].some(c => c.style.display !== "none");
    grid.style.opacity = visible ? "" : "0.3";
  });
}

/* ──────────────────────────────────────────────────────────
   MINI MAP
─────────────────────────────────────────────────────────── */
function initMiniMap() {
  if (typeof L === "undefined") return;
  const container = document.getElementById("mini-map");
  if (!container) return;
  injectMapLoader(container);
  miniMap = L.map("mini-map", {center:MAP_CENTER, zoom:CURRENT_RIDE.zoom, zoomControl:false, scrollWheelZoom:false, dragging:false, touchZoom:false, doubleClickZoom:false, keyboard:false, attributionControl:false});
  L.tileLayer(TILE_LAYERS.topo.url, TILE_LAYERS.topo.options).addTo(miniMap);
  const poly = L.polyline(ROUTE_LATLNG, {color:"#D4291A", weight:2.5, opacity:0.9, lineJoin:"round", lineCap:"round"}).addTo(miniMap);
  miniMap.fitBounds(poly.getBounds(), {padding:[14,14]});
  const startPoi = POIS.find(p => p.type === "start");
  const finishPoi = POIS.find(p => p.type === "finish") || POIS[POIS.length - 1];
  if (startPoi) addMarker(miniMap, [startPoi.lat, startPoi.lng], "DÉPART", "#2E7D4F");
  if (finishPoi) addMarker(miniMap, [finishPoi.lat, finishPoi.lng], CURRENT_RIDE.finish_label || "ARRIVÉE", "#D4291A");
  addRouteSourceBadge(container, ROUTE_LATLNG.length);
}

/* ──────────────────────────────────────────────────────────
   MAIN MAP
─────────────────────────────────────────────────────────── */
function initMainMap() {
  if (typeof L === "undefined") return;
  const container = document.getElementById("main-map");
  if (!container) return;
  injectMapLoader(container);
  mainMap = L.map("main-map", {center:MAP_CENTER, zoom:CURRENT_RIDE.zoom, zoomControl:true, scrollWheelZoom:true, attributionControl:false});
  mainMap.zoomControl.setPosition("bottomright");
  mainTileLayer = L.tileLayer(TILE_LAYERS.osm.url, TILE_LAYERS.osm.options).addTo(mainMap);
  L.polyline(ROUTE_LATLNG, {color:"#D4291A", weight:12, opacity:0.08}).addTo(mainMap);
  routePolyline = L.polyline(ROUTE_LATLNG, {color:"#D4291A", weight:2.5, opacity:0.95, lineJoin:"round", lineCap:"round"}).addTo(mainMap);
  mainMap.fitBounds(routePolyline.getBounds(), {padding:[40,40]});
  markersGroup = L.layerGroup();
  POIS.forEach(poi => {
    const color = (poi.type==="summit"||poi.type==="start"||poi.type==="finish") ? "#D4291A" : "#2B5FBF";
    const icon = createCustomIcon(poi.label, color, poi.type==="summit"||poi.type==="start"||poi.type==="finish");
    const marker = L.marker([poi.lat, poi.lng], {icon});
    marker.bindPopup(`<div style="padding:12px 14px;min-width:160px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:rgba(240,237,230,.35);margin-bottom:6px;">${poi.type}</div><div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:#F0EDE6;line-height:1;margin-bottom:4px;">${poi.label}</div>${poi.detail?`<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:rgba(240,237,230,.38);margin-top:4px;">${poi.detail}</div>`:""}</div>`, {closeButton:false, maxWidth:220});
    marker.addTo(markersGroup);
  });
  markersGroup.addTo(mainMap);
  const btnM = document.getElementById("btn-markers");
  if (btnM) { btnM.classList.add("active"); btnM.setAttribute("aria-pressed","true"); }
  const syncIcon = L.divIcon({html:`<div style="width:10px;height:10px;background:#D4291A;border:2px solid rgba(240,237,230,.9);border-radius:50%;box-shadow:0 0 12px rgba(212,41,26,.85);pointer-events:none;"></div>`, className:"", iconSize:[10,10], iconAnchor:[5,5]});
  syncMarkerLeaflet = L.marker(ROUTE_LATLNG[0], {icon:syncIcon, interactive:false, zIndexOffset:1000});
  mainMap.on("click", e => {
    const near = nearestPoint(e.latlng.lat, e.latlng.lng);
    if (near) L.popup().setLatLng([near.lat,near.lng]).setContent(`<div style="padding:10px 13px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#D4291A;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px;">Position sur tracé</div><div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(240,237,230,.7);">km ${near.km} · ${near.alt} m · ${near.grade>0?"+":""}${near.grade} %</div></div>`).openOn(mainMap);
  });
  addRouteSourceBadge(container, ROUTE_LATLNG.length);
}

/* ──────────────────────────────────────────────────────────
   UTILITAIRES CARTE
─────────────────────────────────────────────────────────── */
function injectMapLoader(container) {
  if (!container || container.querySelector(".map-loader")) return;
  const el = document.createElement("div");
  el.className = "map-loader";
  el.style.cssText = "display:none;position:absolute;inset:0;z-index:1000;background:rgba(13,13,16,.75);align-items:center;justify-content:center;gap:10px;pointer-events:none;";
  el.innerHTML = `<div style="width:6px;height:6px;background:#D4291A;border-radius:50%;animation:pulse 1s infinite;"></div><span style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.15em;color:rgba(240,237,230,.55);text-transform:uppercase;">Chargement tracé GPS…</span>`;
  container.style.position = "relative";
  container.appendChild(el);
}

function addRouteSourceBadge(container, ptCount) {
  const old = container.querySelector(".route-src-badge");
  if (old) old.remove();
  const badge = document.createElement("div");
  badge.className = "route-src-badge";
  const isReal = ptCount > 30;
  badge.style.cssText = "position:absolute;bottom:8px;left:8px;z-index:900;background:rgba(13,13,16,.85);border:1px solid rgba(255,255,255,.08);font-family:'IBM Plex Mono',monospace;font-size:8px;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:2px;pointer-events:none;";
  badge.style.color = isReal ? "rgba(46,125,79,.9)" : "rgba(240,237,230,.35)";
  badge.textContent = isReal ? `✓ GPS réel · OSRM · ${ptCount} pts` : `~ tracé approximatif`;
  container.appendChild(badge);
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

/* ──────────────────────────────────────────────────────────
   CACHE MANAGEMENT
─────────────────────────────────────────────────────────── */
window.clearRouteCache = function() {
  Object.keys(RIDES).forEach(k => { try { localStorage.removeItem(cacheKey(k)); } catch(e) {} });
  console.log("[OSRM] Cache vidé — rechargez la page.");
};

console.log(
  "%cC.C. SAROUEL  v9.0\n%cTracés GPS réels via OSRM · Leaflet · Chart.js 4\n%c→ clearRouteCache() pour forcer le rechargement des tracés",
  "background:#D4291A;color:#F0EDE6;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:.18em;padding:6px 14px;",
  "color:rgba(240,237,230,.5);font-size:12px;",
  "color:rgba(43,95,191,.7);font-size:11px;"
);