/* ═════════════════════════════════════════════════════════════════
   services/strava-pdf-parser.js — Parse texte OCR d'un PDF Strava
   ─────────────────────────────────────────────────────────────────
   Strava exporte les routes en PDF avec un encart "Cue Sheet" qui
   liste les directions turn-by-turn :

     0,0 km   Départ — Rue de la Mairie
     0,5 km   Tourner à gauche sur Rue Victor Hugo
     1,2 km   Légère droite sur Boulevard Pasteur
     8,3 km   Arrivée

   Ce module parse le texte OCR et renvoie un array de directions
   structurées { km, type, action, street, raw }.

   ATTENTION : Le formattage du PDF Strava varie selon la langue de
   l'utilisateur Strava et la mise en page. Le parser est tolerant.
   ═════════════════════════════════════════════════════════════════ */

'use strict';

// Patterns reconnus pour les directions (FR + EN — Strava varie)
const ACTION_PATTERNS = [
  // FR
  { re: /^(départ|depart|start)\b/i,             type: 'depart',    action: 'Départ' },
  { re: /^(arrivée|arrivee|finish|arrival)\b/i,  type: 'arrivee',   action: 'Arrivée' },
  { re: /^(continuer|poursuivre|tout droit)\b/i, type: 'direction', action: 'Continuer' },
  { re: /^(faites?\s+demi-?tour|u-turn)\b/i,     type: 'direction', action: 'Demi-tour' },
  { re: /^(prendre\s+(?:la\s+)?sortie|exit)\b/i, type: 'direction', action: 'Sortie' },
  { re: /^l[ée]g[èe]re?\s+(?:à\s+)?gauche/i,     type: 'direction', action: 'Légère gauche' },
  { re: /^l[ée]g[èe]re?\s+(?:à\s+)?droite/i,     type: 'direction', action: 'Légère droite' },
  { re: /^(?:tourner\s+)?(?:à\s+)?gauche\b/i,    type: 'direction', action: 'Gauche' },
  { re: /^(?:tourner\s+)?(?:à\s+)?droite\b/i,    type: 'direction', action: 'Droite' },
  { re: /^turn\s+left\b/i,                        type: 'direction', action: 'Gauche' },
  { re: /^turn\s+right\b/i,                       type: 'direction', action: 'Droite' },
  { re: /^slight\s+left\b/i,                      type: 'direction', action: 'Légère gauche' },
  { re: /^slight\s+right\b/i,                     type: 'direction', action: 'Légère droite' },
  { re: /^merge\b/i,                              type: 'direction', action: 'Insertion' },
  // Patterns avec danger / ravito
  { re: /\b(ravito|ravitaillement|food|water)\b/i,type: 'ravito',    action: 'Ravito' },
  { re: /\b(danger|attention|warning)\b/i,        type: 'danger',    action: 'Danger' },
  { re: /\b(secteur|sector|pav[ée])\b/i,          type: 'secteur',   action: 'Secteur' },
];

const DEFAULT_PATTERN = { type: 'direction', action: 'Continuer' };

// Détecte une ligne contenant un km (n'importe où)
// Formats observés dans les PDFs Strava :
//   "0,5 km Tourner à gauche sur Rue Victor Hugo"   (km au début)
//   "Poursuivre sur Grande Rue 0,0km"               (km à la fin) ← FR PDF Strava
//   "Arrivée 9,2km"                                  (km à la fin)
const KM_PATTERN = /(\d+(?:[.,]\d+)?)\s*(?:km|mi(?:les?)?)\b/i;

/**
 * Parse le texte OCR d'un PDF Strava et extrait les directions.
 * @param {string} text - Texte OCR brut multilignes
 * @returns {Array<{km, type, action, street, raw}>}
 */
function parseStravaCueSheet(text) {
  if (!text) return [];
  // Normalisation : remplace les NBSP, supprime les caractères de contrôle
  const norm = String(text)
    .replace(/ /g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\r\n?/g, '\n');

  const lines = norm.split('\n').map(l => l.trim()).filter(Boolean);
  const results = [];

  for (const rawLine of lines) {
    const m = rawLine.match(KM_PATTERN);
    if (!m) continue;
    const kmVal = parseFloat(m[1].replace(',', '.'));
    if (!isFinite(kmVal) || kmVal < 0 || kmVal > 1000) continue;

    // Extrait le texte de direction = TOUT sauf le km lui-même.
    // Formats observés :
    //   "0,5 km Direction Rue X"  → text = "Direction Rue X" (après)
    //   "Direction Rue X 0,5km"   → text = "Direction Rue X" (avant)
    const before = rawLine.slice(0, m.index).trim();
    const after  = rawLine.slice(m.index + m[0].length).trim();
    let cueText;
    if (before.length >= 3 && after.length >= 3) cueText = before + ' ' + after;
    else if (before.length >= 3) cueText = before;
    else if (after.length >= 3)  cueText = after;
    else continue; // ligne avec juste un km (séparateur)

    // Filtre les lignes qui ne sont pas des directions :
    //   "Distance Dénivelé positif Durée..." (header de stats)
    //   "https://strava.com/..."
    //   axe horizontal "0,0 km 2,0 km 4,0 km..."
    if (/^(distance|d[ée]nivel[ée]|dur[ée]e|elev|total|speed|vitesse|moy)/i.test(cueText)) continue;
    if (/^https?:\/\//i.test(cueText)) continue;
    if (/\d+[.,]\d+\s*km.*\d+[.,]\d+\s*km/i.test(rawLine)) continue;

    // Reconnaît l'action
    let matched = null;
    for (const p of ACTION_PATTERNS) {
      if (p.re.test(cueText)) { matched = p; break; }
    }
    const action = matched?.action || DEFAULT_PATTERN.action;
    const type   = matched?.type   || DEFAULT_PATTERN.type;

    // Extrait le nom de rue (retire l'action + "sur"/"on"/résidus km)
    let street = cueText;
    if (matched) street = street.replace(matched.re, '').trim();
    street = street.replace(/^(sur|on|onto|into|—|–|-)\s+/i, '').trim();
    street = street.replace(/^[-—–:.,;]\s*/, '').replace(/[\s.,;]+$/, '');
    street = street.replace(/\s+\d+(?:[.,]\d+)?\s*km\b/gi, '').trim();

    results.push({
      km: +kmVal.toFixed(3),
      type,
      action,
      street: street || null,
      raw: rawLine,
    });
  }

  // Tri par km croissant (l'OCR sort les colonnes désordonnées sur les
  // PDFs 2-colonnes Strava)
  results.sort((a, b) => a.km - b.km);

  // Dédup : si 2 POIs même km + même action consécutifs, on garde le 1er
  const dedup = [];
  for (const r of results) {
    const prev = dedup[dedup.length - 1];
    if (prev && Math.abs(r.km - prev.km) < 0.01 && r.action === prev.action) continue;
    dedup.push(r);
  }

  // Synthétise un départ si manquant et que le premier POI est > 0,5 km
  if (dedup.length > 0 && !dedup.some(r => r.type === 'depart') && dedup[0].km > 0.5) {
    dedup.unshift({ km: 0, type: 'depart', action: 'Départ', street: null, raw: '[auto]' });
  }
  return dedup;
}

/**
 * Projette une liste de directions sur un tracé GPX : pour chaque km
 * indiqué, trouve la lat/lng correspondante sur le tracé.
 *
 * @param {Array} directions - sortie de parseStravaCueSheet
 * @param {Array<{lat, lng}>} trackPoints - points du GPX (parseGpx().points)
 * @param {(a, b) => number} haversineFn - fonction distance haversine (m)
 * @returns {Array<{km, type, label, description, lat, lng}>}
 */
function projectDirectionsOnGpx(directions, trackPoints, haversineFn) {
  if (!directions?.length || !trackPoints?.length) return [];

  // Calcule distance cumulée pour chaque point GPX
  const cum = [0];
  for (let i = 1; i < trackPoints.length; i++) {
    cum.push(cum[i - 1] + haversineFn(trackPoints[i - 1], trackPoints[i]));
  }
  const totalM = cum[cum.length - 1];

  const out = [];
  for (const d of directions) {
    const targetM = d.km * 1000;
    if (targetM < 0 || targetM > totalM + 200) continue; // hors tracé
    // Cherche le point le plus proche
    let idx = 0;
    for (let i = 0; i < cum.length; i++) {
      if (cum[i] >= targetM) { idx = i; break; }
      idx = i;
    }
    const p = trackPoints[idx];
    const label = d.street ? `${d.action} — ${d.street}` : d.action;
    out.push({
      km: d.km,
      type: d.type,
      label,
      description: d.raw,
      lat: p.lat,
      lng: p.lng,
    });
  }
  return out;
}

module.exports = { parseStravaCueSheet, projectDirectionsOnGpx };
