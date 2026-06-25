# Documentation — site C.C. Salouel

Plateforme web du Cyclo Club de Salouel : annonce des sorties, fiches détaillées
avec carte interactive, profil altimétrique, météo, gestion des inscrits, espace
admin.

Cette doc couvre l'installation, l'architecture, et — section centrale —
**comment importer un vrai fichier GPX** (depuis Strava, RideWithGPS, Komoot,
ou un organisateur).

---

## 1. Vue d'ensemble

### Stack technique

| Couche       | Technologie                                          |
|--------------|------------------------------------------------------|
| Backend      | Node.js + Express                                    |
| Base         | MySQL 8 (mysql2 + pool)                              |
| Auth         | JWT (access en mémoire/sessionStorage + refresh httpOnly cookie) |
| Frontend     | HTML/CSS/JS vanilla (pas de framework)               |
| Carte        | Mapbox GL JS v3                                      |
| Graphiques   | Chart.js 4 (profil altimétrique)                     |
| Routage      | OSRM public (`router.project-osrm.org`)              |
| Élévation    | Open-Meteo API publique                              |
| Upload       | multer (fichiers GPX)                                |

### Pages du site

**Pages publiques :**
- `index.html` — accueil
- `sorties.html` — liste des sorties
- `sortie.html?id=X` — détail d'une sortie (carte, profil, météo, POIs)
- `parcours.html` — liste des parcours signatures
- `evenements.html` — liste des événements
- `evenement.html?id=X` — détail d'un événement avec inscription **(nouveau)**
- `club.html` — présentation du club
- `membres.html` — trombinoscope des sociétaires
- `membre.html?id=X` — profil public d'un sociétaire **(nouveau)**
- `palmares.html` — palmarès du club
- `segments.html` — segments KOM chronométrés
- `contact.html` — formulaire de contact
- `mentions-legales.html`
- `404.html`

**Pages auth :**
- `login.html` — connexion + inscription (deux onglets)
- `mot-de-passe-oublie.html` — demande de reset (notifie l'admin)
- `reset-password.html?token=X` — choisir un nouveau mot de passe **(nouveau)**

**Pages connectées :**
- `profil.html` — profil personnel + équipement + édition
- `admin.html` — espace admin (sorties, événements, membres, GPX, contacts, palmarès…)

### Arborescence

```
Cycling/
├── server.js                # entrée Express
├── seed.js                  # données initiales (sorties, POI, segments)
├── schema.sql               # création de la DB
│
├── config/
│   └── database.js          # pool MySQL
│
├── middleware/
│   ├── auth.js              # JWT verify, requireAuth, requireAdmin
│   └── upload.js            # multer config pour GPX
│
├── routes/                  # endpoints API REST
│   ├── auth.js              # /api/auth/* (login, refresh, logout)
│   ├── sorties.js           # /api/sorties/*
│   ├── gpx.js               # /api/gpx/* (upload, list, serve)
│   ├── pois.js              # /api/pois/* (points d'intérêt)
│   ├── segments.js          # /api/segments/*
│   ├── evenements.js        # /api/evenements/*
│   ├── membres.js           # /api/membres/*
│   ├── palmares.js          # /api/palmares/*
│   ├── club.js              # /api/club/* (settings)
│   ├── contact.js           # /api/contact (form public)
│   └── auto-courses.js      # scrape de courses externes
│
├── services/
│   ├── routing.js           # appels OSRM
│   ├── elevation.js         # appels Open-Meteo
│   ├── gpx-builder.js       # génération XML GPX
│   ├── course-generator.js  # composition sorties depuis sources externes
│   └── course-scraper.js    # scrape pages web de courses
│
├── scripts/
│   ├── generate-gpx.js      # ⭐ régénère les GPX depuis les coords presets
│   ├── validate-gpx.js      # ⭐ vérifie cohérence GPX ↔ seed.js
│   └── build-courses.js     # construction batch de courses externes
│
├── asset/                   # ressources statiques servies sur /
│   ├── css/
│   ├── js/                  # auth.js, main.js, sortie.js, weather.js…
│   ├── img/                 # hero-*.svg et autres images
│   ├── gpx/                 # ⭐ les fichiers GPX consultés par le frontend
│   └── data/
│
├── uploads/
│   └── gpx/                 # destination des uploads admin via API
│
├── *.html                   # pages : index, sortie, sorties, login, admin…
├── CHANGES.md               # journal des correctifs récents
└── DOCUMENTATION.md         # ce fichier
```

---

## 2. Installation

### Prérequis

- Node.js ≥ 18 (pour `fetch` natif)
- MySQL 8 (ou MariaDB 10.5+)
- Git

### Étapes

```bash
git clone <le-repo> Cycling
cd Cycling
npm install
```

Créer un fichier `.env` à la racine :

```env
# Serveur
PORT=3000
NODE_ENV=development

# Base de données
DB_HOST=localhost
DB_PORT=3306
DB_USER=ccs_user
DB_PASSWORD=changez-moi
DB_NAME=ccs_db

# JWT
JWT_SECRET=générez-une-chaîne-aléatoire-64-caractères
JWT_REFRESH_SECRET=autre-chaîne-aléatoire-différente
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d

# Cookie (laisser vide en dev local, mettre .domaine.fr en prod)
COOKIE_DOMAIN=

# APIs externes
MAPBOX_TOKEN=pk.eyJ...    # clé publique Mapbox

# Upload
MAX_GPX_SIZE_MB=10
UPLOADS_DIR=./uploads
```

Initialiser la base :

```bash
mysql -u root -p -e "CREATE DATABASE ccs_db CHARACTER SET utf8mb4;"
mysql -u root -p -e "CREATE USER 'ccs_user'@'localhost' IDENTIFIED BY 'changez-moi';"
mysql -u root -p -e "GRANT ALL ON ccs_db.* TO 'ccs_user'@'localhost';"
mysql -u ccs_user -p ccs_db < schema.sql
```

Peupler les données initiales :

```bash
node seed.js
```

Lancer en dev :

```bash
npm start
# ou
node server.js
```

Ouvrir `http://localhost:3000/` (et **pas** Live Server sur :5500 — voir
section *Dépannage*).

---

## 3. Le système GPX — guide d'import

C'est la partie la plus sensible du projet. Trois éléments coopèrent :

1. La **table `sorties`** (DB) avec son champ `gpx_filename`
2. Le **dossier `asset/gpx/`** où vivent les fichiers `.gpx`
3. Le **frontend** (`asset/js/sortie.js`) qui charge `asset/gpx/<nom>` via fetch

Quand vous ouvrez la page d'une sortie :
- Le frontend interroge `/api/sorties/:slug`
- L'API retourne notamment `gpx_ref` (alias de `gpx_filename`)
- Le frontend fait `fetch('asset/gpx/' + gpx_ref)`
- Il parse le XML, route les points sur les routes via OSRM, dessine la
  carte et le profil altimétrique

### 3.1. Importer un vrai GPX — procédure complète

**Cas d'usage.** Vous avez téléchargé un fichier GPX réel (depuis Strava, le
site d'un organisateur, RideWithGPS, Komoot…) et vous voulez qu'il remplace
le tracé approximatif d'une des sorties du site.

**Étape 1 — Identifier la sortie cible.**

Ouvrir `seed.js` et chercher la sortie concernée. Repérer son `gpx_filename` :

```js
{
  id: 'arenberg-2025-04-05',
  slug: 'paris-roubaix',
  title: 'Reconnaissance Paris–Roubaix',
  // …
  gpx_filename: 'arenberg-2025.gpx',   // ← ce nom est important
  // …
}
```

Plusieurs sorties peuvent partager un même fichier (ex. `monts-flandres.gpx`
est utilisé par `monts-flandres-2025-03-28` et `ronde-monts-2025-05-18`).
Remplacer le fichier mettra à jour les deux d'un coup.

**Étape 2 — Préparer votre fichier GPX.**

Vérifier qu'il est bien au format GPX 1.1 standard avec des `<trkpt>` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Strava">
  <trk>
    <trkseg>
      <trkpt lat="49.4179" lon="2.8262"><ele>33.0</ele></trkpt>
      <trkpt lat="49.4181" lon="2.8265"><ele>33.2</ele></trkpt>
      ...
    </trkseg>
  </trk>
</gpx>
```

Le projet n'a **pas besoin** d'élévations : si elles manquent, `generate-gpx.js`
peut les recalculer via Open-Meteo. Mais elles accélèrent l'affichage du profil.

**Étape 3 — Renommer le fichier.**

Le nom doit correspondre exactement à `gpx_filename` dans `seed.js`. En
respectant la casse :

```bash
mv ~/Téléchargements/paris-roubaix-2024-strava.gpx ~/Téléchargements/arenberg-2025.gpx
```

**Étape 4 — Le déposer au bon endroit.**

```bash
cp ~/Téléchargements/arenberg-2025.gpx Cycling/asset/gpx/
```

C'est `asset/gpx/`, **pas** `uploads/gpx/`. Ce dernier est uniquement la
destination des uploads via API admin (pour des fichiers temporaires ou
en attente de revue).

**Étape 5 — Valider.**

```bash
cd Cycling
node scripts/validate-gpx.js arenberg-2025.gpx
```

Sortie attendue (exemple) :

```
═══ Validation GPX vs seed.js ═══

arenberg-2025.gpx — Reconnaissance Paris–Roubaix
  ✓ Distance 173.4 km (+0 % de l'annonce)
  ✓ Départ à 47 m de la localisation déclarée
  ✓ Espacement variable (CV 38 %) — comportement d'enregistrement réel

Résumé : 3 OK, 0 avertissements, 0 erreurs
```

Trois critères :

- **Distance** : tolère ±15 % (warn) puis ±30 % (erreur). Si votre GPX dévie
  trop du `distance_km` annoncé dans `seed.js`, soit le GPX est incomplet,
  soit l'annonce est à ajuster.
- **Départ** : compare le 1er point GPX à `location_lat`/`location_lng` de la
  sortie. Tolère 500 m (warn) puis 2 km (erreur).
- **Pattern d'espacement** : un GPX avec espacements quasi identiques
  (CV < 5 %) est suspect — c'est le marqueur d'un fichier généré
  algorithmiquement (par OSRM par ex.) plutôt qu'un vrai enregistrement
  GPS où la cadence est variable.

Si la validation passe → vous avez fini. Le frontend prendra le nouveau
fichier au prochain rechargement de la page sortie.

Si elle échoue :

| Erreur                                   | Action                                              |
|------------------------------------------|-----------------------------------------------------|
| Distance trop différente                 | Vérifiez que vous avez le bon GPX. Sinon ajustez `distance_km` dans `seed.js` puis relancez `node seed.js`. |
| Départ à plusieurs km                    | Le GPX commence à un autre endroit. Mettez à jour `location_lat`/`location_lng` ou bien tronquez le GPX. |
| Espacement uniforme (warn seul)          | Le fichier est lisible. C'est juste un signal qu'il vient probablement d'un routage automatique et pas d'un vrai velo. Pas bloquant. |

### 3.2. Régénérer tous les GPX depuis les presets

Si vous n'avez pas de vrais GPX et que vous voulez juste produire des tracés
qui passent par les vrais points iconiques (Trouée d'Arenberg, Kemmelberg,
Cap Gris-Nez, Mons-en-Pévèle…) :

```bash
node scripts/generate-gpx.js --all
```

Ce que fait le script :

1. Lit les **9 presets** définis dans `scripts/generate-gpx.js`
   (un preset = une liste de points-clés avec coordonnées GPS réelles)
2. Pour chaque preset, demande à OSRM de tracer un itinéraire cyclable
   passant par tous les points dans l'ordre
3. Pour les presets de type circuit (`criterium-salouel`, `grand-prix-salouel`),
   répète le tour autant de fois que nécessaire
4. Récupère les altitudes via Open-Meteo (par batchs de 100 points)
5. Écrit un GPX 1.1 valide dans `asset/gpx/`

Le script nécessite Internet (OSRM + Open-Meteo). Compter ~3 min pour
les 9 fichiers.

Pour régénérer un seul fichier :

```bash
node scripts/generate-gpx.js arenberg-2025
node scripts/generate-gpx.js cote-opale
```

### 3.3. Modifier un preset existant

Pour ajouter, retirer, ou réordonner des points-clés d'un parcours,
éditer `scripts/generate-gpx.js` :

```js
'cote-opale': {
  name: "Côte d'Opale",
  desc: 'Boulogne · Cap Gris-Nez · Cap Blanc-Nez · 104 km',
  laps: 1,
  lap: [
    { lat: 50.7264, lng: 1.6068, name: 'Départ — Boulogne-sur-Mer, port' },
    { lat: 50.7656, lng: 1.6094, name: 'Wimereux (côte de Wimereux)' },
    // ← ajouter une étape ici
    { lat: 50.8722, lng: 1.5856, name: 'Cap Gris-Nez (phare)' },
    // …
  ]
},
```

Puis :

```bash
node scripts/generate-gpx.js cote-opale
node scripts/validate-gpx.js cote-opale.gpx
```

### 3.4. Ajouter une nouvelle sortie au site

1. Ajouter une entrée dans `SEED_DATA.sorties` de `seed.js` avec un
   `gpx_filename` unique
2. Ajouter le POI/segments associés si besoin
3. Soit déposer un GPX réel dans `asset/gpx/`, soit ajouter un preset
   dans `scripts/generate-gpx.js` puis lancer la génération
4. Relancer `node seed.js` (idempotent grâce aux `INSERT IGNORE` /
   `ON DUPLICATE KEY`)

### 3.5. Import via formulaire admin (nouvelle sortie + GPX en un clic)

Pour ajouter une **nouvelle course qui n'existe pas encore** dans la DB, il y
a un formulaire dédié dans l'espace admin :

1. Connectez-vous comme admin → `/admin.html`
2. Onglet **Sorties & parcours** → bouton **« Importer depuis GPX »**
   (à côté de « + Nouvelle sortie »)
3. Sélectionnez le fichier `.gpx` — le formulaire affiche immédiatement
   une preview (distance, D+, nombre de points, coordonnées de départ)
   calculée côté navigateur
4. Remplissez le titre et la date — le slug et la durée sont auto-suggérés
5. Choisissez le type de parcours (route / gravel / côte / monts / pavé /
   peloton) — ça détermine quelle image hero sera utilisée
6. Cliquez **« Importer »**

**Ce qui se passe côté serveur :**

- `POST /api/sorties/import-gpx` reçoit le fichier en multipart
- Le serveur **re-parse** le GPX (jamais on ne fait confiance au client)
- Calcule automatiquement : `distance_km`, `elevation_gain`, `elevation_loss`,
  `elevation_min`, `elevation_max`, `location_lat`, `location_lng` (= 1er point)
- Écrit le fichier dans `asset/gpx/{slug}.gpx`
- Insère la ligne dans `sorties` avec `id = {slug}-{YYYY-MM-DD}` pour
  garantir l'unicité
- Renvoie la sortie créée

**Endpoint pour intégration externe** (utile si vous voulez scripter des
imports en masse) :

```bash
curl -X POST http://localhost:3000/api/sorties/import-gpx \
  -H "Authorization: Bearer $TOKEN" \
  -F "gpx=@/chemin/vers/votre.gpx" \
  -F "title=Tour de l'Avesnois 2026" \
  -F "date=2026-05-15" \
  -F "chapter=route" \
  -F "subtitle=Maroilles · Avesnes · 112 km" \
  -F "location_name=Maroilles, place de la Mairie" \
  -F "statut=future"
```

Champs multipart acceptés :

| Champ           | Type     | Requis | Auto si vide                    |
|-----------------|----------|--------|---------------------------------|
| `gpx`           | file     | oui    | —                               |
| `title`         | string   | oui    | —                               |
| `date`          | YYYY-MM-DD | oui  | —                               |
| `slug`          | kebab-case | non  | dérivé du titre                 |
| `chapter`       | enum     | non    | `route`                         |
| `statut`        | passee/future | non | `passee`                       |
| `subtitle`      | string   | non    | null                            |
| `description`   | string   | non    | null                            |
| `location_name` | string   | non    | null (les coords viennent du GPX) |
| `duration_label`| string   | non    | calculé à 25 km/h moyen         |
| `featured`      | bool     | non    | `false`                         |

Le serveur refuse l'import si :
- Le fichier n'est pas un GPX valide (pas de balise `<gpx>` ou < 2 trkpts)
- Le slug ou l'id généré entre en collision avec une sortie existante
- Le titre, la date ou le slug sont mal formés

### 3.6. Upload GPX seul (alternative pour fichiers en attente)

### 3.6. Upload GPX seul (alternative pour fichiers en attente)

Pour les utilisateurs admin connectés, il existe aussi un endpoint d'upload
seul (sans création de sortie) :

```
POST /api/gpx/upload
  Header : Authorization: Bearer <access_token>
  Body   : multipart/form-data avec le champ "gpx"
```

Le fichier est stocké dans `uploads/gpx/` (pas `asset/gpx/`). Utile pour
de la modération ou des fichiers qu'on rattache après-coup à une sortie
créée séparément. Pour le rendre actif sur le frontend, il faut le copier
vers `asset/gpx/` ou adapter le frontend pour servir depuis `/api/gpx/`.

### 3.7. Où trouver des vrais GPX ?

| Source                      | Type                                | Comment                                                     |
|-----------------------------|-------------------------------------|-------------------------------------------------------------|
| Strava — itinéraires publics | Cyclosportives, randos populaires   | `strava.com/routes` → page publique → bouton "Exporter GPX" |
| RideWithGPS                 | Tracés communautaires               | Compte gratuit nécessaire, recherche par lieu               |
| Komoot                      | Routes communautaires               | Compte gratuit, export GPX limité aux tours qu'on possède   |
| Site organisateur           | Tracés officiels                    | Souvent en téléchargement direct ou par email aux inscrits  |
| OpenRunner                  | Communauté FR active                | Bcp de tracés cyclo dans le Nord, export GPX libre          |
| AllTheCobbles               | Pavés Paris-Roubaix / Flandres      | Coordonnées et traces des secteurs pavés                    |

Aucun service n'expose d'API publique sans OAuth pour les données utilisateurs.
Le téléchargement se fait toujours manuellement via l'interface web.

---

## 4. Authentification

### Flux

1. `POST /api/auth/login` avec `{email, password}`
2. Réponse : `{accessToken, user}` + cookie `refresh_token` (httpOnly,
   sameSite=lax, expire 7 j)
3. Le frontend stocke `accessToken` en `sessionStorage` (clé `ccs_at`)
4. Chaque requête authentifiée passe `Authorization: Bearer <accessToken>`
5. Quand l'access token expire, `auth.js` fait `POST /api/auth/refresh`
   (le cookie est envoyé automatiquement) et obtient un nouveau access token

### Persistance

Le token est gardé en `sessionStorage` plutôt que `localStorage` pour qu'il
soit purgé à la fermeture de l'onglet, sans pour autant être perdu à chaque
navigation entre pages — c'était le bug original.

`auth.js` au boot :

1. Lit `sessionStorage.ccs_at`
2. Vérifie l'expiration via le claim `exp` du JWT
3. Si encore frais : marque la session valide immédiatement
4. Lance un refresh en best-effort (pas bloquant)

### Création d'un compte admin

Pas d'inscription publique. Pour créer un admin :

```sql
INSERT INTO membres (nom, prenom, email, password_hash, role, statut)
VALUES (
  'Nom', 'Prénom', 'admin@ccsalouel.fr',
  -- bcrypt hash for "votre-mdp" (générer avec: node -e "console.log(require('bcrypt').hashSync('votre-mdp', 10))")
  '$2b$10$...',
  'admin', 'actif'
);
```

---

## 5. Météo

Widget en haut de la page sortie : appelle Open-Meteo avec la date de la
sortie et les coordonnées.

Détails dans `asset/js/weather.js`. Le bug historique (date sérialisée comme
ISO datetime au lieu de DATE) est corrigé via :

- `config/database.js` : `dateStrings: ['DATE', 'DATETIME']` force mysql2 à
  retourner les dates comme chaînes
- `sortie.html` : coercion défensive `String(date).slice(0,10)` en plus

---

## 6. Profil altimétrique

Sur la page sortie, calculé côté client :

1. `parseGpx(url)` charge le fichier GPX
2. `routeOnRealRoads(rawPoints)` (`asset/js/sortie.js`) appelle OSRM pour
   coller les points sur de vraies routes (timeout 3 s, fallback sur les
   points bruts en cas d'échec)
3. Open-Meteo Elevation API enrichit avec les altitudes manquantes
4. Chart.js dessine le profil

Le timeout 3 s est un compromis : assez long pour OSRM en bonne santé,
assez court pour ne pas faire poireauter l'utilisateur si l'API est lente.
En cas d'échec, le profil est tracé sur les points GPX bruts (moins précis
mais toujours utilisable).

---

## 7. Endpoints API principaux

| Méthode | Route                            | Auth   | Fonction                              |
|---------|----------------------------------|--------|---------------------------------------|
| POST    | /api/auth/login                  | -      | Connexion                             |
| POST    | /api/auth/refresh                | cookie | Rafraîchir l'access token             |
| POST    | /api/auth/logout                 | -      | Déconnexion (clear cookie)            |
| POST    | /api/auth/register               | -      | Inscription                           |
| POST    | /api/auth/forgot-password        | -      | Demande de reset (notifie admin)      |
| POST    | /api/auth/admin-reset/:userId    | admin  | Génère un lien de reset (24h)         |
| POST    | /api/auth/reset-password         | -      | Reset via token reçu par email        |
| GET     | /api/auth/me                     | bearer | Profil de l'utilisateur connecté      |
| GET     | /api/sorties                     | -      | Liste paginée des sorties             |
| GET     | /api/sorties/:slug               | -      | Détail d'une sortie                   |
| POST    | /api/sorties                     | admin  | Créer une sortie                      |
| PUT     | /api/sorties/:id                 | admin  | Modifier                              |
| DELETE  | /api/sorties/:id                 | admin  | Supprimer                             |
| GET     | /api/sorties/:id/pois            | -      | POI d'une sortie                      |
| GET     | /api/sorties/:id/segments        | -      | Segments chronométrés                 |
| GET     | /api/gpx                         | admin  | Liste des fichiers uploadés           |
| GET     | /api/gpx/:filename               | -      | Récupère un fichier (uploads/gpx/)    |
| POST    | /api/gpx/upload                  | admin  | Upload                                |
| GET     | /api/club/settings               | -      | Paramètres publics du club            |
| GET     | /api/membres                     | admin  | Liste des membres                     |
| GET     | /api/evenements                  | -      | Calendrier événements                 |
| GET     | /api/palmares                    | -      | Palmarès                              |
| POST    | /api/contact                     | -      | Formulaire de contact                 |

Code dans `routes/`. Auth via `middleware/auth.js`.

---

## 8. Dépannage

### "Login en boucle" / déconnexion à chaque navigation

Vérifier que vous accédez au site via `http://localhost:3000/` (Express)
et **pas** `http://127.0.0.1:5500/` (Live Server). Le cookie httpOnly du
refresh token est lié au domaine et au port. En cross-origin il est
silencieusement bloqué par le navigateur.

Si vous tenez à utiliser Live Server pour l'éditeur, configurer un proxy
ou définir `COOKIE_DOMAIN=localhost` dans `.env` ne suffit généralement
pas — le plus simple est d'ouvrir la version servie par Express.

### Météo affiche "Données indisponibles"

Ouvrir la console réseau, regarder l'appel à `api.open-meteo.com`. Si
réponse 400, c'est un format de date. Vérifier dans la DB :

```sql
SELECT id, slug, date FROM sorties LIMIT 1;
```

`date` doit ressortir comme `2025-04-05` pas comme datetime.

### Profil altimétrique vide / "Parcours en cours de finalisation"

1. Vérifier que `asset/gpx/<nom>.gpx` existe et que le nom matche
   `gpx_filename` dans la DB :
   ```sql
   SELECT slug, gpx_filename FROM sorties WHERE slug = 'paris-roubaix';
   ```
2. Lancer `node scripts/validate-gpx.js <nom>.gpx`
3. Vérifier dans la console navigateur l'erreur réelle

### Carte Mapbox blanche

Token `MAPBOX_TOKEN` manquant ou invalide dans `.env`. Vérifier sur
`mapbox.com/account/access-tokens` que le token est actif et que les
restrictions de domaine incluent votre domaine de prod.

### "OSRM HTTP 429" pendant `generate-gpx.js`

Le serveur OSRM public limite les requêtes. Le script attend déjà 500 ms
entre les batchs Open-Meteo, mais relancer immédiatement après une erreur
peut déclencher le rate limit. Patienter 1-2 min ou héberger sa propre
instance OSRM si besoin de batch fréquent.

---

## 9. Procédure complète depuis zéro

```bash
# 1. Setup
git clone <repo> Cycling && cd Cycling
npm install
cp .env.example .env && $EDITOR .env

# 2. Base de données — création des tables (idempotent grâce aux IF NOT EXISTS)
mysql -u root -p < schema.sql

# 3. Premier seed (peuple admin + données initiales)
node seed.js

# 4. Lancer l'app
npm start
```

Ouvrir `http://localhost:3000/`.

---

## 10. ⚠️ Persistance des données — comprendre seed.js

**Comportement par défaut (depuis le dernier patch).** `node seed.js` est
maintenant **safe** : il fait des `INSERT IGNORE` et ne touche pas aux
sorties que vous avez importées via le formulaire admin, ni aux comptes
créés. Vous pouvez le relancer autant que vous voulez sans risque.

**Mode reset — protections renforcées.**

```bash
node seed.js --reset
```

Désormais, ce mode demande **une confirmation interactive obligatoire** :
vous devez taper exactement `OUI EFFACER` pour que l'opération soit
effectuée. Toute autre saisie (Entrée vide, autre texte) annule
l'opération.

Pour les scripts CI/CD, on peut bypasser la confirmation avec `--yes`
(ou `-y`) :

```bash
node seed.js --reset --yes   # à utiliser AVEC PRUDENCE
```

**Aucune autre commande n'efface vos sorties.** Le code a été audité :
- `seed.js --reset` est le seul TRUNCATE
- `DELETE /api/sorties/:id` est le seul DELETE individuel (route admin protégée)
- Aucun setInterval, aucun cron, aucun cleanup automatique
- Le serveur ne fait rien de destructif au démarrage

**Suppression depuis l'admin — double confirmation.** Le bouton ✕ d'une
sortie ouvre maintenant deux dialogues : un confirm classique, puis un
prompt qui demande de retaper l'identifiant exact de la sortie. Un clic
accidentel ne suffit plus pour effacer.

**Audit log.** Chaque suppression de sortie est journalisée dans le
terminal serveur :
```
[AUDIT] 2025-04-30T12:34:56.789Z — Sortie supprimée : "Tour Avesnois 2026" (id=tour-avesnois-2026, gpx=tour-avesnois-2026.gpx) par user 1 (admin)
```

**Données InnoDB.** MySQL avec moteur InnoDB est persistant : les courses
restent en DB tant que vous ne les supprimez pas explicitement. Le
redémarrage du serveur Node, de nodemon, de VS Code, ou même de Windows
n'efface rien.

### Récupération de GPX orphelins

Si vous avez fait un `--reset` accidentellement et que les fichiers `.gpx`
sont toujours dans `asset/gpx/` (le `--reset` ne touche que la base, pas
les fichiers), vous pouvez les rerattacher à de nouvelles sorties.

**Depuis l'admin** :
1. Allez dans **Sorties & parcours**
2. Cliquez **« Récupérer GPX orphelins »**
3. Une popup liste les fichiers présents non rattachés en base, avec
   distance et D+ pré-calculés
4. Cliquez **Importer** sur chaque fichier, donnez un titre et une date,
   le serveur recrée la sortie

**Endpoint API** : `GET /api/sorties/orphan-gpx/list` (admin) renvoie la
liste des fichiers orphelins avec leurs métadonnées GPX.

---

## 11. Sessions — pas d'expiration en pratique

**Tokens longs.** Depuis le dernier patch :
- Access token : valide 1 an
- Refresh token : valide 10 ans

Vous pouvez surcharger via `.env` :
```env
JWT_EXPIRES_IN=365d
JWT_REFRESH_EXPIRES_IN=3650d
```

**Cookie session.** Le cookie httpOnly du refresh token a un `maxAge`
de 10 ans aussi. Cocher « Se souvenir de moi » au login active ce cookie
persistant (sinon le cookie est de session — disparaît à la fermeture du
navigateur).

**Persistance frontend.** Le token est stocké dans `localStorage` si
remember-me est coché (persiste fermeture navigateur), sinon
`sessionStorage` (durée de l'onglet uniquement).

**Rate limiting.** Les utilisateurs authentifiés (header `Authorization`)
sont **exemptés** du rate limit global. Vous pouvez créer 50 sorties
d'affilée sans déclencher le « trop de requêtes ».

---

## 12. Espace admin — fonctionnalités complètes

L'espace admin (`/admin.html`) couvre les domaines suivants :

| Panneau         | Rôle requis | Actions possibles                                                 |
|-----------------|-------------|-------------------------------------------------------------------|
| Tableau de bord | admin       | Stats globales (sorties, événements, membres, contacts non lus)   |
| Sorties         | admin       | CRUD complet, **import GPX automatique**, édition de toutes les métadonnées |
| Événements      | admin/modo  | CRUD, suivi des inscrits                                          |
| Membres         | admin       | Gestion des rôles (membre/modo/admin), désactivation, **génération de liens reset password** |
| Contacts        | admin       | Lecture, marquage lu/traité, réponse mailto                       |
| GPX             | admin       | Upload, téléchargement, suppression                               |
| Paramètres club | admin       | Édition du nom, président, adresse, etc.                          |
| Palmarès        | admin/modo  | CRUD résultats par année, médailles, événements                   |
| Segments KOM    | admin       | CRUD segments chronométrés                                        |
| **Points d'intérêt** | admin  | Vue globale tous-sorties, filtres, recherche, suppression (**nouveau**) |
| Auto-import     | admin       | Scrape de courses publiques (Miles Republic, FFC HdF)             |

### Réinitialisation de mot de passe (workflow admin)

1. Un membre demande un reset via `mot-de-passe-oublie.html`
2. Vous voyez le message dans **Contacts**
3. Vous allez dans **Membres**, cliquez sur 🔑 à côté du membre
4. Une popup s'ouvre avec un lien (valable 24 h) à copier
5. Vous l'envoyez par email
6. Le membre arrive sur `reset-password.html?token=...` et choisit son nouveau mot de passe

Le bouton 🔑 utilise l'endpoint `POST /api/auth/admin-reset/:userId` qui
renvoie un JWT signé avec votre `JWT_SECRET`. Toutes les sessions actives
du membre sont invalidées au moment du reset.

---

## 13. Points d'intérêt (POIs)

Les POIs sont des marqueurs géolocalisés rattachés à une sortie : signaleurs,
ravitaillements, dangers (chute pavé, descente glissante), secteurs notés,
points de départ et d'arrivée. Ils s'affichent sur la carte et dans la liste
latérale de la page sortie.

### Ajouter un POI (depuis la page d'une sortie)

1. Ouvrir la sortie concernée (`/sortie.html?id=...`)
2. Section **Points d'intérêt** sur la droite
3. Cliquer **« Cliquer sur la carte »** (active le mode placement)
4. Cliquer sur la carte (mini-carte ou plan principal) à l'endroit voulu
5. Remplir le formulaire (type, libellé obligatoire, description, contact optionnel)
6. **Enregistrer**

Le serveur calcule automatiquement le kilomètre (distance depuis le départ
en suivant le tracé GPX) le plus proche du clic. Anonymes peuvent voir les
POIs ; seuls les utilisateurs connectés peuvent en ajouter.

### Gérer les POIs (espace admin)

Panel **Points d'intérêt** dans `/admin.html`. Vue globale tous-sorties avec :
- Filtre par type (signaleur, ravito, danger, secteur, départ, arrivée)
- Recherche texte (sur libellé et description)
- Lien direct vers la sortie depuis chaque ligne
- Affichage du créateur (avec emoji 👤 utilisateur ou 🤖 système)
- Suppression unitaire avec confirmation

### Endpoints API

| Méthode | Route                                              | Auth   | Action                          |
|---------|----------------------------------------------------|--------|---------------------------------|
| GET     | /api/sorties/:sortieId/pois                        | -      | POIs d'une sortie               |
| POST    | /api/sorties/:sortieId/pois                        | bearer | Ajouter un POI                  |
| PUT     | /api/sorties/:sortieId/pois/:poiId                 | bearer | Modifier (auteur ou admin)      |
| DELETE  | /api/sorties/:sortieId/pois/:poiId                 | bearer | Supprimer (auteur ou admin)     |
| POST    | /api/sorties/:sortieId/pois/bulk                   | admin  | Remplacer tous les POIs système |
| GET     | /api/pois?type=&q=&sortie_id=                      | admin  | Liste globale (admin)           |
| DELETE  | /api/pois/:id                                      | admin  | Supprimer directement (admin)   |
