// PATH: config/database.js
module.exports = ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      connectionString: env('DATABASE_URL'),
      ssl: {
        rejectUnauthorized: false, // Requerido para Neon.tech
      },
    },
    pool: { min: 2, max: 10 },
  },
});