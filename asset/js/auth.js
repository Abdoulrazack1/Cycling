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
  const REMEMBER_KEY    = 'ccs_remember';
  const USER_KEY        = 'ccs_user';
  const ACCESS_KEY      = 'ccs_at';   // sessionStorage : access token (durée de l'onglet)

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

  // Vérifier qu'un token a encore de la marge avant expiration (≥ 30 s)
  function _isTokenFresh(token) {
    const payload = _decodeJwt(token);
    if (!payload?.exp) return false;
    return (payload.exp * 1000 - Date.now()) > 30_000;
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

  // Persistance de l'access token en sessionStorage uniquement.
  //
  // Pourquoi sessionStorage et pas en mémoire pure ?
  //  - En mémoire seule, le token est perdu à chaque navigation entre pages.
  //  - Le refresh cookie qui devait restaurer l'auth ne fonctionne pas
  //    toujours en cross-port (Live Server 5500 → API 3000).
  //  - Résultat : boucle de redirection vers login.html après login OK.
  //
  // sessionStorage offre :
  //  - Survit à la navigation entre pages (même onglet)
  //  - Disparaît à la fermeture de l'onglet (pas de fuite long-terme)
  //  - Inaccessible aux autres origines (isolation par origin)
  //
  // Compromis XSS : un attaquant qui exécute du JS dans la page peut lire
  // sessionStorage. C'est un compromis acceptable en dev. En prod, mieux
  // vaut servir frontend + API depuis la même origin (localhost:3000 ici)
  // pour que le refresh cookie httpOnly suffise.
  function _readPersistedAccessToken() {
    try {
      // Cohérent avec _userStorage : si l'utilisateur a coché "se souvenir",
      // on lit le token depuis localStorage (persiste fermeture navigateur),
      // sinon depuis sessionStorage (durée de l'onglet seulement).
      const fromLocal = localStorage.getItem(ACCESS_KEY);
      if (fromLocal) return fromLocal;
      return sessionStorage.getItem(ACCESS_KEY);
    } catch { return null; }
  }

  function _persistAccessToken(token) {
    try {
      // Si remember=1, stocker dans localStorage (persiste navigateur).
      // Sinon dans sessionStorage (onglet seulement).
      const remember = localStorage.getItem(REMEMBER_KEY) === '1';
      if (token) {
        if (remember) {
          localStorage.setItem(ACCESS_KEY, token);
          sessionStorage.removeItem(ACCESS_KEY);
        } else {
          sessionStorage.setItem(ACCESS_KEY, token);
          localStorage.removeItem(ACCESS_KEY);
        }
      } else {
        localStorage.removeItem(ACCESS_KEY);
        sessionStorage.removeItem(ACCESS_KEY);
      }
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
    _persistAccessToken(accessToken);
    _notify();
  }

  function _clearSession() {
    _accessToken = null;
    _user        = null;
    if (_refreshTimer) clearTimeout(_refreshTimer);
    _refreshTimer = null;
    _clearPersistedUser();
    _persistAccessToken(null);
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
    // Comportement défensif : si le refresh échoue (rate limit, cookie
    // perdu, réseau coupé) MAIS qu'on a encore un access token valide en
    // mémoire, on garde la session. La session ne se ferme que si on n'a
    // plus aucun moyen d'authentifier l'utilisateur.
    async refresh() {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST', credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          _setSession(data.accessToken, data.user);
          return data.user;
        }
        // Refresh refusé : ne pas tuer la session si on a un token frais
        if (_accessToken && _isTokenFresh(_accessToken)) {
          console.warn('[auth] refresh failed but local access token is still fresh, keeping session');
          return _user;
        }
        _clearSession();
        return null;
      } catch (err) {
        // Réseau coupé : pareil, on garde la session si possible
        if (_accessToken && _isTokenFresh(_accessToken)) {
          console.warn('[auth] refresh network error, keeping session with local token');
          return _user;
        }
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
        // 1) Restauration synchrone déjà faite au bootstrap (cf. fin de l'IIFE).
        //    Ici on tente d'obtenir un token à jour via le refresh cookie.
        const stored = _user;

        // 2) Tenter un refresh pour récupérer un token frais (best-effort).
        try {
          const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST', credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json();
            _setSession(data.accessToken, data.user);
          } else if (_accessToken && _isTokenFresh(_accessToken)) {
            // Refresh refusé MAIS on a un token frais en storage : valider
            // sa validité côté serveur via /auth/me. Si c'est OK, on
            // continue avec ce token. Sinon clear.
            try {
              const meRes = await fetch(`${API_BASE}/auth/me`, {
                headers: { Authorization: 'Bearer ' + _accessToken }
              });
              if (meRes.ok) {
                const me = await meRes.json();
                _user = me;
                _persistUser(me);
                _scheduleRefresh(_accessToken);
                _notify();
              } else if (meRes.status === 401) {
                _clearSession();
              }
              // autre status : on garde la session local par tolérance
            } catch {
              // réseau : tolérance
            }
          } else if (!_accessToken) {
            _clearSession();
          }
        } catch {
          // Réseau coupé
          if (!_accessToken) _user = stored;
        }

        // 3) Protéger la page si nécessaire (après tentative de refresh)
        if (document.body?.dataset?.requiresAuth && !CCS_AUTH.isLoggedIn()) {
          const here = location.pathname.split('/').pop() || 'index.html';
          window.location.href = 'login.html?redirect=' + encodeURIComponent(here + location.search);
          return;
        }
        if (document.body?.dataset?.requiresAdmin && !CCS_AUTH.isAdmin()) {
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

  // ── Bootstrap synchrone : restaurer la session AVANT toute autre code ───
  // Sans ça, un `await CCS_AUTH.ready()` qui s'exécute avant DOMContentLoaded
  // verrait _initPromise=undefined et résoudrait sur Promise.resolve(), donc
  // isLoggedIn()=false → redirection vers login alors que le token est en storage.
  // Ici on restaure le token et le user de manière synchrone, dès le chargement
  // du script. La suite (refresh API + nav UI) se fait via init() en async.
  try {
    const bootUser  = _readPersistedUser();
    const bootToken = _readPersistedAccessToken();
    if (bootUser)  _user        = bootUser;
    if (bootToken && _isTokenFresh(bootToken)) {
      _accessToken = bootToken;
      _scheduleRefresh(bootToken);
    }
  } catch {}

  // ── Lancer init() immédiatement (pas besoin du DOM) ─────────
  // init() ne touche pas au DOM, juste à fetch + storage. La mise à jour
  // de la nav (DOM-dépendante) a déjà sa propre logique de retry.
  CCS_AUTH.init();
})();
