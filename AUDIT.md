# Audit & corrections — C.C. Salouel

État du projet après plusieurs itérations d'audit. Ce document liste **les bugs corrigés**, **les choix techniques** et **les vérifications systématiques** appliquées.

---

## ✅ Bugs corrigés

### Backend

| Bug | Cause | Correction |
|-----|-------|------------|
| Login en boucle entre Live Server (5500) et API (3000) | Cookie `SameSite=Strict` refusé en cross-origin | `cookieOpts()` centralisé : `SameSite=lax` en dev, `none+secure` en prod |
| Routes paginées : `Incorrect arguments to mysqld_stmt_execute` | mysql2 `pool.execute()` refuse les entiers en placeholder pour `LIMIT/OFFSET` | Helper `pageClause()` qui interpole après `parseInt` strict (anti-injection testé) |
| `?statut=undefined` (string) → 0 résultats | `URLSearchParams({statut: undefined})` envoie la string littérale | Nettoyage côté client (data.js) + ignore côté serveur |
| `process.exit(1)` à l'échec DB tuait le serveur | Erreur de log empêchait le serveur de démarrer | Retiré : le serveur survit à une DB indisponible |
| `POST /:id/inscrire` exigeait l'auth | `requireAuth` au lieu de `optionalAuth` | Passé en `optionalAuth` (avec pré-remplissage si connecté) |
| Username regex refusait les points | `[a-zA-Z0-9_-]+` | Ajouté le point : `[a-zA-Z0-9_.-]+` |
| `seed.js` ne tronquait pas `club_settings` | Manquait dans la liste TRUNCATE | Ajouté |
| Pas de catch-all 404 | URL inexistante → erreur Express brute | `app.get('*', sendFile('404.html'))` |
| `INSERT INTO pois` sans `id` (PK manquante) | Colonne `id` VARCHAR(50) PRIMARY KEY mais absente du INSERT | `INSERT` avec id généré + tous les champs (contact_name, contact_phone) |
| `INSERT INTO sorties` avec `date=null` | Colonne `date` est NOT NULL | Date du jour par défaut si manquante |

### Frontend

| Bug | Correction |
|-----|------------|
| auth.js v1 : polling sur `window.CCS_AUTH` | v2 refondue avec `CCS_AUTH.ready()` (Promise) + persistance `localStorage`/`sessionStorage` selon "remember me" |
| Login sans vrai `<form>` | Refondu : `<form>` avec `submit`, `autocomplete`, ARIA, écran de chargement |
| Pas de page mot-de-passe-oublié | Créée + endpoint `POST /auth/forgot-password` |
| Anti open-redirect manquant sur `?redirect=` | Vérification du domaine cible avant redirection |
| `</div>` orphelin dans sorties.html L50 | Supprimé |
| Incohérences géo (Salouel/Valenciennes) | Tout rebasé sur 80480 Salouel, Somme |
| Image moto sur Paris-Roubaix | Toutes les URLs Unsplash remplacées par 5 SVG cyclisme inline (`asset/img/hero-*.svg`) |

### Page sortie.html

| Bug | Correction |
|-----|------------|
| Profil altimétrique 0×0 sur layout asynchrone | `drawElevation()` réessaie au prochain frame si canvas non mesuré |
| Heading Street View incorrect (formule simpliste) | Formule rhumb line + look-ahead progressif 50 m + correction latitude |
| Marker position basique | Flèche directionnelle qui pivote selon le cap (CSS `.pos-marker-arrow`) |
| Trait de tracé peu visible (`#B08E4A` brass) | Triple-polyline : ombre noire + halo jaune large + trait `#FFD93D` fin |
| Lecture trop rapide (27 s pour 100%) | Step de base `0.0008` toutes les 100 ms ≈ 4 minutes à `0.5×` (par défaut) |
| Profil altimétrique monochrome | Coloré par pente (laiton <3%, or 3-6%, orange 6-9%, rouge >9%) avec grille + légende + stats D+/D− |
| Pas de météo | Module `weather.js` (Open-Meteo) intégré : forecast (futur ≤16j) ou archive (passé) |

### CSS

| Bug | Correction |
|-----|------------|
| Logo nav qui se chevauche en moyen écran | `.nav-logo` `flex-shrink: 0`, masquage progressif (sous-titre <1100px, monogramme seul <720px) |

---

## 🆕 Nouvelles fonctionnalités

### Auto-import & génération automatique

Créé un système autonome de génération de courses :

- **`services/routing.js`** : OSRM cycling, chunking auto >25 waypoints, fallback densification
- **`services/elevation.js`** : Open-Meteo, batch 100 pts, interpolation, calcul D+/D−
- **`services/gpx-builder.js`** : GPX 1.1 valide, échappement XML
- **`services/course-generator.js`** : pipeline complète (orchestrateur)
- **`services/course-scraper.js`** : scraper Miles Republic (3 sources)
- **`routes/auto-courses.js`** : 5 endpoints REST (admin only)
- **`admin.html`** : panneau "Auto-import" avec scrape + génération manuelle

Voir le README pour la documentation complète d'utilisation.

### Météo

- **`asset/js/weather.js`** : module `CCS_WEATHER` avec `fetch()`, `renderInto()`, `symbolFor()`, `labelFor()`
- Cache mémoire 30 min
- 29 codes WMO mappés vers emoji + libellé FR
- Widget intégré dans `sortie.html` après le profil altimétrique

### Slider de vitesse de lecture

- Slider 0.25× à 4× pendant la lecture
- Vitesse par défaut : 0.5×
- Mise à jour dynamique sans interruption

---

## 📊 Statistiques après audit

| Indicateur | Valeur |
|------------|--------|
| Sorties | 32 (avant : 13) |
| Évènements | 32 (avant : 7) |
| Évènements sans sortie | 0 |
| POIs | 272 (moy 8.5/sortie) |
| GPX | 28 fichiers |
| URLs Unsplash | 0 (avant : 18) |
| Sources de scraping | 3 |
| Tests pageClause unitaires | 10/10 |

---

## 🔍 Vérifications systématiques

À chaque itération :

1. ✅ Syntaxe JS : tous les fichiers (`asset/js`, `routes`, `services`, `config`, `middleware`, `server.js`, `seed.js`, `scripts`)
2. ✅ Balises HTML équilibrées (div, section)
3. ✅ Liens HTML/CSS/JS référencés existent
4. ✅ Images SVG référencées existent
5. ✅ GPX référencés dans `data.js` et `seed.js` existent dans `asset/gpx/`
6. ✅ Pas d'URL Unsplash résiduelle
7. ✅ Pas de TODO/FIXME critiques
8. ✅ Tous les imports Node.js résolvent
9. ✅ Serveur démarre sans erreur (même sans DB)
10. ✅ Routes admin renvoient 401 sans token
11. ✅ `/api/health` répond 200

---

## 🎯 Points d'attention pour la suite

- **OSRM publique** peut être lente / 503. Pour un usage soutenu, déployer une instance OSRM locale et configurer `OSRM_BASE` dans `.env`.
- **Open-Meteo Elevation** : limite 100 pts/req. Le batch + interpolation sont déjà gérés mais suffisants jusqu'à ~10 000 points.
- **Scraper** : les sources Miles Republic peuvent changer leur HTML. Si le scrape renvoie 0 events, vérifier le parser regex.
- **Stockage GPX** : actuellement en disque local (`asset/gpx/`). Pour scaler à >1000 courses, prévoir un stockage S3/CDN.
- **Auth** : JWT en mémoire, à invalider à la déconnexion. Token blacklist non implémenté → durée courte (15 min) recommandée.

---

## 🚀 Itération 2026-05-23 — couche premium + tests étendus

### Ajouté

- **`/api/stats`** : statistiques agrégées publiques (sorties/km/D+/évts/membres/segments/KOMs) avec cache mémoire 5 min + endpoint flush.
- **`/api/newsletter`** : subscribe (double opt-in), confirm, unsubscribe, list (admin) + table `newsletter_subscribers` (migration 010).
- **Widget newsletter** intégré au footer global (auto-injecté par `main.js`) avec honeypot anti-spam.
- **Honeypot anti-bot** sur le formulaire de contact (champ `website` caché, 201 silencieux si rempli).
- **`offline.html`** + service worker v20 : fallback dédié hors-ligne au lieu de réutiliser `index.html`.
- **`.well-known/security.txt`** (RFC 9116) pour les divulgations de vulnérabilité.
- **`asset/js/premium.js` + `asset/css/premium.css`** — couche d'expérience :
  - Progress bar globale style YouTube/NProgress branchée automatiquement sur `window.fetch`.
  - Toast queue (FIFO, 3 max, bouton close, success/error/warning/info, accessible).
  - View Transitions API (fade page-to-page sur Chrome 111+) avec fallback gracieux.
  - Smooth scroll automatique pour les ancres `#xxx` avec offset sous la nav fixe.
  - Pull-to-refresh mobile (opt-in via `<body data-ptr>`).
  - Core Web Vitals collectés dans `localStorage` (LCP / CLS / TTFB).
  - Helper `CCS_PREMIUM.copyLink(url, label)` + bouton "Copier" sur la page sortie.

### Tests

- **31 → 63 tests** (33 unitaires scraper + 30 intégration : auth, sorties, admin, gpx, 2fa, **stats, newsletter, public-endpoints**).
- `tests/integration/gpx.test.js` réécrit : ne dépend plus des 4 GPX de démo (`avesnois`, `cote-opale`, `pevele`, `scarpe-gravel`) qui n'existaient plus — désormais teste dynamiquement les GPX présents.
- `tests/integration/newsletter.test.js` (9 cas) + `tests/integration/stats.test.js` (4 cas) + `tests/integration/public-endpoints.test.js` (17 cas).

### Polish UX

- Skeleton loaders ajoutés sur `evenements.html`, `segments.html` (en plus des existants sur sorties/membres/palmares).
- Bouton "Copier lien" sur `sortie.html`.
- `fetchpriority="high"` sur l'image hero d'`evenements.html`.
- Lazy-fade pour `img[loading="lazy"]` (transition opacity douce).
- Focus-ring uniformisé brass + shadow halo sur tous les boutons et liens.

---

## 🌗 Itération 2026-05-25 — thèmes, satellite, animations 3D

### Light mode (`theme.css` + `theme.js`)

- 3 modes : **clair / sombre / auto** (suit `prefers-color-scheme` du système).
- Tokens light dupliqués (crème parchemin éclairé, encre profonde pour le texte, laiton conservé).
- Switcher 3-way injecté automatiquement dans la nav (icônes soleil/écran/lune).
- Persistance `localStorage.ccs.theme`, transition douce 400 ms au switch.
- `meta[name="theme-color"]` mis à jour dynamiquement (barre status mobile).
- Évènement DOM `ccs:themechange` exposé pour les modules qui doivent réagir (cartes notamment).

### Vues cartographiques (`maps.js`)

- 5 presets de tuiles : **standard** (CARTO Positron), **sombre** (CARTO Dark), **satellite** (Esri World Imagery), **topo** (OpenTopoMap), **OSM**.
- Helper `CCS_MAPS.addLayerControl(map, opts)` ajoute un Leaflet `L.control.layers` avec switcher.
- `bindToTheme(map, holder)` permet le switch auto de la couche selon le thème courant.
- Intégré sur la carte fallback de `sortie.html` (standard / satellite / topo accessible via control coin haut-droit).

### Animations 3D (`animations.js` + anime.js v3.2.2 via CDN)

- **Counters** animés (chiffres .page-head-meta-v, .stats-v, .stat-card-value) au scroll-into-view, format FR avec séparateurs de milliers.
- **Hero parallax** : image et titre se déplacent à des vitesses différentes au scroll (effet profondeur).
- **Title reveal** : titre hero animé mot-par-mot avec rotation 3D (`rotateX`) + stagger 70ms.
- **Stagger reveal** sur `[data-stagger]` : entrée séquentielle des items d'une liste.
- **3D card tilt** sur `.rc / .stat-card / .member-card` (mouse-move calcule l'angle de perspective).
- **Live-time pulse** sur le compteur horloge footer.
- Respect `prefers-reduced-motion` : applique les valeurs finales sans transition.

### Panneau POI renforcé

- **Barre de recherche** live (debounce 120ms) sur titre / description / contact / type.
- **Tri** : km croissant / km décroissant / par type / A→Z.
- Filtre supplémentaire : **Directions** (en plus de Tous / Signaleurs / Ravitos / Secteurs / Dangers).
- Pipeline filter → search → sort dans `filteredPois()`.

### Autres

- **Web Share API** : bouton sortie utilise `navigator.share()` sur mobile (sheet natif iOS/Android), fallback copie sur desktop.
- **Raccourcis clavier globaux** : `t` cycle le thème, `?` ouvre l'aide, `g h/s/e/m/c/p/k` navigation rapide entre pages.
- Modal d'aide raccourcis stylé (Backdrop blur + animation modal-in).
- **Anime.js v3** chargé depuis cdn.jsdelivr.net (déjà whitelist CSP).
