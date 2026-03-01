module.exports = ({ env }) => ({
  // ... otros plugins si los tienes
  email: {
    config: {
      provider: 'sendgrid',
      providerOptions: {
        apiKey: env('SENDGRID_API_KEY'),
      },
      settings: {
        defaultFrom: 'arashi_app@aikidobadalona.com', // ⚠️ DEBE ser el que verificaste en SendGrid
        defaultReplyTo: 'arashi_app@aikidobadalona.com',
      },
    },
  },
});