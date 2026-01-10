export default {
  config: {
    // DESACTIVAR TUTORIALES AQUÍ ES MÁS EFECTIVO PARA ESTE BUG
    tutorials: false, 
    // Opcional: Desactiva notificaciones de nuevas versiones
    notifications: { releases: false },
    locales: [
      // 'es',
      // 'fr',
    ],
  },
  bootstrap(app) {
    console.log(app);
  },
};