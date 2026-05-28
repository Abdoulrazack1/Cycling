# Publication — Checklist & guide

## État actuel

| Catégorie | État | Détails |
|---|---|---|
| **Backend** | ✅ Prêt | Node 20+ / Express 4 / MySQL 8 / 87 tests OK |
| **Frontend** | ✅ Prêt | HTML/CSS/JS vanilla, responsive 375→1440+ |
| **PWA** | ✅ Installable | manifest.webmanifest + sw.js v24 + icons 192/512/SVG |
| **Sécurité** | ⚠ 2 actions | JWT secret à régénérer + Strava credentials |
| **Domaine/hosting** | ❌ À faire | Pas encore déployé |
| **Mobile native** | ⚠ Wrapper | Capacitor configuré, à build |

---

## A. Avant publication (1 h)

### 1. Régénérer les JWT_SECRET de production

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
```

Copier ces 2 valeurs dans le `.env` de production (PAS dans `.env` local — il est ignoré par git mais le repo public l'a vu une fois).

### 2. Configurer les credentials Strava (admin → Outils)

- Aller sur https://www.strava.com/settings/api → "Create App"
- Authorization Callback Domain : `cc-salouel.fr` (ou ton domaine)
- Récupérer Client ID + Client Secret
- Les coller dans Admin → Strava Config (stockés en BDD, pas dans `.env`)

### 3. Mettre à jour le domaine

Remplacer toutes les références `cc-salouel.fr` par ton vrai domaine :

```bash
# Remplace dans HTML
grep -rl "cc-salouel.fr" --include="*.html" | xargs sed -i 's/cc-salouel.fr/ton-domaine.fr/g'
```

Fichiers à vérifier :
- `index.html` et autres `.html` (og:url, canonical)
- `manifest.webmanifest` (start_url)
- `.well-known/security.txt`
- `robots.txt`

### 4. Vérifier le `.env` de production

```ini
NODE_ENV=production
PORT=3000
DB_HOST=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=ccs_salouel
JWT_SECRET=...           # régénéré
JWT_REFRESH_SECRET=...   # régénéré
FRONTEND_URL=https://ton-domaine.fr
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=noreply@ton-domaine.fr
EMAIL_ADMIN=toi@ton-domaine.fr
COOKIE_SECURE=true        # impose HTTPS
```

---

## B. Déploiement web (3 h)

### Option 1 : VPS Linux (recommandé)

**Hosting** (~5-10€/mois) : OVH, Hetzner, Scaleway, DigitalOcean

```bash
# Sur le VPS (Ubuntu 22.04+)
sudo apt update && sudo apt install -y nodejs npm mysql-server nginx certbot python3-certbot-nginx

# Cloner le repo
git clone https://github.com/Abdoulrazack1/Cycling.git /var/www/cycling
cd /var/www/cycling
npm ci --omit=dev

# Setup MySQL
sudo mysql -e "CREATE DATABASE ccs_salouel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'ccs_user'@'localhost' IDENTIFIED BY 'STRONG_PW';"
sudo mysql -e "GRANT ALL ON ccs_salouel.* TO 'ccs_user'@'localhost'; FLUSH PRIVILEGES;"
sudo mysql ccs_salouel < schema.sql
npm run migrate

# Configurer .env (cf. A.4)
cp .env.example .env && nano .env

# PM2 pour le process management
sudo npm install -g pm2
pm2 start server.js --name cycling
pm2 save && pm2 startup

# Nginx reverse proxy (cf. nginx.conf.example fourni)
sudo cp nginx.conf.example /etc/nginx/sites-available/cycling
sudo ln -s /etc/nginx/sites-available/cycling /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL Let's Encrypt
sudo certbot --nginx -d ton-domaine.fr -d www.ton-domaine.fr
```

### Option 2 : Plateforme managée (plus simple)

- **Railway** / **Render** : déploient depuis GitHub auto. ~5€/mois Node + MySQL inclus.
- **Vercel** : marche pour le frontend, mais le backend Express nécessite un autre service.
- **Fly.io** : gratuit pour petits trafics.

---

## C. App mobile native (2 h, optionnel)

La PWA est déjà installable sur Android/iOS via le navigateur (Chrome → Menu → "Installer l'app"). Pour publier sur les stores, utiliser **Capacitor** :

```bash
# Setup Capacitor (déjà configuré : capacitor.config.json)
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init  # déjà fait

# Android
npx cap add android
npx cap sync android
npx cap open android  # ouvre Android Studio → build APK/AAB

# iOS (nécessite macOS + Xcode)
npx cap add ios
npx cap sync ios
npx cap open ios  # ouvre Xcode
```

L'app pointera vers `https://ton-domaine.fr` (config `server.url` dans `capacitor.config.json`).

Pour publier :
- **Google Play** : compte développeur 25 $ une fois, build AAB depuis Android Studio
- **App Store** : compte Apple Developer 99 $/an, build IPA depuis Xcode

---

## D. Légal & RGPD

- `mentions-legales.html` : à compléter avec les vraies infos du club (président, siège social, hébergeur)
- Cookie banner : conforme (pas de cookies non-essentiels en l'état)
- Politique de confidentialité : à rédiger si on traite des données membres
- Conditions d'utilisation : à rédiger

---

## E. Monitoring post-prod

- **Uptime** : UptimeRobot (gratuit) ou Better Uptime
- **Erreurs** : Sentry (gratuit 5k events/mois)
- **Logs** : pino → fichier ou service (Logtail, Papertrail)
- **Backups** : déjà scriptés (`scripts/backup-db.js`), planifier via cron quotidien
- **Web Vitals** : déjà loggés dans `localStorage.ccs.vitals` côté client

---

## Récap : ce qui te reste à faire

1. ☐ Régénérer JWT_SECRET + JWT_REFRESH_SECRET (5 min)
2. ☐ Acheter un domaine (~10€/an chez OVH/Gandi/Namecheap)
3. ☐ Choisir hosting (VPS OVH 5€/mois recommandé)
4. ☐ Cloner + setup (1-2 h en suivant section B.1)
5. ☐ SSL Let's Encrypt (10 min)
6. ☐ Configurer Strava credentials (5 min via admin)
7. ☐ Compléter `mentions-legales.html`
8. ☐ (Optionnel) Build Android/iOS via Capacitor + publier sur stores
