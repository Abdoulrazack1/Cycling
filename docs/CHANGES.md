# Corrections — bugs login / images / profil / météo / sortie / schema / SVG / GPX

## Vague 1 — Bugs runtime (déjà appliqués)

### Login en boucle
**Cause.** Token d'accès en mémoire pure, perdu à chaque navigation. Le refresh
via cookie httpOnly échouait silencieusement en cross-port (Live Server 5500 →
API 3000) → redirection sans fin vers login.html.

**Fix — `asset/js/auth.js`.** Le token est désormais persisté en
`sessionStorage`. Au boot : restaurer d'abord le token local s'il est encore
frais, refresh en best-effort. La session survit aux navigations.

**Fix — `routes/auth.js`.** `cookieOpts()` accepte un `COOKIE_DOMAIN` optionnel
via `.env` (utile en prod cross-subdomain).

### Météo cassée
**Cause.** MySQL retournait les colonnes DATE comme objets JS Date.
`res.json()` produisait `"2025-04-05T22:00:00.000Z"` au lieu de
`"2025-04-05"`. Open-Meteo rejetait avec 400.

**Fix — `config/database.js`.** Ajout de `dateStrings: ['DATE', 'DATETIME']`
au pool MySQL. Défense en profondeur dans `sortie.html` : le widget météo
coerce la date en `YYYY-MM-DD` quelle que soit sa forme d'origine.

### Profil altimétrique invisible
**Cause.** `AbortSignal.timeout(8000)` n'existe pas sur Safari < 16. Throw
synchrone avant le `try/catch` → `routePoints = []` → message
"Parcours en cours de finalisation" affiché à la place du profil.

**Fix — `asset/js/sortie.js`.** `AbortController` classique + setTimeout,
timeout descendu à 3 s. `parseGpx()` garantit le fallback sur les points
GPX bruts si OSRM échoue.

### Schéma SQL
`IF NOT EXISTS` partout, apostrophe SQL standard (`''`), `INSERT IGNORE`
sur les seeds, `ENGINE=InnoDB` explicite, index sur les FKs, `'archive'`
ajouté à `evenements.statut` ENUM.

---

## Vague 2 — Images SVG

**Avant.** Les 6 fichiers `hero-*.svg` montraient un cycliste filaire de
type "stick figure" sur fond dégradé brun. Effet amateur.

**Après.** Refonte en illustrations éditoriales atmosphériques. Aucune
figure humaine. Paysages stylisés type affiche :

| Fichier             | Composition                                          |
|---------------------|------------------------------------------------------|
| `hero-pave.svg`     | Route pavée en perspective fuyante, soleil rasant, silhouette de forêt à l'horizon |
| `hero-monts.svg`    | Trois plans de collines avec brume dans les vallons, lune voilée |
| `hero-cote.svg`     | Falaise rocheuse, mer sombre, phare avec faisceau, reflet du soleil sur l'eau |
| `hero-gravel.svg`   | Sentier forestier en perspective, troncs verticaux, traces de pneus |
| `hero-route.svg`    | Route droite vers l'horizon, poteaux télégraphiques en perspective, clocher distant, soleil couchant centré |
| `hero-peloton.svg`  | Abstraction pure — bandes de mouvement orange en streaks horizontaux |

Chaque SVG utilise grain (`feTurbulence`) et vignette (`radialGradient`) pour
texture et profondeur. Palette cohérente avec le design system du site.

---

## Vague 3 — Tracés GPX réalistes

**Vérité utile.** Aucune API publique gratuite ne donne les vrais tracés
officiels des courses cyclistes amateurs en France. Strava et Komoot exigent
OAuth utilisateur. Les organisateurs distribuent leurs GPX par e-mail aux
inscrits, pas via API. Donc impossible de fournir les fichiers officiels —
seulement d'améliorer fortement les approximations.

**Ce qui a été fait.**

1. **`scripts/generate-gpx.js`** — refondu avec **9 presets pour les 13
   sorties** (certaines partagent un GPX). Chaque preset liste les vraies
   coordonnées géographiques des points de passage iconiques :

   - **arenberg-2025** : Compiègne → Troisvilles → Quiévy → Cambrai →
     Quérénaing → Haveluy → **Trouée d'Arenberg (50.399, 3.4125 — coords
     Wikipédia officielles)** → Wallers-Hélesmes → Mons-en-Pévèle →
     Carrefour de l'Arbre → Vélodrome de Roubaix
   - **monts-flandres** : Cassel → Mont des Récollets → Mont des Cats →
     Mont Noir → **Kemmelberg (50.7878, 2.8255)** → Monteberg → Baneberg →
     Steenvoorde → Cassel
   - **cote-opale** : Boulogne → Wimereux → Audinghen → **Cap Gris-Nez
     (50.8722, 1.5856)** → Wissant → **Cap Blanc-Nez (50.9264, 1.7203)** →
     Sangatte → Boulogne
   - **pevele** : Orchies → **Mons-en-Pévèle (50.4861, 3.1058)** →
     Pont-à-Marcq → Templeuve → Cysoing → Beuvry → Orchies
   - **avesnois**, **scarpe-gravel**, **cambresis**, **criterium-salouel**,
     **grand-prix-salouel** — voir `scripts/generate-gpx.js`

2. **`seed.js` corrigé** — la coordonnée du POI "Trouée d'Arenberg" qui
   pointait à 50.4186, 3.2553 (≈ 12 km à côté du vrai pavé) est maintenant
   à 50.3990, 3.4125. Idem pour le Vélodrome de Roubaix et le POI "danger
   sortie Arenberg".

3. **`scripts/validate-gpx.js`** — nouveau script qui vérifie chaque GPX
   contre `seed.js` :
   - Distance réelle vs `distance_km` annoncé (warn >15 %, erreur >30 %)
   - Position du départ vs `location_lat/lng` (warn >500 m, erreur >2 km)
   - Détection de GPX algorithmique (espacement trop uniforme = pas un
     vrai enregistrement GPS)

   Lancement : `node scripts/validate-gpx.js`

   Sur les GPX d'origine, le validateur révèle :
   - 4 fichiers avec distance gravement fausse (avesnois −37 %, cote-opale
     −46 %, pevele −36 %, scarpe-gravel −31 %)
   - 9 fichiers avec espacement uniforme (CV < 1 % = générés
     algorithmiquement, pas de vrais enregistrements GPS)

   Une fois `node scripts/generate-gpx.js --all` lancé sur les nouveaux
   presets, les distances tomberont dans la fourchette acceptable.

**Limites assumées.** Même après régénération, les tracés restent **du
routage OSRM entre points iconiques réels**. Ils passeront par les bons
endroits (Arenberg, Kemmelberg, Cap Gris-Nez…) mais ne sont pas les
fichiers officiels distribués par les organisateurs. Pour avoir les VRAIS
GPX :

1. Téléchargez-les depuis Strava (route publique), RideWithGPS, Komoot,
   ou directement le site organisateur après inscription.
2. Renommez-les selon `gpx_filename` dans `seed.js`
   (ex. `arenberg-2025.gpx`).
3. Déposez-les dans `asset/gpx/`.
4. Lancez `node scripts/validate-gpx.js` pour vérifier qu'ils collent
   bien aux annonces.

---

## Procédure de mise en route

```bash
cd Cycling
npm install                                  # une seule fois
mysql -u root -p < schema.sql                # crée la DB

# Régénérer les GPX avec les nouveaux presets — IMPORTANT, à lancer une fois.
# Nécessite accès Internet (OSRM + Open-Meteo). Prend ~3 min pour les 9 fichiers.
node scripts/generate-gpx.js --all

# Vérifier la cohérence GPX ↔ seed :
node scripts/validate-gpx.js

# Peupler la DB :
node seed.js

# Lancer l'app :
npm start                                    # API + frontend sur :3000
```

**Conseil** : ouvrez `http://localhost:3000/` (servi par Express) plutôt
que Live Server sur 5500 — toutes les requêtes restent same-origin et
le cookie httpOnly fonctionne nativement.
