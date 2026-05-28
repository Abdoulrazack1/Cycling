/* ═════════════════════════════════════════════════════════════════
   pages/mon-espace.js — Dashboard membre (mon-espace.html)
   Consomme /api/my/dashboard et rend 3 listes : inscriptions, favoris,
   récemment vues.
   ═════════════════════════════════════════════════════════════════ */

(async function () {
  'use strict';

  // Attend CCS_AUTH
  await new Promise(r => {
    const tick = (n = 0) => {
      if (window.CCS_AUTH?.ready) return r();
      if (n > 50) return r();
      setTimeout(() => tick(n + 1), 80);
    };
    tick();
  });
  await window.CCS_AUTH?.ready?.();

  const user = window.CCS_AUTH?.getUser?.();
  if (!user) {
    location.href = '/login.html?redirect=' + encodeURIComponent('/mon-espace.html');
    return;
  }
  const API = window.CCS_CFG?.API || '/api';
  const token = window.CCS_AUTH?.getToken?.();

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderSortieCard(s, extraBadge = '') {
    const date = s.date ? new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    return `
      <a href="/sortie.html?id=${encodeURIComponent(s.id)}" class="me-card">
        ${extraBadge}
        <div class="me-card-chapter">${esc(s.chapter || 'Sortie')}</div>
        <div class="me-card-title">${esc(s.title || '')}</div>
        <div class="me-card-meta">
          ${s.distance_km ? `<span>${Math.round(s.distance_km)} km</span>` : ''}
          ${s.elevation_gain ? `<span>${s.elevation_gain} m D+</span>` : ''}
          <span>${date}</span>
        </div>
      </a>`;
  }

  function renderInscriptionRow(i) {
    const statutLabel = i.statut === 'inscrit' ? '<span class="me-tag me-tag-ok">Inscrit·e</span>'
                      : i.statut === 'liste-attente' ? '<span class="me-tag me-tag-wait">Liste d\'attente</span>'
                      : '<span class="me-tag">Annulé</span>';
    const date = i.date ? new Date(i.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—';
    return `
      <a href="/sortie.html?id=${encodeURIComponent(i.id)}" class="me-inscription-row">
        <div class="me-inscription-date">${date}</div>
        <div class="me-inscription-main">
          <div class="me-inscription-title">${esc(i.title || '')}</div>
          <div class="me-inscription-meta">${i.distance_km ? Math.round(i.distance_km) + ' km · ' : ''}${i.elevation_gain ? i.elevation_gain + ' m D+' : ''}</div>
        </div>
        <div class="me-inscription-right">${statutLabel}</div>
      </a>`;
  }

  // Empty state helper
  function emptyState(host, title, sub, ctaLabel, ctaHref) {
    host.innerHTML = `
      <div class="ccs-empty">
        <div class="ccs-empty-icon">—</div>
        <div class="ccs-empty-title">${esc(title)}</div>
        <div class="ccs-empty-sub">${esc(sub)}</div>
        ${ctaLabel ? `<a href="${ctaHref}" class="btn btn-brass btn-sm">${esc(ctaLabel)}</a>` : ''}
      </div>`;
  }

  try {
    const r = await fetch(API + '/my/dashboard', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (r.status === 401) {
      location.href = '/login.html?redirect=' + encodeURIComponent('/mon-espace.html');
      return;
    }
    const data = await r.json();

    // Compteurs
    document.getElementById('me-favs-count').textContent  = data.favorites?.length || 0;
    document.getElementById('me-ins-count').textContent   = data.inscriptions?.length || 0;
    document.getElementById('me-rec-count').textContent   = data.recent_views?.length || 0;
    document.getElementById('me-unread-count').textContent = data.unread_notifications || 0;

    // Inscriptions
    const insHost = document.getElementById('me-inscriptions');
    if (data.inscriptions?.length) {
      insHost.innerHTML = '<div class="me-inscriptions-list">' +
        data.inscriptions.map(renderInscriptionRow).join('') +
        '</div>';
    } else {
      emptyState(insHost,
        "Aucune inscription en cours",
        "Tu n'es inscrit·e à aucune sortie pour le moment. Va explorer le catalogue pour t'inscrire à la prochaine.",
        "Voir les sorties", "/sorties.html?statut=future");
    }

    // Favoris
    const favsHost = document.getElementById('me-favorites');
    if (data.favorites?.length) {
      favsHost.innerHTML = data.favorites.map(s => renderSortieCard(s,
        '<span class="me-card-badge">★ Favori</span>'
      )).join('');
    } else {
      emptyState(favsHost,
        "Aucun favori",
        "Marque tes sorties préférées avec l'étoile sur leur page détail pour les retrouver ici.",
        "Explorer", "/sorties.html");
    }

    // Recently viewed
    const recHost = document.getElementById('me-recent');
    if (data.recent_views?.length) {
      recHost.innerHTML = data.recent_views.map(s => renderSortieCard(s,
        s.view_count > 1 ? `<span class="me-card-badge">${s.view_count} vues</span>` : ''
      )).join('');
    } else {
      emptyState(recHost,
        "Aucune sortie consultée récemment",
        "Les sorties que tu consultes apparaîtront ici pour les retrouver facilement.",
        "Voir les sorties", "/sorties.html");
    }
  } catch (err) {
    document.querySelectorAll('.section-sm').forEach(s => {
      s.innerHTML = '<div class="ccs-empty"><div class="ccs-empty-sub">Erreur de chargement : ' + esc(err.message) + '</div></div>';
    });
  }
})();
