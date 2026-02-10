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
  // ESTO ELIMINA EL ERROR DE "FILTER"
  tours: false,
  notifications: { release: false },
  nps: { enabled: false }, 
});