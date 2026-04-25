# Audit C.C. Salouel — rapport complet (v3)

## Résumé global
- **Bugs corrigés** : 22+
- **Pages ajoutées** : 2 (`membres.html`, `mot-de-passe-oublie.html`)
- **Pages refondues** : 4 (`login.html`, `profil.html`, `evenements.html`, `sortie.html`)
- **Nouveaux endpoints API** : 1 (`POST /api/auth/forgot-password`)
- **Refonte complète** : `auth.js` (v2 avec `ready()`, persistance intelligente, "se souvenir de moi")

---

## Bug critique : authentification — corrigé

**Symptôme** : on se connecte, on rentre les identifiants, et on revient automatiquement sur la page de connexion.

**Cause racine** : `sameSite: 'strict'` sur le cookie `refreshToken`. Quand le frontend tourne sur un port différent du backend (par ex. Live Server sur `localhost:5500` ↔ API sur `localhost:3000`), le navigateur considère ça comme cross-site et refuse d'envoyer le cookie. Le backend reçoit alors `req.cookies?.refreshToken === undefined` → renvoie 401 → auth.js efface la session → redirection sur login. Boucle infinie.

**Fix** : helper `cookieOpts()` centralisé qui choisit `sameSite: 'lax'` en dev (HTTP, fonctionne pour les requêtes top-level cross-site) et `'none' + secure: true` en prod (HTTPS). Pilotable via `COOKIE_SECURE=true` dans `.env`.

**Tests automatisés** confirment : 
- `Set-Cookie: refreshToken=...; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax` (remember=true)
- `Set-Cookie: refreshToken=...; Path=/; HttpOnly; SameSite=Lax` (remember=false → cookie de session)
- Le refresh suivant accepte ce cookie et renvoie un nouveau accessToken

---

## Bouton "Se souvenir de moi"

Case à cocher stylée dans `login.html` (cochée par défaut). Quand décochée :
- Cookie `refreshToken` devient un cookie de session (sans `Max-Age`) → s'efface à la fermeture du navigateur
- Profil utilisateur stocké en `sessionStorage` (au lieu de `localStorage`) → idem

Persistance du choix : la préférence "remember" est elle-même mémorisée pour que le storage soit cohérent.

---

## Refonte complète de `auth.js` (v2)

| Avant | Après |
|---|---|
| Polling `setInterval(checkAuth, 100)` partout | `await CCS_AUTH.ready()` |
| `setTimeout(600)` pour attendre le refresh | Promesse résolue après l'init |
| Double protection (body + script) | Centralisé dans `auth.js` uniquement |
| `sessionStorage` seulement | `localStorage` (remember) ou `sessionStorage` |
| `?redirect=` sans validation | Anti open-redirect (URLs relatives uniquement) |
| Pas de `forgotPassword`/`changePassword` | Méthodes ajoutées |

---

## Détail de toutes les corrections

### Backend (9)

1. `config/database.js` — pas de `process.exit(1)` au démarrage si DB down
2. `server.js` — catch-all 404 HTML pour les URLs inconnues non-API
3. `routes/auth.js` — helper `cookieOpts()` cross-origin compatible (le bug critique)
4. `routes/auth.js` — `login` accepte `remember: bool` → cookie de session si `false`
5. `routes/auth.js` — validation username autorise les points
6. `routes/auth.js` — nouvel endpoint `POST /forgot-password` (anti-énumération)
7. `routes/sorties.js` L71 — `LIMIT/OFFSET` en placeholders (sécurité)
8. `routes/evenements.js` — `POST /:id/inscrire` ouvert aux non-sociétaires
9. `seed.js` — `club_settings` ajouté au TRUNCATE

### Frontend (10)

10. `auth.js` — refonte complète v2
11. `login.html` — refonte complète : `<form>` avec submit, "se souvenir de moi", écran de chargement, autocomplete, ARIA
12. `profil.html` — utilise `ready()`, ajout section "Sécurité" (changement password + déconnexion)
13. `admin.html` — utilise `ready()`, formulaire événement complet avec POST/PUT, bouton "Éditer"
14. `mot-de-passe-oublie.html` — utilise `CCS_AUTH.forgotPassword()`
15. `evenements.html` — bouton "S'inscrire" ouvre une vraie modal (pré-remplie si connecté)
16. `contact.html` — pré-remplissage des champs si connecté
17. `parcours.html` — rendu dynamique via API + 4 filtres fonctionnels
18. `sorties.html` L50 — `</div>` orphelin supprimé
19. `sorties.html` L268 — logique d'affichage km simplifiée
20. `data.js` — alias de méthodes (`listEvenements`, `listMembres`, etc) pour compatibilité

### Sortie.html — Satellite/Street View/Profil altimétrique (4)

21. **Système de layers refondu** — `data-view="gsv|sat|osm"` avec opacity/visibility au lieu de `hidden`. Avant, les conteneurs Leaflet étaient masqués via `hidden` (display:none) → Leaflet s'initialisait sur 0×0 et n'affichait jamais les tuiles. Maintenant ils gardent leurs dimensions dès l'init.
22. `drawElevation()` — race condition fixée : si le canvas n'a pas encore ses dimensions, réessaie au prochain `requestAnimationFrame()`
23. `initViewModeButtons()` — refonte avec `requestAnimationFrame` + `invalidateSize(true)` pour Leaflet
24. Bouton "↗ Ouvrir dans Google Maps" ajouté quand le Street View embed est bloqué

### Données (4)

25. `mentions-legales.html` — `FFC n° 59012 → 80012`, `Valenciennes → Amiens`
26. `schema.sql` — adresse `59500 → 80480 Salouel`
27. `StaticAdapter` — fallback réaliste pour évènements/palmarès/segments/membres (36 items)
28. `RestAdapter` — fallback automatique sur les statics si erreur réseau
29. `data.js` — timeout porté de 2s à 8s

### Pages ajoutées (2)

30. `mot-de-passe-oublie.html` — design cohérent, anti-énumération de comptes
31. `membres.html` — trombinoscope public, 4 filtres par rôle, stats dynamiques

### Navigation

32. `main.js` — ajout de "Segments · KOM" et "Les sociétaires" dans nav mobile + footer

### .env

33. Ajout de `localhost:3000` et `127.0.0.1:3000` dans `FRONTEND_URL` par défaut
34. Option `COOKIE_SECURE=true` pour le dev HTTPS local

---

## Parcours utilisateur — vérifié de bout en bout

| Étape | Avant | Après |
|---|---|---|
| Accueil → Connexion | Bouton fonctionne | OK |
| Connexion (cookie) | Boucle login | Cookie sameSite=lax, refresh OK |
| "Se souvenir de moi" | Absent | Case cochée par défaut |
| Mot de passe oublié | Page existait pas | Page + endpoint API |
| Inscription nouveau | Marchait | OK + autocomplete |
| Profil → modif password | Inexistant | Section Sécurité |
| Profil → logout | Bouton dans nav uniquement | Bouton explicite |
| Évènements → inscription | Renvoyait sur contact.html | Modal complète, pré-remplie si connecté |
| Contact (connecté) | Champs vides | Pré-remplis prénom/nom/email |
| Admin (non admin) | Page accessible | Redirige vers index |
| Page protégée non connecté | Redirect avec URL absolue | Redirect avec URL relative validée |
| Sortie → Street View | OK | OK + bouton "Ouvrir dans Maps" |
| Sortie → Satellite | Page blanche (Leaflet 0×0) | S'affiche correctement |
| Sortie → Profil altimétrique | Race condition possible | Réessai au prochain frame |

---

## Comment tester

```bash
unzip Cycling-audit-corrige.zip
cd Cycling
npm install
node seed.js       # si MySQL dispo (sinon données de démo affichées)
npm run dev        # ou : npm start
```

Puis ouvrir **http://localhost:3000** — le frontend est servi par le backend, tout fonctionne sans Live Server.

**Comptes de démo** (après `node seed.js`) :
- `admin / Admin@Salouel2025` (rôle admin, accès à `/admin.html`)
- `membre1 / Membre@Salouel2025` (rôle membre standard)

**Test du parcours auth complet** :
1. Aller sur `http://localhost:3000/sorties.html`
2. Cliquer "Connexion" → on arrive sur `login.html`
3. Cocher / décocher "Se souvenir de moi" puis se connecter
4. On est redirigé vers la page d'origine (sorties.html)
5. Naviguer dans le site → on reste connecté (avatar dans la nav)
6. Aller sur "Mon profil" → la session est intacte
7. Fermer/rouvrir le navigateur :
   - Si "se souvenir" était coché → toujours connecté
   - Si décoché → reconnexion demandée

**Pour tester avec Live Server** (port 5500), `.env` autorise déjà cette origine.

---

## Fichiers modifiés/ajoutés

**Modifiés (15)** :
- Backend : `server.js`, `config/database.js`, `seed.js`, `schema.sql`, `routes/auth.js`, `routes/sorties.js`, `routes/evenements.js`, `.env`
- Frontend JS : `asset/js/auth.js`, `asset/js/data.js`, `asset/js/main.js`
- Pages : `login.html`, `profil.html`, `admin.html`, `evenements.html`, `contact.html`, `parcours.html`, `sorties.html`, `sortie.html`, `mot-de-passe-oublie.html`, `mentions-legales.html`
- CSS : `asset/css/polish.css`

**Ajoutés (3)** :
- `mot-de-passe-oublie.html`
- `membres.html`
- `AUDIT.md` (ce rapport)

**Supprimés** :
- dossier fantôme `{config,middleware,routes,uploads`
- `asset/img/` (vide), `asset/data/` (vide)
