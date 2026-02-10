// PATH: backend/config/middlewares.js
module.exports = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://arashi-api.onrender.com'],
          'media-src': ["'self'", 'data:', 'blob:', 'https://arashi-api.onrender.com'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  // --- SUSTITUYE LA LÍNEA 'strapi::session' POR ESTE BLOQUE ---
  {
    name: 'strapi::session',
    config: {
      cookie: {
        secure: true, // Obligatorio en Render (HTTPS)
        sameSite: 'lax',
        httpOnly: true,
      },
    },
  },
  // ------------------------------------------------------------
  'strapi::favicon',
  'strapi::public',
];