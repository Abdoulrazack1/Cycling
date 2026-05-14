/* ── Chargement dynamique des événements depuis l'API ── */
(async function loadEvenements() {
  await new Promise(resolve => {
    const check = (n = 0) => {
      if (window.CCS_DATA) return resolve();
      if (n < 50) setTimeout(() => check(n + 1), 80);
      else resolve();
    };
    check();
  });
  if (!window.CCS_DATA) return;

  const listEl = document.querySelector('.list-ornate');
  if (!listEl) return;

  const TYPE_LABELS = {
    cyclosportive: 'Cyclosportive', gravel: 'Gravel', criterium: 'Critérium',
    course: 'Course', rando: 'Randonnée', championnat: 'Championnat', autre: 'Événement'
  };

  function daysDiff(dateStr) {
    const d = Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
    if (d > 0) return `J−${d}`;
    if (d === 0) return "Aujourd'hui";
    return `il y a ${Math.abs(d)} j`;
  }

  function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderRow(ev) {
    const label = TYPE_LABELS[ev.type] || 'Événement';
    const jj = daysDiff(ev.date);
    const isoDate = new Date(ev.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const dayName = new Date(ev.date).toLocaleDateString('fr-FR', { weekday: 'long' });
    const isOpen = ev.statut === 'ouvert' && new Date(ev.date) > new Date();

    return `
      <a href="evenement.html?id=${encodeURIComponent(ev.id)}" class="list-ornate-row">
        <div class="list-ornate-date">${isoDate}<span class="list-ornate-date-small">${dayName}</span></div>
        <div>
          <div class="list-ornate-title">${ev.title_html || escHtml(ev.title)}</div>
          <div class="list-ornate-sub">${escHtml(ev.subtitle || '')}</div>
        </div>
        <div class="list-ornate-meta"><b>${escHtml(ev.lieu || '')}</b> · ${escHtml(ev.heure || '8 h 30')}<br><span>${escHtml(ev.region || '')}</span></div>
        <div class="list-ornate-dist">${ev.distance_km || '—'}<span class="unit">km</span></div>
        <div class="list-ornate-arrow">
          ${isOpen ? `<button type="button" class="btn btn-brass btn-sm" data-event-id="${ev.id}" data-register>S'inscrire</button>` : '<span style="color:var(--t-cream-3);font-size:11px;">' + (ev.statut || '') + '</span>'}
        </div>
      </a>`;
  }

  try {
    const evs = await window.CCS_DATA.listEvenements({ limit: 20 });
    if (!evs?.length) return;
    listEl.innerHTML = evs.map(renderRow).join('');

    listEl.querySelectorAll('[data-register]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openInscriptionModal(btn.dataset.eventId, evs);
      });
    });

    const metas = document.querySelectorAll('.page-head-meta-v');
    if (metas.length >= 1) metas[0].textContent = evs.length;
    const participants = evs.reduce((s, e) => s + (parseInt(e.inscrits) || 0), 0);
    if (metas.length >= 2) metas[1].textContent = participants.toLocaleString('fr-FR');
    const futurs = evs.filter(e => new Date(e.date) > new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (futurs.length && metas.length >= 4) metas[3].textContent = daysDiff(futurs[0].date);
  } catch (err) {
    console.warn('[CCS] événements dynamique :', err.message);
  }

  document.getElementById('btn-register-saloueloise')?.addEventListener('click', async () => {
    try {
      const evs = await window.CCS_DATA.listEvenements({ limit: 20 });
      const saloueloise = evs.find(e => /saloueloise/i.test(e.title || e.slug || ''));
      openInscriptionModal(saloueloise?.id || 1, evs);
    } catch {
      openInscriptionModal(1, []);
    }
  });
})();

/* ── Modal d'inscription événement ───────────────────── */
const evModal     = document.getElementById('ev-modal');
const evForm      = document.getElementById('ev-form');
const evTitle     = document.getElementById('ev-modal-title');
const evSub       = document.getElementById('ev-modal-sub');
const evError     = document.getElementById('ev-form-error');
const evSuccess   = document.getElementById('ev-form-success');
const evSubmit    = document.getElementById('ev-submit');
let currentEventId = null;

function openInscriptionModal(eventId, allEvents = []) {
  currentEventId = eventId;
  const ev = allEvents.find(e => String(e.id) === String(eventId)) || null;

  if (ev) {
    evTitle.innerHTML = ev.title_html || ev.title;
    evSub.textContent = `${new Date(ev.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · ${ev.lieu || ''}`;
  } else {
    evTitle.textContent = 'Inscription à un événement';
    evSub.textContent = '';
  }
  evError.hidden = true; evSuccess.hidden = true;
  evForm.style.display = '';
  evForm.reset();

  const u = window.CCS_AUTH?.getUser();
  if (u) {
    document.getElementById('ev-prenom').value = u.prenom || '';
    document.getElementById('ev-nom').value    = u.nom    || '';
    document.getElementById('ev-email').value  = u.email  || '';
  }

  evModal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('ev-prenom').focus(), 80);
}

function closeInscriptionModal() {
  evModal.hidden = true;
  document.body.style.overflow = '';
}

evModal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeInscriptionModal));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !evModal.hidden) closeInscriptionModal(); });

evForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  evError.hidden = true; evSuccess.hidden = true;

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
    await window.CCS_DATA.inscrireEvenement(currentEventId, data);
    evSuccess.textContent = 'Inscription confirmée ! Vous recevrez un email de confirmation.';
    evSuccess.hidden = false;
    evForm.style.display = 'none';
    setTimeout(closeInscriptionModal, 3000);
  } catch (err) {
    evError.textContent = err.message || 'Erreur lors de l\'inscription';
    evError.hidden = false;
    evSubmit.textContent = "Confirmer l'inscription"; evSubmit.disabled = false;
  }
});
