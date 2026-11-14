// Transactions desktop board: differences from the app code (viewTransactions), fixed in the copy that goes to Figma.
module.exports = {
  dom: `document.querySelectorAll('.day .up').forEach((e) => e.classList.remove('up'));            // day net is plain ink with a sign, not green
    document.querySelectorAll('section.card > div:last-child > button.chip').forEach((b) => {       // "See upcoming" is a text button, not a chip
      if (!/See upcoming/.test(b.textContent)) return; b.className = 'lnk'; b.textContent = 'See upcoming transactions (3)'; });`
};
