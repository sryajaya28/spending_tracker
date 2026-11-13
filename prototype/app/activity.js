'use strict';
/* Stiver app: render(), the view table and the Activity screen (who added, edited or deleted what). Part of the former prototype/app.js; see docs/MAP.md. */
/* ---------- render ---------- */

/* ---------- Activity (Figma 51:176 / 51:477 / 51:638): who added, edited or deleted what, for 180 days; every member may read it ---------- */
const actState = { rows: null, who: '', type: 'all', loading: false, error: '' };
const ACT_TYPES = [['all', 'All'], ['create', 'Added'], ['update', 'Edited'], ['delete', 'Deleted'], ['balance', 'Balance']];
const ACT_THING = { transactions: 'Transaction', wallets: 'Account', debts: 'Debt', debt_payments: 'Payment', investment_accounts: 'Investment account', holdings: 'Asset', holding_events: 'Trade', budgets: 'Budget', categories: 'Category', occasions: 'Occasion', recurring_rules: 'Recurring entry' };
async function actLoad() {
  if (actState.loading) return; actState.loading = true; actState.error = ''; Analytics.track('activity_opened');
  try { actState.rows = (await Cloud.activity()).sort((a, b) => (a.at < b.at ? 1 : -1)); } catch (e) { actState.error = 'load'; actState.rows = actState.rows || []; }
  actState.loading = false; if (route() === 'activity') render();
}
const actKind = (r) => (r.summary && r.summary.balance_minor != null ? 'balance' : r.action);
function actLine(r) {
  const s = r.summary || {}, c = s.currency || D().profile.currency || 'IDR';
  const sign = s.type === 'expense' ? '−' : s.type === 'income' ? '+' : '';
  const t = new Date(r.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: false });
  const amt = (m) => (m == null ? '' : sign + money(m, c));
  const k = actKind(r);
  if (k === 'balance') return `${money(s.was_balance_minor, c)} → ${money(s.balance_minor, c)} · ${t}`;
  if (k === 'update') return [s.was_amount_minor != null ? __('was {amount}', { amount: amt(s.was_amount_minor) }) : '', t].filter(Boolean).join(' · ');
  return [amt(s.amount_minor), s.amount_minor != null ? c : '', t].filter(Boolean).join(' · ');
}
function actTitle(r) {
  const name = esc(hhFirstName(r.actor_name) || '?'), item = esc((r.summary && r.summary.name) || __(ACT_THING[r.entity] || 'Item'));
  const k = actKind(r);
  return k === 'create' ? __("{name} added '{item}'", { name, item }) : k === 'update' ? __("{name} edited '{item}'", { name, item }) : k === 'delete' ? __("{name} deleted '{item}'", { name, item }) : __("{name} changed the balance of '{item}'", { name, item });
}
function viewActivity() {
  if (actState.rows === null) { actLoad(); }
  const rows = actState.rows || [], me = Cloud.household;
  const people = [...new Map(rows.map((r) => [r.actor_id, hhFirstName(r.actor_name)])).entries()].filter(([id, n]) => id && n);
  const shown = rows.filter((r) => (!actState.who || r.actor_id === actState.who) && (actState.type === 'all' || actKind(r) === actState.type));
  const dayName = (iso) => { const d = new Date(iso), today = new Date(); const y = new Date(today); y.setDate(y.getDate() - 1); const same = (a, b) => a.toDateString() === b.toDateString(); return same(d, today) ? __('Today') : same(d, y) ? __('Yesterday') : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }); };
  let list = '', last = '';
  shown.forEach((r) => { const dn = dayName(r.at); if (dn !== last) { list += `<div class="act-day muted">${esc(dn)}</div>`; last = dn; } list += `<div class="act-row"><span class="avatar" aria-hidden="true">${esc((String(r.actor_name || '?').trim()[0] || '?').toUpperCase())}</span><div><b>${actTitle(r)}</b><small class="muted">${esc(actLine(r))}</small></div></div>`; });
  const who = actState.who ? hhFirstName((people.find(([id]) => id === actState.who) || [])[1]) : '';
  const typeName = __((ACT_TYPES.find((x) => x[0] === actState.type) || [])[1] || 'All').toLowerCase();
  const empty = actState.rows === null || actState.loading ? `<p class="muted">${__('Loading…')}</p>` : actState.error ? `<div class="card"><h3>${__("Couldn't load Activity")}</h3><p class="muted">${__('Check your connection and try again.')}</p><button class="btn secondary" data-act="act-retry">${__('Try again')}</button></div>`
    : !rows.length ? `<div class="card"><h3>${__('No activity yet')}</h3><p class="muted">${__('Adds, edits, deletes and balance changes by anyone in the household show up here for 180 days.')}</p></div>`
    : !shown.length ? `<div class="card"><h3>${__('Nothing here')}</h3><p class="muted">${__('No {type} {by} in the last 180 days. Try another person or type.', { type: typeName, by: who ? __('by {name}', { name: esc(who) }) : '' })}</p></div>` : '';
  return `${topbar('Activity', me.role === 'viewer' ? 'View only' : 'Last 180 days')}
    ${me.role === 'viewer' ? `<p class="muted">${__('Viewers can read Activity; nothing on it can be changed.')}</p>` : ''}
    ${people.length > 1 ? `<div class="act-chips"><button type="button" class="chip${actState.who ? '' : ' on'}" data-act="act-who" data-id="">${__('Everyone')}</button>${people.map(([id, n]) => `<button type="button" class="chip${actState.who === id ? ' on' : ''}" data-act="act-who" data-id="${esc(id)}">${esc(n)}</button>`).join('')}</div>` : ''}
    <div class="act-chips">${ACT_TYPES.map(([k, l]) => `<button type="button" class="chip${actState.type === k ? ' on' : ''}" data-act="act-type" data-type="${k}">${__(l)}</button>`).join('')}</div>
    ${list ? `<section class="card act-list">${list}</section>` : empty}`;
}
/* a Viewer sees no write controls (PRD check 17): buttons that start a change are removed after every render; rows that only open a read-only detail stay.
   The raised Add button is not drawn at all for a Viewer (see bottomNav), so the bar has four equal tabs. The database refuses writes anyway; this is the screen telling the truth. */
function hideWriteControls() {
  if (canWrite()) return;
  document.querySelectorAll('#app button[data-act]').forEach((b) => {
    const act = b.dataset.act; if (!WRITE_ACT.test(act) || act === 'edit-txn') return;
    b.remove();
  });
}
const VIEWS = { activity: viewActivity, overview: viewOverview, transactions: () => (/^\d{4}-\d{2}-\d{2}$/.test(routeArg()) ? viewDay(routeArg()) : viewTransactions()), budgets: viewBudgets, portfolio: viewPortfolio, settings: viewSettings };
function render() {
  const app = $('#app');
  const a = state.auth;
  if (joinState) { app.innerHTML = viewJoin(); return; }   // /join works signed out, and signed in as someone else
  if (a.status === 'loading') { app.innerHTML = viewSplash('Waking up Stiver…'); return; }
  if (a.status === 'out' && a.view === 'landing') { app.innerHTML = viewLanding(); return; }
  if (a.status === 'out' || a.view === 'recovery') { app.innerHTML = viewAuth(); mountCaptcha(); return; }
  if (!D() && a.noAccess) { app.innerHTML = viewNoAccess(); return; }
  if (!D()) {
    app.innerHTML = a.loadError
      ? `<div class="onboard"><div class="card"><div class="logo"><img src="icon.svg" alt="">Stiver</div><p class="auth-err" role="alert">${__("Couldn't load your data: {error}", { error: esc(a.loadError) })}</p><button class="btn lg" data-act="retry-load">${__('Try again')}</button><button class="btn secondary lg" data-act="signout">${__('Sign out')}</button></div></div>`
      : viewSplash('Fetching your finances…');
    return;
  }
  if (state.ui.monthSrc !== periodDay()) { state.ui.month = currentPeriod(); state.ui.monthSrc = periodDay(); state.ui.allPeriods = false; }   // a new start day (or switching demo/real data) re-selects the current period
  const r = VIEWS[route()] ? route() : 'overview';
  app.innerHTML = `<div class="shell">${sidebar()}<main class="main${r === 'settings' ? ' no-nav' : ''}">${state.real ? demoBar() : ''}${VIEWS[r]()}</main></div>${r === 'settings' ? '' : bottomNav()}`;   // Settings has no bottom bar: its own back arrow leads out
  hideWriteControls();
  if (r === 'portfolio' && state.chart && $('#pf')) bindValue(state.chart.months, state.chart.series, state.chart.vc);
  if (r === 'portfolio' && state.chart2 && $('#pnl')) bindValue(state.chart2.months, state.chart2.series, state.chart2.vc, { id: 'pnl', neg: true });   // the asset page (#/portfolio/<id>) has no value chart
  if (r === 'overview') {
    const months = lastMonths(6);
    bindFlow(months, months.map((m) => sumBy(inMonth(m), 'income')), months.map((m) => sumBy(inMonth(m), 'expense')));
  }
}

