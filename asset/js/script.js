// ══════════════════════════════════════════
// CERCLE CYCLISTE — script.js
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // ── Nav scroll state ──────────────────────
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });

  // ── Intersection Observer (reveal) ────────
  const revealEls = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger siblings slightly
        const siblings = [...entry.target.parentElement.querySelectorAll('.reveal')];
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('is-visible'), idx * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
  revealEls.forEach(el => observer.observe(el));

  // ── Mapbox GL JS 3D Terrain Map ───────────
  // ⚠ Remplacez cette valeur par votre token Mapbox public
  const MAPBOX_TOKEN = 'VOTRE_TOKEN_MAPBOX_ICI';

  // Tracé GPX simulé (col de montagne alpin)
  const routeGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [6.02, 45.09], [6.05, 45.10], [6.09, 45.12], [6.13, 45.14],
        [6.17, 45.16], [6.20, 45.19], [6.24, 45.21], [6.30, 45.22],
        [6.37, 45.20], [6.42, 45.18], [6.48, 45.16], [6.55, 45.18],
        [6.60, 45.21], [6.66, 45.24], [6.72, 45.22], [6.78, 45.20],
      ]
    }
  };

  function initMapboxMap() {
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [6.35, 45.17],
      zoom: 9.5,
      pitch: 62,        // inclinaison 3D
      bearing: -25,     // rotation légère
      antialias: true,
    });

    map.on('load', () => {
      // ── Source terrain DEM ──
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });

      // ── Activer le terrain 3D ──
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.8 });

      // ── Brouillard atmosphérique ──
      map.setFog({
        color: 'rgba(10, 12, 20, 0.8)',
        'high-color': 'rgba(20, 30, 60, 0.5)',
        'horizon-blend': 0.05,
        'space-color': '#0a0a0a',
        'star-intensity': 0.3,
      });

      // ── Source du tracé GPX ──
      map.addSource('route', {
        type: 'geojson',
        data: routeGeoJSON,
      });

      // Couche de lueur (glow) bleue élargie
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#3d9fff',
          'line-width': 12,
          'line-opacity': 0.2,
          'line-blur': 4,
        },
      });

      // Couche principale du tracé
      map.addLayer({
        id: 'route-main',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#3d9fff',
          'line-width': 2.5,
          'line-opacity': 1,
        },
      });

      // ── Marqueurs de départ / arrivée ──
      const makeMarker = (color, glowColor) => {
        const el = document.createElement('div');
        el.style.cssText = `
          width:12px;height:12px;background:${color};border-radius:50%;
          box-shadow:0 0 12px ${glowColor};border:2px solid #000;
        `;
        return el;
      };
      new mapboxgl.Marker({ element: makeMarker('#2ed573', '#2ed573') })
        .setLngLat(routeGeoJSON.geometry.coordinates[0])
        .addTo(map);
      new mapboxgl.Marker({ element: makeMarker('#ff4757', '#ff4757') })
        .setLngLat(routeGeoJSON.geometry.coordinates.at(-1))
        .addTo(map);

      // ── Marqueurs des cols ──
      const cols = [
        { lngLat: [6.30, 45.22], name: 'Col de Sarenne' },
        { lngLat: [6.60, 45.21], name: 'Col de l\'Iseran' },
        { lngLat: [6.78, 45.20], name: 'Rampe des Aiguilles' },
      ];
      cols.forEach(({ lngLat, name }) => {
        const el = document.createElement('div');
        el.style.cssText = `
          width:8px;height:8px;background:#ffa502;border-radius:50%;
          box-shadow:0 0 10px rgba(255,165,2,0.7);cursor:pointer;
        `;
        el.title = name;
        new mapboxgl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
      });

      // ── Animation de survol douce ──
      map.scrollZoom.disable();
      map.on('mouseenter', 'route-main', () => {
        map.setPaintProperty('route-glow', 'line-opacity', 0.4);
      });
      map.on('mouseleave', 'route-main', () => {
        map.setPaintProperty('route-glow', 'line-opacity', 0.2);
      });
    });

    // Boutons custom
    document.getElementById('mapZoomIn')?.addEventListener('click', () => map.zoomIn());
    document.getElementById('mapZoomOut')?.addEventListener('click', () => map.zoomOut());
    document.getElementById('mapReset')?.addEventListener('click', () => {
      map.flyTo({ center: [6.35, 45.17], zoom: 9.5, pitch: 62, bearing: -25, duration: 1200 });
    });

    return map;
  }

  // ── Fallback Canvas si pas de token ────────
  function initFallbackMap() {
    const notice = document.getElementById('mapTokenNotice');
    if (notice) notice.style.display = 'block';

    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    const canvas = document.createElement('canvas');
    canvas.width  = mapEl.offsetWidth  || 600;
    canvas.height = mapEl.offsetHeight || 320;
    canvas.style.cssText = 'width:100%;height:100%;display:block;';
    mapEl.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Fond sombre dégradé
    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0,   '#0d0f18');
    bg.addColorStop(0.5, '#111420');
    bg.addColorStop(1,   '#0a0c14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grille topographique simulée
    ctx.strokeStyle = 'rgba(61,159,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const y = (canvas.height / 12) * i + Math.sin(i) * 8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= canvas.width; x += 20) {
        ctx.lineTo(x, y + Math.sin(x / 60 + i) * 12);
      }
      ctx.stroke();
    }

    // Relief simulé (montagnes)
    const drawMountain = (px, py, w, h, col) => {
      const grad = ctx.createLinearGradient(px, py - h, px, py);
      grad.addColorStop(0, col);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(px - w/2, py);
      ctx.quadraticCurveTo(px - w/4, py - h * 0.6, px, py - h);
      ctx.quadraticCurveTo(px + w/4, py - h * 0.6, px + w/2, py);
      ctx.fill();
    };
    drawMountain(canvas.width*0.25, canvas.height*0.75, 260, 180, 'rgba(30,45,80,0.7)');
    drawMountain(canvas.width*0.55, canvas.height*0.70, 300, 200, 'rgba(20,35,65,0.8)');
    drawMountain(canvas.width*0.80, canvas.height*0.72, 220, 160, 'rgba(25,40,72,0.65)');
    drawMountain(canvas.width*0.42, canvas.height*0.68, 200, 220, 'rgba(35,52,90,0.85)');

    // Tracé GPX (courbe simulée)
    const pts = [
      [0.04, 0.75], [0.12, 0.68], [0.22, 0.58], [0.32, 0.42],
      [0.42, 0.35], [0.50, 0.45], [0.58, 0.38], [0.68, 0.28],
      [0.76, 0.32], [0.84, 0.40], [0.92, 0.38], [0.97, 0.42],
    ].map(([rx, ry]) => [rx * canvas.width, ry * canvas.height]);

    // Glow
    ctx.save();
    ctx.shadowColor = '#3d9fff';
    ctx.shadowBlur  = 16;
    ctx.strokeStyle = 'rgba(61,159,255,0.25)';
    ctx.lineWidth   = 10;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i+1][0]) / 2;
      const my = (pts[i][1] + pts[i+1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineTo(pts.at(-1)[0], pts.at(-1)[1]);
    ctx.stroke();
    ctx.restore();

    // Ligne principale bleue
    ctx.save();
    ctx.shadowColor = '#3d9fff';
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = '#3d9fff';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i+1][0]) / 2;
      const my = (pts[i][1] + pts[i+1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineTo(pts.at(-1)[0], pts.at(-1)[1]);
    ctx.stroke();
    ctx.restore();

    // Marqueur départ (vert)
    ctx.save();
    ctx.shadowColor = '#2ed573'; ctx.shadowBlur = 12;
    ctx.fillStyle   = '#2ed573';
    ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 5, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Marqueur arrivée (rouge)
    ctx.save();
    ctx.shadowColor = '#ff4757'; ctx.shadowBlur = 12;
    ctx.fillStyle   = '#ff4757';
    ctx.beginPath(); ctx.arc(pts.at(-1)[0], pts.at(-1)[1], 5, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Marqueurs cols (orange)
    [[0.32,0.42],[0.58,0.38],[0.68,0.28]].forEach(([rx,ry]) => {
      ctx.save();
      ctx.shadowColor = '#ffa502'; ctx.shadowBlur = 10;
      ctx.fillStyle   = '#ffa502';
      ctx.beginPath(); ctx.arc(rx*canvas.width, ry*canvas.height, 4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
  }

  // Détection token valide et initialisation
  if (MAPBOX_TOKEN && MAPBOX_TOKEN !== 'VOTRE_TOKEN_MAPBOX_ICI') {
    try {
      initMapboxMap();
    } catch(e) {
      console.warn('Mapbox init failed:', e);
      initFallbackMap();
    }
  } else {
    initFallbackMap();
  }

  // ── Chart.js Global Defaults ───────────────
  Chart.defaults.color = '#555';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
  Chart.defaults.font.family = "'Space Mono', monospace";
  Chart.defaults.font.size = 9;

  // ── Profile / Topographic Chart ───────────
  const profileCtx = document.getElementById('profileChart')?.getContext('2d');
  if (profileCtx) {
    const labels = Array.from({length: 60}, (_, i) => (i * 3.1).toFixed(0));
    const elevData = [
      420,430,445,460,480,520,580,640,710,780,850,920,1020,1150,1250,1380,
      1480,1540,1580,1620,1580,1520,1440,1360,1280,1200,1150,1120,1100,1090,
      1100,1120,1160,1220,1280,1380,1490,1600,1750,1900,2050,2200,2350,2500,
      2600,2650,2700,2650,2580,2490,2380,2260,2100,1950,1800,1680,1560,1450,1380,1300
    ];

    new Chart(profileCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: elevData,
          borderColor: '#3d9fff',
          borderWidth: 2,
          fill: true,
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 140);
            g.addColorStop(0, 'rgba(61,159,255,0.35)');
            g.addColorStop(1, 'rgba(61,159,255,0.0)');
            return g;
          },
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#3d9fff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1800, easing: 'easeInOutQuart' },
        plugins: { legend: { display: false }, tooltip: {
          backgroundColor: 'rgba(10,10,10,0.9)',
          borderColor: 'rgba(61,159,255,0.3)',
          borderWidth: 1,
          titleColor: '#3d9fff',
          bodyColor: '#888',
          callbacks: {
            title: (items) => `${items[0].label} km`,
            label: (item) => `Altitude: ${item.raw}m`,
          }
        }},
        scales: {
          x: {
            display: false,
            grid: { display: false },
          },
          y: {
            display: false,
            grid: { display: false },
            min: 300,
          }
        },
        elements: { line: { borderCapStyle: 'round' } }
      }
    });
  }

  // ── Line Chart (Raw Data #1) ───────────────
  const lineCtx = document.getElementById('lineChart')?.getContext('2d');
  if (lineCtx) {
    const lineData = [62, 58, 71, 68, 75, 80, 78, 85, 82, 90, 88, 94, 91, 98, 100, 105, 102, 108, 110, 114];
    new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: lineData.map((_, i) => i),
        datasets: [{
          data: lineData,
          borderColor: '#3d9fff',
          borderWidth: 2.5,
          fill: true,
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 120);
            g.addColorStop(0, 'rgba(61,159,255,0.25)');
            g.addColorStop(1, 'rgba(61,159,255,0.0)');
            return g;
          },
          tension: 0.5,
          pointRadius: 0,
          pointHoverRadius: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 1500 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, min: 50 }
        }
      }
    });
  }

  // ── Bar Chart (Raw Data #2) ────────────────
  const barCtx = document.getElementById('barChart')?.getContext('2d');
  if (barCtx) {
    const zoneColors = [
      'rgba(100,120,160,0.6)',
      'rgba(100,120,160,0.6)',
      'rgba(100,120,160,0.6)',
      '#ffa502',  // Z4 highlighted
      'rgba(100,120,160,0.5)',
      'rgba(100,120,160,0.4)',
    ];
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6'],
        datasets: [{
          data: [15, 28, 42, 87, 35, 12],
          backgroundColor: zoneColors,
          borderRadius: 3,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 1500 },
        plugins: { legend: { display: false }, tooltip: {
          backgroundColor: 'rgba(10,10,10,0.9)',
          borderColor: 'rgba(255,165,2,0.3)',
          borderWidth: 1,
        }},
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#555', font: { size: 9 } }
          },
          y: { display: false, grid: { display: false } }
        }
      }
    });
  }

  // ── Donut Chart (Raw Data #3) ──────────────
  const donutCtx = document.getElementById('donutChart')?.getContext('2d');
  if (donutCtx) {
    new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [82, 18],
          backgroundColor: ['#2ed573', 'rgba(46,213,115,0.08)'],
          borderColor: ['#2ed573', 'rgba(46,213,115,0.0)'],
          borderWidth: [0, 0],
          hoverOffset: 0,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '74%',
        animation: {
          animateRotate: true,
          duration: 2000,
          easing: 'easeInOutCubic'
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });
  }

  // ── Sparkline SVG path animation ──────────
  const sparkLines = document.querySelectorAll('.spark-line');
  const sparkObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const length = el.getTotalLength?.() || 300;
        el.style.strokeDasharray = length;
        el.style.strokeDashoffset = length;
        el.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(0.4,0,0.2,1)';
        setTimeout(() => { el.style.strokeDashoffset = '0'; }, 100);
        sparkObserver.unobserve(el);
      }
    });
  }, { threshold: 0.3 });
  sparkLines.forEach(el => sparkObserver.observe(el));

  // ── Counter animation for stat values ─────
  function animateCounter(el, target, suffix = '') {
    const start = 0;
    const duration = 1800;
    const startTime = performance.now();
    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (target - start) * eased);
      el.textContent = current.toLocaleString('fr-FR') + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  const statObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const raw = el.dataset.countTo;
      if (!raw) return;
      const target = parseFloat(raw);
      const suffix = el.dataset.suffix || '';
      animateCounter(el, target, suffix);
      statObserver.unobserve(el);
    });
  }, { threshold: 0.6 });

  document.querySelectorAll('[data-count-to]').forEach(el => statObserver.observe(el));

  // ── Parallax on hero ──────────────────────
  const hero = document.querySelector('.hero');
  window.addEventListener('scroll', () => {
    if (!hero) return;
    const y = window.scrollY;
    hero.style.backgroundPositionY = `${y * 0.3}px`;
  }, { passive: true });

});
