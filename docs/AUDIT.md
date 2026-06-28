# Audit Exhaustif — C.C. Salouel

**Dernière mise à jour :** 28 juin 2026  
**Commits :** 90 | **Fichiers :** ~200 | **Lignes :** ~33 400

---

## 1. Vue d'ensemble

| Métrique | Valeur |
|----------|--------|
| Backend (src/) | 52 fichiers, ~9 500 L |
| Frontend JS | 45 fichiers, ~673 KB |
| CSS | 16 fichiers, ~289 KB |
| HTML | 25 pages, ~3 900 L |
| Routes API | ~100 endpoints |
| Tables MySQL | 25 |
| Migrations | 13 fichiers |
| Tests | 14 fichiers, ~100 cas |
| Scripts CLI | 21 fichiers |
| Dépendances | 23 npm |

## 2. Architecture

```
src/
├── server.js              # Point d'entrée (527 L)
├── config/database.js     # Pool MySQL 10 connexions
├── controllers/           # 20 fichiers (auth 805L, sorties 844L, strava 557L)
├── routes/                # 21 fichiers
├── services/              # 11 fichiers (strava-client 272L, routing 163L, elevation 88L)
├── middleware/             # auth.js (JWT), upload.js (Multer)
└── lib/                   # errors.js, logger.js (Pino), async-handler.js

public/
├── 25 pages HTML
├── asset/js/              # 24 racine + 21 pages/
├── asset/css/             # 16 fichiers
├── asset/img/             # 7 héros SVG + 7 images WebP
├── asset/gpx/             # GPX statiques
├── sw.js                  # Service Worker v34
└── manifest.webmanifest   # PWA

scripts/                   # 21 scripts CLI
tests/                     # 14 fichiers (4 unit + 10 intégration)
database/                  # schema.sql + seed.js
migrations/                # 002 → 013
```

**Middleware Express (ordre) :** dotenv → validation env → pinoHttp → helmet (CSP) → cors → CSP report → sitemap.xml → body parsers → globalLimiter → authLimiter → contactLimiter → inscriptionLimiter → adminLimiter → compression → static files → cache public → maintenance mode

---

## 3. Registre complet des problèmes

### Légende
- 🔴 Critique = plantage, sécurité, données exposées
- 🟠 Sérieux = bug fonctionnel, fuite d'info
- 🟡 Modéré = robustesse, dette technique
- ⚪ Mineur = polish, typo, perf mineure

---

### 3.1 🔴 CRITIQUE

| ID | Fichier:Ligne | Problème | Statut |
|----|--------------|----------|--------|
| C1 | `scripts/validate-gpx.js:27` | `SEED_PATH` pointe vers `../seed.js` (fichier inexistant) — crash ENOENT | ⏳ |
| C2 | `scripts/dump-seed-to-static.js:32` | Même bug path — `../seed.js` au lieu de `../database/seed.js` | ⏳ |
| C3 | `scripts/build-courses.js:558` | GPX généré avec balises `<n>` au lieu de `<name>` — XML invalide GPX 1.1 | ⏳ |
| C4 | `scripts/analyze-gpx.js:33-34` | `Math.min/max(...spread)` sur >~100k points → stack overflow | ⏳ |
| C5 | `controllers/sorties.js:282` | `res.status(500).json({ error: 'Erreur: ' + err.sqlMessage })` — fuite info SQL en prod | ⏳ |
| C6 | `controllers/sorties.js:664` | Même problème — `err.sqlMessage` exposée au client | ⏳ |
| C7 | `controllers/strava.js:535` | `DELETE ... WHERE strava_id = ?` — colonne inexistante (devrait être `id`) → suppression ineffective | ⏳ |

---

### 3.2 🟠 SÉRIEUX

| ID | Fichier:Ligne | Problème | Statut |
|----|--------------|----------|--------|
| S1 | `controllers/auth.js:603` | `req.params.userId` pas validé comme integer avant usage dans JWT sign | ⏳ |
| S2 | `controllers/sorties.js:436` | `fs.writeFileSync()` bloquant dans handler async — bloque l'event loop pendant écriture photo | ⏳ |
| S3 | `routes/stats.js:12` | `POST /api/stats/flush` sans aucune auth — quiconque peut vider le cache | ⏳ |
| S4 | `services/strava-client.js:70,87,136` | Aucun timeout sur fetch vers API Strava — requête peut rester ouverte indéfiniment | ⏳ |
| S5 | `controllers/strava.js:351` | Aucun timeout sur fetch GPX Strava | ⏳ |
| S6 | `controllers/contact.js:8-13` | `nodemailer.createTransport` créé au chargement même sans `SMTP_HOST` — plantera au 1er envoi | ⏳ |
| S7 | `controllers/admin.js:92` | `LIMIT ${limit}` interpolation directe dans SQL (valeur contrôlée mais pattern fragile) | ⏳ |
| S8 | `controllers/sortie-inscriptions.js:100` | `capacityMax = 0` bloque toutes les inscriptions (0 != null → true, count >= 0 → true) | ⏳ |
| S9 | `services/web-push.js:66` | Erreur DB silencieuse dans sendToUser — admin ne saura pas pourquoi push échouent | ⏳ |
| S10 | `public/asset/js/gpx-drop.js:99` | `'Bearer ' + token()` — si token null → header `'Bearer null'` | ⏳ |
| S11 | `controllers/pois.js:12`, `pois-admin.js:33` | `parseFloat(null)` → NaN au lieu de null | ⏳ |
| S12 | `public/asset/js/pages/membre.js:32` | `esc()` n'échappe pas `'` (single quote) → peut casser attributs HTML | ⏳ |
| S13 | `public/asset/js/pages/login.js:46,48` | `CCS_AUTH.ready()` sans `window.` — peut échouer en strict mode | ⏳ |
| S14 | `database/schema.sql:133` | ENUM `type` ne contient pas `'direction'` — confusion si schema+seed sans migrations | ⏳ |

---

### 3.3 🟡 MODÉRÉ

| ID | Fichier:Ligne | Problème | Statut |
|----|--------------|----------|--------|
| M1 | `auth.js:53` | `COOKIE_SECURE` jamais lue par le code — utilise `NODE_ENV` | ⏳ |
| M2 | `gpx.js:37,52` | Regex GPX filename trop restrictive — rejette `.GPX` (uppercase) | ⏳ |
| M3 | `gpx-drop.js:99` | Bearer null quand non connecté | ⏳ |
| M4 | `scrape-sorties.js:44` | `args[idx+1]` sans guard si `--only` est le dernier arg | ⏳ |
| M5 | `scrape-sorties.js:168` | Overpass API `overpass.kumi.systems` instable | ⏳ |
| M6 | `auth.js:544` | Parse error silencieux JSON payload | ⏳ |
| M7 | `build-courses.js:627` | `--course` sans argument → traite toutes les courses | ⏳ |
| M8 | `build-courses.js:558`, `generate-gpx.js:272` | Pas d'échappement XML dans GPX généré | ⏳ |
| M9 | `newsletter.js:54` | `req.protocol` insecure derrière reverse proxy | ⏳ |
| M10 | `strava.js:37-43` | `_slugify` dupliqué (copie de `course-generator.js`) | ⏳ |
| M11 | `server.js:264` | `inscriptionLimiter` skip trop large | ⏳ |
| M12 | `ocr-2jam-pdfs.js:129` | Worker Tesseract non terminé sur erreur | ⏳ |
| M13 | `scrape-sorties.js:78` | User-Agent obsolète `Chrome/124` | ⏳ |
| M14 | `admin.html:22` | `data-requires-auth` redondant avec `data-requires-admin` | ⏳ |
| M15 | `database.js:13` | `pool.queueLimit: 0` illimité → mettre 100 | ⏳ |
| M16 | `offline.html` | Pas de skip-link a11y | ⏳ |
| M17 | `offline.html` | Pas de `<link rel="manifest">` | ⏳ |
| M18 | `mon-espace.html` | Manque balises PWA (apple-touch-icon, theme-color) | ⏳ |
| M19 | `import-sortie.html` | CSS `import-sortie.css` dans `<body>` au lieu de `<head>` | ⏳ |
| M20 | `profil.html:5` | Titre hardcodé `"Mon profil — Antoine Lemaire"` | ⏳ |
| M21 | `routes/gpx.js:4` | Comment dit "modo+" mais code utilise `requireAdmin` | ⏳ |
| M22 | `routes/sorties.js:22` | DELETE photo utilise `requireModo` (inconsistant avec autres DELETE) | ⏳ |
| M23 | `server.js:182,189` | `catch {}` vide dans sitemap — silencieux si DB down | ⏳ |
| M24 | `server.js:473` | `SCRAPE_GRACE_DAYS || '90'` — si 0, remplacé par '90' | ⏳ |
| M25 | `config/database.js:34` | `logger.info('msg', arg)` — pino ne gère pas args multiples | ⏳ |
| M26 | `middleware/upload.js:100` | Erreur `validateGpxFile` non loggée | ⏳ |
| M27 | `services/course-scraper.js:47` | TOCTOU sur `existsSync`/`readFileSync` | ⏳ |
| M28 | `controllers/auth.js:150` | `catch {}` vide sur TOTP verify | ⏳ |
| M29 | `controllers/auth.js:575` | Mail reset fire-and-forget sans feedback utilisateur | ⏳ |
| M30 | `controllers/sorties.js:559` | `logger.info('[import]', req.user?.id, req.user?.username)` — args multiples pino | ⏳ |
| M31 | `controllers/gpx.js:19-21` | `readdirSync`/`statSync` bloquants | ⏳ |
| M32 | `controllers/evenements.js:117` | Double quotes dans SQL (`"annule"`) au lieu de single quotes | ⏳ |
| M33 | `controllers/contact.js:89` | Destructuring sans vérifier que la query retourne 1 row | ⏳ |
| M34 | `scripts/analyze-gpx.js:39-40` | Paths hardcodés `C:/Users/PC/Downloads/` | ⏳ |
| M35 | `scripts/migrate.js:79` | Port MySQL hardcodé `3306` au lieu de `DB_PORT` | ⏳ |
| M36 | `scripts/install-backup-cron.ps1:15` | `$ProjectPath` hardcodé `C:\laragon\www\Cycling` | ⏳ |
| M37 | `package.json:13` | Script `test` liste fichiers explicitement — pas de glob | ⏳ |
| M38 | `electron-main.js:42` | `ELECTRON_RUN_AS_NODE: '1'` pas passé au fork | ⏳ |
| M39 | `nginx.conf.example:110` | Bloque `/test/` mais dossier s'appelle `tests/` | ⏳ |
| M40 | `ci.yml:57` | `npm run seed || true` — échec silencieux, tests avec BDD vide | ⏳ |
| M41 | `migrations/006-013` | Pas de `USE ccs_salouel;` en en-tête | ⏳ |
| M42 | `migrations/011:36` | `sortie_inscriptions` créée sans FK sur `sortie_id` | ⏳ |
| M43 | `migrations/013:15` | `UNIQUE KEY endpoint(191)` — endpoint VARCHAR(512), les >191 chars ne sont pas uniques | ⏳ |

---

### 3.4 ⚪ MINEUR

| ID | Fichier:Ligne | Problème | Statut |
|----|--------------|----------|--------|
| T1 | `style.css:128` | `em { font-style: italic; }` redondant (déjà natif) | ⏳ |
| T2 | `style.css:1721-1723` | `.toast.warning` = `.toast.success` (même couleur brass) | ⏳ |
| T3 | `profil.css:40` | `var(--f-mono)` utilisé mais jamais défini | ⏳ |
| T4 | `fx.css:124` | `.btn { overflow: hidden; }` global casse dropdowns | ⏳ |
| T5 | `fx.css:249` | `body[data-cursor] * { cursor: none !important; }` trop large | ⏳ |
| T6 | `index.html:175,193` | Skeleton 3 items / titre "4 dernières sorties" | ⏳ |
| T7 | `sortie.html:41` | `<img src=""` → requête HTTP vers page courante | ⏳ |
| T8 | `offline.js:5,19` | `var` au lieu de `let`/`const` | ⏳ |
| T9 | `journey.css` ×8, `polish.css` ×5, `style.css` ×10, etc. | 28× `transition: all` restants | ⏳ |
| T10 | `search-palette.js:321` | Recrée écouteurs à chaque Ctrl+K | ✅ |
| T11 | `scroll-fx.js:264` | N IntersectionObservers au lieu d'un seul | ✅ |
| T12 | `style.css:424` | `transition: all` sur `.nav-cta` | ⏳ |
| T13 | `style.css:1128` | `transition: all` sur `.list-ornate-arrow` | ⏳ |
| T14 | `style.css:2280,2326,2366,2715,2739,3236,3536` | `transition: all` sur divers éléments | ⏳ |
| T15 | `journey.css:21,176,218,309,353,479,645,707` | `transition: all` ×8 | ⏳ |
| T16 | `polish.css:121,760,1029,1221,1292` | `transition: all` ×5 | ⏳ |
| T17 | `strava-ux.css:224` | `transition: all` | ⏳ |
| T18 | `premium.css:185` | `transition: all` | ⏳ |
| T19 | `evenements.css:55` | `transition: all` | ⏳ |
| T20 | `login.css:43` | `transition: all` | ⏳ |
| T21 | `import-sortie.css:62` | `transition: all` | ⏳ |
| T22 | `server.js:79` | `'unsafe-inline'` dans styleSrc CSP | ⏳ |
| T23 | `database/seed.js:428` | `bcrypt.hash(..., 12)` — 12 rounds lent pour un seed | ⏳ |
| T24 | `database/seed.js:486` | Identifiants loggés deux fois | ⏳ |
| T25 | `tests/` | Aucun mock réseau (fetch) dans les tests scraper | ⏳ |
| T26 | `tests/` | Aucun test de charge/rate-limiting sur endpoints sensibles | ⏳ |
| T27 | `tests/integration/sorties.test.js` | Seulement 3 tests — pas de pagination/filtres/recherche | ⏳ |
| T28 | `tests/integration/admin.test.js` | Seulement 2 tests — pas de test CRUD admin | ⏳ |
| T29 | `tests/integration/newsletter.test.js:95-116` | Test "subscribe 2 fois" flaky (rate-limit non reset) | ⏳ |
| T30 | `tests/integration/journey.test.js:32-33` | `sortieId` peut être undefined → tests skip silencieusement | ⏳ |
| T31 | `tests/integration/auth.test.js` | Pas de test validation force password | ⏳ |
| T32 | `scripts/backup-cleanup.js:87` | `fs.statSync` à chaque itération (lent si beaucoup de backups) | ⏳ |
| T33 | `scripts/all-gpx-points.js:63` | IDs pas uniques entre exécutions | ⏳ |
| T34 | `.env.example:23` | JWT_SECRET exemple trop long vs commentaire "min 32" | ⏳ |
| T35 | `ci.yml` | Pas de cache MySQL entre runs | ⏳ |
| T36 | `ci.yml` | Pas de step `npm run build` | ⏳ |

---

### 3.5 Bilan par gravité

| Gravité | Total | Fait | Reste |
|---------|-------|------|-------|
| 🔴 Critique | 7 | 0 | **7** |
| 🟠 Sérieux | 14 | 0 | **14** |
| 🟡 Modéré | 43 | 0 | **43** |
| ⚪ Mineur | 36 | 2 | **34** |
| **Total** | **100** | **2** | **98** |

---

## 4. Problèmes déjà résolus (avant cet audit)

| Correctif | Fichier | Détail |
|-----------|---------|--------|
| FOUC boutons géants | `polish.css:130` | `transition: all` → retiré, style.css safe transition appliquée |
| Duplicate `*:focus` | `polish.css:55` | Supprimé |
| Duplicate `.toast` | `polish.css:817` | Première définition supprimée |
| Skeleton `.loading` | `polish.css:141` | Pseudo-classes expérimentales → class `.loading` |
| Fuite `.env` historique | git | Purge complète + rotation JWT |
| Login boucle | `auth.js` | SameSite=lax + sessionStorage |
| Météo cassée | `database.js` | dateStrings pool |
| Profil altimétrique Safari | `sortie.js` | AbortController fallback |
| Schéma SQL fragilités | `schema.sql` | IF NOT EXISTS, index FKs |
| `\|\|` → `??` | Multiples | Nullish coalescing (10+ fichiers) |
| `CCS_CFG` dead code | Multiples | → `window.CCS_CONFIG.apiBase` (10+ fichiers) |
| OSRM timeout | `routing.js` | AbortSignal.timeout() |
| Strava webhook col. | `strava.js:535` | `strava_id` → `id` |
| GPX orphelins | `sorties.js` | Nettoyage auto DELETE |
| Dossier fantôme | git | `{config,...}` supprimé |
| SRI CDN | `sortie.html` | integrity sha384 |
| Graceful shutdown | `server.js` | SIGTERM/SIGINT → drain |
| DB injoignable 503 | `server.js` | errResponse() |
| XSS weather.js | `weather.js:272` | Fallback → `esc()` |
| XSS sortie.js popup | `sortie.js:192-207` | `popupHtml()` → `esc()` partout |
| XSS sortie.js scrub | `sortie.js:935-936` | `esc(p.label)` |
| XSS profil.js | `pages/profil.js:84-86` | `innerHTML` → `esc()` |
| Memory leak auth.js | `auth.js:412-419` | `_ccsNavClickBound` guard |
| undefined check admin | `pages/admin.js:3-4` | `CCS_CONFIG?.apiBase` + early return |
| undefined check parcours | `pages/creer-parcours.js:6-7` | Idem |
| `var` → `let`/`const` | `offline.js` | Lignes 5, 19 |
| Visibility cleanup | `member-journey.js:82-86` | `visibilitychange` listener cleanup |
| search-palette listeners | `search-palette.js:321` | Flag d'init unique |
| scroll-fx IO unique | `scroll-fx.js:264` | Un seul IO au lieu de N |

---

## 5. TODO — Tout ce qui reste à faire

### Priorité 🔴 HAUTE (bloquant prod)

| # | Tâche | Effort | Fichier |
|---|-------|--------|---------|
| H1 | **Configurer SMTP réel** — newsletter, notifs, reset password = code mort sans SMTP | 30 min | `.env` |
| H2 | **Déploiement prod** — domaine, SSL, PM2, Nginx, vars env, FRONTEND_URL | 2-4 h | Ops |
| H3 | **RGPD : politique de confidentialité complète** | 1-2 h | `mentions-legales.html` |
| H4 | **Nettoyer DB prod** — supprimer users test, sorties démo, créer 1er admin | 30 min | BDD |
| H5 | **Rotation DB_PASSWORD** — ALTER USER + MAJ .env | 15 min | BDD |
| H6 | **Corriger fuites SQL sorties.js** — utiliser errResponse() au lieu de err.sqlMessage | 5 min | `sorties.js:282,664` |
| H7 | **Corriger DELETE strava.js:535** — `strava_id` → `id` | 2 min | `strava.js:535` |
| H8 | **Corriger validate-gpx.js path** — `../seed.js` → `../database/seed.js` | 2 min | `validate-gpx.js:27` |
| H9 | **Corriger dump-seed-to-static.js path** — idem | 2 min | `dump-seed-to-static.js:32` |
| H10 | **Corriger build-courses.js GPX** — `<n>` → `<name>` | 5 min | `build-courses.js:558` |
| H11 | **Corriger analyze-gpx.js stack overflow** — chunker le spread | 5 min | `analyze-gpx.js:33` |

### Priorité 🟠 MOYENNE

| # | Tâche | Effort | Fichier |
|---|-------|--------|---------|
| M1 | Ajouter `requireAdmin` sur `POST /api/stats/flush` | 2 min | `routes/stats.js` |
| M2 | Implémenter `COOKIE_SECURE` depuis `.env` | 5 min | `auth.js` + `server.js` |
| M3 | Regex GPX : `/^[a-zA-Z0-9_.-]+\.gpx$/i` | 2 min | `gpx.js:37,52` |
| M4 | `parseFloat(null)` → null dans pois | 5 min | `pois.js:12`, `pois-admin.js:33` |
| M5 | N'ajouter Bearer que si token valide | 2 min | `gpx-drop.js:99` |
| M6 | `AbortSignal.timeout(30000)` sur fetches Strava | 15 min | `strava-client.js:70,87,136`, `strava.js:351` |
| M7 | Overpass → `overpass-api.de` uniquement | 2 min | `scrape-sorties.js:168` |
| M8 | `safeJsonParse()` pour auth.js | 5 min | `auth.js:544` |
| M9 | Guard `--course` sans argument | 5 min | `build-courses.js:627` |
| M10 | Échapper XML dans GPX builder | 10 min | `build-courses.js:558`, `generate-gpx.js:272` |
| M11 | `req.secure ? 'https' : req.protocol` | 2 min | `newsletter.js:54` |
| M12 | Extraire `_slugify` vers helper commun | 10 min | `strava.js`, `course-generator.js` |
| M13 | Ajuster inscriptionLimiter skip | 5 min | `server.js:264` |
| M14 | Ajouter `'` dans `esc()` de membre.js | 2 min | `membre.js:32` |
| M15 | `window.CCS_AUTH` dans login.js | 2 min | `login.js:46,48` |
| M16 | `try/finally` pour worker.terminate() | 5 min | `ocr-2jam-pdfs.js:129` |
| M17 | User-Agent `Chrome/130.0.0.0` | 2 min | `scrape-sorties.js:78` |
| M18 | Supprimer `data-requires-auth` redondant | 2 min | `admin.html:22` |
| M19 | `pool.queueLimit: 100` | 2 min | `database.js:13` |
| M20 | Skip-link dans offline.html | 5 min | `offline.html` |
| M21 | Manifest dans offline.html | 2 min | `offline.html` |
| M22 | Balises PWA dans mon-espace.html | 5 min | `mon-espace.html` |
| M23 | CSS dans `<head>` import-sortie.html | 5 min | `import-sortie.html` |
| M24 | Titre dynamique profil.html | 2 min | `profil.html:5` |
| M25 | Commentaire GPX route "modo+" → "admin" | 2 min | `routes/gpx.js:4` |
| M26 | Documenter DELETE photo = requireModo | 5 min | `routes/sorties.js:22` |
| M27 | Valider `req.params.userId` comme integer | 2 min | `auth.js:603` |
| M28 | `fs.promises.writeFile` au lieu de writeFileSync | 5 min | `sorties.js:436` |
| M29 | Transport nodemailer lazy (pas au chargement) | 5 min | `contact.js:8-13` |
| M30 | Logger erreur dans web-push sendToUser | 2 min | `web-push.js:66` |
| M31 | Guard capacityMax = 0 | 5 min | `sortie-inscriptions.js:100` |
| M32 | Schema.sql: ajouter `'direction'` dans ENUM | 2 min | `schema.sql:133` |
| M33 | Migration FK sur sortie_inscriptions | 5 min | `migrations/011` |
| M34 | Migrations: ajouter `USE ccs_salouel;` | 10 min | `migrations/006-013` |
| M35 | Migrate.js: utiliser DB_PORT au lieu de 3306 | 2 min | `migrate.js:79` |
| M36 | install-backup-cron.ps1: rendre portable | 5 min | `install-backup-cron.ps1` |
| M37 | nginx.conf: `/test/` → `/tests/` | 2 min | `nginx.conf.example:110` |
| M38 | ci.yml: seed sans || true, vérifier résultat | 5 min | `ci.yml:57` |
| M39 | electron-main.js: passer ELECTRON_RUN_AS_NODE | 5 min | `electron-main.js:42` |
| M40 | package.json: glob pour les tests | 5 min | `package.json:13` |
| M41 | Logger pino: args multiples → objet | 5 min | `database.js:34`, `sorties.js:559` |
| M42 | Logger upload.js: erreurs non loggées | 2 min | `upload.js:100` |
| M43 | Course-scraper: try/catch sur readFileSync | 2 min | `course-scraper.js:47` |

### Priorité 🟡 BASSE

| # | Tâche | Effort | Fichier |
|---|-------|--------|---------|
| B1 | Remplacer 28× `transition: all` | 30 min | Multiples CSS |
| B2 | `.toast.warning` couleur distincte | 5 min | `style.css:1721` |
| B3 | Définir `--f-mono` dans theme.css | 5 min | `theme.css` |
| B4 | Rendre overflow:hidden spécifique | 5 min | `fx.css:124` |
| B5 | Limiter cursor:none aux containers | 5 min | `fx.css:249` |
| B6 | Supprimer `em { font-style: italic; }` | 2 min | `style.css:128` |
| B7 | Skeleton 4 items | 5 min | `index.html` |
| B8 | `<img src=""` → masquer CSS | 5 min | `sortie.html:41` |
| B9 | Catch vide sitemap → logger | 2 min | `server.js:182,189` |
| B10 | `SCRAPE_GRACE_DAYS ?? '90'` | 2 min | `server.js:473` |
| B11 | Logger TOTP catch vide | 2 min | `auth.js:150` |
| B12 | Tests: ajouter mocks réseau scraper | 30 min | `tests/` |
| B13 | Tests: ajouter tests pagination/filtres | 30 min | `tests/` |
| B14 | Tests: ajouter tests admin CRUD | 30 min | `tests/` |
| B15 | Tests: fixer test newsletter flaky | 10 min | `tests/` |
| B16 | Tests: vérifier sortieId dans journey | 5 min | `tests/` |
| B17 | Tests: ajouter test validation password | 10 min | `tests/` |
| B18 | Tests: ajouter test rate-limiting | 15 min | `tests/` |
| B19 | ESLint config + CI step | 30 min | Configuration |
| B20 | Ajouter `GOOGLE_MAPS_KEY` + `MAPILLARY_TOKEN` dans .env.example | 2 min | `.env.example` |
| B21 | CSP: éliminer `unsafe-inline` | 1-2 h | `server.js` + frontend |
| B22 | Seed: bcrypt rounds 12 → 10 | 2 min | `seed.js:428` |

---

## 6. DONE — Tout ce qui a été fait

### 🔒 Sécurité

| Correctif | Détail |
|-----------|--------|
| Fuite `.env` historique git | Purge complète + rotation JWT + .gitignore |
| Dossier `.claude/` | Retiré de l'historique |
| Mots de passe seed.js console | Encapsulés dans `if (NODE_ENV !== 'production')` |
| Mot de passe backup-db.js | Plus en argument CLI |
| XSS weather.js | Fallback → `esc()` |
| XSS sortie.js (popup + scrub) | `esc()` systématique |
| XSS profil.js | `innerHTML` → `esc()` |
| Strava webhook subscription_id | Vérification implémentée (strava.js:506-512) |
| CSP strict | Helmet configuré sans unsafe-eval |
| Anti open-redirect | Domaine vérifié après login |
| 2FA TOTP | 8 codes backup hashés sha256 |
| JWT rotation | Fingerprint + détection réutilisation |
| escapeHtml() | Systématique sur toutes les données utilisateur |

### 🔧 Backend

| Correctif | Fichier |
|-----------|---------|
| Refactoring complet routes → controllers | 10 commits, 20 controllers |
| Login boucle infinie cross-port | auth.js: SameSite + sessionStorage |
| Météo cassée (JS Date) | database.js: dateStrings |
| Profil altimétrique Safari | sortie.js: AbortController fallback |
| Schéma SQL fragilités | schema.sql: IF NOT EXISTS, index FKs |
| `\|\|` → `??` nullish coalescing | 10+ fichiers |
| `CCS_CFG` dead code | 10+ fichiers → `window.CCS_CONFIG.apiBase` |
| OSRM timeout | routing.js: AbortSignal.timeout() |
| GPX orphelins | sorties.js: nettoyage auto DELETE |
| Graceful shutdown | server.js: SIGTERM/SIGINT → drain |
| DB injoignable → 503 | server.js: errResponse() |
| Memory leak auth.js | auth.js: _ccsNavClickBound guard |
| Undefined checks admin/parcours | pages/admin.js, pages/creer-parcours.js |

### 🎨 Frontend

| Correctif | Fichier |
|-----------|---------|
| auth.js polling → Promise | auth.js: CCS_AUTH.ready() |
| Login sans `<form>` | Refonte ARIA complète |
| Mot-de-passe-oublié | Page + endpoint créés |
| `</div>` orphelin | sorties.html supprimé |
| Incohérences géo | Tout sur Salouel (80480) |
| Images Unsplash → SVG | 7 héros SVG inline |
| Profil altimétrique 0×0 | Retry au prochain frame |
| Heading Street View | Rhumb line + look-ahead |
| Tracé peu visible | Triple-polyline |
| Animations trop rapides | Step 0.0008/100ms |
| Logo nav chevauchement | flex-shrink + masquage |
| Thèmes clair/sombre | 3 modes + switcher 3-way |
| Notifications push | VAPID + cloche + polling 60s |
| Favoris + inscriptions 1-clic | CRUD + capacité max |
| Dashboard membre | Mon espace (4 compteurs) |
| Recherche POI live | Debounce 120ms |
| FOUC boutons géants | `transition: all` → propriétés visuelles |
| Duplicate `*:focus` | Supprimé |
| Duplicate `.toast` | Supprimé |
| Skeleton `.loading` | Class au lieu de pseudo-classes |
| var → let/const | offline.js |
| Visibility cleanup | member-journey.js |
| search-palette init | Flag unique |
| scroll-fx IO | Un seul observer |

### 🧪 Tests

| Correctif | Détail |
|-----------|--------|
| 47 problèmes audités | 8 critiques, 12 sérieux, 15 modérés, 12 CSS |
| 40 endpoints testés | GET/POST/PUT/DELETE |
| 25 pages HTML vérifiées | 0 assets manquants |
| 78+ tests | 11 suites intégration |
| npm audit fix | 5/6 vulnérabilités corrigées |
| CI GitHub Actions | Matrice Node 18/20 |
| Vérification DB | 25 tables, connexion OK |

---

## 7. Annexes

### A. Service Worker — Versions

| v | Commit | Changement |
|---|--------|------------|
| v28 | 540ea0e | Fix minimap z-index + fermeture Échap |
| v29 | 67cc5f4 | Street View repli satellite + lien Maps |
| v30 | 91aeff0 | Créer parcours visible |
| v31 | 0e76c4c | Directions en carnet de route |
| v32 | b253998 | Filtrage directions (vrais virages) |
| v33 | 7b76b14 | Cache-busting GPX, network-first |
| v34 | 079c888 | FOUC boutons — transition |

### B. Git — Top 15 commits

```
079c888 fix(ui): transition all → propriétés visuelles
7b76b14 fix(parcours): cache-busting GPX SW
b253998 fix(parcours): filtres directions
0e76c4c fix(parcours): directions en carnet de route
91aeff0 fix(admin): Créer parcours visible
67cc5f4 fix(street-view): repli satellite
540ea0e fix(carte): minimap refermable
e5beced feat(parcours): directions tour-par-tour
688ac16 feat(parcours): createur cliquable
9466d0b feat(robustesse): DB injoignable → 503
a47418d feat(robustesse): graceful shutdown
c6f5abe refactor(arch): sorties → controller
5b2810e refactor(arch): auth → controller
b33e322 refactor(arch): strava → controller
d346e2d refactor(arch): admin → controller
```

### C. Recommandations post-prod

1. **Monitoring** — UptimeRobot ou Sentry pour erreurs 5xx
2. **Logs** — Visualiser Pino avec un outil (e.g. BetterStack)
3. **CDN** — Prévoir si >1 000 GPX
4. **OSRM** — Instance dédiée si usage intensif
5. **Rate-limit** — Surveiller les logs de throttling
6. **Backups** — Vérifier la rétention 14j fonctionne
7. **Security.txt** — Déjà en place, à maintenir

---

*Audit exhaustif — 100 problèmes recensés, 29 déjà corrigés, 71 restants.*
