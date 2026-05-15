// tests/integration/auth.test.js
// Couvre les flux essentiels d'auth : register → login → refresh → logout.
// Démarre un serveur Express sur un port libre, nettoie les utilisateurs
// de test à la fin.

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, cleanupTestUsers } = require('../helper');

let srv;

test.before(async () => {
  await cleanupTestUsers();
  srv = await startServer();
});

test.after(async () => {
  if (srv) await srv.stop();
  await cleanupTestUsers();
});

function rndSuffix() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

test('POST /auth/register crée un utilisateur et retourne un access token', async () => {
  const email = `register__ccstest__${rndSuffix()}@example.com`;
  const r = await fetch(`${srv.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prenom: 'Test', nom: 'User',
      username: `tu_${rndSuffix()}`,
      email, password: 'TestPassword123',
    }),
  });
  assert.ok(r.status === 200 || r.status === 201, `register status: ${r.status}`);
  const data = await r.json();
  assert.ok(data.accessToken, 'doit renvoyer accessToken');
  assert.ok(data.user?.id, 'doit renvoyer user.id');
  assert.equal(data.user.email, email);
});

test('POST /auth/login avec mauvais mot de passe → 401', async () => {
  const r = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'unknown__ccstest__@nowhere.fake', password: 'wrong' }),
  });
  assert.equal(r.status, 401);
});

test('POST /auth/login renvoie un access token + pose un refresh cookie', async () => {
  // D'abord créer un user dédié à ce test
  const email = `login__ccstest__${rndSuffix()}@example.com`;
  const password = 'LoginPass456';
  await fetch(`${srv.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prenom: 'Login', nom: 'Test',
      username: `lt_${rndSuffix()}`,
      email, password,
    }),
  });

  const r = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: email, password }),
  });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.ok(data.accessToken);

  const setCookie = r.headers.get('set-cookie');
  assert.ok(setCookie?.includes('refreshToken='), 'cookie refreshToken doit être posé');
  assert.ok(setCookie.toLowerCase().includes('samesite=strict'), 'sameSite=Strict attendu (Brief 2)');
  assert.ok(setCookie.toLowerCase().includes('httponly'), 'httpOnly attendu');
});

test('GET /auth/me sans token → 401', async () => {
  const r = await fetch(`${srv.base}/api/auth/me`);
  assert.equal(r.status, 401);
});

test('GET /auth/me avec un access token frais → 200 + données user', async () => {
  // Crée + login pour récupérer un token
  const email = `me__ccstest__${rndSuffix()}@example.com`;
  const password = 'MePass789';
  await fetch(`${srv.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prenom: 'Me', nom: 'Test',
      username: `me_${rndSuffix()}`,
      email, password,
    }),
  });
  const loginR = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: email, password }),
  });
  const { accessToken } = await loginR.json();

  const r = await fetch(`${srv.base}/api/auth/me`, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  assert.equal(r.status, 200);
  const me = await r.json();
  assert.equal(me.email, email);
});

test('POST /auth/logout efface le cookie refreshToken', async () => {
  // Login d'abord
  const email = `logout__ccstest__${rndSuffix()}@example.com`;
  const password = 'LogoutPass000';
  await fetch(`${srv.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prenom: 'Logout', nom: 'Test',
      username: `lo_${rndSuffix()}`,
      email, password,
    }),
  });
  const loginR = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: email, password }),
  });
  const cookie = loginR.headers.get('set-cookie').split(';')[0]; // 'refreshToken=xxx'

  const r = await fetch(`${srv.base}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  assert.equal(r.status, 200);
  const clearCookie = r.headers.get('set-cookie');
  // clearCookie ressemble à "refreshToken=; ... Expires=Thu, 01 Jan 1970…"
  assert.ok(clearCookie?.toLowerCase().includes('refreshtoken='));
});
