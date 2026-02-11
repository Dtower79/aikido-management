// backend/src/admin/app.js
export default {
  config: {
    // Esto desactiva los tutoriales y las notificaciones 
    // que son los que causan el error 'reading tours'
    tutorials: false,
    notifications: { release: false },
  },
  bootstrap(app) {
    // Limpieza automática de la memoria del navegador cada vez que entras
    window.localStorage.removeItem('guided_tour_current_step');
    window.localStorage.removeItem('guided_tour_state');
    console.log('Arashi UI: Tours disabled');
  },
};