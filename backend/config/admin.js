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
  // ELIMINAMOS la línea 'url' para que no choque con el servidor
  tours: false, // Mantenemos esto en false para evitar el error de antes
});