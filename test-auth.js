// Mock du pool MySQL pour tester le flux auth complet
const Module = require('module');
const original = Module.prototype.require;

let users = [
  { id: 1, numero: 1, username: 'admin', email: 'admin@test.fr',
    password_hash: '$2a$12$LQv3c1yqBwEHFV7DzDYz/.sQ9p2fLgEBYqZJOQlYqGQEqfqCT7t8.', // "Admin@Salouel2025" hashé
    prenom: 'Admin', nom: 'Test', role: 'admin', actif: 1 }
];
let refreshTokens = [];

Module.prototype.require = function(id) {
  if (id === '../config/database') {
    return {
      query: async (sql, params = []) => {
        const s = sql.toLowerCase().trim();
        if (s.startsWith('select * from users where (email = ?')) {
          const login = params[0];
          return users.filter(u => u.email === login || u.username === login);
        }
        if (s.startsWith('select * from users where id =')) {
          return users.filter(u => u.id === params[0] && u.actif);
        }
        if (s.startsWith('insert into refresh_tokens')) {
          refreshTokens.push({ id: refreshTokens.length+1, user_id: params[0], token_hash: params[1], expires_at: params[2] });
          return { insertId: refreshTokens.length };
        }
        if (s.startsWith('select * from refresh_tokens where token_hash =')) {
          const now = new Date();
          return refreshTokens.filter(t => t.token_hash === params[0] && t.user_id === params[1] && new Date(t.expires_at) > now);
        }
        if (s.startsWith('delete from refresh_tokens where')) {
          refreshTokens = refreshTokens.filter(t => {
            if (s.includes('id =')) return t.id !== params[0];
            if (s.includes('token_hash')) return t.token_hash !== params[0];
            if (s.includes('user_id')) return t.user_id !== params[0];
            return true;
          });
          return { affectedRows: 1 };
        }
        if (s.startsWith('insert into contacts')) return { insertId: 1 };
        return [];
      },
      withTransaction: async (fn) => fn({ query: async () => [] })
    };
  }
  return original.apply(this, arguments);
};

const bcrypt = require('bcryptjs');
console.log('Hash test:', bcrypt.hashSync('Admin@Salouel2025', 12));

// Forcer un nouveau hash valide
const hash = bcrypt.hashSync('Admin@Salouel2025', 12);
users[0].password_hash = hash;

require('dotenv').config();
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-min-32-chars-1234';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-chars-1234';

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const app = express();
app.use(cors({ origin: ['http://localhost:5500'], credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', require('./routes/auth'));
app.listen(3001, () => console.log('Test server on :3001'));
