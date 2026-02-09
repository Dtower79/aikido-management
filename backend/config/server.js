module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // VITAL: Esto le dice a Strapi dónde está su corazón en Internet
  url: env('STRAPI_URL', 'https://arashi-api.onrender.com'), 
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});