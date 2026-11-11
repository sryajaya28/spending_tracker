'use strict';
/* Stiver app: selectors that mirror the SQL functions (balances, budgets, category tree). Part of the former prototype/app.js; see docs/MAP.md. */
/* ---------- selectors (mirror the SQL functions) ---------- */
const D = () => state.data;
const cur = () => D().profile.currency;
const occasionOf = (id) => D().occasions.find((o) => o.id === id);
/* special-occasion budgets: a one-off amount; spent = expenses tagged to it (converted to the reporting currency) */
// an occasion shows in the periods its dates span, while it is upcoming or ongoing (it has not ended yet), and in any period with an expense tagged to it; undated ones show every month
const occasionInMonth = (o, k) => !o.start || (o.start <= periodEnd(k) && (o.end || o.start) >= periodStart(k)) || (o.end || o.start) >= todayIso() || D().transactions.some((t) => t.occasion_id === o.id && inPeriod(t.occurred_at, k));
function occasionStatus() {
  return D().occasions.map((o) => {
    const txns = D().transactions.filter((t) => t.occasion_id === o.id && t.type === 'expense' && t.occurred_at <= todayIso());
    const hasBudget = o.amount_minor > 0, budget = hasBudget ? convert(o.amount_minor, o.currency, cur()) : 0, spent = txns.reduce((a, t) => a + amt(t), 0), pct = hasBudget ? (spent * 100) / budget : 0;
    return { ...o, hasBudget, count: txns.length, budget, spent, remaining: budget - spent, pct, status: hasBudget && spent > budget ? 'exceeded' : pct >= 80 ? 'warning' : 'ok' };   // an occasion may have no budget: it only groups expenses
  });
}
const catOf = (id) => D().categories.find((c) => c.id === id);
const walletOf = (id) => D().wallets.find((w) => w.id === id);
const inMonth = (k) => D().transactions.filter((t) => inPeriod(t.occurred_at, k) && t.occurred_at <= todayIso());   // money not yet received or spent is left out of every total
/* a transaction's amount in the reporting currency (each wallet keeps its own currency) */
const amt = (t) => convert(t.amount_minor, t.currency, cur());
/* the loss on selling an investment is recorded as an expense (Investment Loss) so it reduces the account, and it counts as spending everywhere (totals, breakdown, trend, the Transactions page), except that budgets leave it out */
const isInvestLoss = (t) => { if (t.type !== 'expense' || !t.category_id) return false; const c = catOf(t.category_id); return !!c && c.name.trim().toLowerCase() === 'investment loss'; };
const sumBy = (list, type) => list.filter((t) => t.type === type).reduce((a, t) => a + amt(t), 0);

/* signed cash effect of a transaction on its wallet. A 'transfer' (e.g. buying/selling an asset) moves
   money in or out without being income or spending, so budgets and monthly totals ignore it. */
const cashSign = (t) => (t.type === 'income' || (t.type === 'transfer' && t.flow === 'in') ? 1 : t.type === 'expense' || (t.type === 'transfer' && t.flow === 'out') ? -1 : 0);
/* anything dated after today has not happened yet: it changes no balance, wallet or holding, until its day */
const todayIso = () => isoDate(new Date());
function walletBalance(w) {
  const today = todayIso();
  return w.opening_balance_minor + D().transactions.filter((t) => t.wallet_id === w.id && t.occurred_at <= today).reduce((a, t) => a + cashSign(t) * t.amount_minor, 0);
}
const savingsTotal = () => D().wallets.filter((w) => !w.archived).reduce((a, w) => a + convert(walletBalance(w), w.currency, cur()), 0);
/* Total Balance on Overview = savings + investments (money lent and loans are not included; Portfolio > Net worth covers them) */
const totalBalance = () => savingsTotal() + usdToMinor(portfolioUSD(currentPeriod()), cur());
/* A wallet counts from the month it starts (w.since): its opening balance and its transactions do not
   appear in earlier months, so money added later never inflates past months. */
function balanceAtEnd(k) {
  const end = [periodEnd(k), todayIso()].sort()[0], live = D().wallets.filter((w) => !w.archived && liveIn(w.since, k)), ids = new Set(live.map((w) => w.id));
  return live.reduce((a, w) => a + convert(w.opening_balance_minor, w.currency, cur()), 0)
    + D().transactions.filter((t) => t.occurred_at <= end && ids.has(t.wallet_id)).reduce((a, t) => a + cashSign(t) * amt(t), 0);
}
/* sub-categories roll up into their parent everywhere totals are shown */
const rootOf = (id) => { const c = catOf(id); return c && c.parent_id ? c.parent_id : id; };
const catPath = (id) => { const c = catOf(id); const p = c && c.parent_id && catOf(c.parent_id); return c ? (p ? `${p.name} › ${c.name}` : c.name) : 'No category'; };
const childrenOf = (id) => D().categories.filter((c) => c.parent_id === id && !c.archived);
/* active categories flattened parent-first, each parent followed by its sub-categories */
const catTree = (type) => D().categories.filter((c) => !c.parent_id && !c.archived && (!type || c.type === type)).flatMap((p) => [p, ...childrenOf(p.id)]);

/* month spend per top-level category, each with its sub-category breakdown */
function spendTree(k) {
  const tree = new Map();
  inMonth(k).filter((t) => t.type === 'expense').forEach((t) => {
    const root = t.category_id ? rootOf(t.category_id) : null;
    if (!tree.has(root)) tree.set(root, { id: root, value: 0, direct: 0, subs: new Map() });
    const n = tree.get(root); n.value += amt(t);
    if (t.category_id && t.category_id !== root) n.subs.set(t.category_id, (n.subs.get(t.category_id) || 0) + amt(t));
    else n.direct += amt(t);
  });
  return [...tree.values()].map((n) => {
    const c = catOf(n.id);
    return { id: n.id, name: c ? c.name : __('Uncategorized'), color: c ? c.color : '#CBD0E8', icon: c ? c.icon : '❔', value: n.value, direct: n.direct,
      subs: [...n.subs].map(([sid, value]) => ({ id: sid, name: catOf(sid)?.name || '?', icon: catOf(sid)?.icon || '•', value })).sort((a, b) => b.value - a.value) };
  }).sort((a, b) => b.value - a.value);
}
const spendByCategory = spendTree;
function budgetStatus(k) {
  const scopes = new Map();
  D().budgets.filter((b) => b.start_month.slice(0, 7) <= k).sort((a, b) => b.start_month.localeCompare(a.start_month)).forEach((b) => { if (!scopes.has(b.category_id)) scopes.set(b.category_id, b); });
  const txns = inMonth(k).filter((t) => t.type === 'expense' && !isInvestLoss(t));
  return [...scopes.values()].map((b) => {
    const spent = txns.filter((t) => b.category_id === null || (t.category_id && rootOf(t.category_id) === b.category_id)).reduce((a, t) => a + amt(t), 0);
    const pct = (spent * 100) / b.amount_minor;
    const status = spent > b.amount_minor ? 'exceeded' : pct >= 80 ? 'warning' : 'ok';
    const c = catOf(b.category_id);
    return { id: b.id, category_id: b.category_id, name: c ? c.name : __('All spending'), icon: c ? c.icon : '💰', color: c ? c.color : '#4A44C6', budget: b.amount_minor, spent, remaining: b.amount_minor - spent, pct, status, start_month: b.start_month };
  }).sort((a, b) => (a.category_id === null ? -1 : b.category_id === null ? 1 : a.name.localeCompare(b.name)));
}

