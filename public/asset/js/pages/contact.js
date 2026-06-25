/* ═════════════════════════════════════════════════════════════════
   pages/contact.js — Formulaire de contact public
   Soumet POST /api/contact avec les champs prenom/nom/email/sujet/message.
   ═════════════════════════════════════════════════════════════════ */

(() => {

  async function handleContactSubmit(e) {
    const btn = e.target.querySelector('[type="submit"]');
    const data = {
      prenom:    document.getElementById('c-first')?.value?.trim(),
      nom:       document.getElementById('c-last')?.value?.trim(),
      email:     document.getElementById('c-email')?.value?.trim(),
      telephone: document.getElementById('c-phone')?.value?.trim() || undefined,
      sujet:     document.getElementById('c-subject')?.value,
      message:   document.getElementById('c-msg')?.value?.trim(),
      // Honeypot — toujours envoyé (vide pour un humain, rempli pour un bot)
      website:   document.getElementById('c-website')?.value || '',
    };
    if (!data.prenom || !data.nom || !data.email || !data.sujet || !data.message) {
      window.toast?.('Remplissez tous les champs obligatoires', 'warning'); return;
    }
    const origText = btn.textContent;
    btn.textContent = 'Envoi…'; btn.disabled = true;
    try {
      await window.CCS_DATA.sendContact(data);
      window.toast?.('Message envoyé — nous vous répondrons sous 48h', 'success');
      e.target.reset();
    } catch (err) {
      window.toast?.(err.message || 'Erreur envoi', 'error');
    } finally {
      btn.textContent = origText; btn.disabled = false;
    }
  }

  const form = document.querySelector('form[id="contact-form"], form.contact-form, main form');
  if (form) form.addEventListener('submit', handleContactSubmit);

  (async function prefillFromUser() {
    const waitFor = (cond, max = 30) => new Promise(r => {
      const tick = (n) => cond() ? r(true) : (n >= max ? r(false) : setTimeout(() => tick(n+1), 60));
      tick(0);
    });
    await waitFor(() => !!window.CCS_AUTH);
    await window.CCS_AUTH.ready();
    const u = window.CCS_AUTH.getUser();
    if (!u) return;
    const $ = (id) => document.getElementById(id);
    if ($('c-first') && !$('c-first').value) $('c-first').value = u.prenom || '';
    if ($('c-last')  && !$('c-last').value)  $('c-last').value  = u.nom    || '';
    if ($('c-email') && !$('c-email').value) $('c-email').value = u.email  || '';
  })();
})();
