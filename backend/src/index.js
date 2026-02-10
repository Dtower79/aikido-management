'use strict';

module.exports = {
  register({ strapi }) {
    // LOG DE DIAGNÓSTICO INICIAL
    console.log('--- ARASHI SYSTEM RECOVERY ---');
    console.log('URL configurada:', strapi.config.get('server.url'));
    console.log('Entorno:', process.env.NODE_ENV);
  },

  bootstrap({ strapi }) {
    // ESTRATEGIA DE FUERZA BRUTA PARA COOKIES EN RENDER
    strapi.server.app.proxy = true;
    
    strapi.server.app.use(async (ctx, next) => {
      // Forzamos a Koa a creer que la conexión es HTTPS
      // Esto elimina el error 500 de "secure cookie"
      ctx.request.proxy = true;
      if (ctx.request.headers['x-forwarded-proto'] === 'https') {
        ctx.request.secure = true;
      }
      await next();
    });

    console.log('✅ Middleware de confianza en Proxy inyectado correctamente.');
  },
};