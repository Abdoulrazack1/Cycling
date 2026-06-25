// tests/helper.js — démarre un serveur Express sur un port libre,
// expose fetch + cleanup pour les tests d'intégration.
//
// Conçu pour rester rapide : un seul serveur par fichier de test
// (before/after global), connexion DB partagée.

const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

// 15 s : tolère CI froid avec MySQL container qui démarre lentement.
async function waitForServer(url, maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (r.status < 500) return true;
    } catch { /* keep polling */ }
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('Server failed to start within ' + maxMs + 'ms');
}

// Helper : fetch avec retry sur 500/502/503 (résilience face aux flakes
// transitoires liés au pool MySQL en tests parallèles)
async function fetchWithRetry(url, opts = {}, maxRetries = 2) {
  let last;
  for (let i = 0; i <= maxRetries; i++) {
    const r = await fetch(url, opts);
    if (r.status < 500) return r;
    last = r;
    await new Promise(rr => setTimeout(rr, 200 * (i + 1)));
  }
  return last;
}

async function startServer() {
  const PORT = await freePort();
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    // info-level logs pour debug — passe à 'silent' une fois stabilisé
    env: { ...process.env, PORT: String(PORT), LOG_LEVEL: process.env.TEST_LOG_LEVEL || 'silent', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Buffer stdout/stderr for debugging if needed
  let lastErr = '';
  proc.stderr.on('data', d => { lastErr += d.toString(); });
  if (process.env.TEST_SERVER_LOGS) proc.stdout.on('data', d => process.stdout.write('[srv] ' + d));

  try {
    await waitForServer(`http://localhost:${PORT}/api/health`, 15000)
      .catch(() => waitForServer(`http://localhost:${PORT}/`, 15000));
  } catch (e) {
    proc.kill();
    throw new Error(`Server start failed: ${e.message}\nstderr: ${lastErr.slice(0, 500)}`);
  }

  return {
    port: PORT,
    base: `http://localhost:${PORT}`,
    stop: () => new Promise(r => { proc.once('close', r); proc.kill('SIGTERM'); }),
  };
}

async function dbConn() {
  return mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

// Cleanup helper : supprime les utilisateurs créés par les tests
async function cleanupTestUsers() {
  const c = await dbConn();
  try {
    await c.query("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%__ccstest__%')");
    await c.query("DELETE FROM users WHERE email LIKE '%__ccstest__%'");
  } finally { await c.end(); }
}

module.exports = { startServer, dbConn, cleanupTestUsers, fetchWithRetry };
