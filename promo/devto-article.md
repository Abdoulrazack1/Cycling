# Dev.to — Article technique

**Titre :** Building a Full-Stack Cycling Club Platform: Strava API, GPX Parsing, OSM Scraping (Node.js + Express + MySQL)
**Tags :** `nodejs`, `webdev`, `mysql`, `strava`
**Canonical URL :** https://github.com/Abdoulrazack1/Cycling

---

## Plan

### 1. Le contexte
- Notre club utilisait Facebook + WhatsApp + Strava clubs
- Décision de construire un outil dédié
- Contraintes : self-hosted, données chez nous, gratuit pour les membres

### 2. Architecture globale
- Diagramme : frontend statique + Express API + MySQL + sources externes
- Choix : vanilla JS frontend (pourquoi, avantages, inconvénients)

### 3. Deep-dive — Le scraper OSM HdF
- Pourquoi OSM Overpass plutôt que de saisir les GPX à la main
- Query Overpass : `route=bicycle` + `name` + filtres admin_level/longueur/langue
- Mirrors de fallback (HTTP 406 / timeout — c'est la vie de Overpass)
- Décodage des relations OSM en geometry → GPX synthétique
- Enrichissement Open-Meteo pour l'élévation

### 4. Deep-dive — L'intégration Strava
- OAuth flow + refresh token storage
- Webhook setup (subscription + verification challenge)
- Auto-sync au premier connect (preview "X activités à importer")
- Import 1-clic activité → sortie (décodage polyline → GPX → INSERT)

### 5. Deep-dive — La page explorateur de sortie
- Street View synchronisé avec un point sur le tracé Leaflet
- Profil altimétrique custom Canvas (coloré par pente)
- Marker directionnel (suit le cap du parcours)
- Lecture automatique avec slider de vitesse
- Météo (forecast Open-Meteo si futur, observation si passé)

### 6. Deep-dive — Le système d'authentification
- JWT access (15 min) + refresh (7 j) en cookie httpOnly
- 2FA TOTP pour les admins
- Sessions actives listables + révocables
- RGPD art. 20 (export) + art. 17 (suppression de compte)

### 7. Deep-dive — Les migrations versionnées
- Runner custom (pourquoi pas Knex ?)
- Table `schema_migrations` avec checksum sha256
- Transactions, rollback en cas d'erreur

### 8. Deep-dive — La PWA + Service Worker
- Stratégies : network-first HTML, cache-first assets, fallback offline
- App installable sur mobile
- Pull-to-refresh natif

### 9. Production
- PM2 + Nginx reverse proxy
- Backup MySQL planifié (Windows schtasks)
- Auto-cleanup courses passées (90j configurable)
- Monitoring : Core Web Vitals trackés client-side

### 10. Stats du projet
- 19 pages frontend, 14 tables, 63 tests, ~50 endpoints
- Lighthouse mobile : à mesurer
- Temps de dev : ~6 mois part-time

### 11. Lessons learned
- Le coût de "vanilla JS" en 2026 — gain en simplicité, perte en réutilisabilité de composants
- OSM Overpass est puissant mais fragile → toujours prévoir des mirrors
- Strava API : webhook + polling fallback, pas seulement l'un ou l'autre

### 12. Liens
- Repo : https://github.com/Abdoulrazack1/Cycling
- Live demo : à publier

---

## Notes

- Article long (2500-3500 mots) — Dev.to apprécie le contenu technique profond
- 5-7 visuels (architecture, query Overpass, screenshot explorateur, OAuth flow, etc.)
- Cible : devs full-stack qui cherchent un projet portfolio sérieux
