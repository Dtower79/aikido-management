module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('STRAPI_URL', 'https://arashi-api.onrender.com'),
  proxy: true, // Confía en Render
  app: {
    keys: env.array('APP_KEYS'),
  },
  // Añadimos esto para asegurar que las cookies de sesión se traten correctamente
  admin: {
    auth: {
      events: {
        onConnectionError: (error) => {
          console.error('Admin Auth Connection Error', error);
        },
      },
    },
  },
});