# Reddit — r/webdev

**Subreddit cible :** r/webdev
**Flair :** `Showoff Saturday` ou `Article`
**Best time :** samedi matin

---

## Titre

> Built a full-stack cycling club platform (Node/Express/MySQL/Vanilla JS) — Strava OAuth, GPX, real OSM routes, admin panel

---

## Body

Hey r/webdev,

J'ai construit et déployé une plateforme complète pour un club de cyclisme (le **C.C. Salouel**, Hauts-de-France) sur les ~6 derniers mois. C'est ma plus grosse appli full-stack et je voulais partager les choix techniques.

### Ce que ça fait

**Côté public** : catalogue de sorties auto-alimenté depuis OpenStreetMap (vrais tracés cyclables nommés), explorateur Street View + tracé synchronisé, profil altimétrique coloré par pente, météo Open-Meteo, événements avec inscription.

**Côté membre** : profil enrichi (FTP, équipement), intégration Strava OAuth (sync auto des activités), favoris, palmarès, segments KOM, RGPD complet (export + suppression).

**Côté admin** : dashboard live, broadcast email, mode maintenance, audit log, bulk actions, command palette (Ctrl+Shift+P style Linear/Notion).

### Choix techniques que je trouve intéressants

**1. Frontend vanilla JS** — pas de framework. ~19 pages HTML, 1 script `pages/{page}.js` par page, partagés via globals (`window.CyclingAPI`). Plus simple à debugger qu'un SPA, et le LCP est top.

**2. Scraper OSM HdF** — au lieu d'importer des GPX manuellement, j'utilise OpenStreetMap Overpass pour récupérer les vrais tracés cyclables nommés (`route=bicycle` + `name`). Filtrage par admin_level=4 (exclut Belgique/PB), par longueur (15-500 km), par langue. Mirrors de fallback intégrés.

**3. Migrations versionnées** — runner custom avec table `schema_migrations`, checksum sha256, transactions. Pas d'ORM, juste du SQL brut versionné.

**4. Service Worker v20** — network-first HTML (pour les updates live), cache-first assets, fallback `offline.html`. PWA installable.

**5. Anti-bot frontend** — honeypot sur les forms publics, rate-limit par IP, CSP stricte (`script-src 'self'`, pas de `unsafe-eval`).

**6. Strava webhook + retry** — sync push temps réel des nouvelles activités. Fallback `POST /api/strava/resync/:id` pour re-sync manuel.

### Stack

- **Frontend** : HTML/CSS/JS vanilla, Leaflet, Google Street View, Canvas (profil altimétrique)
- **Backend** : Node.js 18+, Express, MySQL2, JWT (access + refresh), Bcrypt, Nodemailer, Multer
- **Externes** : OpenStreetMap Overpass, Open-Meteo (élévation + météo, gratuit), OSRM cycling, Strava API v3

### Stats

- 19 pages frontend
- 14 tables relationnelles
- 63 tests (33 unitaires + 30 intégration)
- ~50 endpoints API REST
- 0 dépendance frontend (Leaflet en CDN exclu)

### Code

https://github.com/Abdoulrazack1/Cycling

Je serais curieux de vos retours sur :
- Le choix "vanilla JS sans framework" en 2026 (provoque souvent du débat)
- Si vous voyez des trucs sécu que j'ai loupés
- Comment vous géreriez la sync Strava plus proprement (le webhook + retry est encore un peu naïf)

---

## Notes

- r/webdev adore le full-stack avec breakdown technique
- Inclure 2-3 screenshots (home, explorateur sortie, admin dashboard)
- Le débat "vanilla JS" attire toujours l'engagement
