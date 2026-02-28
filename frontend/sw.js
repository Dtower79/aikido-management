const CACHE_NAME = 'arashi-v7.0-universal'; // Subimos versión para forzar limpieza

// 🥋 CIRUGÍA: Solo cacheamos lo interno para garantizar la instalación.
// Los archivos externos (Fuentes/Icons) se cargarán por red normalmente.
const ASSETS_TO_CACHE = [
  './movil.html',
  './manifest.json',
  './img/logo-arashi.png',
  './img/kanjis.jpg'
];

// 1. INSTALACIÓN: Captura de activos esenciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('🥋 [SW] Blindando interfaz esencial...');
      // Usamos un bucle para que si un archivo falla, no mate la instalación de los demás
      return Promise.all(
        ASSETS_TO_CACHE.map(url => {
          return cache.add(url).catch(err => console.warn(`⚠️ Falló cache de: ${url}`));
        })
      );
    })
  );
  self.skipWaiting();
});

// 2. ACTIVACIÓN: Limpieza radical (Mantenemos tu lógica original)
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

// 3. ESTRATEGIA DE CARGA (Tu Regla de Oro intacta)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // REGLA DE ORO: No cachear llamadas a la API de Render/Neon
  if (url.pathname.startsWith('/api/') || url.href.includes('onrender.com')) {
    return; 
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Devuelve caché si existe, si no, busca en red
      return response || fetch(event.request);
    })
  );
});