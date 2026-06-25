/**
 * services/course-scraper.js — v3
 *
 * Sources de calendriers cyclistes. MilesRepublic est protégé par Cloudflare
 * et bloque Node.js → on privilégie les sources sans anti-bot.
 *
 * Pour MilesRepublic : solution de contournement via un dump HTML local
 * (voir commentaire MILES_WORKAROUND ci-dessous).
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const logger = require('../lib/logger');

const FETCH_TIMEOUT = 20_000;
const UA_BROWSER = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'Chrome/124.0.0.0 Safari/537.36',
].join(' ');

// ═══════════════════════════════════════════════════════════════
//  SOURCES configurées
// ═══════════════════════════════════════════════════════════════
const SOURCES = [
  // ── OpenStreetMap Overpass (itinéraires cyclables nommés, fiable) ──
  // Requiert le flag --osm dans scrape-sorties.js
  // Pas de rate-limit problématique pour un usage raisonnable.
  { name: 'osm-hdf',   label: 'OSM — HdF routes cyclables',    type: 'osm' },
  { name: 'osm-somme', label: 'OSM — Somme routes cyclables',   type: 'osm' },

  // ── MilesRepublic (listing, peut être bloqué par Cloudflare) ──
  // Si 403 : déposer les pages HTML dans scripts/html-dumps/ et relancer.
  { name: 'mr-cyclo-hdf',  label: 'MilesRepublic — Cyclosportive HdF', url: 'https://fr.milesrepublic.com/cyclosportive/hauts-de-france', type: 'milesrepublic', eventType: 'cyclosportive' },
  { name: 'mr-gravel-hdf', label: 'MilesRepublic — Gravel HdF',        url: 'https://fr.milesrepublic.com/course-gravel/hauts-de-france', type: 'milesrepublic', eventType: 'gravel' },
  { name: 'mr-velo-hdf',   label: 'MilesRepublic — Vélo HdF',          url: 'https://fr.milesrepublic.com/velo/hauts-de-france',          type: 'milesrepublic', eventType: 'rando' },
  { name: 'mr-rando-hdf',  label: 'MilesRepublic — Rando HdF',         url: 'https://fr.milesrepublic.com/rando-velo-de-route/hauts-de-france', type: 'milesrepublic', eventType: 'rando' },
];

// ═══════════════════════════════════════════════════════════════
//  Fetch HTTP simple (avec fallback dump local)
// ═══════════════════════════════════════════════════════════════
async function _fetch(url, source) {
  // Dump local : si scripts/html-dumps/<source.name>.html existe, l'utiliser
  const dumpPath = path.join(__dirname, '..', 'scripts', 'html-dumps', source.name + '.html');
  if (fs.existsSync(dumpPath)) {
    logger.info(`    (dump local: ${source.name}.html)`);
    return fs.readFileSync(dumpPath, 'utf8');
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA_BROWSER,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

// ═══════════════════════════════════════════════════════════════
//  Compteur de fallbacks — réinitialisé à chaque scrapeAll()
//  Permet de détecter quand la structure HTML cible a bougé.
// ═══════════════════════════════════════════════════════════════
const _fallbackHits = {};
function _recordFallback(label) {
  _fallbackHits[label] = (_fallbackHits[label] || 0) + 1;
  logger.warn({ label, hits: _fallbackHits[label] }, 'scraper fallback used');
}
function _resetFallbacks() {
  for (const k of Object.keys(_fallbackHits)) delete _fallbackHits[k];
}

// Helper : applique une liste de regex dans l'ordre, log un warn si on
// utilise un fallback (= la primaire a échoué).
function _matchWithFallback(text, patterns, label) {
  for (let i = 0; i < patterns.length; i++) {
    const m = text.match(patterns[i]);
    if (m) {
      if (i > 0) _recordFallback(`${label}#${i}`);
      return m;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  Parser MilesRepublic — structure réelle mai 2026
//  Les événements sont dans des <a href="/event/slug-id">
// ═══════════════════════════════════════════════════════════════
// Patterns de liens event — primaire + fallbacks au cas où MilesRepublic
// changerait son schéma d'URL (ex. /events/, /e/, etc.).
const LINK_PATTERNS = [
  /<a[^>]+href=["'](\/event\/[^"'?#\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  /<a[^>]+href=["'](\/events?\/[^"'?#\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  /<a[^>]+href=["'](\/e\/[^"'?#\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi,
];

function parseMilesRepublic(html, source) {
  const events = [];
  let matchedAny = false;

  for (let p = 0; p < LINK_PATTERNS.length && !matchedAny; p++) {
    const re = new RegExp(LINK_PATTERNS[p].source, LINK_PATTERNS[p].flags);
    let m;
    while ((m = re.exec(html)) !== null) {
      matchedAny = true;
      if (p > 0) _recordFallback(`link-pattern#${p}`);
      const text = _strip(m[2]);
      const name = _name(text);
      if (!name || name.length < 3) continue;
      if (/running|trail|triathlon|natation|marche nordique|ski|yoga|parapente/i.test(name)) continue;
      const date = _date(text);
      const { lieu, region } = _lieu(text);
      const distanceKm = _dist(text);
      let type = source.eventType || 'rando';
      if (/gravel/i.test(name + ' ' + text)) type = 'gravel';
      const slug = _slug(m[1], date);
      events.push({ name, slug, date, lieu, region, distanceKm, type,
        source: source.name, sourceUrl: 'https://fr.milesrepublic.com' + m[1],
        waypoints: null, description: null });
    }
  }

  if (!matchedAny && html.length > 1000) {
    _recordFallback('link-pattern-all-failed');
  }
  return events;
}

// ── Helpers de parsing ─────────────────────────────────────────
function _strip(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<script[\s\S]*?<\/script>/gi,'')
    .replace(/<[^>]+>/g,' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .replace(/&#\d+;/g,' ').replace(/&[a-z]+;/g,' ')
    .replace(/\s{2,}/g,' ').trim();
}

function _name(text) {
  let t = text.replace(/^(Achat instantan[ée]|Nouveau|Complet|Partenaire\s+\w+)\s*/i,'');
  const i = t.indexOf(' - image ');
  if (i > 3) t = t.substring(0, i).trim();
  t = t.replace(/\s*\d{1,2}\s+(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre).*/i,'').trim();
  return t.length >= 3 ? t.replace(/\s+/g,' ') : null;
}

function _date(text) {
  const MONTHS = {janvier:1,février:2,fevrier:2,mars:3,avril:4,mai:5,juin:6,juillet:7,août:8,aout:8,septembre:9,octobre:10,novembre:11,décembre:12,decembre:12};
  // Primaire : "15 mars 2026" / fallback : "15/03/2026", "2026-03-15"
  const patterns = [
    /(\d{1,2})\s*(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s*(20\d{2})/i,
    /(\d{1,2})\/(\d{1,2})\/(20\d{2})/,
    /(20\d{2})-(\d{2})-(\d{2})/,
  ];
  const m = _matchWithFallback(text, patterns, 'date');
  if (!m) return null;
  // Branchement selon le format
  if (m[0].includes('/')) return `${m[3]}-${String(+m[2]).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`;
  if (/^20\d{2}-/.test(m[0])) return `${m[1]}-${m[2]}-${m[3]}`;
  const mo = MONTHS[m[2].toLowerCase()];
  return mo ? `${m[3]}-${String(mo).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}` : null;
}

function _lieu(text) {
  const DEPTS = {'02':'Aisne (02)','59':'Nord (59)','60':'Oise (60)','62':'Pas-de-Calais (62)','80':'Somme (80)'};
  // Primaire : "Ville (62)" / fallback : "Ville, Pas-de-Calais"
  const patterns = [
    /([A-ZÀ-Ö][a-zA-ZÀ-öØ-ÿ\s''\-]{1,40})\s*\((\d{2})\)/,
    /([A-ZÀ-Ö][a-zA-ZÀ-öØ-ÿ\s''\-]{1,40})\s*,\s*(Aisne|Nord|Oise|Pas-de-Calais|Somme)/i,
  ];
  const m = _matchWithFallback(text, patterns, 'lieu');
  if (!m) return { lieu: null, region: null };
  const lieu = m[1].trim();
  if (/^\d{2}$/.test(m[2])) return { lieu, region: DEPTS[m[2]] || `Dépt. ${m[2]}` };
  // Match nominatif : retrouver le code département
  const code = Object.entries(DEPTS).find(([, v]) => v.startsWith(m[2]))?.[0];
  return { lieu, region: code ? DEPTS[code] : m[2] };
}

function _dist(text) {
  // Primaire : "120 km" / fallback : "120-150 km" → prend la plus grande, "120km" sans espace
  const patterns = [
    /(\d{2,3})\s*km\b/i,
    /\d{2,3}\s*[-–]\s*(\d{2,3})\s*km\b/i,
    /(\d{2,3})km\b/i,
  ];
  const m = _matchWithFallback(text, patterns, 'distance');
  return m ? parseInt(m[1], 10) : null;
}

function _slug(relHref, date) {
  const base = relHref.replace('/event/','').replace(/-\d+$/,'').replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  return `${base}-${date ? date.slice(0,4) : new Date().getFullYear()}`;
}

// ═══════════════════════════════════════════════════════════════
//  scrapeAll — publie toutes les sources MilesRepublic
//  (OSM est géré séparément dans scrape-sorties.js --osm)
// ═══════════════════════════════════════════════════════════════
async function scrapeAll(opts = {}) {
  _resetFallbacks();
  const log = [], errors = [], all = [];
  const sources = SOURCES.filter(s => s.type === 'milesrepublic');

  await Promise.allSettled(sources.map(async src => {
    try {
      log.push(`→ ${src.name} : ${src.url}`);
      const html = await _fetch(src.url, src);
      const evs  = parseMilesRepublic(html, src);
      log.push(`✓ ${src.name} : ${evs.length} événements`);
      all.push(...evs);
    } catch (e) {
      // 403 = Cloudflare bot protection → expliquer le workaround
      const hint = e.message.includes('403')
        ? ` (Cloudflare bloque Node.js — voir workaround ci-dessous)`
        : '';
      errors.push({ source: src.name, error: e.message + hint });
      log.push(`✗ ${src.name} : ${e.message}${hint}`);
    }
  }));

  const seen = new Set();
  const unique = all.filter(e => { if (!e.slug||seen.has(e.slug)) return false; seen.add(e.slug); return true; });
  log.push(`Total brut: ${all.length}, unique: ${unique.length}`);

  if (errors.some(e => e.error.includes('403'))) {
    log.push('');
    log.push('💡 WORKAROUND MilesRepublic (Cloudflare bloque les requêtes Node.js) :');
    log.push('   1. Ouvrir https://fr.milesrepublic.com/cyclosportive/hauts-de-france dans Chrome');
    log.push('   2. Ctrl+S → Enregistrer la page sous scripts/html-dumps/mr-cyclo-hdf.html');
    log.push('   3. Faire pareil pour les autres pages (gravel, rando, velo)');
    log.push('   4. Relancer npm run scrape');
  }

  return { events: unique, errors, log, fallbacks: { ..._fallbackHits } };
}

module.exports = {
  scrapeAll,
  SOURCES,
  // Exports internes pour tests + diagnostic
  _internals: { parseMilesRepublic, _strip, _name, _date, _lieu, _dist, _slug, _fallbackHits, _resetFallbacks },
};