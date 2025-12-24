'use strict';

/**
 * dojo router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::dojo.dojo');
