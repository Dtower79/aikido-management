module.exports = ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      connectionString: env('DATABASE_URL'),
      ssl: {
        rejectUnauthorized: false,
      },
    },
    // Ajustes específicos para evitar desconexiones en Neon/Render
    pool: {
      min: 0, 
      max: 10,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      idleTimeoutMillis: 20000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
    },
  },
});