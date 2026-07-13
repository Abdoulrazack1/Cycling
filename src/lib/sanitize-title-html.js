/* ═════════════════════════════════════════════════════════════════
   lib/sanitize-title-html.js — allowlist stricte pour `title_html`
   (cf. AUDIT item #2 — Stored XSS via title_html)

   Le champ title_html a été conçu pour un SEUL usage : autoriser un
   `<span class="it">mot en italique</span>` dans les titres de sorties
   et d'évènements. Historiquement il était inséré tel quel en base et
   rendu sans échappement côté client → un compte `moderateur` pouvait y
   injecter n'importe quel HTML (`<img onerror=...>`) exécuté chez tous
   les visiteurs des pages publiques.

   Stratégie : on échappe TOUT le HTML, puis on ré-autorise UNIQUEMENT
   les balises `<span class="it">` et `</span>`. Toute autre balise ou
   attribut reste sous forme échappée (texte inerte). Impossible de
   faire passer un tag/attribut arbitraire — c'est une allowlist
   positive, pas une blocklist.
   ═════════════════════════════════════════════════════════════════ */

const MAX_LEN = 250;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Nettoie un title_html : n'autorise que `<span class="it">…</span>`.
 * @param {*} input  valeur brute (peut être null/undefined/non-string)
 * @returns {string|null}  HTML sûr, ou null si vide
 */
function sanitizeTitleHtml(input) {
  if (input == null) return null;
  let s = String(input).slice(0, MAX_LEN);
  if (!s.trim()) return null;

  // 1) tout échapper → aucun tag ne survit
  s = escapeHtml(s);

  // 2) ré-autoriser seulement les balises span de l'allowlist.
  //    Après échappement, `<span class="it">` est devenu
  //    `&lt;span class=&quot;it&quot;&gt;` et `</span>` → `&lt;/span&gt;`.
  s = s
    .replace(/&lt;span class=&quot;it&quot;&gt;/g, '<span class="it">')
    .replace(/&lt;\/span&gt;/g, '</span>');

  return s;
}

module.exports = { sanitizeTitleHtml };
