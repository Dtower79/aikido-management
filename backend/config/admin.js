module.exports = ({ env }) => ({
  auth: { secret: env('ADMIN_JWT_SECRET') },
  apiToken: { salt: env('API_TOKEN_SALT') },
  transfer: { token: { salt: env('TRANSFER_TOKEN_SALT') } },
  // Forzamos ruta relativa para que no choque con la URL del servidor
  url: '/admin', 
  tours: false,
});