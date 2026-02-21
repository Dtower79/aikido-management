'use strict';

module.exports = async (policyContext, config, { strapi }) => {
  const user = policyContext.state.user;

  if (!user) {
    return false; 
  }

  if (user.is_sensei === true) {
    return true; 
  }

  const alumnoFicha = await strapi.entityService.findMany('api::alumno.alumno', {
    filters: { cuenta_usuario: user.id },
  });

  const ficha = alumnoFicha[0];
  if (ficha && ficha.es_instructor === true) {
    return true; 
  }

  const { id } = policyContext.params;

  if (id) {
    const targetAlumno = await strapi.entityService.findOne('api::alumno.alumno', id, {
      populate: ['cuenta_usuario'],
    });

    if (targetAlumno && targetAlumno.cuenta_usuario && targetAlumno.cuenta_usuario.id === user.id) {
      return true; 
    }
  }

  return false;
}; // <--- Revisa que esta llave y punto y coma estén ahí