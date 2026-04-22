const CACHE_NAME = 'arashi-v6.12-network-first'; // Cambiamos el nombre para forzar limpieza

const ASSETS_TO_CACHE =[
  './',
  './movil.html',
  './manifest.json',
  './img/logo-arashi.png',
  './img/kanjis.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap'
];

// 1. INSTALACIÓN
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting(); // Obligamos al nuevo SW a instalarse de inmediato
});

// 2. ACTIVACIÓN Y LIMPIEZA
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim()) // Toma el control de la app al instante
  );
});

// 3. ESTRATEGIA: NETWORK-FIRST (Red Primero, Caché como Respaldo)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Excluimos la API (FetchSmart ya gestiona esto)
  if (url.pathname.startsWith('/api/')) return;

  // PARA HTML, CSS Y JS: Siempre buscar la versión más nueva en el servidor
  if (event.request.mode === 'navigate' || event.request.destination === 'style' || event.request.destination === 'script') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Si hay red y éxito, guardamos la nueva versión en caché y la mostramos
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // Si no hay red (Offline), sacamos la última versión guardada de la caché
          return caches.match(event.request);
        })
    );
    return;
  }

  // PARA IMÁGENES Y FUENTES: Caché Primero (Ahorra muchos datos y carga al instante)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    })
  );
});