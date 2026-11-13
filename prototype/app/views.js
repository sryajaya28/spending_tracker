'use strict';
/* Stiver app: the screen functions (overview, transactions, budgets, settings, onboarding), support page, category spending trend. Part of the former prototype/app.js; see docs/MAP.md. */
/* ---------- views ---------- */
function sidebar() {
  const r = route();
  const link = (id, ic, label) => `<a href="#/${id}" class="${r === id ? 'active' : ''}">${icon(ic)}<span>${__(label)}</span></a>`;
  return `<aside class="sidebar"><div class="logo"><img src="icon.svg" alt="">Stiver</div>
    <div class="nav-label">${__('MENU')}</div><nav class="nav">${link('overview', 'home', 'Overview')}${link('transactions', 'swap', 'Transactions')}${link('budgets', 'pie', 'Budgets')}${link('portfolio', 'wallet-nav', 'Portfolio')}</nav>
    <div class="nav-label">${__('ACCOUNT')}</div><nav class="nav">${link('settings', 'gear', 'Settings')}</nav></aside>`;
}
function bottomNav() {
  const r = route();
  const l = (id, ic, label) => `<a href="#/${id}" class="${r === id ? 'active' : ''}">${icon(ic)}${__(label)}</a>`;
  const add = canWrite() ? `<button type="button" class="nav-add" data-act="add-txn" aria-label="${__('Add transaction')}"><span>${icon('plus')}</span>${__('Add')}</button>` : '';   // a Viewer has no Add: four equal tabs, no empty slot
  return `<nav class="bottom-nav${add ? '' : ' four'}">${l('overview', 'home', 'Overview')}${l('transactions', 'swap', 'Transactions')}${add}${l('budgets', 'pie', 'Budgets')}${l('portfolio', 'wallet-nav', 'Portfolio')}</nav>`;
}
function topbar(title, sub) {
  const p = D().profile, hour = new Date().getHours();
  const first = esc(p.name.split(' ')[0]);
  const greet = title ? __(title) : hour < 12 ? __('Good morning, {name}', { name: first }) : hour < 18 ? __('Good afternoon, {name}', { name: first }) : __('Good evening, {name}', { name: first });
  return `<header class="topbar"><div><h1>${greet}</h1></div>
    <div class="tools"><label class="search">${icon('search')}<input id="gsearch" placeholder="${__('Search transactions')}" aria-label="${__('Search transactions')}"></label>
    <button type="button" class="icon-btn support-btn" data-act="support" aria-label="${__('Report a bug or send feedback')}" title="${__('Report a bug or send feedback')}">${icon('chat')}</button>
    <a class="profile" href="#/settings" aria-label="${__('Settings')}"><div class="avatar">${esc(p.name[0].toUpperCase())}</div><div><b>${esc(p.name)}</b><small>${esc(p.currency)} · ${__('signed in')}</small></div></a></div></header>`;
}

/* ---------- support: report a bug or suggest an improvement ----------
   Up to 250 characters and up to 5 screenshots of at most 1 MB each (bigger photos are shrunk in the browser). The report goes to the
   support_reports table with a `type` of bug or feedback; the database adds the user id and email. */
const SUPPORT_MAX_FILES = 5, SUPPORT_MAX_BYTES = 1048576, SUPPORT_MAX_CHARS = 250;
let supportShots = [];   // [{ blob, name, url (data URL for the thumbnail) }]
const blobToDataUrl = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
async function shrinkImage(file) {
  if (file.size <= SUPPORT_MAX_BYTES && /^image\/(png|jpeg|webp|gif)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);   // throws for something that is not a readable image
  let scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale)); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.7, 0.55]) { const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q)); if (blob && blob.size <= SUPPORT_MAX_BYTES) return blob; }
    scale *= 0.75;
  }
  throw new Error('too big');
}
function supportShotsHtml() {
  const thumbs = supportShots.map((f, i) => `<div class="shot"><img src="${f.url}" alt="${esc(f.name)}"><button type="button" class="icon-x" data-act="shot-del" data-i="${i}" aria-label="${__('Remove image')}">×</button></div>`).join('');
  const add = supportShots.length < SUPPORT_MAX_FILES ? `<label class="shot add"><input type="file" name="shots" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden><span>＋</span><small>${__('Add')}</small></label>` : '';
  return `${thumbs}${add}`;
}
function supportDialog() {
  supportShots = [];
  open(`<div class="support-form"><h2>${__('Help & feedback')}</h2><p class="muted sub">${__('Found a bug or have an idea? Tell us.')}</p>
  <form data-form="support" style="display:contents">
    <div class="seg"><label><input type="radio" name="type" value="bug" checked>${__('Report a bug')}</label><label><input type="radio" name="type" value="feedback">${__('Share an idea')}</label></div>
    <label class="field">${__('What happened, or what would you like to see?')}<textarea name="message" rows="5" maxlength="${SUPPORT_MAX_CHARS}" required placeholder="${__('Type here (max 250 characters)')}"></textarea><small class="muted support-count" id="support-count">0/${SUPPORT_MAX_CHARS}</small></label>
    <div class="field">${__('Screenshots (optional)')}<div class="shots" id="shots">${supportShotsHtml()}</div><small class="muted">${__('Up to 5 images, 1 MB each. Larger photos are shrunk automatically.')}</small></div>
    <div class="actions"><button class="btn" type="submit" data-send>${__('Send')}</button></div></form></div>`);
}
async function addSupportShots(files) {
  const room = SUPPORT_MAX_FILES - supportShots.length; let skipped = 0;
  for (const f of [...files].slice(0, room)) {
    try { const blob = await shrinkImage(f); supportShots.push({ blob, name: f.name || 'image', url: await blobToDataUrl(blob) }); } catch { skipped++; }
  }
  if (files.length > room) toast(__('Only {n} images can be attached', { n: SUPPORT_MAX_FILES }));
  else if (skipped) toast(__('Some files could not be added (images only, up to 1 MB)'));
  const box = $('#shots'); if (box) box.innerHTML = supportShotsHtml();
}

/* ---------- category spending trend: stacked bars per period ----------
   All categories: each bar is split by top-level category. One category with sub-categories: split by sub-category.
   One sub-category (or a category without any): a single-colour bar. Tap a bar for the breakdown of that period. */
const TREND_N = [[1, '1 month'], [3, '3 months'], [6, '6 months'], [12, '12 months']];
const TREND_PALETTE = ['#4A44C6', '#F5B800', '#1FA971', '#E5484D', '#8B8FF0', '#D97706', '#14B8A6', '#64748B'];
function trendData() {
  const n = state.ui.trendN || 6, sel = state.ui.trendCat || '', c = sel ? catOf(sel) : null, ps = lastMonths(n);
  const kids = c && !c.parent_id ? childrenOf(c.id) : [];
  const keyOf = (t) => {   // which segment of the bar a transaction falls into
    const id = t.category_id || null;
    if (!sel) return id ? rootOf(id) : 'none';
    if (kids.length) return id === sel ? 'direct' : id;
    return sel;
  };
  const inScope = (t) => (!sel ? true : !!t.category_id && (t.category_id === sel || (!c.parent_id && rootOf(t.category_id) === sel)));
  const per = ps.map((k) => { const m = new Map(); inMonth(k).filter((t) => t.type === 'expense' && inScope(t)).forEach((t) => m.set(keyOf(t), (m.get(keyOf(t)) || 0) + amt(t))); return m; });
  const totals = new Map(); per.forEach((m) => m.forEach((v, key) => totals.set(key, (totals.get(key) || 0) + v)));
  const ranked = [...totals].sort((a, b) => b[1] - a[1]).map(([key]) => key), keep = ranked.slice(0, 6), rest = ranked.slice(6);
  const info = (key, i) => {
    if (key === 'none') return { key, name: __('Uncategorized'), color: '#CBD0E8' };
    if (key === 'direct') return { key, name: __('Not in a sub-category'), color: '#CBD0E8', cat: sel };
    const cc = catOf(key); return { key, name: cc ? cc.name : '?', color: kids.length || !cc || !cc.color ? TREND_PALETTE[i % TREND_PALETTE.length] : cc.color, cat: key, icon: cc && cc.icon };
  };
  const segs = keep.map(info); if (rest.length) segs.push({ key: 'others', name: __('Others'), color: '#9AA0C4' });
  const val = (m, seg) => (seg.key === 'others' ? rest.reduce((a, key) => a + (m.get(key) || 0), 0) : m.get(seg.key) || 0);
  return { ps, segs, rows: per.map((m) => segs.map((seg) => val(m, seg))), n, sel, c };
}
function trendChart() {
  const d = trendData(), W = 560, H = 250, pl = 50, pr = 14, pt = 12, pb = 30, c$ = cur();
  const tot = d.rows.map((r) => r.reduce((a, v) => a + v, 0)), raw = Math.max(...tot, 1);
  const base = 10 ** Math.floor(Math.log10(raw / 4)), max = 4 * base * ([1, 1.5, 2, 2.5, 5, 10].find((m) => m * base >= raw / 4) || 10);
  const slot = (W - pl - pr) / d.n, bw = Math.min(64, slot * 0.62), y = (v) => pt + (H - pt - pb) * (1 - v / max);
  if (!tot.some((v) => v > 0)) return `<div class="empty">${__('No spending in this range.')}</div>`;
  const grid = [0, 1, 2, 3, 4].map((i) => (max * i) / 4).map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" style="stroke:var(--line)"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted)">${compact(t, c$)}</text>`).join('');
  const bars = d.ps.map((k, i) => {
    const x = pl + slot * i + (slot - bw) / 2; let acc = 0;
    const segs = d.segs.map((sg, j) => { const v = d.rows[i][j]; if (!v) return ''; const y1 = y(acc + v), h = y(acc) - y1; acc += v; return `<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h - 1, 0.5).toFixed(1)}" fill="${sg.color}"><title>${esc(sg.name)}: ${money(v, c$)}</title></rect>`; }).join('');
    return `<g class="tbar" data-act="trend-detail" data-k="${k}" tabindex="0" role="button" aria-label="${esc(periodShort(k))}: ${money(tot[i], c$)}"><rect x="${pl + slot * i}" y="${pt}" width="${slot}" height="${H - pt - pb}" fill="transparent"/>${segs}<text x="${pl + slot * i + slot / 2}" y="${H - 9}" text-anchor="middle" font-size="11" style="fill:var(--muted)">${esc(monthLabel(k, 'short'))}</text></g>`;
  }).join('');
  const legend = d.segs.map((sg) => `<span><i style="background:${sg.color}"></i>${sg.icon ? sg.icon + ' ' : ''}${esc(sg.name)}</span>`).join('');
  return `<svg class="chart trend" viewBox="0 0 ${W} ${H}" role="group" aria-label="${__('Category spending trend')}">${grid}${bars}</svg><div class="legend-row" style="margin-top:10px">${legend}</div>`;
}
const trendCatOptions = () => `<option value="">${__('All categories')}</option>${catTree('expense').map((c) => `<option value="${c.id}" data-s="${esc((c.parent_id ? (catOf(c.parent_id)?.name || '') + ' ' : '') + c.name)}" ${c.id === (state.ui.trendCat || '') ? 'selected' : ''}>${c.parent_id ? '  ↳ ' : ''}${c.icon} ${esc(c.name)}</option>`).join('')}`;
const trendCard = () => `<section class="card"><div class="card-head"><h2>${__('Category trend')}</h2><div class="tools"><select class="pill-select" data-trend="n" aria-label="${__('Time frame')}">${TREND_N.map(([n, l]) => `<option value="${n}" ${n === (state.ui.trendN || 6) ? 'selected' : ''}>${__(l)}</option>`).join('')}</select></div></div>
  <label class="field trend-cat"><select data-trend="cat" data-search data-empty="${__('Category not found')}" aria-label="${__('Category')}">${trendCatOptions()}</select></label>
  <div id="trend-chart">${trendChart()}</div></section>`;
/* what a bar is made of, with a shortcut to the matching transactions */
function trendDialog(k) {
  const d = trendData(), i = d.ps.indexOf(k), c$ = cur(), total = d.rows[i].reduce((a, v) => a + v, 0);
  const rows = d.segs.map((sg, j) => ({ sg, v: d.rows[i][j] })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
  open(`<h2>${esc(monthLabel(k))}</h2><p class="muted" style="margin-top:-10px">${d.c ? esc(d.c.icon + ' ' + d.c.name) : __('All categories')} · ${__('Spent')} <b class="num">${money(total, c$)}</b></p>
    <div class="list">${rows.map(({ sg, v }) => `<div class="bk-item"><div class="bk-sum nochev"><span class="bk-name"><i class="dot" style="background:${sg.color}"></i><b>${sg.icon ? sg.icon + ' ' : ''}${esc(sg.name)}</b></span><span class="bk-amt num">${money(v, c$)} <small class="muted">${Math.round((v / total) * 100)}%</small></span></div>
      <div class="bar"><i style="width:${Math.round((v / total) * 100)}%;background:${sg.color}"></i></div>
      ${sg.key === 'others' ? '' : `<div class="bk-subs"><button class="legend-btn" data-act="trend-go" data-k="${k}" data-cat="${sg.key === 'none' ? 'none' : sg.cat || ''}">${__('View transactions')}</button></div>`}</div>`).join('') || ('<div class="empty">' + __('No spending in this period.') + '</div>')}</div>
    <div class="actions"><button type="button" class="btn" data-act="close">${__('Close')}</button></div>`);
}
/* first run: what the user has set up so far. An empty account (no accounts with money, no budget, no transaction) gets a getting-started
   Overview instead of empty charts; afterwards a slim strip keeps pointing at what is still missing. */
// the first-run screen stays until there is an account and a budget (or a first transaction)
function setupState() {
  // an account counts as set up when anything differs from the untouched start (one "Cash" account at 0): money in it, another account (archived or not),
  // the Cash account renamed, or an investment / loan account
  const d = D(), hasAccount = totalBalance() !== 0 || d.wallets.length > 1 || d.wallets.some((w) => w.name.trim().toLowerCase() !== 'cash') || d.investments.length > 0 || d.loans.length > 0 || (d.lent || []).length > 0;
  const hasBudget = d.budgets.length > 0, hasTx = d.transactions.length > 0;
  return { hasAccount, hasBudget, hasTx, fresh: !state.real && !hasTx && !onbSkipped(), partial: !state.real && (!hasAccount || !hasBudget) };
}
/* "Skip for now" on the first-run screen is remembered on this device (per account) */
const onbKey = () => 'stiver.onb.skip.' + (state.auth.uid || '');
function onbSkipped() { if (state.ui.onbSkipped === undefined) { try { state.ui.onbSkipped = localStorage.getItem(onbKey()) === '1'; } catch { state.ui.onbSkipped = false; } } return state.ui.onbSkipped; }
function skipOnboarding() { Analytics.track('onboarding_skipped'); state.ui.onbSkipped = true; try { localStorage.setItem(onbKey(), '1'); } catch { /* storage unavailable: skipped for this visit */ } render(); }
/* the celebration after the last step: shown once, then the normal Overview (a tap or a few seconds) */
function endCongrats() { if (state.ui.congrats) { Analytics.track('onboarding_completed'); state.ui.congrats = false; if (route() === 'overview') render(); } }
function congratsView() {
  const colors = ['#4A44C6', '#F5B800', '#EC4899', '#14B8A6', '#F97316', '#0EA5E9', '#22C55E'];
  const bits = Array.from({ length: 30 }, (_, n) => `<i style="--x:${(n * 37) % 100}%;--c:${colors[n % colors.length]};--d:${2.4 + (n % 5) * 0.35}s;--w:${(n % 7) * 0.12}s;--r:${(n * 47) % 180}deg"></i>`).join('');
  return `<div class="congrats" role="status"><div class="confetti" aria-hidden="true">${bits}</div>
    <div class="cg-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
    <h1>${__("Now you're set!")}</h1><p class="muted">${__('Your first transaction is in. Stiver is ready for you.')}</p>
    <button type="button" class="btn" data-act="congrats-add">${__('Add more transactions')}</button></div>`;
}
function onboardingView(st) {
  const step = (n, done, title, sub, act, label) => `<div class="onb-step ${done ? 'done' : ''}"><span class="onb-n" aria-hidden="true">${done ? '✓' : n}</span><div class="onb-t"><b>${title}</b><small class="muted">${sub}</small></div>
    ${done ? `<span class="onb-ok">${__('Done')}</span>` : `<button type="button" class="btn ${n === 1 ? '' : 'secondary'}" data-act="${act}">${label}</button>`}</div>`;
  const doneN = [st.hasAccount, st.hasBudget, st.hasTx].filter(Boolean).length;
  return `${topbar('', 'Here is where your money stands today.')}
  <div class="onb">
    <section class="card onb-sample"><span class="onb-flask" aria-hidden="true">🧪</span><h2>${__('Explore Stiver with sample data')}</h2>
      <p>${__('See a full demo account first: accounts, budgets, investments and debts. Nothing you do there is saved.')}</p>
      <button type="button" class="btn onb-try" data-act="demo-on">${__('Try sample data')}</button></section>
    <section class="card onb-steps"><div class="card-head"><h2>${__('Set up your own')}</h2><span class="chip">${__('{n} of 3', { n: doneN })}</span></div>
      <p class="muted" style="margin-bottom:6px">${__('Three quick steps and Stiver is ready.')}</p>
      ${step(1, st.hasAccount, __('Add your accounts'), __("Bank, e-wallet or cash, with today's balance"), 'add-wallet', __('Add account'))}
      ${step(2, st.hasBudget, __('Set a monthly budget'), __('Cap what you spend each month'), 'add-budget', __('Set budget'))}
      ${step(3, st.hasTx, __('Add your first transaction'), __('Record an expense or income'), 'add-txn', __('Add'))}</section>
    ${st.hasAccount && st.hasBudget ? `<p class="onb-skip"><button type="button" class="legend-btn" data-act="onb-skip">${__("Skip for now, I'll add transactions later")}</button></p>` : ''}
    ${installBtn('ov-install')}
  </div>`;
}
/* after the first steps: one slim line for what is still missing */
const setupStrip = (st) => (st.partial && !st.fresh
  ? `<div class="setup-strip" role="status"><span>${__('Finish setting up')}</span>${st.hasAccount ? '' : `<button type="button" class="chip" data-act="add-wallet">${__('Add account')}</button>`}${st.hasBudget ? '' : `<button type="button" class="chip" data-act="add-budget">${__('Set budget')}</button>`}</div>` : '');
/* The line and thin bar under the Overview hero amount: what is left of the CURRENT period's overall budget and how many days remain (the last day counts).
   No overall budget: what was spent this period and a nudge to set one. The whole block opens Budgets. The two amounts follow the eye button; the bar stays. */
function heroBudget(spentToday) {
  const k = currentPeriod(), g = budgetStatus(k).find((b) => b.category_id === null), c$ = cur();
  if (!g) return `<div class="hero-bud" data-act="hero-budget" tabindex="0" role="link"><div class="hero-bud-line">${__('{amount} spent', { amount: moneyHtmlP(sumBy(inMonth(k), 'expense'), c$) })} · <u>${__('Set a monthly budget')} ›</u></div></div>`;
  const days = Math.round((new Date(periodEnd(k) + 'T00:00') - new Date(todayIso() + 'T00:00')) / 86400000) + 1;
  const left = g.remaining >= 0 ? __('{amount} left this month', { amount: moneyHtmlP(g.remaining, c$) }) : __('{amount} over budget', { amount: moneyHtmlP(-g.remaining, c$) });
  const pct = Math.min(100, Math.max(0, Math.round(g.pct)));
  return `<div class="hero-bud" data-act="hero-budget" tabindex="0" role="link"><div class="hero-bud-line">${left} · ${days === 1 ? __('1 day to go') : __('{n} days to go', { n: days })}</div>
    <div class="hero-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(__('Budget used'))} ${pct}%"><i class="${g.status}" style="width:${pct}%"></i></div></div>`;
}
function viewOverview() {
  const st = setupState();
  if (st.fresh) { state.ui.onbSeen = true; return onboardingView(st); }
  // the first transaction just ended the first-run screen: congratulate once (only when the account and the budget are set up too)
  if (state.ui.onbSeen && !state.real) { state.ui.onbSeen = false; if (st.hasAccount && st.hasBudget && st.hasTx) { state.ui.congrats = true; setTimeout(endCongrats, 4200); } }
  if (state.ui.congrats) return congratsView();
  const k = state.ui.month, list = inMonth(k), inc = sumBy(list, 'income'), exp = sumBy(list, 'expense'), net = inc - exp;
  const months = lastMonths(6);
  const incs = months.map((m) => sumBy(inMonth(m), 'income')), exps = months.map((m) => sumBy(inMonth(m), 'expense'));
  const cats = spendByCategory(k);
  const spentToday = sumBy(D().transactions.filter((t) => t.occurred_at === todayIso()), 'expense');   // only today's expenses: not income, transfers or upcoming entries
  const recent = D().transactions.filter((t) => t.occurred_at <= todayIso() && !hiddenLeg(t, '')).slice(0, 6);   // upcoming entries are not listed here either
  return `${samplePromo()}${topbar('', 'Here is where your money stands today.')}${setupStrip(st)}
  <div class="grid">
    <section class="card hero">${heroLabel(__('Spent today'), '', '', `<button type="button" class="hero-chip" data-act="hero-balance">${__('Balance')} ›</button>`)}
      <div class="amount-line"><div class="amount num" style="--len:${moneyP(spentToday, cur()).length + 6}">${moneyHtmlP(spentToday, cur())}</div>${heroCurrency(cur())}</div>
      ${heroBudget(spentToday)}
      <div class="hero-actions"><button class="ghost" data-act="add-txn" data-type="expense">${icon('plus')} ${__('Expense')}</button><button class="ghost" data-act="add-txn" data-type="income">${icon('plus')} ${__('Income')}</button><button class="ghost" data-act="invest">${icon('plus')} ${__('Invest')}</button><button class="ghost" data-act="transfer">${icon('swap')} ${__('Transfer')}</button></div>
      </section>
    ${installBtn('ov-install')}
    <section class="card"><div class="card-head"><h2>${__('Money Flow')}</h2><span class="chip">${__('6 months')}</span></div>
      <div class="big num">${money(Math.max(net, 0), cur())}</div><p class="muted" style="margin-bottom:14px">${__('Saved in {month}', { month: esc(monthLabel(k)) })}</p>
      ${flowChart(months, incs, exps)}</section>
    <section class="card"><div class="card-head"><h2>${__('Spending')}</h2><div class="tools">${monthSelect()}<button class="chip" data-act="breakdown">${__('Details')}</button></div></div>
      ${halfDonut(cats, exp)}</section>
 ${trendCard()}

  <section class="card"><div class="card-head"><h2>${__('Recent transactions')}</h2><a class="chip" href="#/transactions">${__('View all')}</a></div><div class="list">${recent.map((t) => txnRow(t)).join('')}</div></section>
  </div>`;
}

/* a transfer leg is stored as "Transfer to Gopay · top up" (the note after the dot is what the user typed): lists show only the first part */
/* a transfer between your own accounts is listed once, as the sender's record; the receiving leg only shows when that account is the one being filtered */
// the 'in' leg of a transfer between two accounts is hidden (the 'out' leg stands for the transfer); a withdrawal from an investment Cash balance has only an 'in' leg, which is shown
const hiddenLeg = (t, wallet = state.ui.wallet) => t.type === 'transfer' && !!t.transfer_id && t.flow === 'in' && wallet !== t.wallet_id && D().transactions.some((o) => o.transfer_id === t.transfer_id && o.type === 'transfer' && o.flow === 'out');
const transferTitle = (t) => String(t.note || '').split(' · ')[0];
const transferNote = (t) => String(t.note || '').split(' · ').slice(1).join(' · ');
function txnRow(t) {
  if (t.type === 'loan_payment') return `<div class="row" data-act="loan-payment" data-id="${t.loan_id}" data-pid="${String(t.id).replace('pay:', '')}" tabindex="0"><span class="tile" style="--c:#4A44C6">🏦</span><div><div class="title">${esc(t.note)}</div><div class="sub">${esc(D().loans.find((l) => l.id === t.loan_id)?.name || '')}</div></div><div class="amt-col"><div class="amt num">−${money(t.amount_minor, t.currency)}</div><div class="sub">${esc(new Date(t.occurred_at + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric' }))}</div></div></div>`;
  const lo = t.type === 'transfer' && !t.transfer_id && lentOfTxn(t.id);
  if (lo) return `<div class="row" data-act="lent-origin" data-id="${lo.id}" data-tid="${t.id}" tabindex="0"><span class="tile" style="--c:#F59E0B">💸</span>
    <div><div class="title">${esc(t.note)}</div><div class="sub">${__('Transfer out')} · ${esc(walletOf(t.wallet_id)?.name || '')}</div><span class="badge">${esc(__(catOf(t.category_id)?.name || 'Lent'))}</span></div>
    <div class="amt-col"><div class="amt num">−${money(t.amount_minor, t.currency)}</div><div class="sub">${esc(new Date(t.occurred_at + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric' }))}</div></div></div>`;
  const lr = t.type === 'transfer' && !t.transfer_id && lentRepaymentOf(t.id);
  if (lr) return `<div class="row" data-act="lent-repayment" data-id="${lr.lent.id}" data-pid="${lr.payment.id}" tabindex="0"><span class="tile" style="--c:#0EA5A4">🤝</span>
    <div><div class="title">${esc(t.note)}</div><div class="sub">${__('Transfer in')} · ${esc(walletOf(t.wallet_id)?.name || '')}</div><span class="badge">${esc(__(catOf(t.category_id)?.name || 'Lent Repayment'))}</span></div>
    <div class="amt-col"><div class="amt num income">+${money(t.amount_minor, t.currency)}</div><div class="sub">${esc(new Date(t.occurred_at + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric' }))}</div></div></div>`;
  if (t.type === 'transfer') {
    // money moved to/from an investment: not income or spending, so not editable here (edit it on the Portfolio page)
    const xfer = !!t.transfer_id;
    return `<div class="row" ${xfer ? `data-act="view-transfer" data-id="${t.transfer_id}" tabindex="0"` : ''}><span class="tile" style="--c:${xfer ? '#4A44C6' : '#F5B800'}">${xfer ? '🔁' : t.flow === 'out' ? '📈' : '💵'}</span>
    <div><div class="title">${esc(xfer ? transferTitle(t) : t.note)}</div>
    <div class="sub">${xfer ? __('Transfer') : t.flow === 'out' ? __('Buy Invest') : __('Sell Invest')} · ${esc(walletOf(t.wallet_id)?.name || '')}</div></div>
    <div class="amt-col"><div class="amt num"><span class="xfer-ico">${icon('transfer')}</span>${money(t.amount_minor, t.currency)}</div><div class="sub">${esc(new Date(t.occurred_at + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric' }))}</div></div></div>`;
  }
  const c = catOf(t.category_id), sign = t.type === 'income' ? '+' : '−';
  return `<div class="row" data-act="edit-txn" data-id="${t.id}" tabindex="0">${tile(c)}
    <div><div class="title">${esc(t.note || c?.name || __('Transaction'))}${t.category_source === 'ai' ? ('<span class="badge ai" title="' + __('Tagged by AI') + '">AI</span>') : ''}${t.occasion_id && occasionOf(t.occasion_id) ? `<span class="badge">🎉 ${esc(occasionOf(t.occasion_id).name)}</span>` : ''}</div>
    <div class="sub">${esc(c ? c.name : __('No category'))} · ${esc(txnWhere(t))}${hhNames() && t.by ? ` · ${esc(hhName(t.by) || '')}` : ''}</div></div>
    <div class="amt-col"><div class="amt num ${t.type}">${sign}${coinOf(t) ? coinAmount(coinOf(t), t.amount_minor) : money(t.amount_minor, t.currency)}</div><div class="sub">${t.occurred_at > todayIso() ? ('<span class="badge">' + __('Upcoming') + '</span>') : ''}${esc(new Date(t.occurred_at + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric' }))}</div></div></div>`;
}
function filteredTxns(upcoming = false) {
  const { q, cat, wallet, occ } = state.ui, ql = q.trim().toLowerCase(), who = hhNames() ? state.ui.who : '';
  return D().transactions.filter((t) => !hiddenLeg(t) && (!who || txnAuthor(t) === who) && (upcoming ? t.occurred_at > todayIso() : t.occurred_at <= todayIso())   // upcoming (future-dated) entries are not part of the history yet; they open in their own pop-up
    && (occ || state.ui.allPeriods || inPeriod(t.occurred_at, state.ui.month))
    && (!cat || (cat === 'none' ? !t.category_id && t.type !== 'transfer' : t.category_id === cat || (t.category_id && rootOf(t.category_id) === cat))) && (!wallet || t.wallet_id === wallet || (wallet.startsWith('h:') && coinOf(t)?.id === wallet.slice(2)) || (wallet.startsWith('l:') && (t.loan_id === wallet.slice(2) || (repaymentOf(t.id) || {}).loan?.id === wallet.slice(2)))) && (!occ || t.occasion_id === occ)
    && (!ql || (t.note || '').toLowerCase().includes(ql) || (catOf(t.category_id)?.name || '').toLowerCase().includes(ql)));
}
/* the Transactions page filtered to a loan account: what was charged to it (expenses paid with it) and the payments made on it */
const loanViewId = () => (state.ui.wallet && state.ui.wallet.startsWith('l:') ? state.ui.wallet.slice(2) : '');
function loanPaymentRows() {
  const id = loanViewId(), l = id && D().loans.find((x) => x.id === id), { q, cat, occ } = state.ui, ql = q.trim().toLowerCase(); if (!l || cat || occ || (hhNames() && state.ui.who)) return [];
  return l.payments.filter((p) => p.kind !== 'charge' && !p.txn_id && p.date <= todayIso() &&   // a payment made from an account is listed as that account's expense instead
 (state.ui.allPeriods || inPeriod(p.date, state.ui.month)) && (!ql || __('Debt payment').toLowerCase().includes(ql)))
    .map((p) => ({ id: 'pay:' + p.id, type: 'loan_payment', amount_minor: p.amount_minor, currency: l.currency, occurred_at: p.date, note: __('Debt payment'), loan_id: l.id }));
}
const dayTitle = (d) => new Date(d + 'T00:00').toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
const countLabel = (n) => n === 1 ? __('1 transaction') : __('{n} transactions', { n });
// one row per day with the day's totals (transfers are neither income nor spending)
/* days are collapsible: tap a day to open its transactions in place; Expand all / Hide all for the whole list. A search opens every matching day. */
function txnListHtml() {
  const loanView = !!loanViewId(), rows = [...filteredTxns(), ...loanPaymentRows()];
  const anyFilter = !!(state.ui.q.trim() || state.ui.cat || state.ui.occ || state.ui.wallet || (hhNames() && state.ui.who)), up = filteredTxns(true).length;
  const upBtn = up ? `<button type="button" class="see-upcoming" data-act="see-upcoming">${__('See upcoming transactions ({n})', { n: up })}</button>` : '';
  const reset = anyFilter ? `<button type="button" class="legend-btn reset-filters" data-act="reset-filters">${__('Reset filters')}</button>` : '';
  if (!rows.length) return (reset ? `<div class="day-tools">${reset}</div>` : '') + '<div class="empty">' + __('No transactions match.') + '</div>' + upBtn;
  const days = {};
  rows.forEach((t) => { (days[t.occurred_at] = days[t.occurred_at] || []).push(t); });
  const keys = Object.keys(days).sort().reverse(), searching = !!state.ui.q.trim();
  const group = (d) => {
    const l = days[d], inc = sumBy(l, 'income'), exp = sumBy(l, 'expense'), net = inc - exp - sumBy(l, 'loan_payment'), open = searching || state.ui.openDays.has(d);
    return `<div class="day-group ${open ? 'open' : ''}" data-day="${d}"><div class="row day-row" data-act="toggle-day" data-id="${d}" tabindex="0" role="button" aria-expanded="${open}"><span class="daybox"><b>${+d.slice(8)}</b><small>${esc(new Date(d + 'T00:00').toLocaleDateString(locale(), { month: 'short' }))}</small></span>
    <div><div class="title">${esc(new Date(d + 'T00:00').toLocaleDateString(locale(), { weekday: 'long' }))}</div>
    <div class="sub">${countLabel(l.length)}</div></div>
    ${!loanView && l.length && l.every((t) => t.type === 'transfer') ? `<div class="amt num muted" title="${__('Money moved: not income or spending')}"><span class="xfer-ico">${icon('transfer')}</span>${money(l.reduce((a, t) => a + amt(t), 0), cur())}</div>` : `<div class="amt num">${net < 0 ? '−' : net > 0 ? '+' : ''}${money(Math.abs(net), cur())}</div>`}<span class="day-chev" aria-hidden="true">›</span></div>
    <div class="day-body">${l.map((t) => txnRow(t)).join('')}</div></div>`;
  };
  // when the list spans several periods (All periods, or an occasion across months) each period gets its own heading
  const multi = new Set(keys.map(periodKeyOf)).size > 1; let lastP = '';
  const head = (d) => { if (!multi) return ''; const k = periodKeyOf(d); if (k === lastP) return ''; lastP = k; return `<div class="period-head" role="heading" aria-level="3"><span>${esc(periodHeading(k))}</span></div>`; };
  return `<div class="day-tools ${reset ? 'has-reset' : ''}">${reset}<span class="day-tools-r"><button type="button" class="legend-btn" data-act="days-all">${__('Expand all')}</button><span class="muted">·</span><button type="button" class="legend-btn" data-act="days-none">${__('Hide all')}</button></span></div>${keys.map((d) => head(d) + group(d)).join('')}${upBtn}`;
}
/* the future-dated entries of the period (same filters), soonest first; tap one to edit it */
function upcomingDialog() {
  const l = filteredTxns(true).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  open(`<h2>${__('Upcoming transactions')}</h2><p class="muted" style="margin-top:-10px">${esc(monthLabel(state.ui.month))} · ${countLabel(l.length)}</p>
  <div class="list up-list">${l.map((t) => txnRow(t)).join('') || ('<div class="empty">' + __('No upcoming transactions.') + '</div>')}</div>
  <div class="actions"><button type="button" class="btn" data-act="close">${__('Close')}</button></div>`);
}
// the detail page for one day: every transaction on it
const dayTxns = (d) => { const ql = (state.ui.dayQ || '').trim().toLowerCase(); return D().transactions.filter((t) => t.occurred_at === d && !hiddenLeg(t, '') && (!ql || (t.note || '').toLowerCase().includes(ql) || (catOf(t.category_id)?.name || '').toLowerCase().includes(ql))); };
const dayListHtml = (d) => { const l = dayTxns(d); return l.length ? l.map((t) => txnRow(t)).join('') : '<div class="empty">' + __(state.ui.dayQ ? 'No transactions match.' : 'No transactions on this day.') + '</div>'; };
function viewDay(d) {
  const l = D().transactions.filter((t) => t.occurred_at === d && !hiddenLeg(t, '')), inc = sumBy(l, 'income'), exp = sumBy(l, 'expense');
  return `${topbar('Transactions', countLabel(l.length) + ' · ' + __('Income') + ' ' + money(inc, cur()) + ' · ' + __('Spent') + ' ' + money(exp, cur()))}
  <section class="card"><div class="card-head"><div><a class="back-link" href="#/transactions">← ${__('Back to Transactions')}</a><h2>${esc(dayTitle(d))}</h2></div><div class="tools"><button class="btn" data-act="add-txn" data-date="${d}">${__('+ Add')}</button></div></div>
    <div class="txn-top"><input data-filter="dayq" placeholder="${__('Search')}" value="${esc(state.ui.dayQ || '')}" aria-label="${__('Search note or category')}"></div>
    <div class="list" id="day-list">${dayListHtml(d)}</div></section>`;
}
/* the three usual filters (category, occasion when the account has any, account); occasion and account get a search box above 5 choices */
const occFilterOpts = () => `<option value="">${__('All occasions')}</option>${D().occasions.map((o) => `<option value="${o.id}" data-s="${esc(o.name)}" ${state.ui.occ === o.id ? 'selected' : ''}>🎉 ${esc(o.name)}</option>`).join('')}`;
const walFilterOpts = () => `<option value="">${__('All accounts')}</option><optgroup label="${__('Savings Account')}">${D().wallets.map((w) => `<option value="${w.id}" ${state.ui.wallet === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</optgroup>${stableHoldings().length ? `<optgroup label="${__('Investment Account')}">${stableHoldings().map((h) => `<option value="h:${h.id}" ${state.ui.wallet === 'h:' + h.id ? 'selected' : ''}>${esc(coinLabel(h))}</option>`).join('')}</optgroup>` : ''}${D().loans.length ? `<optgroup label="${__('Debt Account')}">${D().loans.map((l) => `<option value="l:${l.id}" ${state.ui.wallet === 'l:' + l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</optgroup>` : ''}`;
const txnFilterSelects = () => `<select data-filter="cat" class="${state.ui.cat ? 'f-on' : ''}" data-search data-empty="${__('Category not found')}" aria-label="${__('Category')}"><option value="">${__('All categories')}</option><option value="none" ${state.ui.cat === 'none' ? 'selected' : ''}>Uncategorized</option>${catTree().map((c) => `<option value="${c.id}" data-s="${esc((c.parent_id ? (catOf(c.parent_id)?.name || '') + ' ' : '') + c.name)}" ${state.ui.cat === c.id ? 'selected' : ''}>${c.parent_id ? '  ↳ ' : ''}${c.icon} ${esc(c.name)}</option>`).join('')}</select>
      ${D().occasions.length ? `<select data-filter="occ" class="${state.ui.occ ? 'f-on' : ''}"${searchAttr(occFilterOpts(), 'Occasion not found')} aria-label="${__('Occasion')}">${occFilterOpts()}</select>` : ''}
      <select data-filter="wallet" class="${state.ui.wallet ? 'f-on' : ''}"${searchAttr(walFilterOpts(), 'Account not found')} aria-label="${__('Account')}">${walFilterOpts()}</select>`;
const whoSelect = () => `<select data-filter="who" class="${state.ui.who ? 'f-on' : ''}" aria-label="${__('Person')}"><option value="">${__('All people')}</option>${hhAuthors().map((p) => `<option value="${p.user_id}" ${state.ui.who === p.user_id ? 'selected' : ''}>${esc(hhName(p.user_id) || '?')}</option>`).join('')}</select>`;
const FKEYS = ['cat', 'occ', 'wallet', 'who'];
const fActive = () => FKEYS.filter((k) => state.ui[k] && (k !== 'who' || hhNames()));
function fLabel(k) {
  const v = state.ui[k];
  if (k === 'cat') return v === 'none' ? 'Uncategorized' : (catOf(v)?.name || '');
  if (k === 'occ') return occasionOf(v)?.name || '';
  if (k === 'who') return hhName(v) || '?';
  if (v.startsWith('h:')) { const h = stableHoldings().find((x) => x.id === v.slice(2)); return h ? coinLabel(h) : ''; }
  if (v.startsWith('l:')) return (D().loans.find((x) => x.id === v.slice(2)) || {}).name || '';
  return walletOf(v)?.name || '';
}
/* the person filter (2+ writers): all filters move into a sheet opened by the filter button in the search row; active ones show as chips that clear on a tap */
const filterBtnHtml = () => { const n = fActive().length; return `<button type="button" class="filter-btn ${n ? 'on' : ''}" id="filter-btn" data-act="open-filters" aria-label="${__('Filters')}">${icon('filter')}${n ? `<i class="fcount">${n}</i>` : ''}</button>`; };
const filtersAHtml = () => `<div class="filters-a" id="filters-a">${fActive().map((k) => `<button type="button" class="chip f-btn f-on" data-act="clear-filter" data-id="${k}" aria-label="${__('Clear filter')}">${esc(fLabel(k))} ✕</button>`).join('')}</div>`;
const txnFiltersHtml = () => (hhNames() ? filtersAHtml() : `<div class="filters scroll-row">${txnFilterSelects()}</div>`);
const showLabel = () => { const n = [...filteredTxns(), ...loanPaymentRows()].length; return n === 1 ? __('Show 1 transaction') : __('Show {n} transactions', { n }); };
/* the sheet. The selects are the same ones with the same data-filter, so the page's change handler updates the list behind it */
function filtersDialog() {
  const f = (label, sel) => `<label class="field">${label}${sel}</label>`;
  open(`<div data-form="txn-filters"><h2>${__('Filters')}</h2>${f(__('Category'), txnFilterSelects().match(/<select data-filter="cat".*?<\/select>/s)[0])}${D().occasions.length ? f(__('Occasion'), txnFilterSelects().match(/<select data-filter="occ".*?<\/select>/s)[0]) : ''}${f(__('Account'), txnFilterSelects().match(/<select data-filter="wallet".*?<\/select>/s)[0])}${f(__('Person'), whoSelect())}
    <div class="actions"><button type="button" class="btn secondary" data-act="filters-reset">${__('Reset')}</button><button type="button" class="btn" id="filters-count" data-act="close">${showLabel()}</button></div></div>`);
}
/* after any filter changed: the list, the button, the chips and the sheet's count */
function refreshFilterUi() {
  const l = $('#txn-list'); if (l) l.innerHTML = txnListHtml();
  const a = $('#filters-a'); if (a) a.outerHTML = filtersAHtml();
  const w = $('#filter-btn'); if (w) w.outerHTML = filterBtnHtml();
  const b = $('#filters-count'); if (b) b.textContent = showLabel();
}
function viewTransactions() {
  const all = !!state.ui.allPeriods, list = all ? D().transactions.filter((t) => t.occurred_at <= todayIso()) : inMonth(state.ui.month);
  return `${topbar('Transactions', __('{n} in {month} · income {income} · spent {spent}', { n: list.length, month: all ? __('All periods') : monthLabel(state.ui.month), income: money(sumBy(list, 'income'), cur()), spent: money(sumBy(list, 'expense'), cur()) }))}
  <section class="card"><div class="txn-top"><input data-filter="q" class="${state.ui.q.trim() ? 'f-on' : ''}" placeholder="${__('Search')}" value="${esc(state.ui.q)}" aria-label="${__('Search note or category')}">${monthSelect(true, true)}${hhNames() ? filterBtnHtml() : ''}<button class="btn add-desk" data-act="add-txn">${__('+ Add')}</button></div>
    ${txnFiltersHtml()}
    <div class="list" id="txn-list">${txnListHtml()}</div></section>`;
}

function viewBudgets() {
  const bs = budgetStatus(state.ui.month), g = bs.find((b) => b.category_id === null), rest = bs.filter((b) => b.category_id);
  const over = bs.filter((b) => b.status === 'exceeded').length;
  const cap = (b) => `<span class="badge ${b.status}">${b.status === 'ok' ? __('On track') : b.status === 'warning' ? __('Almost there') : __('Over budget')}</span>`;
  return `${topbar('Budgets', over ? __(over > 1 ? '{n} budgets exceeded in {month}' : '{n} budget exceeded in {month}', { n: over, month: monthLabel(state.ui.month) }) : __('Monthly limits for {month}', { month: monthLabel(state.ui.month) }))}
  <div class="stack">
  <section class="card"><div class="card-head"><h2>${__('Overall budget')}</h2><div class="tools">${monthSelect()}<button class="btn" data-act="add-budget">${__('+ Budget')}</button></div></div>
    ${g ? `<div class="big num">${money(g.spent, cur())} <span class="muted" style="font-size:18px;font-weight:500">${__('of {amount}', { amount: money(g.budget, cur()) })}</span></div>
      <div class="bar" style="margin:14px 0 10px"><i class="${g.status}" style="width:${Math.min(100, g.pct)}%"></i></div>
      <div class="budget-foot"><span class="muted">${g.remaining >= 0 ? __('{amount} left', { amount: money(g.remaining, cur()) }) : __('{amount} over', { amount: money(-g.remaining, cur()) })} · ${__('{pct}% used', { pct: Math.round(g.pct) })}</span><span class="budget-end">${cap(g)}<button class="btn secondary" data-act="edit-budget" data-id="${g.id}">${__('Edit')}</button></span></div>`
      : ('<p class="muted">' + __('No overall budget yet. Add one to cap total monthly spending.') + '</p>')}</section>
  <section class="card"><div class="card-head"><h2>${__('By category')}</h2><button class="btn" data-act="add-budget" data-preset="category">${__('+ Add')}</button></div>
    ${rest.length ? rest.map((b) => `<div class="brow tap-row" data-act="cat-txns" data-cat="${b.category_id}" tabindex="0" role="link" aria-label="${esc(__('See {name} transactions', { name: b.name }))}">${tile({ icon: b.icon, color: b.color })}<div><div class="meta"><span>${esc(b.name)} ${cap(b)}</span><span class="num">${money(b.spent, cur())} / ${money(b.budget, cur())} · ${Math.round(b.pct)}%</span></div><div class="bar"><i class="${b.status}" style="width:${Math.min(100, b.pct)}%"></i></div></div><button class="btn secondary" data-act="edit-budget" data-id="${b.id}">${__('Edit')}</button></div>`).join('') : ('<div class="empty">' + __('No category budgets yet.') + '</div>')}</section>
  <section class="card"><div class="card-head"><h2>${__('Special occasions')}</h2><div class="tools"><button class="chip" data-act="occasion-history">${__('History')}</button><button class="btn" data-act="add-occasion-budget">${__('+ Add')}</button></div></div>
    ${(() => { const live = occasionStatus().filter((o) => o.hasBudget && !occasionIsPast(o) && occasionInMonth(o, state.ui.month)); return live.length ? live.map(occasionRow).join('') : ('<div class="empty">' + __('No occasion budgets yet. Add one like "Bali Trip" or "Birthday Dinner".') + '</div>'); })()}</section></div>`;
}
/* an occasion is history once it is archived or its end (or its only) date has passed; undated ones are not */
const occasionIsPast = (o) => !!o.archived || (!!(o.end || o.start) && (o.end || o.start) < todayIso());
/* what "Details" opens on the Transactions page: the one period holding the occasion's expenses, or All periods when they span several;
   with none yet, the period of its start date (or the current one) */
function occasionView(o) {
  const periods = [...new Set(D().transactions.filter((t) => t.occasion_id === o.id).map((t) => periodKeyOf(t.occurred_at)))];
  return periods.length > 1 ? { all: true, month: state.ui.month } : { all: false, month: periods[0] || periodKeyOf(o.start || todayIso()) };
}
/* "Mar 10 – Mar 12, 2026" (the year once when both dates are in the same year); "Dec 28, 2025 – Jan 2, 2026" otherwise */
function occasionDates(o) {
  const L = (d, y) => new Date(d + 'T00:00').toLocaleDateString(locale(), y ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
  const a = o.start, b = o.end; if (!a && !b) return ''; if (!a || !b || a === b) return L(a || b, true);
  return a.slice(0, 4) === b.slice(0, 4) ? `${L(a)} – ${L(b, true)}` : `${L(a, true)} – ${L(b, true)}`;
}
function occasionHistoryDialog() {
  const list = occasionStatus().filter(occasionIsPast).sort((a, b) => (b.end || b.start || '').localeCompare(a.end || a.start || '') || a.name.localeCompare(b.name));
  const row = (o) => {
    const dates = occasionDates(o), amount = money(o.spent, cur()) + (o.hasBudget ? ` · ${Math.round(o.pct)}%` : '');   // total spent, and its share of the budget when there is one
    return `<div class="brow wrap occ-hist"><span class="tile" style="--c:#EC4899">🎉</span><div><div class="meta"><span>${esc(o.name)}${o.archived ? ' <span class="badge">' + __('Archived') + '</span>' : ''}</span></div>
      ${dates ? `<small class="muted">${esc(dates)}</small>` : ''}<small class="occ-amt num">${amount}</small></div>
      <div class="tools"><button class="btn secondary" data-act="view-occasion" data-id="${o.id}">${__('Details')}</button></div></div>`;
  };
  open(`<h2>${__('Past special occasions')}</h2>
  <div class="list up-list">${list.map(row).join('') || ('<div class="empty">' + __('No past special occasions yet.') + '</div>')}</div>
  <div class="actions"><button type="button" class="btn" data-act="close">${__('Close')}</button></div>`);
}
const occasionRow = (o) => {
  const dates = [o.start, o.end].filter(Boolean).map((d) => new Date(d + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' })).join(' – ');
  return `<div class="brow wrap"><span class="tile" style="--c:#EC4899">🎉</span><div><div class="meta"><span>${esc(o.name)} <span class="badge ${o.status}">${o.status === 'ok' ? __('On track') : o.status === 'warning' ? __('Almost there') : __('Over budget')}</span></span><span class="num">${money(o.spent, cur())} / ${money(o.budget, cur())} · ${Math.round(o.pct)}%</span></div>
    <div class="bar"><i class="${o.status}" style="width:${Math.min(100, o.pct)}%"></i></div>${dates ? `<small class="muted">${esc(dates)}</small>` : ''}</div>
    <div class="tools"><button class="btn" data-act="add-occasion-txn" data-id="${o.id}">${__('+ Expense')}</button><button class="btn secondary" data-act="view-occasion" data-id="${o.id}">${__('Details')}</button><button class="btn secondary" data-act="edit-occasion" data-id="${o.id}">${__('Edit')}</button></div></div>`;
};

/* Settings > Categories: collapsed by default; each parent with sub-categories expands on its own */
function categoriesCard() {
  const row = (c) => {
    const kids = childrenOf(c.id), isOpen = state.ui.openCats.has(c.id);
    return `<div class="brow cat-row">${tile(c)}<div class="cat-main"><b class="cat-name">${esc(c.name)}</b>${kids.length ? `<div class="cat-meta"><button type="button" class="legend-btn" data-act="toggle-cat" data-id="${c.id}" aria-expanded="${isOpen}">${__(kids.length === 1 ? '{n} sub-category' : '{n} sub-categories', { n: kids.length })} <span class="chev" aria-hidden="true">›</span></button></div>` : ''}</div>
      <div class="tools"><button class="btn secondary" data-act="add-cat" data-parent="${c.id}">${__('+ Sub')}</button><button class="btn secondary" data-act="edit-cat" data-id="${c.id}">${__('Edit')}</button></div></div>`
      + (isOpen ? kids.map((k) => `<div class="brow indent cat-row">${tile(k, true)}<div class="cat-main"><b class="cat-name">${esc(k.name)}</b></div><div class="tools"><button class="btn secondary" data-act="edit-cat" data-id="${k.id}">${__('Edit')}</button></div></div>`).join('') : '');
  };
  // expenses and income are separate groups; on phones each shows its first 5 with See more / Show less
  const section = (type, label, color) => {
    const roots = D().categories.filter((c) => !c.parent_id && !c.archived && c.type === type); if (!roots.length) return '';
    const more = !!state.ui['more_cat-' + type], rest = roots.length - 5;
    return `<div class="cat-sec cat-sec-${type}"><div class="cat-sec-h"><i style="background:${color}"></i><b>${label}</b><span class="muted">${roots.length}</span></div>
      <div class="cat-list ${more ? '' : 'collapsed'}">${roots.map((c, n) => (n >= 5 ? row(c).replace('<div class="brow cat-row">', '<div class="brow cat-row more-item">') : row(c))).join('')}
      ${rest > 0 ? `<button type="button" class="see-more" data-act="toggle-more" data-key="cat-${type}" aria-expanded="${more}">${more ? __('Show less') : __('See more ({n})', { n: rest })}<span class="chev" aria-hidden="true">${more ? '⌃' : '⌄'}</span></button>` : ''}</div></div>`;
  };
  return `<section class="card"><div class="card-head"><h2>${__('Categories')}</h2><div class="tools">${D().categories.some((c) => c.archived) ? `<button class="chip" data-act="archived-cats">${__('Archived')}</button>` : ''}<button class="btn" data-act="add-cat">${__('+ Category')}</button></div></div>
    ${section('expense', __('Expense'), '#E5484D')}${section('income', __('Income'), '#1fa971')}</section>`;
}
function viewSettings() {
  const p = D().profile;
  return `${topbar('Settings', 'Profile, currency and privacy')}
  <div class="stack">
  ${categoriesCard()}
  ${occasionsCard()}
  ${recurringCard()}
  <section class="card"><div class="card-head"><h2>${__('Profile')}</h2></div>
    <div class="form-row"><div>${__('Display name')}</div><div class="field"><input data-setting="name" value="${esc(p.name)}" aria-label="${__('Display name')}"></div></div>
    <div class="form-row"><div>${__('Reporting currency')}</div><div class="field"><select data-setting="currency" ${hhLocked()} aria-label="${__('Currency')}">${Object.keys(RATES).map((c) => `<option ${c === p.currency ? 'selected' : ''} data-list="${flagLabel(c)}">${c}</option>`).join('')}</select></div></div>
    <div class="form-row"><div>${__('Budget period starts on')}</div><div class="field"><select data-setting="period" ${hhLocked()} aria-label="${__('Budget period starts on')}">${Array.from({ length: 28 }, (_, n) => `<option value="${n + 1}" ${n + 1 === periodDay() ? 'selected' : ''}>${n === 0 ? __('Day 1 (calendar month)') : __('Day {n}', { n: n + 1 })}</option>`).join('')}</select></div></div>
    <div class="form-row"><div>${__('Language')}</div><div class="field"><select data-lang aria-label="${__('Language')}">${Object.entries(LANGS).map(([k, n]) => `<option value="${k}" ${k === LANG ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="form-row"><div>${__('Appearance')}</div><div class="field"><select data-theme-select aria-label="${__('Appearance')}">${[['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([k, n]) => `<option value="${k}" ${k === THEME ? 'selected' : ''}>${__(n)}</option>`).join('')}</select></div></div></section>
  <section class="card"><div class="card-head"><h2>${__('Smart tagging')}</h2></div>
    <div class="form-row"><div>${__('AI category suggestions')}</div><label class="switch"><input type="checkbox" data-setting="ai" ${p.ai ? 'checked' : ''} aria-label="${__('AI tagging')}"></label></div></section>
  ${householdCard()}
  <section class="card"><div class="card-head"><h2>${__('Account')}</h2></div>
    <div class="form-row"><div>${__('Signed in as')}<small>${esc(state.auth.email)}</small></div><span class="badge ok">${__('Active now')}</span></div>
    <div class="form-row"><div>${__('Sign out')}</div><button class="btn secondary" data-act="signout">${__('Sign out')}</button></div>
    <div class="form-row"><div>${__('Sign out everywhere else')}</div><button class="btn secondary" data-act="revoke">${__('Sign out others')}</button></div>
    <div class="form-row"><div>${__('Use sample data')}</div><label class="switch"><input type="checkbox" data-demo ${state.real ? 'checked' : ''} aria-label="${__('Use sample data')}"></label></div>
    ${p.sample ? `<div class="form-row"><div>${__('Sample data saved earlier')}</div><button class="btn danger" data-act="remove-sample">${__('Remove')}</button></div>` : ''}</section></div>`;
}

const GOOGLE_LOGO = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3A12 12 0 1 1 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7A20 20 0 1 0 44 24c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/><path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.5-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';
const authMsg = (a) => (a.error ? `<p class="auth-err" role="alert">${esc(__(a.error))}</p>` : '') + (a.notice ? `<p class="hint" role="status">${esc(__(a.notice))}</p>` : '');
/* Bot check (Cloudflare Turnstile). Dormant until a site key is set in config.js; the key must be set
   together with enabling CAPTCHA in Supabase, because Supabase then rejects requests without a token. */
const CAPTCHA_KEY = (window.STIVER || {}).TURNSTILE_SITE_KEY || '';
let captchaToken = '', captchaWidget = null, captchaLoading = false;
const captchaBox = () => (CAPTCHA_KEY ? '<div id="captcha" class="captcha"></div>' : '');
function mountCaptcha() {
  const box = $('#captcha'); if (!CAPTCHA_KEY || !box) return;
  const draw = () => {
    captchaLoading = false; captchaToken = '';
    try { if (captchaWidget !== null) window.turnstile.remove(captchaWidget); } catch { /* the old widget was already removed with the page */ }
    captchaWidget = window.turnstile.render(box, { sitekey: CAPTCHA_KEY, theme: 'light', callback: (t) => { captchaToken = t; }, 'expired-callback': () => { captchaToken = ''; }, 'error-callback': () => { captchaToken = ''; } });
  };
  if (window.turnstile) { draw(); return; }
  if (captchaLoading) return;
  captchaLoading = true;
  const sc = document.createElement('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.async = true; sc.onload = draw; sc.onerror = () => { captchaLoading = false; };
  document.head.appendChild(sc);
}
