const pino = require('pino');

// pino-pretty est une devDependency : absente des builds packagés (app desktop
// Electron, qui n'embarque que les `dependencies`). On la charge si elle existe,
// sinon on retombe proprement sur du JSON brut — sans ça, le serveur crashait au
// démarrage de l'app packagée (« unable to determine transport target »).
let prettyTransport;
if (process.env.NODE_ENV !== 'production') {
  try {
    require.resolve('pino-pretty');
    prettyTransport = { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } };
  } catch { /* pino-pretty indisponible → JSON brut */ }
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: prettyTransport,
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
