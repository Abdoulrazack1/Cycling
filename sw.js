/* sw.js — Service Worker C.C. Salouel (Brief C3)
 *
 * Stratégies :
 *   - Assets statiques (HTML/CSS/JS/SVG/fonts) → cache-first avec fallback réseau
 *   - API /api/*                                 → network-first avec fallback cache
 *   - Reste                                      → network-first
 *
 * À bumper CACHE_VERSION à chaque déploiement majeur pour évincer les
 * anciens caches.
 */

const CACHE_VERSION = 'ccs-v11';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_RUNTIME = `${CACHE_VERSION}-runtime`;

// Coquille de base à pré-cacher au install (= "app shell")
const PRECACHE = [
  '/',
  '/index.html',
  '/asset/css/style.css',
  '/asset/css/polish.css',
  '/asset/js/config.js',
  '/asset/js/utils.js',
  '/asset/js/data-static.js',
  '/asset/js/data.js',
  '/asset/js/auth.js',
  '/asset/js/main.js',
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
        // Fallback navigation hors-ligne : retombe sur index.html en cache
        if (req.mode === 'navigate') return caches.match('/index.html');
        throw new Error('Offline + pas en cache');
      });
    })
  );
});

// Permet à l'app d'envoyer un postMessage pour forcer une mise à jour
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
