/* ═══════════════════════════════════════════════════════════════
   Club de Cyclisme de Salouel — config.js
   Configuration centralisée du frontend.

   Pourquoi ce fichier ?
   ─────────────────────
   Avant : chaque page HTML hardcodait
     window.CCS_CONFIG = { backend: 'rest', apiBase: 'http://localhost:3000/api' };
   ce qui rendait le déploiement public impossible (le navigateur du
   visiteur essayait de joindre SON localhost). Cf. AUDIT item #2.

   Maintenant : un seul fichier inclus partout. Il détecte automatiquement
   si on est en dev (localhost / 127.0.0.1 / 0.0.0.0) ou en prod, et bascule.

   Override possible : définir window.CCS_CONFIG AVANT d'inclure ce script,
   ou via ?apiBase=… en query string (utile pour tester un backend distant
   depuis localhost).
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  // Si l'application a déjà fixé une config (via balise <script> inline
  // d'un test E2E par exemple), ne pas l'écraser.
  if (window.CCS_CONFIG && window.CCS_CONFIG.apiBase) return;

  const host = location.hostname;
  const isDev = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';

  // En dev : on assume que le backend Express tourne sur le port 3000,
  //          même si la page est servie par Live Server (5500) ou autre.
  // En prod : same-origin → /api (Nginx ou Express qui sert tout).
  // Override possible : ?apiBase=https://api.example.com pour pointer
  //                     vers un backend distant depuis n'importe où.
  const params = new URLSearchParams(location.search);
  const explicit = params.get('apiBase');

  window.CCS_CONFIG = Object.assign({
    backend: 'rest',
    apiBase: explicit || (isDev ? 'http://localhost:3000/api' : '/api'),
  }, window.CCS_CONFIG || {});
})();
