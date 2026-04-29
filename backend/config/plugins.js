module.exports = ({ env }) => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.hostalia.com'),
        port: env.int('SMTP_PORT', 587),
         secure: env.bool('SMTP_SECURE', false), // 🥋 Ahora depende de Render
        auth: {
          user: env('SMTP_USERNAME'),
          pass: env('SMTP_PASSWORD'),
        },
        // Esto evita bloqueos de certificados estrictos en algunos servidores
        tls: {
          rejectUnauthorized: false
        }
      },
      settings: {
        defaultFrom: env('SMTP_USERNAME'),
        defaultReplyTo: env('SMTP_USERNAME'),
      },
    },
  },
});