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
  // Forzamos la configuración de la cookie de sesión
  forgotPassword: {
    from: 'no-reply@arashi-group.com',
    replyTo: 'no-reply@arashi-group.com',
  },
  tours: false,
});