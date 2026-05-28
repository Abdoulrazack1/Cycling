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

// Détecte une ligne contenant un km au début
// Ex: "0,5 km Tourner à gauche sur Rue Victor Hugo"
// Ex: "Mile 1.2 ..."
const KM_LINE = /(?:^|\s)(\d+[.,]\d+|\d+)\s*(?:km|mi(?:les?)?)\b/i;

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

  // On split en lignes, et on essaie d'extraire chaque ligne qui démarre par un km
  const lines = norm.split('\n').map(l => l.trim()).filter(Boolean);
  const results = [];
  let lastKm = -1;

  for (const rawLine of lines) {
    // Some lines may have multiple "km" — on ne prend que le premier au début
    const m = rawLine.match(KM_LINE);
    if (!m) continue;
    const kmVal = parseFloat(m[1].replace(',', '.'));
    if (!isFinite(kmVal) || kmVal < 0 || kmVal > 1000) continue;
    // Doublons : Strava répète parfois la même ligne avec OCR — on filtre
    if (Math.abs(kmVal - lastKm) < 0.005) continue;

    // Le texte APRÈS "X,X km" est la direction + nom de rue
    const after = rawLine.slice(m.index + m[0].length).trim();
    if (!after || after.length < 2) {
      // Ligne avec juste un km, ignore (probable séparateur)
      continue;
    }

    // Reconnaît l'action
    let matched = null;
    for (const p of ACTION_PATTERNS) {
      if (p.re.test(after)) { matched = p; break; }
    }
    const action = matched?.action || DEFAULT_PATTERN.action;
    const type   = matched?.type   || DEFAULT_PATTERN.type;

    // Extrait le nom de rue : ce qui reste après le mot d'action
    // Ex: "Tourner à gauche sur Rue Victor Hugo" → "Rue Victor Hugo"
    let street = after;
    if (matched) {
      street = street.replace(matched.re, '').trim();
    }
    street = street.replace(/^(sur|on|onto|into)\s+/i, '').trim();
    // Nettoie ponctuation et tirets résiduels
    street = street.replace(/^[-—–:.,;]\s*/, '').replace(/[\s.,;]+$/, '');

    results.push({
      km: +kmVal.toFixed(3),
      type,
      action,
      street: street || null,
      raw: rawLine,
    });
    lastKm = kmVal;
  }

  // S'il n'y a aucun "depart" reconnu, on synthétise un départ au km 0
  if (results.length > 0 && !results.some(r => r.type === 'depart')) {
    if (results[0].km > 0.5) {
      // Vraiment pas de départ explicite — ajoute artificiel
      results.unshift({ km: 0, type: 'depart', action: 'Départ', street: null, raw: '[auto]' });
    }
  }

  return results;
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
