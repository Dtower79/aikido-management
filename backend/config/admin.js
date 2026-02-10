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
  // BLOQUEO DE COMPONENTES DINÁMICOS (Evita el error de 'filter')
  flags: {
    nps: false,
    promoteEE: false,
  },
  tours: false,
  tutorials: false,
  notifications: {
    releases: false,
  },
});