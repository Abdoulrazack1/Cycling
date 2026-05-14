(async () => {
  const params = new URLSearchParams(location.search);
  const evId = params.get('id') || params.get('slug');
  if (!evId) {
    document.getElementById('ev-title').textContent = 'Événement non spécifié';
    return;
  }

  const wait = () => new Promise(r => {
    const tick = () => window.CCS_DATA ? r() : setTimeout(tick, 50);
    tick();
  });
  await wait();

  let ev;
  try {
    ev = await window.CCS_DATA.getEvenement(evId);
  } catch (err) {
    document.getElementById('ev-title').textContent = 'Événement introuvable';
    document.getElementById('ev-subtitle').textContent = err.message || '';
    return;
  }

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const fmtDateBig = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  };
  const fmtDays = (iso) => {
    if (!iso) return '—';
    const days = Math.ceil((new Date(iso) - new Date()) / 86400000);
    if (days < 0) return 'Passé';
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Demain';
    return `Dans ${days} j`;
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  document.title = `${ev.title} · C.C. Salouel`;
  document.getElementById('bc-title').textContent = ev.title;
  document.getElementById('ev-chapter').textContent = (ev.type || 'événement').toUpperCase();
  document.getElementById('ev-title').innerHTML = ev.title_html || esc(ev.title);
  document.getElementById('ev-subtitle').textContent = ev.subtitle || '';

  const metaItems = [
    { l: 'Date', v: fmtDateBig(ev.date) },
    { l: 'J−', v: fmtDays(ev.date) },
    { l: 'Distance', v: ev.distance_km ? `${ev.distance_km} km` : '—' },
    { l: 'Inscrits', v: ev.max_inscrits ? `${ev.inscrits || 0}/${ev.max_inscrits}` : (ev.inscrits || 0) },
  ];
  document.getElementById('ev-meta').innerHTML = metaItems.map(m =>
    `<div class="page-head-meta-item"><div class="page-head-meta-l">${m.l}</div><div class="page-head-meta-v">${m.v}</div></div>`
  ).join('');

  if (ev.description) {
    document.getElementById('ev-description').textContent = ev.description;
  } else {
    document.getElementById('ev-description-block').hidden = true;
  }

  if (ev.sortie_id) {
    document.getElementById('ev-parcours-block').hidden = false;
    document.getElementById('ev-parcours-link').innerHTML =
      `<a href="sortie.html?id=${encodeURIComponent(ev.sortie_id)}" class="btn btn-ghost">Voir le parcours détaillé →</a>`;
  }

  const insc = ev.inscriptions || [];
  const inscWrap = document.getElementById('ev-inscrits-list');
  if (insc.length === 0) {
    inscWrap.innerHTML = '<p style="color:var(--parch-3); font-style:italic;">Soyez le premier à vous inscrire.</p>';
  } else {
    inscWrap.innerHTML = `
      <table class="palm-table" style="width:100%; font-family:var(--f-sans); font-size:13px;">
        <thead><tr style="border-bottom:1px solid var(--line);"><th style="text-align:left;padding:8px;">Nom</th><th style="text-align:left;padding:8px;">Catégorie</th><th style="text-align:left;padding:8px;">Distance</th></tr></thead>
        <tbody>${insc.map(i => `
          <tr style="border-bottom:1px solid var(--line-soft);">
            <td style="padding:8px;">${esc(i.prenom)} ${esc(i.nom?.[0] || '')}.</td>
            <td style="padding:8px;color:var(--parch-3);">${esc(i.categorie || '—')}</td>
            <td style="padding:8px;color:var(--parch-3);">${i.distance ? i.distance + ' km' : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  document.getElementById('ev-date-label').textContent = fmtDays(ev.date);
  document.getElementById('ev-date-big').textContent = fmtDate(ev.date) + (ev.heure ? ` · ${ev.heure}` : '');
  document.querySelector('#ev-info-lieu span:last-child').textContent = ev.lieu || ev.region || '—';
  document.querySelector('#ev-info-distance span:last-child').textContent = ev.distance_km ? `${ev.distance_km} km` : '—';
  document.querySelector('#ev-info-engagement span:last-child').textContent = ev.engagement_eur ? `${ev.engagement_eur} €` : 'Gratuit';
  document.getElementById('ev-inscrits-count').textContent = ev.max_inscrits ? `${ev.inscrits || 0}/${ev.max_inscrits}` : (ev.inscrits || 0);

  const btnReg = document.getElementById('btn-register');
  if (ev.statut === 'complet')      { btnReg.disabled = true; btnReg.textContent = 'Complet'; }
  else if (ev.statut === 'termine') { btnReg.disabled = true; btnReg.textContent = 'Terminé'; }
  else if (ev.statut === 'annule')  { btnReg.disabled = true; btnReg.textContent = 'Annulé'; }

  const modal = document.getElementById('ev-modal');
  const evError = document.getElementById('ev-form-error');
  const evSuccess = document.getElementById('ev-form-success');
  const evForm = document.getElementById('ev-form');
  const evSubmit = document.getElementById('ev-submit');

  btnReg.addEventListener('click', () => {
    const u = window.CCS_AUTH?.getUser();
    if (u) {
      document.getElementById('ev-prenom').value = u.prenom || '';
      document.getElementById('ev-nom').value    = u.nom || '';
      document.getElementById('ev-email').value  = u.email || '';
    }
    document.getElementById('ev-modal-title').textContent = ev.title;
    document.getElementById('ev-modal-sub').textContent = `${fmtDate(ev.date)}${ev.lieu ? ' · ' + ev.lieu : ''}`;
    evError.hidden = true; evSuccess.hidden = true; evForm.style.display = '';
    modal.hidden = false;
  });

  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => { modal.hidden = true; });
  });

  evForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    evError.hidden = true;
    const data = {
      prenom:    document.getElementById('ev-prenom').value.trim(),
      nom:       document.getElementById('ev-nom').value.trim(),
      email:     document.getElementById('ev-email').value.trim(),
      telephone: document.getElementById('ev-tel').value.trim() || undefined,
      categorie: document.getElementById('ev-cat').value || undefined,
      distance:  parseInt(document.getElementById('ev-dist').value) || undefined,
    };
    if (!data.prenom || !data.nom || !data.email) {
      evError.textContent = 'Prénom, nom et email sont requis'; evError.hidden = false; return;
    }
    evSubmit.textContent = 'Envoi…'; evSubmit.disabled = true;
    try {
      await window.CCS_DATA.inscrireEvenement(ev.id, data);
      evSuccess.textContent = 'Inscription confirmée ! Vous recevrez un email de confirmation.';
      evSuccess.hidden = false;
      evForm.style.display = 'none';
      setTimeout(() => { modal.hidden = true; location.reload(); }, 2500);
    } catch (err) {
      evError.textContent = err.message || "Erreur lors de l'inscription";
      evError.hidden = false;
      evSubmit.textContent = "Confirmer l'inscription"; evSubmit.disabled = false;
    }
  });
})();
