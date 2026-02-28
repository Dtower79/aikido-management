const CACHE_NAME = 'arashi-v6.0-final';

// Solo lo mínimo para que Chrome diga "OK"
const ASSETS = [
  './movil.html',
  './manifest.json',
  './img/logo-arashi.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
  )));
  self.clients.claim();
});

// El Fetch más simple del mundo
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});