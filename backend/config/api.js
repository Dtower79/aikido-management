module.exports = ({ env }) => ({
  responses: {
    privateAttributes: ['_v', 'id', 'createdAt', 'updatedAt'],
  },
  rest: {
    defaultLimit: 25,
    maxLimit: 1000, // 🥋 AUMENTADO: Ampliamos el escudo de seguridad a 1000 registros por consulta
    withCount: true,
  },
});