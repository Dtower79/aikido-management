// backend/src/admin/app.js
export default {
  config: {
    // Bloqueamos los tutoriales y las notificaciones de release 
    // que son los que buscan la propiedad 'tours'
    tutorials: false,
    notifications: { release: false },
  },
  bootstrap(app) {
    // Este log nos confirmará en la consola del navegador que el escudo funciona
    console.log("Arashi Admin Shield: Active");
    
    // Limpiamos preventivamente el rastro del tour en el navegador
    window.localStorage.removeItem('guided_tour_current_step');
    window.localStorage.removeItem('guided_tour_state');
  },
};