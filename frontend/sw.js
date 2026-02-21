const CACHE_NAME = 'arashi-v5.41-update';

// Activos críticos para que la UI cargue en el tatami sin internet
const ASSETS_TO_CACHE = [
  './',
  './movil.html',
  './manifest.json',
  './img/logo-arashi.png',
  './img/logo-arashi-movil.png',
  './img/kanjis.jpg', // Crítico para la Zen Master Card de Senseis
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap'
];

// 1. INSTALACIÓN: Captura de activos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('🥋 [SW] Blindando interfaz en caché...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVACIÓN: Limpieza de versiones antiguas (Zero Waste Storage)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  console.log('🥋 [SW] Sistema Arashi Activado y Limpio.');
});

// 3. ESTRATEGIA DE CARGA: Cache-First para UI, Network-Only para API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // REGLA DE ORO: No cachear llamadas a la API de Render
  // La integridad de los datos de Neon depende de que el fetch sea real o use LocalStorage
  if (url.pathname.startsWith('/api/')) {
    return; // Dejamos que movil.html y fetchSmart gestionen esto
  }

  // Para el resto (HTML, CSS, Imágenes, Fuentes)
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Si está en caché, lo devolvemos (Velocidad instantánea)
      // Si no, lo buscamos en la red
      return response || fetch(event.request);
    }).catch(() => {
      // Si todo falla (Sin offline y sin caché), podrías devolver una página offline.
      if (event.request.mode === 'navigate') {
        return caches.match('./movil.html');
      }
    })
  );
});