# Cercle Cycliste de Sarouel — Site web

Site web du Cercle Cycliste de Sarouel. Direction artistique : **club privé luxe** (inspiration Conceptzilla "Luxury Golf Club") transposée à l'univers cycliste du Nord. Statique (HTML/CSS/JS pur, zero build), conçu pour évoluer vers un backend Firebase ou Supabase sans réécriture majeure.

## Direction artistique

Palette : émeraude sombre + crème parchemin + laiton, accents oxblood pour le pavé. Typographie : **Playfair Display** (titres serif italique), **EB Garamond** (corps de texte), **Archivo** (labels capitales tracées). Numérotation par chapitres (№ 01, № 02…), filets de laiton, encadrements estampillés, photos en cinemascope traitées chaudes.

## Pages

| Fichier | Rôle |
|---------|------|
| `index.html` | Accueil — hero cinémascope, sortie en cours, sorties récentes, stats, parcours signatures, manifeste, formules d'adhésion, CTA |
| `sorties.html` | Catalogue filtrable des sorties |
| `sortie.html` | **Page phare** — explorateur carte + street view + POIs + profil altimétrique + tableau des secteurs pavés |
| `parcours.html` | Les parcours signatures du Cercle |
| `evenements.html` | Calendrier événementiel |
| `club.html` | Le bureau (7 membres) |
| `profil.html` | Profil sociétaire — équipement + zones de puissance |
| `palmares.html` | Résultats par saison avec médailles or/argent/bronze |
| `contact.html` | Formulaire + cartes info coordonnées |
| `mentions-legales.html` | RGPD, éditeur, hébergeur |
| `404.html` | Page d'erreur |

## Stack

- **HTML/CSS/JS** purs (zero framework, zero build step)
- **Leaflet 1.9.4** pour la cartographie
- **Mapillary JS 4.1.2** pour le street view communautaire (fallback satellite + plan si token absent)
- Typographies servies par Google Fonts : Playfair Display, EB Garamond, Archivo

## Street view Mapillary

Le fichier `asset/js/sortie.js` contient une constante `MAPILLARY_TOKEN` vide par défaut. Sans token → fallback automatique en split **vue satellite Esri + vue cartographique OSM**.

Pour activer le street view :

1. Créer un compte développeur sur https://www.mapillary.com/dashboard/developers
2. Générer un *client token*
3. Coller la valeur dans `asset/js/sortie.js` :

```javascript
const MAPILLARY_TOKEN = 'MLY|votre-token-ici';
```

Le viewer 360° Mapillary se chargera alors automatiquement à la position du curseur sur la frise temporelle, avec recherche de la photo la plus proche via l'API Graph.

## Couche de données

`asset/js/data.js` expose `window.CCS_DATA` avec 3 adaptateurs interchangeables :

- `StaticAdapter` (actif par défaut) — données SEED + `localStorage` pour les POIs ajoutés
- `FirebaseAdapter` (stub) — à brancher avec le SDK Firebase
- `SupabaseAdapter` (stub) — à brancher avec le SDK Supabase

Pour migrer vers Firebase/Supabase, changer `DATA_BACKEND = 'firebase'` ou `'supabase'` en haut du fichier et implémenter les méthodes `listSorties`, `getSortie`, `listPois`, `addPoi`, `deletePoi` dans la classe correspondante. L'interface est identique.

## Page sortie — fonctionnalités clés

- **Explorateur immersif** : street view Mapillary en surface principale OU split satellite Esri + plan OSM (mode fallback automatique sans token)
- **Minimap flottante** expandable (bouton en haut à droite de la scène)
- **Frise temporelle** avec ticks couleur par type de POI — clic ou drag pour naviguer
- **Lecture automatique** (bouton play, touche Espace) — avance progressive sur le tracé
- **Raccourcis clavier** : ←/→ pour naviguer, Espace pour play/pause
- **Profil altimétrique** interactif avec curseur synchronisé et tooltip
- **Ajout de POI** : activez le mode, cliquez sur le plan OSM pour définir la position, puis remplissez le formulaire (type, libellé, description, contact signaleur)
- **Filtres** par type de point d'intérêt
- **Export GPX** du tracé
- **Tableau des secteurs pavés** avec performances comparées et classement interne

## Déploiement

Site 100 % statique. Déposer le dossier sur n'importe quel hébergeur (OVH, Netlify, Vercel, GitHub Pages, serveur perso).

## Test local

```bash
# Python 3
python3 -m http.server 8000
# → http://localhost:8000

# Node
npx serve .
```

## Licence

© 1978–2026 Cercle Cycliste de Sarouel · Code propre à l'association.
