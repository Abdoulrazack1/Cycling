/**
 * services/course-scraper.js
 * 
 * Scraper de sources publiques pour détecter les nouvelles courses HdF.
 * 
 * Sources actuellement supportées :
 *   - milesrepublic.com/cyclosportive/hauts-de-france
 *   - hautsdefrancecyclisme.fr/route (calendrier officiel FFC HdF)
 * 
 * Les sources peuvent être ajoutées en éditant l'array `SOURCES` ci-dessous.
 * Chaque source a un `parser` qui transforme le HTML brut en événements normalisés.
 * 
 * Format normalisé d'événement :
 *   {
 *     name:         "L'Enfer des Flandres",
 *     slug:         "enfer-des-flandres-2026",
 *     date:         "2026-06-14",
 *     lieu:         "Cassel",
 *     region:       "Nord (59)",
 *     distanceKm:   157,
 *     type:         "cyclosportive" | "rando" | "course" | "gravel",
 *     source:       "milesrepublic.com",
 *     sourceUrl:    "https://...",
 *     // Optionnels (souvent absents du scraping → à enrichir manuellement)
 *     waypoints:    null,
 *     description:  "..."
 *   }
 */

const SOURCES = [
  {
    name: 'milesrepublic',
    label: 'Miles Republic — HdF',
    url:   'https://fr.milesrepublic.com/cyclosportive/hauts-de-france',
    parser: parseMilesRepublic,
  },
  {
    name: 'milesrepublic-pdc',
    label: 'Miles Republic — Pas-de-Calais',
    url:   'https://fr.milesrepublic.com/velo/pas-de-calais',
    parser: parseMilesRepublic,
  },
  {
    name: 'milesrepublic-cyclo-pdc',
    label: 'Miles Republic — Cyclo PdC',
    url:   'https://fr.milesrepublic.com/cyclosportive/pas-de-calais',
    parser: parseMilesRepublic,
  },
  // Note : le scraping de la FFC HdF nécessite l'API FFC ou une page calendrier
  // accessible sans JavaScript. À ajouter quand l'URL stable sera identifiée.
];

const FETCH_TIMEOUT = 15_000;
const USER_AGENT = 'CCS-Cycling-Bot/1.0 (+https://ccs-salouel.fr; contact@ccs-salouel.fr)';

/**
 * Lance le scraping de toutes les sources et agrège les résultats.
 * Dédoublonne par slug.
 * 
 * @param {object} [opts]
 * @param {boolean} [opts.parallel=true]
 * @returns {Promise<{events: Array, errors: Array, log: Array}>}
 */
async function scrapeAll(opts = {}) {
  const log = [];
  const errors = [];
  const allEvents = [];

  const promises = SOURCES.map(source => _scrapeSource(source, log, errors));
  const results = await Promise.allSettled(promises);

  for (const res of results) {
    if (res.status === 'fulfilled' && res.value) {
      allEvents.push(...res.value);
    }
  }

  // Dédoublonnage par slug
  const seen = new Set();
  const unique = allEvents.filter(e => {
    if (!e.slug) return false;
    if (seen.has(e.slug)) return false;
    seen.add(e.slug);
    return true;
  });

  log.push(`Total brut: ${allEvents.length}, unique: ${unique.length}`);
  return { events: unique, errors, log };
}

async function _scrapeSource(source, log, errors) {
  try {
    log.push(`→ ${source.name} : fetching ${source.url}`);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    const resp = await fetch(source.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    });
    clearTimeout(t);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const events = source.parser(html, source);
    log.push(`✓ ${source.name} : ${events.length} événements`);
    return events;
  } catch (err) {
    errors.push({ source: source.name, error: err.message });
    log.push(`✗ ${source.name} : ${err.message}`);
    return [];
  }
}

/**
 * Parser pour Miles Republic (et variantes).
 * 
 * Le HTML de Miles Republic suit un schéma de cartes :
 *   <article class="card">
 *     <h3>Nom de la course</h3>
 *     <span class="date">8 mai 2026</span>
 *     <span class="lieu">Croix-en-Ternois (62)</span>
 *     <span class="distance">28 km</span>
 *   </article>
 * 
 * Comme la structure exacte évolue, on utilise des regex robustes plutôt qu'un parseur DOM.
 */
function parseMilesRepublic(html, source) {
  const events = [];
  // Cherche les blocs de courses : balises <a class="..."> qui contiennent
  // titre, date et lieu. Très tolérant à la structure exacte.
  const cardRegex = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const matches = [...html.matchAll(cardRegex)];

  for (const m of matches) {
    const href = m[1];
    const inner = m[2];
    // Ne traiter que les liens vers une page d'événement
    if (!/\/(?:cyclosportive|velo|gravel|rando)\//.test(href)) continue;

    const titleMatch = inner.match(/<(?:h\d|span[^>]*class="[^"]*title[^"]*")[^>]*>([^<]+)</i);
    const title = titleMatch ? titleMatch[1].trim() : null;
    if (!title || title.length < 3) continue;

    // Date au format "8 mai 2026" ou "Date à confirmer"
    const dateMatch = inner.match(/(\d{1,2})\s*([\u00C0-\u017F\w]+)\s*(20\d{2})/i);
    let date = null;
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = _monthFr(dateMatch[2]);
      const year = parseInt(dateMatch[3], 10);
      if (month) date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }

    const lieuMatch = inner.match(/([\w\u00C0-\u017F][\w\u00C0-\u017F\s\-']{2,40})\s*\((\d{2})\)/);
    let lieu = null, region = null;
    if (lieuMatch) {
      lieu = lieuMatch[1].trim();
      const dept = lieuMatch[2];
      region = _regionForDept(dept);
    }

    const distanceMatch = inner.match(/(\d{1,3})\s*km/i);
    const distanceKm = distanceMatch ? parseInt(distanceMatch[1], 10) : null;

    // Type inféré depuis l'URL
    let type = 'rando';
    if (/cyclosportive/.test(href)) type = 'cyclosportive';
    else if (/gravel/.test(href)) type = 'gravel';

    const slug = _slugify(title) + (date ? '-' + date.substring(0, 4) : '');

    events.push({
      name: title, slug,
      date, lieu, region,
      distanceKm, type,
      source: source.name,
      sourceUrl: href.startsWith('http') ? href : new URL(href, source.url).href,
      waypoints: null,
      description: null,
    });
  }
  return events;
}

function _monthFr(s) {
  const map = {
    'janvier':1,'février':2,'fevrier':2,'mars':3,'avril':4,'mai':5,'juin':6,
    'juillet':7,'août':8,'aout':8,'septembre':9,'octobre':10,'novembre':11,'décembre':12,'decembre':12
  };
  return map[s.toLowerCase()];
}

function _regionForDept(dept) {
  const map = {
    '02': 'Aisne (02)', '59': 'Nord (59)', '60': 'Oise (60)',
    '62': 'Pas-de-Calais (62)', '80': 'Somme (80)',
  };
  return map[dept] || `Département ${dept}`;
}

function _slugify(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

module.exports = { scrapeAll, SOURCES };
