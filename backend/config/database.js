module.exports = ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      connectionString: env('DATABASE_URL'),
      // Parche de seguridad para Neon y Render
      ssl: {
        rejectUnauthorized: false, 
      },
    },
    pool: { min: 2, max: 10 },
  },
});