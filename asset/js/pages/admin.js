(() => {
  'use strict';
  const API = window.CCS_CONFIG.apiBase;

  // ── Helpers ─────────────────────────────────────────────────
  function apiFetch(path, opts = {}) {
    const token = CCS_AUTH.getToken();
    return fetch(API + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(opts.headers || {})
      }
    }).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || r.statusText);
      return data;
    });
  }

  function fmt(n) { return String(n ?? '—'); }
  function badge(statut) {
    return `<span class="tag-status tag-${statut}">${statut}</span>`;
  }
  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Navigation panels ────────────────────────────────────────
  document.querySelectorAll('.admin-nav-item[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('panel-' + btn.dataset.panel);
      if (panel) {
        panel.classList.add('active');
        loadPanel(btn.dataset.panel);
      }
    });
  });

  // ── Panel loaders ────────────────────────────────────────────
  const loaded = new Set();
  function loadPanel(name) {
    if (name === 'dashboard') { loadDashboard(); return; }
    if (!loaded.has(name)) { loaded.add(name); }
    const loaders = {
      sorties:      loadSorties,
      evenements:   loadEvenements,
      membres:      loadMembres,
      contacts:     loadContacts,
      gpx:          loadGpx,
      club:         loadClub,
      palmares:     loadPalmares,
      segments:     loadSegments,
      pois:         loadPois,
      'auto-import': loadAutoImport,
      audit:        loadAudit,
      diagnostic:   loadDiagnostic,
    };
    loaders[name]?.();
  }

  // ── Dashboard ────────────────────────────────────────────────
  async function loadDashboard() {
    const wrap = document.getElementById('dashboard-stats');
    try {
      const [sorties, evenements, membres, contacts] = await Promise.all([
        apiFetch('/sorties?limit=3'),
        apiFetch('/evenements?limit=3'),
        apiFetch('/membres'),
        apiFetch('/contact?limit=1'),
      ]);
      const total = sorties.total || (sorties.sorties||[]).length;
      const nouveaux = contacts.messages?.filter(m => m.statut === 'nouveau').length || 0;

      wrap.innerHTML = `
        <div class="admin-stat-card"><div class="admin-stat-v">${total}</div><div class="admin-stat-l">Sorties</div></div>
        <div class="admin-stat-card"><div class="admin-stat-v">${evenements.length || 0}</div><div class="admin-stat-l">Événements</div></div>
        <div class="admin-stat-card"><div class="admin-stat-v">${membres.length || 0}</div><div class="admin-stat-l">Membres</div></div>
        <div class="admin-stat-card"><div class="admin-stat-v" style="${nouveaux > 0 ? 'color:#c08080' : ''}">${nouveaux}</div><div class="admin-stat-l">Messages non lus</div></div>`;

      if (nouveaux > 0) {
        const badge = document.getElementById('contacts-badge');
        badge.textContent = nouveaux; badge.hidden = false;
      }

      const recentWrap = document.getElementById('dashboard-recent');
      const recentSorties = (sorties.sorties || sorties).slice(0,3);
      recentWrap.innerHTML = `
        <h3 style="font-family:var(--f-disp);font-size:16px;margin-bottom:16px;">Dernières <span class="it">sorties</span></h3>
        <table class="admin-table">
          <thead><tr><th>Titre</th><th>Date</th><th>Distance</th><th>Statut</th><th></th></tr></thead>
          <tbody>${recentSorties.map(s => `
            <tr>
              <td><b>${escHtml(s.title)}</b></td>
              <td>${s.date || '—'}</td>
              <td>${s.distance_km || '—'} km</td>
              <td>${badge(s.statut || 'passee')}</td>
              <td><a href="sortie.html?id=${encodeURIComponent(s.id)}" class="btn-xs">Voir →</a></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (err) {
      wrap.innerHTML = `<div class="admin-empty" style="color:#c08080;">${escHtml(err.message)}</div>`;
    }
  }

  // ── Sorties ──────────────────────────────────────────────────
  async function loadSorties() {
    const wrap = document.getElementById('sorties-table-wrap');
    try {
      const data = await apiFetch('/sorties?limit=100');
      const sorties = data.sorties || data;
      if (!sorties.length) { wrap.innerHTML = '<div class="admin-empty">Aucune sortie</div>'; return; }
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Titre</th><th>Date</th><th>Distance</th><th>GPX</th><th>Statut</th><th></th></tr></thead>
          <tbody>${sorties.map(s => `
            <tr data-id="${escHtml(s.id)}">
              <td style="font-family:var(--f-sans);font-size:10px;opacity:.6;">${escHtml(s.id)}</td>
              <td><b>${escHtml(s.title)}</b><br><small style="opacity:.5;">${escHtml(s.subtitle||'')}</small></td>
              <td>${s.date || '—'}</td>
              <td>${s.distance_km || '—'} km</td>
              <td>${s.gpx_ref ? '✅' : '—'}</td>
              <td>${badge(s.statut || 'passee')}</td>
              <td style="display:flex;gap:6px;align-items:center;">
                <a href="sortie.html?id=${encodeURIComponent(s.id)}" class="btn-xs" target="_blank">↗</a>
                <button class="btn-xs btn-edit-sortie" data-id="${escHtml(s.id)}">Éditer</button>
                <button class="btn-xs btn-diag-sortie" data-id="${escHtml(s.id)}" title="Diagnostiquer cette sortie (pourquoi la page apparaît vide ?)">⚕</button>
                <button class="btn-xs btn-xs-danger btn-del-sortie" data-id="${escHtml(s.id)}">✕</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;

      wrap.querySelectorAll('.btn-del-sortie').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          if (!confirm(`Supprimer définitivement la sortie « ${id} » ?\n\nCette action est IRRÉVERSIBLE. Tous les POIs, segments et inscriptions liés seront aussi supprimés (CASCADE).\n\nLe fichier GPX physique dans asset/gpx/ sera conservé.`)) return;
          const typed = prompt(`Pour confirmer, retapez l'identifiant de la sortie :\n\n${id}`);
          if (typed === null) return;
          if (typed.trim() !== id) {
            toast('Suppression annulée — identifiant ne correspond pas', 'warning');
            return;
          }
          try {
            await apiFetch('/sorties/' + encodeURIComponent(id), { method: 'DELETE' });
            toast('Sortie supprimée', 'success');
            loadSorties();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
      wrap.querySelectorAll('.btn-edit-sortie').forEach(btn => {
        btn.addEventListener('click', () => openSortieModal(btn.dataset.id));
      });
      wrap.querySelectorAll('.btn-diag-sortie').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const data = await apiFetch('/sorties/' + encodeURIComponent(btn.dataset.id) + '/diagnose');
            const ICONS = { ok: '✓', warning: '⚠', error: '✗' };
            const COLORS = { ok: '#7aa57a', warning: '#caa35b', error: '#c08080' };
            openModal(`
              <div class="admin-modal-title">Diagnostic <span class="it">de la sortie</span></div>
              <p style="font-family:var(--f-sans); font-size:12px; color:var(--parch-2); margin-bottom:18px;">
                <b>${escHtml(data.sortie.title)}</b> <span style="opacity:.6;">(id=${escHtml(data.sortie.id)}, gpx=${escHtml(data.sortie.gpx_filename || 'aucun')})</span>
              </p>
              <div style="font-family:var(--f-sans); font-size:13px;">
                ${data.checks.map(c => `
                  <div style="display:flex; gap:12px; padding:10px 12px; margin-bottom:6px; background:var(--ink-2); border-left:3px solid ${COLORS[c.status]}; border-radius:0;">
                    <span style="color:${COLORS[c.status]}; font-size:16px; line-height:1;">${ICONS[c.status]}</span>
                    <div>
                      <div style="color:var(--parch);">${escHtml(c.message)}</div>
                      ${c.suggestion ? `<div style="opacity:.6; font-size:11px; margin-top:4px;">→ ${escHtml(c.suggestion)}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
              <div style="margin-top:18px; padding:12px; background:var(--ink-2); font-family:var(--f-sans); font-size:11px; color:var(--parch-3);">
                <b>${data.summary.ok} OK</b> · <b>${data.summary.warnings} warnings</b> · <b>${data.summary.errors} erreurs</b>
              </div>
              <div class="admin-modal-actions">
                <a href="${data.view_url}" target="_blank" class="btn btn-ghost btn-sm">↗ Ouvrir la page sortie</a>
                <button class="btn btn-brass btn-sm" data-close-modal>Fermer</button>
              </div>
            `);
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      wrap.innerHTML = `<div class="admin-empty" style="color:#c08080;">${escHtml(err.message)}</div>`;
    }
  }

  // ── Membres ──────────────────────────────────────────────────
  async function loadMembres() {
    const wrap = document.getElementById('membres-table-wrap');
    try {
      const membres = await apiFetch('/membres');
      const me = window.CCS_AUTH.getUser();
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>№</th><th>Nom</th><th>Email</th><th>Rôle</th><th>FTP</th><th>Km saison</th><th></th></tr></thead>
          <tbody>${membres.map(m => {
            const isMe = me && me.id === m.id;
            return `
            <tr>
              <td style="opacity:.5;">${m.numero || '—'}</td>
              <td><b>${escHtml(m.prenom)} ${escHtml(m.nom)}</b>${isMe ? ' <span style="opacity:.5;font-size:10px;">(vous)</span>' : ''}</td>
              <td style="opacity:.7;">${escHtml(m.email || '')}</td>
              <td>${badge(m.role)}</td>
              <td>${m.ftp_w ? m.ftp_w + ' w' : '—'}</td>
              <td>${m.km_saison ? m.km_saison + ' km' : '—'}</td>
              <td style="display:flex;gap:6px;flex-wrap:wrap;">
                <select class="btn-xs role-select" data-id="${m.id}" ${isMe ? 'disabled title="Vous ne pouvez pas changer votre propre rôle"' : ''}>
                  <option value="membre"      ${m.role==='membre'?'selected':''}>Membre</option>
                  <option value="moderateur"  ${m.role==='moderateur'?'selected':''}>Modo</option>
                  <option value="admin"       ${m.role==='admin'?'selected':''}>Admin</option>
                </select>
                <button class="btn-xs btn-reset-pw" data-id="${m.id}" data-name="${escHtml(m.prenom + ' ' + m.nom)}" title="Générer un lien de réinitialisation de mot de passe">🔑</button>
                ${!isMe ? `<button class="btn-xs btn-xs-danger btn-deactivate" data-id="${m.id}" title="Désactiver ce compte">Désactiver</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>`;

      wrap.querySelectorAll('.role-select').forEach(sel => {
        sel.addEventListener('change', async () => {
          const newRole = sel.value;
          if (newRole === 'admin' && !confirm('Promouvoir ce membre au rang d\'administrateur ? Il aura tous les droits.')) {
            loadMembres();
            return;
          }
          try {
            await apiFetch('/membres/' + sel.dataset.id + '/role', { method: 'PATCH', body: JSON.stringify({ role: newRole }) });
            toast('Rôle mis à jour', 'success');
            loadMembres();
          } catch (err) { toast(err.message, 'error'); loadMembres(); }
        });
      });

      wrap.querySelectorAll('.btn-deactivate').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Désactiver ce membre ? Il ne pourra plus se connecter.')) return;
          try {
            await apiFetch('/membres/' + btn.dataset.id + '/actif', { method: 'PATCH', body: JSON.stringify({ actif: false }) });
            toast('Membre désactivé', 'success');
            loadMembres();
          } catch (err) { toast(err.message, 'error'); }
        });
      });

      wrap.querySelectorAll('.btn-reset-pw').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(`Générer un lien de réinitialisation pour ${btn.dataset.name} ?\n\nVous pourrez le copier-coller dans un email.`)) return;
          try {
            const data = await apiFetch('/auth/admin-reset/' + btn.dataset.id, { method: 'POST' });
            showResetLinkModal(data);
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      wrap.innerHTML = `<div class="admin-empty" style="color:#c08080;">${escHtml(err.message)}</div>`;
    }
  }

  function showResetLinkModal(data) {
    openModal(`
      <div class="admin-modal-title">Lien <span class="it">de réinitialisation</span></div>
      <p style="font-family:var(--f-sans); font-size:12px; line-height:1.6; color:var(--parch-2); margin-bottom:20px;">
        Lien généré pour <b>${escHtml(data.user.prenom)} ${escHtml(data.user.nom)}</b> (<i>${escHtml(data.user.email)}</i>).<br>
        Valable <b>${escHtml(data.expires_in)}</b>. Copiez-le et envoyez-le par email à la personne.
      </p>
      <div style="background:var(--ink-2); border:1px solid var(--line); padding:14px 16px; font-family:'DM Mono', monospace; font-size:12px; color:var(--brass); word-break:break-all; margin-bottom:18px;" id="reset-link-text">${escHtml(data.reset_link)}</div>
      <div class="admin-modal-actions">
        <button class="btn btn-ghost btn-sm" id="reset-copy-btn">📋 Copier</button>
        <button class="btn btn-brass btn-sm" data-close-modal>Fermer</button>
      </div>`);
    document.getElementById('reset-copy-btn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(data.reset_link);
        toast('Lien copié dans le presse-papiers', 'success');
      } catch {
        const range = document.createRange();
        range.selectNode(document.getElementById('reset-link-text'));
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        toast('Sélectionné — Ctrl+C pour copier', 'info');
      }
    });
  }

  // ── Contacts ─────────────────────────────────────────────────
  async function loadContacts() {
    const wrap = document.getElementById('contacts-table-wrap');
    try {
      const data = await apiFetch('/contact?limit=100');
      const msgs = data.messages || [];
      if (!msgs.length) { wrap.innerHTML = '<div class="admin-empty">Aucun message</div>'; return; }
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Date</th><th>Nom</th><th>Sujet</th><th>Statut</th><th></th></tr></thead>
          <tbody>${msgs.map(m => `
            <tr>
              <td style="opacity:.6;">${new Date(m.created_at).toLocaleDateString('fr-FR')}</td>
              <td><b>${escHtml(m.prenom)} ${escHtml(m.nom)}</b><br><small>${escHtml(m.email)}</small></td>
              <td>${escHtml(m.sujet)}</td>
              <td>${badge(m.statut)}</td>
              <td style="display:flex;gap:6px;">
                <button class="btn-xs btn-read-msg" data-id="${m.id}" data-msg='${JSON.stringify({ prenom: m.prenom, nom: m.nom, email: m.email, sujet: m.sujet, message: m.message, date: m.created_at }).replace(/'/g,"&#39;")}'>Lire</button>
                <button class="btn-xs btn-status-msg" data-id="${m.id}" data-statut="traite">✓ Traité</button>
                <button class="btn-xs btn-status-msg btn-xs-danger" data-id="${m.id}" data-statut="archive">Archive</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;

      wrap.querySelectorAll('.btn-read-msg').forEach(btn => {
        btn.addEventListener('click', () => {
          try {
            const d = JSON.parse(btn.dataset.msg.replace(/&#39;/g,"'"));
            openModal(`
              <div class="admin-modal-title">Message <span class="it">de</span> ${escHtml(d.prenom)} ${escHtml(d.nom)}</div>
              <p style="font-family:var(--f-sans);font-size:11px;opacity:.6;margin-bottom:16px;">${escHtml(d.email)} · ${new Date(d.date).toLocaleDateString('fr-FR')}</p>
              <p style="font-family:var(--f-sans);font-size:13px;font-weight:600;margin-bottom:8px;">${escHtml(d.sujet)}</p>
              <p style="font-family:var(--f-sans);font-size:13px;line-height:1.7;white-space:pre-wrap;">${escHtml(d.message)}</p>
              <div class="admin-modal-actions"><button class="btn btn-ghost btn-sm" data-close-modal>Fermer</button><a href="mailto:${escHtml(d.email)}?subject=Re: ${encodeURIComponent(d.sujet)}" class="btn btn-brass btn-sm">Répondre par email</a></div>`);
            apiFetch('/contact/' + btn.dataset.id + '/statut', { method: 'PATCH', body: JSON.stringify({ statut: 'lu' }) }).then(() => loadContacts()).catch(() => {});
          } catch {}
        });
      });
      wrap.querySelectorAll('.btn-status-msg').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiFetch('/contact/' + btn.dataset.id + '/statut', { method: 'PATCH', body: JSON.stringify({ statut: btn.dataset.statut }) });
            toast('Statut mis à jour', 'success');
            loadContacts();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      wrap.innerHTML = `<div class="admin-empty" style="color:#c08080;">${escHtml(err.message)}</div>`;
    }
  }

  // ── GPX ──────────────────────────────────────────────────────
  async function loadGpx() {
    const wrap = document.getElementById('gpx-table-wrap');
    try {
      const files = await apiFetch('/gpx');
      if (!files.length) { wrap.innerHTML = '<div class="admin-empty">Aucun fichier GPX uploadé</div>'; return; }
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Fichier</th><th>Taille</th><th>Modifié</th><th></th></tr></thead>
          <tbody>${files.map(f => `
            <tr>
              <td style="font-family:var(--f-sans);font-size:11px;">${escHtml(f.filename)}</td>
              <td>${(f.size/1024).toFixed(1)} Ko</td>
              <td style="opacity:.6;">${new Date(f.modified).toLocaleDateString('fr-FR')}</td>
              <td style="display:flex;gap:6px;">
                <a href="${API}/gpx/${encodeURIComponent(f.filename)}" class="btn-xs" download>↓ Télécharger</a>
                <button class="btn-xs btn-xs-danger btn-del-gpx" data-name="${escHtml(f.filename)}">✕ Supprimer</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      wrap.querySelectorAll('.btn-del-gpx').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(`Supprimer ${btn.dataset.name} ?`)) return;
          try {
            await apiFetch('/gpx/' + encodeURIComponent(btn.dataset.name), { method: 'DELETE' });
            toast('Fichier supprimé', 'success'); loadGpx();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      wrap.innerHTML = `<div class="admin-empty" style="color:#c08080;">${escHtml(err.message)}</div>`;
    }
  }

  // Upload GPX
  document.getElementById('gpx-upload-input')?.addEventListener('change', async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    const progress = document.getElementById('gpx-upload-progress');
    progress.hidden = false;
    progress.innerHTML = `<span style="font-family:var(--f-sans);font-size:12px;opacity:.7;">Upload en cours…</span>`;
    for (const file of files) {
      const fd = new FormData();
      fd.append('gpx', file);
      try {
        const token = CCS_AUTH.getToken();
        const res = await fetch(API + '/gpx/upload', {
          method: 'POST',
          headers: token ? { Authorization: 'Bearer ' + token } : {},
          body: fd
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast(`${file.name} uploadé`, 'success');
      } catch (err) { toast(`${file.name} : ${err.message}`, 'error'); }
    }
    progress.hidden = true;
    e.target.value = '';
    loadGpx();
  });

  // ── Club settings ────────────────────────────────────────────
  async function loadClub() {
    const wrap = document.getElementById('club-settings-wrap');
    try {
      const settings = await apiFetch('/club');
      const fields = Object.entries(settings).map(([k, v]) => `
        <div class="field" style="margin-bottom:16px;">
          <label style="font-family:var(--f-sans);font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.6;" for="club-${k}">${k.replace(/_/g,' ')}</label>
          <input id="club-${k}" name="${escHtml(k)}" type="text" value="${escHtml(v||'')}">
        </div>`).join('');
      wrap.innerHTML = `
        <div style="max-width:480px;">
          ${fields}
          <button class="btn btn-brass" id="save-club-btn">Enregistrer</button>
        </div>`;
      document.getElementById('save-club-btn')?.addEventListener('click', async () => {
        const updates = {};
        wrap.querySelectorAll('input[name]').forEach(el => { updates[el.name] = el.value; });
        try {
          await apiFetch('/club', { method: 'PUT', body: JSON.stringify(updates) });
          toast('Paramètres sauvegardés', 'success');
        } catch (err) { toast(err.message, 'error'); }
      });
    } catch (err) {
      wrap.innerHTML = `<div class="admin-empty" style="color:#c08080;">${escHtml(err.message)}</div>`;
    }
  }

  // ── Palmarès ─────────────────────────────────────────────────
  async function loadPalmares() {
    const wrap = document.getElementById('palmares-table-wrap');
    try {
      const items = await apiFetch('/palmares');
      if (!items.length) { wrap.innerHTML = '<div class="admin-empty">Aucun résultat — cliquez sur « + Nouveau résultat »</div>'; return; }
      const medLabels = { or: '🥇 Or', argent: '🥈 Argent', bronze: '🥉 Bronze' };
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Année</th><th>Titre</th><th>Événement</th><th>Catégorie</th><th>Rang</th><th>Médaille</th><th></th></tr></thead>
          <tbody>${items.map(p => `
            <tr data-id="${p.id}">
              <td>${escHtml(p.annee || '—')}</td>
              <td><b>${escHtml(p.titre || '—')}</b>${p.equipe ? ' <span style="opacity:.5;font-size:10px;">(équipe)</span>' : ''}</td>
              <td>${escHtml(p.evenement || '—')}</td>
              <td style="opacity:.7;">${escHtml(p.categorie || '—')}</td>
              <td>${p.rang ? p.rang + 'ᵉ' : '—'}</td>
              <td>${medLabels[p.medaille] || '—'}</td>
              <td style="display:flex;gap:6px;">
                <button class="btn-xs btn-edit-palm" data-id="${p.id}">Éditer</button>
                <button class="btn-xs btn-xs-danger btn-del-palm" data-id="${p.id}">✕</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      wrap.querySelectorAll('.btn-del-palm').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Supprimer ce résultat ?')) return;
          try {
            await apiFetch('/palmares/' + btn.dataset.id, { method: 'DELETE' });
            toast('Résultat supprimé', 'success');
            loadPalmares();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
      wrap.querySelectorAll('.btn-edit-palm').forEach(btn => {
        btn.addEventListener('click', () => openPalmModal(items.find(p => String(p.id) === btn.dataset.id)));
      });
    } catch (err) {
      wrap.innerHTML = `<div class="admin-empty" style="color:#c08080;">${escHtml(err.message)}</div>`;
    }
  }

  function openPalmModal(p) {
    const data = p || {};
    const isEdit = !!p;
    openModal(`
      <div class="admin-modal-title">${isEdit ? 'Éditer' : 'Nouveau'} <span class="it">résultat</span></div>
      <div class="admin-form-grid">
        <div class="field"><label>Année *</label><input id="p-annee" type="number" min="1978" max="2100" value="${data.annee || new Date().getFullYear()}"></div>
        <div class="field"><label>Médaille</label>
          <select id="p-medaille">
            <option value="">—</option>
            <option value="or"     ${data.medaille==='or'?'selected':''}>Or (1ᵉʳ)</option>
            <option value="argent" ${data.medaille==='argent'?'selected':''}>Argent (2ᵉ)</option>
            <option value="bronze" ${data.medaille==='bronze'?'selected':''}>Bronze (3ᵉ)</option>
          </select>
        </div>
        <div class="field admin-form-full"><label>Titre / Coureur *</label><input id="p-titre" value="${escHtml(data.titre||'')}" placeholder="ex: Antoine Lemaire"></div>
        <div class="field admin-form-full"><label>Événement</label><input id="p-evenement" value="${escHtml(data.evenement||'')}" placeholder="ex: Grand Prix de Salouel"></div>
        <div class="field"><label>Catégorie</label><input id="p-categorie" value="${escHtml(data.categorie||'')}" placeholder="ex: FSGT 2ᵉ"></div>
        <div class="field"><label>Rang</label><input id="p-rang" type="number" value="${data.rang||''}" placeholder="ex: 1, 5, 12"></div>
        <div class="field"><label>Sortie liée (id)</label><input id="p-sortie" value="${escHtml(data.sortie_id||'')}" placeholder="optionnel"></div>
        <div class="field"><label style="display:flex; align-items:center; gap:8px; cursor:pointer;"><input type="checkbox" id="p-equipe" ${data.equipe ? 'checked' : ''}> Résultat d'équipe</label></div>
      </div>
      <div id="modal-err" class="auth-error" hidden></div>
      <div class="admin-modal-actions">
        <button class="btn btn-ghost btn-sm" data-close-modal>Annuler</button>
        <button class="btn btn-brass btn-sm" id="save-palm-btn">Enregistrer</button>
      </div>`);
    document.getElementById('save-palm-btn').addEventListener('click', async () => {
      const errEl = document.getElementById('modal-err');
      const body = {
        annee:     parseInt(document.getElementById('p-annee').value) || null,
        titre:     document.getElementById('p-titre').value.trim(),
        evenement: document.getElementById('p-evenement').value.trim() || null,
        categorie: document.getElementById('p-categorie').value.trim() || null,
        rang:      parseInt(document.getElementById('p-rang').value) || null,
        medaille:  document.getElementById('p-medaille').value || null,
        equipe:    document.getElementById('p-equipe').checked,
        sortie_id: document.getElementById('p-sortie').value.trim() || null,
      };
      if (!body.annee || !body.titre) {
        errEl.textContent = 'Année et titre sont requis'; errEl.hidden = false; return;
      }
      try {
        if (isEdit) {
          await apiFetch('/palmares/' + p.id, { method: 'PUT', body: JSON.stringify(body) });
        } else {
          await apiFetch('/palmares', { method: 'POST', body: JSON.stringify(body) });
        }
        closeModal();
        toast(isEdit ? 'Résultat mis à jour' : 'Résultat ajouté', 'success');
        loadPalmares();
      } catch (err) { errEl.textContent = err.message; errEl.hidden = false; }
    });
  }

  // ── Segments KOM ─────────────────────────────────────────────
  async function loadSegments() {
    const wrap = document.getElementById('segments-table-wrap');
    try {
      const items = await apiFetch('/segments');
      if (!items.length) { wrap.innerHTML = '<div class="admin-empty">Aucun segment</div>'; return; }
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Nom</th><th>Lieu</th><th>Étoiles</th><th>Longueur</th><th>Meilleur temps</th><th>KOM</th><th></th></tr></thead>
          <tbody>${items.map(s => `
            <tr data-id="${s.id}">
              <td><b>${escHtml(s.name || '—')}</b></td>
              <td style="opacity:.7;">${escHtml(s.location || '—')}</td>
              <td>${'★'.repeat(s.stars || 0)}</td>
              <td>${s.length_m ? (s.length_m/1000).toFixed(1)+' km' : '—'}</td>
              <td>${escHtml(s.meilleur_temps || '—')}</td>
              <td style="opacity:.7;">${escHtml(s.kom || '—')}</td>
              <td style="display:flex;gap:6px;">
                <button class="btn-xs btn-edit-seg" data-id="${s.id}">Éditer</button>
                <button class="btn-xs btn-xs-danger btn-del-seg" data-id="${s.id}">✕</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      wrap.querySelectorAll('.btn-del-seg').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Supprimer ce segment ?')) return;
          try {
            await apiFetch('/segments/' + btn.dataset.id, { method: 'DELETE' });
            toast('Segment supprimé', 'success');
            loadSegments();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
      wrap.querySelectorAll('.btn-edit-seg').forEach(btn => {
        btn.addEventListener('click', () => openSegmentModal(items.find(s => String(s.id) === btn.dataset.id)));
      });
    } catch (err) {
      wrap.innerHTML = `<div class="admin-empty" style="color:#c08080;">${escHtml(err.message)}</div>`;
    }
  }

  function openSegmentModal(s) {
    const data = s || {};
    const isEdit = !!s;
    openModal(`
      <div class="admin-modal-title">${isEdit ? 'Éditer' : 'Nouveau'} <span class="it">segment</span></div>
      <div class="admin-form-grid">
        <div class="field admin-form-full"><label>Nom *</label><input id="seg-name" value="${escHtml(data.name||'')}" placeholder="ex: Côte du Pas-Bayard"></div>
        <div class="field admin-form-full"><label>Lieu</label><input id="seg-location" value="${escHtml(data.location||'')}" placeholder="ex: Marbaix, Avesnois"></div>
        <div class="field"><label>Étoiles</label>
          <select id="seg-stars">
            ${[1,2,3,4,5].map(n => `<option value="${n}" ${data.stars==n?'selected':''}>${'★'.repeat(n)} (${n})</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Longueur (m)</label><input id="seg-length" type="number" value="${data.length_m||''}"></div>
        <div class="field"><label>Meilleur temps</label><input id="seg-time" value="${escHtml(data.meilleur_temps||'')}" placeholder="ex: 2:14"></div>
        <div class="field"><label>Delta moyenne</label><input id="seg-delta" value="${escHtml(data.delta_moyenne||'')}" placeholder="ex: −12 s"></div>
        <div class="field"><label>Rang</label><input id="seg-rang" value="${escHtml(data.rang||'')}" placeholder="ex: 1/47"></div>
        <div class="field"><label>KOM</label><input id="seg-kom" value="${escHtml(data.kom||'')}" placeholder="ex: T. Dubois"></div>
        <div class="field"><label>Sortie liée (id)</label><input id="seg-sortie" value="${escHtml(data.sortie_id||'')}" placeholder="optionnel"></div>
      </div>
      <div id="modal-err" class="auth-error" hidden></div>
      <div class="admin-modal-actions">
        <button class="btn btn-ghost btn-sm" data-close-modal>Annuler</button>
        <button class="btn btn-brass btn-sm" id="save-seg-btn">Enregistrer</button>
      </div>`);
    document.getElementById('save-seg-btn').addEventListener('click', async () => {
      const errEl = document.getElementById('modal-err');
      const body = {
        name:           document.getElementById('seg-name').value.trim(),
        location:       document.getElementById('seg-location').value.trim() || null,
        stars:          parseInt(document.getElementById('seg-stars').value) || 3,
        length_m:       parseInt(document.getElementById('seg-length').value) || null,
        meilleur_temps: document.getElementById('seg-time').value.trim() || null,
        delta_moyenne:  document.getElementById('seg-delta').value.trim() || null,
        rang:           document.getElementById('seg-rang').value.trim() || null,
        kom:            document.getElementById('seg-kom').value.trim() || null,
        sortie_id:      document.getElementById('seg-sortie').value.trim() || null,
      };
      if (!body.name) {
        errEl.textContent = 'Nom requis'; errEl.hidden = false; return;
      }
      try {
        if (isEdit) {
          await apiFetch('/segments/' + s.id, { method: 'PUT', body: JSON.stringify(body) });
        } else {
          await apiFetch('/segments', { method: 'POST', body: JSON.stringify(body) });
        }
        closeModal();
        toast(isEdit ? 'Segment mis à jour' : 'Segment ajouté', 'success');
        loadSegments();
      } catch (err) { errEl.textContent = err.message; errEl.hidden = false; }
    });
  }

  // ── POIs (admin global) ──────────────────────────────────────
  let _poisAll = [];
  async function loadPois() {
    const wrap = document.getElementById('pois-table-wrap');
    const typeF = document.getElementById('poi-filter-type');
    const qF = document.getElementById('poi-filter-q');
    try {
      const params = [];
      if (typeF.value) params.push('type=' + encodeURIComponent(typeF.value));
      if (qF.value)    params.push('q=' + encodeURIComponent(qF.value.trim()));
      const url = '/pois' + (params.length ? '?' + params.join('&') : '');
      const items = await apiFetch(url);
      _poisAll = items;
      if (!items.length) { wrap.innerHTML = '<div class="admin-empty">Aucun point d\'intérêt</div>'; return; }
      const TYPE_LABELS = { signaleur: '🚩 Signaleur', ravito: '🍞 Ravito', danger: '⚠ Danger', secteur: '★ Secteur', depart: '◯ Départ', arrivee: '◉ Arrivée' };
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Type</th><th>Libellé</th><th>Sortie</th><th>Km</th><th>Coords</th><th>Créé par</th><th></th></tr></thead>
          <tbody>${items.map(p => `
            <tr data-id="${escHtml(p.id)}">
              <td style="white-space:nowrap;">${TYPE_LABELS[p.type] || p.type}</td>
              <td><b>${escHtml(p.label || '—')}</b>${p.description ? '<br><span style="opacity:.6;font-size:11px;">' + escHtml(p.description.slice(0, 80)) + (p.description.length > 80 ? '…' : '') + '</span>' : ''}</td>
              <td><a href="sortie.html?id=${encodeURIComponent(p.sortie_id)}" target="_blank" style="color:var(--brass);">${escHtml(p.sortie_title)}</a></td>
              <td style="opacity:.7;">${p.km != null ? Number(p.km).toFixed(1) : '—'}</td>
              <td style="font-family:'DM Mono',monospace;font-size:11px;opacity:.6;">${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}</td>
              <td style="opacity:.7;">${p.user_added ? '👤 ' : '🤖 '}${escHtml(p.creator || '—')}</td>
              <td>
                <button class="btn-xs btn-xs-danger btn-del-poi" data-id="${escHtml(p.id)}" data-label="${escHtml(p.label || p.id)}">✕ Suppr.</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      wrap.querySelectorAll('.btn-del-poi').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(`Supprimer le POI « ${btn.dataset.label} » ?`)) return;
          try {
            await apiFetch('/pois/' + encodeURIComponent(btn.dataset.id), { method: 'DELETE' });
            toast('POI supprimé', 'success');
            loadPois();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      wrap.innerHTML = `<div class="admin-empty" style="color:#c08080;">${escHtml(err.message)}</div>`;
    }
  }
  let _poiFilterTimer;
  document.addEventListener('input', (e) => {
    if (e.target.id === 'poi-filter-q') {
      clearTimeout(_poiFilterTimer);
      _poiFilterTimer = setTimeout(loadPois, 300);
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'poi-filter-type') loadPois();
  });

  // ── Événements ───────────────────────────────────────────────
  async function loadEvenements() {
    const wrap = document.getElementById('evenements-table-wrap');
    try {
      const events = await apiFetch('/evenements?limit=100');
      if (!events.length) { wrap.innerHTML = '<div class="admin-empty">Aucun événement</div>'; return; }
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Titre</th><th>Date</th><th>Lieu</th><th>Inscrits</th><th>Statut</th><th></th></tr></thead>
          <tbody>${events.map(e => `
            <tr>
              <td><b>${escHtml(e.title)}</b></td>
              <td>${e.date || '—'}</td>
              <td>${escHtml(e.lieu || '—')}</td>
              <td>${e.inscrits || 0}${e.max_inscrits ? '/' + e.max_inscrits : ''}</td>
              <td>${badge(e.statut)}</td>
              <td style="display:flex;gap:6px;">
                <button class="btn-xs btn-edit-event" data-id="${e.id}">Éditer</button>
                <button class="btn-xs btn-xs-danger btn-del-event" data-id="${e.id}">✕</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      wrap.querySelectorAll('.btn-edit-event').forEach(btn => {
        btn.addEventListener('click', () => openEventModal(btn.dataset.id));
      });
      wrap.querySelectorAll('.btn-del-event').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Supprimer cet événement ?')) return;
          try {
            await apiFetch('/evenements/' + btn.dataset.id, { method: 'DELETE' });
            toast('Événement supprimé', 'success'); loadEvenements();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      wrap.innerHTML = `<div class="admin-empty" style="color:#c08080;">${escHtml(err.message)}</div>`;
    }
  }

  // ── Modal helpers ────────────────────────────────────────────
  function openModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').hidden = false;
  }
  function closeModal() { document.getElementById('modal-overlay').hidden = true; }
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.closest('[data-close-modal]')) { closeModal(); return; }
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  async function openSortieModal(id) {
    let sortie = null;
    let availableGpx = [];
    if (id) {
      try { sortie = await apiFetch('/sorties/' + encodeURIComponent(id)); } catch {}
    }
    try {
      availableGpx = await apiFetch('/gpx');
      if (!Array.isArray(availableGpx)) availableGpx = [];
    } catch {}
    const s = sortie || {};
    const currentGpx = s.gpx_ref || s.gpx_filename || '';

    const gpxOptions = ['<option value="">— Aucun GPX assigné —</option>'];
    const allFilenames = new Set(availableGpx.map(g => g.filename));
    if (currentGpx && !allFilenames.has(currentGpx)) {
      gpxOptions.push(`<option value="${escHtml(currentGpx)}" selected>${escHtml(currentGpx)} (fichier introuvable)</option>`);
    }
    availableGpx.forEach(g => {
      const sel = (g.filename === currentGpx) ? 'selected' : '';
      const sizeKb = g.size ? ` · ${(g.size/1024).toFixed(0)} ko` : '';
      gpxOptions.push(`<option value="${escHtml(g.filename)}" ${sel}>${escHtml(g.filename)}${sizeKb}</option>`);
    });

    openModal(`
      <div class="admin-modal-title">${id ? 'Éditer' : 'Nouvelle'} <span class="it">sortie</span></div>
      <div class="admin-form-grid">
        <div class="field admin-form-full"><label>ID *</label><input id="m-id" value="${escHtml(s.id||'')}" ${id?'readonly':''} placeholder="ex: tour-avesnois-2026 (minuscules, tirets)"></div>
        <div class="field"><label>Titre *</label><input id="m-title" value="${escHtml(s.title||'')}"></div>
        <div class="field"><label>Date *</label><input id="m-date" type="date" value="${s.date ? String(s.date).slice(0,10) : ''}"></div>
        <div class="field admin-form-full"><label>Sous-titre</label><input id="m-subtitle" value="${escHtml(s.subtitle||'')}"></div>
        <div class="field"><label>Type de parcours</label>
          <select id="m-chapter">
            <option value="route" ${(s.chapter||'route')==='route'?'selected':''}>Route</option>
            <option value="gravel" ${s.chapter==='gravel'?'selected':''}>Gravel</option>
            <option value="cote" ${s.chapter==='cote'?'selected':''}>Côte (mer)</option>
            <option value="monts" ${s.chapter==='monts'?'selected':''}>Monts (collines)</option>
            <option value="pave" ${s.chapter==='pave'?'selected':''}>Pavé</option>
            <option value="peloton" ${s.chapter==='peloton'?'selected':''}>Peloton (course)</option>
          </select>
        </div>
        <div class="field"><label>Statut</label>
          <select id="m-statut">
            <option value="passee" ${s.statut==='passee'?'selected':''}>Passée</option>
            <option value="en_cours" ${s.statut==='en_cours'?'selected':''}>En cours</option>
            <option value="future" ${s.statut==='future'?'selected':''}>Future</option>
          </select>
        </div>
        <div class="field admin-form-full"><label>Description</label><textarea id="m-desc" rows="3">${escHtml(s.description||'')}</textarea></div>
        <div class="field"><label>Distance (km)</label><input id="m-dist" type="number" step="0.1" value="${s.distance_km||''}"></div>
        <div class="field"><label>D+ (m)</label><input id="m-dplus" type="number" value="${s.elevation_gain||''}"></div>
        <div class="field admin-form-full">
          <label>Parcours GPX officiel</label>
          <div style="display:flex;gap:8px;align-items:stretch;">
            <select id="m-gpx" style="flex:1;">${gpxOptions.join('')}</select>
            <button type="button" class="btn btn-ghost btn-sm" id="m-gpx-upload-btn" style="white-space:nowrap;">↑ Uploader nouveau</button>
            <input type="file" id="m-gpx-upload-input" accept=".gpx" hidden>
          </div>
          <div id="m-gpx-upload-msg" style="font-family:var(--f-sans);font-size:11px;color:var(--parch-3);margin-top:6px;"></div>
        </div>
        <div class="field"><label>Lieu de départ</label><input id="m-loc-name" value="${escHtml(s.location?.name||'')}"></div>
        <div class="field"><label>Lat départ</label><input id="m-lat" type="number" step="any" value="${s.location?.lat||''}"></div>
        <div class="field"><label>Lng départ</label><input id="m-lng" type="number" step="any" value="${s.location?.lng||''}"></div>
      </div>
      <div id="modal-err" class="auth-error" hidden></div>
      <div class="admin-modal-actions">
        <button class="btn btn-ghost btn-sm" data-close-modal>Annuler</button>
        <button class="btn btn-brass btn-sm" id="modal-save-sortie">Enregistrer</button>
      </div>`);

    if (!id) {
      const titleEl = document.getElementById('m-title');
      const idEl    = document.getElementById('m-id');
      let idTouched = false;
      idEl.addEventListener('input', () => { idTouched = true; });
      titleEl.addEventListener('input', () => {
        if (idTouched) return;
        idEl.value = titleEl.value
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      });
    }

    const uploadBtn = document.getElementById('m-gpx-upload-btn');
    const uploadInput = document.getElementById('m-gpx-upload-input');
    const uploadMsg = document.getElementById('m-gpx-upload-msg');
    uploadBtn?.addEventListener('click', () => uploadInput.click());
    uploadInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.gpx')) {
        uploadMsg.style.color = '#c08080';
        uploadMsg.textContent = 'Format invalide — fichier .gpx requis';
        return;
      }
      uploadMsg.style.color = 'var(--brass)';
      uploadMsg.textContent = `Upload de ${file.name}…`;
      const fd = new FormData(); fd.append('gpx', file);
      try {
        const token = CCS_AUTH.getToken();
        const res = await fetch(API + '/gpx/upload', {
          method: 'POST',
          headers: token ? { Authorization: 'Bearer ' + token } : {},
          body: fd
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Upload échoué');
        const select = document.getElementById('m-gpx');
        const opt = document.createElement('option');
        opt.value = data.filename || file.name;
        opt.textContent = (data.filename || file.name) + ` · ${(file.size/1024).toFixed(0)} ko`;
        opt.selected = true;
        select.appendChild(opt);
        uploadMsg.style.color = '#80c080';
        uploadMsg.textContent = `✅ ${data.filename || file.name} uploadé et sélectionné`;
      } catch (err) {
        uploadMsg.style.color = '#c08080';
        uploadMsg.textContent = '❌ ' + err.message;
      }
      uploadInput.value = '';
    });

    document.getElementById('modal-save-sortie').addEventListener('click', async () => {
      const errEl = document.getElementById('modal-err');
      const body = {
        id:              document.getElementById('m-id').value.trim(),
        title:           document.getElementById('m-title').value.trim(),
        date:            document.getElementById('m-date').value,
        subtitle:        document.getElementById('m-subtitle').value.trim(),
        description:     document.getElementById('m-desc').value.trim(),
        distance_km:     parseFloat(document.getElementById('m-dist').value) || null,
        elevation_gain:  parseInt(document.getElementById('m-dplus').value) || null,
        gpx_ref:         document.getElementById('m-gpx').value.trim() || null,
        chapter:         document.getElementById('m-chapter').value,
        statut:          document.getElementById('m-statut').value,
        location: {
          name: document.getElementById('m-loc-name').value.trim() || null,
          lat:  parseFloat(document.getElementById('m-lat').value) || null,
          lng:  parseFloat(document.getElementById('m-lng').value) || null,
        }
      };
      if (!body.id || !body.title || !body.date) {
        errEl.textContent = 'ID, titre et date sont requis'; errEl.hidden = false; return;
      }
      try {
        if (id) {
          await apiFetch('/sorties/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(body) });
        } else {
          await apiFetch('/sorties', { method: 'POST', body: JSON.stringify(body) });
        }
        closeModal();
        toast(id ? 'Sortie mise à jour' : 'Sortie créée', 'success');
        loadSorties();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });
  }

  document.getElementById('btn-new-sortie')?.addEventListener('click', () => openSortieModal(null));
  document.getElementById('btn-import-gpx')?.addEventListener('click', () => openImportGpxModal());
  document.getElementById('btn-orphan-gpx')?.addEventListener('click', () => openOrphanGpxModal());
  document.getElementById('btn-new-event')?.addEventListener('click', () => openEventModal(null));
  document.getElementById('btn-new-palm')?.addEventListener('click', () => openPalmModal(null));
  document.getElementById('btn-new-segment')?.addEventListener('click', () => openSegmentModal(null));

  async function openEventModal(id) {
    let ev = null;
    if (id) {
      try { ev = await apiFetch('/evenements/' + encodeURIComponent(id)); } catch {}
    }
    const e = ev || {};
    openModal(`
      <div class="admin-modal-title">${id ? 'Éditer' : 'Nouvel'} <span class="it">événement</span></div>
      <div class="admin-form-grid">
        <div class="field"><label>Titre *</label><input id="e-title" value="${escHtml(e.title||'')}"></div>
        <div class="field"><label>Type *</label>
          <select id="e-type">
            <option value="cyclosportive" ${e.type==='cyclosportive'?'selected':''}>Cyclosportive</option>
            <option value="gravel"        ${e.type==='gravel'?'selected':''}>Gravel</option>
            <option value="criterium"     ${e.type==='criterium'?'selected':''}>Critérium</option>
            <option value="course"        ${e.type==='course'?'selected':''}>Course</option>
            <option value="rando"         ${e.type==='rando'?'selected':''}>Randonnée</option>
            <option value="championnat"   ${e.type==='championnat'?'selected':''}>Championnat</option>
            <option value="autre"         ${e.type==='autre'?'selected':''}>Autre</option>
          </select>
        </div>
        <div class="field admin-form-full"><label>Sous-titre</label><input id="e-subtitle" value="${escHtml(e.subtitle||'')}"></div>
        <div class="field admin-form-full"><label>Description</label><textarea id="e-desc" rows="3">${escHtml(e.description||'')}</textarea></div>
        <div class="field"><label>Date *</label><input id="e-date" type="date" value="${e.date ? String(e.date).slice(0,10) : ''}"></div>
        <div class="field"><label>Heure</label><input id="e-heure" type="time" value="${escHtml(e.heure||'08:30')}"></div>
        <div class="field"><label>Lieu</label><input id="e-lieu" value="${escHtml(e.lieu||'')}"></div>
        <div class="field"><label>Région</label><input id="e-region" value="${escHtml(e.region||'')}"></div>
        <div class="field"><label>Distance (km)</label><input id="e-dist" type="number" value="${e.distance_km||''}"></div>
        <div class="field"><label>Engagement (€)</label><input id="e-eur" type="number" step="0.5" value="${e.engagement_eur||''}"></div>
        <div class="field"><label>Max inscrits</label><input id="e-max" type="number" value="${e.max_inscrits||''}"></div>
        <div class="field"><label>Statut</label>
          <select id="e-statut">
            <option value="ouvert"  ${e.statut==='ouvert'?'selected':''}>Ouvert</option>
            <option value="complet" ${e.statut==='complet'?'selected':''}>Complet</option>
            <option value="termine" ${e.statut==='termine'?'selected':''}>Terminé</option>
            <option value="annule"  ${e.statut==='annule'?'selected':''}>Annulé</option>
          </select>
        </div>
        <div class="field admin-form-full"><label>Lié à la sortie (id)</label><input id="e-sortie" value="${escHtml(e.sortie_id||'')}" placeholder="ex. arenberg-2025-04-05"></div>
      </div>
      <div id="e-modal-err" class="auth-error" hidden></div>
      <div class="admin-modal-actions">
        <button class="btn btn-ghost btn-sm" data-close-modal>Annuler</button>
        <button class="btn btn-brass btn-sm" id="modal-save-event">Enregistrer</button>
      </div>`);

    document.getElementById('modal-save-event').addEventListener('click', async () => {
      const errEl = document.getElementById('e-modal-err');
      const body = {
        title:          document.getElementById('e-title').value.trim(),
        type:           document.getElementById('e-type').value,
        subtitle:       document.getElementById('e-subtitle').value.trim(),
        description:    document.getElementById('e-desc').value.trim(),
        date:           document.getElementById('e-date').value,
        heure:          document.getElementById('e-heure').value,
        lieu:           document.getElementById('e-lieu').value.trim(),
        region:         document.getElementById('e-region').value.trim(),
        distance_km:    parseInt(document.getElementById('e-dist').value) || null,
        engagement_eur: parseFloat(document.getElementById('e-eur').value) || null,
        max_inscrits:   parseInt(document.getElementById('e-max').value) || null,
        statut:         document.getElementById('e-statut').value,
        sortie_id:      document.getElementById('e-sortie').value.trim() || null,
      };
      if (!body.title || !body.date) {
        errEl.textContent = 'Titre et date sont requis'; errEl.hidden = false; return;
      }
      try {
        if (id) {
          await apiFetch('/evenements/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(body) });
        } else {
          await apiFetch('/evenements', { method: 'POST', body: JSON.stringify(body) });
        }
        closeModal();
        toast(id ? 'Événement mis à jour' : 'Événement créé', 'success');
        loadEvenements();
      } catch (err) { errEl.textContent = err.message; errEl.hidden = false; }
    });
  }

  // ── Toast ────────────────────────────────────────────────────
  function toast(msg, type = 'info') {
    if (window.toast) window.toast(msg, type);
    else console.log(`[${type}] ${msg}`);
  }

  // ════════════════════════════════════════════════════════════
  //  Auto-import (scraping + génération automatique)
  // ════════════════════════════════════════════════════════════
  function loadAutoImport() {
    const scrapeBtn = document.getElementById('btn-scrape');
    const genBtn = document.getElementById('btn-generate-course');
    const genOfflineBtn = document.getElementById('btn-generate-offline');

    if (scrapeBtn && !scrapeBtn._wired) {
      scrapeBtn._wired = true;
      scrapeBtn.addEventListener('click', scrapeNow);
    }
    if (genBtn && !genBtn._wired) {
      genBtn._wired = true;
      genBtn.addEventListener('click', () => generateCourse(false));
    }
    if (genOfflineBtn && !genOfflineBtn._wired) {
      genOfflineBtn._wired = true;
      genOfflineBtn.addEventListener('click', () => generateCourse(true));
    }
  }

  async function scrapeNow() {
    const status = document.getElementById('scrape-status');
    const wrap = document.getElementById('scraped-events');
    status.style.display = 'block';
    status.style.color = 'var(--t-cream-2)';
    status.textContent = '🔄 Scraping en cours…';
    wrap.innerHTML = '';

    try {
      const result = await apiFetch('/auto-courses/scrape');
      status.innerHTML = '✓ <strong>' + result.total + '</strong> événements détectés' +
        (result.errors?.length ? ' · ⚠ ' + result.errors.length + ' erreurs' : '');

      if (!result.events?.length) {
        wrap.innerHTML = '<div class="admin-empty">Aucun événement détecté.</div>';
        return;
      }

      let html = '<table class="admin-table"><thead><tr>' +
        '<th>Date</th><th>Course</th><th>Lieu</th><th>Distance</th><th>Type</th><th>Source</th><th>Action</th>' +
        '</tr></thead><tbody>';
      result.events.forEach((e, idx) => {
        html += '<tr>' +
          '<td>' + (e.date || '—') + '</td>' +
          '<td><strong>' + escHtml(e.name) + '</strong></td>' +
          '<td>' + escHtml(e.lieu || '—') + ' <span style="opacity:.6">' + escHtml(e.region || '') + '</span></td>' +
          '<td>' + (e.distanceKm || '—') + ' km</td>' +
          '<td>' + escHtml(e.type || 'rando') + '</td>' +
          '<td><a href="' + escHtml(e.sourceUrl) + '" target="_blank" rel="noopener" style="opacity:.7;font-size:11px;">' + escHtml(e.source) + ' ↗</a></td>' +
          '<td><button class="btn btn-ghost btn-sm" data-import-idx="' + idx + '">Importer</button></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      wrap.innerHTML = html;

      window.__lastScrapedEvents = result.events;
      wrap.querySelectorAll('[data-import-idx]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.importIdx, 10);
          const e = window.__lastScrapedEvents[idx];
          try {
            const res = await apiFetch('/auto-courses/import', {
              method: 'POST',
              body: JSON.stringify({ events: [e], generateGpx: !!(e.waypoints && e.waypoints.length >= 2) }),
            });
            const r = res.results?.[0];
            if (r) {
              btn.textContent = r.gpx ? '✓ Importé + GPX' : '✓ Importé (sans GPX)';
              btn.disabled = true;
              toast('Importé : ' + e.name, 'success');
            }
          } catch (err) { toast('Erreur : ' + err.message, 'error'); }
        });
      });
    } catch (err) {
      status.style.color = '#c08080';
      status.textContent = '✗ Erreur : ' + err.message;
    }
  }

  async function generateCourse(offline) {
    const result = document.getElementById('generate-result');
    result.innerHTML = '<div style="padding:16px;background:var(--ink-2);font-family:var(--f-sans);font-size:12px;">🔄 Génération en cours…</div>';

    const wpText = document.getElementById('auto-waypoints').value.trim();
    const waypoints = [];
    for (const line of wpText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split(',').map(p => p.trim());
      if (parts.length < 2) continue;
      const lat = parseFloat(parts[0]), lng = parseFloat(parts[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      waypoints.push({
        lat, lng,
        type:  parts[2] || null,
        label: parts[3] || '',
        desc:  parts[4] || '',
      });
    }

    if (waypoints.length < 2) {
      result.innerHTML = '<div style="padding:16px;background:#3a1410;color:#ffb;">⚠ Au moins 2 waypoints valides requis</div>';
      return;
    }

    const body = {
      name:       document.getElementById('auto-name').value || 'Course sans nom',
      region:     document.getElementById('auto-region').value || null,
      distanceKm: parseFloat(document.getElementById('auto-distance').value) || null,
      laps:       parseInt(document.getElementById('auto-laps').value) || 1,
      waypoints,
      skipNetwork: !!offline,
    };

    try {
      const res = await apiFetch('/auto-courses/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const stats = res.stats || {};
      result.innerHTML =
        '<div style="padding:16px;background:var(--ink-2);border-left:3px solid var(--brass);">' +
          '<h4 style="margin:0 0 8px 0;font-family:var(--f-disp);">✓ Course générée : ' + escHtml(res.id) + '</h4>' +
          '<div style="font-family:var(--f-sans);font-size:12px;line-height:1.7;">' +
            '<div>📁 <a href="' + escHtml(res.gpxUrl) + '" target="_blank" rel="noopener">' + escHtml(res.gpxFilename) + '</a> · ' + stats.points + ' points</div>' +
            '<div>📏 Distance : ' + stats.distanceKm + ' km · D+ ' + stats.dPlus + ' m · D− ' + stats.dMinus + ' m</div>' +
            '<div>🏔 Altitude : ' + stats.eleMin + ' m → ' + stats.eleMax + ' m</div>' +
            '<div>📍 POIs : ' + (res.pois?.length || 0) + '</div>' +
            '<div>⏱ Durée : ' + stats.durationMs + ' ms</div>' +
            (res.errors?.length ? '<div style="color:#c08080">⚠ ' + escHtml(res.errors.join(', ')) + '</div>' : '') +
            '<div style="margin-top:12px;"><a href="sortie.html?id=' + escHtml(res.id) + '" class="btn btn-ghost btn-sm" target="_blank">Voir la page sortie →</a></div>' +
          '</div>' +
        '</div>';
      toast('Course générée : ' + res.id, 'success');
    } catch (err) {
      result.innerHTML = '<div style="padding:16px;background:#3a1410;color:#ffb;">✗ ' + escHtml(err.message) + '</div>';
    }
  }

  // ── Init ─────────────────────────────────────────────────────
  (async () => {
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

    if (!window.CCS_AUTH.isLoggedIn() || !window.CCS_AUTH.isAdmin()) {
      return;
    }

    document.body.dataset.role = window.CCS_AUTH.getUser()?.role || '';
    loadDashboard();
  })();

  // ─────────────────────────────────────────────────────────────
  // IMPORT DEPUIS GPX — modal qui auto-remplit les champs
  // ─────────────────────────────────────────────────────────────

  function parseGpxClient(xml) {
    const ptRe = /<trkpt\s+lat="([\-\d.]+)"\s+lon="([\-\d.]+)"\s*>([\s\S]*?)<\/trkpt>|<trkpt\s+lat="([\-\d.]+)"\s+lon="([\-\d.]+)"\s*\/>/g;
    const eleRe = /<ele>([\-\d.]+)<\/ele>/;
    const points = [];
    let m;
    while ((m = ptRe.exec(xml)) !== null) {
      const lat = parseFloat(m[1] ?? m[4]);
      const lng = parseFloat(m[2] ?? m[5]);
      const inner = m[3] ?? '';
      const eleMatch = inner.match(eleRe);
      const p = { lat, lng };
      if (eleMatch) p.ele = parseFloat(eleMatch[1]);
      points.push(p);
    }
    if (points.length < 2) throw new Error(`GPX vide ou invalide (${points.length} points)`);
    let distM = 0, dPlus = 0, dMinus = 0;
    const haver = (a, b) => {
      const R = 6371000, toR = d => d * Math.PI / 180;
      const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
      const x = Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
      return R * 2 * Math.asin(Math.sqrt(x));
    };
    for (let i = 1; i < points.length; i++) {
      distM += haver(points[i-1], points[i]);
      if (typeof points[i].ele === 'number' && typeof points[i-1].ele === 'number') {
        const d = points[i].ele - points[i-1].ele;
        if (d > 0) dPlus += d; else dMinus += -d;
      }
    }

    const meta = {};
    const mdMatch = xml.match(/<metadata>([\s\S]*?)<\/metadata>/);
    const trkHead = xml.match(/<trk>([\s\S]*?)<trkseg/);
    const sources = [mdMatch?.[1], trkHead?.[1]].filter(Boolean);
    for (const src of sources) {
      if (!meta.name) {
        const nm = src.match(/<name>([\s\S]*?)<\/name>/);
        if (nm) meta.name = nm[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      }
      if (!meta.desc) {
        const dm = src.match(/<desc>([\s\S]*?)<\/desc>/);
        if (dm) meta.desc = dm[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      }
      if (!meta.time) {
        const tm = src.match(/<time>([\s\S]*?)<\/time>/);
        if (tm) meta.time = tm[1].trim();
      }
      if (!meta.type) {
        const tym = src.match(/<type>([\s\S]*?)<\/type>/);
        if (tym) meta.type = tym[1].trim().toLowerCase();
      }
    }

    if (!meta.time) {
      const firstPtMatch = xml.match(/<trkpt[^>]*>[\s\S]*?<time>([\s\S]*?)<\/time>/);
      if (firstPtMatch) meta.time = firstPtMatch[1].trim();
    }

    let dateISO = null;
    if (meta.time) {
      const d = new Date(meta.time);
      if (!isNaN(d)) dateISO = d.toISOString().slice(0, 10);
    }

    let chapter = null;
    const elevRatio = distM > 0 ? (dPlus / (distM / 1000)) : 0;
    if (meta.type) {
      const t = meta.type;
      if (t.includes('gravel') || t.includes('mountain') || t.includes('mtb')) chapter = 'gravel';
      else if (t.includes('road') || t.includes('cycling')) chapter = 'route';
    }
    if (!chapter) {
      if (elevRatio > 12) chapter = 'monts';
      else chapter = 'route';
    }

    return {
      points_count:   points.length,
      distance_km:    Math.round(distM / 100) / 10,
      elevation_gain: Math.round(dPlus),
      elevation_loss: Math.round(dMinus),
      start:          points[0],
      end:            points[points.length - 1],
      name:           meta.name || null,
      description:    meta.desc || null,
      date:           dateISO,
      chapter,
    };
  }

  function slugifyClient(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  async function openOrphanGpxModal() {
    openModal(`
      <h2 class="admin-modal-title">GPX <span class="it">orphelins</span></h2>
      <p style="color:var(--parch-2); font-family:var(--f-sans); font-size:12px; line-height:1.6; margin-bottom:20px;">
        Fichiers <code>.gpx</code> présents dans <code>asset/gpx/</code> mais
        rattachés à <b>aucune sortie</b> en base. Cliquez « Importer » sur
        chaque fichier pour le réinjecter en tant que nouvelle sortie.
      </p>
      <div id="orphan-list" style="font-family:var(--f-sans); font-size:13px;">
        <div class="loading-spinner"></div>
      </div>
      <div class="admin-modal-actions">
        <button class="btn btn-brass btn-sm" data-close-modal>Fermer</button>
      </div>
    `);

    try {
      const data = await apiFetch('/sorties/orphan-gpx/list');
      const wrap = document.getElementById('orphan-list');
      if (!data.orphans || data.orphans.length === 0) {
        wrap.innerHTML = `<div style="background:var(--ink-2); border:1px solid var(--line); padding:20px; text-align:center; color:var(--parch-3);">
          ✓ Aucun fichier orphelin. Tous les ${data.total_files || 0} GPX sont rattachés à une sortie.
        </div>`;
        return;
      }
      wrap.innerHTML = `
        <div style="background:var(--ink-2); border:1px solid var(--brass); padding:12px 16px; margin-bottom:14px; font-size:12px; color:var(--brass);">
          <b>${data.orphans.length}</b> fichier(s) orphelin(s) sur ${data.total_files} total ·
          ${data.used_count} déjà rattaché(s) à une sortie.
        </div>
        <table class="admin-table" style="width:100%;">
          <thead>
            <tr><th>Fichier</th><th>Distance</th><th>D+</th><th>Modifié</th><th></th></tr>
          </thead>
          <tbody>
            ${data.orphans.map(o => `
              <tr>
                <td><b>${escHtml(o.filename)}</b>${o.metrics?.name_from_gpx ? `<br><span style="opacity:.6;font-size:11px;">${escHtml(o.metrics.name_from_gpx)}</span>` : ''}</td>
                <td>${o.metrics?.distance_km != null ? o.metrics.distance_km + ' km' : '<span style="color:#c08080;">' + (o.metrics?.error || '—') + '</span>'}</td>
                <td>${o.metrics?.elevation_gain != null ? o.metrics.elevation_gain + ' m' : '—'}</td>
                <td style="opacity:.6; font-size:11px;">${new Date(o.modified).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}</td>
                <td>
                  <button class="btn-xs btn-restore-orphan" data-filename="${escHtml(o.filename)}" data-slug="${escHtml(o.suggested_slug)}" data-name="${escHtml(o.metrics?.name_from_gpx || '')}">Importer</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;

      wrap.querySelectorAll('.btn-restore-orphan').forEach(btn => {
        btn.addEventListener('click', async () => {
          const filename = btn.dataset.filename;
          const suggested = btn.dataset.name || btn.dataset.slug.replace(/-/g, ' ');
          const title = prompt(`Titre pour cette sortie :`, suggested);
          if (!title) return;
          const today = new Date().toISOString().slice(0, 10);
          const date = prompt(`Date (YYYY-MM-DD) :`, today);
          if (!date) return;

          btn.textContent = 'Import…';
          btn.disabled = true;
          try {
            const res = await fetch('/asset/gpx/' + encodeURIComponent(filename));
            if (!res.ok) throw new Error('Fichier introuvable');
            const blob = await res.blob();
            const fd = new FormData();
            fd.append('gpx', new File([blob], filename, { type: 'application/gpx+xml' }));
            fd.append('title', title);
            fd.append('date', date);
            fd.append('slug', btn.dataset.slug);
            fd.append('chapter', 'route');
            fd.append('statut', 'passee');
            const token = CCS_AUTH.getToken();
            const r2 = await fetch(API + '/sorties/import-gpx', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + token },
              body: fd
            });
            const data2 = await r2.json();
            if (!r2.ok) throw new Error(data2.error || 'HTTP ' + r2.status);
            btn.textContent = '✓ Importé';
            btn.style.background = 'var(--brass)';
            toast(`« ${data2.sortie.title} » réimporté`, 'success');
          } catch (err) {
            btn.textContent = 'Erreur';
            btn.disabled = false;
            alert('Échec : ' + err.message);
          }
        });
      });
    } catch (err) {
      document.getElementById('orphan-list').innerHTML = `<div style="color:#c08080;">${escHtml(err.message)}</div>`;
    }
  }

  function openImportGpxModal() {
    openModal(`
      <h2 class="admin-modal-title">Importer une sortie depuis un GPX</h2>
      <p style="color:var(--parch-2); font-family:var(--f-sans); font-size:12px; line-height:1.6; margin-bottom:24px;">
        Téléversez un fichier <code>.gpx</code> (Strava, RideWithGPS, Komoot, organisateur).
        <b>Le formulaire se remplit automatiquement</b> à partir des métadonnées du GPX :
        titre, date, type de parcours, description, et lieu de départ (via géocodage inverse).
        Vous pouvez ensuite ajuster les champs avant d'importer.
      </p>

      <div class="admin-form-row">
        <label class="admin-form-label">Fichier GPX <span style="color:var(--brass);">*</span></label>
        <input type="file" id="ig-file" accept=".gpx,application/gpx+xml" style="font-family:var(--f-sans); font-size:13px; color:var(--parch);">
      </div>

      <div id="ig-preview" hidden style="background:var(--ink-2); border:1px solid var(--line); padding:16px; margin-bottom:24px; font-family:var(--f-sans); font-size:12px;">
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; color:var(--parch-2);">
          <div><div style="opacity:.6; text-transform:uppercase; letter-spacing:.06em; font-size:10px; margin-bottom:4px;">Distance</div><div id="ig-p-dist" style="color:var(--brass); font-size:18px;">—</div></div>
          <div><div style="opacity:.6; text-transform:uppercase; letter-spacing:.06em; font-size:10px; margin-bottom:4px;">D+</div><div id="ig-p-dplus" style="color:var(--brass); font-size:18px;">—</div></div>
          <div><div style="opacity:.6; text-transform:uppercase; letter-spacing:.06em; font-size:10px; margin-bottom:4px;">Points</div><div id="ig-p-pts" style="color:var(--parch); font-size:18px;">—</div></div>
          <div><div style="opacity:.6; text-transform:uppercase; letter-spacing:.06em; font-size:10px; margin-bottom:4px;">Départ</div><div id="ig-p-start" style="color:var(--parch); font-size:11px; padding-top:6px;">—</div></div>
        </div>
      </div>

      <div class="admin-form-row">
        <label class="admin-form-label">Titre <span style="color:var(--brass);">*</span></label>
        <input type="text" id="ig-title" placeholder="Ex : Tour de l'Avesnois">
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div class="admin-form-row">
          <label class="admin-form-label">Date <span style="color:var(--brass);">*</span></label>
          <input type="date" id="ig-date">
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Statut</label>
          <select id="ig-statut">
            <option value="passee">Passée</option>
            <option value="future">À venir</option>
          </select>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div class="admin-form-row">
          <label class="admin-form-label">Slug (URL)</label>
          <input type="text" id="ig-slug" placeholder="auto-généré">
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Type de parcours</label>
          <select id="ig-chapter">
            <option value="route">Route</option>
            <option value="gravel">Gravel</option>
            <option value="cote">Côte (mer)</option>
            <option value="monts">Monts (collines)</option>
            <option value="pave">Pavé</option>
            <option value="peloton">Peloton (course)</option>
          </select>
        </div>
      </div>

      <div class="admin-form-row">
        <label class="admin-form-label">Sous-titre</label>
        <input type="text" id="ig-subtitle" placeholder="Ex : Maroilles · Avesnes · Solre-le-Château">
      </div>

      <div class="admin-form-row">
        <label class="admin-form-label">Lieu de départ</label>
        <input type="text" id="ig-location" placeholder="Ex : Maroilles, place de la Mairie">
      </div>

      <div class="admin-form-row">
        <label class="admin-form-label">Description</label>
        <textarea id="ig-desc" rows="3" placeholder="Quelques lignes sur le parcours, l'ambiance, le mot du président…"></textarea>
      </div>

      <label style="display:flex; align-items:center; gap:8px; font-family:var(--f-sans); font-size:12px; color:var(--parch-2); margin-top:8px; cursor:pointer;">
        <input type="checkbox" id="ig-featured"> Mettre en avant sur la page d'accueil
      </label>

      <div id="ig-err" hidden style="color:#c08080; margin-top:16px; font-family:var(--f-sans); font-size:12px;"></div>

      <div class="admin-modal-actions">
        <button class="btn btn-ghost btn-sm" data-close-modal>Annuler</button>
        <button class="btn btn-brass btn-sm" id="ig-submit" disabled>Importer</button>
      </div>
    `);

    const fileInput = document.getElementById('ig-file');
    const titleEl   = document.getElementById('ig-title');
    const slugEl    = document.getElementById('ig-slug');
    const submitBtn = document.getElementById('ig-submit');
    const errEl     = document.getElementById('ig-err');
    const preview   = document.getElementById('ig-preview');
    let parsedFile  = null;

    fileInput.addEventListener('change', async () => {
      errEl.hidden = true;
      preview.hidden = true;
      parsedFile = null;
      submitBtn.disabled = true;
      const f = fileInput.files?.[0];
      if (!f) return;
      if (!f.name.toLowerCase().endsWith('.gpx')) {
        errEl.textContent = 'Format invalide — fichier .gpx requis';
        errEl.hidden = false;
        return;
      }
      try {
        const xml = await f.text();
        const m = parseGpxClient(xml);
        document.getElementById('ig-p-dist').textContent  = m.distance_km.toFixed(1) + ' km';
        document.getElementById('ig-p-dplus').textContent = m.elevation_gain + ' m';
        document.getElementById('ig-p-pts').textContent   = m.points_count;
        document.getElementById('ig-p-start').textContent = m.start.lat.toFixed(4) + ', ' + m.start.lng.toFixed(4);
        preview.hidden = false;
        parsedFile = { file: f, metrics: m };
        submitBtn.disabled = false;

        const titleField = document.getElementById('ig-title');
        if (!titleField.value.trim()) {
          const nameFromFile = f.name.replace(/\.gpx$/i, '').replace(/[-_]+/g, ' ');
          titleField.value = m.name || nameFromFile;
          titleField.dispatchEvent(new Event('input'));
        }

        const dateField = document.getElementById('ig-date');
        if (!dateField.value) {
          dateField.value = m.date || new Date().toISOString().slice(0, 10);
        }

        const statutField = document.getElementById('ig-statut');
        const today = new Date().toISOString().slice(0, 10);
        if (dateField.value && dateField.value > today) {
          statutField.value = 'future';
        } else {
          statutField.value = 'passee';
        }

        const chapterField = document.getElementById('ig-chapter');
        if (m.chapter && chapterField.value === 'route') {
          chapterField.value = m.chapter;
        }

        const descField = document.getElementById('ig-desc');
        if (!descField.value.trim() && m.description) {
          descField.value = m.description;
        }

        const subField = document.getElementById('ig-subtitle');
        if (!subField.value.trim()) {
          subField.value = `${m.distance_km.toFixed(0)} km · D+ ${m.elevation_gain} m`;
        }

        const locField = document.getElementById('ig-location');
        if (!locField.value.trim()) {
          locField.placeholder = 'Recherche en cours…';
          try {
            const ctrl = new AbortController();
            setTimeout(() => ctrl.abort(), 4000);
            const r = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${m.start.lat}&lon=${m.start.lng}&zoom=14&addressdetails=1`,
              { signal: ctrl.signal, headers: { 'Accept-Language': 'fr' } }
            );
            if (r.ok) {
              const geo = await r.json();
              const a = geo.address || {};
              const ville = a.village || a.town || a.city || a.municipality || a.county;
              const lieu = a.amenity || a.road;
              const parts = [lieu, ville].filter(Boolean);
              if (parts.length) locField.value = parts.join(', ');
            }
          } catch {}
          locField.placeholder = 'Ex : Maroilles, place de la Mairie';
        }

        if (window.toast) {
          const filledFields = [];
          if (m.name)        filledFields.push('titre');
          if (m.date)        filledFields.push('date');
          if (m.description) filledFields.push('description');
          if (filledFields.length) {
            window.toast(`Auto-rempli : ${filledFields.join(', ')}`, 'info');
          }
        }
      } catch (err) {
        errEl.textContent = 'Erreur lecture GPX : ' + err.message;
        errEl.hidden = false;
      }
    });

    let slugTouched = false;
    slugEl.addEventListener('input', () => { slugTouched = true; });
    titleEl.addEventListener('input', () => {
      if (!slugTouched) slugEl.value = slugifyClient(titleEl.value);
    });

    submitBtn.addEventListener('click', async () => {
      errEl.hidden = true;
      if (!parsedFile) {
        errEl.textContent = 'Sélectionnez un fichier GPX'; errEl.hidden = false; return;
      }
      const title = titleEl.value.trim();
      const date  = document.getElementById('ig-date').value;
      if (!title) { errEl.textContent = 'Titre requis'; errEl.hidden = false; return; }
      if (!date)  { errEl.textContent = 'Date requise'; errEl.hidden = false; return; }

      const fd = new FormData();
      fd.append('gpx', parsedFile.file);
      fd.append('title', title);
      fd.append('date', date);
      fd.append('slug', slugEl.value.trim());
      fd.append('chapter', document.getElementById('ig-chapter').value);
      fd.append('statut', document.getElementById('ig-statut').value);
      fd.append('subtitle', document.getElementById('ig-subtitle').value.trim());
      fd.append('location_name', document.getElementById('ig-location').value.trim());
      fd.append('description', document.getElementById('ig-desc').value.trim());
      fd.append('featured', document.getElementById('ig-featured').checked ? 'true' : 'false');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Import…';
      try {
        const token = CCS_AUTH.getToken();
        if (!token) {
          throw new Error('Vous n\'êtes plus connecté. Rechargez la page et reconnectez-vous.');
        }
        const res = await fetch(API + '/sorties/import-gpx', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
          body: fd,
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); }
        catch { data = { error: text || `HTTP ${res.status}` }; }

        if (!res.ok) {
          const detail = data.error || data.message || `Erreur HTTP ${res.status}`;
          console.error('[import-gpx]', res.status, data);
          throw new Error(detail);
        }
        if (!data.sortie) {
          throw new Error('Réponse serveur incomplète');
        }
        closeModal();
        toast(`Sortie « ${data.sortie.title} » importée — ${data.gpx_metrics.distance_km} km, D+${data.gpx_metrics.elevation_gain} m`, 'success');
        loadSorties();
      } catch (err) {
        errEl.innerHTML = '<b>Échec de l\'import :</b> ' + (err.message || err) +
          '<br><span style="opacity:.6;font-size:11px;">Détails dans la console (F12) et dans les logs serveur.</span>';
        errEl.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Importer';
      }
    });
  }

  // ── Audit log ────────────────────────────────────────────────
  async function loadAudit() {
    const wrap = document.getElementById('audit-table-wrap');
    wrap.innerHTML = '<div class="admin-empty"><div class="loading-spinner"></div></div>';
    const action = document.getElementById('audit-filter-action').value;
    const entity = document.getElementById('audit-filter-entity').value;
    const limit  = document.getElementById('audit-filter-limit').value;
    const qs = new URLSearchParams();
    if (action) qs.set('action', action);
    if (entity) qs.set('entity', entity);
    if (limit)  qs.set('limit', limit);
    try {
      const data = await apiFetch('/admin/audit?' + qs.toString());
      if (!data.rows?.length) {
        wrap.innerHTML = '<div class="admin-empty">Aucune entrée pour ces filtres.</div>';
        return;
      }
      const rows = data.rows.map(r => {
        const payload = r.payload
          ? `<details><summary style="cursor:pointer;opacity:.6;">payload</summary><pre style="font-size:11px;margin:4px 0;white-space:pre-wrap;">${escHtml(typeof r.payload === 'string' ? r.payload : JSON.stringify(r.payload, null, 2))}</pre></details>`
          : '<span style="opacity:.4;">—</span>';
        return `
          <tr>
            <td style="font-family:monospace;font-size:11px;opacity:.6;">${escHtml(r.created_at)}</td>
            <td>${escHtml(r.username || '—')}<br><span style="opacity:.4;font-size:11px;">#${r.user_id || '?'}</span></td>
            <td><span class="filter-chip">${escHtml(r.action)}</span></td>
            <td>${escHtml(r.entity)}<br><span style="opacity:.5;font-size:11px;">${escHtml(r.entity_id || '')}</span></td>
            <td style="font-family:monospace;font-size:11px;opacity:.6;">${escHtml(r.ip_address || '')}</td>
            <td>${payload}</td>
          </tr>`;
      }).join('');
      wrap.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Quand</th><th>Qui</th><th>Action</th><th>Entité</th><th>IP</th><th>Détails</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="opacity:.5;font-size:11px;margin-top:8px;">${data.count} entrée(s) affichée(s)</div>`;
    } catch (err) {
      wrap.innerHTML = `<div class="admin-empty"><b>Erreur :</b> ${escHtml(err.message)}</div>`;
    }
  }
  // Wire les filtres + boutons (au premier load du panel, les éléments existent)
  document.addEventListener('change', (e) => {
    if (e.target.matches('#audit-filter-action, #audit-filter-entity, #audit-filter-limit')) loadAudit();
  });
  document.addEventListener('click', async (e) => {
    if (e.target.id === 'btn-audit-refresh') { loadAudit(); return; }
    if (e.target.id === 'btn-audit-purge') {
      const days = prompt('Purger les entrées de plus de combien de jours ? (min 30, défaut 365)', '365');
      if (days == null) return;
      const n = parseInt(days, 10);
      if (!Number.isFinite(n) || n < 30) { alert('Minimum 30 jours.'); return; }
      try {
        const res = await apiFetch('/admin/audit/purge', { method: 'POST', body: JSON.stringify({ days: n }) });
        alert(res.message || 'OK');
        loadAudit();
      } catch (err) { alert('Échec : ' + err.message); }
    }
  });

  // ── Diagnostic (scraper + metrics) ───────────────────────────
  function loadDiagnostic() {
    // Lazy : ne charge rien au switch — les boutons déclenchent
  }

  document.addEventListener('click', async (e) => {
    if (e.target.id === 'btn-scraper-health') {
      const out = document.getElementById('scraper-health-result');
      out.innerHTML = '<div class="loading-spinner"></div> En cours…';
      try {
        const data = await apiFetch('/admin/scraper-health');
        const statusColor = data.status === 'healthy' ? 'var(--brass)' : data.status === 'degraded' ? '#d4a637' : '#c44';
        const fallbackList = Object.entries(data.fallbacks || {}).map(([k, v]) => `<li><code>${escHtml(k)}</code> × ${v}</li>`).join('');
        const errorList = (data.errors || []).map(e => `<li><b>${escHtml(e.source)}</b> : ${escHtml(e.error)}</li>`).join('');
        out.innerHTML = `
          <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:baseline;margin:12px 0;">
            <div><span style="color:${statusColor};font-weight:600;font-size:18px;text-transform:uppercase;">${escHtml(data.status)}</span></div>
            <div><b>${data.eventsCount}</b> events scrapés</div>
            <div><b>${data.errorsCount}</b> erreur(s)</div>
            <div>en <b>${data.durationMs}</b> ms</div>
          </div>
          ${fallbackList ? `<p style="opacity:.7;">Fallbacks regex déclenchés (= structure HTML cible probablement modifiée) :</p><ul>${fallbackList}</ul>` : ''}
          ${errorList ? `<p style="opacity:.7;">Erreurs :</p><ul>${errorList}</ul>` : ''}
          <details style="margin-top:12px;"><summary style="cursor:pointer;opacity:.6;">Log complet</summary><pre style="font-size:11px;white-space:pre-wrap;">${escHtml((data.log || []).join('\n'))}</pre></details>`;
      } catch (err) {
        out.innerHTML = `<div class="admin-empty"><b>Échec :</b> ${escHtml(err.message)}</div>`;
      }
    }
    if (e.target.id === 'btn-metrics-refresh') {
      const out = document.getElementById('metrics-result');
      out.innerHTML = '<div class="loading-spinner"></div>';
      try {
        const m = await apiFetch('/admin/metrics');
        const uptimeH = Math.floor(m.uptime_s / 3600);
        const uptimeM = Math.floor((m.uptime_s % 3600) / 60);
        out.innerHTML = `
          <div class="admin-stats" style="margin-top:12px;">
            <div class="admin-stat-card"><div class="admin-stat-v">${uptimeH}h${uptimeM}m</div><div class="admin-stat-l">Uptime</div></div>
            <div class="admin-stat-card"><div class="admin-stat-v">${m.memory.rss_mb}<span style="font-size:14px;"> Mo</span></div><div class="admin-stat-l">RSS</div></div>
            <div class="admin-stat-card"><div class="admin-stat-v">${m.memory.heapUsed_mb}<span style="font-size:14px;"> Mo</span></div><div class="admin-stat-l">Heap used</div></div>
            <div class="admin-stat-card"><div class="admin-stat-v" style="font-size:18px;">${escHtml(m.nodeVersion)}</div><div class="admin-stat-l">Node</div></div>
          </div>
          <div style="opacity:.5;font-size:11px;margin-top:12px;">PID ${m.pid} · ${escHtml(m.platform)} · env ${escHtml(m.env)}</div>`;
      } catch (err) {
        out.innerHTML = `<div class="admin-empty"><b>Erreur :</b> ${escHtml(err.message)}</div>`;
      }
    }
  });
})();
