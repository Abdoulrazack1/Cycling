/* offline.js — logique de la page de repli hors-ligne.
   Externalisé depuis offline.html (l'inline était bloqué par la CSP). */
(function () {
  'use strict';
  const status = document.getElementById('connection-status');

  function updateStatus() {
    if (!status) return;
    if (navigator.onLine) {
      status.textContent = '✓ Connexion détectée — rechargement…';
      status.classList.add('online');
      setTimeout(function () { location.reload(); }, 800);
    } else {
      status.textContent = '× Toujours hors-ligne';
      status.classList.remove('online');
    }
  }

  const retry = document.getElementById('retry-btn');
  if (retry) retry.addEventListener('click', function () { location.reload(); });

  updateStatus();
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
})();
