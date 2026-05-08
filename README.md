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
| `npm run scrape:save` | **Mensuel** — rafraîchit les itinéraires OSM HdF |
| `npm run expire:dry` | Voir quelles courses seraient supprimées par le cleanup |
| `npm run clean` | **Reset complet** — vide BDD + GPX (avec confirmation) |
| `node seed.js` | Recrée admin/membre/paramètres après un `clean` |
| `npm install` | Après un `git pull` qui ajoute des dépendances |

---

Site web complet du C.C. Salouel : frontend statique + API REST Express + MySQL + **alimentation automatique des sorties depuis OpenStreetMap** (tracés réels uniquement).

## 🚀 Fonctionnalités

- **Catalogue de sorties** alimenté en continu : itinéraires cyclables nommés des Hauts-de-France récupérés depuis OpenStreetMap (tracés officiels mappés par la communauté)
- **Auto-cleanup** : les courses passées disparaissent automatiquement (BDD + GPX) après un délai de grâce paramétrable
- **Explorateur de parcours** (`sortie.html`) : Street View synchronisé avec le tracé, mini-carte directionnelle, profil altimétrique coloré par pente, météo Open-Meteo
- **Page admin** (`admin.html`) : gestion sorties, GPX, membres, contact
- **Authentification** JWT + cookie, rôles (`admin`, `modo`, `membre`)
- **Météo intégrée** : prévisions et observations Open-Meteo pour chaque sortie

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
DB_PASSWORD=CCS_Salouel_2025!
JWT_SECRET=<secret_aléatoire_32+_caractères>
SCRAPE_GRACE_DAYS=7              # Délai avant suppression auto des courses passées
GOOGLE_MAPS_KEY=                 # Optionnel : Street View API
SMTP_PASS=                       # Optionnel : Gmail app password (formulaire contact)
OSRM_BASE=https://router.project-osrm.org
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

### Routes publiques / membre

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/sorties` | Liste des sorties (params : `statut=future\|passee`, `limit`, `offset`) |
| GET | `/sorties/:id` | Détail d'une sortie |
| GET | `/sorties/:id/pois` | POIs d'une sortie |
| GET | `/evenements` | Calendrier |
| GET | `/membres` | Liste des membres |
| GET | `/club` | Infos du club |
| POST | `/auth/login` | Connexion |
| POST | `/auth/register` | Inscription |
| POST | `/auth/forgot-password` | Demande reset password |
| POST | `/contact` | Envoyer un message |

### Routes modérateur+

| Méthode | Route | Description |
|---|---|---|
| POST | `/sorties` | Créer une sortie |
| PUT | `/sorties/:id` | Modifier une sortie |
| POST | `/sorties/:id/pois` | Ajouter un POI |
| DELETE | `/sorties/:id/pois/:poiId` | Supprimer un POI |

### Routes admin

| Méthode | Route | Description |
|---|---|---|
| DELETE | `/sorties/:id` | Supprimer une sortie |
| GET | `/gpx` | Lister fichiers GPX |
| POST | `/gpx/upload` | Uploader un GPX |
| POST | `/auto-courses/generate` | Générer un GPX depuis waypoints |

---

## 📂 Structure du projet

```
Cycling/
├── *.html                       # Pages frontend
├── asset/
│   ├── css/                     # style.css, polish.css
│   ├── js/                      # auth, data, sortie, weather, ...
│   ├── img/                     # SVG cyclisme inline
│   ├── gpx/                     # Fichiers GPX (alimenté par scraper)
│   └── data/                    # pois-courses.json (legacy)
├── routes/                      # Routes Express
├── services/
│   ├── routing.js               # OSRM cycling
│   ├── elevation.js             # Open-Meteo + calcul D+/D−
│   ├── gpx-builder.js           # Construction GPX 1.1
│   ├── course-generator.js      # Pipeline génération
│   └── course-scraper.js        # Scraper MilesRepublic (fallback)
├── middleware/                  # auth, upload
├── config/                      # Config DB
├── scripts/
│   ├── scrape-sorties.js        # Scraper principal OSM HdF ⭐
│   ├── expire-past-sorties.js   # Cleanup auto courses passées ⭐
│   ├── clean-sorties.js         # Reset complet BDD + GPX ⭐
│   ├── build-courses.js         # Génération GPX depuis waypoints (legacy)
│   └── generate-gpx.js          # Génération GPX simple (legacy)
├── server.js                    # Express + cron auto-expire 24h
├── seed.js                      # Peuplement initial admin/membre
├── schema.sql                   # Schéma MySQL
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