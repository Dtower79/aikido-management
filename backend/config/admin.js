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
  // ESTA LÍNEA ES EL FIX: Le dice al panel su dirección exacta
  url: env('STRAPI_URL', 'https://arashi-api.onrender.com') + '/admin',
  tours: false,
});