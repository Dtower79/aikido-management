export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),  // ← Render necesita 0.0.0.0
  port: env.int('PORT', 1337),   // ← Debe coincidir con variable PORT
  app: {
    keys: env.array('APP_KEYS'),
  },
});
