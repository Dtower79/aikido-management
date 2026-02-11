export default {
  config: {
    tutorials: false,
    notifications: { release: false },
  },
  bootstrap(app) {
    // Limpiamos la basura del navegador al arrancar
    window.localStorage.removeItem('guided_tour_current_step');
    window.localStorage.removeItem('guided_tour_state');
  },
};