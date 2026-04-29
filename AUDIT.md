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
