'use strict';

module.exports = {
  register({ strapi }) {},

  bootstrap({ strapi }) {
    // Esta es la ÚNICA forma legal de decirle a Strapi que confíe en Render
    strapi.server.app.proxy = true;
  },
};