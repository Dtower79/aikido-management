module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  // ESTA ES LA SINTAXIS CORRECTA PARA STRAPI v5
  tours: {
    enabled: false,
  },
  // Desactivamos también las banderas de encuestas que causan el error 'filter'
  flags: {
    nps: false,
    promoteEE: false,
  },
});