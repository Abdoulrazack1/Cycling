/* ═════════════════════════════════════════════════════════════════
   lib/async-handler.js — Wrappe un handler async pour router ses rejets
   vers le middleware d'erreur global, sans try/catch répétitif.

   Usage :
     const asyncHandler = require('../lib/async-handler');
     router.get('/', asyncHandler(ctrl.list));

   Le middleware d'erreur global (server.js) reçoit alors l'erreur via next()
   et répond de façon homogène.
   ═════════════════════════════════════════════════════════════════ */
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
