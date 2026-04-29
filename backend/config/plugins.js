module.exports = ({ env }) => ({
  email: {
    config: {
      provider: 'strapi-provider-email-resend', // <--- Nombre clave para que Strapi lo encuentre
      providerOptions: {
        apiKey: env('RESEND_API_KEY'),
      },
      settings: {
        defaultFrom: 'onboarding@resend.dev',
        defaultReplyTo: 'onboarding@resend.dev',
      },
    },
  },
});