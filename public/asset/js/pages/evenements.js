/* ═════════════════════════════════════════════════════════════════
   pages/evenements.js — Liste publique des événements
   ─────────────────────────────────────────────────────────────────
   Fetch CCS_DATA.evenements() → filtres (type, statut), tri par date,
   pagination "Charger plus", lien vers /evenement.html?id=N.
   ═════════════════════════════════════════════════════════════════ */

(async function loadEvenements() {
  // Skeleton immédiat (avant l'attente CCS_DATA) — évite le trou blanc
  const earlyList = document.querySelector('.list-ornate');
  if (earlyList && !earlyList.innerHTML.trim()) {
    earlyList.innerHTML = Array(5).fill('<div class="skeleton skeleton-row" style="margin:8px 0;"></div>').join('');
  }
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
    if (!evs?.length) {
      listEl.innerHTML = `
        <div class="ccs-empty" style="padding:64px 24px;">
          <div class="ccs-empty-icon">—</div>
          <div class="ccs-empty-title">Pas d'événement à venir</div>
          <div class="ccs-empty-sub">Les courses, cyclos et événements seront publiés ici dès leur annonce.</div>
          <a href="sorties.html" class="btn btn-brass btn-sm">Voir les sorties</a>
        </div>`;
      const metas = document.querySelectorAll('.page-head-meta-v');
      metas.forEach(m => { m.textContent = '0'; });
      return;
    }
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

    // ─── Vue calendrier ──────────────────────────────────────
    initCalendarView(evs);
  } catch (err) {
    console.warn('[CCS] événements dynamique :', err.message);
  }

  function initCalendarView(events) {
    const toggle  = document.getElementById('ev-view-toggle');
    const listC   = document.querySelector('.list-ornate');
    const calC    = document.getElementById('ev-calendar');
    const prevBtn = document.getElementById('ev-cal-prev');
    const nextBtn = document.getElementById('ev-cal-next');
    const grid    = document.getElementById('ev-cal-grid');
    const label   = document.getElementById('ev-cal-month-label');
    if (!toggle || !grid) return;

    // Démarre sur le premier mois ayant un événement futur, sinon mois courant
    const nextEvent = events.filter(e => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)))
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    const seed = nextEvent ? new Date(nextEvent.date) : new Date();
    let curYear = seed.getFullYear();
    let curMonth = seed.getMonth(); // 0–11

    const MONTH_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

    function renderCalendar() {
      label.textContent = `${MONTH_FR[curMonth]} ${curYear}`;

      // Calcul du premier jour (lundi = 0) et nb de jours du mois
      const firstDay = new Date(curYear, curMonth, 1);
      const lastDay  = new Date(curYear, curMonth + 1, 0);
      const startWeekday = (firstDay.getDay() + 6) % 7; // 0=Lun ... 6=Dim
      const daysInMonth = lastDay.getDate();

      // Map des événements de ce mois indexés par jour
      const evByDay = {};
      for (const ev of events) {
        const d = new Date(ev.date);
        if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
          const day = d.getDate();
          (evByDay[day] = evByDay[day] || []).push(ev);
        }
      }

      const cells = [];
      const todayKey = `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`;

      // Cellules vides du début (mois précédent)
      for (let i = 0; i < startWeekday; i++) {
        cells.push(`<div class="ev-cal-cell ev-cal-empty" style="min-height:84px; border-top:1px solid var(--line); border-right:1px solid var(--line); background:rgba(0,0,0,.18);"></div>`);
      }
      // Jours du mois
      for (let d = 1; d <= daysInMonth; d++) {
        const dayKey = `${curYear}-${curMonth}-${d}`;
        const isToday = dayKey === todayKey;
        const evs = evByDay[d] || [];
        const dayLabel = `<div style="font-family:var(--f-disp); font-size:14px; ${isToday ? 'color:var(--brass);' : 'color:var(--t-cream);'} margin-bottom:6px;">${d}${isToday ? '<span style="font-size:9px; letter-spacing:.12em; margin-left:6px;">AUJ.</span>' : ''}</div>`;
        const evsHtml = evs.map(ev => {
          const isOpen = ev.statut === 'ouvert';
          const color = isOpen ? 'var(--brass)' : 'var(--parch-3)';
          return `<a href="evenement.html?id=${encodeURIComponent(ev.id)}" class="ev-cal-chip" style="display:block; padding:4px 6px; margin-bottom:3px; background:rgba(176,142,74,.10); border-left:2px solid ${color}; color:var(--t-cream); font-family:var(--f-sans); font-size:10px; line-height:1.25; text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escHtml(ev.title)} · ${escHtml(TYPE_LABELS[ev.type] || '')}">
            <b>${escHtml((ev.heure || '').slice(0,5) || '')}</b> ${escHtml(ev.title || '')}
          </a>`;
        }).join('');
        cells.push(`<div class="ev-cal-cell" style="min-height:84px; padding:6px 8px; border-top:1px solid var(--line); border-right:1px solid var(--line); ${isToday ? 'background:rgba(176,142,74,.06);' : ''}">${dayLabel}${evsHtml}</div>`);
      }
      // Compléter la dernière semaine
      const totalCells = startWeekday + daysInMonth;
      const trailing = (7 - (totalCells % 7)) % 7;
      for (let i = 0; i < trailing; i++) {
        cells.push(`<div class="ev-cal-cell ev-cal-empty" style="min-height:84px; border-top:1px solid var(--line); border-right:1px solid var(--line); background:rgba(0,0,0,.18);"></div>`);
      }
      grid.innerHTML = cells.join('');
      // Retire la bordure droite des cellules en fin de ligne
      grid.querySelectorAll('.ev-cal-cell:nth-child(7n)').forEach(el => el.style.borderRight = '0');
    }

    toggle.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        toggle.querySelectorAll('.view-toggle-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--t-cream-2)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--brass)';
        btn.style.color = 'var(--ink)';
        if (btn.dataset.view === 'calendar') {
          if (listC) listC.style.display = 'none';
          if (calC)  calC.hidden = false;
          renderCalendar();
        } else {
          if (listC) listC.style.display = '';
          if (calC)  calC.hidden = true;
        }
      });
    });

    prevBtn?.addEventListener('click', () => {
      curMonth--;
      if (curMonth < 0) { curMonth = 11; curYear--; }
      renderCalendar();
    });
    nextBtn?.addEventListener('click', () => {
      curMonth++;
      if (curMonth > 11) { curMonth = 0; curYear++; }
      renderCalendar();
    });
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
})();
