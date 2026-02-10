module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  {
    name: 'strapi::session',
    config: {
      cookie: {
        secure: true, // Esto es seguro ponerlo aquí si usamos proxy:true
      },
    },
  },
  'strapi::favicon',
  'strapi::public',
];