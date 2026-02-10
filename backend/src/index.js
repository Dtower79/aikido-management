'use strict';

module.exports = {
  register({ strapi }) {},

  bootstrap({ strapi }) {
    // 1. Forzamos la confianza en el proxy de Render
    strapi.server.app.proxy = true;

    // 2. ATAQUE DEFINITIVO AL ERROR 'FILTER': 
    // Sobreescribimos el estado inicial del Guided Tour para que sea una lista vacía 
    // y nunca intente hacer .filter() sobre algo indefinido.
    if (strapi.admin && strapi.admin.services && strapi.admin.services.permission) {
      try {
        const adminStore = strapi.store({ type: 'plugin', name: 'admin' });
        adminStore.set({ key: 'guided_tour_current_step', value: null });
        adminStore.set({ key: 'guided_tour_state', value: {} });
      } catch (e) {
        // Silenciamos si falla, es preventivo
      }
    }
  },
};