(() => {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const form  = document.getElementById('reset-form');
  const btn   = document.getElementById('reset-btn');
  const errEl = document.getElementById('reset-error');
  const sucEl = document.getElementById('reset-success');

  if (!token) {
    errEl.textContent = 'Lien invalide ou incomplet. Demandez un nouveau lien à un administrateur.';
    errEl.hidden = false;
    btn.disabled = true;
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true; sucEl.hidden = true;
    const pw1 = document.getElementById('reset-pw').value;
    const pw2 = document.getElementById('reset-pw2').value;

    if (pw1.length < 8) {
      errEl.textContent = 'Le mot de passe doit faire au moins 8 caractères.';
      errEl.hidden = false; return;
    }
    if (pw1 !== pw2) {
      errEl.textContent = 'Les deux mots de passe ne correspondent pas.';
      errEl.hidden = false; return;
    }

    btn.textContent = 'Réinitialisation…'; btn.disabled = true;
    try {
      const API = window.CCS_CONFIG?.apiBase || '/api';
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: pw1 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur ' + res.status);
      sucEl.innerHTML = (data.message || 'Mot de passe réinitialisé.') +
        '<br><a href="login.html" style="color:var(--brass);">Se connecter →</a>';
      sucEl.hidden = false;
      form.querySelectorAll('input').forEach(i => i.disabled = true);
      btn.style.display = 'none';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      btn.textContent = 'Réinitialiser'; btn.disabled = false;
    }
  });
})();
