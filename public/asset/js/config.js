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

  // Politique same-origin : frontend et API sont servis depuis la même origine.
  // - En dev  : accéder à http://localhost:3000/ (Express sert le statique
  //             ET l'API). Live Server n'est plus utilisable car cross-origin.
  // - En prod : nginx reverse-proxy route /api/* vers Express, reste → statique.
  // Override possible : ?apiBase=https://api.example.com pour tester un
  //                     backend distant depuis n'importe où.
  const params = new URLSearchParams(location.search);
  const explicit = params.get('apiBase');

  window.CCS_CONFIG = Object.assign({
    backend: 'rest',
    apiBase: explicit || '/api',
  }, window.CCS_CONFIG || {});
})();
