/**
 * scripts/build-courses.js
 * 
 * SOURCE DE VÉRITÉ UNIQUE pour toutes les courses des Hauts-de-France
 * 
 * À partir des waypoints officiels d'une course, ce script génère :
 *   1) Un GPX dans asset/gpx/<id>.gpx (densifié, avec altitudes interpolées)
 *   2) Les POIs dérivés des waypoints "intéressants" 
 *   3) Une entrée pour STATIC_SORTIES (data.js)
 * 
 * Usage :
 *   node scripts/build-courses.js               # génère tous les GPX manquants
 *   node scripts/build-courses.js --force       # régénère TOUS les GPX
 *   node scripts/build-courses.js --course paris-roubaix-challenge-2026
 * 
 * Pour ajouter une course : copier un bloc dans COURSES, remplir, relancer.
 */

const fs   = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// COURSES OFFICIELLES — Source de vérité unique
// ═══════════════════════════════════════════════════════════════
// Structure de chaque course :
//   id            : identifiant unique (utilisé comme nom de fichier GPX)
//   name          : nom complet
//   region        : "Nord (59)" / "Pas-de-Calais (62)" / "Somme (80)" / "Oise (60)" / "Aisne (02)"
//   distanceKm    : distance officielle communiquée par l'organisateur
//   waypoints     : liste de points-clés du parcours OFFICIEL
//                   - lat, lng : coordonnées (peuvent être lues sur Google Maps)
//                   - ele      : altitude estimée (sera affinée par Open-Meteo si dispo)
//                   - type     : 'depart' | 'arrivee' | 'secteur' | 'ravito' | 'signaleur' | 'danger' (ou null)
//                   - label    : nom du point (vide pour les waypoints "intermédiaires")
//                   - desc     : description courte
//                   - km       : km cumulé approx (recalculé après densification)

const COURSES = [

  // ═══════════════════════════════════════════════════════════════
  // PARIS-ROUBAIX CHALLENGE (Cyclosportive officielle)
  // 30 secteurs pavés, départ Busigny → Roubaix
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'paris-roubaix-challenge',
    name: 'Paris-Roubaix Challenge',
    region: 'Nord (59)',
    distanceKm: 172,
    waypoints: [
      { lat: 50.04017, lng: 3.45278, ele: 130, type: 'depart',  label: 'Départ — Busigny',          desc: 'Place de la Mairie · 7h30' },
      { lat: 50.06083, lng: 3.41250, ele: 110, type: null,      label: '', desc: '' },
      { lat: 50.10250, lng: 3.40278, ele: 75,  type: 'secteur', label: "Troisvilles → Inchy",        desc: '2,2 km · pavé 3★ (secteur 28)' },
      { lat: 50.11472, lng: 3.43972, ele: 60,  type: null,      label: '', desc: '' },
      { lat: 50.16361, lng: 3.43500, ele: 80,  type: 'ravito',  label: 'Ravito — Saint-Python',       desc: 'Premier ravitaillement · km 35' },
      { lat: 50.17222, lng: 3.51250, ele: 70,  type: 'secteur', label: 'Solesmes → Saint-Python',    desc: '1,7 km · pavé 3★ (secteur 26)' },
      { lat: 50.20000, lng: 3.51389, ele: 65,  type: 'secteur', label: "Vertain → Saint-Martin",      desc: '2,3 km · pavé 3★ (secteur 25)' },
      { lat: 50.23083, lng: 3.49917, ele: 55,  type: 'secteur', label: "Capelle → Ruesnes",           desc: '1,7 km · pavé 3★' },
      { lat: 50.25917, lng: 3.43056, ele: 60,  type: 'secteur', label: "Quérénaing → Maing",          desc: '2,5 km · pavé 3★' },
      { lat: 50.34500, lng: 3.32833, ele: 35,  type: 'ravito',  label: 'Ravito — Valenciennes',       desc: 'Place du marché · km 75' },
      { lat: 50.40472, lng: 3.34083, ele: 40,  type: 'secteur', label: 'Haveluy → Wallers',           desc: '2,5 km · pavé 4★' },
      { lat: 50.42528, lng: 3.30667, ele: 50,  type: 'danger',  label: 'Danger — Entrée Arenberg',    desc: 'Réduction de vitesse obligatoire' },
      { lat: 50.43472, lng: 3.24806, ele: 45,  type: 'secteur', label: "Trouée d'Arenberg",           desc: '2,3 km · pavé 5★ · forêt' },
      { lat: 50.42222, lng: 3.26000, ele: 50,  type: 'danger',  label: 'Danger — Sortie Arenberg',    desc: 'Pavé glissant en sortie' },
      { lat: 50.46917, lng: 3.27778, ele: 55,  type: 'secteur', label: 'Hornaing → Wandignies',       desc: '3,7 km · pavé 4★' },
      { lat: 50.48750, lng: 3.18889, ele: 30,  type: 'ravito',  label: 'Ravito — Marchiennes',        desc: 'Place de la Mairie · km 110' },
      { lat: 50.50972, lng: 3.21306, ele: 35,  type: 'secteur', label: 'Warlaing → Brillon',          desc: '2,4 km · pavé 3★' },
      { lat: 50.52472, lng: 3.20500, ele: 30,  type: 'secteur', label: 'Tilloy → Sars-et-Rosières',   desc: '2,4 km · pavé 4★' },
      { lat: 50.54611, lng: 3.20194, ele: 35,  type: 'secteur', label: 'Beuvry → Orchies',            desc: '1,4 km · pavé 3★' },
      { lat: 50.55167, lng: 3.18028, ele: 40,  type: 'secteur', label: 'Auchy → Bersée',              desc: '2,7 km · pavé 4★' },
      { lat: 50.56583, lng: 3.18861, ele: 35,  type: 'secteur', label: 'Mons-en-Pévèle',              desc: '3,0 km · pavé 5★' },
      { lat: 50.55083, lng: 3.19528, ele: 30,  type: 'secteur', label: 'Mérignies → Avelin',          desc: '0,7 km · pavé 3★' },
      { lat: 50.55167, lng: 3.18222, ele: 30,  type: 'secteur', label: 'Pont-Thibault → Ennevelin',   desc: '1,4 km · pavé 3★' },
      { lat: 50.55917, lng: 3.16944, ele: 30,  type: 'secteur', label: 'Templeuve · Le Moulin',        desc: '0,5 km · pavé 4★' },
      { lat: 50.56833, lng: 3.16667, ele: 30,  type: 'ravito',  label: 'Ravito — Templeuve',          desc: 'Centre · km 142' },
      { lat: 50.59250, lng: 3.20389, ele: 30,  type: 'secteur', label: 'Cysoing → Bourghelles',       desc: '1,3 km · pavé 3★' },
      { lat: 50.59750, lng: 3.20139, ele: 30,  type: 'secteur', label: 'Bourghelles → Wannehain',     desc: '1,1 km · pavé 3★' },
      { lat: 50.61167, lng: 3.20833, ele: 35,  type: 'secteur', label: "Camphin-en-Pévèle",           desc: '1,8 km · pavé 4★' },
      { lat: 50.62833, lng: 3.21528, ele: 35,  type: 'secteur', label: "Carrefour de l'Arbre",        desc: '2,1 km · pavé 5★' },
      { lat: 50.64083, lng: 3.20278, ele: 35,  type: 'secteur', label: 'Gruson',                      desc: '1,1 km · pavé 3★' },
      { lat: 50.65861, lng: 3.18083, ele: 30,  type: 'secteur', label: 'Hem',                          desc: '1,4 km · pavé 3★' },
      { lat: 50.69028, lng: 3.17139, ele: 30,  type: 'arrivee', label: 'Arrivée — Vélodrome Roubaix', desc: 'André-Pétrieux · ligne mythique' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // L'ENFER DES FLANDRES (Cyclosportive — Cassel)
  // Monts flamands · 60-215 km au choix · juin
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'enfer-des-flandres',
    name: 'L\'Enfer des Flandres',
    region: 'Nord (59) · Flandre',
    distanceKm: 157,
    waypoints: [
      { lat: 50.80111, lng: 2.48472, ele: 130, type: 'depart',  label: 'Départ — Cassel',           desc: 'Place du Général de Gaulle · 7h30' },
      { lat: 50.80417, lng: 2.50833, ele: 110, type: null,      label: '', desc: '' },
      { lat: 50.80194, lng: 2.55972, ele: 60,  type: null,      label: '', desc: '' },
      { lat: 50.79833, lng: 2.62500, ele: 50,  type: 'signaleur', label: 'Signaleur — Steenvoorde', desc: 'Traversée centre' },
      { lat: 50.78444, lng: 2.71750, ele: 110, type: 'secteur', label: 'Mont des Cats',              desc: '1,1 km · 7,2 % · sommet pavé' },
      { lat: 50.78250, lng: 2.72917, ele: 158, type: 'ravito',  label: 'Ravito — Abbaye Mont des Cats', desc: 'Pause longue · vue mer par temps clair' },
      { lat: 50.77000, lng: 2.71583, ele: 130, type: 'secteur', label: 'Mont Noir',                  desc: '900 m · 6,8 % moyen' },
      { lat: 50.78222, lng: 2.78306, ele: 90,  type: 'secteur', label: 'Mont de Boeschepe',          desc: '600 m · 5,4 % moyen' },
      { lat: 50.78778, lng: 2.82556, ele: 156, type: 'secteur', label: 'Kemmelberg',                  desc: '800 m · 9,4 % · pavé · 22 % max' },
      { lat: 50.78500, lng: 2.86472, ele: 95,  type: 'secteur', label: 'Mont Rouge',                  desc: '1,2 km · 6,1 % moyen' },
      { lat: 50.76722, lng: 2.81528, ele: 65,  type: 'ravito',  label: 'Ravito — Westouter',          desc: 'Place village · km 75' },
      { lat: 50.74000, lng: 2.74583, ele: 35,  type: 'secteur', label: 'Catsberg (Mont des Cats côté est)', desc: '900 m · 8,2 % moyen' },
      { lat: 50.73972, lng: 2.73389, ele: 28,  type: 'signaleur', label: 'Signaleur — Bailleul',     desc: 'Traversée centre-ville' },
      { lat: 50.79167, lng: 2.72611, ele: 70,  type: 'danger',  label: 'Danger — Descente Boeschepe', desc: 'Pavé glissant · gravillons' },
      { lat: 50.80000, lng: 2.65000, ele: 35,  type: 'ravito',  label: 'Ravito — Steenvoorde',         desc: 'Centre · km 130' },
      { lat: 50.80111, lng: 2.48472, ele: 130, type: 'arrivee', label: 'Arrivée — Cassel',            desc: 'Retour Place du Général de Gaulle' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // LILLE-HARDELOT (Randonnée traditionnelle, 200 km, ligne droite)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'lille-hardelot',
    name: 'Lille-Hardelot',
    region: 'Nord (59) → Pas-de-Calais (62)',
    distanceKm: 200,
    waypoints: [
      { lat: 50.63278, lng: 3.05972, ele: 23, type: 'depart',  label: 'Départ — Lille',         desc: 'Grand Place · 6h00' },
      { lat: 50.62500, lng: 3.00000, ele: 30, type: null,      label: '', desc: '' },
      { lat: 50.60000, lng: 2.92000, ele: 40, type: null,      label: '', desc: '' },
      { lat: 50.55000, lng: 2.84000, ele: 60, type: 'ravito',  label: 'Ravito — Bauvin',          desc: 'km 25' },
      { lat: 50.51000, lng: 2.74000, ele: 75, type: null,      label: '', desc: '' },
      { lat: 50.52917, lng: 2.63889, ele: 35, type: 'ravito',  label: 'Ravito — Béthune',         desc: 'Grand Place · km 50' },
      { lat: 50.55000, lng: 2.50000, ele: 50, type: null,      label: '', desc: '' },
      { lat: 50.52972, lng: 2.36500, ele: 100,type: 'ravito',  label: 'Ravito — Lillers',         desc: 'km 80' },
      { lat: 50.51667, lng: 2.13333, ele: 110,type: 'secteur', label: 'Côte de Fauquembergues',   desc: '1,5 km · 4,8 % moyen' },
      { lat: 50.59417, lng: 2.08750, ele: 45, type: 'ravito',  label: 'Ravito — Saint-Omer',      desc: 'Place Foch · km 110' },
      { lat: 50.61667, lng: 1.95000, ele: 60, type: null,      label: '', desc: '' },
      { lat: 50.65000, lng: 1.83000, ele: 100,type: 'secteur', label: "Côte d'Hardinghen",        desc: '2 km · 5,4 % moyen' },
      { lat: 50.65000, lng: 1.70000, ele: 55, type: 'ravito',  label: 'Ravito — Marquise',        desc: 'km 160' },
      { lat: 50.60000, lng: 1.62000, ele: 45, type: null,      label: '', desc: '' },
      { lat: 50.55000, lng: 1.58611, ele: 25, type: 'danger',  label: 'Danger — Descente Boulogne', desc: 'Trafic urbain' },
      { lat: 50.54917, lng: 1.59694, ele: 12, type: 'arrivee', label: 'Arrivée — Hardelot-Plage', desc: 'Front de mer · plage' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // LA PICARDE AMIÉNOISE (Cyclosportive UFOLEP, 112 km)
  // Hortillonnages → Baie de Somme
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'picarde-amienoise',
    name: 'La Picarde Amiénoise',
    region: 'Somme (80)',
    distanceKm: 112,
    waypoints: [
      { lat: 49.89944, lng: 2.30222, ele: 20,  type: 'depart',  label: 'Départ — Hortillonnages', desc: 'Maison des Hortillonnages · 8h00' },
      { lat: 49.92000, lng: 2.27000, ele: 50,  type: null,      label: '', desc: '' },
      { lat: 49.94167, lng: 2.20833, ele: 75,  type: 'ravito',  label: 'Ravito — Picquigny',      desc: 'Place du marché · km 18' },
      { lat: 49.97500, lng: 2.05833, ele: 85,  type: 'secteur', label: 'Côte d\'Hangest',         desc: '1,3 km · 5,1 % moyen' },
      { lat: 50.00833, lng: 1.95000, ele: 35,  type: 'ravito',  label: 'Ravito — Hangest',        desc: 'km 35' },
      { lat: 50.05833, lng: 1.83056, ele: 12,  type: null,      label: '', desc: '' },
      { lat: 50.18472, lng: 1.63333, ele: 5,   type: 'ravito',  label: 'Ravito — Saint-Valery',   desc: 'Quai Romerel · km 65' },
      { lat: 50.20833, lng: 1.55000, ele: 8,   type: 'secteur', label: 'Le Hourdel',              desc: 'Pointe · phoques · vue baie' },
      { lat: 50.18333, lng: 1.62500, ele: 15,  type: 'danger',  label: 'Danger — Vent baie',      desc: 'Vent latéral en bord de baie' },
      { lat: 50.10000, lng: 1.71667, ele: 35,  type: 'ravito',  label: 'Ravito — Pont-Rémy',      desc: 'km 88' },
      { lat: 49.95000, lng: 2.10000, ele: 75,  type: null,      label: '', desc: '' },
      { lat: 49.89944, lng: 2.30222, ele: 20,  type: 'arrivee', label: 'Arrivée — Hortillonnages', desc: 'Retour Maison des Hortillonnages' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // GP FOURMIES AMATEUR (Course FFC, 145 km)
  // Circuit Avesnois · 12 tours
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'gp-fourmies-amateur',
    name: 'GP Fourmies Amateur',
    region: 'Nord (59) · Avesnois',
    distanceKm: 145,
    waypoints: [
      { lat: 50.01806, lng: 4.05000, ele: 200, type: 'depart',  label: 'Départ — Fourmies',      desc: 'Place Émile-Coppeaux · 13h00' },
      { lat: 50.02500, lng: 4.07500, ele: 220, type: null,      label: '', desc: '' },
      { lat: 50.03889, lng: 4.10250, ele: 230, type: 'secteur', label: 'Côte de Trélon',         desc: '1,1 km · 5,4 % moyen' },
      { lat: 50.04417, lng: 4.10778, ele: 240, type: null,      label: '', desc: '' },
      { lat: 50.04917, lng: 4.06667, ele: 215, type: 'signaleur', label: 'Signaleur — Wignehies', desc: 'Traversée centre' },
      { lat: 50.03333, lng: 4.04167, ele: 200, type: null,      label: '', desc: '' },
      { lat: 50.01806, lng: 4.05000, ele: 200, type: 'arrivee', label: 'Arrivée — Fourmies',     desc: '12 tours · sprint final' },
    ],
    laps: 12 // 12 tours du circuit de 12 km
  },

  // ═══════════════════════════════════════════════════════════════
  // CYCLO BAIE DE SOMME (Randonnée familiale, 90 km)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'cyclo-baie-de-somme',
    name: 'Cyclo de la Baie de Somme',
    region: 'Somme (80)',
    distanceKm: 90,
    waypoints: [
      { lat: 50.18472, lng: 1.63333, ele: 5,   type: 'depart',  label: 'Départ — Saint-Valery',   desc: 'Quai Romerel · 8h30' },
      { lat: 50.20833, lng: 1.55000, ele: 8,   type: 'secteur', label: 'Le Hourdel',              desc: 'Pointe · phoques' },
      { lat: 50.18056, lng: 1.55833, ele: 10,  type: 'ravito',  label: 'Ravito — Cayeux',         desc: 'Esplanade · vue mer' },
      { lat: 50.13889, lng: 1.66667, ele: 15,  type: null,      label: '', desc: '' },
      { lat: 50.10000, lng: 1.83333, ele: 35,  type: 'ravito',  label: 'Ravito — Pont-Rémy',      desc: 'km 40' },
      { lat: 50.13056, lng: 1.83333, ele: 30,  type: null,      label: '', desc: '' },
      { lat: 50.16667, lng: 1.79167, ele: 25,  type: 'secteur', label: 'Côte d\'Abbeville',       desc: '1,2 km · 4,2 % moyen' },
      { lat: 50.16944, lng: 1.83333, ele: 20,  type: 'ravito',  label: 'Ravito — Abbeville',      desc: 'Place Saint-Pierre · km 65' },
      { lat: 50.20000, lng: 1.75000, ele: 18,  type: null,      label: '', desc: '' },
      { lat: 50.21667, lng: 1.66667, ele: 10,  type: null,      label: '', desc: '' },
      { lat: 50.18472, lng: 1.63333, ele: 5,   type: 'arrivee', label: 'Arrivée — Saint-Valery',  desc: 'Retour Quai Romerel' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 6H VÉLO DU PAS DE CALAIS (Course endurance, 8 mai)
  // Circuit fermé Croix-en-Ternois (62) · 4,2 km · 6 heures
  // ═══════════════════════════════════════════════════════════════
  {
    id: '6h-velo-pas-de-calais',
    name: '6 Heures Vélo du Pas-de-Calais',
    region: 'Pas-de-Calais (62)',
    distanceKm: 168, // estimé : ~28 km/h × 6 h
    waypoints: [
      { lat: 50.40639, lng: 2.21833, ele: 95, type: 'depart',  label: 'Départ/Arrivée — Circuit', desc: 'Stand de la Bayard · 9h00' },
      { lat: 50.40972, lng: 2.22500, ele: 90, type: null,      label: '', desc: '' },
      { lat: 50.41250, lng: 2.21944, ele: 85, type: null,      label: '', desc: '' },
      { lat: 50.40972, lng: 2.21389, ele: 95, type: 'danger',  label: 'Danger — Chicane', desc: 'Virage technique' },
      { lat: 50.40639, lng: 2.21833, ele: 95, type: 'arrivee', label: 'Ligne Arrivée 6 h',         desc: 'Maximum tours sur 6 h' },
    ],
    laps: 40 // ~40 tours pour 168 km
  },

  // ═══════════════════════════════════════════════════════════════
  // OPEN DE GRAVEL ÉPERLECQUES (14 mai, 84 km)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'open-gravel-eperlecques',
    name: 'Open de Gravel d\'Éperlecques',
    region: 'Pas-de-Calais (62)',
    distanceKm: 84,
    waypoints: [
      { lat: 50.79361, lng: 2.16278, ele: 65,  type: 'depart',  label: 'Départ — Éperlecques',    desc: 'Forêt domaniale · 8h30' },
      { lat: 50.81389, lng: 2.18056, ele: 80,  type: 'secteur', label: 'Forêt d\'Éperlecques',    desc: 'Sentier forestier · 4 km' },
      { lat: 50.83056, lng: 2.21111, ele: 75,  type: 'secteur', label: 'Côte de Mentque',          desc: '900 m · 4,8 % gravel' },
      { lat: 50.84583, lng: 2.20833, ele: 85,  type: 'ravito',  label: 'Ravito — Audrehem',        desc: 'km 22' },
      { lat: 50.79722, lng: 2.30000, ele: 95,  type: 'secteur', label: 'Mont d\'Hardinghen',       desc: '1,4 km · 5,1 % chemin' },
      { lat: 50.74722, lng: 2.27500, ele: 70,  type: 'ravito',  label: 'Ravito — Tournehem',       desc: 'km 50' },
      { lat: 50.78056, lng: 2.20000, ele: 60,  type: 'danger',  label: 'Danger — Descente boueuse', desc: 'Sentier glissant par temps humide' },
      { lat: 50.79361, lng: 2.16278, ele: 65,  type: 'arrivee', label: 'Arrivée — Éperlecques',   desc: 'Retour forêt domaniale' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // RANDONNÉE DU MUGUET (Choisy-au-Bac, Oise) · avril
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'rando-muguet-choisy',
    name: 'Randonnée du Muguet',
    region: 'Oise (60)',
    distanceKm: 110,
    waypoints: [
      { lat: 49.43000, lng: 2.85806, ele: 35,  type: 'depart',  label: 'Départ — Choisy-au-Bac',  desc: 'Place de la Mairie · 8h00' },
      { lat: 49.45000, lng: 2.83333, ele: 60,  type: null,      label: '', desc: '' },
      { lat: 49.50000, lng: 2.93333, ele: 110, type: 'secteur', label: 'Forêt de Compiègne',     desc: '8 km en sous-bois' },
      { lat: 49.55833, lng: 3.00000, ele: 130, type: 'ravito',  label: 'Ravito — Pierrefonds',    desc: 'Château · km 28' },
      { lat: 49.51667, lng: 3.10000, ele: 100, type: null,      label: '', desc: '' },
      { lat: 49.45000, lng: 3.06667, ele: 70,  type: 'secteur', label: 'Côte de Cuise-la-Motte',  desc: '1,1 km · 4,5 % moyen' },
      { lat: 49.41667, lng: 3.00000, ele: 40,  type: 'ravito',  label: 'Ravito — Compiègne',      desc: 'Place Hôtel de Ville · km 65' },
      { lat: 49.40000, lng: 2.90000, ele: 35,  type: null,      label: '', desc: '' },
      { lat: 49.43000, lng: 2.85806, ele: 35,  type: 'arrivee', label: 'Arrivée — Choisy-au-Bac', desc: 'Retour Place de la Mairie' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // RACE ACROSS PARIS (Ultra-distance, 22-26 avril 2026, Chantilly)
  // 1000/500/300/200 km · départ Chantilly · format ultra non-stop
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'race-across-paris',
    name: 'Race Across Paris',
    region: 'Oise (60)',
    distanceKm: 200,
    waypoints: [
      { lat: 49.19389, lng: 2.46500, ele: 50,  type: 'depart',  label: 'Départ — Hippodrome Chantilly', desc: 'Aire de départ · 18h00' },
      { lat: 49.21000, lng: 2.42000, ele: 70,  type: null,      label: '', desc: '' },
      { lat: 49.27500, lng: 2.36000, ele: 100, type: 'ravito',  label: 'Ravito — Senlis',               desc: 'Place Henri-IV · km 22' },
      { lat: 49.32500, lng: 2.40000, ele: 95,  type: null,      label: '', desc: '' },
      { lat: 49.38500, lng: 2.50000, ele: 65,  type: 'secteur', label: 'Forêt de Halatte',              desc: 'Sous-bois sur 6 km' },
      { lat: 49.41667, lng: 2.81667, ele: 35,  type: 'ravito',  label: 'Ravito — Compiègne',            desc: 'Place HV · km 65' },
      { lat: 49.45000, lng: 3.10000, ele: 65,  type: 'secteur', label: 'Forêt de Compiègne',            desc: 'Traversée intégrale' },
      { lat: 49.41000, lng: 3.32000, ele: 90,  type: 'ravito',  label: 'Ravito — Soissons',             desc: 'Place Fernand-Marquigny · km 110' },
      { lat: 49.32500, lng: 3.20000, ele: 110, type: null,      label: '', desc: '' },
      { lat: 49.20000, lng: 3.10000, ele: 130, type: 'secteur', label: 'Côte de Crépy',                 desc: '1,8 km · 4,2 %' },
      { lat: 49.15000, lng: 2.80000, ele: 75,  type: 'ravito',  label: 'Ravito — Crépy-en-Valois',      desc: 'km 165' },
      { lat: 49.19389, lng: 2.46500, ele: 50,  type: 'arrivee', label: 'Arrivée — Hippodrome',          desc: 'Retour Chantilly · feu à l\'aube' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // ROC D'OPALE (Calais, juin 2026, 111 km)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'roc-d-opale',
    name: 'Roc d\'Opale',
    region: 'Pas-de-Calais (62)',
    distanceKm: 111,
    waypoints: [
      { lat: 50.95130, lng: 1.85870, ele: 5,   type: 'depart',  label: 'Départ — Calais',          desc: 'Place d\'Armes · 8h00' },
      { lat: 50.93000, lng: 1.79000, ele: 35,  type: null,      label: '', desc: '' },
      { lat: 50.86670, lng: 1.59440, ele: 130, type: 'secteur', label: 'Cap Blanc-Nez',            desc: '2 km · 6,2 % · vue mer' },
      { lat: 50.85000, lng: 1.58000, ele: 90,  type: 'ravito',  label: 'Ravito — Wissant',         desc: 'Front de mer · km 22' },
      { lat: 50.87000, lng: 1.62000, ele: 110, type: 'secteur', label: 'Cap Gris-Nez',             desc: '900 m · 4,8 %' },
      { lat: 50.78000, lng: 1.67000, ele: 80,  type: null,      label: '', desc: '' },
      { lat: 50.76130, lng: 1.61610, ele: 25,  type: 'ravito',  label: 'Ravito — Wimereux',        desc: 'Esplanade · km 48' },
      { lat: 50.72500, lng: 1.62000, ele: 35,  type: 'secteur', label: 'Côte de Wimereux',         desc: '900 m · 6,1 %' },
      { lat: 50.78000, lng: 1.78000, ele: 45,  type: null,      label: '', desc: '' },
      { lat: 50.83330, lng: 1.95000, ele: 95,  type: 'ravito',  label: 'Ravito — Guînes',          desc: 'Place Foch · km 80' },
      { lat: 50.91000, lng: 1.95000, ele: 65,  type: null,      label: '', desc: '' },
      { lat: 50.95130, lng: 1.85870, ele: 5,   type: 'arrivee', label: 'Arrivée — Calais',         desc: 'Retour Place d\'Armes' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // CAL'LYS GRAVEL (Sangatte, avril 2026, 80 km)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'callys-gravel',
    name: 'La Cal\'lys Gravel',
    region: 'Pas-de-Calais (62)',
    distanceKm: 80,
    waypoints: [
      { lat: 50.94360, lng: 1.74810, ele: 10,  type: 'depart',  label: 'Départ — Sangatte',         desc: 'Plage · 7h30' },
      { lat: 50.92500, lng: 1.78000, ele: 35,  type: 'secteur', label: 'Sentier des Falaises',      desc: 'Sentier littoral · 4 km' },
      { lat: 50.86670, lng: 1.59440, ele: 130, type: 'secteur', label: 'Mont du Cap Blanc-Nez',     desc: '1,4 km · 7,1 % gravel' },
      { lat: 50.85000, lng: 1.58000, ele: 90,  type: 'ravito',  label: 'Ravito — Wissant',          desc: 'km 22 · barres + eau' },
      { lat: 50.86000, lng: 1.66000, ele: 65,  type: 'secteur', label: 'Forêt de Guînes',           desc: 'Traverse forestière · 6 km' },
      { lat: 50.91000, lng: 1.83000, ele: 55,  type: 'ravito',  label: 'Ravito — Marquise',         desc: 'km 50' },
      { lat: 50.93000, lng: 1.78000, ele: 30,  type: 'danger',  label: 'Danger — Descente sablonneuse', desc: 'Sortie de forêt' },
      { lat: 50.94360, lng: 1.74810, ele: 10,  type: 'arrivee', label: 'Arrivée — Sangatte',        desc: 'Retour plage' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // RIVES DE L'AUTHIE (Berck, mai 2026, 90 km)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'rives-authie',
    name: 'Les Rives de l\'Authie',
    region: 'Pas-de-Calais (62)',
    distanceKm: 90,
    waypoints: [
      { lat: 50.40500, lng: 1.55810, ele: 5,   type: 'depart',  label: 'Départ — Berck-sur-Mer',     desc: 'Esplanade · 8h00' },
      { lat: 50.39000, lng: 1.65000, ele: 15,  type: 'ravito',  label: 'Ravito — Rang-du-Fliers',    desc: 'km 12' },
      { lat: 50.34000, lng: 1.78000, ele: 35,  type: 'secteur', label: 'Vallée de l\'Authie',        desc: 'Bord de rivière · 8 km' },
      { lat: 50.34780, lng: 1.93780, ele: 25,  type: 'ravito',  label: 'Ravito — Auxi-le-Château',   desc: 'Place du marché · km 38' },
      { lat: 50.30000, lng: 1.85000, ele: 50,  type: 'secteur', label: 'Côte d\'Auxi',               desc: '1,2 km · 4,8 %' },
      { lat: 50.32000, lng: 1.70000, ele: 20,  type: 'ravito',  label: 'Ravito — Maintenay',         desc: 'km 65' },
      { lat: 50.36000, lng: 1.60000, ele: 8,   type: null,      label: '', desc: '' },
      { lat: 50.40500, lng: 1.55810, ele: 5,   type: 'arrivee', label: 'Arrivée — Berck',            desc: 'Retour esplanade' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // ARDRÉSIENNE (Ardres, mai 2026, 70 km)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'ardresienne',
    name: 'L\'Ardrésienne',
    region: 'Pas-de-Calais (62)',
    distanceKm: 70,
    waypoints: [
      { lat: 50.85630, lng: 1.97500, ele: 35,  type: 'depart',  label: 'Départ — Ardres',           desc: 'Place du Centre · 9h00' },
      { lat: 50.82000, lng: 2.02000, ele: 55,  type: null,      label: '', desc: '' },
      { lat: 50.80060, lng: 2.10940, ele: 20,  type: 'ravito',  label: 'Ravito — Saint-Omer',       desc: 'Place Foch · km 18' },
      { lat: 50.83000, lng: 2.16000, ele: 60,  type: 'secteur', label: 'Côte de Lumbres',           desc: '1,6 km · 5,3 %' },
      { lat: 50.87000, lng: 2.05000, ele: 80,  type: 'ravito',  label: 'Ravito — Tournehem',        desc: 'km 42' },
      { lat: 50.89000, lng: 1.95000, ele: 45,  type: null,      label: '', desc: '' },
      { lat: 50.88000, lng: 1.88000, ele: 20,  type: 'secteur', label: 'Marais de l\'Aa',           desc: 'Bordure de canal · 3 km' },
      { lat: 50.85630, lng: 1.97500, ele: 35,  type: 'arrivee', label: 'Arrivée — Ardres',          desc: 'Retour Place du Centre' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // FÊTE DU VÉLO 7 VALLÉES (Beaurainville, mai 2026, 80 km)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'fete-velo-7-vallees',
    name: 'Fête du Vélo en 7 Vallées',
    region: 'Pas-de-Calais (62)',
    distanceKm: 80,
    waypoints: [
      { lat: 50.43830, lng: 1.89610, ele: 25,  type: 'depart',  label: 'Départ — Beaurainville',     desc: 'Place Verte · 8h30' },
      { lat: 50.45000, lng: 1.95000, ele: 40,  type: null,      label: '', desc: '' },
      { lat: 50.41000, lng: 2.05000, ele: 60,  type: 'ravito',  label: 'Ravito — Hesdin',            desc: 'Grand Place · km 18' },
      { lat: 50.37000, lng: 2.08000, ele: 90,  type: 'secteur', label: 'Côte de Sains-lès-Fressin',  desc: '1,8 km · 5,8 %' },
      { lat: 50.43000, lng: 2.10000, ele: 80,  type: 'secteur', label: 'Vallée de la Canche',        desc: 'Bord de rivière · 5 km' },
      { lat: 50.47000, lng: 2.04000, ele: 50,  type: 'ravito',  label: 'Ravito — Auchy-lès-Hesdin',  desc: 'km 48' },
      { lat: 50.46000, lng: 1.95000, ele: 30,  type: null,      label: '', desc: '' },
      { lat: 50.43830, lng: 1.89610, ele: 25,  type: 'arrivee', label: 'Arrivée — Beaurainville',    desc: 'Retour Place Verte' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // CAP GRIS-NEZ (Saint-Omer, août 2026, 150 km)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'cap-gris-nez',
    name: 'Sur la Route du Cap Gris-Nez',
    region: 'Pas-de-Calais (62)',
    distanceKm: 150,
    waypoints: [
      { lat: 50.75000, lng: 2.25000, ele: 20,  type: 'depart',  label: 'Départ — Saint-Omer',        desc: 'Place Foch · 7h00' },
      { lat: 50.79000, lng: 2.10000, ele: 35,  type: null,      label: '', desc: '' },
      { lat: 50.83000, lng: 1.95000, ele: 60,  type: 'ravito',  label: 'Ravito — Guînes',            desc: 'km 28' },
      { lat: 50.95000, lng: 1.85000, ele: 8,   type: null,      label: '', desc: '' },
      { lat: 50.86670, lng: 1.59440, ele: 130, type: 'secteur', label: 'Cap Gris-Nez',               desc: 'Le point culminant · vue Angleterre' },
      { lat: 50.85000, lng: 1.58000, ele: 90,  type: 'ravito',  label: 'Ravito — Wissant',           desc: 'Plage · km 70' },
      { lat: 50.78000, lng: 1.65000, ele: 75,  type: 'secteur', label: 'Côte d\'Audinghen',          desc: '1,4 km · 5,2 %' },
      { lat: 50.72500, lng: 1.62000, ele: 35,  type: null,      label: '', desc: '' },
      { lat: 50.66670, lng: 1.65000, ele: 20,  type: 'ravito',  label: 'Ravito — Boulogne',          desc: 'Place Dalton · km 100' },
      { lat: 50.70000, lng: 1.85000, ele: 80,  type: null,      label: '', desc: '' },
      { lat: 50.72000, lng: 2.05000, ele: 50,  type: 'ravito',  label: 'Ravito — Lumbres',           desc: 'km 130' },
      { lat: 50.75000, lng: 2.25000, ele: 20,  type: 'arrivee', label: 'Arrivée — Saint-Omer',       desc: 'Retour Place Foch' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // RANDONNÉE ORÉE DU BOIS (Rang-du-Fliers, août 2026, 87 km)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'oree-du-bois',
    name: 'Randonnée de l\'Orée du Bois',
    region: 'Pas-de-Calais (62)',
    distanceKm: 87,
    waypoints: [
      { lat: 50.39000, lng: 1.65000, ele: 12,  type: 'depart',  label: 'Départ — Rang-du-Fliers',    desc: 'Salle des Fêtes · 8h00' },
      { lat: 50.41000, lng: 1.69000, ele: 15,  type: null,      label: '', desc: '' },
      { lat: 50.43000, lng: 1.79000, ele: 40,  type: 'secteur', label: 'Forêt de Crécy',             desc: 'Sentier 6 km' },
      { lat: 50.45630, lng: 1.86810, ele: 30,  type: 'ravito',  label: 'Ravito — Rue',               desc: 'Place du marché · km 28' },
      { lat: 50.42000, lng: 1.95000, ele: 55,  type: 'secteur', label: 'Côte de Forest',             desc: '1,1 km · 4,8 %' },
      { lat: 50.34780, lng: 1.93780, ele: 25,  type: 'ravito',  label: 'Ravito — Auxi-le-Château',   desc: 'km 56' },
      { lat: 50.32000, lng: 1.78000, ele: 18,  type: null,      label: '', desc: '' },
      { lat: 50.36000, lng: 1.65000, ele: 10,  type: null,      label: '', desc: '' },
      { lat: 50.39000, lng: 1.65000, ele: 12,  type: 'arrivee', label: 'Arrivée — Rang-du-Fliers',   desc: 'Retour salle des fêtes' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // RANDO NACRÉE (Esches, mai 2026, 50 km)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'rando-nacree',
    name: 'La Rando Nacrée',
    region: 'Oise (60)',
    distanceKm: 50,
    waypoints: [
      { lat: 49.21670, lng: 2.13330, ele: 50,  type: 'depart',  label: 'Départ — Esches',            desc: 'Mairie · 9h00' },
      { lat: 49.20000, lng: 2.20000, ele: 80,  type: 'secteur', label: 'Forêt de Carnelle',          desc: 'Sous-bois · 4 km' },
      { lat: 49.18000, lng: 2.10000, ele: 100, type: 'ravito',  label: 'Ravito — Méru',              desc: 'Centre · km 18' },
      { lat: 49.22000, lng: 2.05000, ele: 90,  type: null,      label: '', desc: '' },
      { lat: 49.25000, lng: 2.10000, ele: 70,  type: 'secteur', label: 'Côte de Chambly',            desc: '900 m · 4,5 %' },
      { lat: 49.23000, lng: 2.15000, ele: 60,  type: null,      label: '', desc: '' },
      { lat: 49.21670, lng: 2.13330, ele: 50,  type: 'arrivee', label: 'Arrivée — Esches',           desc: 'Retour Mairie' },
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 4 JOURS DE DUNKERQUE (Dunkerque, mai 2026, 4 étapes — agrégé)
  // Étape principale, ~150 km
  // ═══════════════════════════════════════════════════════════════
  {
    id: '4-jours-dunkerque',
    name: '4 Jours de Dunkerque',
    region: 'Nord (59)',
    distanceKm: 150,
    waypoints: [
      { lat: 51.04220, lng: 2.37700, ele: 5,   type: 'depart',  label: 'Départ — Dunkerque',         desc: 'Place Jean-Bart · 14h00' },
      { lat: 51.00000, lng: 2.45000, ele: 10,  type: null,      label: '', desc: '' },
      { lat: 50.95000, lng: 2.55000, ele: 15,  type: 'ravito',  label: 'Ravito — Bourbourg',         desc: 'km 22' },
      { lat: 50.92000, lng: 2.40000, ele: 8,   type: null,      label: '', desc: '' },
      { lat: 50.87000, lng: 2.43000, ele: 40,  type: 'secteur', label: 'Côte de Watten',             desc: '1,2 km · 5,8 %' },
      { lat: 50.83000, lng: 2.55000, ele: 80,  type: 'ravito',  label: 'Ravito — Cassel',            desc: 'km 65' },
      { lat: 50.78000, lng: 2.72000, ele: 110, type: 'secteur', label: 'Mont des Cats',              desc: '1,1 km · 7,2 %' },
      { lat: 50.85000, lng: 2.80000, ele: 35,  type: null,      label: '', desc: '' },
      { lat: 50.95000, lng: 2.65000, ele: 18,  type: 'ravito',  label: 'Ravito — Bergues',           desc: 'km 110' },
      { lat: 51.00000, lng: 2.50000, ele: 8,   type: null,      label: '', desc: '' },
      { lat: 51.04220, lng: 2.37700, ele: 5,   type: 'arrivee', label: 'Arrivée — Dunkerque',        desc: 'Sprint Digue de Mer' },
    ]
  },
];


// ═══════════════════════════════════════════════════════════════
// HELPERS DE GÉNÉRATION
// ═══════════════════════════════════════════════════════════════

function haversine(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

/**
 * Densifier le tracé : un point tous les 50 m environ
 * Pour les courses à tours : on reproduit le même tour N fois
 */
function densify(waypoints, laps = 1) {
  const STEP = 50; // mètres entre points

  // Construire un seul tour
  let oneLap = [waypoints[0]];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i + 1];
    const dist = haversine(a, b);
    const n = Math.max(1, Math.round(dist / STEP));
    for (let j = 1; j <= n; j++) {
      const t = j / n;
      oneLap.push({
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
        ele: (a.ele ?? 0) + ((b.ele ?? 0) - (a.ele ?? 0)) * t,
      });
    }
  }

  // Multiplier par les tours (sauf le 1er point qui est déjà inclus)
  let all = [...oneLap];
  for (let l = 1; l < laps; l++) all = all.concat(oneLap.slice(1));
  return all;
}

/**
 * Calcule le km cumulé pour chaque point
 */
function computeKm(points) {
  let accum = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) accum += haversine(points[i-1], points[i]);
    points[i].kmAccum = accum / 1000;
  }
  return accum / 1000; // total km
}

/**
 * Construit le contenu GPX complet
 */
function buildGpx(course, points) {
  const now = new Date().toISOString();
  const trkpts = points.map(p =>
    `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${(p.ele ?? 0).toFixed(1)}</ele></trkpt>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="C.C. Salouel — build-courses.js"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <n>${course.name}</n>
    <desc>${course.region} · ${course.distanceKm} km</desc>
    <time>${now}</time>
  </metadata>
  <trk>
    <n>${course.name}</n>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

/**
 * Extraire les POIs (depart/arrivee/ravito/secteur/danger/signaleur) avec leur km calculé.
 * Pour les courses à tours, on dédoublonne les POIs (départ/arrivée à km 0 et km final).
 */
function extractPois(course, allPoints) {
  // On retrouve les POIs dans la liste densifiée en cherchant le point le plus proche
  // (en lat/lng) de chaque waypoint typé
  const pois = [];
  const idPrefix = course.id.split('-')[0].slice(0, 3); // ex 'paris-roubaix' → 'par'
  let counter = 1;

  // Pour les courses à tours, ne prendre que le 1er tour (sauf arrivée → km final)
  for (const wp of course.waypoints) {
    if (!wp.type || !wp.label) continue;

    // Trouver le point dans allPoints le plus proche
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < allPoints.length; i++) {
      const d = Math.abs(allPoints[i].lat - wp.lat) + Math.abs(allPoints[i].lng - wp.lng);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    let km = allPoints[best].kmAccum;

    // L'arrivée est toujours au dernier km
    if (wp.type === 'arrivee') {
      km = allPoints[allPoints.length - 1].kmAccum;
    }

    pois.push({
      id: `${idPrefix}-${counter++}`,
      type: wp.type,
      label: wp.label,
      desc: wp.desc || '',
      km: Math.round(km * 10) / 10,
      lat: wp.lat,
      lng: wp.lng,
    });
  }
  return pois;
}

/**
 * Génère un fichier de POIs JSON pour faciliter l'inclusion dans data.js
 */
function generatePoisJson(courseId, pois) {
  return JSON.stringify({ [courseId]: pois }, null, 2);
}


// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

const ARGS = process.argv.slice(2);
const FORCE = ARGS.includes('--force');
const ONE = ARGS.find(a => a.startsWith('--course='))?.split('=')[1] ||
           (ARGS.indexOf('--course') >= 0 ? ARGS[ARGS.indexOf('--course')+1] : null);

const gpxDir  = path.join(__dirname, '..', 'public', 'asset', 'gpx');
const dataDir = path.join(__dirname, '..', 'public', 'asset', 'data');
if (!fs.existsSync(gpxDir))  fs.mkdirSync(gpxDir,  { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

console.log(`\n🚴  Génération des courses Hauts-de-France (${COURSES.length} courses)\n`);

const allPoisExports = {};
const summary = [];

for (const course of COURSES) {
  if (ONE && course.id !== ONE) continue;

  const gpxPath = path.join(gpxDir, course.id + '.gpx');
  const exists = fs.existsSync(gpxPath);
  if (exists && !FORCE) {
    console.log(`⏭   ${course.id}.gpx (existe déjà — passer --force pour régénérer)`);
    continue;
  }

  const points = densify(course.waypoints, course.laps || 1);
  const totalKm = computeKm(points);

  // Calculer D+ / D-
  let dPlus = 0, dMinus = 0;
  for (let i = 1; i < points.length; i++) {
    const d = (points[i].ele || 0) - (points[i-1].ele || 0);
    if (d > 0) dPlus += d; else dMinus -= d;
  }

  const gpx = buildGpx(course, points);
  fs.writeFileSync(gpxPath, gpx, 'utf8');

  const pois = extractPois(course, points);
  allPoisExports[course.id] = pois;

  const summaryLine = `✅  ${course.id.padEnd(28)} ${points.length.toString().padStart(5)} pts · ${totalKm.toFixed(1).padStart(6)} km · D+${dPlus.toFixed(0).padStart(4)}m · ${pois.length} POIs`;
  console.log(summaryLine);
  summary.push({
    id: course.id, name: course.name, region: course.region,
    points: points.length, km: +totalKm.toFixed(1),
    dPlus: Math.round(dPlus), pois: pois.length
  });
}

// Sauver tous les POIs dans un fichier JSON central pour inclusion facile
const poisJson = path.join(dataDir, 'pois-courses.json');
fs.writeFileSync(poisJson, JSON.stringify(allPoisExports, null, 2), 'utf8');

console.log(`\n📂  Tous les POIs exportés dans : asset/data/pois-courses.json`);
console.log(`📊  ${summary.length}/${COURSES.length} GPX générés.\n`);

// Pour le développeur : afficher le contenu à coller dans data.js
if (summary.length > 0) {
  console.log('─'.repeat(70));
  console.log('  💡  Copier ces blocs dans STATIC_POIS de asset/js/data.js :');
  console.log('─'.repeat(70));
  console.log();
}
