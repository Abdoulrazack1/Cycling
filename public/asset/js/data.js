/* ═══════════════════════════════════════════════════════════════
   Club de Cyclisme de Salouel — data.js — v14
   RestAdapter (API) + StaticAdapter (offline/demo fallback)
   Activer REST : window.CCS_CONFIG = { backend: 'rest', apiBase: 'http://localhost:3000/api' }
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const DATA_BACKEND = window.CCS_CONFIG?.backend || 'static';
  const API_BASE     = window.CCS_CONFIG?.apiBase  || '/api';

  const STATIC_SORTIES = (window.CCS_STATIC && window.CCS_STATIC.sorties) || [];

  const STATIC_POIS = (window.CCS_STATIC && window.CCS_STATIC.pois) || {};

  // ── Adaptateur REST ────────────────────────────────────────────
  class RestAdapter {
    constructor(base) { this.base = base; }

    _headers() {
      const h = { 'Content-Type': 'application/json' };
      const token = window.CCS_AUTH?.getToken?.();
      if (token) h['Authorization'] = 'Bearer ' + token;
      return h;
    }

    async _fetch(path, options = {}) {
      try {
        const ctrl = new AbortController();
        // 8 s max — laisse le temps aux requêtes lourdes (POST avec image),
        // tout en évitant un blocage indéfini si l'API ne répond pas.
        const timer = setTimeout(() => ctrl.abort(), 8000);
        let res;
        try {
          res = await fetch(this.base + path, {
            ...options,
            headers: { ...this._headers(), ...(options.headers || {}) },
            signal: ctrl.signal
          });
        } finally {
          clearTimeout(timer);
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw Object.assign(new Error(err.error || 'API error'), { status: res.status });
        }
        // Réponses 204 No Content
        if (res.status === 204) return null;
        return res.json();
      } catch (err) {
        if (err.status) throw err;
        // Erreur réseau (CORS, offline, abort) → marquer pour fallback
        console.warn('[CCS_DATA] API indisponible, fallback static:', err.message);
        throw Object.assign(err, { networkError: true });
      }
    }

    async getClub() {
      try { return await this._fetch('/club'); }
      catch { return { name: 'C.C. Salouel', founded: 1978, president: 'Antoine Lemaire', licencies: 87 }; }
    }

    async listSorties(params = {}) {
      try {
        // Nettoyer les params undefined/null/'' pour éviter ?statut=undefined
        const clean = {};
        for (const [k, v] of Object.entries(params || {})) {
          if (v !== undefined && v !== null && v !== '') clean[k] = v;
        }
        const q = new URLSearchParams(clean).toString();
        const data = await this._fetch('/sorties' + (q ? '?' + q : ''));
        return (data.sorties || data).map(s => this._normalize(s));
      } catch (err) {
        if (err.networkError) return [...STATIC_SORTIES];
        throw err;
      }
    }

    async getSortie(id) {
      try { return this._normalize(await this._fetch('/sorties/' + encodeURIComponent(id))); }
      catch (err) {
        if (err.networkError || err.status === 404) return STATIC_SORTIES.find(s => s.id === id) || null;
        throw err;
      }
    }

    // Normalise la réponse API pour correspondre au format frontend (gpx_ref, etc.)
    _normalize(s) {
      if (!s) return null;
      return {
        ...s,
        gpx_ref:    s.gpx_ref    || s.gpx_filename || null,
        title_html: s.title_html || s.title,
        location:   s.location   || { name: s.location_name, lat: s.location_lat, lng: s.location_lng }
      };
    }

    async listPois(sortieId) {
      try {
        const apiPois = await this._fetch('/sorties/' + encodeURIComponent(sortieId) + '/pois');
        // Fusionner avec les POIs locaux (ajoutés hors connexion)
        try {
          const local = JSON.parse(localStorage.getItem('pois:' + sortieId) || '[]');
          if (local.length) return [...apiPois, ...local].sort((a, b) => (a.km || 0) - (b.km || 0));
        } catch {}
        return apiPois;
      } catch (err) {
        if (err.networkError || err.status === 401) {
          const base = STATIC_POIS[sortieId] || [];
          try {
            const extra = JSON.parse(localStorage.getItem('pois:' + sortieId) || '[]');
            return [...base, ...extra].sort((a, b) => (a.km || 0) - (b.km || 0));
          } catch { return base; }
        }
        return [];
      }
    }

    async addPoi(sortieId, poi) {
      try {
        return await this._fetch('/sorties/' + encodeURIComponent(sortieId) + '/pois', {
          method: 'POST', body: JSON.stringify(poi)
        });
      } catch (err) {
        // Fallback localStorage si offline OU non connecté (401)
        if (err.networkError || err.status === 401) {
          const key = 'pois:' + sortieId;
          const cur = JSON.parse(localStorage.getItem(key) || '[]');
          poi.id = 'user-' + Date.now(); poi._userAdded = true;
          cur.push(poi); localStorage.setItem(key, JSON.stringify(cur));
          return poi;
        }
        throw err;
      }
    }

    async deletePoi(sortieId, poiId) {
      try {
        await this._fetch('/sorties/' + encodeURIComponent(sortieId) + '/pois/' + encodeURIComponent(poiId), { method: 'DELETE' });
        return true;
      } catch (err) {
        if (err.networkError && poiId.startsWith('user-')) {
          const key = 'pois:' + sortieId;
          const cur = JSON.parse(localStorage.getItem(key) || '[]');
          localStorage.setItem(key, JSON.stringify(cur.filter(p => p.id !== poiId)));
          return true;
        }
        return false;
      }
    }

    async sendContact(data) {
      return this._fetch('/contact', { method: 'POST', body: JSON.stringify(data) });
    }

    async inscrireEvenement(eventId, data) {
      return this._fetch('/evenements/' + eventId + '/inscrire', { method: 'POST', body: JSON.stringify(data) });
    }

    async listEvenements(params = {}) {
      const q = new URLSearchParams();
      if (params.statut) q.set('statut', params.statut);
      if (params.limit)  q.set('limit',  params.limit);
      try { return await this._fetch('/evenements' + (q.toString() ? '?' + q : '')); }
      catch (err) {
        if (err.networkError) {
          let list = [...STATIC_EVENEMENTS];
          if (params.statut) list = list.filter(e => e.statut === params.statut);
          if (params.limit) list = list.slice(0, parseInt(params.limit));
          return list;
        }
        return [];
      }
    }

    async getEvenement(id) {
      try { return await this._fetch('/evenements/' + encodeURIComponent(id)); }
      catch (err) {
        if (err.networkError) return STATIC_EVENEMENTS.find(e => String(e.id) === String(id)) || null;
        return null;
      }
    }

    async listPalmares(params = {}) {
      const q = new URLSearchParams();
      if (params.annee) q.set('annee', params.annee);
      try {
        const data = await this._fetch('/palmares' + (q.toString() ? '?' + q : ''));
        return data.palmares || data;
      } catch (err) {
        if (err.networkError) {
          let list = [...STATIC_PALMARES];
          if (params.annee) list = list.filter(p => p.annee === parseInt(params.annee));
          return list;
        }
        return [];
      }
    }

    async listSegments() {
      try { return await this._fetch('/segments'); }
      catch (err) {
        if (err.networkError) return [...STATIC_SEGMENTS];
        return [];
      }
    }

    async getMembre(id) {
      try { return await this._fetch('/membres/' + encodeURIComponent(id)); }
      catch (err) {
        if (err.networkError) return STATIC_MEMBRES.find(m => String(m.id) === String(id)) || null;
        return null;
      }
    }

    async listMembres(params = {}) {
      const q = new URLSearchParams();
      if (params.limit) q.set('limit', params.limit);
      try { return await this._fetch('/membres' + (q.toString() ? '?' + q : '')); }
      catch (err) {
        if (err.networkError) return [...STATIC_MEMBRES];
        return [];
      }
    }
  }

  // ── Adaptateur statique (offline / démo) ──────────────────────

  // Données fallback pour événements / palmarès / segments / membres,
  // utilisées quand l'API REST est indisponible ou en mode démo.
  const STATIC_EVENEMENTS = (window.CCS_STATIC && window.CCS_STATIC.evenements) || [];

  const STATIC_PALMARES = (window.CCS_STATIC && window.CCS_STATIC.palmares) || [];

  const STATIC_SEGMENTS = (window.CCS_STATIC && window.CCS_STATIC.segments) || [];

  const STATIC_MEMBRES = (window.CCS_STATIC && window.CCS_STATIC.membres) || [];

  class StaticAdapter {
    async getClub() { return { name: 'C.C. Salouel', founded: 1978, president: 'Antoine Lemaire', licencies: 87, address: '14 rue de l\'Église, 80480 Salouel', email: 'contact@club-salouel.fr', phone: '06 09 12 34 56', sortie_day: 'Dimanche · 8h30' }; }
    async listSorties(params = {}) {
      let list = [...STATIC_SORTIES];
      if (params?.statut) list = list.filter(s => (s.statut || 'passee') === params.statut);
      if (params?.featured === 'true') list = list.filter(s => s.featured);
      if (params?.limit) list = list.slice(0, parseInt(params.limit));
      return list;
    }
    async getSortie(id) { return STATIC_SORTIES.find(s => s.id === id) || null; }
    async listPois(sortieId) {
      const base = STATIC_POIS[sortieId] || [];
      try {
        const extra = JSON.parse(localStorage.getItem('pois:' + sortieId) || '[]');
        return [...base, ...extra].sort((a, b) => (a.km || 0) - (b.km || 0));
      } catch { return base; }
    }
    async addPoi(sortieId, poi) {
      const key = 'pois:' + sortieId;
      try {
        const cur = JSON.parse(localStorage.getItem(key) || '[]');
        poi.id = 'user-' + Date.now(); poi._userAdded = true;
        cur.push(poi); localStorage.setItem(key, JSON.stringify(cur));
        return poi;
      } catch { return null; }
    }
    async deletePoi(sortieId, poiId) {
      if (!poiId?.startsWith('user-')) return false;
      const key = 'pois:' + sortieId;
      try {
        const cur = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify(cur.filter(p => p.id !== poiId)));
        return true;
      } catch { return false; }
    }
    async sendContact() { return { message: 'Message envoyé (mode démo)' }; }
    async inscrireEvenement() { return { message: 'Inscription confirmée (mode démo)' }; }
    async listEvenements(params = {}) {
      let list = [...STATIC_EVENEMENTS];
      if (params?.statut) list = list.filter(e => e.statut === params.statut);
      if (params?.limit) list = list.slice(0, parseInt(params.limit));
      return list;
    }
    async getEvenement(id) { return STATIC_EVENEMENTS.find(e => String(e.id) === String(id)) || null; }
    async listPalmares(params = {}) {
      let list = [...STATIC_PALMARES];
      if (params?.annee) list = list.filter(p => p.annee === parseInt(params.annee));
      return list;
    }
    async listSegments() { return [...STATIC_SEGMENTS]; }
    async getMembre(id) { return STATIC_MEMBRES.find(m => String(m.id) === String(id)) || null; }
    async listMembres() { return [...STATIC_MEMBRES]; }
  }

  // ── Init ──────────────────────────────────────────────────────
  const adapter = DATA_BACKEND === 'rest' ? new RestAdapter(API_BASE) : new StaticAdapter();

  window.CCS_DATA = {
    adapter, backend: DATA_BACKEND,
    sorties:           (p)     => adapter.listSorties(p),
    listSorties:       (p)     => adapter.listSorties(p),
    sortie:            (id)    => adapter.getSortie(id),
    getSortie:         (id)    => adapter.getSortie(id),
    pois:              (id)    => adapter.listPois(id),
    listPois:          (id)    => adapter.listPois(id),
    addPoi:            (id, p) => adapter.addPoi(id, p),
    deletePoi:         (id, p) => adapter.deletePoi(id, p),
    sendContact:       (d)     => adapter.sendContact(d),
    inscrireEvenement: (e, d)  => adapter.inscrireEvenement(e, d),
    evenements:        (p)     => adapter.listEvenements(p),
    listEvenements:    (p)     => adapter.listEvenements(p),
    evenement:         (id)    => adapter.getEvenement(id),
    getEvenement:      (id)    => adapter.getEvenement(id),
    palmares:          (p)     => adapter.listPalmares(p),
    listPalmares:      (p)     => adapter.listPalmares(p),
    segments:          ()      => adapter.listSegments(),
    listSegments:      ()      => adapter.listSegments(),
    membre:            (id)    => adapter.getMembre(id),
    getMembre:         (id)    => adapter.getMembre(id),
    membres:           (p)     => adapter.listMembres(p),
    listMembres:       (p)     => adapter.listMembres(p),
    club:              ()      => adapter.getClub(),
    getClub:           ()      => adapter.getClub(),
    sortieUrl:         (id)    => 'sortie.html?id=' + encodeURIComponent(id),
    isRest:            ()      => DATA_BACKEND === 'rest',
  };
})();