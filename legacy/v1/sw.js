// sw.js — Service Worker de Kastos.
// Estrategia: precache del app shell para funcionamiento offline.
// Los datos del usuario (IndexedDB) nunca pasan por aquí.

const VERSION = 'v2';
const CACHE   = `kastos-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/db.js',
  './js/charts.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-180.png',
  './icons/favicon-32.png',
];

const EXTERNAL = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
  'https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all([
      cache.addAll(APP_SHELL),
      ...EXTERNAL.map((url) =>
        cache.add(new Request(url, { mode: 'no-cors' })).catch(() => {})),
    ])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url        = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Recursos propios: network-first (siempre frescos online, caché offline)
  if (req.mode === 'navigate' || sameOrigin) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res?.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() =>
        caches.match(req).then((cached) =>
          cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
      )
    );
    return;
  }

  // Externos (fuentes, iconos, Chart.js): cache-first con actualización silenciosa
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
