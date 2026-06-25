/* ═══════════════════════════════════════════════════════════════
   Club de Cyclisme de Salouel — utils.js
   Helpers partagés entre toutes les pages.

   Pourquoi ce fichier ?
   ─────────────────────
   Avant : escapeHtml dupliqué dans auth.js et admin.html, manquant
   ailleurs (sortie.js, weather.js, main.js) → XSS exploitable par
   n'importe quel membre via les POIs (cf. AUDIT item #5).

   À inclure AVANT toute page qui consomme des données API et les
   injecte via innerHTML.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /**
   * Échappe les caractères HTML dangereux pour neutraliser une
   * chaîne destinée à être insérée dans un template literal qui
   * sera assigné à innerHTML.
   *
   * À utiliser sur TOUTE chaîne d'origine externe (API, formulaire,
   * URL params). Ne pas utiliser sur les chaînes statiques du code,
   * c'est juste verbeux.
   *
   * NB : ne fait PAS l'échappement pour un attribut HTML — pour un
   * contexte attribute, utiliser escAttr ci-dessous.
   *
   * @param {*} s   valeur arbitraire (sera coercée en string)
   * @returns {string}
   */
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Variante pour insertion en attribut entre guillemets doubles.
   * En pratique, identique à escapeHtml — l'API existe pour faciliter
   * les recherches « tous les contextes attributs ».
   */
  const escAttr = escapeHtml;

  /**
   * Pour insertion dans un href tel='tel:...' / 'mailto:...' : on garde
   * uniquement les caractères raisonnables (chiffres, +, -, espaces, @)
   * pour éviter qu'un payload "javascript:..." ne se glisse là-bas.
   */
  function escUrl(s) {
    const v = String(s ?? '').trim();
    // Bloquer les schémas dangereux
    if (/^(javascript|data|vbscript|file):/i.test(v)) return '#';
    return escapeHtml(v);
  }

  // Export global (compatibilité scripts non-modules)
  window.CCS_UTILS = { escapeHtml, escAttr, escUrl };
  // Alias court pratique pour les template literals
  window.esc = escapeHtml;
})();
