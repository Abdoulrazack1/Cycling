const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'HH:MM:ss' }
  } : undefined,
  base: { app: 'cycling' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.current_password',
      '*.new_password',
      '*.token',
      '*.refreshToken',
      '*.refresh_token',
      '*.totp',
      '*.totp_secret',
      '*.totp_backup_codes',
      '*.backup_codes',
      '*.secret',
      '*.password_hash'
    ],
    censor: '[REDACTED]'
  }
});

module.exports = logger;
