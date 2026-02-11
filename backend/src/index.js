'use strict';

module.exports = {
  register({ strapi }) {},

  bootstrap({ strapi }) {
    // 1. Confianza en el proxy de Render
    strapi.server.app.proxy = true;

    // 2. INTERCEPTOR NUCLEAR: Inyectamos el objeto guidedTour en la respuesta
    // Esto evita que el Frontend de Strapi 5 se rompa al no encontrarlo.
    strapi.server.app.use(async (ctx, next) => {
      await next();
      
      // Si la petición es la inicialización del panel de admin
      if (ctx.url.endsWith('/admin/init') && ctx.body && ctx.body.data) {
        // Forzamos que guidedTour exista como un objeto vacío
        // En lugar de ser 'undefined', lo que matará el error de raíz.
        ctx.body.data.guidedTour = {};
        console.log('🛡️ Arashi System: GuidedTour inyectado en el tráfico.');
      }
    });
  },
};