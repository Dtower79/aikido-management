export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  // Quita el 1337 por defecto. Render asignará el puerto automáticamente.
  port: env.int('PORT'), 
  url: env('STRAPI_URL'), 
  app: {
    keys: env.array('APP_KEYS'),
  },
});