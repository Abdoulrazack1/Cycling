// seed.js — Migration complète des données statiques vers MySQL
// Usage : node seed.js
require('dotenv').config();
const bcrypt   = require('bcryptjs');
const { query, withTransaction } = require('./src/config/database');

// ═══════════════════════════════════════════════════════════════
// DONNÉES INITIALES (extraites de data.js frontend)
// ═══════════════════════════════════════════════════════════════

const SORTIES = [
  {
    id: 'arenberg-2025-04-05', slug: 'paris-roubaix',
    title: 'Reconnaissance Paris–Roubaix',
    title_html: 'Reconnaissance <span class="it">Paris–Roubaix</span>',
    subtitle: 'Compiègne → Vélodrome de Roubaix',
    chapter: 'Sortie hebdomadaire · pavé',
    description: "Compiègne au vélodrome André-Pétrieux, vingt-sept secteurs pavés. Sortie longue, allure de groupe, deux arrêts marqués à Arenberg et au Carrefour de l'Arbre.",
    date: '2025-04-05', date_label: 'Dimanche 5 avril 2025',
    distance_km: 172, duration_label: '5h48',
    elevation_gain: 820, elevation_loss: 814, elevation_max: 105, elevation_min: 25,
    tss: 342, np_w: 228, pave_km: 54, secteurs: 27,
    hero_img: 'asset/img/hero-pave.svg',
    card_img: 'asset/img/hero-pave.svg',
    location: { name: 'Wallers', lat: 50.4351, lng: 3.2481 },
    gpx_filename: 'arenberg-2025.gpx', number: 247, featured: true, statut: 'passee',
    tags: [{ type: 'live', label: 'En cours' }, { type: 'date', label: 'Dimanche 5 avril 2025' }, { type: 'brass', label: 'Sortie № 247' }],
    stats_extra: [{ label: 'Pavé', value: '54', unit: 'km', cls: 'ox' }, { label: 'Secteurs', value: '27', cls: 'brass' }, { label: 'NP', value: '228', unit: 'w' }],
    segments: [
      { idx: 17, name: "Trouée d'Arenberg", sub: 'Wallers · 95,8 km', stars: 5, length_m: 2400, time: '6:42', delta: '−12 s', delta_cls: 'neg', rank: '2e/11' },
      { idx: 4,  name: "Carrefour de l'Arbre", sub: 'Camphin · 152,4 km', stars: 5, length_m: 1600, time: '4:28', delta: '−8 s', delta_cls: 'neg', rank: '3e/11' },
      { idx: 5,  name: 'Mons-en-Pévèle', sub: '128,8 km', stars: 5, length_m: 3000, time: '8:54', delta: '+4 s', delta_cls: 'pos', rank: '4e/11' },
    ]
  },
  {
    id: 'monts-flandres-2025-03-28', slug: 'monts-flandres',
    title: 'Monts des Flandres', title_html: 'Monts <span class="it">des</span> Flandres',
    subtitle: 'Cassel · Mont des Cats · Mont Noir · Kemmelberg',
    chapter: 'Sortie hebdomadaire · monts',
    description: "Boucle vallonnée au départ de Cassel. Cinq monts flamands enchaînés.",
    date: '2025-03-28', date_label: 'Samedi 28 mars 2025',
    distance_km: 77, duration_label: '3h12',
    elevation_gain: 730, elevation_loss: 730, elevation_max: 176, elevation_min: 40,
    tss: 218, np_w: 218,
    hero_img: 'asset/img/hero-monts.svg',
    card_img: 'asset/img/hero-monts.svg',
    location: { name: 'Cassel', lat: 50.8012, lng: 2.4854 },
    gpx_filename: 'monts-flandres.gpx', number: 246, statut: 'passee',
    tags: [{ type: 'date', label: 'Samedi 28 mars 2025' }, { type: 'brass', label: 'Monts' }, { type: 'plain', label: 'Sortie № 246' }],
    stats_extra: [{ label: 'Monts', value: '5', cls: 'brass' }, { label: 'Pente max', value: '21', unit: '%' }, { label: 'NP', value: '218', unit: 'w' }],
    segments: [
      { idx: 1, name: 'Mont des Cats',  sub: 'km 28,5', stars: 4, length_m: 1100, time: '4:18', delta: '−6 s', delta_cls: 'neg', rank: '3e/9' },
      { idx: 3, name: 'Kemmelberg',     sub: 'km 39,7', stars: 5, length_m: 800,  time: '2:54', delta: '+2 s', delta_cls: 'pos', rank: '5e/9' },
    ]
  },
  {
    id: 'avesnois-2025-03-15', slug: 'avesnois',
    title: "Tour de l'Avesnois",
    subtitle: 'Maroilles · Avesnes · Solre-le-Château · Sars-Poteries',
    chapter: 'Sortie hebdomadaire · endurance',
    description: "Boucle bocagère de 112 km autour de Maroilles.",
    date: '2025-03-15', date_label: 'Samedi 15 mars 2025',
    distance_km: 112, duration_label: '4h15',
    elevation_gain: 1980, elevation_loss: 1980, elevation_max: 280, elevation_min: 95,
    tss: 298, np_w: 214,
    hero_img: 'asset/img/hero-route.svg',
    card_img: 'asset/img/hero-route.svg',
    location: { name: 'Maroilles', lat: 50.1268, lng: 3.7641 },
    gpx_filename: 'avesnois.gpx', number: 245, statut: 'passee',
    tags: [{ type: 'date', label: 'Samedi 15 mars 2025' }, { type: 'plain', label: 'Club' }, { type: 'plain', label: 'Sortie № 245' }],
    stats_extra: [{ label: 'D+', value: '1980', unit: 'm' }, { label: 'NP', value: '214', unit: 'w' }],
    segments: []
  },
  {
    id: 'scarpe-gravel-2025-03-02', slug: 'scarpe-gravel',
    title: 'La Scarpe en gravel',
    subtitle: 'Forêt · Saint-Amand · Raismes',
    chapter: 'Sortie courte · gravel',
    description: "Boucle gravel de 68 km dans la forêt domaniale de Raismes.",
    date: '2025-03-02', date_label: 'Dimanche 2 mars 2025',
    distance_km: 68, duration_label: '3h05',
    elevation_gain: 1240, elevation_loss: 1240, elevation_max: 89, elevation_min: 12,
    tss: 186, np_w: 198,
    hero_img: 'asset/img/hero-gravel.svg',
    card_img: 'asset/img/hero-gravel.svg',
    location: { name: 'Saint-Amand-les-Eaux', lat: 50.4461, lng: 3.4278 },
    gpx_filename: 'scarpe-gravel.gpx', number: 244, statut: 'passee',
    tags: [{ type: 'date', label: 'Dimanche 2 mars 2025' }, { type: 'brass', label: 'Gravel' }, { type: 'plain', label: 'Sortie № 244' }],
    stats_extra: [{ label: 'Sentiers', value: '80', unit: '%' }, { label: 'NP', value: '198', unit: 'w' }],
    segments: []
  },
  {
    id: 'opale-2025-02-22', slug: 'opale',
    title: "Côte d'Opale",
    subtitle: 'Boulogne · Cap Gris-Nez · Audinghen',
    chapter: 'Sortie longue · côte',
    description: "104 km sur les routes panoramiques de la Côte d'Opale.",
    date: '2025-02-22', date_label: 'Samedi 22 février 2025',
    distance_km: 104, duration_label: '4h20',
    elevation_gain: 1380, elevation_loss: 1380, elevation_max: 137, elevation_min: 2,
    tss: 264, np_w: 211,
    hero_img: 'asset/img/hero-cote.svg',
    card_img: 'asset/img/hero-cote.svg',
    location: { name: 'Boulogne-sur-Mer', lat: 50.7264, lng: 1.6068 },
    gpx_filename: 'cote-opale.gpx', number: 243, statut: 'passee',
    tags: [{ type: 'date', label: 'Samedi 22 février 2025' }, { type: 'plain', label: 'Côte' }, { type: 'plain', label: 'Sortie № 243' }],
    stats_extra: [{ label: 'Caps', value: '6', cls: 'brass' }, { label: 'NP', value: '211', unit: 'w' }],
    segments: []
  },
  {
    id: 'cambresis-2025-02-08', slug: 'cambresis',
    title: 'Boucle du Cambrésis',
    subtitle: 'Cambrai · Caudry · Boussières',
    chapter: 'Sortie hebdomadaire · endurance',
    description: "100 km dans les plaines du Cambrésis.",
    date: '2025-02-08', date_label: 'Samedi 8 février 2025',
    distance_km: 100, duration_label: '3h52',
    elevation_gain: 560, elevation_loss: 560, elevation_max: 148, elevation_min: 47,
    tss: 224, np_w: 207,
    hero_img: 'asset/img/hero-route.svg',
    card_img: 'asset/img/hero-route.svg',
    location: { name: 'Cambrai', lat: 50.1763, lng: 3.2350 },
    gpx_filename: 'cambresis.gpx', number: 242, statut: 'passee',
    tags: [{ type: 'date', label: 'Samedi 8 février 2025' }, { type: 'plain', label: 'Sortie № 242' }],
    stats_extra: [{ label: 'Distance', value: '100', unit: 'km' }, { label: 'NP', value: '207', unit: 'w' }],
    segments: []
  },
  {
    id: 'pevele-2025-01-26', slug: 'pevele',
    title: 'Boucle du Pévèle',
    subtitle: 'Orchies · Mons-en-Pévèle · Templeuve',
    chapter: 'Sortie courte · pavé léger',
    description: "Boucle pavée de 84 km dans le Pévèle.",
    date: '2025-01-26', date_label: 'Dimanche 26 janvier 2025',
    distance_km: 84, duration_label: '3h20',
    elevation_gain: 600, elevation_loss: 600, elevation_max: 108, elevation_min: 30,
    tss: 196, np_w: 210, pave_km: 18,
    hero_img: 'asset/img/hero-pave.svg',
    card_img: 'asset/img/hero-pave.svg',
    location: { name: 'Orchies', lat: 50.4719, lng: 3.2419 },
    gpx_filename: 'pevele.gpx', number: 241, statut: 'passee',
    tags: [{ type: 'date', label: 'Dimanche 26 janvier 2025' }, { type: 'brass', label: 'Pavé' }, { type: 'plain', label: 'Sortie № 241' }],
    stats_extra: [{ label: 'Pavé', value: '18', unit: 'km', cls: 'ox' }, { label: 'Secteurs', value: '6', cls: 'brass' }, { label: 'NP', value: '210', unit: 'w' }],
    segments: [
      { idx: 1, name: 'Mons-en-Pévèle', sub: 'km 24,3', stars: 5, length_m: 3000, time: '9:12', delta: '−6 s', delta_cls: 'neg', rank: '3e/7' },
      { idx: 2, name: 'Auchy → Bersée', sub: 'km 38,7', stars: 3, length_m: 2700, time: '8:18', delta: '−2 s', delta_cls: 'neg', rank: '4e/7' },
    ]
  },
  // Courses futures
  {
    id: 'scarpe-gravel-2025-04-27', slug: 'scarpe-gravel-avril',
    title: 'Gravel de la Scarpe',
    subtitle: 'Saint-Amand-les-Eaux · Bois de Raismes',
    chapter: 'Événement à venir · Gravel',
    description: "Deuxième édition du Gravel de la Scarpe. 82 km sur les sentiers forestiers.",
    date: '2025-04-27', date_label: 'Dimanche 27 avril 2025',
    distance_km: 82, duration_label: '3h30',
    elevation_gain: 620, elevation_loss: 620, elevation_max: 90, elevation_min: 15,
    hero_img: 'asset/img/hero-gravel.svg',
    card_img: 'asset/img/hero-gravel.svg',
    location: { name: 'Saint-Amand-les-Eaux', lat: 50.4461, lng: 3.4278 },
    gpx_filename: 'scarpe-gravel.gpx', statut: 'future',
    tags: [{ type: 'plain', label: 'À venir' }, { type: 'date', label: 'Dimanche 27 avril 2025' }, { type: 'brass', label: 'Gravel' }],
    stats_extra: [{ label: 'Sentiers', value: '80', unit: '%' }],
    segments: []
  },
  {
    id: 'ronde-monts-2025-05-18', slug: 'ronde-monts',
    title: 'La Ronde des Monts',
    subtitle: 'Cassel · Mont des Cats · Kemmelberg',
    chapter: 'Événement à venir · Cyclosportive FFC',
    description: "Cyclosportive FFC avec participation de l'équipe course. 95 km sur les monts flamands.",
    date: '2025-05-18', date_label: 'Dimanche 18 mai 2025',
    distance_km: 95, duration_label: '3h45',
    elevation_gain: 1100, elevation_loss: 1100, elevation_max: 176, elevation_min: 20,
    hero_img: 'asset/img/hero-monts.svg',
    card_img: 'asset/img/hero-monts.svg',
    location: { name: 'Cassel', lat: 50.8012, lng: 2.4854 },
    gpx_filename: 'monts-flandres.gpx', statut: 'future',
    tags: [{ type: 'plain', label: 'À venir' }, { type: 'date', label: 'Dimanche 18 mai 2025' }, { type: 'brass', label: 'Monts' }],
    stats_extra: [{ label: 'Monts', value: '5', cls: 'brass' }],
    segments: []
  },
  {
    id: 'criterium-salouel-2025-06-08', slug: 'criterium-salouel',
    title: 'Critérium de Salouel',
    subtitle: 'Salouel · Circuit Z.I. Nord',
    chapter: 'Événement à venir · Circuit fermé',
    description: "Critérium sur circuit fermé. Toutes catégories, ouvert aux extérieurs. 40 km.",
    date: '2025-06-08', date_label: 'Dimanche 8 juin 2025',
    distance_km: 40, duration_label: '1h20',
    elevation_gain: 80, elevation_loss: 80, elevation_max: 75, elevation_min: 55,
    hero_img: 'asset/img/hero-peloton.svg',
    card_img: 'asset/img/hero-peloton.svg',
    location: { name: 'Salouel', lat: 49.8577, lng: 2.2347 },
    gpx_filename: 'criterium-salouel.gpx', statut: 'future',
    tags: [{ type: 'plain', label: 'À venir' }, { type: 'date', label: 'Dimanche 8 juin 2025' }, { type: 'brass', label: 'Critérium' }],
    stats_extra: [{ label: 'Circuit', value: '40', unit: 'km' }],
    segments: []
  },
  {
    id: 'championnat-ufolep-2025-06-15', slug: 'championnat-ufolep',
    title: 'Championnat régional UFOLEP',
    subtitle: 'Orchies · Route · Hauts-de-France',
    chapter: 'Événement à venir · Route',
    description: "Championnat régional UFOLEP sur route. 58 km toutes catégories.",
    date: '2025-06-15', date_label: 'Dimanche 15 juin 2025',
    distance_km: 58, duration_label: '2h10',
    elevation_gain: 300, elevation_loss: 300, elevation_max: 108, elevation_min: 22,
    hero_img: 'asset/img/hero-peloton.svg',
    card_img: 'asset/img/hero-peloton.svg',
    location: { name: 'Orchies', lat: 50.4719, lng: 3.2419 },
    gpx_filename: 'pevele.gpx', statut: 'future',
    tags: [{ type: 'plain', label: 'À venir' }, { type: 'date', label: 'Dimanche 15 juin 2025' }, { type: 'brass', label: 'Route' }],
    stats_extra: [{ label: 'Distance', value: '58', unit: 'km' }],
    segments: []
  },
  {
    id: 'grand-prix-salouel-2025-07-06', slug: 'grand-prix-salouel',
    title: 'Grand Prix de Salouel',
    subtitle: 'Salouel · Centre-ville · Course FSGT',
    chapter: 'Événement à venir · Course',
    description: "Course FSGT sur circuit ville. 65 km, départ 13h30.",
    date: '2025-07-06', date_label: 'Dimanche 6 juillet 2025',
    distance_km: 65, duration_label: '2h15',
    elevation_gain: 120, elevation_loss: 120, elevation_max: 80, elevation_min: 55,
    hero_img: 'asset/img/hero-peloton.svg',
    card_img: 'asset/img/hero-peloton.svg',
    location: { name: 'Salouel', lat: 49.8577, lng: 2.2347 },
    gpx_filename: 'grand-prix-salouel.gpx', statut: 'future',
    tags: [{ type: 'plain', label: 'À venir' }, { type: 'date', label: 'Dimanche 6 juillet 2025' }, { type: 'brass', label: 'Course' }],
    stats_extra: [{ label: 'Distance', value: '65', unit: 'km' }],
    segments: []
  },
  {
    id: 'rando-3-provinces-2025-09-14', slug: 'rando-3-provinces',
    title: 'Rando des 3 Provinces',
    subtitle: 'Maroilles · Avesnois · 45/80/120 km',
    chapter: 'Événement à venir · Randonnée',
    description: "Randonnée ouverte à tous au départ de Maroilles. 3 parcours.",
    date: '2025-09-14', date_label: 'Dimanche 14 septembre 2025',
    distance_km: 120, duration_label: '5h00',
    elevation_gain: 1600, elevation_loss: 1600, elevation_max: 200, elevation_min: 95,
    hero_img: 'asset/img/hero-route.svg',
    card_img: 'asset/img/hero-route.svg',
    location: { name: 'Maroilles', lat: 50.1268, lng: 3.7641 },
    gpx_filename: 'avesnois.gpx', statut: 'future',
    tags: [{ type: 'plain', label: 'À venir' }, { type: 'date', label: 'Dimanche 14 septembre 2025' }, { type: 'brass', label: 'Rando' }],
    stats_extra: [{ label: 'Parcours', value: '3', cls: 'brass' }, { label: 'Max', value: '120', unit: 'km' }],
    segments: []
  },
];

const POIS_MAP = {
  'arenberg-2025-04-05': [
    { id: 'pr-1',  type: 'depart',    label: 'Départ — Compiègne',           desc: 'Place du Général de Gaulle',      km: 0,     lat: 49.4179, lng: 2.8262 },
    { id: 'pr-2',  type: 'signaleur', label: 'Signaleur — Intersection D38', desc: 'Sortie Compiègne',                km: 8.2,   lat: 49.4055, lng: 2.9123, contact: { name: 'Dupont Marc',  phone: '06 12 34 56 78' } },
    { id: 'pr-5',  type: 'ravito',    label: "Ravito — Troisvilles",          desc: 'Premier ravitaillement km 56',   km: 56.0,  lat: 50.0712, lng: 3.4381 },
    { id: 'pr-6',  type: 'danger',    label: "Danger — Virage pavé glissant", desc: 'Chute fréquente en sortie Arenberg', km: 98.4, lat: 50.4053, lng: 3.3958 },
    { id: 'pr-7',  type: 'secteur',   label: "Secteur — Trouée d'Arenberg",  desc: '2400 m · 5 étoiles',             km: 95.8,  lat: 50.3990, lng: 3.4125 },
    { id: 'pr-10', type: 'arrivee',   label: 'Arrivée — Vélodrome de Roubaix', desc: 'Vélodrome André-Pétrieux',     km: 172.0, lat: 50.6857, lng: 3.1786 },
  ],
  'monts-flandres-2025-03-28': [
    { id: 'mf-1', type: 'depart',    label: 'Départ — Cassel',         desc: 'Place Général de Gaulle',  km: 0,    lat: 50.8012, lng: 2.4854 },
    { id: 'mf-3', type: 'secteur',   label: 'Mont des Cats',           desc: '1,1 km · 7,2 % moyen',    km: 28.5, lat: 50.7806, lng: 2.7286 },
    { id: 'mf-5', type: 'secteur',   label: 'Mont Noir',               desc: '900 m · 6,8 % moyen',     km: 29.8, lat: 50.7700, lng: 2.7158 },
    { id: 'mf-6', type: 'secteur',   label: 'Kemmelberg',              desc: '800 m · 9,4 % · 22 % max', km: 39.7, lat: 50.7878, lng: 2.8255 },
    { id: 'mf-9', type: 'arrivee',   label: 'Arrivée — Cassel',        desc: 'Retour place',            km: 77,   lat: 50.8012, lng: 2.4854 }
  ],
  'avesnois-2025-03-15': [
    { id: 'av-1', type: 'depart',  label: 'Départ — Maroilles', desc: 'Place de la Mairie', km: 0,   lat: 50.1268, lng: 3.7641 },
    { id: 'av-3', type: 'ravito',  label: 'Ravitaillement Avesnes', desc: 'Place du Général Leclerc', km: 23.1, lat: 50.1242, lng: 3.9314 },
    { id: 'av-5', type: 'secteur', label: 'Mur de Liessies', desc: '600 m · 9,8 % moyen', km: 48.2, lat: 50.0844, lng: 4.0681 },
    { id: 'av-9', type: 'arrivee', label: 'Arrivée — Maroilles', desc: 'Retour Place de la Mairie', km: 114, lat: 50.1268, lng: 3.7641 }
  ],
  'scarpe-gravel-2025-03-02': [
    { id: 'sg-1', type: 'depart',  label: 'Départ — Saint-Amand', desc: 'Tour Abbatiale', km: 0, lat: 50.4461, lng: 3.4278 },
    { id: 'sg-3', type: 'secteur', label: 'Traverse du Mortier', desc: '2,8 km de chemin forestier', km: 18.4, lat: 50.4156, lng: 3.4982 },
    { id: 'sg-5', type: 'secteur', label: 'Mont des Bruyères', desc: '1,1 km · 4,8 % moyen · sentier', km: 33.5, lat: 50.4080, lng: 3.5180 },
    { id: 'sg-9', type: 'arrivee', label: 'Arrivée — Saint-Amand', desc: 'Retour Tour Abbatiale', km: 68, lat: 50.4461, lng: 3.4278 }
  ],
  'opale-2025-02-22': [
    { id: 'co-1', type: 'depart',  label: 'Départ — Boulogne', desc: 'Port · Quai Gambetta', km: 0, lat: 50.7264, lng: 1.6068 },
    { id: 'co-2', type: 'secteur', label: 'Côte de Wimereux', desc: '900 m · 6,1 % moyen · vue mer', km: 8.4, lat: 50.7656, lng: 1.6094 },
    { id: 'co-4', type: 'ravito',  label: 'Ravitaillement Audinghen', desc: 'Place du marché', km: 24.4, lat: 50.8550, lng: 1.6128 },
    { id: 'co-9', type: 'arrivee', label: 'Arrivée — Boulogne', desc: 'Retour Port', km: 95, lat: 50.7264, lng: 1.6068 }
  ],
  'cambresis-2025-02-08': [
    { id: 'ca-1', type: 'depart',  label: 'Départ — Cambrai', desc: 'Place Aristide-Briand', km: 0,    lat: 50.1762, lng: 3.2350 },
    { id: 'ca-3', type: 'ravito',  label: 'Ravitaillement Solesmes', desc: 'Centre-bourg', km: 27.5, lat: 50.1818, lng: 3.4986 },
    { id: 'ca-9', type: 'arrivee', label: 'Arrivée — Cambrai', desc: 'Retour Place Aristide-Briand', km: 88, lat: 50.1762, lng: 3.2350 }
  ],
  'pevele-2025-01-26': [
    { id: 'pv-1', type: 'depart',    label: 'Départ — Orchies',           desc: 'Place de la République',  km: 0,    lat: 50.4719, lng: 3.2419 },
    { id: 'pv-3', type: 'secteur',   label: 'Mons-en-Pévèle',             desc: '3,0 km · pavé 5 étoiles', km: 24.3, lat: 50.4892, lng: 3.0972 },
    { id: 'pv-5', type: 'ravito',    label: 'Ravitaillement — Pont-à-Marcq', desc: 'Place de la Mairie',  km: 39.7, lat: 50.5189, lng: 3.1064 },
    { id: 'pv-9', type: 'arrivee',   label: 'Arrivée — Orchies',          desc: 'Retour place de la République', km: 84, lat: 50.4719, lng: 3.2419 },
  ],
  /* ─── Courses futures ─── */
  'scarpe-gravel-2025-04-27': [
    { id: 'sg2-1', type: 'depart',  label: 'Départ — Saint-Amand', desc: 'Tour Abbatiale · 8h30', km: 0,    lat: 50.4461, lng: 3.4278 },
    { id: 'sg2-3', type: 'secteur', label: 'Traverse du Mortier',  desc: '2,8 km chemin forestier', km: 18.4, lat: 50.4156, lng: 3.4982 },
    { id: 'sg2-5', type: 'secteur', label: 'Mont des Bruyères',    desc: '1,1 km · 4,8 % · sentier', km: 33.5, lat: 50.4080, lng: 3.5180 },
    { id: 'sg2-9', type: 'arrivee', label: 'Arrivée — Saint-Amand',desc: 'Retour Tour Abbatiale',   km: 82,   lat: 50.4461, lng: 3.4278 }
  ],
  'ronde-monts-2025-05-18': [
    { id: 'rm-1', type: 'depart',  label: 'Départ — Cassel',  desc: 'Place Général de Gaulle · 9h00', km: 0,    lat: 50.8012, lng: 2.4854 },
    { id: 'rm-3', type: 'secteur', label: 'Mont des Cats',    desc: '1,1 km · 7,2 % · sommet pavé',   km: 28.5, lat: 50.7806, lng: 2.7286 },
    { id: 'rm-6', type: 'secteur', label: 'Kemmelberg',       desc: '800 m · 9,4 % · 22 % max',       km: 49.7, lat: 50.7878, lng: 2.8255 },
    { id: 'rm-9', type: 'arrivee', label: 'Arrivée — Cassel', desc: 'Retour Place Général de Gaulle', km: 95,   lat: 50.8012, lng: 2.4854 }
  ],
  'criterium-salouel-2025-06-08': [
    { id: 'cs-1', type: 'depart',    label: 'Départ — av. de l\'Étoile', desc: 'Z.I. Nord · 14h00', km: 0,   lat: 49.86440, lng: 2.22650 },
    { id: 'cs-2', type: 'signaleur', label: 'Signaleur — Carrefour Paix', desc: 'Sécurisation virage', km: 0.6, lat: 49.86570, lng: 2.23120, contact: { name: 'Lemaire Antoine', phone: '06 09 78 37 72' } },
    { id: 'cs-4', type: 'danger',    label: 'Danger — Chicane', desc: 'Virage serré', km: 1.9, lat: 49.85780, lng: 2.22810 },
    { id: 'cs-6', type: 'arrivee',   label: 'Arrivée — Ligne ZI', desc: '8 tours · sprint final', km: 40, lat: 49.86440, lng: 2.22650 }
  ],
  'championnat-ufolep-2025-06-15': [
    { id: 'ch-1', type: 'depart',  label: 'Départ — Orchies', desc: 'Place de la République · 14h00', km: 0,    lat: 50.4719, lng: 3.2419 },
    { id: 'ch-3', type: 'secteur', label: 'Côte de Mons-en-Pévèle', desc: '1,2 km · 4,5 % moyen', km: 18.0, lat: 50.4892, lng: 3.0972 },
    { id: 'ch-4', type: 'ravito',  label: 'Ravito Pont-à-Marcq', desc: 'Place de la Mairie', km: 28.5, lat: 50.5189, lng: 3.1064 },
    { id: 'ch-7', type: 'arrivee', label: 'Arrivée — Orchies', desc: 'Place de la République', km: 58, lat: 50.4719, lng: 3.2419 }
  ],
  'grand-prix-salouel-2025-07-06': [
    { id: 'gp-1', type: 'depart',    label: 'Départ — Place de l\'Église', desc: 'Centre Salouel · 13h30', km: 0, lat: 49.85770, lng: 2.23470 },
    { id: 'gp-3', type: 'signaleur', label: 'Signaleur — Pont-de-Metz', desc: 'Carrefour critique', km: 1.5, lat: 49.85850, lng: 2.24500, contact: { name: 'Scotte Julien', phone: '06 09 78 37 72' } },
    { id: 'gp-5', type: 'danger',    label: 'Danger — Boulevard Sud', desc: 'Revêtement bosselé', km: 4.2, lat: 49.85130, lng: 2.23720 },
    { id: 'gp-7', type: 'arrivee',   label: 'Arrivée — Sprint Église', desc: '10 tours · sprint final', km: 65, lat: 49.85770, lng: 2.23470 }
  ],
  'rando-3-provinces-2025-09-14': [
    { id: 'r3-1',  type: 'depart',  label: 'Départ — Maroilles', desc: 'Place de la Mairie · 8h00', km: 0,    lat: 50.1268, lng: 3.7641 },
    { id: 'r3-3',  type: 'ravito',  label: 'Ravito Avesnes', desc: 'Place Général Leclerc', km: 23.1, lat: 50.1242, lng: 3.9314 },
    { id: 'r3-5',  type: 'secteur', label: 'Mur de Liessies', desc: '600 m · 9,8 % · 14 % max', km: 48.2, lat: 50.0844, lng: 4.0681 },
    { id: 'r3-7',  type: 'secteur', label: 'Côte de Sars-Poteries', desc: '1,4 km · 6,2 % moyen', km: 64.8, lat: 50.1958, lng: 3.9522 },
    { id: 'r3-10', type: 'arrivee', label: 'Arrivée — Maroilles', desc: 'Retour Place de la Mairie', km: 120, lat: 50.1268, lng: 3.7641 }
  ],
};

const EVENEMENTS = [
  { slug: 'saloueloise-2025', title: 'La Saloueloise Pavés', type: 'cyclosportive', date: '2025-04-13', heure: '08:30', lieu: 'Salouel', region: 'Hauts-de-France', distance_km: 172, inscrits: 284, max_inscrits: 400, engagement_eur: 18, sortie_id: 'arenberg-2025-04-05', statut: 'ouvert', hero_img: 'asset/img/hero-pave.svg', description: 'Notre cyclosportive annuelle sur les pavés. Trois parcours au choix — 65, 115 ou 172 km en tracé Paris-Roubaix intégral.' },
  { slug: 'scarpe-gravel-2025-04', title: 'Gravel de la Scarpe', type: 'gravel', date: '2025-04-27', heure: '08:30', lieu: 'St-Amand', region: 'Bois de Raismes', distance_km: 82, sortie_id: 'scarpe-gravel-2025-04-27', statut: 'ouvert' },
  { slug: 'ronde-monts-2025', title: 'La Ronde des Monts', type: 'cyclosportive', date: '2025-05-18', heure: '09:00', lieu: 'Cassel', region: 'Mont des Cats', distance_km: 95, sortie_id: 'ronde-monts-2025-05-18', statut: 'ouvert' },
  { slug: 'criterium-salouel-2025', title: 'Critérium de Salouel', type: 'criterium', date: '2025-06-08', heure: '14:00', lieu: 'Salouel', region: 'Z.I. nord', distance_km: 40, sortie_id: 'criterium-salouel-2025-06-08', statut: 'ouvert' },
  { slug: 'championnat-ufolep-2025', title: 'Championnat régional UFOLEP', type: 'championnat', date: '2025-06-15', heure: '14:00', lieu: 'Orchies', region: 'Hauts-de-France', distance_km: 58, sortie_id: 'championnat-ufolep-2025-06-15', statut: 'ouvert' },
  { slug: 'grand-prix-salouel-2025', title: 'Grand Prix de Salouel', type: 'course', date: '2025-07-06', heure: '13:30', lieu: 'Salouel', region: 'Centre-ville', distance_km: 65, sortie_id: 'grand-prix-salouel-2025-07-06', statut: 'ouvert' },
  { slug: 'rando-3-provinces-2025', title: 'Rando des 3 Provinces', type: 'rando', date: '2025-09-14', heure: '08:00', lieu: 'Maroilles', region: 'Avesnois', distance_km: 120, sortie_id: 'rando-3-provinces-2025-09-14', statut: 'ouvert' },

  /* ─── Courses régionales Hauts-de-France / Nord ─── */
  { slug: 'paris-roubaix-amateur-2025', title: 'Paris–Roubaix Challenge', type: 'cyclosportive', date: '2025-04-12', heure: '07:30', lieu: 'Busigny', region: 'Nord · 59', distance_km: 172, inscrits: 6500, max_inscrits: 8000, engagement_eur: 75, statut: 'ouvert', description: "L'épreuve cyclosportive officielle organisée la veille de Paris–Roubaix professionnel. 30 secteurs pavés sur le parcours intégral.", hero_img: 'asset/img/hero-route.svg' },
  { slug: 'tour-flandres-fr-2025', title: 'Ronde van Vlaanderen Cyclo', type: 'cyclosportive', date: '2025-04-05', heure: '07:00', lieu: 'Audenarde (BE)', region: 'Flandre · proche Lille', distance_km: 235, inscrits: 16000, max_inscrits: 16000, engagement_eur: 60, statut: 'complet', description: "Le mythique Tour des Flandres ouvert aux amateurs. Au départ d'Audenarde, accessible depuis Lille en 1 h. Toutes les côtes des pros.", hero_img: 'asset/img/hero-route.svg' },
  { slug: 'lille-hardelot-2025', title: 'Lille–Hardelot', type: 'rando', date: '2025-06-08', heure: '06:00', lieu: 'Lille', region: 'Nord · Pas-de-Calais', distance_km: 200, inscrits: 4200, max_inscrits: 5500, engagement_eur: 35, statut: 'ouvert', description: "32e édition. Parcours unique de Lille à Hardelot-Plage. Départ groupé en pelotons de 50, ravitaillements tous les 50 km.", hero_img: 'asset/img/hero-route.svg' },
  { slug: 'cyclo-amiens-2025', title: 'La Picarde Amiénoise', type: 'cyclosportive', date: '2025-05-25', heure: '08:00', lieu: 'Amiens', region: 'Somme · proche Salouel', distance_km: 112, inscrits: 480, max_inscrits: 700, engagement_eur: 22, statut: 'ouvert', description: "Cyclosportive partant des Hortillonnages. 3 parcours : 55, 85 ou 112 km dans la campagne picarde et la baie de Somme.", hero_img: 'asset/img/hero-route.svg' },
  { slug: 'gp-fourmies-amateur-2025', title: 'GP Fourmies Amateur', type: 'course', date: '2025-09-07', heure: '13:00', lieu: 'Fourmies', region: 'Avesnois · 59', distance_km: 145, max_inscrits: 200, engagement_eur: 28, statut: 'ouvert', description: "Le GP Fourmies amateur, la veille de l'épreuve professionnelle. Circuit de 12,1 km à parcourir 12 fois.", hero_img: 'asset/img/hero-route.svg' },
  { slug: 'cyclo-baie-somme-2025', title: 'Cyclo de la Baie de Somme', type: 'rando', date: '2025-08-31', heure: '08:30', lieu: 'Saint-Valery-sur-Somme', region: 'Somme · côte', distance_km: 90, max_inscrits: 1200, engagement_eur: 15, statut: 'ouvert', description: "Au départ de Saint-Valery, boucles de 50, 70 ou 90 km. Vue mer, marais et phoques au Hourdel.", hero_img: 'asset/img/hero-route.svg' },
];

const SEGMENTS_GLOBAL = [
  // Schema: kom VARCHAR(100) — utilisé pour stocker le pseudo du KOM,
  // pas un boolean. true → '1' était silencieux mais sémantiquement faux.
  { name: "Trouée d'Arenberg", location: 'Wallers', stars: 5, length_m: 2400, meilleur_temps: "6'42\"", delta_moyenne: '−22\" scratch', rang: '1er · KOM', rang_cls: 'rank-gold', kom: 'admin', sortie_id: 'arenberg-2025-04-05' },
  { name: "Carrefour de l'Arbre", location: 'Camphin', stars: 5, length_m: 1600, meilleur_temps: "4'28\"", delta_moyenne: '−12\" scratch', rang: '2e', rang_cls: 'rank-silver', sortie_id: 'arenberg-2025-04-05' },
  { name: 'Mons-en-Pévèle', location: 'Pévèle', stars: 5, length_m: 3000, meilleur_temps: "8'54\"", delta_moyenne: '+4\" scratch', rang: '4e', rang_cls: '', sortie_id: 'pevele-2025-01-26' },
  { name: 'Kemmelberg', location: 'Flandre', stars: 5, length_m: 800, meilleur_temps: "2'54\"", delta_moyenne: '+2\" scratch', rang: '5e', rang_cls: '', sortie_id: 'monts-flandres-2025-03-28' },
  { name: 'Mont des Cats', location: 'Flandre', stars: 4, length_m: 1100, meilleur_temps: "4'18\"", delta_moyenne: '−6\" scratch', rang: '3e', rang_cls: 'rank-bronze', sortie_id: 'monts-flandres-2025-03-28' },
];

const PALMARES_DATA = [
  // Schema: medaille ENUM('gold','silver','bronze') · equipe VARCHAR(50)
  // Cf. AUDIT item #10 — l'ancien seed insérait 'or'/'argent' qui sont
  // refusés (sql_mode strict) ou silencieusement coercés en '' (permissif).
  { annee: 2025, titre: 'Vainqueur — Trouée d\'Arenberg', evenement: 'Reconnaissance Paris-Roubaix', categorie: 'Open', rang: 1, medaille: 'gold', sortie_id: 'arenberg-2025-04-05' },
  { annee: 2024, titre: '2e — Mont des Cats', evenement: 'Ronde des Monts', categorie: 'M40', rang: 2, medaille: 'silver' },
  { annee: 2024, titre: 'Vainqueur — Grand Prix de Salouel', evenement: 'Grand Prix de Salouel', categorie: '3e cat', rang: 1, medaille: 'gold', equipe: null },
  { annee: 2023, titre: 'Équipe — Critérium UFOLEP', evenement: 'Championnat régional', categorie: 'Équipe', rang: 1, medaille: 'gold', equipe: 'Équipe CCS A' },
];

// ═══════════════════════════════════════════════════════════════

async function seed() {
  // Mode --reset : TRUNCATE complet (efface TOUT, y compris vos imports)
  // Mode défaut : INSERT IGNORE / ON DUPLICATE KEY UPDATE — préserve
  // les courses importées via /api/sorties/import-gpx, les comptes
  // utilisateurs, les contacts, etc.
  const RESET = process.argv.includes('--reset') || process.argv.includes('-r');
  const FORCE = process.argv.includes('--yes') || process.argv.includes('-y');

  if (RESET) {
    console.log('');
    console.log('⚠️  ⚠️  ⚠️   AVERTISSEMENT  ⚠️  ⚠️  ⚠️');
    console.log('');
    console.log('Mode --reset : VOUS ALLEZ EFFACER ABSOLUMENT TOUTES LES DONNÉES.');
    console.log('Cela inclut :');
    console.log('   • Toutes les sorties (y compris celles importées via le formulaire admin)');
    console.log('   • Tous les comptes utilisateurs créés');
    console.log('   • Tous les événements, inscriptions, contacts');
    console.log('   • Le palmarès, les segments, les POIs');
    console.log('');
    console.log('Cette action est IRRÉVERSIBLE. Les fichiers GPX physiques dans');
    console.log('asset/gpx/ ne seront PAS supprimés mais les sorties ne pointeront');
    console.log('plus dessus en base.');
    console.log('');

    if (!FORCE) {
      // Demande de confirmation interactive
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise(resolve => {
        rl.question('Tapez exactement "OUI EFFACER" pour confirmer (sinon Entrée pour annuler) : ', resolve);
      });
      rl.close();
      if (answer.trim() !== 'OUI EFFACER') {
        console.log('\n✓ Reset annulé. Aucune donnée n\'a été touchée.\n');
        process.exit(0);
      }
      console.log('');
    } else {
      console.log('   --yes détecté, exécution sans confirmation.\n');
    }
  } else {
    console.log('🌱 Mode safe (par défaut) : seed des données initiales sans toucher');
    console.log('   aux courses importées ni aux comptes utilisateurs existants.');
    console.log('   Pour tout ré-initialiser, utilisez : node seed.js --reset\n');
  }

  try {
    // ── Admin par défaut ────────────────────────────────────────
    console.log('👤 Création des utilisateurs...');
    const adminHash = await bcrypt.hash('Admin@Salouel2025', 12);
    const membreHash = await bcrypt.hash('Membre@Salouel2025', 12);

    if (RESET) {
      // Supprimer les données existantes (ordre FK)
      await query('SET FOREIGN_KEY_CHECKS = 0');
      for (const t of ['refresh_tokens','user_equipment','pois','sortie_segments',
                       'sortie_stats_extra','sortie_tags','evenement_inscriptions',
                       'evenements','palmares','segments_global','contacts','sorties',
                       'club_settings','users']) {
        await query(`TRUNCATE TABLE ${t}`);
      }
      await query('SET FOREIGN_KEY_CHECKS = 1');
    }

    // Paramètres club par défaut
    const CLUB_SETTINGS = {
      name:       'C.C. Salouel',
      founded:    '1978',
      president:  'Antoine Lemaire',
      licencies:  '87',
      address:    '14 rue de l\'Église, 80480 Salouel',
      email:      'contact@club-salouel.fr',
      phone:      '06 09 12 34 56',
      sortie_day: 'Dimanche · 8h30',
      instagram:  'cc_salouel',
      strava:     'clubs/cc-salouel'
    };
    for (const [cle, valeur] of Object.entries(CLUB_SETTINGS)) {
      await query('INSERT IGNORE INTO club_settings (cle, valeur) VALUES (?, ?)', [cle, valeur]);
    }
    console.log(`  ✅ ${Object.keys(CLUB_SETTINGS).length} paramètres club initialisés`);

    // Utilisateurs
    await query(
      `INSERT IGNORE INTO users (numero, username, email, password_hash, prenom, nom, role, bio, ftp_w, km_saison, elevation_saison, licence_ffc, annee_adhesion)
       VALUES (1, 'admin', 'admin@club-salouel.fr', ?, 'Antoine', 'Lemaire', 'admin',
               'Président du Club depuis 2019. Routier paveophile convaincu.', 310, 4218, 52640, 'FFC2024001', 1997)`,
      [adminHash]
    );
    await query(
      `INSERT IGNORE INTO users (numero, username, email, password_hash, prenom, nom, role, ftp_w, km_saison, annee_adhesion)
       VALUES (2, 'membre1', 'membre@club-salouel.fr', ?, 'Thomas', 'Dubois', 'membre', 265, 3120, 2018)`,
      [membreHash]
    );

    // Équipement admin
    await query(`INSERT IGNORE INTO user_equipment (user_id, num, titre, description, sort_order) VALUES
      (1, 1, 'Canyon Ultimate CF SLX', 'Cadre carbone · 7,2 kg · Shimano Dura-Ace Di2 12v · roues Zipp 303', 1),
      (1, 2, 'Canyon Grail CF SL', 'Gravel carbone · 8,6 kg · GRX Di2 · pneus Gravelking 40c', 2),
      (1, 3, 'Garmin Edge 840 Solar', 'GPS · 32h autonomie · capteur de puissance 4iiii', 3),
      (1, 4, 'Tacx NEO 3M', 'Home trainer smart · simulation route', 4)`
    );

    console.log('  ✅ 2 utilisateurs créés (admin + membre)');
    // Cf. AUDIT item #24 — ne pas dévoiler les mots de passe par défaut
    // si le seed est lancé en prod (ex. Docker entrypoint qui logge).
    if (process.env.NODE_ENV !== 'production') {
      console.log('  📋 Logins: admin/Admin@Salouel2025  |  membre1/Membre@Salouel2025\n');
    } else {
      console.log('  📋 (mots de passe non affichés en NODE_ENV=production — voir le code seed.js)\n');
    }

    // ── Sorties ─────────────────────────────────────────────────
    console.log('🚴 Import des sorties...');
    for (const s of SORTIES) {
      await query(
        `INSERT IGNORE INTO sorties (id,slug,title,title_html,subtitle,chapter,description,date,date_label,
          distance_km,duration_label,elevation_gain,elevation_loss,elevation_max,elevation_min,
          tss,np_w,pave_km,secteurs,hero_img,card_img,location_name,location_lat,location_lng,
          gpx_filename,number,featured,statut,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          s.id, s.slug||s.id, s.title, s.title_html||s.title,
          s.subtitle||null, s.chapter||null, s.description||null,
          s.date, s.date_label||null, s.distance_km||null, s.duration_label||null,
          s.elevation_gain||null, s.elevation_loss||null, s.elevation_max||null, s.elevation_min||null,
          s.tss||null, s.np_w||null, s.pave_km||null, s.secteurs||null,
          s.hero_img||null, s.card_img||null,
          s.location?.name||null, s.location?.lat||null, s.location?.lng||null,
          s.gpx_filename||null, s.number||null, s.featured?1:0, s.statut||'passee'
        ]
      );
      for (let i = 0; i < (s.tags||[]).length; i++) {
        const t = s.tags[i];
        await query('INSERT IGNORE INTO sortie_tags (sortie_id,type,label,sort_order) VALUES (?,?,?,?)', [s.id, t.type, t.label, i]);
      }
      for (let i = 0; i < (s.stats_extra||[]).length; i++) {
        const st = s.stats_extra[i];
        await query('INSERT IGNORE INTO sortie_stats_extra (sortie_id,label,value,unit,cls,sort_order) VALUES (?,?,?,?,?,?)', [s.id, st.label, st.value, st.unit||null, st.cls||null, i]);
      }
      for (const seg of (s.segments||[])) {
        await query('INSERT IGNORE INTO sortie_segments (sortie_id,idx,name,sub,stars,length_m,`time`,delta,delta_cls,`rank`) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [s.id, seg.idx, seg.name, seg.sub||null, seg.stars||3, seg.length_m||null, seg.time||null, seg.delta||null, seg.delta_cls||null, seg.rank||null]);
      }
    }
    console.log(`  ✅ ${SORTIES.length} sorties importées\n`);

    // ── POIs ────────────────────────────────────────────────────
    console.log('📍 Import des POIs...');
    let totalPois = 0;
    for (const [sortieId, pois] of Object.entries(POIS_MAP)) {
      for (const p of pois) {
        await query(
          `INSERT IGNORE INTO pois (id,sortie_id,type,label,description,km,lat,lng,contact_name,contact_phone,user_added,created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,0,1)`,
          [p.id, sortieId, p.type, p.label, p.desc||null, p.km??null, p.lat, p.lng, p.contact?.name||null, p.contact?.phone||null]
        );
        totalPois++;
      }
    }
    console.log(`  ✅ ${totalPois} POIs importés\n`);

    // ── Événements ──────────────────────────────────────────────
    console.log('📅 Import des événements...');
    for (const e of EVENEMENTS) {
      await query(
        `INSERT IGNORE INTO evenements (slug,title,type,date,heure,lieu,region,distance_km,description,inscrits,max_inscrits,engagement_eur,sortie_id,hero_img,statut)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [e.slug, e.title, e.type, e.date, e.heure||null, e.lieu||null, e.region||null,
         e.distance_km||null, e.description||null, e.inscrits||0, e.max_inscrits||null,
         e.engagement_eur||null, e.sortie_id||null, e.hero_img||null, e.statut||'ouvert']
      );
    }
    console.log(`  ✅ ${EVENEMENTS.length} événements importés\n`);

    // ── Segments ────────────────────────────────────────────────
    console.log('⏱️  Import des segments...');
    for (const s of SEGMENTS_GLOBAL) {
      await query(
        `INSERT IGNORE INTO segments_global (name,location,stars,length_m,meilleur_temps,delta_moyenne,rang,rang_cls,kom,sortie_id)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [s.name, s.location||null, s.stars||3, s.length_m||null, s.meilleur_temps||null,
         s.delta_moyenne||null, s.rang||null, s.rang_cls||null, s.kom||null, s.sortie_id||null]
      );
    }
    console.log(`  ✅ ${SEGMENTS_GLOBAL.length} segments importés\n`);

    // ── Palmarès ────────────────────────────────────────────────
    console.log('🏆 Import du palmarès...');
    for (const p of PALMARES_DATA) {
      await query(
        `INSERT IGNORE INTO palmares (annee,titre,evenement,categorie,rang,medaille,equipe,sortie_id)
         VALUES (?,?,?,?,?,?,?,?)`,
        [p.annee, p.titre, p.evenement||null, p.categorie||null, p.rang||null, p.medaille||null, p.equipe||null, p.sortie_id||null]
      );
    }
    console.log(`  ✅ ${PALMARES_DATA.length} entrées palmarès importées\n`);

    console.log('═'.repeat(55));
    console.log('✅ Seed terminé avec succès !');
    console.log('═'.repeat(55));
    console.log('\n  Admin :  admin / Admin@Salouel2025');
    console.log('  Membre : membre1 / Membre@Salouel2025\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erreur seed :', err.message);
    console.error(err);
    process.exit(1);
  }
}

seed();
