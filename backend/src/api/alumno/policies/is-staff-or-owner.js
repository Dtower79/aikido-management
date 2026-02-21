'use strict';

/**
 * Policy para el Dojo Arashi
 * Permite acceso total a SENSEI e INSTRUCTORES.
 * Los alumnos solo pueden ver o editar su propia ficha.
 */
  
module.exports = async (policyContext, config, { strapi }) => {
  const user = policyContext.state.user; // Usuario haciendo la petición

  if (!user) {
    return false; // Si no hay usuario, fuera.
  }

  // 1. REGLA DE ORO: ¿Es el SENSEI?
  if (user.is_sensei === true) {
    return true; // Acceso total
  }

  // 2. REGLA DE INSTRUCTOR: Buscamos su ficha de alumno
  const alumnoFicha = await strapi.entityService.findMany('api::alumno.alumno', {
    filters: { cuenta_usuario: user.id },
  });

  const ficha = alumnoFicha[0];
  if (ficha && ficha.es_instructor === true) {
    return true; // Acceso total si es instructor
  }

  // 3. REGLA DE PROPIETARIO: Si no es staff, ¿está tocando su propia ficha?
  // El ID que viene en la URL (ej: /api/alumnos/5)
  const { id } = policyContext.params;

  if (id) {
    // Buscamos la ficha que intenta tocar y vemos quién es el dueño
    const targetAlumno = await strapi.entityService.findOne('api::alumno.alumno', id, {
      populate: ['cuenta_usuario'],
    });

    if (targetAlumno && targetAlumno.cuenta_usuario && targetAlumno.cuenta_usuario.id === user.id) {
      // Un alumno común SOLO puede verse a sí mismo (findOne) o actualizarse (update)
      // Pero no puede borrar (delete) ni ver a otros (find).
      // Strapi aplicará esto según qué casillas marques en el panel.
      return true; 
    }
  }

  // Si llega aquí y no es Staff ni el dueño de la ficha, denegado.
  return false;
};