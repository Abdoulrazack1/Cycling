# Club de Cyclisme de Salouel — Application web

> ## 🔑 Identifiants
>
> Les identifiants par défaut (admin, membre, MySQL) sont stockés dans `CREDENTIALS.md` à la racine du projet.
> **Ce fichier est gitignoré** et ne sera jamais publié sur GitHub.
>
> Ces identifiants sont également affichés à chaque exécution de `node seed.js` dans le terminal.

---

## ⚡ Commandes essentielles

| Commande | Quand l'utiliser |
|---|---|
| `npm run dev` | **Tous les jours** — démarre le serveur (nodemon, port 3000) |
| `npm run migrate` | **Après un `git pull`** — applique les migrations BDD en attente |
| `npm run migrate:status` | Voir l'état des migrations (appliquées vs en attente) |
| `npm run scrape:save` | **Mensuel** — rafraîchit les itinéraires OSM HdF |
| `npm run backup` | Backup MySQL manuel (auto-planifié si tâche Windows installée) |
| `npm run expire:dry` | Voir quelles courses seraient supprimées par le cleanup |
| `npm run clean` | **Reset complet** — vide BDD + GPX (avec confirmation) |
| `node seed.js` | Recrée admin/membre/paramètres après un `clean` |
| `npm install` | Après un `git pull` qui ajoute des dépendances |

---

Site web complet du C.C. Salouel : frontend statique + API REST Express + MySQL + **alimentation automatique des sorties depuis OpenStreetMap** (tracés réels uniquement).

## 🚀 Fonctionnalités

### Public
- **Catalogue de sorties** alimenté en continu : itinéraires cyclables des Hauts-de-France via OpenStreetMap
- **Explorateur de parcours** (`sortie.html`) : Street View + tracé synchronisé, mini-carte directionnelle, profil altimétrique coloré par pente, météo Open-Meteo, galerie photos, POIs interactifs
- **Recherche globale Cmd+K** : palette de commandes (Linear/Notion-style) sur sorties / événements / membres / segments
- **Événements** : inscription publique avec confirmation par email
- **Calendrier de courses**, **palmarès** par saison, **segments KOM**
- **Newsletter** : inscription opt-in (double confirmation) directement depuis le footer
- **Stats publiques** : `/api/stats` agrège km/D+/sorties/membres pour les widgets home et footer
- **Couche premium UX** : progress bar fetch globale, view transitions (fade page-to-page), pull-to-refresh mobile, file de notifications (3 max), copie de lien direct sortie
- **Light mode** : 3 modes clair/sombre/auto avec switcher 3-way dans la nav, persistance localStorage, suivi `prefers-color-scheme` en mode auto
- **Vues cartographiques** : 5 presets (standard / sombre / satellite / topo / OSM) accessibles via layer control Leaflet sur les cartes sortie
- **Animations premium** : anime.js v3 (counters animés, hero parallax 3D, titre mot-par-mot rotateX, stagger reveal, card tilt 3D au hover)
- **Web Share API** : bouton partager utilise l'API native mobile (iOS/Android) avec fallback copie sur desktop
- **Raccourcis clavier globaux** : `t` cycle thème, `?` aide, `g h/s/e/m/c/p/k` navigation rapide
- **Panneau POI renforcé** : barre de recherche live + tri (km/type/A-Z) sur la page sortie
- **Cloche de notifications** dans la nav (badge unread, panneau dépliant, polling 60s)
- **Favoris sorties** : étoile sur la page sortie, liste consultable via `/api/favorites`
- **Inscription 1-clic** : bouton sur la page sortie pour les membres connectés, compteur d'inscrits public
- **Checklist d'onboarding** : 4 étapes sur le profil (profil/équipement/Strava/première sortie) avec progress bar
- **Palette d'actions admin** : `Ctrl+Shift+P` ouvre une command palette avec 19 commandes (nouveau membre/sortie/event, broadcast, maintenance, audit, scraper, etc.)
- **Breadcrumbs** auto-injectés selon la page

### Membre (auth requis)
- **Profil enrichi** : équipement éditable, FTP + zones de puissance, dashboard stats personnelles (vs club)
- **Intégration Strava** : OAuth + auto-sync des activités au premier connect + stats annuelles agrégées
- **Sessions actives** : liste de tous les appareils connectés + révocation individuelle
- **RGPD Article 20** : export complet de ses données au format JSON
- **RGPD Article 17** : suppression de compte avec confirmation password

### Admin (`admin.html`)
- **Dashboard live** : stats agrégées (sorties à venir, événements ouverts, membres liés Strava, inscriptions 7j)
- **Configuration Strava** : credentials stockés en BDD, hot-reload, aucun restart serveur requis
- **Broadcast email** : envoi groupé à tous les membres / membres / admins avec preview
- **Mode maintenance** : toggle global, 503 sur les écritures non-admin, GET reste ouvert
- **Bulk actions** : désactiver / réactiver / changer rôle plusieurs comptes en une fois
- **Galerie photos** : upload multiple par sortie + lightbox
- **Audit log** : trace les actions sensibles (delete, role_change, export_data, login…)
- **CRUD sorties / événements / palmarès / segments / POIs**

### Infrastructure
- **Authentification** JWT (access + refresh) + cookie httpOnly + 2FA TOTP (admin)
- **Migrations versionnées** : runner custom avec table `schema_migrations`, checksum sha256, transactions
- **Backup MySQL automatique** : script + tâche Windows planifiée (`schtasks`)
- **Auto-cleanup** : courses passées effacées au-delà de 90 jours (configurable)
- **Service Worker v20** : network-first HTML, cache-first assets, fallback dédié `offline.html`
- **Rate limiting** : global + auth + admin + contact + newsletter (anti-spam et anti-brute force)
- **Anti-bot** : honeypot sur contact + newsletter, CSP stricte sans `unsafe-eval`
- **`.well-known/security.txt`** RFC 9116 pour les divulgations de vulnérabilité
- **Tests** : `npm test` exécute 63 cas (33 unitaires scraper + 30 intégration auth/sorties/admin/gpx/2fa/stats/newsletter/public-endpoints)
- **Core Web Vitals** trackés côté client en `localStorage` (LCP/CLS/TTFB)

## 📦 Stack technique

- **Frontend** : HTML/CSS/JS vanilla · Leaflet · Google Street View · Canvas (profil altimétrique)
- **Backend** : Node.js 18+ · Express · MySQL2 · JWT · Bcrypt · Nodemailer · Multer
- **Services externes** :
  - **OpenStreetMap Overpass** — itinéraires cyclables nommés (avec mirrors de fallback)
  - **Open-Meteo** — élévation + météo, gratuit et sans clé
  - **OSRM cycling** — routage cyclable réel (legacy, pour génération manuelle)
- **Base de données** : MySQL 8+ / MariaDB 10.6+

---

## 🛠 Installation

### 1. Prérequis
- Node.js 18+
- MySQL 8+ ou MariaDB 10.6+ (Laragon recommandé sous Windows)

### 2. Base de données

```sql
-- Dans HeidiSQL/DBeaver, en tant que root :
CREATE USER 'ccs_user'@'localhost' IDENTIFIED BY 'CCS_Salouel_2025!';
CREATE DATABASE IF NOT EXISTS ccs_salouel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON ccs_salouel.* TO 'ccs_user'@'localhost';
FLUSH PRIVILEGES;
```

Puis exécute `schema.sql` sur la base `ccs_salouel`.

### 3. Configuration `.env`

```env
# ── Base ──────────────────────────────────────────────────────
DB_HOST=localhost
DB_USER=ccs_user
DB_PASSWORD=CCS_Salouel_2025!
DB_NAME=ccs_salouel

# ── Auth ──────────────────────────────────────────────────────
JWT_SECRET=<secret_aléatoire_32+_caractères>
JWT_REFRESH_SECRET=<autre_secret_différent_32+_caractères>
COOKIE_SECURE=false              # true en prod (HTTPS only)

# ── Auto-cleanup ──────────────────────────────────────────────
SCRAPE_GRACE_DAYS=90             # Délai avant suppression auto des courses passées
DISABLE_AUTO_EXPIRE=false        # true pour désactiver le cron 24h

# ── Email transactionnel (optionnel) ──────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=contact@ccs-salouel.fr
SMTP_PASS=<app_password_gmail>
EMAIL_FROM=C.C. Salouel <contact@ccs-salouel.fr>
EMAIL_ADMIN=president@club-salouel.fr

# ── Strava OAuth (optionnel, config aussi via UI admin) ──────
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/callback

# ── Externes (optionnels) ─────────────────────────────────────
GOOGLE_MAPS_KEY=                 # Street View API
OSRM_BASE=https://router.project-osrm.org
GALACTIC_REPOS_BASE=             # Pour l'agent MCP galactic-brain
```

### 4. Premier démarrage

```bash
npm install
node seed.js                 # crée admin + membre + paramètres club
npm run scrape:save          # importe les itinéraires OSM HdF
npm run dev                  # démarre le serveur sur http://localhost:3000
```

### 5. Frontend

Ouvre `index.html` avec **Live Server** (extension VS Code, port 5500) ou tout serveur HTTP local. L'API est configurée pour `http://localhost:3000/api`.

---

## 🤖 Système d'alimentation automatique

### Vue d'ensemble

Le scraper récupère les **itinéraires cyclables nommés** depuis OpenStreetMap pour les 5 départements Hauts-de-France (02, 59, 60, 62, 80). Ce sont des tracés réels mappés par la communauté OSM, pas des approximations.

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  OSM Overpass    │  →   │  Filtre HdF      │  →   │  Open-Meteo      │
│  route=bicycle   │      │  + longueur      │      │  (élévation)     │
│  + name          │      │  + langue        │      │                  │
└──────────────────┘      └──────────────────┘      └──────────────────┘
                                                              │
                          ┌─────────────────┐                 ▼
                          │   asset/gpx/    │  ←  ┌──────────────────┐
                          │   *.gpx         │     │   gpx-builder    │
                          └─────────────────┘     └──────────────────┘
                                  │
                                  ▼
                          ┌─────────────────┐
                          │  MySQL          │
                          │  sorties + pois │
                          └─────────────────┘
```

### Filtres appliqués

- **Zone administrative** : `area["name"="Hauts-de-France"]["admin_level"="4"]` (exclut Belgique/Pays-Bas)
- **Type** : `route=bicycle` avec un `name`, sauf `network=icn` (international)
- **Longueur** : entre 15 et 500 km (exclut les sentiers courts et les EuroVelo entiers)
- **Langue** : exclut les noms contenant `knooppunt`, `fietsroute`, `radweg`, etc.

### Auto-cleanup des courses passées

À chaque démarrage du serveur (et toutes les 24h ensuite), le script `expire-past-sorties.js` tourne en arrière-plan et :

1. Trouve toutes les sorties dont la date < `aujourd'hui - SCRAPE_GRACE_DAYS`
2. Supprime leur fichier GPX dans `asset/gpx/`
3. Supprime leur entrée en BDD (et tables liées : `pois`, `sortie_tags`, etc.)

**Les itinéraires OSM ne sont jamais supprimés** — leur date est `2099-12-31` (parcours permanents).

Configurable via `SCRAPE_GRACE_DAYS` dans `.env` (défaut : 7 jours).

### Commandes du scraper

```bash
npm run scrape              # dry-run, ne touche à rien
npm run scrape:save         # OSM HdF + écriture BDD
npm run scrape:full         # OSM + MilesRepublic (events sans GPX)

# Variantes :
node scripts/scrape-sorties.js --osm --save-db --limit 10   # tester sur 10 events
node scripts/scrape-sorties.js --osm --save-db --force      # re-traiter même les existants
node scripts/scrape-sorties.js --allow-approx               # autorise tracés OSRM (déconseillé)
```

### Commandes de cleanup

```bash
npm run expire:dry          # liste ce qui serait supprimé
npm run expire              # supprime maintenant (sans attendre le cron 24h)
npm run clean               # RESET TOTAL (avec confirmation)
node scripts/clean-sorties.js --keep-gpx    # vide juste la BDD
node scripts/clean-sorties.js --keep-db     # supprime juste les GPX
```

---

## 📄 Pages disponibles

| Page | Description |
|---|---|
| `index.html` | Accueil dynamique (dernière sortie, sorties récentes) |
| `sorties.html` | Catalogue complet avec filtres (futures / passées) |
| `sortie.html?id=XXX` | **Explorateur** : Street View, satellite, GPX, POIs, profil, météo |
| `parcours.html` | Catalogue des tracés GPX |
| `evenements.html` | Calendrier des courses |
| `palmares.html` | Résultats par saison |
| `segments.html` | Classements KOM et zones d'entraînement |
| `membres.html` | Trombinoscope public du club |
| `club.html` | Histoire, bureau, infos pratiques |
| `contact.html` | Formulaire (envoi email) |
| `profil.html` | Profil sociétaire (après login) |
| `login.html` | Connexion + inscription |
| `mot-de-passe-oublie.html` | Réinitialisation password |
| `admin.html` | Panneau d'administration **(admin uniquement)** |

---

## 🔌 API REST

**Base URL** : `http://localhost:3000/api`

### Routes publiques

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/sorties` | Liste des sorties (params : `statut`, `limit`, `offset`) |
| GET | `/sorties/:id` | Détail d'une sortie |
| GET | `/sorties/:id/pois` | POIs d'une sortie |
| GET | `/sorties/:id/photos` | Galerie photos d'une sortie |
| GET | `/evenements` | Calendrier |
| GET | `/evenements/:id` | Détail événement + inscrits |
| POST | `/evenements/:id/inscrire` | Inscription publique (rate-limited) |
| GET | `/membres` | Liste des membres actifs |
| GET | `/membres/:id` | Fiche publique d'un membre |
| GET | `/segments` | Liste des segments KOM |
| GET | `/palmares` | Résultats par saison |
| GET | `/club` | Paramètres du club |
| GET | `/search?q=...` | Recherche globale (sorties + events + membres + segments) |
| POST | `/auth/login` | Connexion (+ TOTP si 2FA activé) |
| POST | `/auth/register` | Inscription |
| POST | `/auth/refresh` | Rafraîchir l'access token |
| POST | `/auth/forgot-password` | Demande reset password (mail si SMTP configuré) |
| POST | `/auth/reset-password` | Soumettre nouveau password avec token JWT |
| POST | `/contact` | Envoyer un message (rate-limited) |

### Routes membre (auth requis)

| Méthode | Route | Description |
|---|---|---|
| GET | `/auth/me` | Profil de l'user connecté + équipement |
| POST | `/auth/logout` | Déconnexion (révoque refresh token) |
| POST | `/auth/change-password` | Changement password |
| GET | `/auth/sessions` | Liste les sessions actives |
| DELETE | `/auth/sessions/:id` | Révoque une session |
| DELETE | `/auth/sessions` | Révoque toutes sauf la courante |
| GET | `/auth/export-data` | RGPD art. 20 — export JSON complet |
| DELETE | `/auth/account` | RGPD art. 17 — suppression de compte |
| POST | `/auth/equipment` | Ajouter un équipement |
| PUT | `/auth/equipment/:id` | Modifier équipement |
| DELETE | `/auth/equipment/:id` | Supprimer équipement |
| GET | `/membres/me/dashboard` | Stats persos vs club + événements à venir |
| GET | `/strava/status` | État de la connexion Strava |
| GET | `/strava/connect` | Lance flow OAuth (redirect Strava) |
| GET | `/strava/callback` | Callback OAuth + auto-sync |
| POST | `/strava/disconnect` | Délie le compte Strava |
| POST | `/strava/sync` | Sync manuel des activités |
| GET | `/strava/activities` | Liste des activités importées |
| GET | `/strava/stats` | Agrégats annuels (km, D+, temps, allure) |

### Routes modérateur+

| Méthode | Route | Description |
|---|---|---|
| POST | `/sorties` | Créer une sortie |
| PUT | `/sorties/:id` | Modifier une sortie |
| POST | `/sorties/import-gpx` | Import GPX + cue sheet → sortie + POIs auto |
| POST | `/sorties/:id/photos` | Upload photos (multipart, max 8 photos × 8 MB) |
| DELETE | `/sorties/:id/photos/:photoId` | Supprimer une photo |
| POST | `/sorties/:id/pois` | Ajouter un POI |
| DELETE | `/sorties/:id/pois/:poiId` | Supprimer un POI |
| POST | `/evenements` | Créer un événement |
| PUT | `/evenements/:id` | Modifier un événement |

### Routes admin

| Méthode | Route | Description |
|---|---|---|
| DELETE | `/sorties/:id` | Supprimer une sortie |
| GET | `/gpx` | Lister fichiers GPX |
| POST | `/gpx/upload` | Uploader un GPX |
| POST | `/auto-courses/generate` | Générer un GPX depuis waypoints |
| GET | `/admin/dashboard-live` | Stats live agrégées (multi-table) |
| GET | `/admin/strava-config` | État config Strava (sans secret) |
| POST | `/admin/strava-config` | Set credentials Strava (hot-reload) |
| DELETE | `/admin/strava-config` | Désactiver l'intégration Strava |
| POST | `/admin/broadcast` | Envoi mail à tous / membres / admins |
| GET | `/admin/maintenance` | État du mode maintenance |
| POST | `/admin/maintenance` | Activer/désactiver maintenance |
| PATCH | `/admin/users/bulk` | Bulk actions sur comptes (deactivate / set_role) |
| GET | `/admin/audit-log` | Journal d'audit (filtres + pagination) |
| POST | `/admin/audit-log/purge` | Purge des entrées anciennes |

---

## 📂 Structure du projet

```
Cycling/
├── *.html                       # 19 pages frontend (admin, profil, sortie, etc.)
├── asset/
│   ├── css/
│   │   ├── style.css            # Tokens, reset, composants globaux (89 KB)
│   │   ├── polish.css           # Overrides, animations, responsive (78 KB)
│   │   ├── admin.css            # Panel admin + sidebar + ops (19 KB)
│   │   ├── profil.css           # Cards de sécurité + responsive
│   │   ├── membres.css          # Grille trombinoscope
│   │   ├── login.css            # Checkbox auth + spinner
│   │   ├── evenements.css       # Modale d'inscription
│   │   └── parcours.css         # Badge Street View hover
│   ├── js/
│   │   ├── pages/               # 1 fichier par page HTML
│   │   ├── weather.js           # Open-Meteo (forecast + archive)
│   │   ├── sortie-gallery.js    # Galerie photos + lightbox
│   │   ├── search-palette.js    # Recherche globale Cmd+K
│   │   ├── ocr-pdf.js           # OCR PDF Strava (pdf.js + Tesseract)
│   │   ├── auth, data, main, utils, sortie, ...
│   ├── img/                     # WebP (img-*.webp) + SVG (hero-*.svg)
│   ├── gpx/                     # Fichiers GPX (scraper + import manuel)
│   └── data/                    # pois-courses.json (legacy)
├── routes/                      # 14 fichiers Express (auth, sorties, strava, admin…)
├── services/
│   ├── strava-client.js         # OAuth + auto-refresh + sync activités
│   ├── mailer.js                # Templates email transactionnels
│   ├── audit-log.js             # Audit fire-and-forget
│   ├── gpx-parser.js            # Parser GPX 1.0/1.1 + métriques
│   ├── gpx-builder.js           # Construction GPX 1.1
│   ├── routing.js               # OSRM cycling
│   ├── elevation.js             # Open-Meteo + calcul D+/D−
│   ├── course-generator.js      # Pipeline génération
│   └── course-scraper.js        # Scraper MilesRepublic (fallback)
├── middleware/                  # auth, upload (multer)
├── config/                      # Config DB (mysql2 pool)
├── migrations/                  # 002-009 + futures (versionnées)
│   ├── 002_indexes.sql
│   ├── 003_audit_log.sql
│   ├── 004_2fa_totp.sql
│   ├── 007_sortie_photos.sql
│   ├── 008_strava_oauth.sql
│   └── 009_audit_export_action.sql
├── scripts/
│   ├── migrate.js               # Runner versionné avec schema_migrations ⭐
│   ├── scrape-sorties.js        # Scraper principal OSM HdF
│   ├── expire-past-sorties.js   # Cleanup auto courses passées (90j)
│   ├── clean-sorties.js         # Reset complet BDD + GPX
│   ├── install-backup-cron.ps1  # Tâche Windows backup quotidien
│   ├── backup-db.js             # Dump mysqldump compressé + rotation
│   ├── purge-audit-log.js       # Purge audit_log selon retention
│   └── analyze-gpx.js           # Diagnostic d'un fichier GPX
├── server.js                    # Express + cron auto-expire 24h + maintenance middleware
├── sw.js                        # Service Worker (network-first HTML, cache-first assets)
├── seed.js                      # Peuplement initial admin/membre/club
├── schema.sql                   # Schéma MySQL
├── manifest.webmanifest         # PWA manifest
├── package.json
└── .env
```

---

## 🗺 Page sortie : explorer un parcours

`sortie.html?id=XXX` propose 3 modes de vue :

1. **Google Street View** (iframe embed avec heading aligné au tracé)
2. **Vue satellite** (Esri World Imagery via Leaflet)
3. **Carte OSM** (OpenStreetMap)

**Fonctionnalités :**
- Tracé jaune triple-polyline (ombre + halo + trait fin) très visible
- Marker de position en flèche directionnelle (suit le cap du parcours)
- Lecture automatique avec slider de vitesse (0.25× à 4×, défaut 0.5×)
- Profil altimétrique coloré par pente (laiton <3%, or 3-6%, orange 6-9%, rouge >9%)
- Affichage D+/D−, min/max altitude, légende couleurs
- POIs cliquables (départ/arrivée/ravito/signaleur/danger/secteur)
- Météo Open-Meteo : prévision (futur ≤16j) ou observation (passé) selon date

Pour activer Street View Google Maps API :
- Clé sur https://console.cloud.google.com
- Activer "Maps JavaScript API" + "Street View Static API"
- Renseigner `GOOGLE_MAPS_KEY=xxx` dans `.env`

---

## 🚢 Déploiement production

### Variables d'environnement

```env
NODE_ENV=production
JWT_SECRET=<32+ caractères aléatoires>
DB_PASSWORD=<mot de passe robuste>
COOKIE_SECURE=true
FRONTEND_URL=https://ccs-salouel.fr
SMTP_USER=contact@ccs-salouel.fr
SMTP_PASS=<app password Gmail>
SCRAPE_GRACE_DAYS=14             # Plus tolérant en prod
```

### Reverse proxy (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name ccs-salouel.fr;
    ssl_certificate /etc/letsencrypt/live/ccs-salouel.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ccs-salouel.fr/privkey.pem;

    location / {
        root /var/www/ccs-salouel;
        try_files $uri $uri.html $uri/ =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### PM2

```bash
pm2 start server.js --name ccs-salouel
pm2 save
pm2 startup
```

PM2 maintient le serveur en vie → l'auto-cleanup 24h continue de tourner.

---

## 🐛 Dépannage

| Problème | Solution |
|---|---|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL n'est pas démarré (lance Laragon) |
| `Access denied for user 'ccs_user'` | `DB_PASSWORD` dans `.env` ≠ password SQL |
| `Cannot find module 'express'` | Lancer `npm install` |
| `Cannot find module 'compression'` | `npm install compression` |
| `npm run scrape:save` retourne 0 events | Overpass saturé, réessayer dans 5 min |
| `Overpass HTTP 406` | Mirror principal en panne, le script bascule auto sur les mirrors fallback |
| Page sortie/sorties qui charge en boucle | Vérifier que `<script src="asset/js/data.js">` est bien dans le `<head>` |
| `Page admin vide / "Accès refusé"` | Le compte connecté n'a pas le rôle `admin` |
| Live Server bloque le cookie auth | Vérifier `FRONTEND_URL` dans `.env` (CORS + SameSite) |
| Le tracé n'apparaît pas | Vérifier que `gpx_filename` pointe vers un fichier qui existe dans `asset/gpx/` |
| Google veut commit `node_modules` | `git rm -r --cached node_modules` puis commit |
| OSRM 503 / timeout | Service public surchargé, réessayer ou self-host OSRM |
| Open-Meteo 429 | Trop de requêtes, attendre quelques minutes |

---

## 🔄 Workflow type — session de dev

```bash
# Au démarrage de VSCode :
npm run dev

# (le code, les modifs, le live reload via nodemon...)

# Ctrl+C pour arrêter quand tu as fini
```

C'est tout. Le scraping, le seed, les migrations sont des opérations **ponctuelles**, pas quotidiennes.

---

## 📝 Licence

Tous droits réservés — C.C. Salouel, 2026.