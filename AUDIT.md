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

---

## 🚴 Itération 2026-05-27 — renforcement parcours utilisateurs

### Backend

- **Migration 011** : nouvelles tables `user_favorites`, `notifications`, `sortie_inscriptions` + extension ENUM `audit_log.action` (inscription, annulation, favorite, notification).
- **`/api/favorites`** : CRUD sorties favorites par membre (POST, DELETE, GET, GET /check/:id).
- **`/api/notifications`** : flux centralisé (liste, unread, read-all, read/:id, delete, POST admin push). Helper `notify(userId, type, ...)` exporté pour les autres routes.
- **`/api/sorties/:id/inscription`** : inscription 1-clic membre (POST/DELETE). Endpoint public `/inscriptions` retourne la liste (sans email/téléphone). Admin peut patch le statut (`inscrit` / `liste-attente` / `annule`).
- **Notifications auto-générées** :
  - `sortie.updated` : envoyée à tous les inscrits quand un admin modifie une sortie.
  - `inscription.confirmed` : envoyée au user lors d'une inscription 1-clic.
  - `inscription.status_changed` : envoyée quand admin change le statut.
  - `broadcast` : envoyée à tous les destinataires d'un broadcast email.
- **`/api/auth/me` étendu** : ajoute `strava_linked` (bool) et `inscriptions_count` (int) pour alimenter la checklist d'onboarding.

### Frontend

- **`member-journey.js`** + **`journey.css`** :
  - **Cloche de notifications** dans la nav avec badge unread + animation shake + panneau dépliant. Polling 60s.
  - **Bouton favori** (étoile) sur la page sortie avec animation scale + état toggle persistant.
  - **Bouton inscription 1-clic** sur la page sortie avec compteur d'inscrits public.
  - **Checklist d'onboarding** sur le profil (4 étapes : profil / équipement / Strava / inscription première sortie) avec progress bar + bouton "Faire" qui scroll vers la bonne section.
- **`admin-palette.js`** : palette d'actions admin (Ctrl+Shift+P) avec fuzzy-search, 19 commandes (nouveau membre/sortie/event, broadcast, maintenance toggle, audit log, scraper, Strava config, etc.). Active uniquement si user.role === 'admin'.
- **`breadcrumbs.js`** : fil d'Ariane auto-injecté en début de `<main>` selon la page courante (15 pages mappées). Désactivable via `data-no-breadcrumbs`.

### Tests

- **Nouveau fichier** `tests/integration/journey.test.js` : 15 cas pour favorites, notifications, sortie inscriptions, /auth/me étendu.
- **78/78 tests passent** (63 → 78).

---

## ⚙ Itération 2026-05-27 (bis) — features manquantes + Strava/GPX

### Nettoyage

- Emojis retirés de `admin-palette.js`, `search-palette.js`, `admin.js`. Remplacés par initiales lettre (S/E/M/B…) ou texte ("Photos", "Vélo", "Course").

### Backend

- **Migration 012** : `sorties.capacity_max` + `inscription_ouverte` + table `user_recent_views`.
- **Capacité + liste d'attente automatique** sur `POST /api/sorties/:id/inscription` :
  - Si `capacity_max` atteint → placement auto en `liste-attente`.
  - Si quelqu'un se désinscrit → premier de la file promu automatiquement (+ notification `inscription.promoted`).
  - Si `inscription_ouverte = 0` → 403 (admin peut fermer manuellement).
- **`/api/my/dashboard`** : agrégat favoris + inscriptions + récemment vues + count non-lues en 1 call.
- **`/api/my/inscriptions`** + **`/api/my/recent`** + **`POST /api/my/recent/:sortieId`** (track silencieux).
- **`POST /api/sorties/preview-gpx`** : parse GPX uploadé sans rien sauvegarder, renvoie metrics + warnings + titre suggéré (depuis `<trk><name>`).
- **`GET/POST /api/strava/webhook`** : endpoint d'enregistrement Strava (challenge GET) + receveur d'événements (POST). Re-sync auto de l'activité concernée + notif `strava.synced`.
- **`POST /api/strava/resync/:activityId`** : re-sync manuel d'une activité (debug/data-drift).
- **`syncSingleActivity()`** dans `services/strava-client.js` : UPSERT robuste utilisé par webhook + re-sync.

### Frontend

- **`gpx-drop.js`** + CSS : composant réutilisable de drag & drop GPX avec preview (distance/D+/points/titre suggéré + warnings). Active sur `[data-gpx-drop]`.
- **`member-journey.js`** étendu : `RecentTracker.init()` track les consultations sortie après 3s.
- Empty states stylés (`.ccs-empty` + variants) prêts à servir sur les pages dashboard / inscriptions / favoris.

### Tests

- **Nouveau fichier** `tests/integration/my-dashboard.test.js` : 9 cas (dashboard, recent, Strava webhook GET/POST, GPX preview auth).
- **87/87 tests passent** (78 → 87).

---

## 🔗 Itération 2026-05-28 — faciliter Strava + import

### Backend

- **`GET /api/strava/preview-sync`** : dry-run du sync avec choix période. Renvoie `{will_import, already_imported, total_scanned, preview[5]}` sans rien sauver.
- **`POST /api/strava/import-activity/:activityId`** : transforme une activité Strava du membre en sortie club. Décode le polyline Google encoded en coordonnées + génère un GPX minimal + INSERT sortie. Modo+ requis.
  - Helper `decodePolyline()` + `buildGpxFromCoords()` inclus dans la route.
  - Si l'activité n'est pas en base, re-sync via `syncSingleActivity` automatiquement.

### Frontend

- **`strava-ux.js` + `strava-ux.css`** :
  - **Modal "Connecter Strava"** explicite avant l'OAuth (bénéfices + permissions précisées : lecture activités/profil/itinéraires, AUCUNE écriture). Active sur `[data-strava-connect]`.
  - **Banner inline** auto-injecté sur `[data-strava-banner]` quand user connecté CCS mais pas Strava (avec dismiss persistant 7j).
  - **Modal de sync** avec choix période (30/90/180/365 j) + preview avant lancement (combien d'activités nouvelles, déjà connues, 5 exemples affichés).
- **Page `/strava-activites.html`** : liste des activités Strava du membre + recherche + filtre par type + bouton "Importer → Sortie" pour modérateurs.
- **Page `/strava-routes.html`** : liste des itinéraires Strava sauvegardés + modal d'import (date/titre/chapitre) → POST `/strava/import-route/:id`.
- Liens directs depuis le profil (boutons "Mes activités" + "Mes itinéraires" dans la section Strava).

### UX

- Bouton "Connecter mon Strava" sur profil utilise désormais la modal explicative au lieu de partir direct sur OAuth.
- Bouton "Synchroniser" sur profil utilise désormais la modal preview (au lieu de sync direct sur 90 j).
- Banner "Connecter Strava" auto-injecté sur le profil pour les users non-strava.
