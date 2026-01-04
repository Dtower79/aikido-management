// Minimal Service Worker para activar la instalación PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Necesario para que Chrome lo considere PWA
  event.respondWith(fetch(event.request));
});