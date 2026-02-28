module.exports = ({ env }) => ({
  // ... otros plugins si los tienes
  email: {
    config: {
      provider: 'sendgrid',
      providerOptions: {
        apiKey: env('SENDGRID_API_KEY'),
      },
      settings: {
        defaultFrom: 'raulnicolas79@gmail.com', // ⚠️ DEBE ser el que verificaste en SendGrid
        defaultReplyTo: 'raulnicolas79@gmail.com',
      },
    },
  },
});