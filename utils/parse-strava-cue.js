// Parse un cue sheet Strava (texte copié depuis le site web ou retapé)
// en directions structurées { km, label, desc, type }.
//
// Le parser accepte plusieurs formats :
//   "Continuer sur Rue X      1,2 km"        (tableau aligné)
//   "Continuer sur Rue X 1,2 km"             (espaces normaux)
//   "Continuer sur Rue X\n1,2 km"            (description et km sur lignes séparées)
//
// Retourne un array trié par km croissant. La première entrée (km min) devient
// type 'depart', la dernière (km max) devient 'arrivee', le reste 'direction'.

const KM_RE = /(\d+(?:[.,]\d+)?)\s*km\b/i;

// Mots-clés Strava → forme courte (label) avec indicateur visuel de direction
const VERBS = [
  { re: /^poursuivre\s+sur\s+(le\s+point\s+de\s+passage\s+hors\s+route.*)/i, prefix: '', label: 'Passage hors route', shortDesc: 'Poursuivre — hors route' },
  { re: /^continuer\s+sur\s+(le\s+point\s+de\s+passage\s+hors\s+route.*)/i,  prefix: '', label: 'Passage hors route', shortDesc: 'Continuer — hors route' },
  { re: /^faites\s+demi-tour\s+sur\s+(.+)/i,    prefix: '↺ ' },
  { re: /^demi-tour\s+sur\s+(.+)/i,             prefix: '↺ ' },
  { re: /^droite\s+sur\s+(.+)/i,                prefix: '→ ' },
  { re: /^gauche\s+sur\s+(.+)/i,                prefix: '← ' },
  { re: /^l[eé]g[eè]re?\s+droite\s+sur\s+(.+)/i,prefix: '⇗ ' },
  { re: /^l[eé]g[eè]re?\s+gauche\s+sur\s+(.+)/i,prefix: '⇖ ' },
  { re: /^continuer\s+sur\s+(.+)/i,             prefix: '' },
  { re: /^poursuivre\s+sur\s+(.+)/i,            prefix: '' },
  { re: /^prendre\s+(?:la\s+)?(?:sortie|direction)\s+(.+)/i, prefix: '↗ ' },
];

function deriveLabel(desc) {
  if (!desc) return '';
  const trimmed = desc.replace(/\s+/g, ' ').trim();
  if (/^arriv[eé]e?\b/i.test(trimmed)) return 'Arrivée';
  if (/^d[eé]part\b/i.test(trimmed))   return 'Départ';
  for (const v of VERBS) {
    const m = trimmed.match(v.re);
    if (m) {
      if (v.label) return v.label;
      return (v.prefix + m[1].trim()).slice(0, 80);
    }
  }
  return trimmed.slice(0, 80);
}

// Patterns de pollution OCR à filtrer (footer disclaimer Strava, titres section, etc.)
const NOISE_PATTERNS = [
  /\b(recommandations|incompl[èe]te|inexactes|d[ée]rangereux|terrain|disgracieux|respecter?|propri[ée]t[ée] priv[ée]e|code de la route)\b/i,
  /\b(d[ée]nivel[ée]\s+positif|dur[ée]e\s+de\s+d[ée]placement|distance\s+totale)\b/i,
  /^(CLM_?\d*|essai_?\d*|\d+\s*km\s*[—-])/i,  // titre Strava
  /^\d+\s*[mh]\s*[=—-]/i,                       // "79m =— 26:39"
  /^[\d,.\s]+$/,                                // ligne avec uniquement des chiffres
  /^[a-zA-Z]{1,4}\s+(?:Poursuivre|Continuer|Droite|Gauche)/, // "pa Poursuivre", "ser Continuer", "10n Poursuivre"
];

const VERB_START = /^(Poursuivre|Continuer|Droite|Gauche|Faites|L[ée]g[èe]re?|Prendre|Arriv[ée]e?|D[ée]part)\b/i;

function isNoise(desc) {
  if (!desc) return true;
  const len = desc.length;
  if (len < 4 || len > 120) return true;
  for (const re of NOISE_PATTERNS) if (re.test(desc)) return true;
  return false;
}

function cleanDesc(desc) {
  // Strip leading garbage (1-4 chars + space) before a verb if found
  // Ex: "pa Poursuivre sur Rue X" → "Poursuivre sur Rue X"
  const m = desc.match(/^[^\w\s]*[a-zA-Z0-9]{1,4}\s+(Poursuivre|Continuer|Droite|Gauche|Faites|L[ée]g[èe]re?|Prendre|Arriv[ée]e?)\b/i);
  if (m) return desc.slice(desc.indexOf(m[1]));
  // Strip leading punctuation/symbols
  return desc.replace(/^[^\wÀ-ÿ]+/, '').trim();
}

function parseStravaCueSheet(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const lines = rawText
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => !/^(DIRECTION|DISTANCE)\s*$/i.test(s))
    .filter(s => !/^https?:\/\//i.test(s));

  const raw = [];
  let pendingDesc = null;

  for (const line of lines) {
    const km = extractKm(line);
    const lineWithoutKm = km !== null ? line.replace(KM_RE, '').trim() : line;

    if (km !== null) {
      let desc = cleanDesc(lineWithoutKm || pendingDesc || '');
      if (desc && !isNoise(desc)) {
        raw.push({ km, desc });
      }
      pendingDesc = null;
    } else {
      pendingDesc = pendingDesc ? `${pendingDesc} ${line}` : line;
    }
  }

  if (raw.length === 0) return [];

  raw.sort((a, b) => a.km - b.km);

  // Dédoublonnage : si deux entrées ont le même (km, label dérivé), garder la première
  const seen = new Set();
  const deduped = raw.filter(entry => {
    const key = `${entry.km.toFixed(2)}|${deriveLabel(entry.desc)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Détection arrivée : la dernière entrée si elle contient "arrivée" OU si km max
  return deduped.map((entry, i) => {
    const isLast  = i === deduped.length - 1;
    const isFirst = i === 0;
    const looksLikeArrivee = /arriv[eé]e?/i.test(entry.desc);
    const looksLikeDepart  = /^d[eé]part\b/i.test(entry.desc);

    let type;
    if (looksLikeArrivee || isLast)             type = 'arrivee';
    else if (looksLikeDepart || (isFirst && entry.km === 0)) type = 'depart';
    else                                         type = 'direction';

    return {
      km:    Number(entry.km.toFixed(2)),
      label: deriveLabel(entry.desc),
      desc:  entry.desc,
      type,
    };
  });
}

function extractKm(line) {
  const m = line.match(KM_RE);
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

module.exports = { parseStravaCueSheet, deriveLabel };
