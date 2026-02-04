import type { Schema, Struct } from '@strapi/strapi';

export interface AlumnosSeminario extends Struct.ComponentSchema {
  collectionName: 'components_alumnos_seminarios';
  info: {
    displayName: 'seminario';
  };
  attributes: {
    any: Schema.Attribute.Integer;
    ciudad: Schema.Attribute.String;
    mes: Schema.Attribute.String;
    pais: Schema.Attribute.String;
    sensei: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'alumnos.seminario': AlumnosSeminario;
    }
  }
}
