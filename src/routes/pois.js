/* ═════════════════════════════════════════════════════════════════
   routes/pois.js — Points d'intérêt d'une sortie (signaleurs, ravitos…)
   Monté sur /api/sorties/:sortieId/pois — relatif à une sortie.
   GET    /            liste les POIs d'une sortie
   POST   /            crée un POI (auth requis, user_added=true)
   POST   /bulk        remplace les POIs système (admin)
   PUT    /:poiId      édite un POI
   DELETE /:poiId      supprime un POI
   ─────────────────────────────────────────────────────────────────
   Routing only — logique dans controllers/pois.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/pois');

const router = express.Router({ mergeParams: true }); // :sortieId hérité

router.get('/', ctrl.list);
router.post('/', requireAuth, ctrl.createValidators, ctrl.create);
router.post('/bulk', requireAuth, requireAdmin, ctrl.bulkReplace);
router.put('/:poiId', requireAuth, ctrl.update);
router.delete('/:poiId', requireAuth, ctrl.remove);

module.exports = router;
