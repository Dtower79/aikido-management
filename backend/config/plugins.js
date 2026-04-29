module.exports = ({ env }) => ({
  email: {
    config: {
      provider: 'resend',
      providerOptions: {
        apiKey: env('RESEND_API_KEY'),
      },
      settings: {
        // 🥋 Mientras no verifiques tu dominio en Resend, 
        // debes usar obligatoriamente 'onboarding@resend.dev'
        defaultFrom: 'onboarding@resend.dev', 
        defaultReplyTo: 'onboarding@resend.dev',
      },
    },
  },
});