module.exports = ({ env }) => ({
  email: {
    config: {
      provider: 'strapi-provider-email-resend', // <--- Nombre clave para que Strapi lo encuentre
      providerOptions: {
        apiKey: env('RESEND_API_KEY'),
      },
      settings: {
        defaultFrom: 'arashi_app@aikidoarashigroup.com',
        defaultReplyTo: 'arashi_app@aikidoarashigroup.com',
      },
    },
  },
});