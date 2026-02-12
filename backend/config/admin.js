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
  tours: false, // Evita el bug de Strapi v5
  url: '/',     // <--- REGLA INVIOLABLE: Evita el 404 en Render
});