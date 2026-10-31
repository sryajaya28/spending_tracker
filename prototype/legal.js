'use strict';
/* Fills the contact line on the legal pages from config.js (CONTACT_EMAIL). */
(function () {
  var email = (window.STIVER || {}).CONTACT_EMAIL;
  if (!email) return;
  document.querySelectorAll('[data-contact]').forEach(function (el) {
    var a = document.createElement('a'); a.href = 'mailto:' + email; a.textContent = email; el.textContent = ''; el.appendChild(a);
  });
})();
