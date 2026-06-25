/* ═════════════════════════════════════════════════════════════════
   routes/favorites.js — Sorties favorites des membres
   GET    /api/favorites              liste des favoris du user courant
   POST   /api/favorites/:sortieId    ajoute aux favoris
   DELETE /api/favorites/:sortieId    retire des favoris
   GET    /api/favorites/check/:sortieId  → {favorite: true|false}
   ─────────────────────────────────────────────────────────────────
   Routing only — logique dans controllers/favorites.js
   ═════════════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/favorites');
const router = express.Router();

router.get('/', requireAuth, ctrl.list);
router.post('/:sortieId', requireAuth, ctrl.add);
router.delete('/:sortieId', requireAuth, ctrl.remove);
router.get('/check/:sortieId', requireAuth, ctrl.check);

module.exports = router;
