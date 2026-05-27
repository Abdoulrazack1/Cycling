/* ═════════════════════════════════════════════════════════════════
   profil.js — Page /profil
   ─────────────────────────────────────────────────────────────────
   Sections (dans l'ordre d'exécution) :
     1.  Chargement du profil utilisateur (auth + fetch)
     2.  Affichage des stats persos (km, FTP, dénivelé, zones de puissance)
     3.  Toggle bio_public (RGPD)
     4.  Dashboard "Ma saison & le club" (rang, moyennes, événements)
     5.  Gestion équipement (CRUD via modal)
     6.  Strava (état connexion + sync + stats annuelles)
     7.  Dashboard membre (chargé via /api/membres/me/dashboard)
     8.  Export RGPD article 20 (téléchargement JSON)
     9.  Sessions actives (liste + révocation)
     10. Suppression de compte RGPD article 17 (modal + confirmation)
     11. Changement de mot de passe
   ═════════════════════════════════════════════════════════════════ */

(async function loadProfile() {

  // ─── Helper : attente conditionnelle (poll jusqu'à condition vraie) ───
  const waitFor = (cond, max = 50) => new Promise(resolve => {
    const tick = (n) => {
      if (cond()) return resolve(true);
      if (n >= max) return resolve(false);
      setTimeout(() => tick(n + 1), 60);
    };
    tick(0);
  });

  /**
   * Wrapper unique pour les appels API authentifiés.
   *   await api('/auth/sessions')                      → GET, retourne le JSON parsé
   *   await api('/auth/account', { method: 'DELETE', body: {password, confirm} })
   * Throws Error(data.error || 'HTTP N') si !res.ok.
   * Centralise l'ajout du token, du Content-Type et du parsing.
   */
  async function api(path, opts = {}) {
    const API   = window.CCS_CFG?.API || window.CCS_CONFIG?.apiBase || '/api';
    const token = window.CCS_AUTH?.getToken?.();
    const body  = opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body;
    const r = await fetch(API + path, {
      ...opts,
      body,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(opts.headers || {}),
      },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }


  await waitFor(() => !!window.CCS_AUTH);
  await window.CCS_AUTH.ready();

  const user = window.CCS_AUTH?.getUser();
  if (!user) return;

  let profile = user;
  try {
    const API = window.CCS_CONFIG?.apiBase || '/api';
    const token = window.CCS_AUTH.getToken();
    const res = await fetch(`${API}/membres/${user.id}`, {
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    });
    if (res.ok) profile = await res.json();
  } catch {}

  document.title = `Profil — ${profile.prenom} ${profile.nom} · C.C. Salouel`;

  const avatar = document.getElementById('profile-avatar');
  if (avatar) avatar.textContent = (profile.prenom?.[0] || '?').toUpperCase();

  const chapter = document.getElementById('profile-chapter');
  if (chapter) {
    const role = { admin: 'administrateur', moderateur: 'modérateur', membre: 'membre' }[profile.role] || profile.role;
    chapter.textContent = `Sociétaire ${profile.numero ? '№ ' + String(profile.numero).padStart(3,'0') : ''} · ${role}${profile.licence_ffc ? ' · FFC ' + profile.licence_ffc : ''}`;
  }

  const nameEl = document.getElementById('profile-name');
  if (nameEl) nameEl.innerHTML = `${profile.prenom} <span class="it">${profile.nom}</span>`;

  const bioEl = document.getElementById('profile-bio');
  if (bioEl) bioEl.textContent = profile.bio || '';

  // ═════════════════════════════════════════════════════════════════
  // BIO PUBLIC — toggle de visibilité (RGPD Brief)
  // ═════════════════════════════════════════════════════════════════
  const bioToggle = document.getElementById('bio-public-toggle');
  const bioStatus = document.getElementById('bio-public-status');
  if (bioToggle) {
    bioToggle.checked = !!profile.bio_public;
    bioStatus.textContent = profile.bio_public
      ? '✓ Visible publiquement sur votre fiche /membres/' + profile.id
      : 'Visible uniquement par vous et les admins.';
    bioToggle.addEventListener('change', async () => {
      const newVal = bioToggle.checked;
      bioToggle.disabled = true;
      bioStatus.textContent = 'Enregistrement…';
      try {
        const API = window.CCS_CONFIG?.apiBase || '/api';
        const token = window.CCS_AUTH?.getToken?.();
        const res = await fetch(`${API}/membres/${profile.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          body: JSON.stringify({
            bio: profile.bio || null,
            bio_public: newVal,
            ftp_w: profile.ftp_w,
            km_saison: profile.km_saison,
            elevation_saison: profile.elevation_saison,
            licence_ffc: profile.licence_ffc,
            annee_adhesion: profile.annee_adhesion,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'HTTP ' + res.status);
        }
        profile.bio_public = newVal;
        bioStatus.textContent = newVal
          ? '✓ Visible publiquement sur votre fiche /membres/' + profile.id
          : '✓ Bio repassée en privée.';
      } catch (err) {
        bioToggle.checked = !newVal;
        bioStatus.textContent = '✗ Erreur : ' + err.message;
      } finally {
        bioToggle.disabled = false;
      }
    });
  }

  // Stats étendues (rang club, agrégats saison) → panneau "Ma saison & le club"
  try {
    const token = window.CCS_AUTH?.getToken();
    const r = await fetch(`${window.CCS_CFG.API}/auth/my-stats`, { headers: { Authorization: 'Bearer ' + token } });
    if (r.ok) {
      const s = await r.json();
      const section = document.getElementById('my-stats-section');
      if (section) section.hidden = false;
      const yEl = document.getElementById('stats-year');
      if (yEl) yEl.textContent = s.year;
      const rankEl = document.getElementById('stat-rank');
      if (rankEl) rankEl.innerHTML = `${s.rank.position}<span class="unit">/ ${s.rank.total}</span>`;
      const rankSub = document.getElementById('stat-rank-sub');
      if (rankSub && s.rank.percentile != null) rankSub.textContent = `Top ${100 - s.rank.percentile}% des sociétaires`;
      const avgEl = document.getElementById('stat-club-avg');
      if (avgEl) avgEl.innerHTML = `${s.rank.club_avg_km.toLocaleString('fr-FR')}<span class="unit">km</span>`;
      const avgSub = document.getElementById('stat-club-avg-sub');
      if (avgSub) {
        const diff = (s.me.km_saison || 0) - s.rank.club_avg_km;
        avgSub.textContent = diff >= 0 ? `+${diff.toLocaleString('fr-FR')} km au-dessus` : `${diff.toLocaleString('fr-FR')} km en dessous`;
      }
      const sorEl = document.getElementById('stat-sorties-done');
      if (sorEl) sorEl.textContent = s.club_year.sorties_done;
      const sorSub = document.getElementById('stat-sorties-sub');
      if (sorSub) sorSub.textContent = `${s.club_year.total_km.toLocaleString('fr-FR')} km · D+ ${s.club_year.total_dplus.toLocaleString('fr-FR')} m`;
      const upEl = document.getElementById('stat-upcoming');
      if (upEl) upEl.textContent = s.club_year.upcoming_events;
    }
  } catch (err) {
    console.warn('[my-stats]', err);
  }

  const kmEl = document.getElementById('profile-km');
  if (kmEl) kmEl.innerHTML = `${(profile.km_saison || 0).toLocaleString('fr-FR')}<span class="unit">km</span>`;

  const ftpEl = document.getElementById('profile-ftp');
  if (ftpEl) ftpEl.innerHTML = `${profile.ftp_w || '—'}<span class="unit">w</span>`;

  const elevEl = document.getElementById('profile-elev');
  if (elevEl) elevEl.innerHTML = `${(profile.elevation_saison || 0).toLocaleString('fr-FR')}<span class="unit">m</span>`;

  const ftp = profile.ftp_w || 0;
  if (ftp > 0) {
    const poids = 70;
    const zones = [
      { label: 'Récupération',  sub: 'Z1 · <55 % FTP',       pct: [0,   55],  w: Math.round(ftp * 0.55), bar: 55 },
      { label: 'Endurance',     sub: 'Z2 · 55–75 % FTP',      pct: [55,  75],  w: Math.round(ftp * 0.68), bar: 68 },
      { label: 'Tempo',         sub: 'Z3 · 76–90 % FTP',      pct: [76,  90],  w: Math.round(ftp * 0.83), bar: 78 },
      { label: 'Seuil',         sub: 'Z4 · 91–105 % FTP',     pct: [91,  105], w: ftp,                    bar: 95 },
      { label: 'VO2 max',       sub: 'Z5 · 106–120 % FTP',    pct: [106, 120], w: Math.round(ftp * 1.12), bar: 90 },
      { label: 'Anaérobie',     sub: 'Z6 · >120 % FTP',       pct: [121, 150], w: Math.round(ftp * 1.35), bar: 72 },
      { label: 'Sprint 5 s',    sub: 'PPO — pic de puissance', pct: [0,   0],   w: Math.round(ftp * 4),    bar: 85 },
    ];
    const powerRows = document.querySelector('.power-rows');
    if (powerRows) {
      powerRows.innerHTML = zones.map(z => `
        <div class="power-row">
          <div class="power-label">${z.label}<span class="power-label-sub">${z.sub}</span></div>
          <div class="power-bar-wrap"><div class="power-bar" data-w="${z.bar}" style="width:${z.bar}%"></div></div>
          <div class="power-v">${z.w}<span class="unit">w</span></div>
          <div class="power-r">${(z.w / poids).toFixed(1)} w/kg</div>
        </div>`).join('');

      const powerDesc = document.querySelector('.power-rows')?.closest('section')?.querySelector('.sec-head-desc');
      if (powerDesc) powerDesc.textContent = `Calculées sur FTP ${ftp} W — mis à jour depuis votre profil.`;
    }
  }

  function renderEquipGrid(items) {
    const grid = document.getElementById('equip-grid');
    if (!grid) return;
    if (!items?.length) {
      grid.innerHTML = `<div style="grid-column:1/-1; padding:32px; text-align:center; font-family:var(--f-sans); font-size:13px; color:var(--parch-3); border:1px dashed var(--line);">Aucun équipement renseigné. Cliquez sur <b>+ Ajouter un équipement</b>.</div>`;
      return;
    }
    grid.innerHTML = items.map((e, i) => `
      <div class="equip-card" data-eid="${e.id}" style="position:relative;">
        <div class="equip-card-num">${String(i + 1).padStart(2, '0')}</div>
        <div class="equip-card-title">${esc(e.titre)}</div>
        <div class="equip-card-body">${esc(e.description || '')}</div>
        <div style="position:absolute; top:10px; right:10px; display:flex; gap:4px;">
          <button class="equip-edit" data-eid="${e.id}" title="Éditer" aria-label="Éditer" style="background:rgba(176,142,74,.12); border:1px solid var(--brass); width:28px; height:28px; color:var(--brass); cursor:pointer; font-size:13px;">✎</button>
          <button class="equip-del" data-eid="${e.id}" title="Supprimer" aria-label="Supprimer" style="background:rgba(192,128,128,.08); border:1px solid #c08080; width:28px; height:28px; color:#c08080; cursor:pointer; font-size:14px;">✕</button>
        </div>
      </div>`).join('');
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  let currentEquip = Array.isArray(profile.equipment) ? profile.equipment.filter(e => e.id) : [];
  renderEquipGrid(currentEquip);

  // ═════════════════════════════════════════════════════════════════
  // ÉQUIPEMENT — modal de création/édition + CRUD
  // ═════════════════════════════════════════════════════════════════
  const modal      = document.getElementById('equip-modal');
  const modalTitle = document.getElementById('equip-modal-title');
  const inputTitre = document.getElementById('equip-titre');
  const inputDesc  = document.getElementById('equip-desc');
  const modalErr   = document.getElementById('equip-modal-err');
  const btnSave    = document.getElementById('equip-modal-save');
  const btnCancel  = document.getElementById('equip-modal-cancel');
  const btnAdd     = document.getElementById('equip-add-btn');
  let editingId    = null;

  function openModal(item) {
    editingId = item?.id || null;
    modalTitle.textContent = editingId ? 'Modifier l\'équipement' : 'Nouvel équipement';
    inputTitre.value = item?.titre || '';
    inputDesc.value  = item?.description || '';
    modalErr.hidden  = true;
    modal.hidden = false;
    modal.style.display = 'flex'; // ne s'applique QUE quand visible
    setTimeout(() => inputTitre.focus(), 50);
  }
  function closeModal() {
    modal.hidden = true;
    modal.style.display = 'none';
    editingId = null;
  }
  // Sécurité : forcer le state fermé au chargement (au cas où le CSS triche)
  closeModal();

  btnAdd?.addEventListener('click', () => openModal(null));
  btnCancel?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  document.getElementById('equip-grid')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.equip-edit');
    const delBtn  = e.target.closest('.equip-del');
    if (editBtn) {
      const id = parseInt(editBtn.dataset.eid, 10);
      const it = currentEquip.find(x => x.id === id);
      if (it) openModal(it);
    } else if (delBtn) {
      const id = parseInt(delBtn.dataset.eid, 10);
      const it = currentEquip.find(x => x.id === id);
      if (!it) return;
      if (!confirm(`Supprimer "${it.titre}" ?`)) return;
      try {
        await api(`/auth/equipment/${id}`, { method: 'DELETE' });
        currentEquip = currentEquip.filter(x => x.id !== id);
        renderEquipGrid(currentEquip);
        window.toast?.('Équipement supprimé', 'success');
      } catch (err) {
        window.toast?.('Erreur : ' + err.message, 'error');
      }
    }
  });

  btnSave?.addEventListener('click', async () => {
    modalErr.hidden = true;
    const titre = inputTitre.value.trim();
    const desc  = inputDesc.value.trim();
    if (!titre) { modalErr.textContent = 'Le titre est obligatoire'; modalErr.hidden = false; return; }

    btnSave.disabled = true;
    btnSave.textContent = 'Enregistrement…';
    try {
      const result = await api(
        editingId ? `/auth/equipment/${editingId}` : '/auth/equipment',
        {
          method: editingId ? 'PUT' : 'POST',
          body:   { titre, description: desc || undefined },
        }
      );
      if (editingId) {
        const it = currentEquip.find(x => x.id === editingId);
        if (it) { it.titre = titre; it.description = desc || null; }
      } else {
        currentEquip.push(result);
      }
      renderEquipGrid(currentEquip);
      closeModal();
      window.toast?.(editingId ? 'Équipement modifié' : 'Équipement ajouté', 'success');
    } catch (err) {
      modalErr.textContent = err.message;
      modalErr.hidden = false;
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = 'Enregistrer';
    }
  });

  const userLabel = document.getElementById('ps-user-label');
  if (userLabel) userLabel.textContent = `${profile.prenom} ${profile.nom} (${profile.email || profile.username})`;

  // ═════════════════════════════════════════════════════════════════
  // LOGOUT — bouton de déconnexion simple
  // ═════════════════════════════════════════════════════════════════
  document.getElementById('ps-logout-btn')?.addEventListener('click', async () => {
    if (!confirm('Confirmer la déconnexion ?')) return;
    await window.CCS_AUTH.logout();
  });


  // ═════════════════════════════════════════════════════════════════
  // CHANGEMENT DE MOT DE PASSE
  // ═════════════════════════════════════════════════════════════════
  document.getElementById('pw-btn')?.addEventListener('click', async () => {
    const cur     = document.getElementById('pw-current').value;
    const nw      = document.getElementById('pw-new').value;
    const confirm = document.getElementById('pw-confirm').value;
    const errEl   = document.getElementById('pw-error');
    const sucEl   = document.getElementById('pw-success');
    const btn     = document.getElementById('pw-btn');
    errEl.hidden = true; sucEl.hidden = true;

    if (!cur || !nw || !confirm) {
      errEl.textContent = 'Remplissez tous les champs'; errEl.hidden = false; return;
    }
    if (nw.length < 8) {
      errEl.textContent = 'Le nouveau mot de passe doit faire au moins 8 caractères'; errEl.hidden = false; return;
    }
    if (nw !== confirm) {
      errEl.textContent = 'Les deux nouveaux mots de passe ne correspondent pas'; errEl.hidden = false; return;
    }
    if (nw === cur) {
      errEl.textContent = 'Le nouveau mot de passe doit être différent de l\'ancien'; errEl.hidden = false; return;
    }

    btn.textContent = 'Modification…'; btn.disabled = true;
    try {
      await window.CCS_AUTH.changePassword(cur, nw);
      sucEl.textContent = 'Mot de passe modifié — vous allez être redirigé vers la connexion…';
      sucEl.hidden = false;
      setTimeout(() => window.location.href = 'login.html', 2000);
    } catch (err) {
      errEl.textContent = err.message || 'Erreur lors de la modification'; errEl.hidden = false;
      btn.textContent = 'Modifier le mot de passe'; btn.disabled = false;
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // STRAVA — état connexion / sync / stats
  // ═════════════════════════════════════════════════════════════════
  // _stravaApi est conservé comme alias historique mais délègue à api()
  const _stravaApi = (p, init = {}) => api(p, init);

  function _fmtKm(m)   { return m ? (m / 1000).toFixed(1) + ' km'  : '—'; }
  function _fmtElev(m) { return m ? Math.round(m) + ' m'           : '—'; }
  function _fmtH(s)    { if (!s) return '—'; const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); return h ? h + 'h' + String(m).padStart(2,'0') : m + ' min'; }

  function renderStravaState(s, stats) {
    const notC = document.getElementById('strava-notconfigured');
    const disc = document.getElementById('strava-disconnected');
    const conn = document.getElementById('strava-connected');
    if (notC) notC.hidden = true;
    if (disc) disc.hidden = true;
    if (conn) conn.hidden = true;

    if (!s.configured) {
      if (notC) notC.hidden = false;
      // Si user admin, afficher le guide de config
      const adminHelp = document.getElementById('strava-admin-help');
      if (adminHelp && profile?.role === 'admin') adminHelp.hidden = false;
      return;
    }
    if (!s.connected)  { if (disc) disc.hidden = false; return; }

    if (conn) conn.hidden = false;
    const ath = s.athlete || {};
    const avatar = document.getElementById('strava-avatar');
    if (avatar) avatar.src = ath.profile_url || '';
    const name = document.getElementById('strava-name');
    if (name) name.textContent = (ath.firstname || '') + ' ' + (ath.lastname || '');
    const meta = document.getElementById('strava-meta');
    if (meta) meta.textContent = `${s.activities_count || 0} activités importées · dernière sync : ${s.last_sync_at ? new Date(s.last_sync_at).toLocaleDateString('fr-FR') + ' ' + new Date(s.last_sync_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) : 'jamais'}`;

    if (stats) {
      const grid = document.getElementById('strava-stats');
      const cells = [
        { l: 'Cette année · km',  v: _fmtKm(stats.year_distance_m) },
        { l: 'Cette année · D+',  v: _fmtElev(stats.year_elev_m) },
        { l: 'Cette année · temps', v: _fmtH(stats.year_time_s) },
        { l: '30 derniers j',     v: _fmtKm(stats.month_distance_m) },
        { l: 'Total importé',     v: _fmtKm(stats.total_distance_m) + ' / ' + (stats.total || 0) + ' rides' },
      ];
      grid.innerHTML = cells.map(c =>
        `<div style="border:1px solid var(--line); padding:12px 14px;"><div style="font-family:var(--f-sans); font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--parch-3);">${c.l}</div><div style="font-family:var(--f-disp); font-size:22px; color:var(--brass); margin-top:4px;">${c.v}</div></div>`
      ).join('');
    }
  }

  async function loadStrava() {
    try {
      const status = await _stravaApi('/strava/status');
      let stats = null;
      if (status.connected) {
        try { stats = await _stravaApi('/strava/stats'); } catch {}
      }
      renderStravaState(status, stats);
    } catch (err) {
      console.warn('[strava]', err);
    }
  }
  loadStrava();

  // Notification après retour OAuth callback (URL ?strava=connected / error)
  const qs = new URLSearchParams(location.search);
  if (qs.get('strava')) {
    const status   = qs.get('strava');
    const imported = parseInt(qs.get('imported') || '0', 10);
    const syncErr  = qs.get('sync_error');
    if (window.toast) {
      if (status === 'connected') {
        let msg = '✓ Strava connecté';
        if (imported > 0) msg += ` · ${imported} activité${imported > 1 ? 's' : ''} importée${imported > 1 ? 's' : ''} (90 derniers jours)`;
        else if (syncErr) msg += ' · sync échouée — clique Synchroniser pour réessayer';
        else              msg += ' · aucune nouvelle activité à importer';
        window.toast(msg, 'success', 6000);
      } else if (status === 'error') {
        window.toast('Échec Strava : ' + (qs.get('reason') || 'inconnu'), 'error', 8000);
      }
    }
    history.replaceState(null, '', location.pathname);
  }

  // Le bouton "Synchroniser" est maintenant data-strava-sync-modal :
  // strava-ux.js le câble pour ouvrir la modal de preview + choix période.
  // En fallback (si strava-ux pas chargé), on garde l'ancien comportement.
  document.getElementById('strava-sync-btn')?.addEventListener('click', async (e) => {
    if (window.CCS_STRAVA_UX?.showSyncModal) return; // déjà géré par strava-ux
    e.preventDefault();
    const btn = e.target;
    const msg = document.getElementById('strava-msg');
    btn.disabled = true; btn.textContent = 'Sync…';
    if (msg) msg.textContent = '';
    try {
      const r = await _stravaApi('/strava/sync', { method: 'POST', body: JSON.stringify({ since_days: 90, max_pages: 3 }) });
      if (msg) msg.textContent = `${r.imported} nouvelles activités importées (${r.skipped} déjà connues, ${r.total} scannées).`;
      loadStrava();
    } catch (err) {
      if (msg) msg.textContent = err.message;
    } finally {
      btn.disabled = false; btn.textContent = 'Synchroniser';
    }
  });

  // Expose loadStrava globalement pour que la modal puisse rafraîchir
  window.loadStrava = loadStrava;

  document.getElementById('strava-disconnect-btn')?.addEventListener('click', async () => {
    if (!confirm('Déconnecter ton compte Strava ? Les activités importées resteront en base mais ne seront plus mises à jour.')) return;
    try {
      await _stravaApi('/strava/disconnect', { method: 'POST' });
      if (window.toast) window.toast('Strava déconnecté', 'info');
      loadStrava();
    } catch (err) {
      if (window.toast) window.toast('Erreur : ' + err.message, 'error');
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // DASHBOARD — stats personnelles (rang, club avg, sorties, à venir)
  // ═════════════════════════════════════════════════════════════════
  async function loadDashboard() {
    try {
      const token = window.CCS_AUTH?.getToken();
      if (!token) return;
      const r = await fetch(window.CCS_CFG.API + '/membres/me/dashboard', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!r.ok) return;
      const d = await r.json();
      const section = document.getElementById('my-stats-section');
      if (!section) return;
      section.hidden = false;

      const yearEl = document.getElementById('stats-year');
      if (yearEl) yearEl.textContent = d.year || new Date().getFullYear();

      // Mon rang
      const rank = document.getElementById('stat-rank');
      const rankSub = document.getElementById('stat-rank-sub');
      if (rank) rank.textContent = d.ranking?.rank ? `${d.ranking.rank}` : '—';
      if (rankSub) rankSub.textContent = d.ranking?.total ? `sur ${d.ranking.total} membres ranked` : 'pas de km déclaré';

      // Moyenne club
      const clubAvg    = document.getElementById('stat-club-avg');
      const clubAvgSub = document.getElementById('stat-club-avg-sub');
      if (clubAvg) clubAvg.innerHTML = `${d.club?.avg_km || 0}<span class="unit"> km</span>`;
      if (clubAvgSub) clubAvgSub.textContent = `D+ moy. ${d.club?.avg_dplus || 0} m · ${d.club?.members || 0} membres`;

      // Sorties club (an) — combine déclaré + Strava
      const sortiesDone = document.getElementById('stat-sorties-done');
      const sortiesSub  = document.getElementById('stat-sorties-sub');
      const myKm = d.personal?.strava?.km || d.personal?.km_declared || 0;
      const myDplus = d.personal?.strava?.dplus || d.personal?.elevation_declared || 0;
      if (sortiesDone) sortiesDone.innerHTML = `${myKm}<span class="unit"> km</span>`;
      if (sortiesSub) sortiesSub.textContent = d.personal?.strava
        ? `${d.personal.strava.rides} rides Strava · D+ ${myDplus} m`
        : `D+ ${myDplus} m (déclaré)`;

      // Événements à venir
      const upcoming = document.getElementById('stat-upcoming');
      if (upcoming) upcoming.textContent = (d.upcoming_events || []).length;
    } catch (err) {
      console.warn('[dashboard]', err);
    }
  }
  loadDashboard();

  // ═════════════════════════════════════════════════════════════════
  // EXPORT RGPD — Article 20 portabilité
  // ═════════════════════════════════════════════════════════════════
  document.getElementById('export-data-btn')?.addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Préparation…';
    try {
      const token = window.CCS_AUTH?.getToken();
      const r = await fetch(window.CCS_CFG.API + '/auth/export-data', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob();
      const filename = (r.headers.get('content-disposition') || '').match(/filename="([^"]+)"/)?.[1]
        || `ccs-export-${new Date().toISOString().slice(0, 10)}.json`;
      // Trigger download via <a> temporaire
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (window.toast) window.toast(`Export téléchargé : ${filename}`, 'success', 4000);
    } catch (err) {
      if (window.toast) window.toast('Erreur export : ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // SESSIONS — liste + révocation
  // ═════════════════════════════════════════════════════════════════
  async function loadSessions() {
    const listEl = document.getElementById('sessions-list');
    const revokeAllBtn = document.getElementById('sessions-revoke-all-btn');
    if (!listEl) return;
    try {
      const data = await api('/auth/sessions');
      const sessions = data.sessions || [];
      if (sessions.length === 0) {
        listEl.innerHTML = '<div style="opacity:.6;">Aucune session active détectée.</div>';
        revokeAllBtn.hidden = true;
        return;
      }
      listEl.innerHTML = sessions.map(s => {
        const created = new Date(s.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const expires = new Date(s.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        const cur = s.is_current
          ? '<span style="color:var(--brass); font-weight:500;"> · session actuelle</span>'
          : ` <button class="btn-revoke" data-sid="${s.id}" style="background:transparent; border:1px solid #c08080; color:#c08080; padding:2px 8px; font-size:10px; cursor:pointer; margin-left:8px;">Révoquer</button>`;
        return `<div style="padding:8px 0; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <code style="font-size:11px; color:var(--parch-3);">…${s.short_hash}</code> · créée ${created}${cur}
            <div style="font-size:11px; color:var(--parch-3);">expire ${expires}</div>
          </div>
        </div>`;
      }).join('');
      const hasOthers = sessions.some(s => !s.is_current);
      revokeAllBtn.hidden = !hasOthers;
      // Listeners
      listEl.querySelectorAll('.btn-revoke').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Révoquer cette session ?')) return;
          try {
            await api('/auth/sessions/' + btn.dataset.sid, { method: 'DELETE' });
            window.toast?.('Session révoquée', 'success');
            loadSessions();
          } catch { window.toast?.('Erreur', 'error'); }
        });
      });
    } catch (err) {
      listEl.innerHTML = '<div style="color:#c08080;">Impossible de charger les sessions.</div>';
    }
  }
  loadSessions();

  document.getElementById('sessions-revoke-all-btn')?.addEventListener('click', async () => {
    if (!confirm('Déconnecter tous les autres appareils ? Vous resterez connecté ici.')) return;
    try {
      const data = await api('/auth/sessions', { method: 'DELETE' });
      window.toast?.(`${data.revoked || 0} session(s) révoquée(s)`, 'success');
      loadSessions();
    } catch { window.toast?.('Erreur révocation globale', 'error'); }
  });

  // ═════════════════════════════════════════════════════════════════
  // SUPPRESSION DE COMPTE — RGPD article 17
  // ═════════════════════════════════════════════════════════════════
  const dm = document.getElementById('delete-modal');
  function showDelModal() { dm.hidden = false; dm.style.display = 'flex'; }
  function hideDelModal() { dm.hidden = true; dm.style.display = 'none';
    document.getElementById('dm-pw').value = '';
    document.getElementById('dm-confirm').value = '';
    document.getElementById('dm-err').hidden = true;
  }
  hideDelModal();

  document.getElementById('ps-delete-btn')?.addEventListener('click', showDelModal);
  document.getElementById('dm-cancel')?.addEventListener('click', hideDelModal);
  document.getElementById('ps-export-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('export-data-btn')?.click();
  });
  dm?.addEventListener('click', (e) => { if (e.target === dm) hideDelModal(); });

  document.getElementById('dm-confirm-btn')?.addEventListener('click', async () => {
    const pw = document.getElementById('dm-pw').value;
    const confirm = document.getElementById('dm-confirm').value;
    const err = document.getElementById('dm-err');
    err.hidden = true;
    if (!pw) { err.textContent = 'Mot de passe requis'; err.hidden = false; return; }
    if (confirm !== 'SUPPRIMER') { err.textContent = 'Tapez exactement SUPPRIMER pour confirmer'; err.hidden = false; return; }
    const btn = document.getElementById('dm-confirm-btn');
    btn.disabled = true; btn.textContent = 'Suppression…';
    try {
      await api('/auth/account', { method: 'DELETE', body: { password: pw, confirm } });
      alert('Compte supprimé.\n\nVous allez être déconnecté et redirigé vers l\'accueil.');
      try { await window.CCS_AUTH.logout(); } catch {}
      location.href = '/';
    } catch (err2) {
      err.textContent = err2.message;
      err.hidden = false;
      btn.disabled = false; btn.textContent = 'Supprimer définitivement';
    }
  });
})();
