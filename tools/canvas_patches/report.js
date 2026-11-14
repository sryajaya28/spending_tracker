// Report phone board: differences from the app code (viewTransactions), fixed in the copy that goes to Figma.
module.exports = {
  data(v) { v.rest.forEach((d) => { d.col = 'inherit'; }); },   // day net is plain ink with a sign, not green
  dom: `document.querySelectorAll('.ph').forEach((p) => { const on = p.querySelector('.seg a.on'); if (!on || on.textContent.trim() !== 'Transactions') return;
    const b = document.createElement('button'); b.textContent = 'See upcoming transactions (3)';
    b.style.cssText = 'min-height:44px;width:100%;text-align:center;font-size:13px;font-weight:600;color:var(--accent)';
    p.querySelector('section.card').appendChild(b); });`
};
