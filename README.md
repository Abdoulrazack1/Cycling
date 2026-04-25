# Club de Cyclisme de Salouel — Application web

Site web complet du C.C. Salouel : frontend statique + API REST Express + MySQL.

## Stack technique

- **Frontend** : HTML/CSS/JS vanille · Leaflet · Google Street View · Mapillary
- **Backend** : Node.js + Express · MySQL 2 · JWT · Bcrypt · Nodemailer · Multer
- **Base de données** : MySQL 8+ / MariaDB 10.6+

---

## Installation rapide

### 1. Prérequis
- Node.js 18+
- MySQL 8+ ou MariaDB 10.6+
- HeidiSQL (ou DBeaver) pour gérer la base

### 2. Base de données (HeidiSQL)

```sql
-- Créer l'utilisateur MySQL
CREATE USER 'ccs_user'@'localhost' IDENTIFIED BY 'CCS_Salouel_2025!';
CREATE DATABASE IF NOT EXISTS ccs_salouel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON ccs_salouel.* TO 'ccs_user'@'localhost';
FLUSH PRIVILEGES;
```

Puis dans HeidiSQL, ouvrir et exécuter `schema.sql` sur la base `ccs_salouel`.

### 3. Configuration

Le fichier `.env` est déjà créé et pré-configuré. Modifiez si besoin :

```env
DB_PASSWORD=CCS_Salouel_2025!   # Doit correspondre au CREATE USER ci-dessus
GOOGLE_MAPS_KEY=                 # Optionnel : activer Street View API
MAPILLARY_TOKEN=                 # Optionnel : Street View communautaire
SMTP_PASS=                       # Gmail app password pour les emails contact
```

### 4. Démarrage

```bash
npm install          # Installer les dépendances Node
node seed.js         # Peupler la base avec les données de démo
npm run dev          # Démarrer le serveur en mode développement (nodemon)
```

Le serveur démarre sur **http://localhost:3000**

### 5. Frontend

Ouvrir `index.html` avec Live Server (VS Code) sur le port 5500, ou tout serveur HTTP local.

L'API est configurée sur `http://localhost:3000/api` dans toutes les pages HTML.

---

## Comptes de démonstration

| Rôle | Login | Mot de passe |
|------|-------|--------------|
| Admin | `admin` ou `admin@club-salouel.fr` | `Admin@Salouel2025` |
| Membre | `membre1` | `Membre@Salouel2025` |

---

## Pages disponibles

| Page | Description |
|------|-------------|
| `index.html` | Accueil dynamique (dernière sortie, sorties récentes) |
| `sorties.html` | Catalogue complet des sorties (chargement API + filtres) |
| `sortie.html?id=XXX` | Explorateur : Street View, satellite, GPX, POIs, altimétrie |
| `club.html` | Histoire, bureau, informations pratiques |
| `evenements.html` | Calendrier 2025 |
| `parcours.html` | Catalogue des tracés GPX |
| `palmares.html` | Résultats par saison |
| `segments.html` | Classements KOM et zones d'entraînement |
| `contact.html` | Formulaire de contact (email vers admin) |
| `profil.html` | Profil sociétaire + puissance |
| `login.html` | Connexion / inscription |
| `admin.html` | Panneau d'administration (admin uniquement) |

---

## API REST

Base URL : `http://localhost:3000/api`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/sorties` | Liste des sorties |
| GET | `/sorties/:id` | Détail d'une sortie |
| POST | `/sorties` | Créer (modo+) |
| PUT | `/sorties/:id` | Modifier (modo+) |
| DELETE | `/sorties/:id` | Supprimer (admin) |
| GET | `/sorties/:id/pois` | POIs d'une sortie |
| POST | `/sorties/:id/pois` | Ajouter un POI |
| DELETE | `/sorties/:id/pois/:poiId` | Supprimer un POI |
| GET | `/evenements` | Calendrier |
| GET | `/membres` | Liste membres |
| POST | `/auth/login` | Connexion |
| POST | `/auth/register` | Inscription |
| POST | `/auth/refresh` | Renouveler token |
| POST | `/auth/logout` | Déconnexion |
| POST | `/contact` | Envoyer un message |
| POST | `/gpx/upload` | Upload GPX (admin) |
| GET | `/gpx` | Lister GPX (admin) |
| GET | `/health` | Health check |

---

## Street View

La page `sortie.html` propose 3 modes de vue :
1. **Google Street View** (via iframe embed + pano ID récupéré automatiquement)
2. **Vue satellite** (Esri World Imagery via Leaflet)
3. **Carte OSM** (OpenStreetMap via Leaflet)

Pour activer le Street View API Google (panoramas + heading précis) :
- Obtenir une clé sur https://console.cloud.google.com
- Activer "Maps JavaScript API" et "Street View Static API"
- Renseigner `GOOGLE_MAPS_KEY=` dans `.env`
- Dans `sortie.html`, décommenter la ligne `const GOOGLE_MAPS_KEY`

---

## Déploiement production

```bash
NODE_ENV=production npm start
```

En production, ajouter un reverse proxy Nginx et un certificat SSL.
Remplacer les URLs `localhost` dans les HTML par l'URL de production.

