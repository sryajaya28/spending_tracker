/* Design export: renders every Stiver screen, dialog and component with sample data and writes them as SVG (editable layers
   when imported into Figma) plus PNG previews, and the design tokens (colours, type, radius, spacing, shadows) as JSON.

   Usage (from the repo root, with the dev server running on port 5180):
     python3 tools/dev_server.py 5180 &
     node tools/design/export.js            # everything
     node tools/design/export.js overview    # only names containing "overview"

   Output: design/screens/<mode>/<name>.svg|.png, design/components/<group>/<name>[-dark].svg|.png, design/tokens/stiver.tokens.json.
   Uses dom-to-svg (tools/design/vendor/dom-to-svg.js, MIT) inside a headless Chromium; the app is loaded with the e2e
   fake Supabase and the built-in sample data, so nothing touches real data. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'design'), URL = 'http://127.0.0.1:5180/';
const FAKE = fs.readFileSync(path.join(ROOT, 'tests/e2e/fake_supabase.js'), 'utf8'), D2S = fs.readFileSync(path.join(__dirname, 'vendor/dom-to-svg.js'), 'utf8');
const only = process.argv[2] || '';

/* ---------- screens: [name, kind ('page' | 'dialog' | 'auth'), setup run in the page] ---------- */
const PAGE = (hash, extra = '') => `state.ui.openDays = new Set(); ${extra} location.hash = '${hash}'; render(); window.scrollTo(0, 0);`;
// popovers are opened in a second step, after the page has its final size (a resize closes them, like on a phone)
const LIST_AFTER = (name) => `const s = document.querySelector('#dlg select[name=${name}]'); const r = s.getBoundingClientRect(); s.parentElement.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));`;
const DATE_AFTER = `document.querySelector('#dlg input[name=date]').closest('label').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));`;
// two future-dated entries in the current period, so "See upcoming transactions" and its pop-up have something to show
const UPCOMING = `if (!D().transactions.some((t) => t.id === 'up-1')) { const w = D().wallets[0], c = D().categories.find((x) => x.type === 'expense'); [['up-1', 'Netflix', 186000, 3], ['up-2', 'Rent', 4500000, 6]].forEach(([id, note, a, o]) => { const d = new Date(); d.setDate(d.getDate() + o); D().transactions.push({ id, type: 'expense', amount_minor: a, currency: w.currency, wallet_id: w.id, category_id: c.id, note, occurred_at: isoDate(d) }); }); } state.ui.month = periodKeyOf(todayIso());`;
const SCREENS = [
  ['landing', 'auth', `state.auth.view = 'landing'; render();`],
  ['sign-in', 'auth', `state.auth.view = 'signin'; render();`],
  ['sign-up', 'auth', `state.auth.view = 'signup'; render();`],
  ['overview', 'page', PAGE('#/overview')],
  // a new account: the getting-started Overview (the real, empty account, not the sample)
  ['overview-first-run', 'page', `setDemo(false).then(() => { location.hash = '#/overview'; render(); window.scrollTo(0, 0); })`],
  ['transactions', 'page', PAGE('#/transactions', `Object.assign(state.ui, { q: '', cat: '', occ: '', wallet: '' });`)],
  ['transactions-expanded', 'page', PAGE('#/transactions', `Object.assign(state.ui, { q: '', cat: '', occ: '', wallet: '' });`) + ` setTimeout(() => document.querySelector('[data-act=days-all]')?.click(), 0);`],
  ['transactions-all-periods', 'page', PAGE('#/transactions', `Object.assign(state.ui, { q: '', cat: '', occ: '', wallet: '', allPeriods: true });`) + ` setTimeout(() => document.querySelector('[data-act=days-all]')?.click(), 0);`],
  ['transactions-filtered', 'page', PAGE('#/transactions', `Object.assign(state.ui, { q: '', occ: '', wallet: '', cat: D().categories.find((c) => c.name === 'Dining').id });`)],
  ['transactions-loan-account', 'page', PAGE('#/transactions', `const l = D().loans.find((x) => x.name === 'Credit card'); Object.assign(state.ui, { q: '', cat: '', occ: '', wallet: 'l:' + l.id, month: periodKeyOf(l.payments.filter((p) => p.date <= todayIso()).map((p) => p.date).sort().pop()) });`) + ` setTimeout(() => document.querySelector('[data-act=days-all]')?.click(), 0);`],
  ['budgets', 'page', PAGE('#/budgets', `state.ui.month = currentPeriod();`)],
  ['portfolio-savings', 'page', PAGE('#/portfolio', `state.ui.pfTab = 'savings';`)],
  ['portfolio-investment', 'page', PAGE('#/portfolio', `state.ui.pfTab = 'investment';`)],
  ['portfolio-lent', 'page', PAGE('#/portfolio', `state.ui.pfTab = 'lent';`)],
  ['portfolio-loan', 'page', PAGE('#/portfolio', `state.ui.pfTab = 'loan';`)],
  ['asset-history', 'page', `location.hash = '#/portfolio/' + D().holdings.find((h) => h.symbol === 'NVDA').id; render(); window.scrollTo(0, 0);`],
  ['settings', 'page', PAGE('#/settings')],
  ['dialog-add-expense', 'dialog', `txnDialog(null, 'expense');`],
  ['dialog-add-income', 'dialog', `txnDialog(null, 'income');`],
  ['dialog-edit-transaction', 'dialog', `txnDialog(D().transactions.find((t) => t.type === 'expense' && t.occurred_at <= todayIso()));`],
  ['dialog-transfer', 'dialog', `transferDialog();`],
  ['dialog-invest', 'dialog', `holdingDialog(null, null, { invest: true });`],
  ['dialog-add-asset', 'dialog', `holdingDialog(null, D().investments[0].id);`],
  ['dialog-add-cash', 'dialog', `holdingDialog(null, D().investments[0].id, { pickType: 'cash' });`],
  ['dialog-asset', 'dialog', `holdingDialog(D().holdings.find((h) => h.symbol === 'NVDA'));`],
  ['dialog-buy', 'dialog', `tradeDialog(D().holdings.find((h) => h.symbol === 'NVDA'), 'buy');`],
  ['dialog-average-price', 'dialog', `costDialog(D().holdings.find((h) => h.symbol === 'NVDA'));`],
  ['dialog-budget', 'dialog', `budgetDialog();`],
  ['dialog-occasion', 'dialog', `occasionDialog();`],
  ['dialog-occasion-archived', 'dialog', `D().occasions.push({ id: uid(), name: 'Anniversary Dinner', amount_minor: null, currency: cur(), start: '2026-04-14', end: '2026-04-14', archived: true }); archivedOccasionsDialog();`],
  ['dialog-occasion-history', 'dialog', `D().occasions.push({ id: uid(), name: 'Lombok Trip', amount_minor: 4000000, currency: cur(), start: '2026-03-10', end: '2026-03-12', archived: false }, { id: uid(), name: 'Anniversary', amount_minor: null, currency: cur(), start: '', end: '', archived: true }); occasionHistoryDialog();`],
  ['dialog-budget-new-category', 'dialog', `budgetDialog(); const s = document.querySelector('#dlg select[name=category]'); s.value = '__new'; s.dispatchEvent(new Event('change', { bubbles: true }));`],
  ['dialog-occasion-budget', 'dialog', `D().occasions.push({ id: uid(), name: 'Wedding', amount_minor: null, currency: cur(), start: '', end: '', archived: false }); occasionDialog(null, true);`],
  ['dialog-account', 'dialog', `walletDialog();`],
  ['dialog-category', 'dialog', `catDialog();`],
  ['dialog-loan-payment', 'dialog', `paymentDialog(D().loans[0], 'loan');`],
  ['transactions-upcoming', 'page', PAGE('#/transactions', `Object.assign(state.ui, { q: '', cat: '', occ: '', wallet: '' }); ${UPCOMING}`)],
  ['dialog-upcoming', 'dialog', `${UPCOMING} Object.assign(state.ui, { q: '', cat: '', occ: '', wallet: '' }); upcomingDialog();`],
  ['dialog-lent-history', 'dialog', `loanHistoryDialog(D().lent[0], 'lent');`],
  ['dialog-recurring-manage', 'dialog', `ruleDialog(D().recurring[0]);`],
  ['dialog-support', 'dialog', `supportDialog();`],
  ['dialog-install-ios', 'dialog', `installDialog();`],
  ['dialog-trend-detail', 'dialog', `trendDialog(lastMonths(6)[4]);`],
  ['dialog-spending-breakdown', 'dialog', `breakdownDialog();`],
];
const DESKTOP_PAGES = new Set(['landing', 'sign-in', 'overview', 'transactions-expanded', 'budgets', 'portfolio-investment', 'portfolio-loan', 'settings']);

/* ---------- components, grouped like a design system: { group, name, setup, sel, width, ua, demo } ----------
   Each one is captured on its own (light and dark) into design/components/<group>/<name>[-dark].svg|png. */
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const TX = PAGE('#/transactions', `Object.assign(state.ui, { q: '', cat: '', occ: '', wallet: '' });`);
const TX_DINING = PAGE('#/transactions', `Object.assign(state.ui, { q: '', occ: '', wallet: '', cat: D().categories.find((c) => c.name === 'Dining').id });`);
// a type specimen built from the app's own styles, so text styles can be picked up as Figma text styles
const TYPE = `location.hash = '#/overview'; render(); const box = document.createElement('section'); box.className = 'card'; box.id = 'type-specimen';
  box.innerHTML = [['Page title · 24 / 700', 'font-size:24px;font-weight:700;letter-spacing:-.02em'], ['Hero amount · 38 / 700', 'font-size:38px;font-weight:700;letter-spacing:-.03em'], ['Big number · 30 / 700', 'font-size:30px;font-weight:700'], ['Dialog title · 20 / 700', 'font-size:20px;font-weight:700'], ['Card title · 16 / 500', 'font-size:16px;font-weight:500;letter-spacing:.04em'], ['Body · 15 / 400', 'font-size:15px'], ['Body strong · 15 / 600', 'font-size:15px;font-weight:600'], ['Small · 13 / 400 (muted)', 'font-size:13px;color:var(--muted)'], ['Caption · 12 / 400 (muted)', 'font-size:12px;color:var(--muted)'], ['OVERLINE · 11 / 600', 'font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--muted)'], ['Link / text button · 14 / 600', 'font-size:14px;font-weight:600;color:var(--brand)']]
    .map(([t, st]) => '<div style="padding:8px 0;border-bottom:1px solid var(--line);' + st + '">' + t + '</div>').join('');
  setTimeout(() => document.querySelector('.grid').prepend(box), 150);`;
const COMPONENTS = [
  // buttons
  { group: 'buttons', name: 'primary', setup: PAGE('#/budgets'), sel: '.card .btn:not(.secondary):not(.danger)' },
  { group: 'buttons', name: 'secondary', setup: PAGE('#/portfolio', `state.ui.pfTab = 'loan';`), sel: '.card .btn.secondary' },
  { group: 'buttons', name: 'danger', setup: `txnDialog(D().transactions.find((t) => t.type === 'expense' && t.occurred_at <= todayIso()));`, sel: '#dlg .btn.danger' },
  { group: 'buttons', name: 'dialog-actions', setup: `paymentDialog(D().loans[0], 'loan');`, sel: '#dlg .actions' },
  { group: 'buttons', name: 'chip', setup: PAGE('#/overview'), sel: '.card-head .chip' },
  { group: 'buttons', name: 'hero-actions', setup: PAGE('#/overview'), sel: '.hero-actions' },
  { group: 'buttons', name: 'icon-button', setup: PAGE('#/overview'), sel: '.support-btn' },
  { group: 'buttons', name: 'text-link', setup: TX, sel: '.day-tools' },
  { group: 'buttons', name: 'install-cta', setup: PAGE('#/overview'), sel: '.install-cta', ua: IPHONE },
  // text
  { group: 'text', name: 'type-scale', setup: TYPE, sel: '#type-specimen' },
  { group: 'text', name: 'badges', setup: `location.hash = '#/overview'; render(); const b = document.createElement('section'); b.className = 'card'; b.id = 'badge-specimen'; b.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap'; b.innerHTML = '<span class="badge ok">On track</span><span class="badge warning">Almost there</span><span class="badge exceeded">Over budget</span><span class="badge">Upcoming</span><span class="badge ai">AI</span><span class="badge">Personal loan</span>'; setTimeout(() => document.querySelector('.grid').prepend(b), 150);`, sel: '#badge-specimen' },
  // banners and notices
  { group: 'banners', name: 'sample-data', setup: PAGE('#/overview'), sel: '.demo-bar' },
  { group: 'banners', name: 'sample-promo', setup: PAGE('#/overview'), sel: '.sample-promo', demo: false },
  { group: 'banners', name: 'hint', setup: `paymentDialog(D().loans[0], 'loan');`, sel: '#dlg .hint' },
  // graphs
  { group: 'graphs', name: 'money-flow-line', setup: PAGE('#/overview'), sel: '#flow' },
  { group: 'graphs', name: 'spending-donut', setup: PAGE('#/overview'), sel: '.donut', up: 'section' },
  { group: 'graphs', name: 'category-trend-bars', setup: PAGE('#/overview'), sel: '#trend-chart' },
  { group: 'graphs', name: 'portfolio-value', setup: PAGE('#/portfolio', `state.ui.pfTab = 'savings';`), sel: '#pf' },
  { group: 'graphs', name: 'progress-bar', setup: PAGE('#/budgets'), sel: '.brow .bar' },
  // pop-ups
  { group: 'popups', name: 'dialog', setup: `paymentDialog(D().loans[0], 'loan');`, sel: '#dlg' },
  { group: 'popups', name: 'toast', setup: `location.hash = '#/overview'; render(); toast('Saved');`, sel: '#toast' },
  { group: 'popups', name: 'tooltip', setup: `location.hash = '#/overview'; render(); setTimeout(() => document.querySelector('.hero .info-btn').click(), 50);`, sel: '.info-wrap' },
  // form fields
  { group: 'form-fields', name: 'text-field', setup: `txnDialog(null, 'expense');`, sel: '#dlg textarea[name=note]', up: 'label' },
  { group: 'form-fields', name: 'amount-field', setup: `txnDialog(null, 'expense');`, sel: '#dlg input[name=amount]', up: 'label' },
  { group: 'form-fields', name: 'icon-picker', setup: `catDialog(D().categories[0]); document.querySelector('#dlg .icon-picks').classList.add('open');`, sel: '#dlg .icon-picks' },
  { group: 'form-fields', name: 'quick-add-category', setup: `txnDialog(null, 'expense'); const s = document.querySelector('#dlg select[name=category]'); s.value = '__new'; s.dispatchEvent(new Event('change', { bubbles: true }));`, sel: '#dlg .quick-cat' },
  { group: 'form-fields', name: 'select-field', setup: `txnDialog(null, 'expense');`, sel: '#dlg select[name=wallet]', up: 'label' },
  { group: 'form-fields', name: 'date-field', setup: `txnDialog(null, 'expense');`, sel: '#dlg input[name=date]', up: 'label' },
  { group: 'form-fields', name: 'segmented-control', setup: `txnDialog(null, 'expense');`, sel: '#dlg .seg' },
  { group: 'form-fields', name: 'switch', setup: PAGE('#/settings'), sel: '.switch' },
  { group: 'form-fields', name: 'image-attach', setup: `supportDialog();`, sel: '#shots' },
  { group: 'form-fields', name: 'message-with-counter', setup: `supportDialog();`, sel: '#dlg textarea[name=message]', up: 'label' },
  // date picker and dropdowns
  { group: 'date-picker', name: 'calendar', setup: `txnDialog(null, 'expense');`, after: DATE_AFTER, sel: '.dp-pop' },
  { group: 'dropdown', name: 'closed', setup: `txnDialog(null, 'expense');`, sel: '#dlg select[name=category]' },
  { group: 'dropdown', name: 'list-grouped', setup: `txnDialog(null, 'expense');`, after: LIST_AFTER('wallet'), sel: '.cs-pop' },
  { group: 'dropdown', name: 'list-with-search', setup: `txnDialog(null, 'expense');`, after: LIST_AFTER('category'), sel: '.cs-pop' },
  // filters
  { group: 'filters', name: 'filter-bar', setup: TX, sel: '.filters' },
  { group: 'filters', name: 'filter-bar-active', setup: TX_DINING, sel: '.filters' },
  { group: 'filters', name: 'search-and-period', setup: TX, sel: '.txn-top' },
  { group: 'filters', name: 'pill', setup: TX, sel: '.filters select' },
  { group: 'filters', name: 'pill-active', setup: TX_DINING, sel: '.filters select.f-on' },
  { group: 'filters', name: 'reset-filters', setup: TX_DINING, sel: '.day-tools' },
  { group: 'buttons', name: 'see-upcoming', setup: PAGE('#/transactions', `Object.assign(state.ui, { q: '', cat: '', occ: '', wallet: '' }); ${UPCOMING}`), sel: '.see-upcoming' },
  // navigation
  { group: 'navigation', name: 'top-bar', setup: PAGE('#/overview'), sel: '.topbar' },
  { group: 'navigation', name: 'bottom-nav', setup: PAGE('#/overview'), sel: '.bottom-nav' },
  { group: 'navigation', name: 'sidebar', setup: PAGE('#/overview'), sel: '.sidebar', width: 1280 },
  { group: 'navigation', name: 'tabs', setup: PAGE('#/portfolio', `state.ui.pfTab = 'investment';`), sel: '.tabs' },
  // cards and rows
  { group: 'cards', name: 'hero', setup: PAGE('#/overview'), sel: '.hero' },
  { group: 'cards', name: 'card', setup: PAGE('#/budgets'), sel: '.stack > section.card' },
  { group: 'cards', name: 'loan-card', setup: PAGE('#/portfolio', `state.ui.pfTab = 'loan';`), sel: '.stack > section.card' },
  { group: 'rows', name: 'transaction', setup: PAGE('#/overview'), sel: '.list .row[data-act=edit-txn]' },
  { group: 'rows', name: 'day', setup: TX, sel: '.day-group' },
  { group: 'rows', name: 'holding', setup: PAGE('#/portfolio', `state.ui.pfTab = 'investment';`), sel: '.holding-row' },
  { group: 'rows', name: 'occasion-settings', setup: PAGE('#/settings'), sel: '#occasions-card .brow' },
  { group: 'rows', name: 'budget', setup: PAGE('#/budgets'), sel: '.brow' },
];

/* in the page: native form controls are drawn by the browser, which dom-to-svg cannot see; swap each for a plain box with the
   same computed style and the text it shows, so Figma gets an editable text layer */
function freezeControls() {
  // an open modal pins the body (position: fixed), which leaves the page with no height for the SVG; undo that for the capture
  document.body.classList.remove('scroll-locked');
  // the dimmed backdrop of an open dialog is a pseudo-element the SVG cannot see: draw it as a real layer
  const dlg = document.querySelector('dialog[open]');
  if (dlg && !document.getElementById('capture-backdrop')) { const b = document.createElement('div'); b.id = 'capture-backdrop'; b.style.cssText = `position:fixed;inset:0;background:${getComputedStyle(dlg, '::backdrop').backgroundColor || 'rgba(20,18,50,.45)'}`; dlg.before(b); }
  const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#8a8fb5';
  document.querySelectorAll('select, input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]), textarea').forEach((el) => {
    if (!el.getClientRects().length) return;
    const cs = getComputedStyle(el), d = document.createElement('div');
    for (const k of cs) d.style.setProperty(k, cs.getPropertyValue(k));
    let text = el.tagName === 'SELECT' ? (el.selectedOptions[0] ? el.selectedOptions[0].textContent : '') : el.value;
    if (el.type === 'date' && el.value) text = new Date(el.value + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const ph = !text && el.placeholder; if (ph) { text = el.placeholder; d.style.color = muted; }
    const single = el.tagName !== 'TEXTAREA', center = cs.textAlignLast === 'center' || cs.textAlign === 'center';
    d.style.display = 'flex'; d.style.alignItems = single ? 'center' : 'flex-start'; d.style.justifyContent = el.tagName === 'SELECT' && cs.appearance !== 'none' && !center ? 'space-between' : center ? 'center' : 'flex-start';
    d.style.whiteSpace = single ? 'nowrap' : 'pre-wrap'; d.style.overflow = 'hidden'; d.style.pointerEvents = 'none';
    const t = document.createElement('span'); t.textContent = (text || '').trim(); t.style.overflow = 'hidden'; t.style.textOverflow = 'ellipsis'; d.appendChild(t);
    if (el.tagName === 'SELECT' && cs.appearance !== 'none' && !center) { const c = document.createElement('span'); c.textContent = '⌄'; c.style.marginLeft = '8px'; c.style.opacity = '.7'; d.appendChild(c); }
    if (el.type === 'date') { const c = document.createElement('span'); c.textContent = ''; d.appendChild(c); }
    if (el.hasAttribute('data-capture')) { d.setAttribute('data-capture', ''); el.removeAttribute('data-capture'); }
    el.before(d); el.style.display = 'none';   // the real control stays in the page, hidden, so an open list or calendar does not close
  });
}

/* ---------- design tokens (W3C design-token format, which Tokens Studio and Figma variable importers read) ---------- */
function tokens() {
  const css = fs.readFileSync(path.join(ROOT, 'prototype/styles.css'), 'utf8');
  const block = (re) => { const m = css.match(re); const out = {}; if (m) for (const [, k, v] of m[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[k] = v.trim(); return out; };
  const light = block(/:root\s*\{([^}]*)\}/), dark = block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
  const col = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => /^#|rgba?\(/.test(v)).map(([k, v]) => [k, { $type: 'color', $value: v }]));
  const dim = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { $type: 'dimension', $value: v + 'px' }]));
  return {
    $description: 'Stiver design tokens, generated from prototype/styles.css by tools/design/export.js. Light and dark colour themes share the same token names.',
    color: { light: col(light), dark: col(dark), category: Object.fromEntries([['groceries', '#4A44C6'], ['dining', '#8B8FF0'], ['transport', '#F5B800'], ['shopping', '#EC4899'], ['bills', '#14B8A6'], ['entertainment', '#F97316'], ['health', '#EF4444'], ['travel', '#0EA5E9'], ['salary', '#22C55E'], ['freelance', '#84CC16'], ['other', '#94A3B8']].map(([k, v]) => [k, { $type: 'color', $value: v }])),
      asset: Object.fromEntries([['crypto', '#F5B800'], ['stablecoin', '#14B8A6'], ['stock', '#4A44C6'], ['etf', '#8B8FF0'], ['commodity', '#D97706'], ['cash', '#64748B']].map(([k, v]) => [k, { $type: 'color', $value: v }])) },
    font: { family: { $type: 'fontFamily', $value: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      weight: { regular: { $type: 'fontWeight', $value: 400 }, medium: { $type: 'fontWeight', $value: 500 }, semibold: { $type: 'fontWeight', $value: 600 }, bold: { $type: 'fontWeight', $value: 700 }, heavy: { $type: 'fontWeight', $value: 800 } } },
    typography: Object.fromEntries([['page-title', 24, 700], ['hero-amount', 38, 700], ['big-number', 30, 700], ['dialog-title', 20, 700], ['card-title', 16, 500], ['body', 15, 400], ['body-strong', 15, 600], ['small', 13, 400], ['caption', 12, 400], ['overline', 11, 600]]
      .map(([k, size, weight]) => [k, { $type: 'typography', $value: { fontFamily: '{font.family}', fontSize: size + 'px', fontWeight: weight, lineHeight: size >= 24 ? 1.1 : 1.35, letterSpacing: k === 'card-title' ? '0.04em' : k === 'overline' ? '0.06em' : k === 'page-title' ? '-0.02em' : '0' } }])),
    radius: dim({ sm: 8, md: 10, lg: 12, xl: 14, '2xl': 16, '3xl': 18, card: 24, pill: 999 }),
    space: dim({ 1: 4, 2: 6, 3: 8, 4: 10, 5: 12, 6: 14, 7: 16, 8: 20, 9: 24 }),
    size: dim({ 'control-height': 44, 'pill-height': 40, 'button-height': 42, 'button-height-lg': 50, 'icon-button': 48, avatar: 38, 'row-tile': 44, 'bottom-nav-add': 60 }),
    shadow: { card: { $type: 'shadow', $value: light.shadow || '0 1px 2px rgba(30,27,75,.06), 0 8px 28px rgba(30,27,75,.06)' }, popover: { $type: 'shadow', $value: '0 18px 40px rgba(30,27,75,.22)' } },
  };
}

(async () => {
  for (const d of ['screens/mobile-light', 'screens/mobile-dark', 'screens/desktop-light', 'components', 'tokens']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'tokens/stiver.tokens.json'), JSON.stringify(tokens(), null, 2) + '\n');
  const browser = await chromium.launch();
  const open = async (width, height, theme, ua) => {
    const ctx = await browser.newContext({ viewport: { width, height }, bypassCSP: true, serviceWorkers: 'block', deviceScaleFactor: 1, locale: 'en-US', ...(ua ? { userAgent: ua } : {}) });
    const p = await ctx.newPage();
    await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await p.addInitScript((t) => { try { localStorage.setItem('stiver.theme.v1', t); localStorage.setItem('stiver.demo.v1', '0'); } catch { /* */ } }, theme);
    await p.goto(URL); await p.waitForSelector('.land');
    await p.evaluate((t) => applyTheme(t), theme);
    return { ctx, p };
  };
  const signIn = async (p, demo = true) => { await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'design@stiver.io'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell'); if (demo) { await p.evaluate(() => setDemo(true)); await p.waitForTimeout(600); } };
  const capture = async (p, file, fullPage, after) => {
    if (fullPage) { const h = await p.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)); const vp = p.viewportSize(); if (h > vp.height) { await p.setViewportSize({ width: vp.width, height: h }); await p.waitForTimeout(150); } }
    else { const h = await p.evaluate(() => { const d = document.querySelector('#dlg[open] .dlg'); return d ? d.scrollHeight + 140 : 0; }); const vp = p.viewportSize(); if (h > vp.height) { await p.setViewportSize({ width: vp.width, height: h }); await p.waitForTimeout(150); } }
    if (after) { await p.evaluate((s) => { new Function(s)(); }, after); await p.waitForTimeout(350); }
    await p.screenshot({ path: file + '.png' });
    await p.evaluate(D2S); await p.evaluate(freezeControls);
    // a page is exported whole; a dialog is exported as the dialog itself (the page behind it is inert and comes out empty)
    const svg = await p.evaluate(async (full) => { const doc = full ? domToSvg.documentToSVG(document) : domToSvg.elementToSVG(document.querySelector('dialog[open]')); await domToSvg.inlineResources(doc.documentElement); return new XMLSerializer().serializeToString(doc); }, fullPage);
    fs.writeFileSync(file + '.svg', svg);
  };
  const modes = [['mobile-light', 390, 844, 'light'], ['mobile-dark', 390, 844, 'dark'], ['desktop-light', 1280, 860, 'light']];
  for (const [mode, w, h, theme] of modes) {
    for (const [name, kind, setup, after] of SCREENS) {
      if (only && !name.includes(only)) continue;
      if (mode === 'desktop-light' && !DESKTOP_PAGES.has(name)) continue;
      const { ctx, p } = await open(w, h, theme);
      try {
        if (kind !== 'auth') await signIn(p);
        await p.evaluate((s) => { new Function(s)(); }, setup); await p.waitForTimeout(kind === 'dialog' ? 450 : 350);
        await capture(p, path.join(OUT, 'screens', mode, name), kind !== 'dialog', after);
        console.log('screen', mode, name);
      } catch (e) { console.log('FAILED', mode, name, e.message.split('\n')[0]); }
      await ctx.close();
    }
  }
  for (const c of COMPONENTS) {
    const id = c.group + '/' + c.name; if (only && !id.includes(only)) continue;
    fs.mkdirSync(path.join(OUT, 'components', c.group), { recursive: true });
    for (const theme of ['light', 'dark']) {
      const { ctx, p } = await open(c.width || 390, 844, theme, c.ua);
      try {
        await signIn(p, c.demo !== false); await p.evaluate((s) => { new Function(s)(); }, c.setup); await p.waitForTimeout(500);
        if (c.after) { await p.evaluate((s) => { new Function(s)(); }, c.after); await p.waitForTimeout(350); }
        const ok = await p.evaluate(({ sel, up }) => { let el = document.querySelector(sel); if (el && up) el = el.closest(up) || el; if (!el) return false; el.setAttribute('data-capture', ''); return true; }, { sel: c.sel, up: c.up });
        if (!ok) throw new Error('not found: ' + c.sel);
        const file = path.join(OUT, 'components', c.group, `${c.name}${theme === 'dark' ? '-dark' : ''}`);
        await (await p.$('[data-capture]')).screenshot({ path: file + '.png' });
        await p.evaluate(D2S); await p.evaluate(freezeControls);
        const svg = await p.evaluate(async () => { const doc = domToSvg.elementToSVG(document.querySelector('[data-capture]')); await domToSvg.inlineResources(doc.documentElement); return new XMLSerializer().serializeToString(doc); });
        fs.writeFileSync(file + '.svg', svg); console.log('component', id, theme);
      } catch (e) { console.log('FAILED component', id, theme, e.message.split('\n')[0]); }
      await ctx.close();
    }
  }
  await browser.close();
})();
