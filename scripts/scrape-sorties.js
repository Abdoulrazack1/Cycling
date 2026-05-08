/**
 * scripts/scrape-sorties.js — v2 (mode tracés réels uniquement)
 *
 * Pipeline strict : ne garde que les sorties avec un tracé OFFICIEL.
 *
 *   ✅ MilesRepublic : suit le lien vers la page événement, télécharge le GPX
 *      officiel s'il y en a un (sinon SKIP — pas de tracé approximatif).
 *   ✅ OpenStreetMap : itinéraires cyclables nommés dans les Hauts-de-France
 *      uniquement, avec géométrie réelle (relations route=bicycle).
 *
 * Usage :
 *   node scripts/scrape-sorties.js                  # dry-run, liste les events
 *   node scripts/scrape-sorties.js --save-db        # scrape + insère
 *   node scripts/scrape-sorties.js --osm            # + sources OSM
 *   node scripts/scrape-sorties.js --force          # re-traite même les GPX existants
 *   node scripts/scrape-sorties.js --limit N        # max N events (test)
 *   node scripts/scrape-sorties.js --allow-approx   # autorise tracés OSRM circulaires
 */

'use strict';
require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const generator  = require('../services/course-generator');
const scraper    = require('../services/course-scraper');
const gpxBuilder = require('../services/gpx-builder');
const routing    = require('../services/routing');
const { fetchElevations, computeDplus } = require('../services/elevation');

// ── Config ─────────────────────────────────────────────────────
const GPX_DIR = path.join(__dirname, '..', 'asset', 'gpx');
const TIMEOUT = 20_000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// CLI
const args         = process.argv.slice(2);
const SAVE_DB      = args.includes('--save-db');
const FORCE        = args.includes('--force');
const WITH_OSM           = args.includes('--osm');
const WITH_MILESREPUBLIC = args.includes('--milesrepublic');
const ALLOW_APPROX       = args.includes('--allow-approx');   // par défaut : tracés réels uniquement
const ONLY         = args.includes('--only')  ? args[args.indexOf('--only') + 1]  : null;
const LIMIT        = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : Infinity;
const DRY_RUN      = !SAVE_DB;

// ── Périmètre Hauts-de-France ─────────────────────────────────
const HDF_DEPTS = new Set(['02', '59', '60', '62', '80']);
const HDF_BBOX  = { south: 49.0, west: 1.3, north: 51.1, east: 4.2 };

// ── Auto-cleanup : grâce de N jours après la date d'une course
//    avant suppression définitive (BDD + GPX) ───────────────────
const GRACE_DAYS = parseInt(process.env.SCRAPE_GRACE_DAYS || '7', 10);

// Date "permanente" pour les itinéraires OSM (jamais expirés)
const PERMANENT_DATE = '2099-12-31';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0, 60);
}
const log  = m => console.log(`  ${m}`);
const ok   = m => console.log(`  ✅ ${m}`);
const warn = m => console.warn(`  ⚠️  ${m}`);
const err  = m => console.error(`  ❌ ${m}`);
const head = m => console.log(`\n${'═'.repeat(60)}\n  ${m}\n${'═'.repeat(60)}`);
const step = m => console.log(`\n── ${m}`);

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout || TIMEOUT);
  try {
    return await fetch(url, {
      ...opts, signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
  } finally { clearTimeout(t); }
}

// Extrait le département (00-99) depuis ev.lieu, ev.region, ou la 1re coord
function extractDept(ev) {
  const txt = (ev.region || '') + ' ' + (ev.lieu || '');
  const m = txt.match(/\((\d{2})\)/);
  if (m) return m[1];
  const wp = ev.waypoints?.[0];
  if (wp) {
    if (wp.lat > 50.5)            return wp.lng < 2.5 ? '62' : '59'; // PdC vs Nord
    if (wp.lat > 49.8)            return '80';                       // Somme
    if (wp.lat > 49.2 && wp.lng < 3.5) return '60';                  // Oise
    if (wp.lat > 49.2)            return '02';                       // Aisne
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// 1) Recherche d'un GPX officiel — UNIQUEMENT pour les sources qui
//    pointent directement vers une page d'événement chez l'organisateur.
//    MilesRepublic = plateforme d'inscription, pas un repo GPX → on ne
//    perd plus de temps à fouiller leurs pages.
// ═══════════════════════════════════════════════════════════════
async function findOfficialGpx(eventPageUrl) {
  // MilesRepublic ne distribue pas de GPX, on ne tente même pas
  if (eventPageUrl.includes('milesrepublic.com')) return null;

  try {
    const resp = await fetchWithTimeout(eventPageUrl);
    if (!resp.ok) return null;
    const html = await resp.text();

    const patterns = [
      /href=["']([^"']+\.gpx)["']/gi,
      /href=["']([^"']*\/gpx\/[^"']+)["']/gi,
      /href=["']([^"']*download[^"']*gpx[^"']*)["']/gi,
      /href=["']([^"']+)["'][^>]*>\s*[^<]*(?:t[ée]l[ée]charger|download)[^<]*(?:gpx|parcours|trace|tracé)/gi,
    ];

    for (const pat of patterns) {
      const m = pat.exec(html);
      if (!m) continue;
      const href = m[1];
      if (!href || href.startsWith('javascript:') || href.startsWith('#')) continue;
      try {
        const abs = href.startsWith('http') ? href : new URL(href, eventPageUrl).href;
        const gpxResp = await fetchWithTimeout(abs);
        if (!gpxResp.ok) continue;
        const text = await gpxResp.text();
        if (text.includes('<trkpt') || text.includes('<rtept') || text.includes('<wpt')) {
          return { url: abs, content: text };
        }
      } catch { continue; }
    }
    return null;
  } catch { return null; }
}

// Parse le contenu GPX en points
function parseGpxText(xml) {
  const pts = [];
  const re = /<trkpt[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>(?:[\s\S]*?<ele>([\d.]+)<\/ele>)?/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    const ele = m[3] ? parseFloat(m[3]) : null;
    if (!isNaN(lat) && !isNaN(lng)) pts.push({ lat, lng, ele });
  }
  return pts.length >= 2 ? pts : null;
}

// ═══════════════════════════════════════════════════════════════
// 2) OSM Overpass — itinéraires cyclables nommés HdF
// ═══════════════════════════════════════════════════════════════
async function scrapeOsm() {
  log(`Overpass OSM → Hauts-de-France (zone administrative officielle) ...`);
  // On cible la région administrative HdF par son nom (admin_level=4 en France).
  // Plus précis qu'un bbox : exclut automatiquement la Belgique / les Pays-Bas
  // qui auraient été inclus par un rectangle géographique.
  const query = `[out:json][timeout:120];
area["name"="Hauts-de-France"]["admin_level"="4"]->.hdf;
relation(area.hdf)["route"="bicycle"]["name"]["network"!="icn"];
out geom;`;

  // Mirrors Overpass officiels — on essaye dans l'ordre, le 1er qui répond gagne
  const MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
  ];

  let resp = null;
  let lastError = null;
  for (const mirror of MIRRORS) {
    try {
      const url = `${mirror}?data=${encodeURIComponent(query)}`;
      // UA simple : Apache devant Overpass rejette parfois les UA Chrome
      // On s'identifie comme un outil script (convention Overpass)
      resp = await fetch(url, {
        signal: AbortSignal.timeout(90_000),
        headers: {
          'User-Agent': 'CCS-Salouel-Scraper/1.0 (cycling club; node.js)',
          'Accept': 'application/json',
          'Accept-Language': 'fr,en',
        },
      });
      if (resp.ok) { log(`  → mirror utilisé : ${mirror}`); break; }
      const body = await resp.text().catch(() => '');
      lastError = `HTTP ${resp.status} sur ${mirror}${body ? ' : ' + body.slice(0, 150).replace(/\s+/g, ' ') : ''}`;
      warn(`  ${lastError}`);
      resp = null;
    } catch (e) {
      lastError = `${mirror} : ${e.message}`;
      warn(`  ${lastError}`);
    }
  }
  if (!resp) {
    warn(`Tous les mirrors Overpass ont échoué. Dernier : ${lastError}`);
    return [];
  }

  try {
    const data = await resp.json();
    const elements = data?.elements || [];
    log(`  → ${elements.length} relations brutes reçues`);

    const events = [];
    // Termes typiques des réseaux cyclistes belges/néerlandais/allemands.
    // Si on trouve ça dans le nom, c'est une route qui mord sur la HdF
    // depuis l'étranger (ex. relations transfrontalières mal cadrées).
    const FOREIGN_TERMS = /\b(knooppunt|fietsroute|fietsnetwerk|fietspad|radweg|radroute|rondrit|lus|netwerk)\b/i;

    for (const rel of elements) {
      if (!rel.tags?.name) continue;
      if (FOREIGN_TERMS.test(rel.tags.name)) continue;

      // Construire les waypoints depuis la géométrie réelle des ways membres
      const waypoints = [];
      if (rel.members) {
        for (const member of rel.members) {
          if (member.type === 'way' && member.geometry) {
            for (const pt of member.geometry) {
              waypoints.push({ lat: pt.lat, lng: pt.lon });
            }
          }
        }
      }
      if (waypoints.length < 50) continue;  // au moins 50 points = ~5+ km de tracé réel

      // Calcul rapide de la distance pour filtrer les itinéraires trop courts
      let approxKm = 0;
      for (let i = 1; i < Math.min(waypoints.length, 500); i++) {
        approxKm += routing.haversine(waypoints[i-1], waypoints[i]) / 1000;
      }
      // Si on a échantillonné, extrapoler
      if (waypoints.length > 500) approxKm *= waypoints.length / 500;
      if (approxKm < 15) continue;  // skip <15 km (chemins, sentiers)
      if (approxKm > 500) continue; // skip >500 km (EuroVelo entiers)

      // Filtre département : centre du tracé en HdF
      const center = waypoints[Math.floor(waypoints.length / 2)];
      const dept = _deptForCoord(center);
      if (!HDF_DEPTS.has(dept)) continue;

      const tagDist = rel.tags.distance ? parseFloat(rel.tags.distance) : null;
      events.push({
        name: rel.tags.name,
        slug: slugify(rel.tags.name) + '-osm',
        date: null,
        lieu: rel.tags['from'] || rel.tags['start_point'] || null,
        region: _regionForDept(dept),
        distanceKm: tagDist,
        type: 'rando',
        source: 'osm-overpass',
        sourceUrl: `https://www.openstreetmap.org/relation/${rel.id}`,
        waypoints,
        description: [rel.tags.description, rel.tags.note].filter(Boolean).join(' · ') || null,
      });
    }
    ok(`Overpass HdF → ${events.length} itinéraires officiels (après filtres)`);
    return events;
  } catch (e) {
    warn(`Overpass : ${e.message}`);
    return [];
  }
}

function _deptForCoord(pt) {
  if (!pt) return null;
  if (pt.lat > 50.5)              return pt.lng < 2.5 ? '62' : '59';
  if (pt.lat > 49.8)              return '80';
  if (pt.lat > 49.2 && pt.lng < 3.5) return '60';
  if (pt.lat > 49.2)              return '02';
  return null;
}
function _regionForDept(d) {
  return { '02':'Aisne (02)', '59':'Nord (59)', '60':'Oise (60)',
           '62':'Pas-de-Calais (62)', '80':'Somme (80)' }[d] || null;
}

// ═══════════════════════════════════════════════════════════════
// 3) Pipeline événement par événement (tracé réel uniquement)
// ═══════════════════════════════════════════════════════════════
async function processEvent(ev, db) {
  const slug = ev.slug || slugify(ev.name);
  const gpxFilename = slug + '.gpx';
  const gpxPath = path.join(GPX_DIR, gpxFilename);

  log(`\n→ [${slug}] "${ev.name}"`);

  if (fs.existsSync(gpxPath) && !FORCE) {
    log(`  GPX déjà présent, skip`);
    return { slug, status: 'skipped' };
  }

  let gpxContent = null;
  let points = null;
  let trackOrigin = null;

  // ── Étape 1 : tenter de récupérer le GPX officiel sur la page source ──
  if (ev.sourceUrl && !ev.waypoints?.length) {
    log(`  Recherche GPX officiel sur ${ev.sourceUrl} ...`);
    const found = await findOfficialGpx(ev.sourceUrl);
    if (found) {
      ok(`  GPX officiel téléchargé : ${found.url}`);
      gpxContent = found.content;
      points = parseGpxText(gpxContent);
      trackOrigin = 'gpx-officiel';
      if (!points) { warn('  GPX illisible'); gpxContent = null; }
    } else {
      log(`  Aucun GPX officiel sur la page`);
    }
  }

  // ── Étape 2 : waypoints OSM réels → routing OSRM cyclable ──
  if (!points && ev.waypoints?.length >= 10 && ev.source === 'osm-overpass') {
    log(`  ${ev.waypoints.length} waypoints OSM → enrichissement altitudes ...`);
    try {
      // Sous-échantillonner si trop dense (Open-Meteo limite à 100 pts par batch)
      const stride = Math.max(1, Math.floor(ev.waypoints.length / 200));
      const sampled = ev.waypoints.filter((_, i) => i % stride === 0);
      const elevs = await fetchElevations(sampled).catch(() => null);
      points = sampled.map((p, i) => ({ ...p, ele: elevs?.[i] ?? 50 }));
      trackOrigin = 'osm-relation';
      ok(`  Tracé OSM enrichi : ${points.length} points`);
    } catch (e) {
      warn(`  Élévations indisponibles : ${e.message}`);
      points = ev.waypoints.map(p => ({ ...p, ele: 50 }));
      trackOrigin = 'osm-relation-no-ele';
    }
  }

  // ── Mode strict (par défaut) : si pas de tracé réel, on skip ──
  if (!points && !ALLOW_APPROX) {
    warn(`  Aucun tracé officiel trouvé — événement ignoré (mode strict)`);
    warn(`  Pour autoriser un tracé approximatif : --allow-approx`);
    return { slug, status: 'skipped-no-track' };
  }

  // ── Étape 3 (optionnelle) : tracé approximatif via OSRM ──
  if (!points && ALLOW_APPROX) {
    err(`  --allow-approx activé : génération d'un tracé approximatif (non recommandé)`);
    return { slug, status: 'skipped-approx-disabled' };
  }

  // ── Stats ──────────────────────────────────────────────────────
  let distKm = 0;
  for (let i = 1; i < points.length; i++) {
    distKm += routing.haversine(points[i-1], points[i]) / 1000;
  }
  const { dPlus, dMinus } = computeDplus(points.map(p => p.ele ?? 0));
  const eles = points.map(p => p.ele ?? 0).filter(e => e > 0);
  const eleMin = eles.length ? Math.round(Math.min(...eles)) : 0;
  const eleMax = eles.length ? Math.round(Math.max(...eles)) : 0;

  log(`  Stats : ${distKm.toFixed(1)} km · D+${dPlus} m · alt ${eleMin}–${eleMax} m · source ${trackOrigin}`);

  // ── Construction GPX si pas déjà téléchargé ───────────────────
  if (!gpxContent) {
    gpxContent = gpxBuilder.build(
      { name: ev.name, desc: (ev.description || '') + (trackOrigin ? ` [source: ${trackOrigin}]` : '') },
      points
    );
  }

  if (!DRY_RUN) {
    fs.mkdirSync(GPX_DIR, { recursive: true });
    fs.writeFileSync(gpxPath, gpxContent, 'utf8');
    ok(`  GPX sauvé → asset/gpx/${gpxFilename}`);
  }

  // ── Persistance MySQL ──────────────────────────────────────────
  if (SAVE_DB && db) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const isOsm = ev.source === 'osm-overpass';
      // OSM : itinéraires permanents → date 2099 + statut future (jamais expirés par cleanup)
      // Events datés : date réelle + statut future si à venir, passee sinon
      const dateForDb   = isOsm ? PERMANENT_DATE : (ev.date || today);
      const statutForDb = isOsm ? 'future'
                         : (ev.date && ev.date >= today ? 'future' : 'passee');

      await db.query(`
        INSERT INTO sorties (
          id, title, subtitle, chapter, description, date, date_label,
          distance_km, elevation_gain, elevation_loss, elevation_max, elevation_min,
          gpx_filename, location_name, location_lat, location_lng,
          statut, hero_img, card_img
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          title=VALUES(title), subtitle=VALUES(subtitle),
          distance_km=VALUES(distance_km), elevation_gain=VALUES(elevation_gain),
          gpx_filename=VALUES(gpx_filename), location_name=VALUES(location_name),
          location_lat=VALUES(location_lat), location_lng=VALUES(location_lng),
          statut=VALUES(statut)
      `, [
        slug, ev.name, ev.region || null,
        ev.type === 'cyclosportive' ? `Cyclosportive · ${ev.region || ''}`
          : ev.type === 'gravel'    ? `Gravel · ${ev.region || ''}`
          :                            `Itinéraire · ${ev.region || ''}`,
        (ev.description || '') + ` [tracé: ${trackOrigin}]`,
        dateForDb, ev.date ? _formatDateFr(ev.date) : (isOsm ? 'Itinéraire permanent' : null),
        ev.distanceKm || +distKm.toFixed(1),
        dPlus, dMinus, eleMax, eleMin,
        gpxFilename, ev.lieu || null, points[0]?.lat || null, points[0]?.lng || null,
        statutForDb,
        _heroImg(ev.type), _heroImg(ev.type),
      ]);
      ok(`  Inséré en base (statut: ${statutForDb})`);
    } catch (e) { err(`  DB: ${e.message}`); }
  }

  return { slug, status: 'ok', distKm: +distKm.toFixed(1), dPlus, trackOrigin };
}

function _formatDateFr(iso) {
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }); }
  catch { return iso; }
}
function _heroImg(t) {
  return { gravel:'asset/img/hero-gravel.svg', cyclosportive:'asset/img/hero-peloton.svg', course:'asset/img/hero-peloton.svg' }[t] || 'asset/img/hero-route.svg';
}

// ═══════════════════════════════════════════════════════════════
// Auto-cleanup : supprime les courses passées de la BDD + leurs GPX
// Garde un délai de grâce (GRACE_DAYS) après la date pour laisser
// le temps de consulter les résultats / photos / témoignages.
// Les itinéraires OSM (date = 2099-12-31) ne sont JAMAIS supprimés.
// ═══════════════════════════════════════════════════════════════
async function cleanupPastEvents(db) {
  const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000)
    .toISOString().slice(0, 10);

  step(`Nettoyage des courses passées (date < ${cutoff}, grâce ${GRACE_DAYS}j) ...`);

  // 1) Récupérer les sorties à supprimer pour effacer aussi leurs GPX
  let toDelete = [];
  try {
    toDelete = await db.query(
      'SELECT id, gpx_filename FROM sorties WHERE date < ? AND date < ?',
      [cutoff, PERMANENT_DATE]
    );
  } catch (e) { warn(`Lecture sorties : ${e.message}`); return; }

  if (!toDelete.length) {
    log(`Aucune course à expirer.`);
    return;
  }

  // 2) Supprimer les fichiers GPX
  let nGpx = 0;
  for (const row of toDelete) {
    if (!row.gpx_filename) continue;
    const p = path.join(GPX_DIR, row.gpx_filename);
    try { fs.unlinkSync(p); nGpx++; } catch { /* déjà absent */ }
  }

  // 3) Supprimer en BDD (les FK CASCADE devraient nettoyer les tables liées,
  //    sinon on supprime explicitement)
  try {
    const ids = toDelete.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    // Tables liées (au cas où pas de CASCADE)
    await db.query(`DELETE FROM pois WHERE sortie_id IN (${placeholders})`, ids).catch(() => {});
    await db.query(`DELETE FROM sortie_tags WHERE sortie_id IN (${placeholders})`, ids).catch(() => {});
    await db.query(`DELETE FROM sortie_segments WHERE sortie_id IN (${placeholders})`, ids).catch(() => {});
    await db.query(`DELETE FROM sortie_stats_extra WHERE sortie_id IN (${placeholders})`, ids).catch(() => {});
    await db.query(`DELETE FROM sorties WHERE id IN (${placeholders})`, ids);
    ok(`${toDelete.length} course(s) expirée(s) supprimée(s) · ${nGpx} GPX nettoyé(s)`);
  } catch (e) {
    warn(`Suppression BDD : ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  head('C.C. Salouel — Scraper de sorties (mode tracés réels)');
  console.log(`  Mode           : ${DRY_RUN ? 'DRY-RUN (aucune écriture)' : '⚠️  ÉCRITURE (fichiers + BDD)'}`);
  console.log(`  Sources        : ${[WITH_OSM && 'OSM', WITH_MILESREPUBLIC && 'MilesRepublic'].filter(Boolean).join(' + ') || '(aucune — utilise --osm)'}`);
  console.log(`  Tracés         : ${ALLOW_APPROX ? 'incl. approximatifs (--allow-approx)' : 'OFFICIELS uniquement'}`);
  console.log(`  Force          : ${FORCE}`);
  console.log(`  Périmètre      : Hauts-de-France (02, 59, 60, 62, 80)`);
  if (isFinite(LIMIT)) console.log(`  Limite     : ${LIMIT}`);

  let db = null;
  if (SAVE_DB) {
    try {
      db = require('../config/database');
      await db.query('SELECT 1');
      ok('MySQL connecté');
    } catch (e) {
      err(`MySQL : ${e.message}`); process.exit(1);
    }
  }

  // ── Auto-cleanup avant scraping : supprime les courses expirées ──
  if (SAVE_DB && db) {
    await cleanupPastEvents(db);
  }

  step("Scraping des sources d'événements ...");
  let events = [];

  // ── MilesRepublic : OPT-IN uniquement (--milesrepublic) ───────
  // Cette plateforme ne distribue pas de GPX. Activable seulement
  // si l'utilisateur veut quand même peupler les MÉTADONNÉES (titre,
  // date, lieu) sans tracé.
  if (WITH_MILESREPUBLIC && (!ONLY || ONLY === 'milesrepublic')) {
    try {
      const { events: scraped, log: sLog, errors: sErrors } = await scraper.scrapeAll();
      sLog.forEach(l => log(l));
      sErrors.forEach(e => warn(e.source + ' : ' + e.error));

      const before = scraped.length;
      const filtered = scraped.filter(e => {
        const dept = extractDept(e);
        return !dept || HDF_DEPTS.has(dept);
      });
      ok(`MilesRepublic → ${filtered.length} événements HdF (filtrés depuis ${before})`);
      warn(`MilesRepublic ne fournit pas de GPX — ces events seront skip en mode strict.`);
      events.push(...filtered);
    } catch (e) {
      err(`scraper : ${e.message}`);
    }
  }

  // ── OSM : source principale (tracés réels) ────────────────────
  if (WITH_OSM && (!ONLY || ONLY === 'osm')) {
    step('OpenStreetMap Overpass — itinéraires cyclables HdF');
    const osmEvents = await scrapeOsm();
    events.push(...osmEvents);
  }

  if (!WITH_OSM && !WITH_MILESREPUBLIC) {
    warn('Aucune source activée. Utilise --osm (recommandé) ou --milesrepublic.');
    process.exit(0);
  }

  // Dédoublonnage
  const seen = new Set();
  events = events.filter(e => {
    const key = e.slug || slugify(e.name || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Filtre dates : on ne garde QUE les events futurs (les OSM sans date passent)
  // Filtre toujours appliqué — même avec --force on n'importe pas du passé.
  const today = new Date().toISOString().slice(0, 10);
  const total = events.length;
  events = events.filter(e => !e.date || e.date >= today);
  log(`\n  ${events.length} événements à traiter (${total - events.length} courses passées ignorées)`);

  if (isFinite(LIMIT)) {
    events = events.slice(0, LIMIT);
    log(`  → limité à ${LIMIT}`);
  }

  if (events.length === 0) { warn('Aucun événement.'); process.exit(0); }

  step('Traitement (mode tracés réels) ...');
  const results = { ok: [], skipped: [], 'skipped-no-track': [], error: [] };

  for (const ev of events) {
    try {
      const r = await processEvent(ev, db);
      (results[r.status] || results.error).push(r);
    } catch (e) {
      err(`Exception "${ev.name}" : ${e.message}`);
      results.error.push({ slug: ev.slug, error: e.message });
    }
    await new Promise(r => setTimeout(r, 600));  // courtoisie API
  }

  step('Résumé');
  console.log(`  ✅ Avec tracé officiel    : ${results.ok.length}`);
  console.log(`  ⏭️  Déjà traités          : ${results.skipped.length}`);
  console.log(`  🚫 Sans tracé officiel    : ${results['skipped-no-track'].length}`);
  console.log(`  ❌ Erreurs                : ${results.error.length}`);

  if (results.ok.length) {
    console.log('\n  Sorties traitées :');
    results.ok.forEach(r => console.log(`    • ${r.slug.padEnd(40)} ${(r.distKm||0).toFixed(1).padStart(6)} km  D+${(r.dPlus||0)}m  [${r.trackOrigin}]`));
  }

  if (db) try { await db.pool?.end?.(); } catch {}
}

main().catch(e => { console.error('\n💥', e.message); process.exit(1); });