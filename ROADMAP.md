# Roadmap & Analyse vérifiée — Projet Cycling (CCS Salouël)

> **Méthodologie.** Ce document recoupe l'analyse externe `analyse_fusionnee_cycling.docx`
> avec une **revue du code source réel** (état au commit `1f34479`, 25 juin 2026).
> Chaque point est marqué **✅ confirmé**, **❌ infirmé** ou **⚙️ déjà fait**.
> Objectif : ne travailler que sur ce qui manque *vraiment*, sans repartir sur des
> vulnérabilités génériques que le code ne présente pas.

---

## 1. ✅ Corrections appliquées le 25/06/2026 (cette passe)

| # | Correctif | Détail |
|---|-----------|--------|
| 1 | **Fuite de secrets `.env`** | `.env` était suivi par git et présent dans l'historique (repo public). Retiré du suivi, **purgé de tout l'historique** (`git-filter-repo`), ajouté au `.gitignore`, secrets JWT **rotés**, historique réécrit + force-push. Sauvegarde : `Downloads/Cycling-backup-avant-purge.bundle`. |
| 2 | **Dossier `.claude/`** | Retiré de l'historique + `.gitignore` (l'auteur/contributeur unique reste Abdoulrazack Abdillahi, vérifié sur les 55 commits). |
| 3 | **GPX/photos orphelins** | `DELETE /api/sorties/:id` supprime désormais le fichier GPX (seulement s'il n'est plus référencé par une autre sortie) **et** le dossier photos de la sortie. |
| 4 | **Dossier fantôme** | `{config,middleware,routes,uploads/gpx}` (artefact d'un `mkdir` à accolades non expansées sous Windows) supprimé. |
| 5 | **SRI sur CDN** | `integrity` (sha384) ajouté sur Leaflet 1.9.4 (cdnjs) et Mapillary 4.1.2 (unpkg) dans `sortie.html`. |

### ⚠️ Gestes manuels restants (chantier 1)
- **Changer `DB_PASSWORD`** dans MySQL : `ALTER USER 'ccs_user'@'localhost' IDENTIFIED BY '<nouveau>';` puis MAJ `.env`.
- **Reporter les nouveaux secrets JWT** sur l'hébergeur de prod (variables d'environnement).
- Un secret ayant transité par un repo public est compromis **définitivement** (forks/cache GitHub) → la rotation est ce qui protège, pas seulement la purge.

---

## 2. ❌ Ce que l'analyse initiale affirmait à tort (vérifié dans le code)

| Affirmation du doc | Réalité du code |
|--------------------|-----------------|
| « Risque **XXE** sur le parseur GPX » | **Faux.** `services/gpx-parser.js` est en **regex pure** — aucun parseur XML, aucune DTD, aucune entité externe. Surface XXE inexistante. |
| « `package-lock.json` à versionner » | **Déjà versionné** et suivi. |
| « Rate limiting **uniquement global** » | **Faux.** Limiters dédiés : `globalLimiter`, `authLimiter`, `contactLimiter`, `inscriptionLimiter`, `adminLimiter`, `cspLimiter` (`server.js`). |
| « Fichiers GPX orphelins **jamais gérés** » | Outil admin `GET /api/sorties/orphan-gpx/list` existait déjà ; le nettoyage **automatique** au DELETE a été ajouté (cf. §1.3). |
| « Webhook Strava : **injection de fausses activités** » | **Fortement atténué.** Le handler ne traite que les `owner_id` liés à un athlète connu (`user_strava_link`) et **re-télécharge l'activité depuis l'API Strava** au lieu de faire confiance au payload. |

> **Conclusion :** l'analyse IA était correcte à ~70 % mais hallucinait 2-3 vulnérabilités
> génériques. Le projet est nettement plus mûr que le doc ne le laissait croire :
> 21 routes, 10 services, 11 suites de tests d'intégration, migrations versionnées,
> CSP stricte sans `unsafe-inline`, JWT avec rotation, 2FA (TOTP), audit log.

---

## 3. 🎯 Vrais chantiers restants (priorisés)

### Priorité HAUTE — bloquant pour une vraie mise en ligne
- **Config SMTP réelle.** `services/mailer.js` est prêt ; il manque les identifiants. Débloque d'un coup : newsletter double opt-in, notifications mail, reset de mot de passe. → *Sans SMTP, ces 3 fonctionnalités sont du code mort en prod.*
- **Déploiement production** (cf. §5 / `PUBLISH.md`) : nom de domaine, certificats SSL, gestionnaire de process (PM2), reverse proxy (Nginx), variables d'env de prod, `COOKIE_SECURE=true`, `FRONTEND_URL` réel.
- **RGPD** : compléter `mentions-legales.html` et rédiger une politique de confidentialité (le club collecte des données d'adhérents).

### Priorité MOYENNE
- **Webhook Strava** : vérifier le `subscription_id` reçu contre celui enregistré, ajouter un limiter dédié sur `POST /webhook`, et durcir la branche `delete` (qui supprime sur simple `object_id`).
- **Notifications « réelles »** : la base de données est prête → implémenter la Web Push API (service worker déjà présent).
- **Anti-FOUC thème** : aucun script inline de détection de thème dans le `<head>` aujourd'hui → flash possible au chargement. Ajouter un mini-script synchrone avant le premier paint.
- **Service Worker** : stratégie de rafraîchissement auto (`skipWaiting` + invitation « nouvelle version disponible ») pour ne pas bloquer les utilisateurs sur une version périmée.

### Priorité BASSE — dette technique / qualité
- **Couche services backend** : extraire la logique métier des grosses routes (`auth.js` 43 Ko, `sorties.js` 44 Ko, `strava.js` 29 Ko) vers `services/` pour testabilité et réutilisation.
- **Gestion d'erreurs homogène** : `lib/errors.js` existe → généraliser via un middleware d'erreur global + classe `AppError`, éviter toute fuite de stack trace.
- **Frontend vanilla** : `asset/js/sortie.js` (69 Ko) mélange métier/DOM/API → découper en modules ou migrer progressivement vers une approche composants.
- **Tests** : compléter la couverture et générer un rapport (déjà 11 suites d'intégration, bonne base).

---

## 4. 🚀 Idées de fonctionnalités (backlog produit)

Reprises de l'analyse initiale — pertinentes, à prioriser selon les besoins du club :

**Pour les membres**
- Covoiturage intégré (proposer/demander une place à l'inscription d'une sortie).
- Gamification Strava (challenges internes km / dénivelé cumulé).
- Mini-chat par sortie pour la logistique.

**Pour le club**
- Export PDF des listes d'émargement et bilans d'activité.
- Boutique de tenues avec paiement en ligne (Stripe).
- Flux iCal pour intégrer les sorties dans les agendas personnels.

---

## 5. Tableau de priorités (corrigé)

| Priorité | Action | Catégorie | État |
|----------|--------|-----------|------|
| ~~Haute~~ | ~~Sécuriser le parseur GPX (XXE)~~ | Sécurité | ❌ Non pertinent (parseur regex) |
| **Haute** | Fuite de secrets `.env` | Sécurité | ✅ Fait (reste rotation DB/prod) |
| **Haute** | Config SMTP réelle | Fonctionnel | ⏳ À faire |
| **Haute** | Déploiement prod (domaine/SSL/PM2/Nginx) | Ops | ⏳ À faire |
| **Haute** | RGPD (mentions + confidentialité) | Légal | ⏳ À faire |
| **Moyenne** | Nettoyage GPX/photos orphelins | Maintenance | ✅ Fait |
| **Moyenne** | Webhook Strava (subscription_id + limiter) | Sécurité | ⏳ À faire |
| **Moyenne** | Notifications Web Push | Fonctionnel | ⏳ À faire |
| **Moyenne** | Anti-FOUC + refresh Service Worker | UX | ⏳ À faire |
| **Basse** | Couche services + erreurs homogènes | Qualité code | ⏳ À faire |
| **Basse** | Features backlog (covoiturage, etc.) | Innovation | 💡 Idées |

---

*Document généré le 25/06/2026 — à mettre à jour au fil des chantiers.*
