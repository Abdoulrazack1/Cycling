# Club de Cyclisme de Salouel — Application web

Site web complet du C.C. Salouel : frontend statique + API REST Express + MySQL + **génération automatique de courses** (scraping + GPX + POIs + élévation).

## 🚀 Fonctionnalités principales

- **Catalogue de courses** : 32 sorties, toutes avec GPX officiel + POIs détaillés (272 POIs au total)
- **Explorateur de parcours** (`sortie.html`) : Street View synchronisé avec le tracé, mini-carte directionnelle, profil altimétrique coloré par pente, météo Open-Meteo
- **API d'auto-import** (`/api/auto-courses/*`) : scraping Miles Republic + génération automatique GPX/POIs depuis waypoints clés (OSRM cycling + Open-Meteo Elevation)
- **Page admin** (`admin.html`) : gestion sorties, GPX, membres, contact + nouveau panneau **Auto-import** pour importer/générer des courses en un clic
- **Authentification** JWT + cookie, rôles (`admin`, `modo`, `membre`)
- **Météo intégrée** : prévisions et observations Open-Meteo pour chaque sortie

## 📦 Stack technique

- **Frontend** : HTML/CSS/JS vanille · Leaflet (mini-carte, satellite, OSM) · Google Street View embed · Canvas (profil altimétrique)
- **Backend** : Node.js 18+ · Express · MySQL 2 · JWT · Bcrypt · Nodemailer · Multer
- **Services externes** :
  - OSRM cycling (`router.project-osrm.org`) — routage cyclable réel
  - Open-Meteo (`api.open-meteo.com`) — élévation + météo, gratuit et sans clé
- **Base de données** : MySQL 8+ / MariaDB 10.6+

---

## 🛠 Installation rapide

### 1. Prérequis
- Node.js 18+
- MySQL 8+ ou MariaDB 10.6+
- HeidiSQL ou DBeaver pour gérer la base

### 2. Base de données

```sql
-- Dans HeidiSQL, en tant qu'utilisateur root :
CREATE USER 'ccs_user'@'localhost' IDENTIFIED BY 'CCS_Salouel_2025!';
CREATE DATABASE IF NOT EXISTS ccs_salouel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON ccs_salouel.* TO 'ccs_user'@'localhost';
FLUSH PRIVILEGES;
```

Puis ouvrir et exécuter `schema.sql` sur la base `ccs_salouel`.

### 3. Configuration `.env`

Le fichier `.env` est pré-configuré. Modifiez si besoin :

```env
DB_PASSWORD=CCS_Salouel_2025!     # Doit correspondre au CREATE USER
JWT_SECRET=<secret_généré_aléatoire>
GOOGLE_MAPS_KEY=                  # Optionnel : Street View API
SMTP_PASS=                        # Gmail app password (formulaire contact)
OSRM_BASE=https://router.project-osrm.org   # OSRM par défaut (peut pointer vers une instance privée)
```

### 4. Démarrage

```bash
npm install                # Installer les dépendances
node seed.js               # Peupler la base avec 32 sorties de démo
npm run dev                # Serveur en mode développement (nodemon)
# OU
npm start                  # Mode production
```

Le serveur démarre sur **http://localhost:3000**.

### 5. Frontend

Ouvrir `index.html` avec **Live Server** (extension VS Code) sur le port 5500, ou tout serveur HTTP local. L'API est configurée pour `http://localhost:3000/api`.

---

## 👤 Comptes de démonstration

| Rôle | Login | Mot de passe |
|------|-------|--------------|
| Admin | `admin` ou `admin@club-salouel.fr` | `Admin@Salouel2025` |
| Membre | `membre1` | `Membre@Salouel2025` |

---

## 📄 Pages disponibles

| Page | Description |
|------|-------------|
| `index.html` | Accueil dynamique (dernière sortie, sorties récentes) |
| `sorties.html` | Catalogue complet avec filtres |
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
|---------|-------|-------------|
| GET | `/health` | Health check |
| GET | `/sorties` | Liste des sorties |
| GET | `/sorties/:id` | Détail d'une sortie |
| GET | `/sorties/:id/pois` | POIs d'une sortie |
| GET | `/evenements` | Calendrier |
| GET | `/membres` | Liste des membres (public) |
| GET | `/club` | Infos du club |
| POST | `/auth/login` | Connexion |
| POST | `/auth/register` | Inscription |
| POST | `/auth/refresh` | Renouveler le token |
| POST | `/auth/logout` | Déconnexion |
| POST | `/auth/forgot-password` | Demande reset password |
| POST | `/contact` | Envoyer un message |

### Routes modérateur+

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/sorties` | Créer une sortie |
| PUT | `/sorties/:id` | Modifier une sortie |
| POST | `/sorties/:id/pois` | Ajouter un POI |
| DELETE | `/sorties/:id/pois/:poiId` | Supprimer un POI |

### Routes admin

| Méthode | Route | Description |
|---------|-------|-------------|
| DELETE | `/sorties/:id` | Supprimer une sortie |
| GET | `/gpx` | Lister fichiers GPX |
| POST | `/gpx/upload` | Uploader un GPX |
| **GET** | **`/auto-courses/sources`** | **Liste des sources de scraping** |
| **GET** | **`/auto-courses/scrape`** | **Scrape les sources publiques** |
| **POST** | **`/auto-courses/generate`** | **Génère un GPX depuis waypoints** |
| **POST** | **`/auto-courses/import`** | **Import en masse depuis events scrapés** |
| **GET** | **`/auto-courses/:id`** | **Récupérer une course auto-générée** |

---

## 🤖 Auto-import & génération automatique

### Architecture

Le système de génération automatique est composé de 5 services dans `services/` :

```
services/
├── routing.js           OSRM cycling — routage cyclable réel
├── elevation.js         Open-Meteo — altitudes + D+/D−
├── gpx-builder.js       Construction GPX 1.1 (XML)
├── course-generator.js  Pipeline complète (orchestrateur)
└── course-scraper.js    Scraper Miles Republic + parser HTML
```

### Pipeline de génération

```
input { name, waypoints: [{lat,lng,type?,label?}, ...], laps?, region?, ... }
   ↓
1. slugify(name)               → id unique safe
2. OSRM cycling                → tracé densifié sur vraies routes
3. Open-Meteo Elevation        → altitudes par batch (max 100 pts/req)
4. Calcul km cumulé + D+/D−    → stats du tracé
5. Extraction POIs             → waypoints typés transformés en POIs
6. GPX-builder.build()         → fichier .gpx valide
7. (optionnel) BDD             → INSERT/UPDATE sortie + pois
   ↓
output { id, gpxPath, pois, stats, log, errors }
```

### Utilisation via l'API

#### 1. Scraper les sources publiques

```bash
TOKEN="<jwt>"   # obtenu via /api/auth/login

curl -X GET "http://localhost:3000/api/auto-courses/scrape" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Réponse :
```json
{
  "total": 53,
  "events": [
    {
      "name": "L'Enfer des Flandres",
      "slug": "l-enfer-des-flandres-2026",
      "date": "2026-06-14",
      "lieu": "Cassel",
      "region": "Nord (59)",
      "distanceKm": 157,
      "type": "cyclosportive",
      "source": "milesrepublic",
      "sourceUrl": "https://...",
      "waypoints": null
    }
  ]
}
```

#### 2. Générer une course depuis ses waypoints

```bash
curl -X POST "http://localhost:3000/api/auto-courses/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ma Nouvelle Cyclosportive",
    "region": "Somme (80)",
    "date": "2026-06-15",
    "distanceKm": 100,
    "waypoints": [
      {"lat": 49.85770, "lng": 2.23470, "type": "depart", "label": "Départ"},
      {"lat": 49.90000, "lng": 2.30000, "type": "ravito", "label": "Ravito km 30"},
      {"lat": 49.95000, "lng": 2.40000, "type": "secteur", "label": "Côte de Picquigny"},
      {"lat": 49.85770, "lng": 2.23470, "type": "arrivee", "label": "Arrivée"}
    ]
  }' | jq
```

Réponse :
```json
{
  "success": true,
  "id": "ma-nouvelle-cyclosportive",
  "gpxFilename": "ma-nouvelle-cyclosportive.gpx",
  "gpxUrl": "/asset/gpx/ma-nouvelle-cyclosportive.gpx",
  "pois": [...],
  "stats": {
    "points": 1247,
    "distanceKm": 98.3,
    "dPlus": 542,
    "dMinus": 538,
    "eleMin": 35,
    "eleMax": 187,
    "durationMs": 4218
  },
  "persisted": true
}
```

La course est immédiatement disponible sur `sortie.html?id=ma-nouvelle-cyclosportive`.

#### 3. Mode offline (sans réseau)

Si OSRM ou Open-Meteo sont inaccessibles, ajoutez `"skipNetwork": true` :

```json
{ "name": "...", "waypoints": [...], "skipNetwork": true }
```

Le tracé sera alors interpolé linéairement entre waypoints (avec leurs altitudes fournies).

#### 4. Import en masse

```bash
curl -X POST "http://localhost:3000/api/auto-courses/import" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [<liste obtenue par /scrape>],
    "generateGpx": true
  }'
```

### Utilisation via l'interface admin

1. Se connecter en tant qu'admin
2. Aller sur `admin.html` → onglet **Auto-import**
3. Cliquer sur **🔍 Scraper les sources** pour lister les courses détectées
4. Pour chaque ligne, cliquer **Importer** pour intégrer la course
5. **Génération manuelle** : remplir le formulaire (nom, région, waypoints) puis **Générer la course**

### Format des waypoints

Format CSV (textarea admin) :
```
49.85770,2.23470,depart,Départ — Salouel,Place de la Mairie
49.90000,2.30000,ravito,Ravito km 30,Place du marché
49.95000,2.40000
49.85770,2.23470,arrivee,Arrivée Salouel
```

Champs : `lat,lng[,type,label,description]`. Les colonnes `type`, `label`, `description` sont facultatives — un waypoint sans `type` est un simple point de routage (ne devient pas un POI).

Types valides : `depart`, `arrivee`, `ravito`, `signaleur`, `danger`, `secteur`.

### Sources de scraping

Configurées dans `services/course-scraper.js` :

- `milesrepublic` — Cyclosportives HdF
- `milesrepublic-pdc` — Vélo Pas-de-Calais
- `milesrepublic-cyclo-pdc` — Cyclo PdC

Pour ajouter une source, éditer le tableau `SOURCES` et fournir un parser dédié (regex robuste sur le HTML).

### Limitations actuelles du scraping

- Le scraping ne récupère **pas les waypoints** des courses (la plupart des sites n'exposent pas les GPX). Les courses scrapées sont importées comme événements seulement ; pour générer leur GPX il faut soit fournir les waypoints manuellement, soit éditer `scripts/build-courses.js`.
- Les sources peuvent changer de structure HTML sans préavis. Si le scraping renvoie 0 résultats, vérifier le parser dans `course-scraper.js`.

---

## 🗺 Page sortie : explorer un parcours

La page `sortie.html?id=XXX` propose 3 modes de vue :

1. **Google Street View** (iframe embed avec heading aligné au tracé)
2. **Vue satellite** (Esri World Imagery via Leaflet)
3. **Carte OSM** (OpenStreetMap)

Fonctionnalités :
- Tracé jaune triple-polyline (ombre + halo + trait fin) très visible
- Marker de position en flèche directionnelle (suit le cap du parcours)
- Lecture automatique avec **slider de vitesse** (0.25× à 4×, par défaut 0.5×)
- **Profil altimétrique** coloré par pente (laiton <3%, or 3-6%, orange 6-9%, rouge >9%)
- Affichage D+/D−, min/max altitude, légende couleurs
- POIs cliquables (départ/arrivée/ravito/signaleur/danger/secteur)
- **Météo Open-Meteo** : prévision (futur ≤16j) ou observation (passé) selon date

Pour activer le Street View Google Maps API (panoramas haute qualité) :
- Obtenir une clé sur https://console.cloud.google.com
- Activer "Maps JavaScript API" et "Street View Static API"
- Renseigner `GOOGLE_MAPS_KEY=xxx` dans `.env`

---

## 📂 Structure du projet

```
Cycling/
├── *.html                  # Pages frontend
├── asset/
│   ├── css/                # Feuilles de style (style.css, polish.css)
│   ├── js/                 # Scripts client (auth, data, sortie, weather, ...)
│   ├── img/                # 5 SVG cyclisme inline (route, pavé, gravel, peloton, monts, côte)
│   ├── gpx/                # 28 fichiers GPX officiels
│   └── data/               # Données générées (pois-courses.json)
├── routes/                 # Routes Express (sorties, evenements, auth, auto-courses, ...)
├── services/               # Services métier (routing, elevation, gpx-builder, ...)
├── middleware/             # Middlewares Express (auth, upload)
├── config/                 # Config DB
├── scripts/                # CLI : generate-gpx.js, build-courses.js
├── uploads/                # Fichiers uploadés (créé par multer)
├── server.js               # Point d'entrée Express
├── seed.js                 # Peuplement initial de la BDD
├── schema.sql              # Schéma MySQL
├── package.json
├── .env                    # Configuration
├── README.md               # Ce fichier
└── AUDIT.md                # Notes d'audit & corrections
```

---

## 🔧 Scripts CLI utilitaires

### `scripts/build-courses.js` — Régénérer les GPX

```bash
node scripts/build-courses.js              # génère les GPX manquants
node scripts/build-courses.js --force      # régénère TOUS les GPX
node scripts/build-courses.js --course paris-roubaix-challenge
```

Pour ajouter une nouvelle course, éditer le tableau `COURSES` dans le fichier avec les waypoints clés.

### `scripts/generate-gpx.js` — Génération legacy (presets simples)

Conservé pour compatibilité — préférer `build-courses.js` pour les nouveaux développements.

### `seed.js` — Réinitialiser la BDD

```bash
node seed.js                # supprime tout et repeuple
```

⚠️ Cette commande **TRUNCATE** toutes les tables de l'application.

---

## 🚢 Déploiement production

### 1. Variables d'environnement

```env
NODE_ENV=production
JWT_SECRET=<32+ caractères aléatoires>
DB_PASSWORD=<mot de passe robuste>
COOKIE_SECURE=true              # HTTPS only
FRONTEND_URL=https://ccs-salouel.fr
SMTP_USER=contact@ccs-salouel.fr
SMTP_PASS=<app password Gmail>
```

### 2. Reverse proxy (Nginx)

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

### 3. PM2 (process manager)

```bash
pm2 start server.js --name ccs-salouel
pm2 save
pm2 startup
```

---

## 📊 Statistiques actuelles

- **32 sorties** officielles (toutes avec GPX + POIs)
- **32 évènements** (tous liés à une vraie sortie)
- **272 POIs** (moyenne 8.5/sortie, max 30 pour Paris-Roubaix Challenge)
- **28 fichiers GPX** dans `asset/gpx/`
- **0 dépendance Unsplash** (5 SVG cyclisme inline + locaux)
- Couverture régionale : Nord (59), Pas-de-Calais (62), Somme (80), Oise (60)

---

## 🐛 Dépannage

| Problème | Solution |
|----------|----------|
| **`ECONNREFUSED 127.0.0.1:3306`** | MySQL n'est pas démarré |
| **`Access denied for user 'ccs_user'`** | Le `DB_PASSWORD` dans `.env` ne correspond pas au mot de passe SQL |
| **`Cannot find module 'express'`** | Lancer `npm install` |
| **API renvoie 401 sur `/auto-courses`** | Routes admin uniquement, se connecter en admin et passer le token |
| **OSRM 503 / timeout** | Service public surchargé : utiliser `"skipNetwork": true` ou installer une instance OSRM locale |
| **Open-Meteo 429** | Trop de requêtes, attendre quelques minutes (cache 30 min déjà actif) |
| **Le tracé n'apparaît pas sur `sortie.html`** | Vérifier que `gpx_ref` pointe vers un fichier qui existe dans `asset/gpx/` |
| **Page admin vide / "Accès refusé"** | Le compte connecté n'a pas le rôle `admin` |
| **Live Server bloque le cookie auth** | Vérifier `FRONTEND_URL` dans `.env` (CORS + SameSite) |

---

## 📝 Licence

Tous droits réservés — C.C. Salouel, 2025.
