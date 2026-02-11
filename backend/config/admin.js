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
  // Desactivamos el tour con todas las variantes posibles de Strapi 5
  guidedTour: {
    enabled: false,
  },
  tours: {
    enabled: false,
  },
});