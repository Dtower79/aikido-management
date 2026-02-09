module.exports = ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      connectionString: env('DATABASE_URL'),
      ssl: env.bool('DATABASE_SSL', true) && {
        rejectUnauthorized: false, // Necesario para Neon en la mayoría de casos
      },
    },
    pool: { min: 2, max: 10 },
  },
});