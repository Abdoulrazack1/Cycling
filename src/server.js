// server.js — Point d'entrée de l'API C.C. Salouel
require('dotenv').config();

// ── Validation env-vars (FAIL FAST) ──────────────────────────
// Cf. AUDIT item #12. Sans ces vérifs, le serveur démarrait OK
// mais crashait à la première requête auth, OU pire : si JWT_SECRET
// était une chaîne vide, jwt.sign('') produisait des tokens forgeable.
// Note : console.error/warn intentionnels ici — le logger pino n'est pas
// encore chargé à ce stade, et ces messages doivent toujours sortir
// même si le module logger échoue à s'initialiser.
const REQUIRED_ENV = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME'];
const missing = REQUIRED_ENV.filter(v => !process.env[v]);
if (missing.length) {
  console.error(`\n❌ Variables d'environnement requises manquantes : ${missing.join(', ')}`);
  console.error('   Voir .env.example pour le gabarit complet.\n');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32 || process.env.JWT_REFRESH_SECRET.length < 32) {
  console.error('\n❌ JWT_SECRET et JWT_REFRESH_SECRET doivent faire ≥ 32 caractères.');
  console.error('   Générer un secret fort : `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"`\n');
  process.exit(1);
}
if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
  console.error('\n❌ JWT_SECRET et JWT_REFRESH_SECRET doivent être DIFFÉRENTS.\n');
  process.exit(1);
}
// Avertir (sans bloquer) si on tourne avec les secrets d'exemple
if (process.env.JWT_SECRET.includes('CCS_Salouel_JWT_Secret_2025')) {
  console.warn('\n⚠️  ATTENTION : JWT_SECRET semble être la valeur d\'exemple commitée');
  console.warn('   dans le .env du repo public. Faites tourner ce secret avant la prod.\n');
}

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
const pinoHttp     = require('pino-http');
const logger       = require('./lib/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url, id: req.id }),
    res: (res) => ({ statusCode: res.statusCode })
  }
}));

// ── Sécurité ─────────────────────────────────────────────────
// Helmet avec CSP stricte (sans unsafe-inline / unsafe-eval) :
// - Tous les scripts sont externes dans asset/js/
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
      scriptSrc: ["'self'",
                  "'wasm-unsafe-eval'",                // Tesseract.js OCR WebAssembly
                  "'sha256-7Q9uY9XDG4KbTGdh/0PmdR9zrXXQu3ZVct5GroezzcA='", // script anti-FOUC inline (thème, <head>)
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
                  'data:',                               // Tesseract.js WASM embedded as data URI
                  'blob:',                               // pdf.js worker (blob URLs)
                  'https://router.project-osrm.org',
                  'https://api.open-meteo.com',
                  'https://archive-api.open-meteo.com',
                  'https://nominatim.openstreetmap.org',
                  'https://maps.googleapis.com',
                  'https://*.tile.openstreetmap.org',
                  'https://*.basemaps.cartocdn.com',
                  'https://server.arcgisonline.com',
                  'https://tessdata.projectnaptha.com',  // OCR Tesseract.js lang models
                  'https://unpkg.com',                   // OCR Tesseract.js worker/wasm
                  'https://cdn.jsdelivr.net'],           // OCR Tesseract.js + pdf.js
      frameSrc:  ["'self'",
                  'https://www.google.com',
                  'https://maps.google.com',
                  'https://www.google.fr'],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri:   ["'self'"],
      formAction:["'self'"],
      frameAncestors: ["'self'"],
      reportUri: ["/csp-report"]
    }
  }
}));

app.set('trust proxy', 1);

// ── CORS ─────────────────────────────────────────────────────
// Politique same-origin : frontend et API partagent l'origine
// (Express en dev, nginx reverse-proxy en prod). CORS n'est conservé que
// comme défense en profondeur, avec FRONTEND_URL en whitelist explicite
// pour les rares cas où une origine tierce légitime doit appeler l'API
// (ex. outil interne, app mobile). Sans FRONTEND_URL → tout cross-origin
// est refusé.
const explicitOrigins = (process.env.FRONTEND_URL || '')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Requêtes sans Origin (curl, server-to-server, fetch same-origin) : OK
    if (!origin) return cb(null, true);
    if (explicitOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS non autorisé pour : ' + origin));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// ── CSP violation reports ─────────────────────────────────────
// Les violations arrivent en burst (jusqu'à 9 par pageload). On limite à 20/min
// par IP avec silent-drop (204 sans log ni parse) pour éviter de saturer l'event
// loop avec le body-parsing de gros payloads en parallèle.
const cspLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: false,
  legacyHeaders: false,
  handler: (req, res) => res.status(204).end()
});
app.post('/csp-report', cspLimiter, express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body?.['csp-report'] || req.body;
  logger.warn({ report }, 'CSP violation');
  res.status(204).end();
});

// ── Sitemap dynamique (Brief C5) ──────────────────────────────
// Liste les pages publiques + les sorties/évenements/membres dynamiquement.
// Cache 1 h côté navigateur / CDN.
app.get('/sitemap.xml', async (req, res) => {
  try {
    const { query } = require('./config/database');
    const base = (req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.get('host');

    const staticPages = [
      { loc: '/',                 priority: 1.0, changefreq: 'weekly'  },
      { loc: '/sorties.html',     priority: 0.9, changefreq: 'daily'   },
      { loc: '/parcours.html',    priority: 0.8, changefreq: 'weekly'  },
      { loc: '/evenements.html',  priority: 0.9, changefreq: 'daily'   },
      { loc: '/palmares.html',    priority: 0.7, changefreq: 'monthly' },
      { loc: '/segments.html',    priority: 0.6, changefreq: 'monthly' },
      { loc: '/membres.html',     priority: 0.7, changefreq: 'monthly' },
      { loc: '/club.html',        priority: 0.8, changefreq: 'monthly' },
      { loc: '/contact.html',     priority: 0.5, changefreq: 'yearly'  },
    ];

    const dynamic = [];
    try {
      const sorties = await query('SELECT slug, COALESCE(updated_at, date) AS lastmod FROM sorties ORDER BY date DESC LIMIT 500');
      for (const s of sorties) {
        if (s.slug) dynamic.push({ loc: `/sortie.html?slug=${encodeURIComponent(s.slug)}`, lastmod: s.lastmod, priority: 0.6 });
      }
    } catch {}
    try {
      const evs = await query('SELECT id, slug, COALESCE(updated_at, date) AS lastmod FROM evenements ORDER BY date DESC LIMIT 200');
      for (const e of evs) {
        const id = e.slug || e.id;
        dynamic.push({ loc: `/evenement.html?id=${encodeURIComponent(id)}`, lastmod: e.lastmod, priority: 0.6 });
      }
    } catch {}

    const all = [...staticPages, ...dynamic];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => `  <url>
    <loc>${base}${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${new Date(u.lastmod).toISOString().slice(0,10)}</lastmod>` : ''}
    <changefreq>${u.changefreq || 'monthly'}</changefreq>
    <priority>${(u.priority ?? 0.5).toFixed(1)}</priority>
  </url>`).join('\n')}
</urlset>`;
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    logger.error({ err }, 'sitemap generation failed');
    res.status(500).send('<!-- sitemap error -->');
  }
});

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
// cf. AUDIT #4 — le skip ne doit PAS se baser sur la simple PRÉSENCE du
// header Authorization (un attaquant non authentifié pourrait envoyer
// `Authorization: Bearer x` pour sortir du rate-limit). On exige un JWT
// *syntaxiquement* valide (3 segments base64url) — pas de vérif de
// signature ici (inutile pour ce seul usage), juste écarter les bidons.
function looksLikeBearerJwt(req) {
  const h = req.headers.authorization;
  if (!h) return false;
  const m = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(h.trim());
  return !!m;
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    looksLikeBearerJwt(req) ||            // admins/membres authentifiés (JWT plausible)
    req.path.startsWith('/asset/') ||     // fichiers statiques (défense en profondeur)
    req.path.startsWith('/uploads/'),     // GPX uploadés
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
  skip: (req) => req.method !== 'POST' || looksLikeBearerJwt(req),
  message: { error: 'Vous avez envoyé trop de messages récemment' }
});

// inscriptionLimiter : anti-spam des inscriptions aux événements
// (cf. AUDIT item #9 — sans ça, n'importe qui pouvait POST 1000
// fausses inscriptions pour saturer un événement et bloquer les vraies).
const inscriptionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10, // 10 tentatives d'inscription par heure et par IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST' || !req.path.endsWith('/inscrire'),
  message: { error: 'Trop d\'inscriptions tentées récemment, patientez 1 h' }
});

// adminLimiter : limite les routes admin à 300 req/15min/IP.
// Cf. audit-2026-05-19 — sans rate limit, un token admin volé permet
// d'enumérer la BDD à vitesse maximale (broadcast en série, bulk users…).
// 300/15min = ~20/min = largement suffisant pour un humain qui clique.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes admin, patientez 15 min' }
});

app.use('/api', globalLimiter);

// ── Compression gzip/brotli ─────────────────────────────────
// AUDIT opt-4 : 5 lignes pour ~70% de bande passante en moins
// sur les réponses JSON et les HTML/CSS/JS statiques.
app.use(compression());

// ── Fichiers statiques du frontend ───────────────────────────
// Sert les HTML/CSS/JS/GPX directement depuis ce dossier.
// EN PRODUCTION : remplacer par nginx (cf. nginx.conf.example).
//
// Politique de cache :
//  - HTML  → no-cache (les modifs doivent se propager immédiatement)
//  - CSS/JS/fonts/images → 7 jours (Cache-Control public, ETag)
//  - GPX → 1 jour (peuvent être régénérés)
const STATIC_OPTS = {
  index: 'index.html',
  etag: true,
  lastModified: true,
  maxAge: '7d',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.gpx')) {
      res.setHeader('Content-Type', 'application/gpx+xml');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
    // CSS/JS/etc utilisent le maxAge: '7d' par défaut.
  }
};
app.use(express.static(path.join(__dirname, '..', 'public'), STATIC_OPTS));

// ── GPX uploadés via l'admin ───────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  etag: true,
  lastModified: true,
  maxAge: '7d',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.gpx')) {
      res.setHeader('Content-Type', 'application/gpx+xml');
    }
  }
}));

// ── Cache HTTP léger sur les GET publics (AUDIT opt-3) ────────
// 60 s : assez court pour que les modifs admin se propagent vite,
// assez long pour absorber les rafales de requêtes (carte + sortie + POIs).
// Auth check : ne PAS mettre en cache les requêtes authentifiées
// (elles peuvent renvoyer du contenu personnalisé).
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' && !req.headers.authorization) {
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// ── Maintenance mode middleware ───────────────────────────────
// Si maintenance_mode = '1' en BDD/env, bloque les écritures (POST/PUT/PATCH/DELETE)
// pour les non-admins. Les GET restent autorisés (le site lit normalement).
// Les admins authentifiés peuvent toujours tout faire (pour fixer le serveur).
app.use('/api', (req, res, next) => {
  if (process.env.MAINTENANCE_MODE !== '1') return next();
  // GET et HEAD : toujours OK
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  // Routes auth + admin (login, check session) toujours autorisées pour rester gérables
  if (req.path.startsWith('/auth/') || req.path.startsWith('/admin/')) return next();
  // Pour les autres écritures, on bloque les non-authentifiés
  if (!req.headers.authorization) {
    return res.status(503).json({
      error: 'Site en maintenance',
      message: process.env.MAINTENANCE_MESSAGE || 'Site en maintenance. Reviens dans quelques minutes.',
    });
  }
  next();
});

// ── Routes API ────────────────────────────────────────────────
app.use('/api/auth',       authLimiter, require('./routes/auth'));
app.use('/api/sorties',    require('./routes/sorties'));
app.use('/api/evenements', inscriptionLimiter, require('./routes/evenements'));
app.use('/api/membres',    require('./routes/membres'));
app.use('/api/contact',    contactLimiter, require('./routes/contact'));
app.use('/api/club',       require('./routes/club'));
app.use('/api/segments',   require('./routes/segments'));
app.use('/api/palmares',   require('./routes/palmares'));
app.use('/api/gpx',        require('./routes/gpx'));
app.use('/api/auto-courses', require('./routes/auto-courses'));
app.use('/api/admin',      adminLimiter, require('./routes/admin'));
app.use('/api/search',     require('./routes/search'));
app.use('/api/stats',      require('./routes/stats'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/favorites',  require('./routes/favorites'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/my',         require('./routes/my'));
app.use('/api/strava',     require('./routes/strava'));
app.use('/api/pois',       require('./routes/pois-admin'));

// ── Routes POI — montage avec mergeParams ─────────────────────
// Doit être après /api/sorties pour que :sortieId soit disponible
const poisRouter = require('./routes/pois');
app.use('/api/sorties/:sortieId/pois', poisRouter);

// ── Routes inscription sortie (1-clic membre) ─────────────────
const sortieInscriptionsRouter = require('./routes/sortie-inscriptions');
app.use('/api/sorties/:id', sortieInscriptionsRouter);

// ── Health check ─────────────────────────────────────────────
// /api/health             → simple ping (pour load balancer)
// /api/health?deep=1      → avec ping DB (pour monitoring)
app.get('/api/health', async (req, res) => {
  const out = {
    status: 'ok',
    version: require('../package.json').version,
    env: process.env.NODE_ENV || 'development',
    uptime_s: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  };
  if (req.query.deep) {
    try {
      const { query } = require('./config/database');
      const t0 = Date.now();
      await query('SELECT 1');
      out.db = { ok: true, latency_ms: Date.now() - t0 };
    } catch (err) {
      logger.error({ err }, 'health check DB ping failed');
      out.status = 'degraded';
      out.db = { ok: false }; // pas d'err.message en réponse — log côté serveur uniquement
      return res.status(503).json(out);
    }
  }
  res.json(out);
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
    return res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
  }
  next();
});

// ── Erreur globale ────────────────────────────────────────────
app.use((err, req, res, next) => {
  (req.log || logger).error({ err }, 'Unhandled error');
  if (err.message?.includes('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: 'Erreur serveur interne' });
});

// ── Démarrage ─────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info({
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    db: `${process.env.DB_NAME}@${process.env.DB_HOST}`,
    frontend: process.env.FRONTEND_URL,
  }, '🚴 API C.C. Salouel démarrée');

  // Charger les credentials Strava depuis club_settings si absents du .env
  // Permet à l'admin de configurer Strava depuis l'UI sans toucher au fichier .env
  (async () => {
    try {
      const { query } = require('./config/database');
      const rows = await query("SELECT cle, valeur FROM club_settings WHERE cle LIKE 'strava_%' OR cle LIKE 'maintenance_%'");
      for (const r of rows) {
        if (r.cle === 'strava_client_id'      && !process.env.STRAVA_CLIENT_ID)      process.env.STRAVA_CLIENT_ID = r.valeur;
        if (r.cle === 'strava_client_secret'  && !process.env.STRAVA_CLIENT_SECRET)  process.env.STRAVA_CLIENT_SECRET = r.valeur;
        if (r.cle === 'strava_redirect_uri'   && !process.env.STRAVA_REDIRECT_URI)   process.env.STRAVA_REDIRECT_URI = r.valeur;
        if (r.cle === 'maintenance_mode')     process.env.MAINTENANCE_MODE = r.valeur;
        if (r.cle === 'maintenance_message')  process.env.MAINTENANCE_MESSAGE = r.valeur;
      }
      if (process.env.STRAVA_CLIENT_ID)  logger.info('[strava] config chargée depuis club_settings (BDD)');
      if (process.env.MAINTENANCE_MODE === '1') logger.warn('⚠ [maintenance] mode actif au démarrage');
    } catch (err) {
      logger.warn({ err: err.message }, '[strava] impossible de charger config depuis BDD');
    }
  })();

  // ── Auto-expire les courses passées (BDD + GPX) ──────────────
  // Grace period = 90 jours (3 mois) par défaut. Surclassable via
  // SCRAPE_GRACE_DAYS dans .env. Désactivable via DISABLE_AUTO_EXPIRE=true.
  if (process.env.DISABLE_AUTO_EXPIRE !== 'true') {
    const grace = process.env.SCRAPE_GRACE_DAYS || '90';
    const runCleanup = () => {
      const { fork } = require('child_process');
      const proc = fork(require('path').join(__dirname, '..', 'scripts', 'expire-past-sorties.js'), [], {
        stdio: 'inherit',
        env: { ...process.env, SCRAPE_GRACE_DAYS: grace },
      });
      proc.on('error', err => logger.warn({ err }, '[expire-past] failed'));
    };
    setTimeout(runCleanup, 30_000);
    setInterval(runCleanup, 24 * 60 * 60 * 1000);
    logger.info('[auto-expire] activé · grace ' + grace + 'j');
  } else {
    logger.info('[auto-expire] désactivé via DISABLE_AUTO_EXPIRE=true');
  }

  // ── Purge audit_log (Brief B5) ───────────────────────────────
  // Rétention configurable via AUDIT_RETENTION_DAYS (défaut 365j).
  // Lancée 1× au boot puis une fois par jour — le script est idempotent
  // (DELETE … WHERE created_at < … ne supprime que les rows expirées),
  // donc l'exécuter quotidiennement coûte rien si rien n'est éligible.
  // (setInterval limite à ~24.8 jours / 2^31 ms, donc on reste à 24 h.)
  const runAuditPurge = () => {
    const { fork } = require('child_process');
    const proc = fork(require('path').join(__dirname, '..', 'scripts', 'purge-audit-log.js'), [], {
      stdio: 'inherit',
      env: process.env,
    });
    proc.on('error', err => logger.warn({ err }, '[audit purge] failed'));
  };
  setTimeout(runAuditPurge, 60_000);
  setInterval(runAuditPurge, 24 * 60 * 60 * 1000); // 24 h
});

// ── Arrêt gracieux (SIGTERM/SIGINT) ──────────────────────────
// Crucial pour PM2/Docker : on draine les requêtes HTTP en cours puis on
// ferme proprement le pool MySQL avant de quitter (évite connexions zombies).
const { pool } = require('./config/database');
let _shuttingDown = false;
function gracefulShutdown(signal) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  logger.info({ signal }, 'Arrêt demandé — fermeture du serveur HTTP…');
  server.close(async () => {
    try { await pool.end(); logger.info('Pool MySQL fermé proprement.'); }
    catch (e) { logger.warn({ err: e.message }, 'Fermeture du pool échouée'); }
    process.exit(0);
  });
  // Filet de sécurité : si le drainage traîne, on force après 10 s.
  setTimeout(() => { logger.warn('Arrêt forcé après 10s'); process.exit(1); }, 10_000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

module.exports = app;