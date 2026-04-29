module.exports = ({ env }) => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.hostalia.com'),
        port: env.int('SMTP_PORT', 465),
        secure: true, // true para el puerto 465 (SSL cifrado)
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