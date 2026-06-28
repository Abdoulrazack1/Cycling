# Audit Exhaustif — C.C. Salouel

**Dernière mise à jour :** 28 juin 2026  
**Agents d'audit :** 14 experts spécialisés  
**Commits :** 90 | **Endpoints :** 137 | **Fichiers :** ~200

---

## 1. Vue d'ensemble

| Métrique | Valeur |
|----------|--------|
| Backend (src/) | 52 fichiers, ~9 500 L |
| Frontend JS | 45 fichiers, ~673 KB |
| CSS | 16 fichiers, ~289 KB |
| HTML | 25 pages, ~3 900 L |
| Routes API | **137 endpoints** |
| Tables MySQL | 25 |
| Migrations | 13 fichiers |
| Tests | 14 fichiers, ~100 cas |
| Scripts CLI | 21 fichiers |
| Dépendances | 23 npm |

**Score par domaine :**

| Domaine | Score | Agent |
|---------|-------|-------|
| Architecture | 7.5/10 | Architect |
| Controllers | 8.1/10 | Backend |
| Services | 7.3/10 | Services |
| Tests | 47/100 | Testing |
| HTML/A11y | 8.1/10 | HTML |
| Performance | — | Perf |
| Scripts | 6.8/10 | Scripts |

---

## 2. Architecture

```
src/
├── server.js              # Point d'entrée (527 L)
├── config/database.js     # Pool MySQL 10 connexions
├── controllers/           # 21 fichiers
├── routes/                # 21 fichiers
├── services/              # 11 fichiers
├── middleware/             # auth.js, upload.js
└── lib/                   # errors.js, logger.js, async-handler.js

public/
├── 25 pages HTML
├── asset/js/              # 24 racine + 21 pages/
├── asset/css/             # 16 fichiers
├── sw.js                  # Service Worker v34
└── manifest.webmanifest   # PWA
```

**Middleware Express (ordre) :** dotenv → validation env → pinoHttp → helmet (CSP) → cors → CSP report → sitemap.xml → body parsers → globalLimiter → authLimiter → contactLimiter → inscriptionLimiter → adminLimiter → compression → static files → cache public → maintenance mode

**Points forts architecture :**
- MVC propre (routes → controllers → services)
- Error handling centralisé (`errResponse()` avec correlation ID)
- Auth centralisée (JWT + refresh rotation + 2FA)
- Audit trail complet (`audit-log.js` fire-and-forget)
- Migrations versionnées sans dépendance externe
- Graceful shutdown (SIGTERM/SIGINT → drain + pool close)
- Logging structuré (Pino avec redaction secrets)

**Faiblesses architecture :**
- Pas de service layer (controllers = handlers + SQL direct)
- `async-handler.js` jamais utilisé (40+ try/catch manuels)
- `notify()`/`notifyMany()` dans controllers au lieu de services
- Controllers volumineux (auth 805L, sorties 844L)
- Frontend vanilla sans bundler ni type checking

---

## 3. Registre complet des problèmes

### Légende
- 🔴 Critique = plantage, sécurité, données
- 🟠 Sérieux = bug fonctionnel, fuite
- 🟡 Modéré = robustesse, dette
- ⚪ Mineur = polish, perf

---

### 3.1 🔴 CRITIQUE (12)

| ID | Source | Fichier:Ligne | Problème |
|----|--------|--------------|----------|
| C1 | Scripts | `scripts/validate-gpx.js:27` | `SEED_PATH` → `../seed.js` (ENOENT) |
| C2 | Scripts | `scripts/dump-seed-to-static.js:32` | Même bug path seed.js |
| C3 | Scripts | `scripts/build-courses.js:558` | GPX avec `<n>` au lieu de `<name>` — XML invalide |
| C4 | Scripts | `scripts/analyze-gpx.js:33-44` | Stack overflow sur >100k points + paths hardcodés Windows |
| C5 | Backend | `controllers/sorties.js:282,664` | **Fuite SQL** — `err.sqlMessage` exposée au client |
| C6 | Backend | `controllers/strava.js:535` | `DELETE ... WHERE strava_id` — colonne inexistante → suppression ineffective |
| C7 | Sécurité | `controllers/admin.js:248` | **XSS dans emails broadcast** — `message` injecté en HTML brut |
| C8 | Sécurité | `controllers/admin.js:241` | **SQL concat** dans broadcast WHERE clause |
| C9 | Config | `nodemailer@8.0.11` | **Vulnérabilité HIGH** — bypass disableFileAccess |
| C10 | Sécurité | `pages/admin.js:26,74,89` | **XSS stocké** — innerHTML avec données API non échappées |
| C11 | Scripts | `scripts/dump-seed-to-static.js:63` | `new Function()` = équivalent eval() |
| C12 | DB | `auth.js:519` | Colonne `coureur` inexistante dans `palmares` — requête plante silencieusement |

---

### 3.2 🟠 SÉRIEUX (22)

| ID | Source | Fichier:Ligne | Problème |
|----|--------|--------------|----------|
| S1 | Backend | `controllers/auth.js:603` | `req.params.userId` pas validé comme integer |
| S2 | Backend | `controllers/sorties.js:436` | `writeFileSync` bloquant dans handler async |
| S3 | Sécurité | `routes/stats.js:12` | `POST /api/stats/flush` **sans aucune auth** |
| S4 | Services | `strava-client.js:70,87,136` | Aucun timeout sur fetch API Strava |
| S5 | Backend | `controllers/strava.js:351` | Aucun timeout sur fetch GPX Strava |
| S6 | Backend | `controllers/contact.js:8-13` | Transport nodemailer créé sans SMTP_HOST |
| S7 | Backend | `controllers/admin.js:92` | `LIMIT ${limit}` interpolation SQL directe |
| S8 | Backend | `controllers/sortie-inscriptions.js:100` | `capacityMax = 0` bloque toutes les inscriptions |
| S9 | Services | `web-push.js:66` | Erreur DB silencieuse dans sendToUser |
| S10 | Frontend | `gpx-drop.js:99` | `'Bearer ' + token()` → header `'Bearer null'` |
| S11 | Backend | `controllers/pois.js:12`, `pois-admin.js:33` | `parseFloat(null)` → NaN |
| S12 | Frontend | `pages/membre.js:32` | `esc()` n'échappe pas `'` |
| S13 | Frontend | `pages/login.js:46,48` | `CCS_AUTH` sans `window.` |
| S14 | DB | `membres.js:63` | Test `role === 'modo'` au lieu de `'moderateur'` |
| S15 | DB | `migrations/006,012` | Pas de `USE ccs_salouel;` |
| S16 | DB | `migrations/013:15` | `UNIQUE endpoint(191)` — prefix trop court pour Web Push |
| S17 | DB | `search.js` | LIKE %...% sans FULLTEXT INDEX — full scan |
| S18 | DB | `schema.sql:133` | ENUM manque `'direction'` |
| S19 | DB | `stats.js:32` | Table `segments` au lieu de `segments_global` |
| S20 | DB | `sortie-inscriptions.js:81-147` | Inscription sans transaction (race condition TOCTOU) |
| S21 | DB | `auth.js:206` | Race condition `MAX(numero)` pour numéro adhérent |
| S22 | DB | `database.js:9` | Mot de passe vide par défaut en dev |

---

### 3.3 🟡 MODÉRÉ (68)

**Backend (20) :**
| ID | Fichier:Ligne | Problème |
|----|--------------|----------|
| M1 | `auth.js:53` | `COOKIE_SECURE` jamais lue |
| M2 | `gpx.js:37,52` | Regex GPX filename trop restrictive (rejette .GPX) |
| M3 | `scrape-sorties.js:44` | `--only` sans guard si dernier arg |
| M4 | `scrape-sorties.js:168` | Overpass API `overpass.kumi.systems` instable |
| M5 | `auth.js:544` | Parse error silencieux JSON payload |
| M6 | `build-courses.js:627` | `--course` sans argument → traite tout |
| M7 | `build-courses.js:558`, `generate-gpx.js:272` | Pas d'échappement XML dans GPX |
| M8 | `newsletter.js:54` | `req.protocol` insecure derrière proxy |
| M9 | `strava.js:37-43` | `_slugify` dupliqué |
| M10 | `server.js:264` | `inscriptionLimiter` skip trop large |
| M11 | `ocr-2jam-pdfs.js:129` | Worker Tesseract non terminé sur erreur |
| M12 | `scrape-sorties.js:78` | User-Agent obsolète `Chrome/124` |
| M13 | `admin.html:22` | `data-requires-auth` redondant |
| M14 | `database.js:13` | `pool.queueLimit: 0` illimité |
| M15 | `evenements.js:158-169` | Update non-partiel (écrase tous les champs) |
| M16 | `sorties.js:248` | Update non-partiel (écrase tous les champs) |
| M17 | `pois.js:77,109` | bulkReplace/update sans validation |
| M18 | `admin.js:155` | Mutation de `process.env` en runtime |
| M19 | `strava.js:17` | OAuth state en mémoire (perdu au restart) |
| M20 | `strava.js:494` | Webhook verify_token prévisible |

**Frontend (12) :**
| ID | Fichier:Ligne | Problème |
|----|--------------|----------|
| M21 | `pages/segments.js:65-66` | `s.name`/`s.location` injectés bruts (XSS) |
| M22 | `pages/palmares.js:39-40` | `r.titre`/`r.evenement` injectés bruts (XSS) |
| M23 | `weather.js:272` | Fallback `(s=>s)` laisse HTML brut |
| M24 | `sortie.js:609` | Event listener leak dans renderPoiList |
| M25 | `sortie-gallery.js:137` | Keydown listener leak (non retiré au close) |
| M26 | `pages/sorties.js:137` | `data-title` sans escHtml |
| M27 | `pages/admin.js:718` | `data-msg` JSON stringify non sécurisé |
| M28 | `sortie.js:935` | Scrub tick title non échappé |
| M29 | `auth.js:412-419` | Nav click listener leak (corrigé) |
| M30 | `pages/admin.js:3-4` | CCS_CONFIG undefined (corrigé) |
| M31 | `pages/creer-parcours.js:6-7` | CCS_CONFIG undefined (corrigé) |
| M32 | `offline.js:5,19` | `var` au lieu de `let`/`const` (corrigé) |

**HTML/A11y (10) :**
| ID | Fichier:Ligne | Problème |
|----|--------------|----------|
| M33 | `offline.html` | Pas de `<main>`, pas de skip-link, pas de manifest |
| M34 | `mot-de-passe-oublie.html:30` | Pas de `<h1>` (h2 utilisé) |
| M35 | `reset-password.html:30` | Pas de `<h1>` (h2 utilisé) |
| M36 | `import-sortie.html:130` | CSS dans `<body>` |
| M37 | `admin.html:28-99` | Sidebar `<aside>` devrait être `<nav>` |
| M38 | `profil.html:436,474` | Modals sans `role="dialog"` |
| M39 | 6 pages | apple-touch-icon manquant |
| M40 | `admin.html:30-93` | Boutons SVG sans `aria-label` |
| M41 | `strava-activites.html:49` | Input search sans `aria-label` |
| M42 | `index.html:131,355` | `alt=""` sur images à contenu |

**PWA (8) :**
| ID | Fichier:Ligne | Problème |
|----|--------------|----------|
| M43 | `notifications.js:151-157` | pushUnsubscribe sans vérif propriétaire endpoint |
| M44 | `manifest.webmanifest:34` | `sizes: "32x32"` sur SVG (devrait être `"any"`) |
| M45 | `sw.js:40` | cache.addAll error swallowed |
| M46 | `sw.js:1` | Commentaire stale-while-revalidate inexact |
| M47 | `push.js:47` | Pas de vérification `keyRes.ok` |
| M48 | 5 pages | Tags Apple PWA manquants |
| M49 | `manifest.webmanifest` | Pas de champ `id` |
| M50 | `push.js` | Pas de re-subscription périodique |

**DB (8) :**
| ID | Fichier:Ligne | Problème |
|----|--------------|----------|
| M51 | `schema.sql:162` | `evenements.distance_km` INT au lieu de DECIMAL |
| M52 | `migrations/006` | Pas de IF NOT EXISTS sur MODIFY |
| M53 | `migrations/010` | Pas de ENGINE/charset |
| M54 | `migrations/011` | FK manquante sur sortie_inscriptions |
| M55 | `database.js:49` | SQL dans les logs peut exposer des données |
| M56 | `database.js` | Pas de acquireTimeout/connectTimeout |
| M57 | `seed.js:313` | Numéro téléphone en clair dans le code |
| M58 | `migrations/006-013` | Pas de `USE ccs_salouel;` |

**Config/Ops (10) :**
| ID | Fichier:Ligne | Problème |
|----|--------------|----------|
| M59 | `.env.example` | 4 variables utilisées non documentées |
| M60 | `server.js:11` | DB_PASSWORD pas dans REQUIRED_ENV |
| M61 | `package.json` | `license` manquant |
| M62 | `migrate.js:79` | Port MySQL hardcodé 3306 |
| M63 | `install-backup-cron.ps1:15` | Path hardcodé `C:\laragon\www\Cycling` |
| M64 | `nginx.conf.example:110` | Bloque `/test/` au lieu de `/tests/` |
| M65 | `ci.yml:57` | `seed \|\| true` — échec silencieux |
| M66 | `electron-main.js:42` | ELECTRON_RUN_AS_NODE pas passé au fork |
| M67 | `package.json:13` | Script test liste fichiers (pas de glob) |
| M68 | `package.json` | 8 packages à mettre à jour (dont nodemailer) |

---

### 3.4 ⚪ MINEUR (47)

**CSS (28) :**
| ID | Fichier:Ligne | Problème |
|----|--------------|----------|
| T1 | `style.css:128` | `em { font-style: italic; }` redondant |
| T2 | `style.css:1721` | `.toast.warning` = `.toast.success` |
| T3 | `style.css:61` | `--f-mono` ajouté (corrigé) |
| T4 | `fx.css:124` | `.btn { overflow: hidden; }` global |
| T5 | `fx.css:249` | `cursor: none !important` trop large |
| T6 | `index.html:175,193` | Skeleton 3 items / titre "4 sorties" |
| T7 | `sortie.html:41` | `<img src=""` requête HTTP |
| T8 | `polish.css:55` | Duplicate `*:focus` (corrigé) |
| T9 | `polish.css:817` | Duplicate `.toast` (corrigé) |
| T10 | `polish.css:141` | Skeleton `.loading` (corrigé) |
| T11-T38 | Multiples | 28× `transition: all` restants |
| T39 | `style.css:424` | `transition: all` sur `.nav-cta` |
| T40 | `journey.css` ×8 | `transition: all` |
| T41 | `polish.css` ×5 | `transition: all` |
| T42 | `strava-ux.css:224` | `transition: all` |
| T43 | `premium.css:185` | `transition: all` |
| T44 | `evenements.css:55` | `transition: all` |
| T45 | `login.css:43` | `transition: all` |
| T46 | `import-sortie.css:62` | `transition: all` |

**Tests (6) :**
| ID | Fichier | Problème |
|----|---------|----------|
| T47 | `tests/` | Score couverture 47/100 |
| T48 | `tests/` | 68% endpoints sans test |
| T49 | `tests/` | Pas de mocks DB |
| T50 | `tests/` | Pas de tests CORS/rate-limit |
| T51 | `tests/` | Pas de tests E2E frontend |
| T52 | `tests/integration/admin.test.js` | Seulement 2 tests (11 endpoints admin) |

**Divers (5) :**
| ID | Fichier | Problème |
|----|---------|----------|
| T53 | `server.js:79` | `'unsafe-inline'` dans CSP styles |
| T54 | `seed.js:428` | bcrypt 12 rounds (lent pour seed) |
| T55 | `seed.js:486` | Identifiants loggés deux fois |
| T56 | `ci.yml` | Pas de cache MySQL |
| T57 | `ci.yml` | Pas de step `npm run build` |

---

### 3.5 Bilan par gravité

| Gravité | Total | Fait | Reste |
|---------|-------|------|-------|
| 🔴 Critique | 12 | 0 | **12** |
| 🟠 Sérieux | 22 | 3 | **19** |
| 🟡 Modéré | 68 | 3 | **65** |
| ⚪ Mineur | 57 | 5 | **52** |
| **Total** | **159** | **11** | **148** |

---

## 4. Couverture des endpoints (137)

| Route | Total | Testés | Smoke | Non testés |
|-------|-------|--------|-------|------------|
| `/api/auth` | 22 | 4 | 0 | **18** |
| `/api/admin` | 12 | 1 | 0 | **11** |
| `/api/sorties` | 13 | 2 | 0 | **11** |
| `/api/evenements` | 8 | 0 | 1 | **7** |
| `/api/membres` | 6 | 0 | 1 | **5** |
| `/api/strava` | 14 | 2 | 0 | **12** |
| `/api/notifications` | 10 | 3 | 0 | **7** |
| `/api/gpx` | 4 | 0 | 0 | **4** |
| `/api/pois` | 7 | 0 | 0 | **7** |
| `/api/stats` | 2 | 2 | 0 | 0 ✅ |
| `/api/newsletter` | 4 | 4 | 0 | 0 ✅ |
| `/api/favorites` | 4 | 4 | 0 | 0 ✅ |
| `/api/my` | 4 | 4 | 0 | 0 ✅ |
| Autres | 23 | 6 | 5 | **12** |
| **TOTAL** | **137** | **30** | **7** | **~100** |

**Score couverture : 26% comportemental + 5% smoke = 31%**

---

## 5. Problèmes déjà résolus

| Correctif | Fichier |
|-----------|---------|
| FOUC boutons géants (`transition: all`) | `polish.css:130` |
| Duplicate `*:focus` | `polish.css:55` |
| Duplicate `.toast` | `polish.css:817` |
| Skeleton `.loading` | `polish.css:141` |
| XSS weather.js | `weather.js:272` |
| XSS sortie.js (popup + scrub) | `sortie.js:192,935` |
| XSS profil.js | `pages/profil.js:84` |
| Memory leak auth.js | `auth.js:412` |
| Undefined check admin | `pages/admin.js:3` |
| Undefined check parcours | `pages/creer-parcours.js:6` |
| var → let/const | `offline.js` |
| Visibility cleanup | `member-journey.js:82` |
| search-palette init | `search-palette.js:321` |
| scroll-fx IO unique | `scroll-fx.js:264` |
| CSS `--f-mono` défini | `style.css:61` |
| CSS `--gold` → `--brass` | `polish.css:416` |
| CSS `--surface-1` → `--ink-2` | `polish.css:485` |
| Fuite `.env` historique | git purge |
| Login boucle | auth.js: SameSite + sessionStorage |
| Météo cassée | database.js: dateStrings |
| Schéma SQL fragilités | schema.sql: IF NOT EXISTS |
| `\|\|` → `??` | 10+ fichiers |
| `CCS_CFG` dead code | 10+ fichiers |
| OSRM timeout | routing.js: AbortSignal |
| Strava webhook col. | strava.js:535 |
| Graceful shutdown | server.js |
| DB injoignable → 503 | server.js |

---

## 6. TODO — Tout ce qui reste à faire

### Priorité 🔴 HAUTE (12 — bloquant prod)

| # | Tâche | Effort |
|---|-------|--------|
| H1 | **Configurer SMTP réel** — newsletter, notifs, reset = code mort | 30 min |
| H2 | **Déploiement prod** — domaine, SSL, PM2, Nginx | 2-4 h |
| H3 | **RGPD : politique de confidentialité complète** | 1-2 h |
| H4 | **Nettoyer DB prod** — users test, sorties démo | 30 min |
| H5 | **Rotation DB_PASSWORD** | 15 min |
| H6 | **Corriger fuites SQL sorties.js** — errResponse() | 5 min |
| H7 | **Corriger DELETE strava.js:535** — `strava_id` → `id` | 2 min |
| H8 | **Corriger validate-gpx.js path** — `../database/seed.js` | 2 min |
| H9 | **Corriger dump-seed-to-static.js path** | 2 min |
| H10 | **Corriger build-courses.js GPX** — `<n>` → `<name>` | 5 min |
| H11 | **Corriger analyze-gpx.js stack overflow** | 5 min |
| H12 | **Corriger XSS emails broadcast** — esc() dans admin.js | 5 min |

### Priorité 🟠 MOYENNE (43)

| # | Tâche | Effort |
|---|-------|--------|
| M1 | Ajouter `requireAdmin` sur `POST /api/stats/flush` | 2 min |
| M2 | Implémenter `COOKIE_SECURE` | 5 min |
| M3 | Regex GPX : `/^[a-zA-Z0-9_.-]+\.gpx$/i` | 2 min |
| M4 | `parseFloat(null)` → null dans pois | 5 min |
| M5 | Bearer null → n'ajouter que si token valide | 2 min |
| M6 | `AbortSignal.timeout(30000)` sur Strava fetches | 15 min |
| M7 | Overpass → `overpass-api.de` | 2 min |
| M8 | `safeJsonParse()` pour auth.js | 5 min |
| M9 | Guard `--course` sans argument | 5 min |
| M10 | Échapper XML dans GPX builder | 10 min |
| M11 | `req.secure ? 'https' : req.protocol` | 2 min |
| M12 | Extraire `_slugify` vers helper | 10 min |
| M13 | Ajuster inscriptionLimiter skip | 5 min |
| M14 | Ajouter `'` dans `esc()` membre.js | 2 min |
| M15 | `window.CCS_AUTH` dans login.js | 2 min |
| M16 | `try/finally` pour worker.terminate() | 5 min |
| M17 | User-Agent `Chrome/130` | 2 min |
| M18 | Supprimer `data-requires-auth` redondant | 2 min |
| M19 | `pool.queueLimit: 100` | 2 min |
| M20 | Skip-link + manifest dans offline.html | 5 min |
| M21 | Balises PWA dans mon-espace.html | 5 min |
| M22 | CSS dans `<head>` import-sortie.html | 5 min |
| M23 | Titre dynamique profil.html | 2 min |
| M24 | Commentaire GPX route "modo+" → "admin" | 2 min |
| M25 | Valider `req.params.userId` comme integer | 2 min |
| M26 | `fs.promises.writeFile` au lieu de writeFileSync | 5 min |
| M27 | Transport nodemailer lazy | 5 min |
| M28 | Logger erreur web-push sendToUser | 2 min |
| M29 | Guard capacityMax = 0 | 5 min |
| M30 | Schema.sql: ajouter `'direction'` | 2 min |
| M31 | Migrations: `USE ccs_salouel;` + ENGINE | 15 min |
| M32 | Migrate.js: DB_PORT | 2 min |
| M33 | nginx: `/test/` → `/tests/` | 2 min |
| M34 | ci.yml: seed sans `\|\| true` | 5 min |
| M35 | electron-main.js: ELECTRON_RUN_AS_NODE | 5 min |
| M36 | package.json: glob pour tests | 5 min |
| M37 | Logger pino args multiples | 5 min |
| M38 | XSS segments.js + palmares.js | 5 min |
| M39 | XSS admin.js data-msg → base64 | 10 min |
| M40 | Fix weather.js fallback XSS | 2 min |
| M41 | Fix sortie-gallery.js keydown leak | 5 min |
| M42 | Modals profil.html → role="dialog" | 5 min |
| M43 | Tags Apple PWA dans 5 pages | 10 min |

### Priorité 🟡 BASSE (30)

| # | Tâche | Effort |
|---|-------|--------|
| B1 | Remplacer 28× `transition: all` | 30 min |
| B2 | `.toast.warning` couleur distincte | 5 min |
| B3 | Rendre overflow:hidden spécifique | 5 min |
| B4 | Limiter cursor:none aux containers | 5 min |
| B5 | Supprimer `em { font-style: italic; }` | 2 min |
| B6 | Skeleton 4 items | 5 min |
| B7 | `<img src=""` masquer CSS | 5 min |
| B8 | Catch vide sitemap → logger | 2 min |
| B9 | Tests: ajouter 30+ tests comportementaux | 2-4 h |
| B10 | Tests: ajouter tests admin CRUD | 1-2 h |
| B11 | Tests: mocks DB | 1-2 h |
| B12 | ESLint + CI step | 30 min |
| B13 | CSP: éliminer `unsafe-inline` | 1-2 h |
| B14 | seed.js: bcrypt 12 → 10 | 2 min |
| B15 | `aria-label` sur boutons SVG | 15 min |
| B16 | `<h1>` dans mot-de-passe-oublie + reset-password | 5 min |
| B17 | `<main>` dans offline.html | 5 min |
| B18 | Sidebar admin.html → `<nav>` | 5 min |
| B19 | `alt` sur images index.html | 5 min |
| B20 | pushUnsubscribe: vérifier propriétaire | 5 min |
| B21 | manifest: `sizes: "any"` pour SVG | 2 min |
| B22 | sw.js: nettoyer commentaire stale-while-revalidate | 2 min |
| B23 | push.js: vérifier `keyRes.ok` | 2 min |
| B24 | Migrations: FK sur sortie_inscriptions | 5 min |
| B25 | DB: FULLTEXT indexes sur sorties/evenements | 15 min |
| B26 | DB: acquireTimeout + connectTimeout | 5 min |
| B27 | Scripts: timeout sur generate-gpx.js fetch | 5 min |
| B28 | Scripts: port DB configurable dans migrate.js | 2 min |
| B29 | Scripts: render portable install-backup-cron.ps1 | 5 min |
| B30 | .env.example: ajouter 4 variables manquantes | 5 min |

---

## 7. DONE — Tout ce qui a été fait

### 🔒 Sécurité (14 correctifs)
- Fuite `.env` historique git (purge + rotation JWT)
- XSS weather.js, sortie.js, profil.js (`esc()` systématique)
- Memory leak auth.js (nav click guard)
- CSP strict (Helmet, pas d'unsafe-eval)
- Anti open-redirect (vérification domaine)
- 2FA TOTP (8 codes backup hashés)
- JWT rotation + détection réutilisation
- escapeHtml() centralisé

### 🔧 Backend (15 correctifs)
- Refactoring complet routes → controllers (10 commits)
- Login boucle infinie (SameSite + sessionStorage)
- Météo cassée (dateStrings pool)
- Schéma SQL fragilités (IF NOT EXISTS, index FKs)
- `\|\|` → `??` (10+ fichiers)
- `CCS_CFG` dead code (10+ fichiers)
- OSRM timeout (AbortSignal)
- Graceful shutdown (SIGTERM/SIGINT)
- DB injoignable → 503

### 🎨 Frontend (20 correctifs)
- auth.js polling → Promise
- Login sans `<form>` → refonte ARIA
- Mot-de-passe-oublié créé
- Images Unsplash → 7 SVG
- Thèmes clair/sombre (3 modes)
- Notifications push VAPID
- Favoris + inscriptions 1-clic
- Dashboard membre
- FOUC boutons (transition: all)
- Duplicate CSS (focus, toast, skeleton)
- var → const (offline.js)
- Visibility cleanup (member-journey.js)
- CSS `--f-mono` défini

### 🧪 Tests (5 correctifs)
- 100 problèmes audités
- 137 endpoints inventoriés
- npm audit fix (5/6 vulns)
- CI GitHub Actions
- Vérification DB (25 tables)

---

## 8. Annexes

### A. Service Worker — Versions

| v | Changement |
|---|------------|
| v28 | Fix minimap z-index + fermeture Échap |
| v29 | Street View repli satellite |
| v30 | Créer parcours visible |
| v31 | Directions en carnet de route |
| v32 | Filtrage directions (vrais virages) |
| v33 | Cache-busting GPX |
| v34 | FOUC boutons (transition) |

### B. Recommandations post-prod
1. Monitoring (UptimeRobot / Sentry)
2. Logs structurés (Pino + BetterStack)
3. CDN si >1 000 GPX
4. Instance OSRM dédiée
5. Vérifier rate-limiting en prod
6. Security.txt à maintenir

---

*159 problèmes recensés par 14 agents experts. 11 déjà corrigés. 148 restants.*
