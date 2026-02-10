module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
    options: {
      expiresIn: '7d',
    },
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  // Esto deshabilita la obligatoriedad de cookies solo sobre HTTPS interno
  // para que el proxy de Render no dé error 500
  flags: {
    nps: env.bool('STRAPI_PLUGIN_NPS_ENABLED', false),
    promoteEE: env.bool('STRAPI_PROMOTION_ENABLED', false),
  },
  tours: false,
});