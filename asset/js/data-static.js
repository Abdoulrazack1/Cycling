/* asset/js/data-static.js — données de démo (mode CCS_CONFIG.backend === 'static')
 * Extrait de data.js — chargé AVANT data.js dans chaque page HTML.
 * data.js consomme ensuite window.CCS_STATIC.{sorties,pois,...}.
 */
(() => {
  'use strict';
  window.CCS_STATIC = window.CCS_STATIC || {};

  window.CCS_STATIC.sorties = [
    {
      id: 'arenberg-2025-04-05',
      slug: 'paris-roubaix',
      title: 'Reconnaissance Paris–Roubaix',
      title_html: 'Reconnaissance <span class="it">Paris–Roubaix</span>',
      subtitle: 'Compiègne → Vélodrome de Roubaix',
      chapter: 'Sortie hebdomadaire · pavé',
      description: "Compiègne au vélodrome André-Pétrieux, vingt-sept secteurs pavés à reconnaître à huit jours de la Saloueloise. Sortie longue, allure de groupe, deux arrêts marqués à Arenberg et au Carrefour de l'Arbre.",
      date: '2025-04-05',
      date_label: 'Dimanche 5 avril 2025',
      distance_km: 172,
      duration_label: '5h48',
      elevation_gain: 820,
      elevation_loss: 814,
      elevation_max: 105,
      elevation_min: 25,
      tss: 342, np_w: 228,
      pave_km: 54, secteurs: 27,
      tags: [
        { type: 'live',  label: 'En cours' },
        { type: 'date',  label: 'Dimanche 5 avril 2025' },
        { type: 'brass', label: 'Sortie № 247' }
      ],
      hero_img: 'asset/img/hero-pave.svg',
      card_img: 'asset/img/hero-pave.svg',
      location: { name: 'Wallers', lat: 50.4351, lng: 3.2481 },
      gpx_ref: 'arenberg-2025.gpx',
      number: 247,
      featured: true,
      stats_extra: [
        { label: 'Pavé',     value: '54',  unit: 'km', cls: 'ox' },
        { label: 'Secteurs', value: '27',  cls: 'brass' },
        { label: 'NP',       value: '228', unit: 'w' }
      ],
      segments: [
        { idx: 17, name: "Trouée d'Arenberg",   sub: 'Wallers · 95,8 km',  stars: 5, length_m: 2400, time: '6:42', delta: '−12 s', delta_cls: 'neg', rank: '2<sup>e</sup>/11' },
        { idx:  4, name: "Carrefour de l'Arbre", sub: 'Camphin · 152,4 km', stars: 5, length_m: 1600, time: '4:28', delta: '−8 s',  delta_cls: 'neg', rank: '3<sup>e</sup>/11' },
        { idx:  5, name: 'Mons-en-Pévèle',      sub: '128,8 km',           stars: 5, length_m: 3000, time: '8:54', delta: '+4 s',  delta_cls: 'pos', rank: '4<sup>e</sup>/11' },
        { idx: 19, name: 'Haveluy → Wallers',   sub: '88,5 km',            stars: 3, length_m: 2500, time: '7:16', delta: '±0 s',  delta_cls: 'neu', rank: '5<sup>e</sup>/11' },
        { idx:  9, name: 'Auchy → Bersée',      sub: '118,2 km',           stars: 3, length_m: 2700, time: '7:58', delta: '−3 s',  delta_cls: 'neg', rank: '3<sup>e</sup>/11' }
      ]
    },

    {
      id: 'monts-flandres-2025-03-28',
      slug: 'monts-flandres',
      title: 'Monts des Flandres',
      title_html: 'Monts <span class="it">des</span> Flandres',
      subtitle: 'Cassel · Mont des Cats · Mont Noir · Kemmelberg',
      chapter: 'Sortie hebdomadaire · monts',
      description: "Boucle vallonnée au départ de Cassel. Cinq monts flamands enchaînés — Mont des Cats, Mont Noir, Kemmelberg — avec retour par les plateaux de Bailleul. Allure soutenue, groupe unique, ravito au Mont des Cats.",
      date: '2025-03-28',
      date_label: 'Samedi 28 mars 2025',
      distance_km: 77,
      duration_label: '3h12',
      elevation_gain: 730,
      elevation_loss: 730,
      elevation_max: 176,
      elevation_min: 40,
      tss: 218, np_w: 218,
      tags: [
        { type: 'date',  label: 'Samedi 28 mars 2025' },
        { type: 'brass', label: 'Monts' },
        { type: 'plain', label: 'Sortie № 246' }
      ],
      hero_img: 'asset/img/hero-monts.svg',
      card_img: 'asset/img/hero-monts.svg',
      location: { name: 'Cassel', lat: 50.8012, lng: 2.4854 },
      gpx_ref: 'monts-flandres.gpx',
      number: 246,
      stats_extra: [
        { label: 'Monts',     value: '5',   cls: 'brass' },
        { label: 'Pente max', value: '21',  unit: '%' },
        { label: 'NP',        value: '218', unit: 'w' }
      ],
      segments: [
        { idx: 1, name: 'Mont des Cats',              sub: 'km 28,5', stars: 4, length_m: 1100, time: '4:18', delta: '−6 s', delta_cls: 'neg', rank: '3<sup>e</sup>/9' },
        { idx: 2, name: 'Mont Noir',                  sub: 'km 29,8', stars: 3, length_m:  900, time: '3:02', delta: '−4 s', delta_cls: 'neg', rank: '4<sup>e</sup>/9' },
        { idx: 3, name: 'Kemmelberg',                 sub: 'km 39,7', stars: 5, length_m:  800, time: '2:54', delta: '+2 s', delta_cls: 'pos', rank: '5<sup>e</sup>/9' },
        { idx: 4, name: 'Cassel · ascension finale',  sub: 'km 73,2', stars: 4, length_m: 1200, time: '4:48', delta: '−8 s', delta_cls: 'neg', rank: '2<sup>e</sup>/9' }
      ]
    },

    {
      id: 'avesnois-2025-03-15',
      slug: 'avesnois',
      title: "Tour de l'Avesnois",
      title_html: "Tour <span class=\"it\">de</span> l'Avesnois",
      subtitle: 'Maroilles · Avesnes · Solre-le-Château · Sars-Poteries',
      chapter: 'Sortie longue · bocage',
      description: "Boucle de 114 km dans le bocage de l'Avesnois. Départ Maroilles, on longe la Sambre jusqu'à Avesnes, puis montée vers Solre-le-Château et descente par Sars-Poteries. Profil cassant, vingt rampes courtes mais sèches.",
      date: '2025-03-15',
      date_label: 'Samedi 15 mars 2025',
      distance_km: 62.7,
      duration_label: '2h30',
      elevation_gain: 516,
      elevation_loss: 516,
      elevation_max: 225,
      elevation_min: 141,
      tss: 268, np_w: 215,
      tags: [
        { type: 'date',  label: 'Samedi 15 mars 2025' },
        { type: 'plain', label: 'Club' },
        { type: 'plain', label: 'Sortie № 245' }
      ],
      hero_img: 'asset/img/hero-monts.svg',
      card_img: 'asset/img/hero-monts.svg',
      location: { name: 'Maroilles', lat: 50.1268, lng: 3.7641 },
      gpx_ref: 'avesnois.gpx',
      number: 245,
      stats_extra: [
        { label: 'Boucle', value: '114', unit: 'km', cls: 'brass' },
        { label: 'Rampes', value: '20' },
        { label: 'NP',     value: '215', unit: 'w' }
      ],
      segments: [
        { idx: 1, name: 'Côte de Sars-Poteries', sub: 'km 64,8', stars: 4, length_m: 1400, time: '4:32', delta: '−5 s', delta_cls: 'neg', rank: '3<sup>e</sup>/8' },
        { idx: 2, name: 'Mur de Liessies',       sub: 'km 48,2', stars: 3, length_m:  600, time: '2:18', delta: '+1 s', delta_cls: 'pos', rank: '4<sup>e</sup>/8' },
        { idx: 3, name: 'Côte de Trélon',        sub: 'km 38,1', stars: 3, length_m: 1100, time: '3:46', delta: '−8 s', delta_cls: 'neg', rank: '2<sup>e</sup>/8' }
      ]
    },

    {
      id: 'scarpe-gravel-2025-03-02',
      slug: 'scarpe-gravel',
      title: 'La Scarpe Gravel',
      title_html: 'La Scarpe <span class="it">en gravel</span>',
      subtitle: 'Saint-Amand · Forêt de Raismes · Mortagne',
      chapter: 'Sortie gravel · forêt',
      description: "Boucle gravel de 68 km dans la forêt domaniale de Saint-Amand–Raismes. 80 % de chemins forestiers, traverses du Mortier, ravito au Mont des Bruyères. Allure gravel, départ à 9 h, retour avant midi.",
      date: '2025-03-02',
      date_label: 'Dimanche 2 mars 2025',
      distance_km: 32.8,
      duration_label: '1h25',
      elevation_gain: 143,
      elevation_loss: 143,
      elevation_max: 87,
      elevation_min: 27,
      tss: 182, np_w: 195,
      tags: [
        { type: 'date',  label: 'Dimanche 2 mars 2025' },
        { type: 'brass', label: 'Gravel' },
        { type: 'plain', label: 'Sortie № 244' }
      ],
      hero_img: 'asset/img/hero-gravel.svg',
      card_img: 'asset/img/hero-gravel.svg',
      location: { name: 'Saint-Amand-les-Eaux', lat: 50.4461, lng: 3.4278 },
      gpx_ref: 'scarpe-gravel.gpx',
      number: 244,
      stats_extra: [
        { label: 'Chemin', value: '80',  unit: '%', cls: 'brass' },
        { label: 'Forêt',  value: '54',  unit: 'km' },
        { label: 'NP',     value: '195', unit: 'w' }
      ],
      segments: [
        { idx: 1, name: 'Traverse du Mortier',     sub: 'km 18,4', stars: 3, length_m: 2800, time: '8:22', delta: '−12 s', delta_cls: 'neg', rank: '1<sup>er</sup>/6' },
        { idx: 2, name: 'Mont des Bruyères',       sub: 'km 33,1', stars: 4, length_m: 1100, time: '3:54', delta: '−4 s',  delta_cls: 'neg', rank: '2<sup>e</sup>/6' },
        { idx: 3, name: 'Layon de la Princesse',   sub: 'km 47,8', stars: 2, length_m: 1900, time: '5:18', delta: '±0 s',  delta_cls: 'neu', rank: '3<sup>e</sup>/6' }
      ]
    },

    {
      id: 'opale-2025-02-22',
      slug: 'cote-opale',
      title: "Côte d'Opale — Boulogne",
      title_html: 'Côte <span class="it">d\'</span>Opale',
      subtitle: 'Boulogne · Wimereux · Cap Gris-Nez · Wissant',
      chapter: 'Sortie longue · côte',
      description: "Boucle côtière de 103 km au départ de Boulogne. On remonte la côte par Wimereux et Audresselles, on tourne au Cap Gris-Nez, on file vers Wissant et on rentre par l'intérieur via Marquise. Vent dominant de face au retour.",
      date: '2025-02-22',
      date_label: 'Samedi 22 février 2025',
      distance_km: 51.3,
      duration_label: '2h10',
      elevation_gain: 597,
      elevation_loss: 597,
      elevation_max: 87,
      elevation_min: 11,
      tss: 245, np_w: 222,
      tags: [
        { type: 'date',  label: 'Samedi 22 février 2025' },
        { type: 'plain', label: 'Côte' },
        { type: 'plain', label: 'Sortie № 243' }
      ],
      hero_img: 'asset/img/hero-cote.svg',
      card_img: 'asset/img/hero-cote.svg',
      location: { name: 'Boulogne-sur-Mer', lat: 50.7264, lng: 1.6068 },
      gpx_ref: 'cote-opale.gpx',
      number: 243,
      stats_extra: [
        { label: 'Caps',     value: '6',   cls: 'brass' },
        { label: 'Falaises', value: '12',  unit: 'km' },
        { label: 'NP',       value: '222', unit: 'w' }
      ],
      segments: [
        { idx: 1, name: 'Côte de Wimereux',         sub: 'km 8,4',   stars: 3, length_m:  900, time: '3:08', delta: '−2 s', delta_cls: 'neg', rank: '4<sup>e</sup>/7' },
        { idx: 2, name: 'Cap Gris-Nez · ascension', sub: 'km 42,9',  stars: 5, length_m: 1600, time: '5:42', delta: '−9 s', delta_cls: 'neg', rank: '2<sup>e</sup>/7' },
        { idx: 3, name: "Mont d'Hubert",            sub: 'km 78,1',  stars: 3, length_m: 1200, time: '4:12', delta: '+3 s', delta_cls: 'pos', rank: '5<sup>e</sup>/7' }
      ]
    },

    {
      id: 'cambresis-2025-02-08',
      slug: 'cambresis',
      title: 'Boucle du Cambrésis',
      title_html: 'Boucle <span class="it">du</span> Cambrésis',
      subtitle: 'Cambrai · Caudry · Le Cateau · Solesmes',
      chapter: 'Sortie longue · plat venté',
      description: "Boucle de 98 km sur le plateau cambrésien — terrain plat, vent dominant, idéal pour travailler le foncier en relais. Départ Cambrai, passage par Caudry, Le Cateau et Solesmes, retour par les routes blanches du Solesmois.",
      date: '2025-02-08',
      date_label: 'Samedi 8 février 2025',
      distance_km: 98,
      duration_label: '3h55',
      elevation_gain: 695,
      elevation_loss: 695,
      elevation_max: 116,
      elevation_min: 60,
      tss: 224, np_w: 232,
      tags: [
        { type: 'date',  label: 'Samedi 8 février 2025' },
        { type: 'plain', label: 'Endurance' },
        { type: 'plain', label: 'Sortie № 242' }
      ],
      hero_img: 'asset/img/hero-peloton.svg',
      card_img: 'asset/img/hero-peloton.svg',
      location: { name: 'Cambrai', lat: 50.1763, lng: 3.2350 },
      gpx_ref: 'cambresis.gpx',
      number: 242,
      stats_extra: [
        { label: 'Vent',   value: 'O',   cls: 'brass' },
        { label: 'Relais', value: '12' },
        { label: 'NP',     value: '232', unit: 'w' }
      ],
      segments: [
        { idx: 1, name: 'Ligne droite de Solesmes', sub: 'km 52,4', stars: 2, length_m: 4200, time: '6:48', delta: '−4 s', delta_cls: 'neg', rank: '3<sup>e</sup>/8' },
        { idx: 2, name: 'Bosse du Cateau',          sub: 'km 38,7', stars: 3, length_m: 1400, time: '3:42', delta: '+2 s', delta_cls: 'pos', rank: '4<sup>e</sup>/8' }
      ]
    },

    {
      id: 'pevele-2025-01-26',
      slug: 'pevele',
      title: 'Boucle du Pévèle',
      title_html: 'Boucle <span class="it">du</span> Pévèle',
      subtitle: 'Orchies · Mons-en-Pévèle · Templeuve',
      chapter: 'Sortie courte · pavé léger',
      description: "Boucle pavée de 84 km dans le Pévèle. Six secteurs identifiés au programme — Mons-en-Pévèle, Auchy, Bersée, Camphin — sur des routes peu fréquentées. Sortie idéale pour préparer Paris–Roubaix sans s'épuiser.",
      date: '2025-01-26',
      date_label: 'Dimanche 26 janvier 2025',
      distance_km: 43.4,
      duration_label: '1h45',
      elevation_gain: 229,
      elevation_loss: 229,
      elevation_max: 108,
      elevation_min: 30,
      tss: 196, np_w: 210,
      pave_km: 18,
      tags: [
        { type: 'date',  label: 'Dimanche 26 janvier 2025' },
        { type: 'brass', label: 'Pavé' },
        { type: 'plain', label: 'Sortie № 241' }
      ],
      hero_img: 'asset/img/hero-pave.svg',
      card_img: 'asset/img/hero-pave.svg',
      location: { name: 'Orchies', lat: 50.4719, lng: 3.2419 },
      gpx_ref: 'pevele.gpx',
      number: 241,
      stats_extra: [
        { label: 'Pavé',     value: '18',  unit: 'km', cls: 'ox' },
        { label: 'Secteurs', value: '6',   cls: 'brass' },
        { label: 'NP',       value: '210', unit: 'w' }
      ],
      segments: [
        { idx: 1, name: 'Mons-en-Pévèle',  sub: 'km 24,3', stars: 5, length_m: 3000, time: '9:12', delta: '−6 s', delta_cls: 'neg', rank: '3<sup>e</sup>/7' },
        { idx: 2, name: 'Auchy → Bersée',  sub: 'km 38,7', stars: 3, length_m: 2700, time: '8:18', delta: '−2 s', delta_cls: 'neg', rank: '4<sup>e</sup>/7' },
        { idx: 3, name: 'Camphin · pavé',  sub: 'km 51,4', stars: 4, length_m: 1800, time: '5:42', delta: '+1 s', delta_cls: 'pos', rank: '5<sup>e</sup>/7' }
      ]
    },

    /* ══ COURSES FUTURES ══════════════════════════════════════════ */
    {
      id: 'scarpe-gravel-2025-04-27',
      slug: 'scarpe-gravel-avril',
      title: 'Gravel de la Scarpe',
      title_html: 'Gravel <span class="it">de la</span> Scarpe',
      subtitle: 'Saint-Amand-les-Eaux · Bois de Raismes · Forêt domaniale',
      chapter: 'Événement à venir · Gravel',
      description: 'Deuxième édition du Gravel de la Scarpe. Deux parcours : 48 km ou 82 km sur les sentiers forestiers du Bois de Raismes et la vallée de la Scarpe. Organisation C.C.S., départ à 8 h 30.',
      date: '2025-04-27',
      date_label: 'Dimanche 27 avril 2025',
      distance_km: 82,
      duration_label: '3h30',
      elevation_gain: 620,
      elevation_loss: 620,
      elevation_max: 90,
      elevation_min: 15,
      tss: null, np_w: null,
      tags: [
        { type: 'plain', label: 'À venir' },
        { type: 'date',  label: 'Dimanche 27 avril 2025' },
        { type: 'brass', label: 'Gravel' }
      ],
      hero_img: 'asset/img/hero-gravel.svg',
      card_img: 'asset/img/hero-gravel.svg',
      location: { name: 'Saint-Amand-les-Eaux', lat: 50.4461, lng: 3.4278 },
      gpx_ref: 'scarpe-gravel.gpx',
      number: null,
      stats_extra: [
        { label: 'Sentiers', value: '80', unit: '%' },
        { label: 'D+',       value: '620', unit: 'm' }
      ],
      segments: []
    },

    {
      id: 'ronde-monts-2025-05-18',
      slug: 'ronde-monts',
      title: 'La Ronde des Monts',
      title_html: 'La Ronde <span class="it">des</span> Monts',
      subtitle: 'Cassel · Mont des Cats · Kemmelberg',
      chapter: 'Événement à venir · Cyclosportive FFC',
      description: 'Cyclosportive FFC avec participation de l\'équipe course du club. Départ de Cassel, 95 km sur les monts flamands. Mont des Cats, Kemmelberg, Mont Noir enchaînés. Allure course.',
      date: '2025-05-18',
      date_label: 'Dimanche 18 mai 2025',
      distance_km: 95,
      duration_label: '3h45',
      elevation_gain: 1100,
      elevation_loss: 1100,
      elevation_max: 176,
      elevation_min: 20,
      tss: null, np_w: null,
      tags: [
        { type: 'plain', label: 'À venir' },
        { type: 'date',  label: 'Dimanche 18 mai 2025' },
        { type: 'brass', label: 'Monts' }
      ],
      hero_img: 'asset/img/hero-monts.svg',
      card_img: 'asset/img/hero-monts.svg',
      location: { name: 'Cassel', lat: 50.8012, lng: 2.4854 },
      gpx_ref: 'monts-flandres.gpx',
      number: null,
      stats_extra: [
        { label: 'Monts',     value: '5',    cls: 'brass' },
        { label: 'Pente max', value: '21',   unit: '%' },
        { label: 'Distance',  value: '95',   unit: 'km' }
      ],
      segments: []
    },

    {
      id: 'criterium-salouel-2025-06-08',
      slug: 'criterium-salouel',
      title: 'Critérium de Salouel',
      title_html: 'Critérium <span class="it">de</span> Salouel',
      subtitle: 'Salouel · Circuit Z.I. Nord · Toutes catégories',
      chapter: 'Événement à venir · Circuit fermé',
      description: 'Critérium sur circuit fermé en zone industrielle nord. Ouvert à toutes catégories et aux extérieurs. 40 km, départ 14 h 00. Organisation C.C.S. de Cyclisme de Salouel.',
      date: '2025-06-08',
      date_label: 'Dimanche 8 juin 2025',
      distance_km: 40,
      duration_label: '1h20',
      elevation_gain: 80,
      elevation_loss: 80,
      elevation_max: 75,
      elevation_min: 55,
      tss: null, np_w: null,
      tags: [
        { type: 'plain', label: 'À venir' },
        { type: 'date',  label: 'Dimanche 8 juin 2025' },
        { type: 'brass', label: 'Critérium' }
      ],
      hero_img: 'asset/img/hero-peloton.svg',
      card_img: 'asset/img/hero-peloton.svg',
      location: { name: 'Salouel', lat: 49.8577, lng: 2.2347 },
      gpx_ref: 'criterium-salouel.gpx',
      number: null,
      stats_extra: [
        { label: 'Circuit', value: '40', unit: 'km' },
        { label: 'Départ',  value: '14h00' }
      ],
      segments: []
    },

    {
      id: 'championnat-ufolep-2025-06-15',
      slug: 'championnat-ufolep',
      title: 'Championnat régional UFOLEP',
      title_html: 'Championnat <span class="it">régional</span> UFOLEP',
      subtitle: 'Orchies · Route · Hauts-de-France · Toutes catégories',
      chapter: 'Événement à venir · Route',
      description: 'Championnat régional UFOLEP sur route. 58 km toutes catégories, départ 14 h 00 à Orchies. Parcours sur les routes pavées du Pévèle.',
      date: '2025-06-15',
      date_label: 'Dimanche 15 juin 2025',
      distance_km: 58,
      duration_label: '2h10',
      elevation_gain: 300,
      elevation_loss: 300,
      elevation_max: 108,
      elevation_min: 22,
      tss: null, np_w: null,
      tags: [
        { type: 'plain', label: 'À venir' },
        { type: 'date',  label: 'Dimanche 15 juin 2025' },
        { type: 'brass', label: 'Route' }
      ],
      hero_img: 'asset/img/hero-peloton.svg',
      card_img: 'asset/img/hero-peloton.svg',
      location: { name: 'Orchies', lat: 50.4719, lng: 3.2419 },
      gpx_ref: 'pevele.gpx',
      number: null,
      stats_extra: [
        { label: 'Distance', value: '58', unit: 'km' },
        { label: 'Secteurs', value: '6',  cls: 'brass' }
      ],
      segments: []
    },

    {
      id: 'grand-prix-salouel-2025-07-06',
      slug: 'grand-prix-salouel',
      title: 'Grand Prix de Salouel',
      title_html: 'Grand Prix <span class="it">de</span> Salouel',
      subtitle: 'Salouel · Centre-ville · Course FSGT 1re–3e cat',
      chapter: 'Événement à venir · Course',
      description: 'Course FSGT sur circuit ville. 1re, 2e, 3e catégories. 65 km, départ 13 h 30. Organisation C.C.S.. Parcours sinueux dans le centre de Salouel, ambiance kermesse.',
      date: '2025-07-06',
      date_label: 'Dimanche 6 juillet 2025',
      distance_km: 65,
      duration_label: '2h15',
      elevation_gain: 120,
      elevation_loss: 120,
      elevation_max: 80,
      elevation_min: 55,
      tss: null, np_w: null,
      tags: [
        { type: 'plain', label: 'À venir' },
        { type: 'date',  label: 'Dimanche 6 juillet 2025' },
        { type: 'brass', label: 'Course' }
      ],
      hero_img: 'asset/img/hero-peloton.svg',
      card_img: 'asset/img/hero-peloton.svg',
      location: { name: 'Salouel', lat: 49.8577, lng: 2.2347 },
      gpx_ref: 'grand-prix-salouel.gpx',
      number: null,
      stats_extra: [
        { label: 'Distance', value: '65', unit: 'km' },
        { label: 'Départ',   value: '13h30' }
      ],
      segments: []
    },

    {
      id: 'rando-3-provinces-2025-09-14',
      slug: 'rando-3-provinces',
      title: 'Rando des 3 Provinces',
      title_html: 'Rando <span class="it">des</span> 3 Provinces',
      subtitle: 'Maroilles · Avesnois · 45 / 80 / 120 km',
      chapter: 'Événement à venir · Randonnée',
      description: 'Randonnée ouverte à tous au départ de Maroilles. Trois parcours : 45, 80 ou 120 km à travers les paysages bocagers de l\'Avesnois. Départ échelonné dès 8 h 00.',
      date: '2025-09-14',
      date_label: 'Dimanche 14 septembre 2025',
      distance_km: 120,
      duration_label: '5h00',
      elevation_gain: 1600,
      elevation_loss: 1600,
      elevation_max: 200,
      elevation_min: 95,
      tss: null, np_w: null,
      tags: [
        { type: 'plain', label: 'À venir' },
        { type: 'date',  label: 'Dimanche 14 septembre 2025' },
        { type: 'brass', label: 'Rando' }
      ],
      hero_img: 'asset/img/hero-monts.svg',
      card_img: 'asset/img/hero-monts.svg',
      location: { name: 'Maroilles', lat: 50.1268, lng: 3.7641 },
      gpx_ref: 'avesnois.gpx',
      number: null,
      stats_extra: [
        { label: 'Parcours', value: '3',   cls: 'brass' },
        { label: 'Max',      value: '120', unit: 'km' }
      ],
      segments: []
    },

    /* ─── Courses Hauts-de-France 2026 (auto-générées) ─── */
    {
      id: "paris-roubaix-challenge",
      chapter: "Cyclosportive officielle",
      title: "Paris-Roubaix Challenge",
      title_html: "Paris-Roubaix <span class=\"it\">Challenge</span>",
      subtitle: "Cyclosportive officielle · 30 secteurs pavés",
      date: "2026-04-11",
      date_label: "Samedi 11 avril 2026",
      duration: "6 h 30",
      duration_label: "6 h 30",
      kind: "cyclosportive",
      distance_km: 172,
      elevation_gain: 70,
      pave_km: 55,
      tags: [{"type":"plain","label":"Cyclosportive 2026"},{"type":"date","label":"Samedi 11 avril"},{"type":"brass","label":"30 secteurs pavés"}],
      hero_img: 'asset/img/hero-pave.svg',
      card_img: 'asset/img/hero-pave.svg',
      location: { name: "Busigny → Roubaix", lat: 50.0402, lng: 3.4528 },
      gpx_ref: "paris-roubaix-challenge.gpx",
      number: null,
      stats_extra: [{"label":"Pavé","value":"55","unit":"km"},{"label":"Secteurs","value":"30"},{"label":"Inscrits","value":"6500"}],
      segments: [],
      statut: "future",
      region: "Nord (59)"
    },
    {
      id: "enfer-des-flandres",
      chapter: "Cyclosportive",
      title: "L'Enfer des Flandres",
      title_html: "L'Enfer <span class=\"it\">des</span> Flandres",
      subtitle: "Cyclosportive · monts flamands",
      date: "2026-06-14",
      date_label: "Dimanche 14 juin 2026",
      duration: "5 h 45",
      duration_label: "5 h 45",
      kind: "cyclosportive",
      distance_km: 157,
      elevation_gain: 1850,
      tags: [{"type":"plain","label":"Cyclosportive"},{"type":"date","label":"Dimanche 14 juin"},{"type":"brass","label":"Monts flamands"}],
      hero_img: 'asset/img/hero-monts.svg',
      card_img: 'asset/img/hero-monts.svg',
      location: { name: "Cassel", lat: 50.8011, lng: 2.4847 },
      gpx_ref: "enfer-des-flandres.gpx",
      number: null,
      stats_extra: [{"label":"Monts","value":"5"},{"label":"Kemmel","value":"22 %","unit":"max"}],
      segments: [],
      statut: "future",
      region: "Nord (59) · Flandre"
    },
    {
      id: "lille-hardelot",
      chapter: "Randonnée",
      title: "Lille-Hardelot",
      title_html: "Lille — <span class=\"it\">Hardelot</span>",
      subtitle: "Randonnée · ligne droite vers la mer",
      date: "2026-06-08",
      date_label: "Lundi 8 juin 2026",
      duration: "7 h 30",
      duration_label: "7 h 30",
      kind: "rando",
      distance_km: 200,
      elevation_gain: 580,
      tags: [{"type":"plain","label":"32e édition"},{"type":"date","label":"Lundi 8 juin"},{"type":"brass","label":"Pelotons de 50"}],
      hero_img: 'asset/img/hero-cote.svg',
      card_img: 'asset/img/hero-cote.svg',
      location: { name: "Lille → Hardelot", lat: 50.6328, lng: 3.0597 },
      gpx_ref: "lille-hardelot.gpx",
      number: null,
      stats_extra: [{"label":"Inscrits","value":"4200"},{"label":"Mer","value":"Hardelot-Plage"}],
      segments: [],
      statut: "future",
      region: "Nord → Pas-de-Calais"
    },
    {
      id: "picarde-amienoise",
      chapter: "Cyclosportive UFOLEP",
      title: "La Picarde Amiénoise",
      title_html: "La Picarde <span class=\"it\">Amiénoise</span>",
      subtitle: "Cyclosportive UFOLEP · Hortillonnages → Baie de Somme",
      date: "2026-05-25",
      date_label: "Dimanche 25 mai 2026",
      duration: "4 h 15",
      duration_label: "4 h 15",
      kind: "cyclosportive",
      distance_km: 112,
      elevation_gain: 720,
      tags: [{"type":"plain","label":"UFOLEP"},{"type":"date","label":"Dimanche 25 mai"},{"type":"brass","label":"Baie de Somme"}],
      hero_img: 'asset/img/hero-route.svg',
      card_img: 'asset/img/hero-route.svg',
      location: { name: "Amiens", lat: 49.8994, lng: 2.3022 },
      gpx_ref: "picarde-amienoise.gpx",
      number: null,
      stats_extra: [{"label":"Parcours","value":"3","unit":"au choix"},{"label":"Engagement","value":"22","unit":"€"}],
      segments: [],
      statut: "future",
      region: "Somme (80)"
    },
    {
      id: "gp-fourmies-amateur",
      chapter: "Course FFC",
      title: "GP Fourmies Amateur",
      title_html: "GP <span class=\"it\">de</span> Fourmies Amateur",
      subtitle: "Course FFC élite régionale · veille de l'épreuve pro",
      date: "2026-09-06",
      date_label: "Dimanche 6 septembre 2026",
      duration: "4 h 00",
      duration_label: "4 h 00",
      kind: "course",
      distance_km: 145,
      elevation_gain: 1100,
      tags: [{"type":"plain","label":"FFC élite"},{"type":"date","label":"Dimanche 6 sept."},{"type":"brass","label":"12 tours"}],
      hero_img: 'asset/img/hero-peloton.svg',
      card_img: 'asset/img/hero-peloton.svg',
      location: { name: "Fourmies", lat: 50.0181, lng: 4.05 },
      gpx_ref: "gp-fourmies-amateur.gpx",
      number: null,
      stats_extra: [{"label":"Tours","value":"12 × 12,1 km"},{"label":"Cat.","value":"Élite régionale"}],
      segments: [],
      statut: "future",
      region: "Nord (59) · Avesnois"
    },
    {
      id: "cyclo-baie-de-somme",
      chapter: "Randonnée",
      title: "Cyclo de la Baie de Somme",
      title_html: "Cyclo <span class=\"it\">de la</span> Baie de Somme",
      subtitle: "Randonnée · côte picarde · phoques au Hourdel",
      date: "2026-08-30",
      date_label: "Dimanche 30 août 2026",
      duration: "3 h 30",
      duration_label: "3 h 30",
      kind: "rando",
      distance_km: 90,
      elevation_gain: 280,
      tags: [{"type":"plain","label":"Rando familiale"},{"type":"date","label":"Dimanche 30 août"},{"type":"brass","label":"Vue mer"}],
      hero_img: 'asset/img/hero-cote.svg',
      card_img: 'asset/img/hero-cote.svg',
      location: { name: "Saint-Valery-sur-Somme", lat: 50.1847, lng: 1.6333 },
      gpx_ref: "cyclo-baie-de-somme.gpx",
      number: null,
      stats_extra: [{"label":"Boucles","value":"3","unit":"au choix"},{"label":"Engagement","value":"15","unit":"€"}],
      segments: [],
      statut: "future",
      region: "Somme (80)"
    },
    {
      id: "6h-velo-pas-de-calais",
      chapter: "Course endurance",
      title: "6 Heures Vélo du Pas-de-Calais",
      title_html: "6 Heures <span class=\"it\">Vélo</span> du Pas-de-Calais",
      subtitle: "Course endurance · circuit fermé Croix-en-Ternois",
      date: "2026-05-08",
      date_label: "Vendredi 8 mai 2026",
      duration: "6 h 00",
      duration_label: "6 h 00",
      kind: "course",
      distance_km: 168,
      elevation_gain: 1200,
      tags: [{"type":"plain","label":"Endurance"},{"type":"date","label":"Vendredi 8 mai"},{"type":"brass","label":"6 h non-stop"}],
      hero_img: 'asset/img/hero-peloton.svg',
      card_img: 'asset/img/hero-peloton.svg',
      location: { name: "Croix-en-Ternois", lat: 50.4064, lng: 2.2183 },
      gpx_ref: "6h-velo-pas-de-calais.gpx",
      number: null,
      stats_extra: [{"label":"Format","value":"6 h max tours"},{"label":"Circuit","value":"4,2","unit":"km"}],
      segments: [],
      statut: "future",
      region: "Pas-de-Calais (62)"
    },
    {
      id: "open-gravel-eperlecques",
      chapter: "Gravel",
      title: "Open de Gravel d'Éperlecques",
      title_html: "Open <span class=\"it\">Gravel</span> d'Éperlecques",
      subtitle: "Gravel · forêt domaniale",
      date: "2026-05-14",
      date_label: "Jeudi 14 mai 2026",
      duration: "3 h 30",
      duration_label: "3 h 30",
      kind: "gravel",
      distance_km: 84,
      elevation_gain: 420,
      tags: [{"type":"plain","label":"Gravel"},{"type":"date","label":"Jeudi 14 mai"},{"type":"brass","label":"Forêt domaniale"}],
      hero_img: 'asset/img/hero-gravel.svg',
      card_img: 'asset/img/hero-gravel.svg',
      location: { name: "Éperlecques", lat: 50.7936, lng: 2.1628 },
      gpx_ref: "open-gravel-eperlecques.gpx",
      number: null,
      stats_extra: [{"label":"Parcours","value":"40/63/84","unit":"km"},{"label":"Sentier","value":"60","unit":"%"}],
      segments: [],
      statut: "future",
      region: "Pas-de-Calais (62)"
    },
    {
      id: "rando-muguet-choisy",
      chapter: "Randonnée",
      title: "Randonnée du Muguet",
      title_html: "Randonnée <span class=\"it\">du</span> Muguet",
      subtitle: "Rando familiale · forêt de Compiègne",
      date: "2026-04-26",
      date_label: "Dimanche 26 avril 2026",
      duration: "4 h 30",
      duration_label: "4 h 30",
      kind: "rando",
      distance_km: 110,
      elevation_gain: 580,
      tags: [{"type":"plain","label":"Rando familiale"},{"type":"date","label":"Dimanche 26 avril"},{"type":"brass","label":"Forêt"}],
      hero_img: 'asset/img/hero-gravel.svg',
      card_img: 'asset/img/hero-gravel.svg',
      location: { name: "Choisy-au-Bac", lat: 49.43, lng: 2.8581 },
      gpx_ref: "rando-muguet-choisy.gpx",
      number: null,
      stats_extra: [{"label":"Parcours","value":"6/12/.../110","unit":"km"},{"label":"Engagement","value":"5","unit":"€"}],
      segments: [],
      statut: "future",
      region: "Oise (60)"
    },

    /* ─── Courses HdF 2026 — vague 2 (auto-générées) ─── */
    {
      id: "race-across-paris",
      chapter: "Ultra-distance",
      title: "Race Across Paris",
      title_html: "Race <span class=\"it\">Across</span> Paris",
      subtitle: "Ultra-distance · 4 parcours · 200 à 1000 km",
      date: "2026-04-22",
      date_label: "Du 22 au 26 avril 2026",
      duration: "8 h 30",
      duration_label: "8 h 30",
      kind: "cyclosportive",
      distance_km: 200,
      elevation_gain: 145,
      tags: [{"type":"plain","label":"Ultra"},{"type":"date","label":"22-26 avril 2026"},{"type":"brass","label":"200/300/500/1000 km"}],
      hero_img: 'asset/img/hero-route.svg',
      card_img: 'asset/img/hero-route.svg',
      location: { name: "Hippodrome de Chantilly", lat: 49.1939, lng: 2.465 },
      gpx_ref: "race-across-paris.gpx",
      number: null,
      stats_extra: [{"label":"Format","value":"Non-stop"},{"label":"Engagement","value":"119","unit":"€"}],
      segments: [],
      statut: "future",
      region: "Oise (60)"
    },
    {
      id: "roc-d-opale",
      chapter: "Cyclosportive",
      title: "Roc d'Opale",
      title_html: "Roc <span class=\"it\">d'</span>Opale",
      subtitle: "Boucle Côte d'Opale · Caps Blanc-Nez et Gris-Nez",
      date: "2026-06-21",
      date_label: "Dimanche 21 juin 2026",
      duration: "4 h 30",
      duration_label: "4 h 30",
      kind: "cyclosportive",
      distance_km: 111,
      elevation_gain: 215,
      tags: [{"type":"plain","label":"Côte d'Opale"},{"type":"date","label":"Dimanche 21 juin"},{"type":"brass","label":"Caps + falaises"}],
      hero_img: 'asset/img/hero-cote.svg',
      card_img: 'asset/img/hero-cote.svg',
      location: { name: "Calais", lat: 50.9513, lng: 1.8587 },
      gpx_ref: "roc-d-opale.gpx",
      number: null,
      stats_extra: [{"label":"Parcours","value":"6","unit":"au choix"},{"label":"Engagement","value":"4","unit":"€"}],
      segments: [],
      statut: "future",
      region: "Pas-de-Calais (62)"
    },
    {
      id: "callys-gravel",
      chapter: "Gravel",
      title: "La Cal'lys Gravel",
      title_html: "La <span class=\"it\">Cal'lys</span> Gravel",
      subtitle: "Gravel littoral · falaises et forêt",
      date: "2026-04-19",
      date_label: "Dimanche 19 avril 2026",
      duration: "4 h 00",
      duration_label: "4 h 00",
      kind: "gravel",
      distance_km: 80,
      elevation_gain: 120,
      tags: [{"type":"plain","label":"Gravel"},{"type":"date","label":"Dimanche 19 avril"},{"type":"brass","label":"4 distances"}],
      hero_img: 'asset/img/hero-gravel.svg',
      card_img: 'asset/img/hero-gravel.svg',
      location: { name: "Sangatte", lat: 50.9436, lng: 1.7481 },
      gpx_ref: "callys-gravel.gpx",
      number: null,
      stats_extra: [{"label":"Parcours","value":"80/120/200/300","unit":"km"},{"label":"Sentier","value":"70","unit":"%"}],
      segments: [],
      statut: "future",
      region: "Pas-de-Calais (62)"
    },
    {
      id: "rives-authie",
      chapter: "Randonnée",
      title: "Les Rives de l'Authie",
      title_html: "Les Rives <span class=\"it\">de l'</span>Authie",
      subtitle: "Randonnée · vallée de l'Authie",
      date: "2026-05-10",
      date_label: "Dimanche 10 mai 2026",
      duration: "3 h 30",
      duration_label: "3 h 30",
      kind: "rando",
      distance_km: 90,
      elevation_gain: 55,
      tags: [{"type":"plain","label":"Rando"},{"type":"date","label":"Dimanche 10 mai"},{"type":"brass","label":"7 parcours"}],
      hero_img: 'asset/img/hero-route.svg',
      card_img: 'asset/img/hero-route.svg',
      location: { name: "Berck-sur-Mer", lat: 50.405, lng: 1.5581 },
      gpx_ref: "rives-authie.gpx",
      number: null,
      stats_extra: [{"label":"Parcours","value":"23 à 90","unit":"km"},{"label":"Engagement","value":"5","unit":"€"}],
      segments: [],
      statut: "future",
      region: "Pas-de-Calais (62)"
    },
    {
      id: "ardresienne",
      chapter: "Randonnée",
      title: "L'Ardrésienne",
      title_html: "L'<span class=\"it\">Ardr</span>ésienne",
      subtitle: "Randonnée · marais de l'Aa",
      date: "2026-05-17",
      date_label: "Dimanche 17 mai 2026",
      duration: "2 h 45",
      duration_label: "2 h 45",
      kind: "rando",
      distance_km: 70,
      elevation_gain: 95,
      tags: [{"type":"plain","label":"Familiale"},{"type":"date","label":"Dimanche 17 mai"},{"type":"brass","label":"8 distances"}],
      hero_img: 'asset/img/hero-route.svg',
      card_img: 'asset/img/hero-route.svg',
      location: { name: "Ardres", lat: 50.8563, lng: 1.975 },
      gpx_ref: "ardresienne.gpx",
      number: null,
      stats_extra: [{"label":"Parcours","value":"7 à 70","unit":"km"},{"label":"Engagement","value":"4","unit":"€"}],
      segments: [],
      statut: "future",
      region: "Pas-de-Calais (62)"
    },
    {
      id: "fete-velo-7-vallees",
      chapter: "Randonnée",
      title: "Fête du Vélo en 7 Vallées",
      title_html: "Fête <span class=\"it\">du Vélo</span> en 7 Vallées",
      subtitle: "Randonnée · Hesdin et Canche",
      date: "2026-05-24",
      date_label: "Dimanche 24 mai 2026",
      duration: "3 h 15",
      duration_label: "3 h 15",
      kind: "rando",
      distance_km: 80,
      elevation_gain: 65,
      tags: [{"type":"plain","label":"Familiale"},{"type":"date","label":"Dimanche 24 mai"},{"type":"brass","label":"3 distances"}],
      hero_img: 'asset/img/hero-route.svg',
      card_img: 'asset/img/hero-route.svg',
      location: { name: "Beaurainville", lat: 50.4383, lng: 1.8961 },
      gpx_ref: "fete-velo-7-vallees.gpx",
      number: null,
      stats_extra: [{"label":"Parcours","value":"31/61/80","unit":"km"},{"label":"Engagement","value":"Gratuit"}],
      segments: [],
      statut: "future",
      region: "Pas-de-Calais (62)"
    },
    {
      id: "cap-gris-nez",
      chapter: "Randonnée",
      title: "Sur la Route du Cap Gris-Nez",
      title_html: "Sur la Route <span class=\"it\">du</span> Cap Gris-Nez",
      subtitle: "Randonnée littorale · vue Angleterre",
      date: "2026-08-23",
      date_label: "Dimanche 23 août 2026",
      duration: "5 h 30",
      duration_label: "5 h 30",
      kind: "rando",
      distance_km: 150,
      elevation_gain: 222,
      tags: [{"type":"plain","label":"Côte d'Opale"},{"type":"date","label":"Dimanche 23 août"},{"type":"brass","label":"Vue Angleterre"}],
      hero_img: 'asset/img/hero-cote.svg',
      card_img: 'asset/img/hero-cote.svg',
      location: { name: "Saint-Omer", lat: 50.75, lng: 2.25 },
      gpx_ref: "cap-gris-nez.gpx",
      number: null,
      stats_extra: [{"label":"Parcours","value":"8","unit":"au choix"},{"label":"Engagement","value":"3","unit":"€"}],
      segments: [],
      statut: "future",
      region: "Pas-de-Calais (62)"
    },
    {
      id: "oree-du-bois",
      chapter: "Randonnée",
      title: "Randonnée de l'Orée du Bois",
      title_html: "Randonnée <span class=\"it\">de l'</span>Orée du Bois",
      subtitle: "Randonnée · forêt de Crécy",
      date: "2026-08-09",
      date_label: "Dimanche 9 août 2026",
      duration: "3 h 30",
      duration_label: "3 h 30",
      kind: "rando",
      distance_km: 87,
      elevation_gain: 55,
      tags: [{"type":"plain","label":"Forêt"},{"type":"date","label":"Dimanche 9 août"},{"type":"brass","label":"Forêt de Crécy"}],
      hero_img: 'asset/img/hero-gravel.svg',
      card_img: 'asset/img/hero-gravel.svg',
      location: { name: "Rang-du-Fliers", lat: 50.39, lng: 1.65 },
      gpx_ref: "oree-du-bois.gpx",
      number: null,
      stats_extra: [{"label":"Parcours","value":"6","unit":"au choix"},{"label":"Engagement","value":"5","unit":"€"}],
      segments: [],
      statut: "future",
      region: "Pas-de-Calais (62)"
    },
    {
      id: "rando-nacree",
      chapter: "Randonnée familiale",
      title: "La Rando Nacrée",
      title_html: "La <span class=\"it\">Rando</span> Nacrée",
      subtitle: "Randonnée familiale · forêt de Carnelle",
      date: "2026-05-31",
      date_label: "Dimanche 31 mai 2026",
      duration: "2 h 15",
      duration_label: "2 h 15",
      kind: "rando",
      distance_km: 50,
      elevation_gain: 50,
      tags: [{"type":"plain","label":"Familiale"},{"type":"date","label":"Dimanche 31 mai"},{"type":"brass","label":"Forêt"}],
      hero_img: 'asset/img/hero-gravel.svg',
      card_img: 'asset/img/hero-gravel.svg',
      location: { name: "Esches", lat: 49.2167, lng: 2.1333 },
      gpx_ref: "rando-nacree.gpx",
      number: null,
      stats_extra: [{"label":"Parcours","value":"50","unit":"km"},{"label":"Engagement","value":"Gratuit"}],
      segments: [],
      statut: "future",
      region: "Oise (60)"
    },
    {
      id: "4-jours-dunkerque",
      chapter: "Course UCI",
      title: "4 Jours de Dunkerque",
      title_html: "4 Jours <span class=\"it\">de</span> Dunkerque",
      subtitle: "Course professionnelle · 4 étapes",
      date: "2026-05-12",
      date_label: "Du 12 au 17 mai 2026",
      duration: "4 h 00",
      duration_label: "4 h 00",
      kind: "course",
      distance_km: 150,
      elevation_gain: 112,
      tags: [{"type":"plain","label":"UCI 2.1"},{"type":"date","label":"12-17 mai 2026"},{"type":"brass","label":"4 étapes"}],
      hero_img: 'asset/img/hero-peloton.svg',
      card_img: 'asset/img/hero-peloton.svg',
      location: { name: "Dunkerque", lat: 51.0422, lng: 2.377 },
      gpx_ref: "4-jours-dunkerque.gpx",
      number: null,
      stats_extra: [{"label":"Format","value":"4 étapes"},{"label":"Catégorie","value":"Pro"}],
      segments: [],
      statut: "future",
      region: "Nord (59)"
    }
  ];

  window.CCS_STATIC.pois = {
    'arenberg-2025-04-05': [
      { id: 'pr-1', type: 'depart',    label: 'Départ — Compiègne',           desc: 'Place du Général de Gaulle',             km: 0,    lat: 49.4179, lng: 2.8262 },
      { id: 'pr-2', type: 'signaleur', label: 'Signaleur — Intersection D38', desc: 'Sortie Compiègne · carrefour principal', km: 8.2,  lat: 49.4055, lng: 2.9123, contact: { name: 'Dupont Marc',    phone: '06 12 34 56 78' } },
      { id: 'pr-3', type: 'ravito',    label: 'Ravitaillement n°1',           desc: 'Bidons · barres · fruits',               km: 45,   lat: 49.6231, lng: 3.1089 },
      { id: 'pr-4', type: 'secteur',   label: "Trouée d'Arenberg",            desc: '2,4 km de pavé 5 étoiles en forêt',      km: 95.8, lat: 50.4351, lng: 3.2481 },
      { id: 'pr-5', type: 'signaleur', label: 'Signaleur — Entrée Arenberg',  desc: 'Sécurisation entrée secteur pavé',       km: 95.6, lat: 50.4328, lng: 3.2471, contact: { name: 'Scotte Julien',   phone: '06 09 78 37 72' } },
      { id: 'pr-6', type: 'danger',    label: 'Danger — Virage pavé glissant', desc: 'Chute fréquente en sortie Arenberg',    km: 98.4, lat: 50.4222, lng: 3.2601 },
      { id: 'pr-7', type: 'ravito',    label: 'Ravitaillement n°2',           desc: 'Eau · coca · gels',                      km: 120,  lat: 50.5102, lng: 3.2989 },
      { id: 'pr-8', type: 'secteur',   label: "Carrefour de l'Arbre",         desc: '1,6 km avant-dernier secteur pavé',     km: 152.4, lat: 50.5685, lng: 3.1892 },
      { id: 'pr-9', type: 'signaleur', label: "Signaleur — Carrefour Arbre",  desc: "Intersection route d'accès spectateurs", km: 152.2, lat: 50.5680, lng: 3.1880, contact: { name: 'Sert Claude',     phone: '06 09 78 37 72' } },
      { id: 'pr-10',type: 'arrivee',   label: 'Arrivée — Vélodrome',          desc: 'André-Pétrieux · ligne mythique',        km: 172,  lat: 50.6903, lng: 3.1715 }
    ],

    'monts-flandres-2025-03-28': [
      { id: 'mf-1', type: 'depart',    label: 'Départ — Cassel',               desc: 'Place du Général de Gaulle, Cassel',     km: 0,    lat: 50.8012, lng: 2.4854 },
      { id: 'mf-2', type: 'signaleur', label: 'Signaleur — Sortie Cassel',     desc: 'Carrefour D933 / D948',                  km: 2.8,  lat: 50.7912, lng: 2.5054, contact: { name: 'Bailleul Claire', phone: '06 22 14 89 03' } },
      { id: 'mf-3', type: 'secteur',   label: 'Mont des Cats',                 desc: '1,1 km · 7,2 % moyen · pavé sommet',     km: 28.5, lat: 50.7806, lng: 2.7286 },
      { id: 'mf-4', type: 'ravito',    label: 'Ravitaillement — Mont des Cats',desc: 'Abbaye · eau · barres',                  km: 29.0, lat: 50.7820, lng: 2.7295 },
      { id: 'mf-5', type: 'secteur',   label: 'Mont Noir',                     desc: '900 m · 6,8 % moyen',                    km: 29.8, lat: 50.7700, lng: 2.7158 },
      { id: 'mf-6', type: 'secteur',   label: 'Kemmelberg',                    desc: '800 m · 9,4 % moyen · pavé · 22 % max',  km: 39.7, lat: 50.7878, lng: 2.8255 },
      { id: 'mf-7', type: 'signaleur', label: 'Signaleur — Bailleul',          desc: 'Traversée centre-ville',                 km: 52.2, lat: 50.7398, lng: 2.7339, contact: { name: 'Lemaire Antoine',  phone: '06 09 78 37 72' } },
      { id: 'mf-8', type: 'danger',    label: 'Danger — Descente Boeschepe',   desc: 'Pavé glissant · gravillons',             km: 60.5, lat: 50.8131, lng: 2.7242 },
      { id: 'mf-9', type: 'arrivee',   label: 'Arrivée — Cassel',              desc: 'Retour place du Général de Gaulle',      km: 77,   lat: 50.8012, lng: 2.4854 }
    ],

    'avesnois-2025-03-15': [
      { id: 'av-1', type: 'depart',    label: 'Départ — Maroilles',            desc: 'Place de la Mairie',                     km: 0,    lat: 50.1268, lng: 3.7641 },
      { id: 'av-2', type: 'signaleur', label: 'Signaleur — Sortie Maroilles',  desc: 'D959 direction Avesnes',                 km: 3.4,  lat: 50.1355, lng: 3.7421, contact: { name: 'Carpentier Sophie', phone: '06 14 22 89 03' } },
      { id: 'av-3', type: 'ravito',    label: 'Ravitaillement — Avesnes',      desc: 'Place du Général Leclerc',               km: 23.1, lat: 50.1242, lng: 3.9314 },
      { id: 'av-4', type: 'secteur',   label: 'Côte de Trélon',                desc: '1,1 km · 5,4 % moyen',                   km: 38.1, lat: 50.0506, lng: 4.1058 },
      { id: 'av-5', type: 'secteur',   label: 'Mur de Liessies',               desc: '600 m · 9,8 % moyen · 14 % max',         km: 48.2, lat: 50.0844, lng: 4.0681 },
      { id: 'av-6', type: 'ravito',    label: 'Ravitaillement — Solre',        desc: 'Solre-le-Château · pause longue',        km: 56.0, lat: 50.1797, lng: 4.0922 },
      { id: 'av-7', type: 'secteur',   label: 'Côte de Sars-Poteries',         desc: '1,4 km · 6,2 % moyen',                   km: 64.8, lat: 50.1958, lng: 3.9522 },
      { id: 'av-8', type: 'danger',    label: 'Danger — Descente Sars',        desc: 'Virage serré en bas de descente',        km: 67.2, lat: 50.1822, lng: 3.9388 },
      { id: 'av-9', type: 'arrivee',   label: 'Arrivée — Maroilles',           desc: 'Retour place de la Mairie',              km: 114,  lat: 50.1268, lng: 3.7641 }
    ],

    'scarpe-gravel-2025-03-02': [
      { id: 'sg-1', type: 'depart',    label: 'Départ — Saint-Amand',          desc: 'Tour Abbatiale · centre-ville',          km: 0,    lat: 50.4461, lng: 3.4278 },
      { id: 'sg-2', type: 'signaleur', label: 'Signaleur — Entrée forêt',      desc: 'Carrefour D169 / chemin du Mortier',     km: 4.8,  lat: 50.4322, lng: 3.4612, contact: { name: 'Deprez Romain',    phone: '06 33 21 78 02' } },
      { id: 'sg-3', type: 'secteur',   label: 'Traverse du Mortier',           desc: '2,8 km de chemin forestier roulant',     km: 18.4, lat: 50.4156, lng: 3.4982 },
      { id: 'sg-4', type: 'ravito',    label: 'Ravitaillement — Mont Bruyères',desc: 'Point haut · eau · barres',              km: 33.1, lat: 50.4084, lng: 3.5172 },
      { id: 'sg-5', type: 'secteur',   label: 'Mont des Bruyères',             desc: '1,1 km · 4,8 % moyen · sentier',         km: 33.5, lat: 50.4080, lng: 3.5180 },
      { id: 'sg-6', type: 'danger',    label: 'Danger — Souches racines',      desc: 'Layon technique sur 200 m',              km: 42.1, lat: 50.3954, lng: 3.5021 },
      { id: 'sg-7', type: 'secteur',   label: 'Layon de la Princesse',         desc: '1,9 km · sentier sablonneux',            km: 47.8, lat: 50.4012, lng: 3.4742 },
      { id: 'sg-8', type: 'signaleur', label: 'Signaleur — Mortagne',          desc: 'Traversée village',                      km: 60.5, lat: 50.5089, lng: 3.4517, contact: { name: 'Sert Claude',      phone: '06 09 78 37 72' } },
      { id: 'sg-9', type: 'arrivee',   label: 'Arrivée — Saint-Amand',         desc: 'Retour Tour Abbatiale',                  km: 68,   lat: 50.4461, lng: 3.4278 }
    ],

    'opale-2025-02-22': [
      { id: 'co-1', type: 'depart',    label: 'Départ — Boulogne',             desc: 'Port · Quai Gambetta',                   km: 0,    lat: 50.7264, lng: 1.6068 },
      { id: 'co-2', type: 'secteur',   label: 'Côte de Wimereux',              desc: '900 m · 6,1 % moyen · vue mer',          km: 8.4,  lat: 50.7656, lng: 1.6094 },
      { id: 'co-3', type: 'signaleur', label: 'Signaleur — Audresselles',      desc: 'Carrefour D940 · place village',         km: 17.3, lat: 50.8199, lng: 1.5867, contact: { name: 'Dupont Marc',      phone: '06 12 34 56 78' } },
      { id: 'co-4', type: 'ravito',    label: 'Ravitaillement — Audinghen',    desc: 'Place du marché · pause photo',          km: 24.4, lat: 50.8550, lng: 1.6128 },
      { id: 'co-5', type: 'danger',    label: 'Danger — Vent latéral Wissant', desc: 'Bord de mer exposé · prudence',          km: 30.7, lat: 50.8869, lng: 1.6603 },
      { id: 'co-6', type: 'secteur',   label: 'Cap Gris-Nez · ascension',      desc: '1,6 km · 5,2 % · falaise',               km: 42.9, lat: 50.8716, lng: 1.5851 },
      { id: 'co-7', type: 'ravito',    label: 'Ravitaillement — Marquise',     desc: 'Pause longue · cafés ouverts',           km: 62.0, lat: 50.8158, lng: 1.7064 },
      { id: 'co-8', type: 'secteur',   label: "Mont d'Hubert",                 desc: '1,2 km · 5,8 % · retour intérieur',      km: 78.1, lat: 50.7892, lng: 1.6822 },
      { id: 'co-9', type: 'arrivee',   label: 'Arrivée — Boulogne port',       desc: 'Retour Quai Gambetta',                   km: 103,  lat: 50.7264, lng: 1.6068 }
    ],

    'cambresis-2025-02-08': [
      { id: 'cb-1', type: 'depart',    label: 'Départ — Cambrai',              desc: 'Place Aristide Briand',                  km: 0,    lat: 50.1763, lng: 3.2350 },
      { id: 'cb-2', type: 'signaleur', label: 'Signaleur — Sortie Cambrai',    desc: 'Rocade est · carrefour D643',            km: 4.2,  lat: 50.1654, lng: 3.2722, contact: { name: 'Bailleul Claire',  phone: '06 22 14 89 03' } },
      { id: 'cb-3', type: 'ravito',    label: 'Ravitaillement — Caudry',       desc: 'Place du marché',                        km: 22.8, lat: 50.1247, lng: 3.4108 },
      { id: 'cb-4', type: 'secteur',   label: 'Bosse du Cateau',               desc: '1,4 km · 3,8 % moyen',                   km: 38.7, lat: 50.0975, lng: 3.5450 },
      { id: 'cb-5', type: 'ravito',    label: 'Ravitaillement — Solesmes',     desc: 'Pause relais · café',                    km: 50.1, lat: 50.1881, lng: 3.4956 },
      { id: 'cb-6', type: 'secteur',   label: 'Ligne droite de Solesmes',      desc: '4,2 km plat · relais venté',             km: 52.4, lat: 50.1922, lng: 3.4622 },
      { id: 'cb-7', type: 'danger',    label: 'Danger — Vent traversier',      desc: 'Plateau ouvert sur 8 km',                km: 70.3, lat: 50.1844, lng: 3.3422 },
      { id: 'cb-8', type: 'arrivee',   label: 'Arrivée — Cambrai',             desc: 'Retour Place Aristide Briand',           km: 98,   lat: 50.1763, lng: 3.2350 }
    ],

    'pevele-2025-01-26': [
      { id: 'pv-1', type: 'depart',    label: 'Départ — Orchies',              desc: 'Place de la République',                 km: 0,    lat: 50.4719, lng: 3.2419 },
      { id: 'pv-2', type: 'signaleur', label: 'Signaleur — Sortie Orchies',    desc: 'D549 vers Mons-en-Pévèle',               km: 4.1,  lat: 50.4762, lng: 3.1981, contact: { name: 'Scotte Julien',    phone: '06 09 78 37 72' } },
      { id: 'pv-3', type: 'secteur',   label: 'Mons-en-Pévèle',                desc: '3,0 km · pavé 5 étoiles',                km: 24.3, lat: 50.4892, lng: 3.0972 },
      { id: 'pv-4', type: 'danger',    label: 'Danger — Sortie Mons',          desc: 'Virage pavé en descente',                km: 27.8, lat: 50.4912, lng: 3.0844 },
      { id: 'pv-5', type: 'ravito',    label: 'Ravitaillement — Pont-à-Marcq', desc: 'Place de la Mairie',                     km: 39.7, lat: 50.5189, lng: 3.1064 },
      { id: 'pv-6', type: 'secteur',   label: 'Auchy → Bersée',                desc: '2,7 km · pavé 3 étoiles',                km: 42.5, lat: 50.5252, lng: 3.1442 },
      { id: 'pv-7', type: 'secteur',   label: 'Camphin · pavé',                desc: '1,8 km · pavé 4 étoiles',                km: 51.4, lat: 50.5402, lng: 3.1881 },
      { id: 'pv-8', type: 'signaleur', label: 'Signaleur — Templeuve',         desc: 'Traversée centre',                       km: 53.3, lat: 50.5436, lng: 3.1633, contact: { name: 'Sert Claude',      phone: '06 09 78 37 72' } },
      { id: 'pv-9', type: 'arrivee',   label: 'Arrivée — Orchies',             desc: 'Retour place de la République',          km: 84,   lat: 50.4719, lng: 3.2419 }
    ],

    /* ─── Courses futures ─── */

    'scarpe-gravel-2025-04-27': [
      { id: 'sg2-1', type: 'depart',    label: 'Départ — Saint-Amand',          desc: 'Tour Abbatiale · 8h30',                  km: 0,    lat: 50.4461, lng: 3.4278 },
      { id: 'sg2-2', type: 'signaleur', label: 'Signaleur — Entrée Forêt',      desc: 'Carrefour D169',                          km: 4.8,  lat: 50.4322, lng: 3.4612, contact: { name: 'Deprez Romain',    phone: '06 33 21 78 02' } },
      { id: 'sg2-3', type: 'secteur',   label: 'Traverse du Mortier',           desc: '2,8 km de chemin forestier',             km: 18.4, lat: 50.4156, lng: 3.4982 },
      { id: 'sg2-4', type: 'ravito',    label: 'Ravitaillement Mont Bruyères',  desc: 'Point haut · eau · barres',              km: 33.1, lat: 50.4084, lng: 3.5172 },
      { id: 'sg2-5', type: 'secteur',   label: 'Mont des Bruyères',             desc: '1,1 km · 4,8 % moyen · sentier',         km: 33.5, lat: 50.4080, lng: 3.5180 },
      { id: 'sg2-6', type: 'danger',    label: 'Danger — Souches',              desc: 'Layon technique sur 200 m',              km: 42.1, lat: 50.3954, lng: 3.5021 },
      { id: 'sg2-7', type: 'secteur',   label: 'Layon de la Princesse',         desc: '1,9 km · sentier sablonneux',            km: 47.8, lat: 50.4012, lng: 3.4742 },
      { id: 'sg2-8', type: 'ravito',    label: 'Ravitaillement Mortagne',       desc: 'Place village · eau',                    km: 60.5, lat: 50.5089, lng: 3.4517 },
      { id: 'sg2-9', type: 'arrivee',   label: 'Arrivée — Saint-Amand',         desc: 'Retour Tour Abbatiale',                  km: 82,   lat: 50.4461, lng: 3.4278 }
    ],

    'ronde-monts-2025-05-18': [
      { id: 'rm-1', type: 'depart',    label: 'Départ — Cassel',                desc: 'Place Général de Gaulle · 9h00',         km: 0,    lat: 50.8012, lng: 2.4854 },
      { id: 'rm-2', type: 'signaleur', label: 'Signaleur — Sortie Cassel',      desc: 'D933',                                   km: 2.8,  lat: 50.7912, lng: 2.5054, contact: { name: 'Bailleul Claire',  phone: '06 22 14 89 03' } },
      { id: 'rm-3', type: 'secteur',   label: 'Mont des Cats',                  desc: '1,1 km · 7,2 % · sommet pavé',           km: 28.5, lat: 50.7806, lng: 2.7286 },
      { id: 'rm-4', type: 'ravito',    label: 'Ravitaillement Abbaye',          desc: 'Mont des Cats · pause longue',           km: 29.0, lat: 50.7820, lng: 2.7295 },
      { id: 'rm-5', type: 'secteur',   label: 'Mont Noir',                      desc: '900 m · 6,8 % moyen',                    km: 39.8, lat: 50.7700, lng: 2.7158 },
      { id: 'rm-6', type: 'secteur',   label: 'Kemmelberg',                     desc: '800 m · 9,4 % · pavé · 22 % max',        km: 49.7, lat: 50.7878, lng: 2.8255 },
      { id: 'rm-7', type: 'ravito',    label: 'Ravitaillement Bailleul',        desc: 'Centre-ville · km 60',                   km: 62.2, lat: 50.7398, lng: 2.7339 },
      { id: 'rm-8', type: 'danger',    label: 'Danger — Descente Boeschepe',    desc: 'Pavé glissant',                          km: 75.5, lat: 50.8131, lng: 2.7242 },
      { id: 'rm-9', type: 'arrivee',   label: 'Arrivée — Cassel',               desc: 'Retour Place Général de Gaulle',         km: 95,   lat: 50.8012, lng: 2.4854 }
    ],

    'criterium-salouel-2025-06-08': [
      { id: 'cs-1', type: 'depart',    label: 'Départ — av. de l\'Étoile',     desc: 'Z.I. Nord · 14h00 · ligne d\'arrivée',   km: 0,    lat: 49.86440, lng: 2.22650 },
      { id: 'cs-2', type: 'signaleur', label: 'Signaleur — Carrefour Paix',    desc: 'Sécurisation virage 1',                  km: 0.6,  lat: 49.86570, lng: 2.23120, contact: { name: 'Lemaire Antoine',  phone: '06 09 78 37 72' } },
      { id: 'cs-3', type: 'signaleur', label: 'Signaleur — Rond-point ZI',     desc: 'Point chaud du circuit',                 km: 1.2,  lat: 49.86250, lng: 2.23450, contact: { name: 'Scotte Julien',    phone: '06 09 78 37 72' } },
      { id: 'cs-4', type: 'danger',    label: 'Danger — Chicane',              desc: 'Virage serré, prudence en peloton',      km: 1.9,  lat: 49.85780, lng: 2.22810 },
      { id: 'cs-5', type: 'ravito',    label: 'Ravitaillement permanent',      desc: 'Stand bord ligne · bidons',              km: 0,    lat: 49.86440, lng: 2.22650 },
      { id: 'cs-6', type: 'arrivee',   label: 'Arrivée — Ligne ZI',            desc: '8 tours · sprint final av. Étoile',      km: 40,   lat: 49.86440, lng: 2.22650 }
    ],

    'championnat-ufolep-2025-06-15': [
      { id: 'ch-1', type: 'depart',    label: 'Départ — Orchies',               desc: 'Place de la République · 14h00',         km: 0,    lat: 50.4719, lng: 3.2419 },
      { id: 'ch-2', type: 'signaleur', label: 'Signaleur — Sortie Orchies',     desc: 'D549',                                   km: 4.1,  lat: 50.4762, lng: 3.1981, contact: { name: 'Carpentier Sophie', phone: '06 14 22 89 03' } },
      { id: 'ch-3', type: 'secteur',   label: 'Côte de Mons-en-Pévèle',         desc: '1,2 km · 4,5 % moyen',                   km: 18.0, lat: 50.4892, lng: 3.0972 },
      { id: 'ch-4', type: 'ravito',    label: 'Ravitaillement Pont-à-Marcq',    desc: 'Place de la Mairie · km 28',             km: 28.5, lat: 50.5189, lng: 3.1064 },
      { id: 'ch-5', type: 'signaleur', label: 'Signaleur — Templeuve',          desc: 'Traversée centre',                       km: 38.0, lat: 50.5436, lng: 3.1633, contact: { name: 'Sert Claude',      phone: '06 09 78 37 72' } },
      { id: 'ch-6', type: 'danger',    label: 'Danger — Virage Mons',           desc: 'Virage pavé glissant',                   km: 47.5, lat: 50.4912, lng: 3.0844 },
      { id: 'ch-7', type: 'arrivee',   label: 'Arrivée — Orchies',              desc: 'Place de la République',                 km: 58,   lat: 50.4719, lng: 3.2419 }
    ],

    'grand-prix-salouel-2025-07-06': [
      { id: 'gp-1', type: 'depart',    label: 'Départ — Place de l\'Église',   desc: 'Centre Salouel · 13h30',                  km: 0,    lat: 49.85770, lng: 2.23470 },
      { id: 'gp-2', type: 'signaleur', label: 'Signaleur — Rue République',    desc: 'Sécurisation premier virage',             km: 0.5,  lat: 49.86010, lng: 2.23950, contact: { name: 'Lemaire Antoine',  phone: '06 09 78 37 72' } },
      { id: 'gp-3', type: 'signaleur', label: 'Signaleur — Pont-de-Metz',      desc: 'Carrefour passage à niveau',              km: 1.5,  lat: 49.85850, lng: 2.24500, contact: { name: 'Scotte Julien',    phone: '06 09 78 37 72' } },
      { id: 'gp-4', type: 'ravito',    label: 'Ravitaillement permanent',      desc: 'Stand ligne d\'arrivée',                  km: 0,    lat: 49.85770, lng: 2.23470 },
      { id: 'gp-5', type: 'danger',    label: 'Danger — Boulevard Sud',        desc: 'Revêtement bosselé',                      km: 4.2,  lat: 49.85130, lng: 2.23720 },
      { id: 'gp-6', type: 'signaleur', label: 'Signaleur — Rond-point Bel-Air',desc: 'Carrefour critique',                      km: 5.0,  lat: 49.85320, lng: 2.23080, contact: { name: 'Bailleul Claire',  phone: '06 22 14 89 03' } },
      { id: 'gp-7', type: 'arrivee',   label: 'Arrivée — Sprint Église',       desc: '10 tours · ligne Place Église',           km: 65,   lat: 49.85770, lng: 2.23470 }
    ],

    'rando-3-provinces-2025-09-14': [
      { id: 'r3-1', type: 'depart',    label: 'Départ — Maroilles',             desc: 'Place de la Mairie · 8h00',              km: 0,    lat: 50.1268, lng: 3.7641 },
      { id: 'r3-2', type: 'signaleur', label: 'Signaleur — Sortie Maroilles',   desc: 'D959 vers Avesnes',                      km: 3.4,  lat: 50.1355, lng: 3.7421, contact: { name: 'Carpentier Sophie', phone: '06 14 22 89 03' } },
      { id: 'r3-3', type: 'ravito',    label: 'Ravitaillement Avesnes',         desc: 'Place du Général Leclerc',                km: 23.1, lat: 50.1242, lng: 3.9314 },
      { id: 'r3-4', type: 'secteur',   label: 'Côte de Trélon',                 desc: '1,1 km · 5,4 % moyen',                   km: 38.1, lat: 50.0506, lng: 4.1058 },
      { id: 'r3-5', type: 'secteur',   label: 'Mur de Liessies',                desc: '600 m · 9,8 % moyen · 14 % max',         km: 48.2, lat: 50.0844, lng: 4.0681 },
      { id: 'r3-6', type: 'ravito',    label: 'Ravitaillement Solre',           desc: 'Solre-le-Château · pause longue',         km: 56.0, lat: 50.1797, lng: 4.0922 },
      { id: 'r3-7', type: 'secteur',   label: 'Côte de Sars-Poteries',          desc: '1,4 km · 6,2 % moyen',                   km: 64.8, lat: 50.1958, lng: 3.9522 },
      { id: 'r3-8', type: 'danger',    label: 'Danger — Descente Sars',         desc: 'Virage serré bas de descente',           km: 67.2, lat: 50.1822, lng: 3.9388 },
      { id: 'r3-9', type: 'ravito',    label: 'Ravito Le Quesnoy',              desc: 'Place des Armes · km 90',                 km: 90.5, lat: 50.2461, lng: 3.6324 },
      { id: 'r3-10',type: 'arrivee',   label: 'Arrivée — Maroilles',            desc: 'Retour Place de la Mairie',              km: 120,  lat: 50.1268, lng: 3.7641 }
    ],

    /* ─── Courses Hauts-de-France 2026 (auto-générées) ─── */
    "paris-roubaix-challenge": [
      { id: "par-1", type: "depart", label: "Départ — Busigny", desc: "Place de la Mairie · 7h30", km: 0, lat: 50.04017, lng: 3.45278 },
      { id: "par-2", type: "secteur", label: "Troisvilles → Inchy", desc: "2,2 km · pavé 3★ (secteur 28)", km: 8.4, lat: 50.1025, lng: 3.40278 },
      { id: "par-3", type: "ravito", label: "Ravito — Saint-Python", desc: "Premier ravitaillement · km 35", km: 16.8, lat: 50.16361, lng: 3.435 },
      { id: "par-4", type: "secteur", label: "Solesmes → Saint-Python", desc: "1,7 km · pavé 3★ (secteur 26)", km: 22.4, lat: 50.17222, lng: 3.5125 },
      { id: "par-5", type: "secteur", label: "Vertain → Saint-Martin", desc: "2,3 km · pavé 3★ (secteur 25)", km: 25.5, lat: 50.2, lng: 3.51389 },
      { id: "par-6", type: "secteur", label: "Capelle → Ruesnes", desc: "1,7 km · pavé 3★", km: 29.1, lat: 50.23083, lng: 3.49917 },
      { id: "par-7", type: "secteur", label: "Quérénaing → Maing", desc: "2,5 km · pavé 3★", km: 34.9, lat: 50.25917, lng: 3.43056 },
      { id: "par-8", type: "ravito", label: "Ravito — Valenciennes", desc: "Place du marché · km 75", km: 46.9, lat: 50.345, lng: 3.32833 },
      { id: "par-9", type: "secteur", label: "Haveluy → Wallers", desc: "2,5 km · pavé 4★", km: 53.6, lat: 50.40472, lng: 3.34083 },
      { id: "par-10", type: "danger", label: "Danger — Entrée Arenberg", desc: "Réduction de vitesse obligatoire", km: 56.9, lat: 50.42528, lng: 3.30667 },
      { id: "par-11", type: "secteur", label: "Trouée d'Arenberg", desc: "2,3 km · pavé 5★ · forêt", km: 61.2, lat: 50.43472, lng: 3.24806 },
      { id: "par-12", type: "danger", label: "Danger — Sortie Arenberg", desc: "Pavé glissant en sortie", km: 62.8, lat: 50.42222, lng: 3.26 },
      { id: "par-13", type: "secteur", label: "Hornaing → Wandignies", desc: "3,7 km · pavé 4★", km: 68.2, lat: 50.46917, lng: 3.27778 },
      { id: "par-14", type: "ravito", label: "Ravito — Marchiennes", desc: "Place de la Mairie · km 110", km: 74.8, lat: 50.4875, lng: 3.18889 },
      { id: "par-15", type: "secteur", label: "Warlaing → Brillon", desc: "2,4 km · pavé 3★", km: 77.8, lat: 50.50972, lng: 3.21306 },
      { id: "par-16", type: "secteur", label: "Tilloy → Sars-et-Rosières", desc: "2,4 km · pavé 4★", km: 79.5, lat: 50.52472, lng: 3.205 },
      { id: "par-17", type: "secteur", label: "Beuvry → Orchies", desc: "1,4 km · pavé 3★", km: 81.9, lat: 50.54611, lng: 3.20194 },
      { id: "par-18", type: "secteur", label: "Auchy → Bersée", desc: "2,7 km · pavé 4★", km: 83.6, lat: 50.55167, lng: 3.18028 },
      { id: "par-19", type: "secteur", label: "Mons-en-Pévèle", desc: "3,0 km · pavé 5★", km: 85.3, lat: 50.56583, lng: 3.18861 },
      { id: "par-20", type: "secteur", label: "Mérignies → Avelin", desc: "0,7 km · pavé 3★", km: 87, lat: 50.55083, lng: 3.19528 },
      { id: "par-21", type: "secteur", label: "Pont-Thibault → Ennevelin", desc: "1,4 km · pavé 3★", km: 87.9, lat: 50.55167, lng: 3.18222 },
      { id: "par-22", type: "secteur", label: "Templeuve · Le Moulin", desc: "0,5 km · pavé 4★", km: 89.2, lat: 50.55917, lng: 3.16944 },
      { id: "par-23", type: "ravito", label: "Ravito — Templeuve", desc: "Centre · km 142", km: 90.2, lat: 50.56833, lng: 3.16667 },
      { id: "par-24", type: "secteur", label: "Cysoing → Bourghelles", desc: "1,3 km · pavé 3★", km: 93.9, lat: 50.5925, lng: 3.20389 },
      { id: "par-25", type: "secteur", label: "Bourghelles → Wannehain", desc: "1,1 km · pavé 3★", km: 94.5, lat: 50.5975, lng: 3.20139 },
      { id: "par-26", type: "secteur", label: "Camphin-en-Pévèle", desc: "1,8 km · pavé 4★", km: 96.2, lat: 50.61167, lng: 3.20833 },
      { id: "par-27", type: "secteur", label: "Carrefour de l'Arbre", desc: "2,1 km · pavé 5★", km: 98.1, lat: 50.62833, lng: 3.21528 },
      { id: "par-28", type: "secteur", label: "Gruson", desc: "1,1 km · pavé 3★", km: 99.7, lat: 50.64083, lng: 3.20278 },
      { id: "par-29", type: "secteur", label: "Hem", desc: "1,4 km · pavé 3★", km: 102.3, lat: 50.65861, lng: 3.18083 },
      { id: "par-30", type: "arrivee", label: "Arrivée — Vélodrome Roubaix", desc: "André-Pétrieux · ligne mythique", km: 105.8, lat: 50.69028, lng: 3.17139 }
    ],

    "enfer-des-flandres": [
      { id: "enf-1", type: "depart", label: "Départ — Cassel", desc: "Place du Général de Gaulle · 7h30", km: 0, lat: 50.80111, lng: 2.48472 },
      { id: "enf-2", type: "signaleur", label: "Signaleur — Steenvoorde", desc: "Traversée centre", km: 9.9, lat: 50.79833, lng: 2.625 },
      { id: "enf-3", type: "secteur", label: "Mont des Cats", desc: "1,1 km · 7,2 % · sommet pavé", km: 16.6, lat: 50.78444, lng: 2.7175 },
      { id: "enf-4", type: "ravito", label: "Ravito — Abbaye Mont des Cats", desc: "Pause longue · vue mer par temps clair", km: 17.5, lat: 50.7825, lng: 2.72917 },
      { id: "enf-5", type: "secteur", label: "Mont Noir", desc: "900 m · 6,8 % moyen", km: 19.1, lat: 50.77, lng: 2.71583 },
      { id: "enf-6", type: "secteur", label: "Mont de Boeschepe", desc: "600 m · 5,4 % moyen", km: 24, lat: 50.78222, lng: 2.78306 },
      { id: "enf-7", type: "secteur", label: "Kemmelberg", desc: "800 m · 9,4 % · pavé · 22 % max", km: 27.1, lat: 50.78778, lng: 2.82556 },
      { id: "enf-8", type: "secteur", label: "Mont Rouge", desc: "1,2 km · 6,1 % moyen", km: 29.9, lat: 50.785, lng: 2.86472 },
      { id: "enf-9", type: "ravito", label: "Ravito — Westouter", desc: "Place village · km 75", km: 33.9, lat: 50.76722, lng: 2.81528 },
      { id: "enf-10", type: "secteur", label: "Catsberg (Mont des Cats côté est)", desc: "900 m · 8,2 % moyen", km: 39.6, lat: 50.74, lng: 2.74583 },
      { id: "enf-11", type: "signaleur", label: "Signaleur — Bailleul", desc: "Traversée centre-ville", km: 40.5, lat: 50.73972, lng: 2.73389 },
      { id: "enf-12", type: "danger", label: "Danger — Descente Boeschepe", desc: "Pavé glissant · gravillons", km: 46.3, lat: 50.79167, lng: 2.72611 },
      { id: "enf-13", type: "ravito", label: "Ravito — Steenvoorde", desc: "Centre · km 130", km: 51.7, lat: 50.8, lng: 2.65 },
      { id: "enf-14", type: "arrivee", label: "Arrivée — Cassel", desc: "Retour Place du Général de Gaulle", km: 63.3, lat: 50.80111, lng: 2.48472 }
    ],

    "lille-hardelot": [
      { id: "lil-1", type: "depart", label: "Départ — Lille", desc: "Grand Place · 6h00", km: 0, lat: 50.63278, lng: 3.05972 },
      { id: "lil-2", type: "ravito", label: "Ravito — Bauvin", desc: "km 25", km: 18.5, lat: 50.55, lng: 2.84 },
      { id: "lil-3", type: "ravito", label: "Ravito — Béthune", desc: "Grand Place · km 50", km: 34.3, lat: 50.52917, lng: 2.63889 },
      { id: "lil-4", type: "ravito", label: "Ravito — Lillers", desc: "km 80", km: 54.2, lat: 50.52972, lng: 2.365 },
      { id: "lil-5", type: "secteur", label: "Côte de Fauquembergues", desc: "1,5 km · 4,8 % moyen", km: 70.7, lat: 50.51667, lng: 2.13333 },
      { id: "lil-6", type: "ravito", label: "Ravito — Saint-Omer", desc: "Place Foch · km 110", km: 79.9, lat: 50.59417, lng: 2.0875 },
      { id: "lil-7", type: "secteur", label: "Côte d'Hardinghen", desc: "2 km · 5,4 % moyen", km: 99.1, lat: 50.65, lng: 1.83 },
      { id: "lil-8", type: "ravito", label: "Ravito — Marquise", desc: "km 160", km: 108.3, lat: 50.65, lng: 1.7 },
      { id: "lil-9", type: "danger", label: "Danger — Descente Boulogne", desc: "Trafic urbain", km: 122.3, lat: 50.55, lng: 1.58611 },
      { id: "lil-10", type: "arrivee", label: "Arrivée — Hardelot-Plage", desc: "Front de mer · plage", km: 123, lat: 50.54917, lng: 1.59694 }
    ],

    "picarde-amienoise": [
      { id: "pic-1", type: "depart", label: "Départ — Hortillonnages", desc: "Maison des Hortillonnages · 8h00", km: 0, lat: 49.89944, lng: 2.30222 },
      { id: "pic-2", type: "ravito", label: "Ravito — Picquigny", desc: "Place du marché · km 18", km: 8.3, lat: 49.94167, lng: 2.20833 },
      { id: "pic-3", type: "secteur", label: "Côte d'Hangest", desc: "1,3 km · 5,1 % moyen", km: 19.6, lat: 49.975, lng: 2.05833 },
      { id: "pic-4", type: "ravito", label: "Ravito — Hangest", desc: "km 35", km: 28.2, lat: 50.00833, lng: 1.95 },
      { id: "pic-5", type: "ravito", label: "Ravito — Saint-Valery", desc: "Quai Romerel · km 65", km: 58.3, lat: 50.18472, lng: 1.63333 },
      { id: "pic-6", type: "secteur", label: "Le Hourdel", desc: "Pointe · phoques · vue baie", km: 64.8, lat: 50.20833, lng: 1.55 },
      { id: "pic-7", type: "danger", label: "Danger — Vent baie", desc: "Vent latéral en bord de baie", km: 70.8, lat: 50.18333, lng: 1.625 },
      { id: "pic-8", type: "ravito", label: "Ravito — Pont-Rémy", desc: "km 88", km: 82.1, lat: 50.1, lng: 1.71667 },
      { id: "pic-9", type: "arrivee", label: "Arrivée — Hortillonnages", desc: "Retour Maison des Hortillonnages", km: 129.7, lat: 49.89944, lng: 2.30222 }
    ],

    "gp-fourmies-amateur": [
      { id: "gp-1", type: "depart", label: "Départ — Fourmies", desc: "Place Émile-Coppeaux · 13h00", km: 0, lat: 50.01806, lng: 4.05 },
      { id: "gp-2", type: "secteur", label: "Côte de Trélon", desc: "1,1 km · 5,4 % moyen", km: 141.3, lat: 50.03889, lng: 4.1025 },
      { id: "gp-3", type: "signaleur", label: "Signaleur — Wignehies", desc: "Traversée centre", km: 144.9, lat: 50.04917, lng: 4.06667 },
      { id: "gp-4", type: "arrivee", label: "Arrivée — Fourmies", desc: "12 tours · sprint final", km: 149.2, lat: 50.01806, lng: 4.05 }
    ],

    "cyclo-baie-de-somme": [
      { id: "cyc-1", type: "depart", label: "Départ — Saint-Valery", desc: "Quai Romerel · 8h30", km: 0, lat: 50.18472, lng: 1.63333 },
      { id: "cyc-2", type: "secteur", label: "Le Hourdel", desc: "Pointe · phoques", km: 6.5, lat: 50.20833, lng: 1.55 },
      { id: "cyc-3", type: "ravito", label: "Ravito — Cayeux", desc: "Esplanade · vue mer", km: 9.6, lat: 50.18056, lng: 1.55833 },
      { id: "cyc-4", type: "ravito", label: "Ravito — Pont-Rémy", desc: "km 40", km: 31.3, lat: 50.1, lng: 1.83333 },
      { id: "cyc-5", type: "secteur", label: "Côte d'Abbeville", desc: "1,2 km · 4,2 % moyen", km: 39.7, lat: 50.16667, lng: 1.79167 },
      { id: "cyc-6", type: "ravito", label: "Ravito — Abbeville", desc: "Place Saint-Pierre · km 65", km: 42.7, lat: 50.16944, lng: 1.83333 },
      { id: "cyc-7", type: "arrivee", label: "Arrivée — Saint-Valery", desc: "Retour Quai Romerel", km: 60, lat: 50.18472, lng: 1.63333 }
    ],

    "6h-velo-pas-de-calais": [
      { id: "6h-1", type: "depart", label: "Départ/Arrivée — Circuit", desc: "Stand de la Bayard · 9h00", km: 0, lat: 50.40639, lng: 2.21833 },
      { id: "6h-2", type: "danger", label: "Danger — Chicane", desc: "Virage technique", km: 83, lat: 50.40972, lng: 2.21389 },
      { id: "6h-3", type: "arrivee", label: "Ligne Arrivée 6 h", desc: "Maximum tours sur 6 h", km: 83.5, lat: 50.40639, lng: 2.21833 }
    ],

    "open-gravel-eperlecques": [
      { id: "ope-1", type: "depart", label: "Départ — Éperlecques", desc: "Forêt domaniale · 8h30", km: 0, lat: 50.79361, lng: 2.16278 },
      { id: "ope-2", type: "secteur", label: "Forêt d'Éperlecques", desc: "Sentier forestier · 4 km", km: 2.6, lat: 50.81389, lng: 2.18056 },
      { id: "ope-3", type: "secteur", label: "Côte de Mentque", desc: "900 m · 4,8 % gravel", km: 5.4, lat: 50.83056, lng: 2.21111 },
      { id: "ope-4", type: "ravito", label: "Ravito — Audrehem", desc: "km 22", km: 7.1, lat: 50.84583, lng: 2.20833 },
      { id: "ope-5", type: "secteur", label: "Mont d'Hardinghen", desc: "1,4 km · 5,1 % chemin", km: 15.5, lat: 50.79722, lng: 2.3 },
      { id: "ope-6", type: "ravito", label: "Ravito — Tournehem", desc: "km 50", km: 21.4, lat: 50.74722, lng: 2.275 },
      { id: "ope-7", type: "danger", label: "Danger — Descente boueuse", desc: "Sentier glissant par temps humide", km: 27.8, lat: 50.78056, lng: 2.2 },
      { id: "ope-8", type: "arrivee", label: "Arrivée — Éperlecques", desc: "Retour forêt domaniale", km: 30.8, lat: 50.79361, lng: 2.16278 }
    ],

    "rando-muguet-choisy": [
      { id: "ran-1", type: "depart", label: "Départ — Choisy-au-Bac", desc: "Place de la Mairie · 8h00", km: 0, lat: 49.43, lng: 2.85806 },
      { id: "ran-2", type: "secteur", label: "Forêt de Compiègne", desc: "8 km en sous-bois", km: 12, lat: 49.5, lng: 2.93333 },
      { id: "ran-3", type: "ravito", label: "Ravito — Pierrefonds", desc: "Château · km 28", km: 20, lat: 49.55833, lng: 3 },
      { id: "ran-4", type: "secteur", label: "Côte de Cuise-la-Motte", desc: "1,1 km · 4,5 % moyen", km: 36.4, lat: 49.45, lng: 3.06667 },
      { id: "ran-5", type: "ravito", label: "Ravito — Compiègne", desc: "Place Hôtel de Ville · km 65", km: 42.5, lat: 49.41667, lng: 3 },
      { id: "ran-6", type: "arrivee", label: "Arrivée — Choisy-au-Bac", desc: "Retour Place de la Mairie", km: 54.5, lat: 49.43, lng: 2.85806 }
    ],

    /* ─── Courses HdF 2026 — vague 2 ─── */
    "race-across-paris": [
      { id: "rac-1", type: "depart", label: "Départ — Hippodrome Chantilly", desc: "Aire de départ · 18h00", km: 0, lat: 49.19389, lng: 2.465 },
      { id: "rac-2", type: "ravito", label: "Ravito — Senlis", desc: "Place Henri-IV · km 22", km: 12.2, lat: 49.275, lng: 2.36 },
      { id: "rac-3", type: "secteur", label: "Forêt de Halatte", desc: "Sous-bois sur 6 km", km: 28.3, lat: 49.385, lng: 2.5 },
      { id: "rac-4", type: "ravito", label: "Ravito — Compiègne", desc: "Place HV · km 65", km: 51.5, lat: 49.41667, lng: 2.81667 },
      { id: "rac-5", type: "secteur", label: "Forêt de Compiègne", desc: "Traversée intégrale", km: 72.3, lat: 49.45, lng: 3.1 },
      { id: "rac-6", type: "ravito", label: "Ravito — Soissons", desc: "Place Fernand-Marquigny · km 110", km: 88.8, lat: 49.41, lng: 3.32 },
      { id: "rac-7", type: "secteur", label: "Côte de Crépy", desc: "1,8 km · 4,2 %", km: 117.3, lat: 49.2, lng: 3.1 },
      { id: "rac-8", type: "ravito", label: "Ravito — Crépy-en-Valois", desc: "km 165", km: 139.8, lat: 49.15, lng: 2.8 },
      { id: "rac-9", type: "arrivee", label: "Arrivée — Hippodrome", desc: "Retour Chantilly · feu à l'aube", km: 164.7, lat: 49.19389, lng: 2.465 }
    ],

    "roc-d-opale": [
      { id: "roc-1", type: "depart", label: "Départ — Calais", desc: "Place d'Armes · 8h00", km: 0, lat: 50.9513, lng: 1.8587 },
      { id: "roc-2", type: "secteur", label: "Cap Blanc-Nez", desc: "2 km · 6,2 % · vue mer", km: 20.8, lat: 50.8667, lng: 1.5944 },
      { id: "roc-3", type: "ravito", label: "Ravito — Wissant", desc: "Front de mer · km 22", km: 22.9, lat: 50.85, lng: 1.58 },
      { id: "roc-4", type: "secteur", label: "Cap Gris-Nez", desc: "900 m · 4,8 %", km: 26.5, lat: 50.87, lng: 1.62 },
      { id: "roc-5", type: "ravito", label: "Ravito — Wimereux", desc: "Esplanade · km 48", km: 41.4, lat: 50.7613, lng: 1.6161 },
      { id: "roc-6", type: "secteur", label: "Côte de Wimereux", desc: "900 m · 6,1 %", km: 45.5, lat: 50.725, lng: 1.62 },
      { id: "roc-7", type: "ravito", label: "Ravito — Guînes", desc: "Place Foch · km 80", km: 71.6, lat: 50.8333, lng: 1.95 },
      { id: "roc-8", type: "arrivee", label: "Arrivée — Calais", desc: "Retour Place d'Armes", km: 88, lat: 50.9513, lng: 1.8587 }
    ],

    "callys-gravel": [
      { id: "cal-1", type: "depart", label: "Départ — Sangatte", desc: "Plage · 7h30", km: 0, lat: 50.9436, lng: 1.7481 },
      { id: "cal-2", type: "secteur", label: "Sentier des Falaises", desc: "Sentier littoral · 4 km", km: 3, lat: 50.925, lng: 1.78 },
      { id: "cal-3", type: "secteur", label: "Mont du Cap Blanc-Nez", desc: "1,4 km · 7,1 % gravel", km: 17.6, lat: 50.8667, lng: 1.5944 },
      { id: "cal-4", type: "ravito", label: "Ravito — Wissant", desc: "km 22 · barres + eau", km: 19.7, lat: 50.85, lng: 1.58 },
      { id: "cal-5", type: "secteur", label: "Forêt de Guînes", desc: "Traverse forestière · 6 km", km: 25.4, lat: 50.86, lng: 1.66 },
      { id: "cal-6", type: "ravito", label: "Ravito — Marquise", desc: "km 50", km: 38.6, lat: 50.91, lng: 1.83 },
      { id: "cal-7", type: "danger", label: "Danger — Descente sablonneuse", desc: "Sortie de forêt", km: 42.7, lat: 50.93, lng: 1.78 },
      { id: "cal-8", type: "arrivee", label: "Arrivée — Sangatte", desc: "Retour plage", km: 45.4, lat: 50.9436, lng: 1.7481 }
    ],

    "rives-authie": [
      { id: "riv-1", type: "depart", label: "Départ — Berck-sur-Mer", desc: "Esplanade · 8h00", km: 0, lat: 50.405, lng: 1.5581 },
      { id: "riv-2", type: "ravito", label: "Ravito — Rang-du-Fliers", desc: "km 12", km: 6.7, lat: 50.39, lng: 1.65 },
      { id: "riv-3", type: "secteur", label: "Vallée de l'Authie", desc: "Bord de rivière · 8 km", km: 17.5, lat: 50.34, lng: 1.78 },
      { id: "riv-4", type: "ravito", label: "Ravito — Auxi-le-Château", desc: "Place du marché · km 38", km: 28.7, lat: 50.3478, lng: 1.9378 },
      { id: "riv-5", type: "secteur", label: "Côte d'Auxi", desc: "1,2 km · 4,8 %", km: 36.9, lat: 50.3, lng: 1.85 },
      { id: "riv-6", type: "ravito", label: "Ravito — Maintenay", desc: "km 65", km: 47.8, lat: 50.32, lng: 1.7 },
      { id: "riv-7", type: "arrivee", label: "Arrivée — Berck", desc: "Retour esplanade", km: 62, lat: 50.405, lng: 1.5581 }
    ],

    "ardresienne": [
      { id: "ard-1", type: "depart", label: "Départ — Ardres", desc: "Place du Centre · 9h00", km: 0, lat: 50.8563, lng: 1.975 },
      { id: "ard-2", type: "ravito", label: "Ravito — Saint-Omer", desc: "Place Foch · km 18", km: 11.8, lat: 50.8006, lng: 2.1094 },
      { id: "ard-3", type: "secteur", label: "Côte de Lumbres", desc: "1,6 km · 5,3 %", km: 16.6, lat: 50.83, lng: 2.16 },
      { id: "ard-4", type: "ravito", label: "Ravito — Tournehem", desc: "km 42", km: 25.5, lat: 50.87, lng: 2.05 },
      { id: "ard-5", type: "secteur", label: "Marais de l'Aa", desc: "Bordure de canal · 3 km", km: 37.9, lat: 50.88, lng: 1.88 },
      { id: "ard-6", type: "arrivee", label: "Arrivée — Ardres", desc: "Retour Place du Centre", km: 45.1, lat: 50.8563, lng: 1.975 }
    ],

    "fete-velo-7-vallees": [
      { id: "fet-1", type: "depart", label: "Départ — Beaurainville", desc: "Place Verte · 8h30", km: 0, lat: 50.4383, lng: 1.8961 },
      { id: "fet-2", type: "ravito", label: "Ravito — Hesdin", desc: "Grand Place · km 18", km: 12.4, lat: 50.41, lng: 2.05 },
      { id: "fet-3", type: "secteur", label: "Côte de Sains-lès-Fressin", desc: "1,8 km · 5,8 %", km: 17.3, lat: 50.37, lng: 2.08 },
      { id: "fet-4", type: "secteur", label: "Vallée de la Canche", desc: "Bord de rivière · 5 km", km: 24.1, lat: 50.43, lng: 2.1 },
      { id: "fet-5", type: "ravito", label: "Ravito — Auchy-lès-Hesdin", desc: "km 48", km: 30.3, lat: 50.47, lng: 2.04 },
      { id: "fet-6", type: "arrivee", label: "Arrivée — Beaurainville", desc: "Retour Place Verte", km: 41.3, lat: 50.4383, lng: 1.8961 }
    ],

    "cap-gris-nez": [
      { id: "cap-1", type: "depart", label: "Départ — Saint-Omer", desc: "Place Foch · 7h00", km: 0, lat: 50.75, lng: 2.25 },
      { id: "cap-2", type: "ravito", label: "Ravito — Guînes", desc: "km 28", km: 22.9, lat: 50.83, lng: 1.95 },
      { id: "cap-3", type: "secteur", label: "Cap Gris-Nez", desc: "Le point culminant · vue Angleterre", km: 58.1, lat: 50.8667, lng: 1.5944 },
      { id: "cap-4", type: "ravito", label: "Ravito — Wissant", desc: "Plage · km 70", km: 60.3, lat: 50.85, lng: 1.58 },
      { id: "cap-5", type: "secteur", label: "Côte d'Audinghen", desc: "1,4 km · 5,2 %", km: 69.5, lat: 50.78, lng: 1.65 },
      { id: "cap-6", type: "ravito", label: "Ravito — Boulogne", desc: "Place Dalton · km 100", km: 82.7, lat: 50.6667, lng: 1.65 },
      { id: "cap-7", type: "ravito", label: "Ravito — Lumbres", desc: "km 130", km: 111.6, lat: 50.72, lng: 2.05 },
      { id: "cap-8", type: "arrivee", label: "Arrivée — Saint-Omer", desc: "Retour Place Foch", km: 126, lat: 50.75, lng: 2.25 }
    ],

    "oree-du-bois": [
      { id: "ore-1", type: "depart", label: "Départ — Rang-du-Fliers", desc: "Salle des Fêtes · 8h00", km: 0, lat: 50.39, lng: 1.65 },
      { id: "ore-2", type: "secteur", label: "Forêt de Crécy", desc: "Sentier 6 km", km: 11, lat: 50.43, lng: 1.79 },
      { id: "ore-3", type: "ravito", label: "Ravito — Rue", desc: "Place du marché · km 28", km: 17.3, lat: 50.4563, lng: 1.8681 },
      { id: "ore-4", type: "secteur", label: "Côte de Forest", desc: "1,1 km · 4,8 %", km: 24.4, lat: 50.42, lng: 1.95 },
      { id: "ore-5", type: "ravito", label: "Ravito — Auxi-le-Château", desc: "km 56", km: 32.4, lat: 50.3478, lng: 1.9378 },
      { id: "ore-6", type: "arrivee", label: "Arrivée — Rang-du-Fliers", desc: "Retour salle des fêtes", km: 57.6, lat: 50.39, lng: 1.65 }
    ],

    "rando-nacree": [
      { id: "ran-1", type: "depart", label: "Départ — Esches", desc: "Mairie · 9h00", km: 0, lat: 49.2167, lng: 2.1333 },
      { id: "ran-2", type: "secteur", label: "Forêt de Carnelle", desc: "Sous-bois · 4 km", km: 5.2, lat: 49.2, lng: 2.2 },
      { id: "ran-3", type: "ravito", label: "Ravito — Méru", desc: "Centre · km 18", km: 12.8, lat: 49.18, lng: 2.1 },
      { id: "ran-4", type: "secteur", label: "Côte de Chambly", desc: "900 m · 4,5 %", km: 23.5, lat: 49.25, lng: 2.1 },
      { id: "ran-5", type: "arrivee", label: "Arrivée — Esches", desc: "Retour Mairie", km: 29.6, lat: 49.2167, lng: 2.1333 }
    ],

    "4-jours-dunkerque": [
      { id: "4-1", type: "depart", label: "Départ — Dunkerque", desc: "Place Jean-Bart · 14h00", km: 0, lat: 51.0422, lng: 2.377 },
      { id: "4-2", type: "ravito", label: "Ravito — Bourbourg", desc: "km 22", km: 15.9, lat: 50.95, lng: 2.55 },
      { id: "4-3", type: "secteur", label: "Côte de Watten", desc: "1,2 km · 5,8 %", km: 32.8, lat: 50.87, lng: 2.43 },
      { id: "4-4", type: "ravito", label: "Ravito — Cassel", desc: "km 65", km: 42.4, lat: 50.83, lng: 2.55 },
      { id: "4-5", type: "secteur", label: "Mont des Cats", desc: "1,1 km · 7,2 %", km: 55.6, lat: 50.78, lng: 2.72 },
      { id: "4-6", type: "ravito", label: "Ravito — Bergues", desc: "km 110", km: 80.5, lat: 50.95, lng: 2.65 },
      { id: "4-7", type: "arrivee", label: "Arrivée — Dunkerque", desc: "Sprint Digue de Mer", km: 102.1, lat: 51.0422, lng: 2.377 }
    ]
  };

  window.CCS_STATIC.evenements = [
    /* ─── Courses 2026 — Hauts-de-France ─── */
    { id: 1,  slug: 'paris-roubaix-challenge-2026', sortie_id: 'paris-roubaix-challenge', title: 'Paris-Roubaix Challenge', title_html: 'Paris-Roubaix <span class="it">Challenge</span>', subtitle: 'Cyclosportive officielle · 3 parcours · 70/145/172 km', type: 'cyclosportive', date: '2026-04-11', heure: '07:30', lieu: 'Busigny → Roubaix', region: 'Nord (59)', distance_km: 172, inscrits: 6500, max_inscrits: 8000, engagement_eur: 75, statut: 'ouvert', description: "L'épreuve cyclosportive officielle organisée la veille de Paris–Roubaix professionnel. 30 secteurs pavés sur le parcours intégral." },
    { id: 2,  slug: 'enfer-flandres-2026', sortie_id: 'enfer-des-flandres', title: 'L\'Enfer des Flandres', title_html: 'L\'Enfer <span class="it">des</span> Flandres', subtitle: 'Cyclosportive · monts flamands · 60-215 km', type: 'cyclosportive', date: '2026-06-14', heure: '07:30', lieu: 'Cassel', region: 'Nord (59) · Flandre', distance_km: 157, inscrits: 0, max_inscrits: 1500, engagement_eur: 32, statut: 'ouvert', description: 'Le grand classique flamand sur les monts mythiques : Mont des Cats, Kemmelberg, Mont Noir. 5 parcours au choix.' },
    { id: 3,  slug: 'lille-hardelot-2026', sortie_id: 'lille-hardelot', title: 'Lille-Hardelot', title_html: 'Lille — <span class="it">Hardelot</span>', subtitle: 'Randonnée · 200 km · ligne droite vers la mer', type: 'rando', date: '2026-06-08', heure: '06:00', lieu: 'Lille', region: 'Nord → Pas-de-Calais', distance_km: 200, inscrits: 4200, max_inscrits: 5500, engagement_eur: 35, statut: 'ouvert', description: '32e édition. Parcours unique de Lille à Hardelot-Plage. Départ groupé en pelotons de 50, ravitaillements tous les 50 km.' },
    { id: 4,  slug: 'picarde-amienoise-2026', sortie_id: 'picarde-amienoise', title: 'La Picarde Amiénoise', title_html: 'La Picarde <span class="it">Amiénoise</span>', subtitle: 'Cyclosportive UFOLEP · 3 parcours', type: 'cyclosportive', date: '2026-05-25', heure: '08:00', lieu: 'Amiens', region: 'Somme (80)', distance_km: 112, inscrits: 480, max_inscrits: 700, engagement_eur: 22, statut: 'ouvert', description: 'Cyclosportive partant des Hortillonnages. 3 parcours : 55, 85 ou 112 km dans la campagne picarde et la baie de Somme.' },
    { id: 5,  slug: 'gp-fourmies-amateur-2026', sortie_id: 'gp-fourmies-amateur', title: 'GP Fourmies Amateur', title_html: 'GP <span class="it">de</span> Fourmies Amateur', subtitle: 'Course FFC élite régionale · veille du GP pro', type: 'course', date: '2026-09-06', heure: '13:00', lieu: 'Fourmies', region: 'Nord (59) · Avesnois', distance_km: 145, inscrits: 0, max_inscrits: 200, engagement_eur: 28, statut: 'ouvert', description: "Le GP Fourmies amateur, la veille de l'épreuve professionnelle. Circuit de 12,1 km à parcourir 12 fois." },
    { id: 6,  slug: 'cyclo-baie-somme-2026', sortie_id: 'cyclo-baie-de-somme', title: 'Cyclo de la Baie de Somme', title_html: 'Cyclo <span class="it">de la</span> Baie de Somme', subtitle: 'Randonnée · 3 boucles · côte picarde', type: 'rando', date: '2026-08-30', heure: '08:30', lieu: 'Saint-Valery-sur-Somme', region: 'Somme (80)', distance_km: 90, inscrits: 0, max_inscrits: 1200, engagement_eur: 15, statut: 'ouvert', description: 'Au départ de Saint-Valery, boucles de 50, 70 ou 90 km. Vue mer, marais et phoques au Hourdel.' },
    { id: 7,  slug: '6h-velo-pas-de-calais-2026', sortie_id: '6h-velo-pas-de-calais', title: '6 Heures Vélo du Pas-de-Calais', title_html: '6 Heures <span class="it">Vélo</span> du Pas-de-Calais', subtitle: 'Course endurance · circuit fermé', type: 'course', date: '2026-05-08', heure: '09:00', lieu: 'Croix-en-Ternois', region: 'Pas-de-Calais (62)', distance_km: 168, inscrits: 0, max_inscrits: 250, engagement_eur: 32, statut: 'ouvert', description: 'Course d\'endurance de 6 heures sur le circuit automobile de Croix-en-Ternois. Solo, duo ou équipe de 4.' },
    { id: 8,  slug: 'open-gravel-eperlecques-2026', sortie_id: 'open-gravel-eperlecques', title: 'Open de Gravel d\'Éperlecques', title_html: 'Open <span class="it">Gravel</span> d\'Éperlecques', subtitle: 'Gravel · 3 parcours · forêt domaniale', type: 'gravel', date: '2026-05-14', heure: '08:30', lieu: 'Éperlecques', region: 'Pas-de-Calais (62)', distance_km: 84, inscrits: 0, max_inscrits: 600, engagement_eur: 20, statut: 'ouvert', description: '3 parcours gravel dans la forêt domaniale d\'Éperlecques : 40, 63 ou 84 km. 60 % de chemins.' },
    { id: 9,  slug: 'rando-muguet-choisy-2026', sortie_id: 'rando-muguet-choisy', title: 'Randonnée du Muguet', title_html: 'Randonnée <span class="it">du</span> Muguet', subtitle: 'Rando familiale · forêt de Compiègne', type: 'rando', date: '2026-04-26', heure: '08:00', lieu: 'Choisy-au-Bac', region: 'Oise (60)', distance_km: 110, inscrits: 0, max_inscrits: 800, engagement_eur: 5, statut: 'ouvert', description: 'Rando familiale en forêt de Compiègne. Parcours de 6 à 110 km. Départ groupé Choisy-au-Bac.' },

    /* ─── Courses du club C.C. Salouel ─── */
    { id: 10, slug: 'saloueloise-2025', sortie_id: 'arenberg-2025-04-05', title: 'La Saloueloise Pavés', title_html: 'La Saloueloise <span class="it">Pavés</span>', subtitle: 'Cyclosportive · pavés · 3 parcours', type: 'cyclosportive', date: '2025-04-13', heure: '08:30', lieu: 'Salouel', region: 'Hauts-de-France', distance_km: 172, inscrits: 284, max_inscrits: 400, engagement_eur: 18, statut: 'ouvert', description: 'Notre cyclosportive annuelle sur les pavés. Trois parcours : 65, 115 ou 172 km.' },
    { id: 11, slug: 'scarpe-gravel-2025-04', sortie_id: 'scarpe-gravel-2025-04-27', title: 'Gravel de la Scarpe', title_html: 'Gravel <span class="it">de la</span> Scarpe', subtitle: 'Gravel · 2e édition', type: 'gravel', date: '2025-04-27', heure: '08:30', lieu: 'St-Amand', region: 'Bois de Raismes', distance_km: 82, inscrits: 0, max_inscrits: null, engagement_eur: 18, statut: 'ouvert' },
    { id: 12, slug: 'ronde-monts-2025', sortie_id: 'ronde-monts-2025-05-18', title: 'La Ronde des Monts', title_html: 'La Ronde <span class="it">des</span> Monts', subtitle: 'Cyclosportive FFC', type: 'cyclosportive', date: '2025-05-18', heure: '09:00', lieu: 'Cassel', region: 'Mont des Cats', distance_km: 95, inscrits: 0, max_inscrits: null, engagement_eur: 22, statut: 'ouvert' },
    { id: 13, slug: 'criterium-salouel-2025', sortie_id: 'criterium-salouel-2025-06-08', title: 'Critérium de Salouel', title_html: 'Critérium <span class="it">de</span> Salouel', subtitle: 'Circuit fermé · ZI Nord', type: 'criterium', date: '2025-06-08', heure: '14:00', lieu: 'Salouel', region: 'Z.I. nord', distance_km: 40, inscrits: 0, max_inscrits: null, engagement_eur: 12, statut: 'ouvert' },
    { id: 14, slug: 'championnat-ufolep-2025', sortie_id: 'championnat-ufolep-2025-06-15', title: 'Championnat régional UFOLEP', title_html: 'Championnat <span class="it">régional</span> UFOLEP', subtitle: 'Route · toutes cat.', type: 'championnat', date: '2025-06-15', heure: '14:00', lieu: 'Orchies', region: 'Hauts-de-France', distance_km: 58, inscrits: 0, max_inscrits: null, engagement_eur: 15, statut: 'ouvert' },
    { id: 15, slug: 'grand-prix-salouel-2025', sortie_id: 'grand-prix-salouel-2025-07-06', title: 'Grand Prix de Salouel', title_html: 'Grand Prix <span class="it">de</span> Salouel', subtitle: 'Course FSGT 1re–3e cat', type: 'course', date: '2025-07-06', heure: '13:30', lieu: 'Salouel', region: 'Centre-ville', distance_km: 65, inscrits: 0, max_inscrits: null, engagement_eur: 12, statut: 'ouvert' },
    { id: 16, slug: 'rando-3-provinces-2025', sortie_id: 'rando-3-provinces-2025-09-14', title: 'Rando des 3 Provinces', title_html: 'Rando <span class="it">des</span> 3 Provinces', subtitle: '45 / 80 / 120 km', type: 'rando', date: '2025-09-14', heure: '08:00', lieu: 'Maroilles', region: 'Avesnois', distance_km: 120, inscrits: 0, max_inscrits: null, engagement_eur: 10, statut: 'ouvert' },

    /* ─── HdF 2026 (vague 2 — auto-import) ─── */
    { id: 17, slug: 'race-across-paris-2026', sortie_id: 'race-across-paris', title: 'Race Across Paris', title_html: 'Race <span class="it">Across</span> Paris', subtitle: 'Ultra-distance · 200/300/500/1000 km', type: 'cyclosportive', date: '2026-04-22', heure: '18:00', lieu: 'Chantilly', region: 'Oise (60)', distance_km: 200, inscrits: 0, max_inscrits: 300, engagement_eur: 119, statut: 'ouvert', description: 'Ultra-cyclisme non-stop avec 4 distances au choix.' },
    { id: 18, slug: 'roc-d-opale-2026', sortie_id: 'roc-d-opale', title: 'Roc d\'Opale', title_html: 'Roc <span class="it">d\'</span>Opale', subtitle: 'Boucle Caps Blanc-Nez et Gris-Nez', type: 'cyclosportive', date: '2026-06-21', heure: '08:00', lieu: 'Calais', region: 'Pas-de-Calais (62)', distance_km: 111, inscrits: 0, max_inscrits: 800, engagement_eur: 4, statut: 'ouvert', description: '6 parcours de 13 à 111 km sur la Côte d\'Opale.' },
    { id: 19, slug: 'callys-gravel-2026', sortie_id: 'callys-gravel', title: 'La Cal\'lys Gravel', title_html: 'La <span class="it">Cal\'lys</span> Gravel', subtitle: 'Gravel littoral · 80 km', type: 'gravel', date: '2026-04-19', heure: '07:30', lieu: 'Sangatte', region: 'Pas-de-Calais (62)', distance_km: 80, inscrits: 0, max_inscrits: 500, engagement_eur: 10, statut: 'ouvert', description: 'Gravel sur les falaises et la forêt de Guînes.' },
    { id: 20, slug: 'rives-authie-2026', sortie_id: 'rives-authie', title: 'Les Rives de l\'Authie', title_html: 'Les Rives <span class="it">de l\'</span>Authie', subtitle: 'Randonnée · 7 parcours', type: 'rando', date: '2026-05-10', heure: '08:00', lieu: 'Berck-sur-Mer', region: 'Pas-de-Calais (62)', distance_km: 90, inscrits: 0, max_inscrits: null, engagement_eur: 5, statut: 'ouvert' },
    { id: 21, slug: 'ardresienne-2026', sortie_id: 'ardresienne', title: 'L\'Ardrésienne', title_html: 'L\'<span class="it">Ardr</span>ésienne', subtitle: 'Randonnée familiale · 8 parcours', type: 'rando', date: '2026-05-17', heure: '09:00', lieu: 'Ardres', region: 'Pas-de-Calais (62)', distance_km: 70, inscrits: 0, max_inscrits: null, engagement_eur: 4, statut: 'ouvert' },
    { id: 22, slug: 'fete-velo-7-vallees-2026', sortie_id: 'fete-velo-7-vallees', title: 'Fête du Vélo en 7 Vallées', title_html: 'Fête <span class="it">du Vélo</span> en 7 Vallées', subtitle: '3 distances · 31/61/80 km', type: 'rando', date: '2026-05-24', heure: '08:30', lieu: 'Beaurainville', region: 'Pas-de-Calais (62)', distance_km: 80, inscrits: 0, max_inscrits: null, engagement_eur: 0, statut: 'ouvert' },
    { id: 23, slug: 'cap-gris-nez-2026', sortie_id: 'cap-gris-nez', title: 'Sur la Route du Cap Gris-Nez', title_html: 'Sur la Route <span class="it">du</span> Cap Gris-Nez', subtitle: 'Randonnée littorale · 8 parcours', type: 'rando', date: '2026-08-23', heure: '07:00', lieu: 'Saint-Omer', region: 'Pas-de-Calais (62)', distance_km: 150, inscrits: 0, max_inscrits: null, engagement_eur: 3, statut: 'ouvert' },
    { id: 24, slug: 'oree-du-bois-2026', sortie_id: 'oree-du-bois', title: 'Randonnée de l\'Orée du Bois', title_html: 'Rando <span class="it">de l\'</span>Orée du Bois', subtitle: 'Forêt de Crécy · 6 parcours', type: 'rando', date: '2026-08-09', heure: '08:00', lieu: 'Rang-du-Fliers', region: 'Pas-de-Calais (62)', distance_km: 87, inscrits: 0, max_inscrits: null, engagement_eur: 5, statut: 'ouvert' },
    { id: 25, slug: 'rando-nacree-2026', sortie_id: 'rando-nacree', title: 'La Rando Nacrée', title_html: 'La <span class="it">Rando</span> Nacrée', subtitle: 'Randonnée familiale · forêt', type: 'rando', date: '2026-05-31', heure: '09:00', lieu: 'Esches', region: 'Oise (60)', distance_km: 50, inscrits: 0, max_inscrits: null, engagement_eur: 0, statut: 'ouvert' },
    { id: 26, slug: '4-jours-dunkerque-2026', sortie_id: '4-jours-dunkerque', title: '4 Jours de Dunkerque', title_html: '4 Jours <span class="it">de</span> Dunkerque', subtitle: 'Course UCI 2.1 · 4 étapes', type: 'course', date: '2026-05-12', heure: '14:00', lieu: 'Dunkerque', region: 'Nord (59)', distance_km: 150, inscrits: 0, max_inscrits: null, engagement_eur: null, statut: 'ouvert', description: 'Course professionnelle UCI 2.1 ouverte au public.' },

    /* ─── Sorties passées (archives 2025) ─── */
    { id: 27, slug: 'monts-flandres-2025', sortie_id: 'monts-flandres-2025-03-28', title: 'Monts des Flandres', title_html: 'Monts <span class="it">des</span> Flandres', subtitle: 'Reconnaissance · 5 monts', type: 'cyclosportive', date: '2025-03-28', heure: '08:00', lieu: 'Cassel', region: 'Nord (59)', distance_km: 77, inscrits: 0, max_inscrits: null, engagement_eur: 0, statut: 'archive' },
    { id: 28, slug: 'avesnois-2025', sortie_id: 'avesnois-2025-03-15', title: 'Boucle de l\'Avesnois', title_html: 'Boucle <span class="it">de l\'</span>Avesnois', subtitle: 'Sortie club · 114 km', type: 'rando', date: '2025-03-15', heure: '08:30', lieu: 'Maroilles', region: 'Avesnois', distance_km: 114, inscrits: 0, max_inscrits: null, engagement_eur: 0, statut: 'archive' },
    { id: 29, slug: 'scarpe-gravel-2025-03', sortie_id: 'scarpe-gravel-2025-03-02', title: 'Scarpe Gravel · édition 1', title_html: 'Scarpe <span class="it">Gravel</span>', subtitle: 'Sortie club · gravel forêt', type: 'gravel', date: '2025-03-02', heure: '08:30', lieu: 'St-Amand', region: 'Bois de Raismes', distance_km: 68, inscrits: 0, max_inscrits: null, engagement_eur: 0, statut: 'archive' },
    { id: 30, slug: 'cote-opale-2025', sortie_id: 'opale-2025-02-22', title: 'Côte d\'Opale', title_html: 'Côte <span class="it">d\'</span>Opale', subtitle: 'Sortie club · littoral · 95 km', type: 'rando', date: '2025-02-22', heure: '08:30', lieu: 'Boulogne', region: 'Pas-de-Calais (62)', distance_km: 95, inscrits: 0, max_inscrits: null, engagement_eur: 0, statut: 'archive' },
    { id: 31, slug: 'cambresis-2025', sortie_id: 'cambresis-2025-02-08', title: 'Boucle du Cambrésis', title_html: 'Boucle <span class="it">du</span> Cambrésis', subtitle: 'Sortie club · campagne', type: 'rando', date: '2025-02-08', heure: '09:00', lieu: 'Cambrai', region: 'Nord (59)', distance_km: 88, inscrits: 0, max_inscrits: null, engagement_eur: 0, statut: 'archive' },
    { id: 32, slug: 'pevele-2025', sortie_id: 'pevele-2025-01-26', title: 'Pavés de la Pévèle', title_html: 'Pavés <span class="it">de la</span> Pévèle', subtitle: 'Sortie club · pavés', type: 'rando', date: '2025-01-26', heure: '09:00', lieu: 'Orchies', region: 'Nord (59)', distance_km: 84, inscrits: 0, max_inscrits: null, engagement_eur: 0, statut: 'archive' },
  ];

  window.CCS_STATIC.palmares = [
    { annee: 2025, titre: 'Vainqueur — Trouée d\'Arenberg', evenement: 'Reconnaissance Paris-Roubaix', categorie: 'Open', rang: 1, medaille: 'or' },
    { annee: 2025, titre: '2e — La Ronde des Flandres', evenement: 'Ronde des Flandres', categorie: 'UFOLEP GS', rang: 2, medaille: 'argent' },
    { annee: 2025, titre: 'Vainqueur — Critérium d\'Orchies', evenement: 'Critérium d\'Orchies', categorie: 'FSGT 3e', rang: 1, medaille: 'or' },
    { annee: 2025, titre: '3e — Cyclo-cross de Douai', evenement: 'Cyclo-cross de Douai', categorie: 'UFOLEP féminines', rang: 3, medaille: 'bronze' },
    { annee: 2024, titre: 'Vainqueur — Grand Prix de Salouel', evenement: 'Grand Prix de Salouel', categorie: '3e cat', rang: 1, medaille: 'or' },
    { annee: 2024, titre: '2e — Mont des Cats', evenement: 'Ronde des Monts', categorie: 'M40', rang: 2, medaille: 'argent' },
    { annee: 2024, titre: '3e — Championnat régional UFOLEP', evenement: 'Championnat régional UFOLEP', categorie: 'GS', rang: 3, medaille: 'bronze' },
    { annee: 2023, titre: 'Équipe — Critérium UFOLEP', evenement: 'Championnat régional', categorie: 'Équipe', rang: 1, medaille: 'or', equipe: true },
  ];

  window.CCS_STATIC.segments = [
    { id: 1, name: "Trouée d'Arenberg",    location: 'Wallers',  stars: 5, length_m: 2400, meilleur_temps: "6'42\"", delta_moyenne: '−22" scratch', rang: '1er · KOM', rang_cls: 'neg', kom: 1 },
    { id: 2, name: "Carrefour de l'Arbre", location: 'Camphin',  stars: 5, length_m: 1600, meilleur_temps: "4'28\"", delta_moyenne: '−12" scratch', rang: '2e', rang_cls: 'neg', kom: 0 },
    { id: 3, name: 'Mons-en-Pévèle',       location: 'Pévèle',   stars: 5, length_m: 3000, meilleur_temps: "8'54\"", delta_moyenne: '+4" scratch', rang: '4e', rang_cls: 'neu', kom: 0 },
    { id: 4, name: 'Kemmelberg',           location: 'Flandre',  stars: 5, length_m: 800,  meilleur_temps: "2'54\"", delta_moyenne: '+2" scratch', rang: '5e', rang_cls: 'neu', kom: 0 },
    { id: 5, name: 'Mont des Cats',        location: 'Flandre',  stars: 4, length_m: 1100, meilleur_temps: "4'18\"", delta_moyenne: '−6" scratch', rang: '3e', rang_cls: 'neg', kom: 0 },
    { id: 6, name: 'Côte de Wimereux',     location: 'Opale',    stars: 3, length_m: 900,  meilleur_temps: "3'24\"", delta_moyenne: '−2" scratch', rang: '4e', rang_cls: 'neu', kom: 0 },
    { id: 7, name: 'Mur de Liessies',      location: 'Avesnois', stars: 3, length_m: 600,  meilleur_temps: "2'18\"", delta_moyenne: '+1" scratch', rang: '6e', rang_cls: 'neu', kom: 0 },
    { id: 8, name: 'Ligne droite de Solesmes', location: 'Cambrésis', stars: 2, length_m: 4200, meilleur_temps: "6'48\"", delta_moyenne: '−4" scratch', rang: '3e', rang_cls: 'neg', kom: 0 },
  ];

  window.CCS_STATIC.membres = [
    { id: 1, numero: 1,  prenom: 'Antoine',  nom: 'Lemaire',     role: 'admin',      ftp_w: 310, km_saison: 4218, elevation_saison: 52640, licence_ffc: 'FFC2024001', annee_adhesion: 1997, avatar_initial: 'A' },
    { id: 2, numero: 12, prenom: 'Julien',   nom: 'Scotte',      role: 'moderateur', ftp_w: 298, km_saison: 3890, elevation_saison: 48200, licence_ffc: 'FFC2024012', annee_adhesion: 2005, avatar_initial: 'J' },
    { id: 3, numero: 18, prenom: 'Claude',   nom: 'Sert',        role: 'moderateur', ftp_w: 275, km_saison: 3240, elevation_saison: 41120, licence_ffc: 'FFC2024018', annee_adhesion: 2009, avatar_initial: 'C' },
    { id: 4, numero: 24, prenom: 'Thomas',   nom: 'Dubois',      role: 'membre',     ftp_w: 265, km_saison: 3120, elevation_saison: 38900, annee_adhesion: 2018, avatar_initial: 'T' },
    { id: 5, numero: 31, prenom: 'Marc',     nom: 'Dupont',      role: 'membre',     ftp_w: 288, km_saison: 2840, elevation_saison: 33100, licence_ffc: 'FFC2024031', annee_adhesion: 2012, avatar_initial: 'M' },
    { id: 6, numero: 37, prenom: 'Claire',   nom: 'Bailleul',    role: 'membre',     ftp_w: 248, km_saison: 2640, elevation_saison: 30200, licence_ffc: 'FFC2024037', annee_adhesion: 2019, avatar_initial: 'C' },
    { id: 7, numero: 42, prenom: 'Sophie',   nom: 'Carpentier',  role: 'membre',     ftp_w: 232, km_saison: 2200, elevation_saison: 24800, annee_adhesion: 2021, avatar_initial: 'S' },
    { id: 8, numero: 48, prenom: 'Romain',   nom: 'Deprez',      role: 'membre',     ftp_w: 272, km_saison: 2980, elevation_saison: 35100, annee_adhesion: 2020, avatar_initial: 'R' },
    { id: 9, numero: 55, prenom: 'Nathalie', nom: 'Moreau',      role: 'membre',     ftp_w: 218, km_saison: 1980, elevation_saison: 21400, annee_adhesion: 2023, avatar_initial: 'N' },
    { id:10, numero: 62, prenom: 'Pierre',   nom: 'Laurent',     role: 'membre',     ftp_w: 255, km_saison: 2420, elevation_saison: 28600, annee_adhesion: 2022, avatar_initial: 'P' },
    { id:11, numero: 71, prenom: 'Hugo',     nom: 'Martin',      role: 'membre',     ftp_w: 290, km_saison: 3180, elevation_saison: 37800, licence_ffc: 'FFC2025071', annee_adhesion: 2025, avatar_initial: 'H' },
    { id:12, numero: 78, prenom: 'Élodie',   nom: 'Petit',       role: 'membre',     ftp_w: 205, km_saison: 1420, elevation_saison: 16200, annee_adhesion: 2025, avatar_initial: 'E' },
  ];
})();
