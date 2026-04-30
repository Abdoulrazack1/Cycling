// server.js — Point d'entrée de l'API C.C. Salouel
require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Sécurité ─────────────────────────────────────────────────
// Helmet avec CSP adaptée :
// - Scripts inline acceptés ('unsafe-inline') car le frontend en utilise partout
// - CDN externes pour Leaflet/Mapillary/etc.
// - Images : Unsplash + tuiles Esri/CARTO/OSM
// - Iframes : Google Maps Street View embed
// - Connections : OSRM, Open-Meteo, et toutes les API externes utilisées
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // pour les GPX
  crossOriginEmbedderPolicy: false,                      // pour iframe Google
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'",
                  'https://cdnjs.cloudflare.com',
                  'https://unpkg.com',
                  'https://cdn.jsdelivr.net'],
      styleSrc:  ["'self'", "'unsafe-inline'",
                  'https://fonts.googleapis.com',
                  'https://cdnjs.cloudflare.com',
                  'https://unpkg.com'],
      fontSrc:   ["'self'", 'data:',
                  'https://fonts.gstatic.com',
                  'https://cdnjs.cloudflare.com'],
      imgSrc:    ["'self'", 'data:', 'blob:', 'https:'], // tuiles + Unsplash + favicons
      connectSrc:["'self'",
                  'https://router.project-osrm.org',
                  'https://api.open-meteo.com',
                  'https://nominatim.openstreetmap.org',
                  'https://maps.googleapis.com',
                  'https://*.tile.openstreetmap.org',
                  'https://*.basemaps.cartocdn.com',
                  'https://server.arcgisonline.com'],
      frameSrc:  ["'self'",
                  'https://www.google.com',
                  'https://maps.google.com',
                  'https://www.google.fr'],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri:   ["'self'"],
      formAction:["'self'"],
      frameAncestors: ["'self'"]
    }
  }
}));

app.set('trust proxy', 1);

// ── CORS ─────────────────────────────────────────────────────
// En dev : autoriser n'importe quel port localhost / 127.0.0.1 (Live Server,
// Vite, etc. sont en 5500/5173/3001…). En prod : whitelist via FRONTEND_URL.
const isProdEnv = process.env.NODE_ENV === 'production';
const explicitOrigins = (process.env.FRONTEND_URL || '')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Autoriser les requêtes sans origin (mobile, curl, Postman, fetch same-origin)
    if (!origin) return cb(null, true);

    // Whitelist explicite via env
    if (explicitOrigins.includes(origin)) return cb(null, true);

    // En dev, tolérer tous les localhost / 127.0.0.1 sur n'importe quel port
    if (!isProdEnv && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return cb(null, true);
    }
    cb(new Error('CORS non autorisé pour : ' + origin));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// ── Body parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Rate limiting ─────────────────────────────────────────────
// Le globalLimiter saute les requêtes authentifiées (header Authorization
// présent) car elles passent déjà par requireAuth/requireAdmin qui valide
// l'identité côté DB. Sans ça, un admin qui rafraîchit l'interface 5 fois
// déclenche 50+ requêtes (sorties + GPX + POIs + segments + …) et se fait
// jeter, y compris pour ses appels /auth/refresh — d'où des déconnexions
// sauvages.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,                                 // bumped from 300
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !!req.headers.authorization, // skip if Bearer token present
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,                                   // bumped slightly (was 20)
  standardHeaders: true,
  legacyHeaders: false,
  // Ne PAS limiter /refresh — il est appelé légitimement à chaque
  // ouverture de page, et le hit limit casse la session. Limit only login/register.
  skip: (req) => req.path === '/refresh' || req.path === '/me',
  message: { error: 'Trop de tentatives de connexion, patientez 15 min' }
});

// contactLimiter : seulement sur POST /contact (formulaire public anti-spam),
// pas sur GET (lecture admin) ni sur PATCH/DELETE (modération admin).
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST' || !!req.headers.authorization,
  message: { error: 'Vous avez envoyé trop de messages récemment' }
});

app.use('/api', globalLimiter);

// ── Fichiers statiques du frontend ───────────────────────────
// Sert les HTML/CSS/JS/GPX directement depuis ce dossier
// EN PRODUCTION : remplacer par nginx
app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.gpx')) {
      res.setHeader('Content-Type', 'application/gpx+xml');
    }
  }
}));

// ── GPX uploadés via l'admin ───────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes API ────────────────────────────────────────────────
app.use('/api/auth',       authLimiter, require('./routes/auth'));
app.use('/api/sorties',    require('./routes/sorties'));
app.use('/api/evenements', require('./routes/evenements'));
app.use('/api/membres',    require('./routes/membres'));
app.use('/api/contact',    contactLimiter, require('./routes/contact'));
app.use('/api/club',       require('./routes/club'));
app.use('/api/segments',   require('./routes/segments'));
app.use('/api/palmares',   require('./routes/palmares'));
app.use('/api/gpx',        require('./routes/gpx'));
app.use('/api/auto-courses', require('./routes/auto-courses'));
app.use('/api/pois',       require('./routes/pois-admin'));

// ── Routes POI — montage avec mergeParams ─────────────────────
// Doit être après /api/sorties pour que :sortieId soit disponible
const poisRouter = require('./routes/pois');
app.use('/api/sorties/:sortieId/pois', poisRouter);

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ── 404 API ───────────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Route introuvable : ${req.method} ${req.path}` });
});

// ── Catch-all 404 HTML (pour les URLs inconnues non-API) ──────
// NB: ne matche que les GET qui attendent du HTML, pour laisser
// les requêtes d'assets 404 renvoyer du texte simple.
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, '404.html'));
  }
  next();
});

// ── Erreur globale ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  if (err.message?.includes('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: 'Erreur serveur interne' });
});

// ── Démarrage ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚴 API C.C. Salouel démarrée`);
  console.log(`   Port    : http://localhost:${PORT}`);
  console.log(`   Env     : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB      : ${process.env.DB_NAME}@${process.env.DB_HOST}`);
  console.log(`   Frontend: ${process.env.FRONTEND_URL}\n`);
});

module.exports = app;
