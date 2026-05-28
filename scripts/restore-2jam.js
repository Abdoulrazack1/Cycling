// scripts/restore-2jam.js
// Restaure les 3 sorties 2JAM (Strava export GPX) dans la BDD.
'use strict';
require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { query } = require('../config/database');
const { parseGpx } = require('../services/gpx-parser');

const GPX_DIR = path.join(__dirname, '..', 'asset', 'gpx');

const SORTIES = [
  {
    id: 'clm-2jam-2026-05-17',
    slug: 'clm-2jam',
    title: '2JAM — Contre-la-Montre',
    title_html: '2JAM <span class="it">—</span> Contre-la-Montre',
    subtitle: 'Salouel · 9,2 km contre-la-montre (PDF), 8,3 km GPS',
    chapter: 'clm',
    description: 'Étape 1 du 2 Jours d\'Amiens Métropole : prologue contre-la-montre individuel à Salouel, 8,3 km tracés au GPS pour 9,2 km officiels au PDF parcours.',
    date: '2026-05-17',
    statut: 'passee',
    gpx_filename: 'clm-2jam.gpx',
    hero_img: 'asset/img/img-clm.webp',
    card_img: 'asset/img/img-clm.webp',
    location_name: 'Salouel',
  },
  {
    id: '2jam-etape-2-2026',
    slug: '2jam-etape-2',
    title: '2JAM — Étape 2',
    title_html: '2JAM <span class="it">—</span> Étape 2',
    subtitle: 'Salouel · 9,2 km circuit',
    chapter: 'route',
    description: 'Étape 2 du 2 Jours d\'Amiens Métropole : circuit fermé de 9,2 km à parcourir plusieurs tours.',
    date: '2026-05-10',
    statut: 'passee',
    gpx_filename: '2jam-etape-2.gpx',
    hero_img: 'asset/img/img-peloton.webp',
    card_img: 'asset/img/img-peloton.webp',
    location_name: 'Salouel',
  },
  // Étape 1 — pas de GPX exporté, mais la sortie existe. On insère avec
  // les métriques connues (distance officielle) et sans gpx_filename.
  {
    id: '2jam-etape-1-2026',
    slug: '2jam-etape-1',
    title: '2JAM — Étape 1',
    title_html: '2JAM <span class="it">—</span> Étape 1',
    subtitle: 'Salouel · 9,7 km course en ligne',
    chapter: 'route',
    description: 'Étape 1 du 2 Jours d\'Amiens Métropole : course en ligne, 9,7 km. GPX non disponible (course officielle).',
    date: '2026-05-09',
    statut: 'passee',
    gpx_filename: null,
    distance_km: 9.7,
    elevation_gain: 0,
    elevation_loss: 0,
    location_lat: 49.876,
    location_lng: 2.241,
    hero_img: 'asset/img/img-peloton.webp',
    card_img: 'asset/img/img-peloton.webp',
    location_name: 'Salouel',
  },
];

(async () => {
  for (const s of SORTIES) {
    // Si GPX présent, parse pour extraire métriques
    let metrics = null;
    if (s.gpx_filename) {
      const gpxPath = path.join(GPX_DIR, s.gpx_filename);
      if (!fs.existsSync(gpxPath)) {
        console.error(`✗ GPX manquant : ${gpxPath}`);
        continue;
      }
      const xml = fs.readFileSync(gpxPath, 'utf8');
      metrics = parseGpx(xml);
      console.log(`  ${s.id} : ${metrics.points.length} pts, ${metrics.distance_km} km, D+${metrics.elevation_gain} m`);
    }

    const params = [
      s.id, s.slug, s.title, s.title_html || s.title, s.subtitle, s.chapter, s.description,
      s.date, null,
      metrics?.distance_km ?? s.distance_km ?? null,
      metrics?.elevation_gain ?? s.elevation_gain ?? null,
      metrics?.elevation_loss ?? s.elevation_loss ?? null,
      metrics?.elevation_max ?? null,
      metrics?.elevation_min ?? null,
      s.hero_img, s.card_img,
      s.location_name,
      metrics?.start?.lat ?? s.location_lat ?? null,
      metrics?.start?.lng ?? s.location_lng ?? null,
      s.gpx_filename, s.statut, 1,
    ];

    await query(
      `INSERT INTO sorties
        (id, slug, title, title_html, subtitle, chapter, description,
         date, date_label, distance_km, elevation_gain, elevation_loss, elevation_max, elevation_min,
         hero_img, card_img, location_name, location_lat, location_lng, gpx_filename, statut, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title), subtitle = VALUES(subtitle), chapter = VALUES(chapter),
         description = VALUES(description), date = VALUES(date),
         distance_km = VALUES(distance_km), elevation_gain = VALUES(elevation_gain),
         elevation_loss = VALUES(elevation_loss),
         gpx_filename = VALUES(gpx_filename), statut = VALUES(statut)`,
      params
    );
    console.log(`✓ ${s.id} inséré`);
  }

  const rows = await query('SELECT id, title, distance_km, statut FROM sorties ORDER BY date DESC');
  console.log('\n--- Sorties en BDD ---');
  rows.forEach(r => console.log(`  ${r.id}  ${r.distance_km || '—'} km  (${r.statut})  ${r.title}`));
  process.exit(0);
})().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
