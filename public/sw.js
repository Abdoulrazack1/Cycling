/* sw.js — Service Worker C.C. Salouel (Brief C3)
 *
 * Stratégies (v13 — anti-stale-html) :
 *   - HTML pages (.html, navigate)               → network-first, fallback cache (évite les UI obsolètes)
 *   - Assets versionnables (CSS/JS/SVG/fonts)    → cache-first avec fallback réseau
 *   - API /api/*                                 → network-first avec fallback cache
 *
 * À bumper CACHE_VERSION à chaque déploiement majeur pour évincer les
 * anciens caches.
 */

const CACHE_VERSION = 'ccs-v27';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_RUNTIME = `${CACHE_VERSION}-runtime`;

// Coquille de base à pré-cacher au install (= "app shell")
const PRECACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/asset/css/style.css',
  '/asset/css/polish.css',
  '/asset/css/premium.css',
  '/asset/css/offline.css',
  '/asset/js/offline.js',
  '/asset/js/config.js',
  '/asset/js/utils.js',
  '/asset/js/data-static.js',
  '/asset/js/data.js',
  '/asset/js/auth.js',
  '/asset/js/main.js',
  '/asset/js/premium.js',
  '/asset/img/icon.svg',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => cache.addAll(PRECACHE).catch(() => {/* tolère 404 individuels */}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Cleanup des anciens caches (versions précédentes)
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((k) => !k.startsWith(CACHE_VERSION))
        .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Cross-origin (CDN, Mapillary…) → laisser le réseau gérer
  if (url.origin !== self.location.origin) return;

  // API → network-first, fallback cache (utile pour navigation offline)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // On ne met en cache que les réponses OK + GET publics (sans Authorization)
          if (res.ok && !req.headers.has('authorization')) {
            const clone = res.clone();
            caches.open(CACHE_RUNTIME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // HTML pages → NETWORK-FIRST pour éviter les UI obsolètes après déploiement
  // (cf. AUDIT — anti-stale-html : sinon un Ctrl+Shift+R ne suffit pas car le SW
  // sert l'ancien HTML cached avant même que le navigateur ne tente le réseau)
  const isHtml = req.mode === 'navigate' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === '/' ||
                 url.pathname.endsWith('/');
  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_RUNTIME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('/offline.html')))
    );
    return;
  }

  // Static / navigation → cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_RUNTIME).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => {
        // Fallback navigation hors-ligne : page dédiée
        if (req.mode === 'navigate') return caches.match('/offline.html') || caches.match('/index.html');
        throw new Error('Offline + pas en cache');
      });
    })
  );
});

// Permet à l'app d'envoyer un postMessage pour forcer une mise à jour
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ─── Web Push : réception d'une notification serveur ─────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'C.C. Salouel', body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'Club de Cyclisme de Salouel';
  const options = {
    body:  data.body || '',
    icon:  '/asset/img/icon.svg',
    badge: '/asset/img/icon.svg',
    tag:   data.type || 'ccs-notif',
    data:  { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Clic sur la notification : focus l'onglet existant ou en ouvre un ─
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(target) && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
