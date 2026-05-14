(async function loadMembres() {
  await new Promise(resolve => {
    const check = (n = 0) => {
      if (window.CCS_DATA) return resolve();
      if (n < 50) setTimeout(() => check(n + 1), 80);
      else resolve();
    };
    check();
  });
  if (!window.CCS_DATA) return;

  const grid = document.getElementById('members-grid');
  const ROLE_LABELS = { admin: 'Bureau', moderateur: 'Modérateur', membre: 'Membre' };

  function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function renderCard(m) {
    const initials = (m.prenom?.[0] || '?').toUpperCase();
    const role = m.role || 'membre';
    const licence = m.licence_ffc ? `<div><b>Licence FFC</b><br>${escHtml(m.licence_ffc)}</div>` : '';
    const adhesion = m.annee_adhesion ? `<div><b>Adhérent depuis</b><br>${m.annee_adhesion}</div>` : '';
    const km = m.km_saison ? `<div><b>Km saison</b><br>${Number(m.km_saison).toLocaleString('fr-FR')} km</div>` : '';
    const metaContent = [licence, adhesion, km].filter(Boolean).join('');
    return `
      <a href="membre.html?id=${m.id}" class="member-card" data-role="${role}" style="text-decoration:none; color:inherit; display:block;">
        <div class="member-avatar">${initials}</div>
        <div class="member-num">№ ${String(m.numero || '—').padStart(3, '0')}</div>
        <div class="member-name">${escHtml(m.prenom)} <span class="it">${escHtml(m.nom)}</span></div>
        <span class="member-role ${role}">${ROLE_LABELS[role] || role}</span>
        ${metaContent ? `<div class="member-meta">${metaContent}</div>` : ''}
      </a>`;
  }

  let allMembres = [];
  let activeRole = 'all';

  function renderGrid() {
    let filtered = allMembres;
    if (activeRole !== 'all') {
      filtered = allMembres.filter(m => (m.role || 'membre') === activeRole);
    }
    if (!filtered.length) {
      grid.innerHTML = '<div class="members-empty" style="grid-column:1/-1;">Aucun sociétaire dans cette catégorie.</div>';
      return;
    }
    grid.innerHTML = filtered.map(renderCard).join('');
  }

  try {
    const membres = await window.CCS_DATA.membres();
    if (!membres?.length) {
      grid.innerHTML = '<div class="members-empty" style="grid-column:1/-1;">Liste des sociétaires non disponible — connexion à la base nécessaire.</div>';
      return;
    }
    allMembres = membres.slice().sort((a, b) => (a.numero || 999) - (b.numero || 999));

    document.querySelectorAll('.filter-chip[data-role]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeRole = btn.dataset.role;
        renderGrid();
      });
    });

    renderGrid();

    const bureau = allMembres.filter(m => m.role === 'admin' || m.role === 'moderateur').length;
    const ffc    = allMembres.filter(m => m.licence_ffc).length;
    const year   = new Date().getFullYear();
    const nouveaux = allMembres.filter(m => m.annee_adhesion === year).length;

    document.getElementById('stat-total').textContent  = allMembres.length;
    document.getElementById('stat-bureau').textContent = bureau;
    document.getElementById('stat-ffc').textContent    = ffc;
    document.getElementById('stat-new').textContent    = nouveaux;
  } catch (err) {
    console.warn('[CCS] membres :', err.message);
    grid.innerHTML = '<div class="members-empty" style="grid-column:1/-1;">Impossible de charger la liste des sociétaires.</div>';
  }
})();
