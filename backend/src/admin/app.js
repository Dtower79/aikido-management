export default {
  config: {
    locales: [
       'es',
      // 'fr',
    ],
    // ESTA ES LA LÍNEA MÁGICA QUE ARREGLA EL ERROR VISUAL
    tutorials: false,
    notifications: { releases: false },
  },
  bootstrap(app) {
    console.log(app);
  },
};