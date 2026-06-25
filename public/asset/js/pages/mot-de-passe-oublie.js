/* ═════════════════════════════════════════════════════════════════
   pages/mot-de-passe-oublie.js — Formulaire "mot de passe oublié"
   Submit email → POST /api/auth/forgot-password → message neutre.
   ═════════════════════════════════════════════════════════════════ */

(() => {

  const form = document.getElementById('forgot-form');
  const btn  = document.getElementById('forgot-btn');
  const errEl = document.getElementById('forgot-error');
  const sucEl = document.getElementById('forgot-success');
  const input = document.getElementById('forgot-email');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    errEl.hidden = true; sucEl.hidden = true;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent = 'Email invalide'; errEl.hidden = false; input.focus(); return;
    }
    btn.textContent = 'Envoi…'; btn.disabled = true;
    try {
      const waitFor = (cond, max = 30) => new Promise(resolve => {
        const tick = (n) => {
          if (cond()) return resolve(true);
          if (n >= max) return resolve(false);
          setTimeout(() => tick(n + 1), 60);
        };
        tick(0);
      });
      await waitFor(() => !!window.CCS_AUTH);

      const data = await window.CCS_AUTH.forgotPassword(email);
      sucEl.textContent = data.message || 'Demande enregistrée.';
      sucEl.hidden = false;
      input.value = '';
    } catch (err) {
      errEl.textContent = err.message || 'Erreur réseau — réessayez plus tard.';
      errEl.hidden = false;
    } finally {
      btn.textContent = 'Envoyer la demande'; btn.disabled = false;
    }
  });
})();
