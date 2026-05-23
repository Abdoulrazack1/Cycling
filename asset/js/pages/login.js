/* ═════════════════════════════════════════════════════════════════
   pages/login.js — Page /login (connexion + inscription)
   ─────────────────────────────────────────────────────────────────
   Gère 2 tabs (login / register), la soumission via CCS_AUTH,
   le code TOTP 2FA si activé, et la redirection post-login.
   ═════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  function switchTab(tab) {
    document.getElementById('tab-login').hidden    = tab !== 'login';
    document.getElementById('tab-register').hidden = tab !== 'register';
    document.querySelectorAll('[data-tab]').forEach(el => {
      if (el.classList.contains('filter-chip')) {
        el.classList.toggle('active', el.dataset.tab === tab);
      }
    });
    const firstInput = (tab === 'login' ? '#login-id' : '#reg-prenom');
    setTimeout(() => document.querySelector(firstInput)?.focus(), 50);
  }
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(el.dataset.tab);
    });
  });

  function getRedirect() {
    const p = new URLSearchParams(location.search);
    const r = p.get('redirect');
    if (r && /^[a-zA-Z0-9_\-./?=&%]+$/.test(r) && !r.includes('://')) return r;
    return 'index.html';
  }

  (async function bootstrap() {
    const waitFor = (cond, max = 50) => new Promise(resolve => {
      const tick = (n) => {
        if (cond()) return resolve(true);
        if (n >= max) return resolve(false);
        setTimeout(() => tick(n + 1), 60);
      };
      tick(0);
    });
    await waitFor(() => !!window.CCS_AUTH);
    await CCS_AUTH.ready();

    if (CCS_AUTH.isLoggedIn()) {
      window.location.href = getRedirect();
      return;
    }

    document.getElementById('auth-checking').style.display = 'none';
    document.getElementById('auth-tabs').style.display = '';
    switchTab('login');
  })();

  async function doLogin(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    const login = document.getElementById('login-id').value.trim();
    const pw    = document.getElementById('login-pw').value;
    const remember = document.getElementById('login-remember').checked;
    // Si on est dans l'étape TOTP, récupérer le code saisi
    const totpInput = document.getElementById('login-totp');
    const totp = totpInput?.value?.trim() || null;

    if (!login || !pw) {
      errEl.textContent = 'Remplissez tous les champs';
      errEl.hidden = false; return;
    }
    errEl.hidden = true;
    btn.textContent = 'Connexion…'; btn.disabled = true;

    try {
      await CCS_AUTH.login(login, pw, remember, totp);
      if (remember) {
        try {
          localStorage.setItem('ccs_last_login', login);
          localStorage.setItem('ccs_remember_pref', '1');
          let history = JSON.parse(localStorage.getItem('ccs_login_history') || '[]');
          if (!Array.isArray(history)) history = [];
          history = [login, ...history.filter(h => h !== login)].slice(0, 5);
          localStorage.setItem('ccs_login_history', JSON.stringify(history));
        } catch {}
      } else {
        try {
          localStorage.removeItem('ccs_last_login');
          localStorage.setItem('ccs_remember_pref', '0');
        } catch {}
      }
      window.location.href = getRedirect();
    } catch (err) {
      // Si le backend demande un TOTP, afficher le champ et focus
      if (err.mfaRequired) {
        revealTotpField();
        errEl.textContent = totp ? 'Code 2FA invalide — réessayez.' : 'Compte protégé par 2FA — saisissez le code à 6 chiffres.';
        errEl.hidden = false;
        btn.textContent = 'Se connecter'; btn.disabled = false;
        document.getElementById('login-totp')?.focus();
        return;
      }
      errEl.textContent = err.message || 'Identifiants invalides';
      errEl.hidden = false;
      btn.textContent = 'Se connecter'; btn.disabled = false;
      document.getElementById('login-pw').focus();
    }
  }

  function revealTotpField() {
    if (document.getElementById('login-totp')) return;
    const pwField = document.getElementById('login-pw').closest('.field');
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.style.marginTop = '16px';
    wrap.innerHTML = `
      <label for="login-totp">Code 2FA (6 chiffres ou code de récupération)</label>
      <input id="login-totp" name="one-time-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="123456" style="font-family:monospace; letter-spacing:4px; font-size:18px; text-align:center;">`;
    pwField.parentNode.insertBefore(wrap, pwField.nextSibling);
  }

  (function preFillLogin() {
    try {
      const lastLogin = localStorage.getItem('ccs_last_login');
      const rememberPref = localStorage.getItem('ccs_remember_pref');
      if (lastLogin) {
        const idEl = document.getElementById('login-id');
        if (idEl && !idEl.value) {
          idEl.value = lastLogin;
          const pwEl = document.getElementById('login-pw');
          if (pwEl) {
            setTimeout(() => pwEl.focus(), 100);
          }
        }
      }
      if (rememberPref !== null) {
        const rmEl = document.getElementById('login-remember');
        if (rmEl) rmEl.checked = (rememberPref === '1');
      }
    } catch {}
  })();

  (function setupLoginDatalist() {
    try {
      const idEl = document.getElementById('login-id');
      if (!idEl) return;

      let history = JSON.parse(localStorage.getItem('ccs_login_history') || '[]');
      if (!Array.isArray(history)) history = [];

      let datalist = document.getElementById('login-history-list');
      if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'login-history-list';
        document.body.appendChild(datalist);
      }
      datalist.innerHTML = history.slice(0, 5)
        .map(h => `<option value="${String(h).replace(/"/g, '&quot;')}">`)
        .join('');
      idEl.setAttribute('list', 'login-history-list');
    } catch {}
  })();

  document.getElementById('tab-login').addEventListener('submit', doLogin);

  async function doRegister(e) {
    if (e) e.preventDefault();
    const btn   = document.getElementById('register-btn');
    const errEl = document.getElementById('register-error');
    const sucEl = document.getElementById('register-success');
    errEl.hidden = true; sucEl.hidden = true;

    const fields = {
      prenom:        document.getElementById('reg-prenom').value.trim(),
      nom:           document.getElementById('reg-nom').value.trim(),
      username:      document.getElementById('reg-username').value.trim(),
      email:         document.getElementById('reg-email').value.trim(),
      password:      document.getElementById('reg-pw').value,
      licence_ffc:   document.getElementById('reg-licence').value.trim() || undefined,
      annee_adhesion:parseInt(document.getElementById('reg-annee').value) || undefined,
    };

    if (!fields.prenom || !fields.nom || !fields.username || !fields.email || !fields.password) {
      errEl.textContent = 'Remplissez tous les champs obligatoires';
      errEl.hidden = false; return;
    }
    if (fields.password.length < 8) {
      errEl.textContent = 'Mot de passe trop court (8 caractères minimum)';
      errEl.hidden = false; return;
    }

    btn.textContent = 'Création…'; btn.disabled = true;
    try {
      await CCS_AUTH.register(fields);
      sucEl.hidden = false;
      setTimeout(() => { window.location.href = getRedirect(); }, 1200);
    } catch (err) {
      errEl.textContent = err.message || 'Erreur lors de la création du compte';
      errEl.hidden = false;
      btn.textContent = 'Créer mon compte'; btn.disabled = false;
    }
  }

  document.getElementById('tab-register').addEventListener('submit', doRegister);
})();
