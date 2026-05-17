/* ── Chargement dynamique du profil connecté ── */
(async function loadProfile() {
  const waitFor = (cond, max = 50) => new Promise(resolve => {
    const tick = (n) => {
      if (cond()) return resolve(true);
      if (n >= max) return resolve(false);
      setTimeout(() => tick(n + 1), 60);
    };
    tick(0);
  });
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

  // ── Toggle bio_public (Brief RGPD) ────────────────────────────
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

  /* ─── Modal équipement (création/édition) ──────────────────── */
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
    setTimeout(() => inputTitre.focus(), 50);
  }
  function closeModal() { modal.hidden = true; editingId = null; }

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
        const token = window.CCS_AUTH?.getToken();
        const r = await fetch(`${window.CCS_CFG.API}/auth/equipment/${id}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
        currentEquip = currentEquip.filter(x => x.id !== id);
        renderEquipGrid(currentEquip);
        if (window.toast) window.toast('Équipement supprimé', 'success');
      } catch (err) {
        if (window.toast) window.toast('Erreur : ' + err.message, 'error');
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
      const token = window.CCS_AUTH?.getToken();
      const url   = editingId
        ? `${window.CCS_CFG.API}/auth/equipment/${editingId}`
        : `${window.CCS_CFG.API}/auth/equipment`;
      const method = editingId ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ titre, description: desc || undefined }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      if (editingId) {
        const it = currentEquip.find(x => x.id === editingId);
        if (it) { it.titre = titre; it.description = desc || null; }
      } else {
        const created = await r.json();
        currentEquip.push(created);
      }
      renderEquipGrid(currentEquip);
      closeModal();
      if (window.toast) window.toast(editingId ? 'Équipement modifié' : 'Équipement ajouté', 'success');
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

  document.getElementById('ps-logout-btn')?.addEventListener('click', async () => {
    if (!confirm('Confirmer la déconnexion ?')) return;
    await window.CCS_AUTH.logout();
  });

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
})();
