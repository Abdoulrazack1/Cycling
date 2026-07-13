/* ═════════════════════════════════════════════════════════════════
   controllers/auto-courses.js — Scraping + génération auto de courses
   (tous les endpoints sont admin-only — voir routes/auto-courses.js)
   ═════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const { errResponse } = require('../lib/errors');
const logger = require('../lib/logger');
const generator = require('../services/course-generator');
const scraper   = require('../services/course-scraper');
const { query: dbQuery } = require('../config/database');

// ── Helpers de persistance BDD ──────────────────────────────────
async function _persistSortie(generated, original) {
  const stats = generated.stats || {};
  const lat = original.waypoints?.[0]?.lat || original.lat || null;
  const lng = original.waypoints?.[0]?.lng || original.lng || null;
  // sorties.date est NOT NULL → si manquante, prendre la date du jour
  const date = original.date || new Date().toISOString().slice(0, 10);
  const title = original.name || generated.name || generated.id;
  const region = original.region || generated.region || null;

  await dbQuery(`
    INSERT INTO sorties (
      id, title, subtitle, date, distance_km, elevation_gain,
      elevation_min, elevation_max, gpx_filename,
      location_name, location_lat, location_lng, statut
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      subtitle = VALUES(subtitle),
      date = VALUES(date),
      distance_km = VALUES(distance_km),
      elevation_gain = VALUES(elevation_gain),
      elevation_min = VALUES(elevation_min),
      elevation_max = VALUES(elevation_max),
      gpx_filename = VALUES(gpx_filename),
      location_name = VALUES(location_name),
      location_lat = VALUES(location_lat),
      location_lng = VALUES(location_lng)
  `, [
    generated.id, title, region, date,
    stats.distanceKm || original.distanceKm || null,
    stats.dPlus != null ? stats.dPlus : null,
    stats.eleMin != null ? stats.eleMin : null,
    stats.eleMax != null ? stats.eleMax : null,
    generated.gpxFilename || null,
    region, lat, lng,
    'future',
  ]);

  // Persister les POIs (on supprime les anciens et on remet)
  if (generated.pois?.length) {
    await dbQuery('DELETE FROM pois WHERE sortie_id = ?', [generated.id]);
    const validTypes = new Set(['signaleur','ravito','danger','secteur','depart','arrivee','direction']);
    for (const p of generated.pois) {
      const type = validTypes.has(p.type) ? p.type : 'signaleur';
      const poiId = p.id || `${generated.id}-poi-${Math.random().toString(36).slice(2, 8)}`;
      await dbQuery(`
        INSERT INTO pois (id, sortie_id, type, label, description, km, lat, lng, contact_name, contact_phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        poiId.substring(0, 50), generated.id, type,
        p.label, p.desc, p.km, p.lat, p.lng,
        p.contact?.name || null, p.contact?.phone || null,
      ]);
    }
  }
}

async function _persistEventOnly(ev) {
  await dbQuery(`
    INSERT IGNORE INTO evenements (slug, title, type, date, lieu, region, distance_km, statut)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [ev.slug, ev.name, ev.type || 'rando', ev.date, ev.lieu, ev.region, ev.distanceKm, 'ouvert']);
}

// ── Handlers ────────────────────────────────────────────────────

// GET /sources — liste les sources de scraping configurées
function sources(req, res) {
  res.json({
    sources: scraper.SOURCES.map(s => ({
      name: s.name, label: s.label, url: s.url,
    })),
  });
}

// GET /scrape — scrape sans insérer
async function scrape(req, res) {
  try {
    const result = await scraper.scrapeAll();
    const includePast = req.query.includePast === '1';
    const today = new Date().toISOString().slice(0, 10);
    const filtered = includePast ? result.events
      : result.events.filter(e => !e.date || e.date >= today);

    res.json({
      total: filtered.length,
      events: filtered,
      log: result.log,
      errors: result.errors,
    });
  } catch (err) {
    logger.error({ err }, '[auto-courses scrape]');
    errResponse(req, res, err, 500, 'Erreur serveur');
  }
}

// POST /generate — génère une course complète depuis ses waypoints
async function generate(req, res) {
  const body = req.body || {};
  if (!body.name || !Array.isArray(body.waypoints) || body.waypoints.length < 2) {
    return res.status(400).json({
      error: 'Champs requis : name (string), waypoints (array de ≥2 {lat,lng,...})',
    });
  }

  const skipNet = body.skipNetwork === true; // mode test/offline

  try {
    const result = await generator.generate({
      id:         body.id,
      name:       body.name,
      region:     body.region,
      distanceKm: body.distanceKm,
      waypoints:  body.waypoints,
      laps:       body.laps,
      profile:    body.profile,
    }, {
      skipRouting:   skipNet,
      skipElevation: skipNet,
    });

    // Si `persist` est demandé (défaut), INSERT en base
    let persisted = false;
    if (body.persist !== false) {
      try {
        await _persistSortie(result, body);
        persisted = true;
      } catch (err) {
        logger.warn('[auto-courses persist]', err.message);
        result.errors.push(`Persist: ${err.message}`);
      }
    }

    res.json({
      success: true,
      id: result.id,
      provider: result.provider,
      gpxFilename: result.gpxFilename,
      gpxUrl: '/asset/gpx/' + result.gpxFilename,
      pois: result.pois,
      directions: result.directions || [],
      stats: result.stats,
      log: result.log,
      errors: result.errors,
      persisted,
    });
  } catch (err) {
    logger.error({ err }, '[auto-courses generate]');
    errResponse(req, res, err, 500, 'Erreur serveur');
  }
}

// POST /import — import en masse depuis un scraping précédent
async function importEvents(req, res) {
  const events = req.body?.events;
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'events[] requis' });
  }

  const generateGpx = req.body?.generateGpx !== false;
  const skipNet     = req.body?.skipNetwork === true;
  const results = [];
  const errors = [];

  for (const ev of events) {
    try {
      // Sans waypoints, on ne peut pas générer le GPX → on insère juste l'event
      if (!ev.waypoints || ev.waypoints.length < 2) {
        await _persistEventOnly(ev);
        results.push({ slug: ev.slug, name: ev.name, gpx: false, persisted: true });
        continue;
      }

      const generated = generateGpx ? await generator.generate({
        name:       ev.name,
        id:         ev.slug,
        region:     ev.region,
        distanceKm: ev.distanceKm,
        waypoints:  ev.waypoints,
      }, { skipRouting: skipNet, skipElevation: skipNet }) : null;

      await _persistSortie(
        generated || { id: ev.slug, name: ev.name, pois: [], stats: { distanceKm: ev.distanceKm, dPlus: null }, gpxFilename: null },
        ev
      );
      results.push({
        slug: ev.slug, name: ev.name,
        gpx: !!generated?.gpxFilename, gpxFilename: generated?.gpxFilename,
        pois: generated?.pois?.length || 0,
        persisted: true,
      });
    } catch (err) {
      errors.push({ slug: ev.slug, name: ev.name, error: err.message });
    }
  }

  res.json({ imported: results.length, results, errors });
}

// GET /:id — récupérer une course auto-générée (admin only)
async function getOne(req, res) {
  const id = String(req.params.id).replace(/[^a-z0-9_-]/gi, '-');

  // Vérifier si le GPX existe sur disque
  const gpxPath = path.join(__dirname, '..', '..', 'public', 'asset', 'gpx', id + '.gpx');
  const hasGpx = fs.existsSync(gpxPath);

  let sortie = null;
  try {
    const rows = await dbQuery('SELECT * FROM sorties WHERE id = ? LIMIT 1', [id]);
    sortie = rows?.[0] || null;
  } catch (err) {
    logger.error('[auto-courses GET /:id]', err.message);
  }

  res.json({
    id,
    hasGpx,
    gpxUrl: hasGpx ? '/asset/gpx/' + id + '.gpx' : null,
    sortie,
  });
}

module.exports = { sources, scrape, generate, importEvents, getOne };
