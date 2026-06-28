/* ═════════════════════════════════════════════════════════════════
   pages/membre.js — Page /membre.html?id=N (fiche publique d'un membre)
   Affiche profil + équipements + palmarès lié au membre demandé.
   ═════════════════════════════════════════════════════════════════ */

(async () => {

  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  if (!id) {
    document.getElementById('m-name').textContent = 'Membre non spécifié';
    return;
  }

  const wait = () => new Promise(r => {
    const tick = () => window.CCS_DATA ? r() : setTimeout(tick, 50);
    tick();
  });
  await wait();

  let m;
  try {
    m = await window.CCS_DATA.getMembre(id);
  } catch (err) {
    document.getElementById('m-name').textContent = 'Sociétaire introuvable';
    document.getElementById('m-bio').textContent = err.message || '';
    return;
  }

  const ROLE_LABELS = { admin: 'Bureau', moderateur: 'Modérateur', membre: 'Sociétaire' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
  const initials = (m.prenom?.[0] || '?').toUpperCase();
  const fullname = `${m.prenom || ''} ${m.nom || ''}`.trim();
  const role = m.role || 'membre';

  document.title = `${fullname} · C.C. Salouel`;
  document.getElementById('bc-title').textContent = fullname;
  document.getElementById('m-role').textContent = (ROLE_LABELS[role] || role).toUpperCase();
  document.getElementById('m-name').innerHTML = esc(m.prenom) + ' <span class="it">' + esc(m.nom) + '</span>';
  document.getElementById('m-bio').textContent = m.bio || '';

  document.getElementById('m-avatar').textContent = initials;
  document.getElementById('m-num').textContent = '№ ' + String(m.numero || '—').padStart(3, '0');
  document.getElementById('m-fullname').textContent = fullname;
  if (m.username) {
    document.getElementById('m-username-wrap').hidden = false;
    document.getElementById('m-username').textContent = m.username;
  }
  if (m.licence_ffc)    { const el = document.getElementById('m-info-licence');  el.hidden = false; el.querySelector('span:last-child').textContent = m.licence_ffc; }
  if (m.annee_adhesion) { const el = document.getElementById('m-info-adhesion'); el.hidden = false; el.querySelector('span:last-child').textContent = m.annee_adhesion; }
  if (m.ftp_w)          { const el = document.getElementById('m-info-ftp');      el.hidden = false; el.querySelector('span:last-child').textContent = m.ftp_w + ' W'; }
  document.getElementById('m-info-role').querySelector('span:last-child').textContent = ROLE_LABELS[role] || role;

  const year = new Date().getFullYear();
  document.getElementById('m-year').textContent = year;
  const stats = [];
  if (m.km_saison)        stats.push({ l: 'Kilomètres', v: Number(m.km_saison).toLocaleString('fr-FR') });
  if (m.elevation_saison) stats.push({ l: 'Dénivelé +', v: Number(m.elevation_saison).toLocaleString('fr-FR') + ' m' });
  if (m.ftp_w)            stats.push({ l: 'FTP',        v: m.ftp_w + ' W' });
  if (stats.length === 0) stats.push({ l: 'Saison',     v: 'Pas de données' });
  document.getElementById('m-stats').innerHTML = stats.map(s =>
    `<div class="page-head-meta-item"><div class="page-head-meta-l">${s.l}</div><div class="page-head-meta-v">${s.v}</div></div>`
  ).join('');

  if (m.equipment?.length) {
    document.getElementById('m-equipment-block').hidden = false;
    document.getElementById('m-equipment-list').innerHTML = m.equipment.map(e => `
      <div style="border:1px solid var(--line); padding:18px 24px; margin-bottom:12px; font-family:var(--f-sans); font-size:13px;">
        <div style="font-family:var(--f-disp); font-size:18px; color:var(--brass); margin-bottom:6px;">${esc(e.titre)}</div>
        ${e.description ? `<div style="color:var(--parch-2); line-height:1.6;">${esc(e.description)}</div>` : ''}
      </div>
    `).join('');
  }

  try {
    const palm = await window.CCS_DATA.palmares({ membre_id: id });
    if (Array.isArray(palm) && palm.length) {
      document.getElementById('m-palmares-block').hidden = false;
      const items = palm.filter(p => (p.coureur || '').toLowerCase().includes((m.prenom || '').toLowerCase()) || p.user_id === m.id);
      document.getElementById('m-palmares-list').innerHTML = (items.length ? items : palm).slice(0, 10).map(p => `
        <div class="palm-item">
          <div class="palm-medal ${p.medaille || ''}">${p.rang || '—'}</div>
          <div>
            <div class="palm-t">${esc(p.titre || p.evenement)}</div>
            <div class="palm-s">${esc(p.evenement || '')}${p.categorie ? ' · ' + esc(p.categorie) : ''}</div>
          </div>
          <div class="palm-date">${p.annee || ''}</div>
          <div class="palm-cat">${esc(p.equipe || '')}</div>
        </div>
      `).join('');
    }
  } catch {}
})();
