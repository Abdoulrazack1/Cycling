/* ═══════════════════════════════════════════════════════════════
   Club de Cyclisme de Salouel — auth.js — v2
   Gestion JWT côté frontend : stockage, refresh auto, état user
   
   Architecture :
   - Access token (15 min) : en mémoire uniquement, anti-XSS
   - Refresh token (7 j)   : cookie httpOnly, géré par le backend
   - User profile          : localStorage (si "remember me") ou sessionStorage
   - Init                  : tente un refresh ; si OK, on est connecté
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const API_BASE = window.CCS_CONFIG?.apiBase || 'http://localhost:3000/api';
  const REMEMBER_KEY = 'ccs_remember';
  const USER_KEY     = 'ccs_user';

  // ── État interne ─────────────────────────────────────────────
  let _accessToken  = null;
  let _user         = null;
  let _refreshTimer = null;
  let _initPromise  = null;
  const _listeners  = new Set();

  function _notify() {
    _listeners.forEach(fn => { try { fn(_user); } catch {} });
  }

  // Décoder JWT sans librairie (payload only)
  function _decodeJwt(token) {
    try {
      const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      return JSON.parse(atob(b64));
    } catch { return null; }
  }

  // Choisit le storage selon le choix "se souvenir de moi" persisté
  function _userStorage() {
    try {
      return localStorage.getItem(REMEMBER_KEY) === '1' ? localStorage : sessionStorage;
    } catch {
      return sessionStorage;
    }
  }

  function _persistUser(user) {
    try {
      const json = JSON.stringify(user);
      _userStorage().setItem(USER_KEY, json);
    } catch {}
  }

  function _readPersistedUser() {
    try {
      const fromLocal = localStorage.getItem(USER_KEY);
      if (fromLocal) return JSON.parse(fromLocal);
      const fromSession = sessionStorage.getItem(USER_KEY);
      if (fromSession) return JSON.parse(fromSession);
    } catch {}
    return null;
  }

  function _clearPersistedUser() {
    try {
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch {}
  }

  // Planifier le refresh 60 s avant expiration de l'access token
  function _scheduleRefresh(token) {
    if (_refreshTimer) clearTimeout(_refreshTimer);
    const payload = _decodeJwt(token);
    if (!payload?.exp) return;
    const msUntilExpiry = payload.exp * 1000 - Date.now();
    const delay = Math.max(5_000, msUntilExpiry - 60_000);
    _refreshTimer = setTimeout(() => CCS_AUTH.refresh().catch(() => {}), delay);
  }

  function _setSession(accessToken, user) {
    _accessToken = accessToken;
    _user        = user;
    _scheduleRefresh(accessToken);
    _persistUser(user);
    _notify();
  }

  function _clearSession() {
    _accessToken = null;
    _user        = null;
    if (_refreshTimer) clearTimeout(_refreshTimer);
    _refreshTimer = null;
    _clearPersistedUser();
    _notify();
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  const CCS_AUTH = {
    // ── Getters ──────────────────────────────────────────────────
    getToken:   () => _accessToken,
    getUser:    () => _user,
    isLoggedIn: () => !!_accessToken && !!_user,
    isAdmin:    () => _user?.role === 'admin',
    isModo:     () => ['admin','moderateur'].includes(_user?.role),

    /**
     * Promesse résolue après l'init complète (refresh tenté).
     * À utiliser dans les pages : `await CCS_AUTH.ready()`
     */
    ready: () => _initPromise || Promise.resolve(),

    // ── Login ────────────────────────────────────────────────────
    async login(login, password, rememberMe = true) {
      try {
        if (rememberMe) localStorage.setItem(REMEMBER_KEY, '1');
        else            localStorage.removeItem(REMEMBER_KEY);
      } catch {}

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ login, password, remember: rememberMe })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erreur de connexion');
      _setSession(data.accessToken, data.user);
      CCS_AUTH._updateNavUI();
      return data.user;
    },

    // ── Logout ───────────────────────────────────────────────────
    async logout() {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST', credentials: 'include'
        });
      } catch {}
      try { localStorage.removeItem(REMEMBER_KEY); } catch {}
      _clearSession();
      CCS_AUTH._updateNavUI();
      // Rediriger si page protégée
      if (document.body.dataset.requiresAuth || document.body.dataset.requiresAdmin) {
        window.location.href = 'login.html';
      }
    },

    // ── Refresh ──────────────────────────────────────────────────
    async refresh() {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST', credentials: 'include'
        });
        if (!res.ok) {
          _clearSession();
          return null;
        }
        const data = await res.json();
        _setSession(data.accessToken, data.user);
        return data.user;
      } catch {
        _clearSession();
        return null;
      }
    },

    // ── Register ─────────────────────────────────────────────────
    async register(fields) {
      try { localStorage.setItem(REMEMBER_KEY, '1'); } catch {}

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(fields)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (data.errors?.[0]?.msg) || 'Erreur inscription');
      _setSession(data.accessToken, data.user);
      CCS_AUTH._updateNavUI();
      return data.user;
    },

    // ── Forgot password ──────────────────────────────────────────
    async forgotPassword(email) {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erreur');
      return data;
    },

    // ── Change password ──────────────────────────────────────────
    async changePassword(currentPassword, newPassword) {
      if (!_accessToken) throw new Error('Non connecté');
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + _accessToken
        },
        credentials: 'include',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (data.errors?.[0]?.msg) || 'Erreur');
      _clearSession();
      try { localStorage.removeItem(REMEMBER_KEY); } catch {}
      CCS_AUTH._updateNavUI();
      return data;
    },

    // ── Observer ─────────────────────────────────────────────────
    onChange(fn) {
      _listeners.add(fn);
      try { fn(_user); } catch {}
      return () => _listeners.delete(fn);
    },

    // ── Init : restaurer session depuis storage + refresh auto ───
    async init() {
      if (_initPromise) return _initPromise;

      _initPromise = (async () => {
        // 1) Restaurer le user persisté pour un affichage immédiat
        const stored = _readPersistedUser();
        if (stored) _user = stored;

        // 2) Tenter un refresh pour récupérer un access token frais
        try {
          const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST', credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json();
            _setSession(data.accessToken, data.user);
          } else {
            _clearSession();
          }
        } catch {
          _user = stored;
          _accessToken = null;
        }

        // 3) Protéger la page si nécessaire (après tentative de refresh)
        if (document.body.dataset.requiresAuth && !CCS_AUTH.isLoggedIn()) {
          const here = location.pathname.split('/').pop() || 'index.html';
          window.location.href = 'login.html?redirect=' + encodeURIComponent(here + location.search);
          return;
        }
        if (document.body.dataset.requiresAdmin && !CCS_AUTH.isAdmin()) {
          window.location.href = 'index.html';
          return;
        }

        // 4) Mettre à jour la nav
        CCS_AUTH._updateNavUI();
      })();

      return _initPromise;
    },

    // ── Mise à jour de la nav selon l'état auth ───────────────────
    _updateNavUI() {
      const tryUpdate = (attempt = 0) => {
        const nav = document.getElementById('main-nav');
        if (!nav && attempt < 25) {
          setTimeout(() => tryUpdate(attempt + 1), 80);
          return;
        }
        if (!nav) return;

        const ctaContainer = nav.querySelector('.nav-cta, .nav-auth');
        if (!ctaContainer) return;

        const isAuth = CCS_AUTH.isLoggedIn();
        const user   = CCS_AUTH.getUser();

        if (isAuth && user) {
          ctaContainer.outerHTML = `
            <div class="nav-auth" id="nav-auth-menu">
              <button class="nav-auth-btn" id="nav-auth-toggle" type="button" aria-haspopup="true" aria-expanded="false">
                <span class="nav-auth-avatar">${(user.prenom?.[0] || '?').toUpperCase()}</span>
                <span class="nav-auth-name">${escapeHtml(user.prenom || 'Membre')}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div class="nav-auth-drop" id="nav-auth-drop" hidden>
                <a href="profil.html" class="nav-auth-drop-item">Mon profil</a>
                ${CCS_AUTH.isModo() ? '<a href="admin.html" class="nav-auth-drop-item nav-auth-admin">Administration</a>' : ''}
                <button class="nav-auth-drop-item nav-auth-logout" id="nav-auth-logout" type="button">Déconnexion</button>
              </div>
            </div>`;

          const toggle = document.getElementById('nav-auth-toggle');
          const drop   = document.getElementById('nav-auth-drop');
          toggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = drop.hidden;
            drop.hidden = !willOpen;
            toggle.setAttribute('aria-expanded', String(willOpen));
          });
          document.addEventListener('click', () => {
            if (drop && !drop.hidden) {
              drop.hidden = true;
              toggle?.setAttribute('aria-expanded', 'false');
            }
          });
          document.getElementById('nav-auth-logout')?.addEventListener('click', () => CCS_AUTH.logout());
        } else {
          ctaContainer.outerHTML = `
            <a href="login.html" class="nav-cta" id="nav-login-btn">
              <span class="nav-cta-dot"></span>
              <span>Connexion</span>
            </a>`;
        }
      };
      tryUpdate();
    }
  };

  window.CCS_AUTH = CCS_AUTH;

  // ── Auto-init dès que le DOM est prêt ────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CCS_AUTH.init());
  } else {
    CCS_AUTH.init();
  }
})();
