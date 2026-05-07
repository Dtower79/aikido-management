module.exports = ({ env }) => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.servidor-correo.net'), // Servidor genérico de Hostalia
        port: 587,
        secure: false, // El puerto 587 siempre usa secure: false
        auth: {
          user: env('SMTP_USERNAME'),
          pass: env('SMTP_PASSWORD'),
        },
        tls: {
          rejectUnauthorized: false // 🥋 Vital para que Hostalia no bloquee el envío por nombre de certificado
        }
      },
      settings: {
        defaultFrom: env('SMTP_USERNAME'),
        defaultReplyTo: env('SMTP_USERNAME'),
      },
    },
  },
});