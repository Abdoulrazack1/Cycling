// scripts/dump-seed-to-static.js
//
// Cf. AUDIT item #11 — extrait les données de seed.js vers un format
// utilisable par asset/js/data.js en mode `static` (fallback offline).
//
// Avant : asset/js/data.js (1 700 lignes) maintenu à la main, divergeait
// silencieusement de seed.js (580 lignes).
// Maintenant : `node scripts/dump-seed-to-static.js` régénère le bloc.
//
// Usage :
//   node scripts/dump-seed-to-static.js                    # imprime sur stdout
//   node scripts/dump-seed-to-static.js > /tmp/seed.json   # redirige
//
// Pour intégrer au build :
//   "scripts": { "build:static-data": "node scripts/dump-seed-to-static.js > asset/data/seed-snapshot.json" }
//
// NB : on ne réécrit PAS data.js automatiquement (trop de risque de casser
// le mode démo offline). Le script imprime un JSON que le développeur peut
// inspecter, comparer (`diff`), et coller.

'use strict';

// On charge seed.js comme un module — il exporte les constantes par référence
// au module global. Trick : on intercepte les `const` via require() en lisant
// les exports ou en re-évaluant. seed.js utilise `withTransaction` qui appelle
// la BDD si on `require()` directement. Donc on lit le fichier brut et on
// extrait les structures via un eval contrôlé (pas idéal, mais zéro dep).

const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, '..', 'database', 'seed.js');
const src = fs.readFileSync(seedPath, 'utf8');

// Extraire les blocs `const X = [...]` ou `const X = {...}` à la racine.
// On capture tout ce qui se trouve entre l'accolade/crochet ouvrante et la
// fermante équilibrée. Approche : eval() dans un contexte minimal.
function extractTopLevelConst(name) {
  const start = src.search(new RegExp(`^const\\s+${name}\\s*=\\s*[\\[{]`, 'm'));
  if (start === -1) return undefined;
  // Avancer jusqu'à la première accolade
  const openIdx = src.indexOf(/[\[{]/.exec(src.slice(start))[0], start);
  const open = src[openIdx];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = null;
  let escape = false;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (escape) { escape = false; continue; }
    if (inStr) {
      if (c === '\\') { escape = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === open)  depth++;
    if (c === close) {
      depth--;
      if (depth === 0) {
        const literal = src.slice(openIdx, i + 1);
        // eslint-disable-next-line no-new-func
        return new Function('return ' + literal)();
      }
    }
  }
  return undefined;
}

const out = {
  generatedAt: new Date().toISOString(),
  source: 'seed.js',
  sorties:    extractTopLevelConst('SORTIES')    || [],
  pois:       extractTopLevelConst('POIS_MAP')   || {},
  evenements: extractTopLevelConst('EVENEMENTS') || [],
  segments:   extractTopLevelConst('SEGMENTS_GLOBAL') || [],
  palmares:   extractTopLevelConst('PALMARES_DATA') || [],
};

console.log(JSON.stringify(out, null, 2));
console.error(`[dump-seed] Sorties: ${out.sorties.length} · POIs: ${Object.keys(out.pois).length} sorties · Événements: ${out.evenements.length} · Segments: ${out.segments.length} · Palmarès: ${out.palmares.length}`);
