/* ═══════════════════════════════════════════════════════════════
   Club de Cyclisme de Salouel — data.js — v13
   Adapter pattern · données enrichies pour chaque sortie
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const DATA_BACKEND = 'static';

  /* ─── SORTIES — chacune a son GPX réel + ses POIs ──────────── */
  const SORTIES = [
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
      hero_img: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=2400&q=85',
      card_img: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=900&q=85',
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
      hero_img: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=2400&q=85',
      card_img: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=900&q=85',
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
      distance_km: 114,
      duration_label: '4h15',
      elevation_gain: 845,
      elevation_loss: 845,
      elevation_max: 225,
      elevation_min: 141,
      tss: 268, np_w: 215,
      tags: [
        { type: 'date',  label: 'Samedi 15 mars 2025' },
        { type: 'plain', label: 'Club' },
        { type: 'plain', label: 'Sortie № 245' }
      ],
      hero_img: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=2400&q=85',
      card_img: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=900&q=85',
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
      distance_km: 68,
      duration_label: '3h30',
      elevation_gain: 510,
      elevation_loss: 510,
      elevation_max: 87,
      elevation_min: 27,
      tss: 182, np_w: 195,
      tags: [
        { type: 'date',  label: 'Dimanche 2 mars 2025' },
        { type: 'brass', label: 'Gravel' },
        { type: 'plain', label: 'Sortie № 244' }
      ],
      hero_img: 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=2400&q=85',
      card_img: 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=900&q=85',
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
      distance_km: 103,
      duration_label: '4h40',
      elevation_gain: 775,
      elevation_loss: 775,
      elevation_max: 87,
      elevation_min: 11,
      tss: 245, np_w: 222,
      tags: [
        { type: 'date',  label: 'Samedi 22 février 2025' },
        { type: 'plain', label: 'Côte' },
        { type: 'plain', label: 'Sortie № 243' }
      ],
      hero_img: 'https://images.unsplash.com/photo-1605859888693-db1edf53b9f6?w=2400&q=85',
      card_img: 'https://images.unsplash.com/photo-1605859888693-db1edf53b9f6?w=900&q=85',
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
      hero_img: 'https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=2400&q=85',
      card_img: 'https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=900&q=85',
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
      distance_km: 84,
      duration_label: '3h20',
      elevation_gain: 600,
      elevation_loss: 600,
      elevation_max: 108,
      elevation_min: 30,
      tss: 196, np_w: 210,
      pave_km: 18,
      tags: [
        { type: 'date',  label: 'Dimanche 26 janvier 2025' },
        { type: 'brass', label: 'Pavé' },
        { type: 'plain', label: 'Sortie № 241' }
      ],
      hero_img: 'https://images.unsplash.com/photo-1571188654248-7a89213915f7?w=2400&q=85',
      card_img: 'https://images.unsplash.com/photo-1571188654248-7a89213915f7?w=900&q=85',
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
    }
  ];

  /* ─── POIs par sortie ──────────────────────────────────────── */
  const POIS = {
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
    ]
  };

  const SEED = {
    club: { name: 'C.C. Salouel', founded: 1978, president: 'Antoine Lemaire', licencies: 87 },
    sorties: SORTIES,
    pois: POIS
  };

  /* ─── Adapter pattern ─────────────────────────────────────── */
  class StaticAdapter {
    constructor(seed) { this.seed = seed; }
    async getClub() { return this.seed.club; }
    async listSorties() { return [...this.seed.sorties]; }
    async getSortie(id) { return this.seed.sorties.find(s => s.id === id); }
    async listPois(sortieId) {
      const base = this.seed.pois[sortieId] || [];
      try {
        const extra = JSON.parse(localStorage.getItem('pois:' + sortieId) || '[]');
        return [...base, ...extra].sort((a, b) => (a.km || 0) - (b.km || 0));
      } catch { return base; }
    }
    async addPoi(sortieId, poi) {
      const key = 'pois:' + sortieId;
      try {
        const cur = JSON.parse(localStorage.getItem(key) || '[]');
        poi.id = 'user-' + Date.now();
        poi._userAdded = true;
        cur.push(poi);
        localStorage.setItem(key, JSON.stringify(cur));
        return poi;
      } catch { return null; }
    }
    async deletePoi(sortieId, poiId) {
      if (!poiId || !poiId.startsWith('user-')) return false;
      const key = 'pois:' + sortieId;
      try {
        const cur = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify(cur.filter(p => p.id !== poiId)));
        return true;
      } catch { return false; }
    }
  }

  class FirebaseAdapter { constructor() { throw new Error('Firebase adapter: non implémenté'); } }
  class SupabaseAdapter { constructor() { throw new Error('Supabase adapter: non implémenté'); } }

  let adapter;
  if (DATA_BACKEND === 'firebase')      adapter = new FirebaseAdapter();
  else if (DATA_BACKEND === 'supabase') adapter = new SupabaseAdapter();
  else                                  adapter = new StaticAdapter(SEED);

  window.CCS_DATA = {
    adapter, backend: DATA_BACKEND, SEED,
    sorties:    () => adapter.listSorties(),
    sortie:     (id) => adapter.getSortie(id),
    pois:       (id) => adapter.listPois(id),
    addPoi:     (id, p) => adapter.addPoi(id, p),
    deletePoi:  (id, pid) => adapter.deletePoi(id, pid),
    /** URL helper — ouvre la page sortie pour un id donné */
    sortieUrl:  (id) => 'sortie.html?id=' + encodeURIComponent(id)
  };
})();
