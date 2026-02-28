const CACHE_NAME = 'arashi-v5.44-update'; // Subimos versión

const ASSETS_TO_CACHE = [
  './',
  './movil.html',
  './manifest.json',
  './img/logo-arashi.png', // Debe existir en esta ruta
  './img/kanjis.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap'
];

// 1. INSTALACIÓN
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('🥋 [SW] Blindando interfaz...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVACIÓN (El resto del código se mantiene igual...)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
  console.log('🥋 [SW] Sistema Arashi Activado.');
});

// 3. FETCH (Mantenlo como lo tienes, está correcto)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});