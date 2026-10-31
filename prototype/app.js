'use strict';
/* Stiver app. Signed-in users' data lives in Supabase (see cloud.js); the UI works on the in-memory
   object state.data and save() syncs changes. Money is kept in integer minor units, like the DB schema. */

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
// units of currency per 1 USD (mock; the real app reads these from the fx_rates table)
const RATES = { IDR: 15500, USD: 1, EUR: 0.92, GBP: 0.79, SGD: 1.35, AUD: 1.5, JPY: 150 };
const PRICES_KEY = 'stiver.prices.v1';   // last live prices, only to avoid a flash of 0 on load

const expOf = (cur) => new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits;
const toMinor = (major, cur) => Math.round(major * 10 ** expOf(cur));
const toMajor = (minor, cur) => minor / 10 ** expOf(cur);
const money = (minor, cur) => new Intl.NumberFormat('en', { style: 'currency', currency: cur }).format(toMajor(minor, cur));
const convert = (minor, from, to) => (from === to ? minor : Math.round((toMajor(minor, from) / RATES[from]) * RATES[to] * 10 ** expOf(to)));
const usdToMinor = (usd, cur) => toMinor(usd * RATES[cur], cur);
const compact = (minor, cur) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(toMajor(minor, cur));
function moneyHtml(minor, cur) {
  return new Intl.NumberFormat('en', { style: 'currency', currency: cur }).formatToParts(toMajor(minor, cur))
    .map((p) => (p.type === 'fraction' || p.type === 'decimal' ? `<span class="dim">${p.value}</span>` : esc(p.value))).join('');
}

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const monthLabel = (k, style = 'long') => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString('en', style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' });
const lastMonths = (n) => { const t = new Date(); return Array.from({ length: n }, (_, i) => monthKey(new Date(t.getFullYear(), t.getMonth() - (n - 1 - i), 1))); };

/* ---------- icons ---------- */
const ICON = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  swap: '<path d="M7 4v16M7 4L3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4"/>',
  pie: '<path d="M12 3v9h9A9 9 0 1 1 12 3z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1zM16 14h2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

/* ---------- mock data / store ---------- */
const CATS = [
  ['Groceries', 'expense', '🛒', '#4A44C6'], ['Dining', 'expense', '🍽️', '#8B8FF0'], ['Transport', 'expense', '🚌', '#F5B800'],
  ['Shopping', 'expense', '🛍️', '#EC4899'], ['Bills & Utilities', 'expense', '🧾', '#14B8A6'], ['Entertainment', 'expense', '🎬', '#F97316'],
  ['Health', 'expense', '🩺', '#EF4444'], ['Travel', 'expense', '✈️', '#0EA5E9'], ['Other', 'expense', '⋯', '#94A3B8'],
  ['Salary', 'income', '💼', '#22C55E'], ['Freelance', 'income', '💻', '#84CC16'], ['Other income', 'income', '➕', '#94A3B8'],
];
// [category, per-month count, min USD, max USD, notes]
const EXPENSE_PLAN = [
  ['Groceries', 4, 28, 95, ['Whole Foods', 'Trader Joes', 'Local market']],
  ['Dining', 7, 7, 48, ['Coffee shop', 'Lunch with team', 'Pizza night', 'Sushi bar']],
  ['Transport', 6, 3, 28, ['Metro card', 'Uber ride', 'Gas station']],
  ['Shopping', 2, 18, 120, ['Online order', 'Clothes', 'Home goods']],
  ['Bills & Utilities', 2, 35, 90, ['Electric bill', 'Internet', 'Phone plan']],
  ['Entertainment', 2, 9, 40, ['Cinema', 'Streaming', 'Concert tickets']],
  ['Health', 1, 20, 60, ['Pharmacy', 'Gym membership']],
];

// one level of sub-categories under a parent; transactions may point at either
const SUBS = {
  Groceries: [['Supermarket', '🏬'], ['Fresh market', '🥬']],
  Dining: [['Coffee', '☕'], ['Restaurants', '🍴'], ['Delivery', '🛵']],
  Transport: [['Fuel', '⛽'], ['Ride-hailing', '🚕'], ['Public transit', '🚇']],
  Entertainment: [['Movies', '🎬'], ['Streaming', '📺'], ['Events', '🎟️']],
};
const NOTE_SUB = {
  'Whole Foods': 'Groceries/Supermarket', 'Trader Joes': 'Groceries/Supermarket', 'Local market': 'Groceries/Fresh market',
  'Coffee shop': 'Dining/Coffee', 'Lunch with team': 'Dining/Restaurants', 'Sushi bar': 'Dining/Restaurants', 'Pizza night': 'Dining/Delivery',
  'Gas station': 'Transport/Fuel', 'Uber ride': 'Transport/Ride-hailing', 'Metro card': 'Transport/Public transit',
  Cinema: 'Entertainment/Movies', Streaming: 'Entertainment/Streaming', 'Concert tickets': 'Entertainment/Events',
};

/* mock price catalog: [symbol, name, type, current USD price, monthly volatility].
   The real app reads these from price_snapshots (filled by a daily job from Finnhub / CoinGecko). */
const CATALOG = [
  ['BTC', 'Bitcoin', 'crypto', 67000, 0.12], ['ETH', 'Ethereum', 'crypto', 3400, 0.13], ['SOL', 'Solana', 'crypto', 160, 0.18],
  ['USDT', 'Tether', 'stablecoin', 1, 0.0006], ['USDC', 'USD Coin', 'stablecoin', 1, 0.0006],
  ['AAPL', 'Apple', 'stock', 225, 0.05], ['MSFT', 'Microsoft', 'stock', 420, 0.045], ['NVDA', 'NVIDIA', 'stock', 130, 0.1], ['TSLA', 'Tesla', 'stock', 250, 0.12],
  ['VOO', 'Vanguard S&P 500 ETF', 'etf', 520, 0.03], ['VTI', 'Vanguard Total Market ETF', 'etf', 280, 0.03], ['QQQ', 'Invesco QQQ ETF', 'etf', 480, 0.04], ['SPY', 'SPDR S&P 500 ETF', 'etf', 570, 0.03],
];
const TYPE_COLOR = { crypto: '#F5B800', stablecoin: '#14B8A6', stock: '#4A44C6', etf: '#8B8FF0', manual: '#94A3B8' };
const SERIES = {};
function priceSeries(sym) {
  if (SERIES[sym]) return SERIES[sym];
  const row = CATALOG.find((c) => c[0] === sym);
  let s = [...sym].reduce((a, c) => a + c.charCodeAt(0) * 31, 7) % 2147483646 + 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const out = Array(6).fill(row[3]);
  for (let i = 4; i >= 0; i--) out[i] = out[i + 1] / (1 + 0.03 + (rnd() - 0.5) * row[4]);
  return (SERIES[sym] = out);
}
/* Asset info by unique key. Built-in catalog assets keep a mock history, but their current-month price
   is the live Finnhub price when we have one. Assets picked from Finnhub's full list (or typed in
   by hand) are priced flat from livePrices / the manual price. */
const assetInfo = (key) => {
  const live = D().livePrices?.[key], thisMonth = monthKey(new Date());
  const c = CATALOG.find((x) => x[0] === key);
  if (c) return { key, symbol: key, name: c[1], type: c[2], usd: (k) => (k === thisMonth && live > 0 ? live : priceSeries(key)[Math.max(0, lastMonths(6).indexOf(k))]) };
  const m = D().customAssets[key] || { name: key, type: 'manual', price: 0 };
  return { key, symbol: m.symbol || key, name: m.name, type: m.type, fh: m.fh, usd: () => (live > 0 ? live : m.price || 0) };
};

/* Finnhub proxy (tools/dev_server.py). Without it the picker falls back to the built-in catalog. */
const api = { finnhub: false, fx: null };
async function getJSON(url) {
  const r = await fetch(url); const j = await r.json();
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
async function searchAssets(q, type) {
  if (api.finnhub) return (await getJSON(`/api/assets?q=${encodeURIComponent(q)}&type=${type}&limit=25`)).results;
  const ql = q.toUpperCase();
  return CATALOG.filter((c) => (!type || (type === 'crypto' ? ['crypto', 'stablecoin'] : ['stock', 'etf']).includes(c[2])) && (c[0].includes(ql) || c[1].toUpperCase().includes(ql)))
    .map((c) => ({ key: c[0], symbol: c[0], name: c[1], type: c[2] }));
}
const priceClass = (type) => (type === 'crypto' || type === 'stablecoin' ? 'crypto' : 'stock');
async function quote(a) {
  return (await getJSON(`/api/price?symbol=${encodeURIComponent(a.symbol)}&type=${priceClass(a.type)}&fh=${encodeURIComponent(a.fh || '')}`)).price;
}
async function refreshPrices(silent) {
  if (!api.finnhub) { if (!silent) toast('Live prices need the dev server and a Finnhub key'); return; }
  const keys = [...new Set(D().holdings.map((h) => h.symbol))]; let ok = 0;
  for (const key of keys) {
    const info = assetInfo(key);
    try { D().livePrices[key] = await quote(info); ok++; } catch { /* keep the previous price */ }
  }
  save(); if (route() === 'portfolio') render();
  if (!silent) toast(`Updated ${ok} of ${keys.length} prices`);
}

function seed(name, cur) {
  let s = 11;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const conv = (usd) => { let v = usd * RATES[cur]; if (v > 100000) v = Math.round(v / 1000) * 1000; return toMinor(v, cur); };
  const catId = {};
  const categories = CATS.map(([n, type, ic, color]) => { const id = uid(); catId[n] = id; return { id, parent_id: null, name: n, type, icon: ic, color, archived: false }; });
  CATS.forEach(([n, type, , color]) => (SUBS[n] || []).forEach(([sn, sic]) => {
    const id = uid(); catId[`${n}/${sn}`] = id;
    categories.push({ id, parent_id: catId[n], name: sn, type, icon: sic, color, archived: false });
  }));
  const wsince = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1));   // sample history starts 5 months back
  const wallets = [
    { id: uid(), name: 'Cash', type: 'cash', currency: cur, opening_balance_minor: conv(1200), since: wsince, archived: false },
    { id: uid(), name: 'Main Bank', type: 'bank', currency: cur, opening_balance_minor: conv(2400), since: wsince, archived: false },
    { id: uid(), name: 'E-Wallet', type: 'ewallet', currency: cur, opening_balance_minor: conv(900), since: wsince, archived: false },
    // a wallet in another currency, to show multi-currency wallets
    { id: uid(), name: `${cur === 'USD' ? 'EUR' : 'USD'} Savings`, type: 'bank', currency: cur === 'USD' ? 'EUR' : 'USD', opening_balance_minor: toMinor(cur === 'USD' ? 2000 : 3000, cur === 'USD' ? 'EUR' : 'USD'), since: wsince, archived: false },
  ];
  const today = new Date();
  const txns = [];
  const push = (cat, type, date, usd, note) => {
    if (date > today) return;
    const w = type === 'income' || rnd() < 0.8 ? wallets[1] : wallets[rnd() < 0.5 ? 0 : 2];
    txns.push({ id: uid(), wallet_id: w.id, category_id: cat ? catId[NOTE_SUB[note]] || catId[cat] : null, type, amount_minor: conv(usd), currency: cur, occurred_at: isoDate(date), note, category_source: 'user', ai_confidence: null });
  };
  for (let back = 5; back >= 0; back--) {
    const y = today.getFullYear(), m = today.getMonth() - back;
    push('Salary', 'income', new Date(y, m, 25), 4200, 'Monthly salary');
    if (back % 2 === 0) push('Freelance', 'income', new Date(y, m, 12), 450 + Math.round(rnd() * 300), 'Design project');
    for (const [cat, n, lo, hi, notes] of EXPENSE_PLAN) {
      for (let i = 0; i < n; i++) {
        const day = 1 + Math.floor(rnd() * 27);
        push(cat, 'expense', new Date(y, m, day), Math.round(lo + rnd() * (hi - lo)), notes[Math.floor(rnd() * notes.length)]);
      }
    }
  }
  txns.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  // show the AI states: a few AI-tagged rows and two uncategorized fallbacks
  txns.filter((t) => t.type === 'expense').slice(2, 9).forEach((t, i) => { if (i % 3 === 0) { t.category_source = 'ai'; t.ai_confidence = 0.86; } });
  txns.filter((t) => t.type === 'expense').slice(0, 2).forEach((t) => { t.category_id = null; t.note = 'Card payment'; });
  const start = monthKey(new Date(today.getFullYear(), today.getMonth() - 5, 1)) + '-01';
  const mk = (cat, usd) => ({ id: uid(), category_id: cat ? catId[cat] : null, amount_minor: conv(usd), currency: cur, start_month: start });
  const budgets = [mk(null, 1500), mk('Groceries', 340), mk('Dining', 190), mk('Transport', 110), mk('Shopping', 150), mk('Entertainment', 70)];
  // investment accounts, each holding several assets (quantities only; value comes from prices)
  const since = monthKey(new Date(today.getFullYear(), today.getMonth() - 5, 1));
  const exch = { id: uid(), name: 'Crypto Exchange', archived: false }, broker = { id: uid(), name: 'US Brokerage', archived: false };
  const h = (a, symbol, quantity) => ({ id: uid(), account_id: a.id, symbol, quantity, since, trades: [] });
  const holdings = [h(exch, 'BTC', 0.085), h(exch, 'USDT', 1200), h(exch, 'ETH', 0.9), h(broker, 'VOO', 4.2), h(broker, 'AAPL', 6), h(broker, 'NVDA', 3)];
  // loans: debts you owe. Balance = original - payments, so earlier months can be rebuilt.
  const payments = (monthly, n) => Array.from({ length: n }, (_, i) => ({ id: uid(), date: isoDate(new Date(today.getFullYear(), today.getMonth() - (n - 1 - i), 5)), amount_minor: monthly }));
  const loans = [
    { id: uid(), name: 'Car loan', type: 'car', currency: cur, original_minor: conv(14000), monthly_minor: conv(380), rate: 6.5, since, archived: false, payments: payments(conv(380), 6) },
    { id: uid(), name: 'Credit card', type: 'card', currency: cur, original_minor: conv(900), monthly_minor: conv(150), rate: 0, since, archived: false, payments: payments(conv(150), 3) },
  ];
  const lent = [{ id: uid(), name: 'Budi', currency: cur, original_minor: conv(300), note: 'Laptop repair', due: isoDate(new Date(today.getFullYear(), today.getMonth() + 2, 1)), since: monthKey(new Date(today.getFullYear(), today.getMonth() - 3, 1)), archived: false, payments: [{ id: uid(), date: isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 12)), amount_minor: conv(100) }] }];
  return { profile: { name, currency: cur, ai: true }, categories, wallets, transactions: txns, budgets, occasions: [], investments: [exch, broker], holdings, customAssets: {}, livePrices: {}, loans, lent };
}

const state = { data: null, auth: { status: 'loading', view: 'signin', email: '', notice: '', error: '' }, ui: { month: monthKey(new Date()), q: '', cat: '', wallet: '', catsOpen: false, openCats: new Set(), archOpen: false } };
function loadPrices() { try { return JSON.parse(localStorage.getItem(PRICES_KEY)) || {}; } catch { return {}; } }
function save() {
  try { localStorage.setItem(PRICES_KEY, JSON.stringify(state.data.livePrices)); } catch { /* storage unavailable */ }
  Cloud.save(state.data);   // sends only what changed since the last save
}

/* ---------- selectors (mirror the SQL functions) ---------- */
const D = () => state.data;
const cur = () => D().profile.currency;
const occasionOf = (id) => D().occasions.find((o) => o.id === id);
/* special-occasion budgets: a one-off amount; spent = expenses tagged to it (converted to the reporting currency) */
function occasionStatus() {
  return D().occasions.map((o) => {
    const txns = D().transactions.filter((t) => t.occasion_id === o.id && t.type === 'expense');
    const budget = convert(o.amount_minor, o.currency, cur()), spent = txns.reduce((a, t) => a + amt(t), 0), pct = (spent * 100) / budget;
    return { ...o, count: txns.length, budget, spent, remaining: budget - spent, pct, status: spent > budget ? 'exceeded' : pct >= 80 ? 'warning' : 'ok' };
  });
}
const catOf = (id) => D().categories.find((c) => c.id === id);
const walletOf = (id) => D().wallets.find((w) => w.id === id);
const inMonth = (k) => D().transactions.filter((t) => t.occurred_at.startsWith(k));
/* a transaction's amount in the reporting currency (each wallet keeps its own currency) */
const amt = (t) => convert(t.amount_minor, t.currency, cur());
const sumBy = (list, type) => list.filter((t) => t.type === type).reduce((a, t) => a + amt(t), 0);

/* signed cash effect of a transaction on its wallet. A 'transfer' (e.g. buying/selling an asset) moves
   money in or out without being income or spending, so budgets and monthly totals ignore it. */
const cashSign = (t) => (t.type === 'income' || (t.type === 'transfer' && t.flow === 'in') ? 1 : t.type === 'expense' || (t.type === 'transfer' && t.flow === 'out') ? -1 : 0);
function walletBalance(w) {
  return w.opening_balance_minor + D().transactions.filter((t) => t.wallet_id === w.id).reduce((a, t) => a + cashSign(t) * t.amount_minor, 0);
}
const totalBalance = () => D().wallets.filter((w) => !w.archived).reduce((a, w) => a + convert(walletBalance(w), w.currency, cur()), 0);
/* A wallet counts from the month it starts (w.since): its opening balance and its transactions do not
   appear in earlier months, so money added later never inflates past months. */
function balanceAtEnd(k) {
  const end = `${k}-31`, live = D().wallets.filter((w) => !w.archived && (w.since || '0000-00') <= k), ids = new Set(live.map((w) => w.id));
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
    return { id: n.id, name: c ? c.name : 'Uncategorized', color: c ? c.color : '#CBD0E8', icon: c ? c.icon : '❔', value: n.value, direct: n.direct,
      subs: [...n.subs].map(([sid, value]) => ({ id: sid, name: catOf(sid)?.name || '?', icon: catOf(sid)?.icon || '•', value })).sort((a, b) => b.value - a.value) };
  }).sort((a, b) => b.value - a.value);
}
const spendByCategory = spendTree;
function budgetStatus(k) {
  const scopes = new Map();
  D().budgets.filter((b) => b.start_month.slice(0, 7) <= k).sort((a, b) => b.start_month.localeCompare(a.start_month)).forEach((b) => { if (!scopes.has(b.category_id)) scopes.set(b.category_id, b); });
  const txns = inMonth(k).filter((t) => t.type === 'expense');
  return [...scopes.values()].map((b) => {
    const spent = txns.filter((t) => b.category_id === null || (t.category_id && rootOf(t.category_id) === b.category_id)).reduce((a, t) => a + amt(t), 0);
    const pct = (spent * 100) / b.amount_minor;
    const status = spent > b.amount_minor ? 'exceeded' : pct >= 80 ? 'warning' : 'ok';
    const c = catOf(b.category_id);
    return { id: b.id, category_id: b.category_id, name: c ? c.name : 'All spending', icon: c ? c.icon : '💰', color: c ? c.color : '#4A44C6', budget: b.amount_minor, spent, remaining: b.amount_minor - spent, pct, status, start_month: b.start_month };
  }).sort((a, b) => (a.category_id === null ? -1 : b.category_id === null ? 1 : a.name.localeCompare(b.name)));
}

/* ---------- portfolio (investments), valued in USD then shown in a chosen currency ---------- */
const activeAccounts = () => D().investments.filter((a) => !a.archived);
const holdingsOf = (accId) => D().holdings.filter((h) => h.account_id === accId);
/* buys/sells: each trade moves quantity and cash together. Quantity at a month end is today's
   quantity minus the trades that happen after that month. */
const tradeSign = (tr) => (tr.side === 'buy' ? 1 : -1);
const r12 = (x) => Math.round(x * 1e12) / 1e12;   // keep quantities free of floating-point dust
const qtyAt = (h, k) => h.quantity - h.trades.filter((tr) => tr.date > `${k}-31`).reduce((a, tr) => a + tradeSign(tr) * tr.quantity, 0);
const holdingUSD = (h, k) => (k < h.since ? 0 : Math.max(0, qtyAt(h, k)) * assetInfo(h.symbol).usd(k));
const portfolioUSD = (k, accId) => D().holdings
  .filter((h) => (accId ? h.account_id === accId : activeAccounts().some((a) => a.id === h.account_id)))
  .reduce((a, h) => a + holdingUSD(h, k), 0);
const qtyFmt = (q) => new Intl.NumberFormat('en', { maximumFractionDigits: 8 }).format(q);
const pctFmt = (p) => (p === null ? '—' : `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`);
const pf = () => state.ui.pf || cur();

/* ---------- savings, loans and net worth (everything is compared in USD, shown in a chosen currency) ---------- */
const toUSD = (minor, c) => toMajor(minor, c) / RATES[c];
const savingsUSD = (k) => toUSD(balanceAtEnd(k), cur());
const activeLoans = () => D().loans.filter((l) => !l.archived);
const paidOf = (l, upto) => l.payments.filter((p) => !upto || p.date <= upto).reduce((a, p) => a + p.amount_minor, 0);
const loanBalance = (l, upto) => Math.max(0, l.original_minor - paidOf(l, upto));
const loanUSD = (k) => activeLoans().reduce((a, l) => (k < l.since ? a : a + toUSD(loanBalance(l, `${k}-31`), l.currency)), 0);
/* money you lent out: shares the loan shape (original amount + payments received) but counts as an asset */
const activeLent = () => D().lent.filter((l) => !l.archived);
const lentUSD = (k) => activeLent().reduce((a, l) => (k < l.since ? a : a + toUSD(loanBalance(l, `${k}-31`), l.currency)), 0);
const LOAN_TYPES = { mortgage: 'Mortgage', car: 'Car loan', card: 'Credit card', personal: 'Personal loan', other: 'Other' };

/* mock of the AI tagging described in the plan: history match first, null when unsure */
function aiTag(note, type) {
  if (!D().profile.ai || !note) return null;
  const labeled = D().transactions.filter((t) => t.category_id && t.type === type && t.note);
  if (labeled.length < 30) return null;
  const norm = (x) => x.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const n = norm(note);
  const hits = labeled.filter((t) => norm(t.note) === n);
  if (hits.length < 3) return null;
  const counts = {};
  hits.forEach((t) => { counts[t.category_id] = (counts[t.category_id] || 0) + 1; });
  const [id, c] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return c / hits.length >= 0.8 ? { category_id: id, confidence: Math.min(0.99, (c / hits.length) * 0.95) } : null;
}

/* ---------- ui helpers ---------- */
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}
const tile = (c, sm) => `<span class="tile ${sm ? 'sm' : ''}" style="--c:${c ? c.color : '#94A3B8'}">${c ? c.icon : '❔'}</span>`;
const monthSelect = () => `<select class="pill-select" data-bind="month" aria-label="Month">${lastMonths(6).reverse().map((k) => `<option value="${k}" ${k === state.ui.month ? 'selected' : ''}>${monthLabel(k)}</option>`).join('')}</select>`;
const route = () => { const r = (location.hash.replace('#/', '') || 'overview').split('?')[0]; return r === 'wallets' ? 'portfolio' : r; };

/* ---------- charts (hand-built SVG) ---------- */
function sparkline(values) {
  const W = 600, H = 110, p = 6, min = Math.min(...values), max = Math.max(...values);
  const x = (i) => p + ((W - 2 * p) * i) / (values.length - 1);
  const y = (v) => H - p - ((H - 2 * p) * (v - min)) / (max - min || 1);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const last = values.length - 1;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Balance trend">
    <polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(last)}" cy="${y(values[last])}" r="6" fill="#FFD84D" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

function flowChart(months, inc, exp) {
  const W = 560, H = 260, pl = 46, pr = 18, pt = 14, pb = 30;
  const raw = Math.max(...inc, ...exp, 1);
  const base = 10 ** Math.floor(Math.log10(raw / 4));
  const max = 4 * base * ([1, 1.5, 2, 2.5, 5, 10].find((m) => m * base >= raw / 4) || 10);
  const x = (i) => pl + ((W - pl - pr) * i) / (months.length - 1);
  const y = (v) => pt + (H - pt - pb) * (1 - v / max);
  const line = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line(inc)} ${[...exp].map((v, i) => [x(i), y(v)]).reverse().map(([a, b]) => `L${a.toFixed(1)},${b.toFixed(1)}`).join(' ')} Z`;
  const ticks = [0, 1, 2, 3, 4].map((i) => (max * i) / 4);
  return `<div class="chart-wrap" id="flow" data-n="${months.length}">
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Income versus spending by month">
      ${ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="#ECEEF8"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="#6B6F8F">${esc(compact(t, cur()))}</text>`).join('')}
      <path d="${area}" fill="#8B8FF0" fill-opacity=".16"/>
      <path d="${line(inc)}" fill="none" stroke="#4A44C6" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="${line(exp)}" fill="none" stroke="#F5B800" stroke-width="2.5" stroke-linejoin="round"/>
      ${months.map((k, i) => `<circle cx="${x(i)}" cy="${y(inc[i])}" r="4" fill="#4A44C6"/><circle cx="${x(i)}" cy="${y(exp[i])}" r="4" fill="#F5B800"/><text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#6B6F8F">${monthLabel(k, 'short')}</text>`).join('')}
      <line id="flow-cursor" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="#1E1B4B" stroke-width="1.5" opacity="0"/>
    </svg><div class="tip" id="flow-tip"></div></div>
    <div class="legend-row" style="margin-top:10px"><span><i style="background:#4A44C6"></i>Income</span><span><i style="background:#F5B800"></i>Spending</span></div>`;
}
function bindFlow(months, inc, exp) {
  const wrap = $('#flow'); if (!wrap) return;
  const svg = $('svg', wrap), tip = $('#flow-tip'), cur$ = $('#flow-cursor');
  const W = 560, pl = 46, pr = 18;
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(months.length - 1, Math.round(((vx - pl) / (W - pl - pr)) * (months.length - 1))));
    const cx = pl + ((W - pl - pr) * i) / (months.length - 1);
    cur$.setAttribute('x1', cx); cur$.setAttribute('x2', cx); cur$.setAttribute('opacity', 1);
    const net = inc[i] - exp[i];
    tip.textContent = `${monthLabel(months[i], 'short')}: net ${net >= 0 ? '+' : '−'}${money(Math.abs(net), cur())}`;
    tip.style.left = `${(cx / W) * r.width}px`; tip.style.top = `${r.height * 0.3}px`; tip.style.opacity = 1;
  });
  svg.addEventListener('pointerleave', () => { tip.style.opacity = 0; cur$.setAttribute('opacity', 0); });
}

function halfDonut(items, total) {
  const N = 26, cx = 220, cy = 224, R = 204, r = 134, gap = 0.045;
  const top = items.slice(0, 5), rest = items.slice(5).reduce((a, i) => a + i.value, 0);
  const parts = rest ? [...top, { name: 'Others', color: '#CBD0E8', value: rest }] : top;
  // largest-remainder allocation of N segments
  const alloc = parts.map((p) => ({ p, exact: total ? (p.value / total) * N : 0 }));
  alloc.forEach((a) => { a.n = Math.floor(a.exact); });
  let left = N - alloc.reduce((s, a) => s + a.n, 0);
  [...alloc].sort((a, b) => (b.exact - b.n) - (a.exact - a.n)).forEach((a) => { if (left > 0 && total) { a.n++; left--; } });
  const colors = total ? alloc.flatMap((a) => Array(a.n).fill(a.p.color)) : Array(N).fill('#E6E8F5');
  const pt = (rad, ang) => `${(cx + rad * Math.cos(ang)).toFixed(1)},${(cy + rad * Math.sin(ang)).toFixed(1)}`;
  const seg = (i) => {
    const a0 = Math.PI + (Math.PI * i) / N + gap, a1 = Math.PI + (Math.PI * (i + 1)) / N - gap, ro = R - 5, ri = r + 5;
    return `<path d="M${pt(ro, a0)} A${ro},${ro} 0 0 1 ${pt(ro, a1)} L${pt(ri, a1)} A${ri},${ri} 0 0 0 ${pt(ri, a0)} Z" fill="${colors[i]}" stroke="${colors[i]}" stroke-width="10" stroke-linejoin="round"/>`;
  };
  const dots = Array.from({ length: N }, (_, i) => { const a = Math.PI + (Math.PI * (i + 0.5)) / N; return `<circle cx="${(cx + (r - 20) * Math.cos(a)).toFixed(1)}" cy="${(cy + (r - 20) * Math.sin(a)).toFixed(1)}" r="4.5" fill="${colors[i]}"/>`; }).join('');
  return `<div class="donut"><svg viewBox="0 0 440 240" class="chart" role="img" aria-label="Spending by category">${Array.from({ length: N }, (_, i) => seg(i)).join('')}${dots}</svg>
    <div class="center"><p>Spent in ${esc(monthLabel(state.ui.month).split(' ')[0])}</p><b class="num" style="--len:${money(total, cur()).length}">${money(total, cur())}</b></div></div>`;
}

function valueChart(months, usd, vc) {
  const W = 560, H = 250, pl = 58, pr = 18, pt = 14, pb = 30;
  const vals = usd.map((u) => u * RATES[vc]);
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.18 || hi * 0.1 || 1;
  const min = Math.max(0, lo - pad), max = hi + pad;
  const x = (i) => pl + ((W - pl - pr) * i) / (months.length - 1);
  const y = (v) => pt + (H - pt - pb) * (1 - (v - min) / (max - min));
  const cmp = (v) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3);
  return `<div class="chart-wrap" id="pf"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Portfolio value by month">
    <defs><linearGradient id="pfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A44C6" stop-opacity=".25"/><stop offset="1" stop-color="#4A44C6" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="#ECEEF8"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="#6B6F8F">${cmp(t)}</text>`).join('')}
    <path d="${line} L${x(vals.length - 1)},${H - pb} L${x(0)},${H - pb} Z" fill="url(#pfg)"/>
    <path d="${line}" fill="none" stroke="#4A44C6" stroke-width="2.5" stroke-linejoin="round"/>
    ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="#4A44C6"/><text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#6B6F8F">${monthLabel(months[i], 'short')}</text>`).join('')}
    <line id="pf-cursor" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="#1E1B4B" stroke-width="1.5" opacity="0"/></svg><div class="tip" id="pf-tip"></div></div>`;
}
function bindValue(months, usd, vc) {
  const wrap = $('#pf'); if (!wrap) return;
  const svg = $('svg', wrap), tip = $('#pf-tip'), cursor = $('#pf-cursor'), W = 560, pl = 58, pr = 18;
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect(), vx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(months.length - 1, Math.round(((vx - pl) / (W - pl - pr)) * (months.length - 1))));
    const cx = pl + ((W - pl - pr) * i) / (months.length - 1);
    cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx); cursor.setAttribute('opacity', 1);
    const mom = i && usd[i - 1] > 0 ? ((usd[i] - usd[i - 1]) / usd[i - 1]) * 100 : null;
    tip.textContent = `${monthLabel(months[i], 'short')}: ${money(usdToMinor(usd[i], vc), vc)} (${pctFmt(mom)} MoM)`;
    tip.style.left = `${(cx / W) * r.width}px`; tip.style.top = `${r.height * 0.3}px`; tip.style.opacity = 1;
  });
  svg.addEventListener('pointerleave', () => { tip.style.opacity = 0; cursor.setAttribute('opacity', 0); });
}

function holdingRow(h, vc, accTotal) {
  const info = assetInfo(h.symbol), k = lastMonths(6)[5], price = info.usd(k), value = h.quantity * price;
  return `<div class="row" data-act="edit-holding" data-id="${h.id}" tabindex="0"><span class="tile sym" style="--c:${TYPE_COLOR[info.type]}">${esc(info.symbol.slice(0, 4))}</span>
    <div><div class="title">${esc(info.name)} <span class="badge">${esc(info.type)}</span></div><div class="sub num">${qtyFmt(h.quantity)} ${esc(info.symbol)} ×${money(usdToMinor(price, vc), vc)}</div></div>
    <div class="amt num">${money(usdToMinor(value, vc), vc)}<div class="sub">${accTotal ? Math.round((value / accTotal) * 100) : 0}%</div></div></div>`;
}

/* archived wallets: hidden from totals; can be restored, or deleted for good when no transaction uses them */
function archivedWallets() {
  const list = D().wallets.filter((w) => w.archived); if (!list.length) return '';
  const open = state.ui.archOpen;
  return `<div style="margin-top:18px"><button type="button" class="legend-btn card-toggle" data-act="toggle-arch" aria-expanded="${open}"><span class="chev" aria-hidden="true">›</span><b>Archived wallets (${list.length})</b></button>
    ${open ? list.map((w) => { const n = D().transactions.filter((t) => t.wallet_id === w.id).length;
      return `<div class="brow"><div><b>${esc(w.name)}</b> <span class="badge">${esc(w.type)} · ${esc(w.currency)}</span><br><small class="muted">${money(walletBalance(w), w.currency)} · ${n} transaction${n === 1 ? '' : 's'}</small></div>
        <div class="tools"><button class="btn secondary" data-act="restore-wallet" data-id="${w.id}">Restore</button><button class="btn danger" data-act="delete-wallet" data-id="${w.id}">Delete</button></div></div>`; }).join('') : ''}</div>`;
}
const walletCards = () => D().wallets.filter((w) => !w.archived).map((w) => `<div class="wallet"><span class="kind">${esc(w.type)} · ${esc(w.currency)}</span><b class="num">${money(walletBalance(w), w.currency)}</b>${w.currency !== cur() ? `<small class="muted num">≈ ${money(convert(walletBalance(w), w.currency, cur()), cur())}</small>` : ''}<span>${esc(w.name)}</span><div class="tools" style="margin-top:8px"><button class="btn secondary" data-act="edit-wallet" data-id="${w.id}">Edit</button><button class="btn secondary" data-act="archive-wallet" data-id="${w.id}">Archive</button></div></div>`).join('');

/* one card for both kinds: 'loan' = debt you owe, 'lent' = money others owe you */
function loanCard(l, vc, kind = 'loan') {
  const lent = kind === 'lent', coll = lent ? D().lent : D().loans;
  const bal = loanBalance(l), paid = paidOf(l), pct = l.original_minor ? Math.min(100, Math.round((paid / l.original_minor) * 100)) : 0;
  const shown = (m) => money(convert(m, l.currency, vc), vc);
  const recent = [...l.payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const word = lent ? 'repayment' : 'payment';
  const meta = lent ? `${l.due ? `Due ${new Date(l.due + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'No due date'}${l.note ? ` · ${esc(l.note)}` : ''}`
    : `${l.monthly_minor ? `Monthly ${shown(l.monthly_minor)}` : ''}${l.rate ? ` · ${l.rate}% APR` : ''}`;
  return `<section class="card"><div class="card-head"><div><h2>${esc(l.name)} <span class="badge">${lent ? 'Lent' : esc(LOAN_TYPES[l.type] || 'Loan')}</span></h2>
      <div class="big num" style="font-size:26px;margin-top:4px">${shown(bal)}</div>${l.currency !== vc ? `<small class="muted num">${money(bal, l.currency)} ${esc(l.currency)}</small>` : ''}</div>
      <div class="tools"><button class="btn secondary" data-act="edit-${kind}" data-id="${l.id}">Edit</button><button class="btn" data-act="pay-${kind}" data-id="${l.id}">+ ${lent ? 'Repayment' : 'Payment'}</button></div></div>
    <div class="bar"><i style="width:${pct}%;${lent ? 'background:#1fa971' : ''}"></i></div>
    <div class="loan-meta"><span>${pct}% ${lent ? 'repaid' : 'paid'} · ${shown(paid)} of ${shown(l.original_minor)}</span><span>${meta}</span></div>
    ${bal === 0 ? `<p class="hint" style="margin-top:10px">${lent ? 'Fully repaid' : 'Paid off'}. You can archive this.</p>` : ''}
    ${recent.length ? `<div class="list" style="margin-top:10px">${recent.map((p) => `<div class="pay-row"><span>${esc(new Date(p.date + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }))}</span><span class="num">${shown(p.amount_minor)}</span><button class="icon-x" data-act="delete-payment" data-kind="${kind}" data-id="${l.id}" data-pid="${p.id}" aria-label="Remove ${word}">×</button></div>`).join('')}</div>` : `<p class="muted" style="margin-top:10px">No ${word}s yet.</p>`}</section>`;
}

function viewPortfolio() {
  const months = lastMonths(6), vc = pf(), base = cur(), tab = state.ui.pfTab || 'savings';
  const S = months.map(savingsUSD), I = months.map((k) => portfolioUSD(k)), L = months.map(loanUSD), LT = months.map(lentUSD);
  const N = months.map((_, i) => S[i] + I[i] + LT[i] - L[i]);
  const now = N[5], prev = N[4], mom = prev > 0 ? ((now - prev) / prev) * 100 : null;
  const m = (usd) => money(usdToMinor(usd, vc), vc);
  const toggles = [...new Set([base, 'USD'])];
  const assets = S[5] + I[5] + LT[5];
  const share = (v) => (assets > 0 ? Math.round((v / assets) * 100) : 0);
  const series = { savings: S, investment: I, lent: LT, loan: L }[tab];
  state.chart = { months, series, vc };
  const titles = { savings: 'Savings over time', investment: 'Investment growth month over month', lent: 'Money lent over time', loan: 'Loan balance over time' };
  const months6 = months.map((k, i) => {
    const d = i ? series[i] - series[i - 1] : null, p = i && series[i - 1] > 0 ? (d / series[i - 1]) * 100 : null;
    const good = p === null ? '' : (tab === 'loan' ? p <= 0 : p >= 0) ? 'up' : 'down';
    return `<tr><td>${esc(monthLabel(k))}</td><td class="num">${m(series[i])}</td><td class="num">${d === null ? '—' : `${d >= 0 ? '+' : '−'}${m(Math.abs(d))}`}</td><td class="num ${good}">${pctFmt(p)}</td></tr>`;
  }).reverse().join('');
  const growth = `<section class="card" style="margin-top:20px"><div class="card-head"><h2>${titles[tab]}</h2><span class="chip">6 months</span></div>
    ${valueChart(months, series, vc)}<table class="tbl"><thead><tr><th>Month</th><th>Value</th><th>Change</th><th>${tab === 'investment' ? 'MoM' : 'Change %'}</th></tr></thead><tbody>${months6}</tbody></table></section>`;

  let body = '';
  if (tab === 'savings') {
    body = `<section class="card"><div class="card-head"><div><h2>Savings and wallets</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(S[5])}</div></div><button class="btn" data-act="add-wallet">+ Wallet</button></div>
      <div class="wallets">${walletCards()}</div>${archivedWallets()}</section>${growth}`;
  } else if (tab === 'investment') {
    const byType = {};
    D().holdings.filter((h) => activeAccounts().some((a) => a.id === h.account_id)).forEach((h) => { const t = assetInfo(h.symbol).type; byType[t] = (byType[t] || 0) + holdingUSD(h, months[5]); });
    const alloc = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    body = `<section class="card"><div class="card-head"><div><h2>Investments</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(I[5])}</div></div>
        <div class="tools"><button class="btn secondary" data-act="refresh-prices">Refresh prices</button><button class="btn" data-act="add-account">+ Account</button></div></div>
      ${alloc.length ? `<div class="alloc">${alloc.map(([t, v]) => `<i style="flex:${v};background:${TYPE_COLOR[t]}" title="${esc(t)}"></i>`).join('')}</div>
      <div class="alloc-legend">${alloc.map(([t, v]) => `<div><span class="key"><i style="background:${TYPE_COLOR[t]}"></i>${esc(t)}</span><b class="num">${m(v)}</b><span class="muted">${I[5] ? Math.round((v / I[5]) * 100) : 0}%</span></div>`).join('')}</div>` : '<div class="empty">Add an account and assets to see allocation.</div>'}
      <p class="muted" style="font-size:12px;margin-top:12px">${api.finnhub ? 'Current prices are live from Finnhub; earlier months of built-in assets are mock history.' : 'Prices are mock data (no Finnhub connection).'} Growth counts money you add; buying-price tracking comes in v2.</p></section>
      ${growth}
      <div class="stack" style="margin-top:20px">${activeAccounts().map((a) => {
        const hs = holdingsOf(a.id), total = portfolioUSD(months[5], a.id);
        return `<section class="card"><div class="card-head"><div><h2>${esc(a.name)}</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(total)}</div></div>
          <div class="tools"><button class="btn secondary" data-act="edit-account" data-id="${a.id}">Edit</button><button class="btn" data-act="add-holding" data-account="${a.id}">+ Asset</button></div></div>
          <div class="list">${hs.map((h) => holdingRow(h, vc, total)).join('') || '<div class="empty">No assets yet. Add one to start tracking.</div>'}</div></section>`;
      }).join('') || '<div class="card empty">No investment accounts yet. Add one (for example your exchange or brokerage).</div>'}</div>`;
  } else if (tab === 'lent') {
    const owed = activeLent().reduce((a, l) => a + toUSD(loanBalance(l), l.currency), 0);
    body = `<section class="card"><div class="card-head"><div><h2>Money you lent</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(LT[5])}</div>
        <small class="muted">${activeLent().length} open · ${m(owed)} still owed to you</small></div><button class="btn" data-act="add-lent">+ Lent</button></div>
      <p class="muted" style="font-size:13px">Money others owe you counts as an asset in your net worth. Record each repayment you receive.</p></section>
      <div class="stack" style="margin-top:20px">${activeLent().map((l) => loanCard(l, vc, 'lent')).join('') || '<div class="card empty">Nothing lent out. Add money you lent to a friend or family member to track repayments.</div>'}</div>${growth}`;
  } else {
    const monthly = activeLoans().reduce((a, l) => a + toUSD(l.monthly_minor, l.currency), 0);
    body = `<section class="card"><div class="card-head"><div><h2>Loans you owe</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(L[5])}</div>
        <small class="muted">${monthly ? `${m(monthly)} due each month` : 'No monthly payments set'}</small></div><button class="btn" data-act="add-loan">+ Loan</button></div>
      <p class="muted" style="font-size:13px">Loans count against your net worth. Record each payment to bring the balance down.</p></section>
      <div class="stack" style="margin-top:20px">${activeLoans().map((l) => loanCard(l, vc)).join('') || '<div class="card empty">No loans. Add a mortgage, car loan or credit card balance to include it in your net worth.</div>'}</div>${growth}`;
  }

  const tabBtn = (id, label) => `<button class="tab ${tab === id ? 'on' : ''}" data-act="pf-tab" data-tab="${id}">${label}</button>`;
  return `${topbar('Portfolio', `Net worth across savings, investments and loans · shown in ${vc}`)}
  <div class="grid">
    <section class="card hero"><div class="label">Net worth <span>${activeLoans().length ? 'after loans' : 'no loans'}</span></div>
      <div class="amount num" style="--len:${m(now).length}">${moneyHtml(usdToMinor(now, vc), vc)}</div>
      <div class="delta"><b>${pctFmt(mom)}</b><span>vs last month</span></div>
      <p style="font-size:12px;opacity:.85">${api.fx ? `1 USD = ${new Intl.NumberFormat('en', { maximumFractionDigits: 4 }).format(RATES[base] || 1)} ${base} · live rate (${esc(api.fx.source)}, ${esc(api.fx.date)})` : 'Exchange rates are demo values (no live feed).'}</p>
      <div class="hero-actions" style="margin-top:8px">${toggles.map((c) => `<button class="ghost ${c === vc ? 'on' : ''}" data-act="pf-cur" data-cur="${c}">${c}</button>`).join('')}</div></section>
    <section class="card"><div class="card-head"><h2>Breakdown</h2></div>
      <div class="alloc"><i style="flex:${Math.max(S[5], 0.0001)};background:#4A44C6"></i><i style="flex:${Math.max(I[5], 0.0001)};background:#F5B800"></i><i style="flex:${Math.max(LT[5], 0.0001)};background:#1fa971"></i></div>
      <div class="alloc-legend">
        <div><span class="key"><i style="background:#4A44C6"></i>Savings</span><b class="num">${m(S[5])}</b><span class="muted">${share(S[5])}%</span></div>
        <div><span class="key"><i style="background:#F5B800"></i>Investments</span><b class="num">${m(I[5])}</b><span class="muted">${share(I[5])}%</span></div>
        <div><span class="key"><i style="background:#1fa971"></i>Lent to others</span><b class="num">${m(LT[5])}</b><span class="muted">${share(LT[5])}%</span></div>
        <div><span class="key"><i style="background:#E5484D"></i>Loans</span><b class="num">−${m(L[5])}</b><span class="muted"></span></div></div></section>
  </div>
  <div class="tabs" role="tablist" style="margin:20px 0">${tabBtn('savings', 'Savings')}${tabBtn('investment', 'Investment')}${tabBtn('lent', 'Lent')}${tabBtn('loan', 'Loan')}</div>
  ${body}`;
}

function loanDialog(l) {
  open(`<h2>${l ? 'Edit' : 'Add'} loan</h2><form data-form="loan" data-id="${l?.id || ''}" style="display:contents">
    <label class="field">Name<input name="name" required maxlength="40" value="${esc(l?.name || '')}" placeholder="e.g. Car loan" autofocus></label>
    <div class="two"><label class="field">Type<select name="type">${Object.entries(LOAN_TYPES).map(([k, v]) => `<option value="${k}" ${k === (l?.type || 'car') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field">Currency<select name="currency" ${l ? 'disabled' : ''}>${Object.keys(RATES).map((c) => `<option ${c === (l?.currency || cur()) ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <div class="two"><label class="field">${l ? 'Original amount' : 'Amount owed now'}<input name="amount" type="number" min="1" step="any" required value="${l ? toMajor(l.original_minor, l.currency) : ''}"></label>
      <label class="field">Monthly payment<input name="monthly" type="number" min="0" step="any" value="${l ? toMajor(l.monthly_minor, l.currency) : ''}"></label></div>
    <label class="field">Interest rate (% per year, optional)<input name="rate" type="number" min="0" step="any" value="${l?.rate || ''}"></label>
    <div class="actions">${l ? `<button type="button" class="btn danger" data-act="archive-loan" data-id="${l.id}">Archive</button>` : ''}<button type="button" class="btn secondary" data-act="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>`);
}
function lentDialog(l) {
  open(`<h2>${l ? 'Edit' : 'Add'} money lent</h2><form data-form="lent" data-id="${l?.id || ''}" style="display:contents">
    <label class="field">Who borrowed it<input name="name" required maxlength="40" value="${esc(l?.name || '')}" placeholder="e.g. Budi" autofocus></label>
    <div class="two"><label class="field">Amount lent<input name="amount" type="number" min="1" step="any" required value="${l ? toMajor(l.original_minor, l.currency) : ''}"></label>
      <label class="field">Currency<select name="currency" ${l ? 'disabled' : ''}>${Object.keys(RATES).map((c) => `<option ${c === (l?.currency || cur()) ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <div class="two"><label class="field">Due date (optional)<input name="due" type="date" value="${esc(l?.due || '')}"></label>
      <label class="field">Note (optional)<input name="note" maxlength="60" value="${esc(l?.note || '')}" placeholder="e.g. Laptop repair"></label></div>
    <div class="actions">${l ? `<button type="button" class="btn danger" data-act="archive-lent" data-id="${l.id}">Archive</button>` : ''}<button type="button" class="btn secondary" data-act="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>`);
}
function paymentDialog(l, kind = 'loan') {
  const lent = kind === 'lent';
  open(`<h2>${lent ? 'Record repayment' : 'Record payment'}</h2><p class="muted" style="margin-top:-10px">${esc(l.name)} · ${money(loanBalance(l), l.currency)} ${lent ? 'still owed to you' : 'remaining'}</p>
  <form data-form="payment" data-kind="${kind}" data-id="${l.id}" style="display:contents">
    <div class="two"><label class="field">Amount (${esc(l.currency)})<input name="amount" type="number" min="0" step="any" required value="${l.monthly_minor ? toMajor(l.monthly_minor, l.currency) : ''}" autofocus></label>
      <label class="field">Date<input name="date" type="date" required value="${isoDate(new Date())}"></label></div>
    <p class="hint">${lent ? 'Repayments lower what you are owed. They are not counted as income.' : 'Payments lower the loan balance and your debt in net worth. They are not counted as spending.'}</p>
    <div class="actions"><button type="button" class="btn secondary" data-act="close">Cancel</button><button class="btn" type="submit">Save ${lent ? 'repayment' : 'payment'}</button></div></form>`);
}

/* ---------- views ---------- */
function sidebar() {
  const r = route();
  const link = (id, ic, label) => `<a href="#/${id}" class="${r === id ? 'active' : ''}">${icon(ic)}<span>${label}</span></a>`;
  return `<aside class="sidebar"><div class="logo"><img src="icon.svg" alt="">Stiver</div>
    <div class="nav-label">MENU</div><nav class="nav">${link('overview', 'home', 'Overview')}${link('transactions', 'swap', 'Transactions')}${link('budgets', 'pie', 'Budgets')}${link('portfolio', 'trend', 'Portfolio')}</nav>
    <div class="nav-label">ACCOUNT</div><nav class="nav">${link('settings', 'gear', 'Settings')}</nav></aside>`;
}
function bottomNav() {
  const r = route();
  const l = (id, ic, label) => `<a href="#/${id}" class="${r === id ? 'active' : ''}">${icon(ic)}${label}</a>`;
  return `<nav class="bottom-nav">${l('overview', 'home', 'Overview')}${l('transactions', 'swap', 'Activity')}${l('budgets', 'pie', 'Budgets')}${l('portfolio', 'trend', 'Portfolio')}${l('settings', 'gear', 'Settings')}</nav>
    <button class="fab" data-act="add-txn" aria-label="Add transaction">${icon('plus')}</button>`;
}
function topbar(title, sub) {
  const p = D().profile, hour = new Date().getHours();
  const greet = title || `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, ${esc(p.name.split(' ')[0])}`;
  return `<header class="topbar"><div><h1>${greet}</h1><p>${esc(sub)}</p></div>
    <div class="tools"><label class="search">${icon('search')}<input id="gsearch" placeholder="Search transactions" aria-label="Search transactions"></label>
    <button class="icon-btn" data-act="notify" aria-label="Notifications">${icon('bell')}<span class="dot"></span></button>
    <div class="profile"><div class="avatar">${esc(p.name[0].toUpperCase())}</div><div><b>${esc(p.name)}</b><small>${esc(p.currency)} · signed in</small></div></div></div></header>`;
}

function viewOverview() {
  const k = state.ui.month, list = inMonth(k), inc = sumBy(list, 'income'), exp = sumBy(list, 'expense'), net = inc - exp;
  const months = lastMonths(6);
  const incs = months.map((m) => sumBy(inMonth(m), 'income')), exps = months.map((m) => sumBy(inMonth(m), 'expense'));
  const bal = months.map(balanceAtEnd);
  const cats = spendByCategory(k), bs = budgetStatus(k);
  const global = bs.find((b) => b.category_id === null);
  const tiles = [...(global ? [global] : []), ...bs.filter((b) => b.category_id).sort((a, b) => b.pct - a.pct)].slice(0, 3);
  const saved = inc > 0 ? Math.round((net / inc) * 100) : 0;
  const recent = D().transactions.slice(0, 6);
  return `${topbar('', 'Here is where your money stands today.')}
  <div class="grid">
    <section class="card hero"><div class="label">Total Balance <span>${D().wallets.filter((w) => !w.archived).length} wallets</span></div>
      <div class="amount num" style="--len:${money(totalBalance(), cur()).length}">${moneyHtml(totalBalance(), cur())}</div>
      <div class="delta"><b>${saved >= 0 ? '+' : ''}${saved}%</b><span>${net >= 0 ? '+' : '−'}${money(Math.abs(net), cur())} this month</span></div>
      ${sparkline(bal)}
      <div class="hero-actions"><button class="ghost" data-act="add-txn" data-type="expense">${icon('plus')} Expense</button><button class="ghost" data-act="add-txn" data-type="income">${icon('plus')} Income</button><button class="ghost" data-act="invest">${icon('plus')} Invest</button></div>
      </section>
    <section class="card"><div class="card-head"><h2>Money Flow</h2><span class="chip">6 months</span></div>
      <div class="big num">${money(Math.max(net, 0), cur())}</div><p class="muted" style="margin-bottom:14px">Saved in ${esc(monthLabel(k))}</p>
      ${flowChart(months, incs, exps)}</section>
    <section class="card"><div class="card-head"><h2>Spending</h2><div class="tools"><button class="chip" data-act="breakdown">Details</button>${monthSelect()}</div></div>
      ${halfDonut(cats, exp)}
      <div class="cat-legend">${cats.slice(0, 3).map((c) => `<button class="legend-btn" data-act="breakdown" data-id="${c.id || ''}">${tile({ icon: c.icon, color: c.color }, true)}${esc(c.name)}</button>`).join('') || '<div>No spending this month</div>'}</div></section>
    <section class="card"><div class="card-head"><h2>Budgets</h2><a class="chip" href="#/budgets">Manage</a></div>
      ${global ? `<div class="big num">${money(global.spent, cur())}</div><p class="muted">of ${money(global.budget, cur())} monthly budget</p>` : '<div class="big">No budget</div><p class="muted">Set one to track your month</p>'}
      <div class="tiles">${tiles.map((b) => `<div class="btile"><div class="well"><div class="fill ${b.status}" style="height:${Math.max(14, Math.min(100, b.pct))}%"><span class="pct">${Math.round(b.pct)}%</span></div></div><b>${esc(b.name)}</b><small class="num">${money(b.spent, cur())} / ${money(b.budget, cur())}</small></div>`).join('') || '<p class="muted">No budgets yet.</p>'}</div></section>
  </div>
  <section class="card" style="margin-top:20px"><div class="card-head"><h2>Recent transactions</h2><a class="chip" href="#/transactions">View all</a></div><div class="list">${recent.map(txnRow).join('')}</div></section>`;
}

function txnRow(t) {
  if (t.type === 'transfer') {
    // money moved to/from an investment: not income or spending, so not editable here (edit it on the Portfolio page)
    return `<div class="row"><span class="tile" style="--c:#F5B800">${t.flow === 'out' ? '📈' : '💵'}</span>
    <div><div class="title">${esc(t.note)}<span class="badge">Investment</span></div>
    <div class="sub">Transfer · ${esc(walletOf(t.wallet_id)?.name || '')} · ${esc(new Date(t.occurred_at + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }))}</div></div>
    <div class="amt num">${t.flow === 'out' ? '−' : '+'}${money(t.amount_minor, t.currency)}</div></div>`;
  }
  const c = catOf(t.category_id), sign = t.type === 'income' ? '+' : '−';
  return `<div class="row" data-act="edit-txn" data-id="${t.id}" tabindex="0">${tile(c)}
    <div><div class="title">${esc(t.note || c?.name || 'Transaction')}${t.category_source === 'ai' ? '<span class="badge ai" title="Tagged by AI">AI</span>' : ''}${!c ? '<span class="badge">Uncategorized</span>' : ''}${t.occasion_id && occasionOf(t.occasion_id) ? `<span class="badge">🎉 ${esc(occasionOf(t.occasion_id).name)}</span>` : ''}</div>
    <div class="sub">${esc(c ? catPath(c.id) : 'No category')} ·${esc(walletOf(t.wallet_id)?.name || '')} · ${esc(new Date(t.occurred_at + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }))}</div></div>
    <div class="amt num ${t.type}">${sign}${money(t.amount_minor, t.currency)}</div></div>`;
}
function filteredTxns() {
  const { q, cat, wallet, occ } = state.ui, ql = q.trim().toLowerCase();
  return D().transactions.filter((t) => (occ || t.occurred_at.startsWith(state.ui.month))
    && (!cat || (cat === 'none' ? !t.category_id : t.category_id === cat || (t.category_id && rootOf(t.category_id) === cat))) && (!wallet || t.wallet_id === wallet) && (!occ || t.occasion_id === occ)
    && (!ql || (t.note || '').toLowerCase().includes(ql) || (catOf(t.category_id)?.name || '').toLowerCase().includes(ql)));
}
function txnListHtml() {
  const rows = filteredTxns();
  return rows.length ? rows.map(txnRow).join('') : '<div class="empty">No transactions match.</div>';
}
function viewTransactions() {
  const list = inMonth(state.ui.month);
  return `${topbar('Transactions', `${list.length} in ${monthLabel(state.ui.month)} · income ${money(sumBy(list, 'income'), cur())} · spent ${money(sumBy(list, 'expense'), cur())}`)}
  <section class="card"><div class="card-head"><h2>Activity</h2><div class="tools">${monthSelect()}<button class="btn" data-act="add-txn">+ Add</button></div></div>
    <div class="filters"><input data-filter="q" placeholder="Search note or category" value="${esc(state.ui.q)}">
      <select data-filter="cat" aria-label="Category"><option value="">All categories</option><option value="none" ${state.ui.cat === 'none' ? 'selected' : ''}>Uncategorized</option>${catTree().map((c) => `<option value="${c.id}" ${state.ui.cat === c.id ? 'selected' : ''}>${c.parent_id ? '  ↳ ' : ''}${esc(c.name)}</option>`).join('')}</select>
      ${D().occasions.length ? `<select data-filter="occ" aria-label="Occasion"><option value="">All occasions</option>${D().occasions.map((o) => `<option value="${o.id}" ${state.ui.occ === o.id ? 'selected' : ''}>🎉 ${esc(o.name)}</option>`).join('')}</select>` : ''}
      <select data-filter="wallet" aria-label="Wallet"><option value="">All wallets</option>${D().wallets.map((w) => `<option value="${w.id}" ${state.ui.wallet === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
    <div class="list" id="txn-list">${txnListHtml()}</div></section>`;
}

function viewBudgets() {
  const bs = budgetStatus(state.ui.month), g = bs.find((b) => b.category_id === null), rest = bs.filter((b) => b.category_id);
  const over = bs.filter((b) => b.status === 'exceeded').length;
  const cap = (b) => `<span class="badge ${b.status}">${b.status === 'ok' ? 'On track' : b.status === 'warning' ? 'Almost there' : 'Over budget'}</span>`;
  return `${topbar('Budgets', over ? `${over} budget${over > 1 ? 's' : ''} exceeded in ${monthLabel(state.ui.month)}` : `Monthly limits for ${monthLabel(state.ui.month)}`)}
  <div class="stack">
  <section class="card"><div class="card-head"><h2>Overall budget</h2><div class="tools">${monthSelect()}<button class="btn" data-act="add-budget">+ Budget</button></div></div>
    ${g ? `<div class="big num">${money(g.spent, cur())} <span class="muted" style="font-size:18px;font-weight:500">of ${money(g.budget, cur())}</span></div>
      <div class="bar" style="margin:14px 0 10px"><i class="${g.status}" style="width:${Math.min(100, g.pct)}%"></i></div>
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span class="muted">${g.remaining >= 0 ? `${money(g.remaining, cur())} left` : `${money(-g.remaining, cur())} over`} · ${Math.round(g.pct)}% used</span>${cap(g)}<button class="btn secondary" data-act="edit-budget" data-id="${g.id}">Edit</button></div>`
      : '<p class="muted">No overall budget yet. Add one to cap total monthly spending.</p>'}</section>
  <section class="card"><div class="card-head"><h2>By category</h2></div>
    ${rest.length ? rest.map((b) => `<div class="brow">${tile({ icon: b.icon, color: b.color })}<div><div class="meta"><span>${esc(b.name)} ${cap(b)}</span><span class="num">${money(b.spent, cur())} / ${money(b.budget, cur())}</span></div><div class="bar"><i class="${b.status}" style="width:${Math.min(100, b.pct)}%"></i></div></div><button class="btn secondary" data-act="edit-budget" data-id="${b.id}">Edit</button></div>`).join('') : '<div class="empty">No category budgets yet.</div>'}</section>
  <section class="card"><div class="card-head"><h2>Special occasions</h2><button class="btn" data-act="add-occasion">+ Occasion</button></div>
    <p class="muted" style="margin-bottom:8px">A one-off budget for a trip, a party or a dinner. Tag expenses to it when you add them.</p>
    ${(() => { const all = occasionStatus(), live = all.filter((o) => !o.archived), past = all.filter((o) => o.archived); return (live.length ? live.map(occasionRow).join('') : '<div class="empty">No occasion budgets yet. Add one like "Bali Trip" or "Birthday Dinner".</div>') + (past.length ? `<h3 class="muted" style="margin:16px 0 6px;font-size:13px">Past occasions</h3>${past.map(occasionRow).join('')}` : ''); })()}</section></div>`;
}
const occasionRow = (o) => {
  const dates = [o.start, o.end].filter(Boolean).map((d) => new Date(d + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })).join(' – ');
  return `<div class="brow"><span class="tile" style="--c:#EC4899">🎉</span><div><div class="meta"><span>${esc(o.name)} <span class="badge ${o.status}">${o.status === 'ok' ? 'On track' : o.status === 'warning' ? 'Almost there' : 'Over budget'}</span></span><span class="num">${money(o.spent, cur())} / ${money(o.budget, cur())}</span></div>
    <div class="bar"><i class="${o.status}" style="width:${Math.min(100, o.pct)}%"></i></div><small class="muted">${o.count} expense${o.count === 1 ? '' : 's'}${dates ? ' · ' + esc(dates) : ''}${o.remaining < 0 ? ` · ${money(-o.remaining, cur())} over` : ` · ${money(o.remaining, cur())} left`}</small></div>
    <div class="tools"><button class="btn secondary" data-act="view-occasion" data-id="${o.id}">Expenses</button><button class="btn secondary" data-act="edit-occasion" data-id="${o.id}">Edit</button></div></div>`;
};

/* Settings > Categories: collapsed by default; each parent with sub-categories expands on its own */
function categoriesCard() {
  const roots = D().categories.filter((c) => !c.parent_id && !c.archived), subs = D().categories.filter((c) => c.parent_id && !c.archived).length;
  const open = state.ui.catsOpen;
  const rows = roots.map((c) => {
    const kids = childrenOf(c.id), isOpen = state.ui.openCats.has(c.id);
    return `<div class="brow">${tile(c)}<div><b>${esc(c.name)}</b> <span class="badge">${c.type}</span>${kids.length ? ` <button type="button" class="legend-btn" data-act="toggle-cat" data-id="${c.id}" aria-expanded="${isOpen}">${kids.length} sub-categor${kids.length === 1 ? 'y' : 'ies'} <span class="chev" aria-hidden="true">›</span></button>` : ''}</div>
      <div class="tools"><button class="btn secondary" data-act="add-cat" data-parent="${c.id}">+ Sub</button><button class="btn secondary" data-act="edit-cat" data-id="${c.id}">Edit</button></div></div>`
      + (isOpen ? kids.map((k) => `<div class="brow indent">${tile(k, true)}<div><b>${esc(k.name)}</b></div><div class="tools"><button class="btn secondary" data-act="edit-cat" data-id="${k.id}">Edit</button></div></div>`).join('') : '');
  }).join('');
  return `<section class="card"><div class="card-head"><button type="button" class="legend-btn card-toggle" data-act="toggle-cats" aria-expanded="${open}"><span class="chev" aria-hidden="true">›</span><h2>Categories</h2></button><button class="btn" data-act="add-cat">+ Category</button></div>
    <p class="muted" style="margin-top:4px">${roots.length} categories · ${subs} sub-categories${open ? '. Totals and budgets roll sub-categories up into their parent.' : ''}</p>
    ${open ? `<div style="margin-top:6px">${rows}</div>` : ''}</section>`;
}
function viewSettings() {
  const p = D().profile;
  return `${topbar('Settings', 'Profile, currency and privacy')}
  <div class="stack">
  ${categoriesCard()}
  <section class="card"><div class="card-head"><h2>Profile</h2></div>
    <div class="form-row"><div>Display name<small>Shown in the greeting</small></div><div class="field"><input data-setting="name" value="${esc(p.name)}" aria-label="Display name"></div></div>
    <div class="form-row"><div>Reporting currency<small>Used for totals, budgets and charts. Wallets keep their own currency; budgets convert at demo rates.</small></div><div class="field"><select data-setting="currency" aria-label="Currency">${Object.keys(RATES).map((c) => `<option ${c === p.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div></section>
  <section class="card"><div class="card-head"><h2>Smart tagging</h2></div>
    <div class="form-row"><div>AI category suggestions<small>After about 30 labeled transactions, uncategorized ones are tagged from your history. If unsure it stays empty.</small></div><label class="switch"><input type="checkbox" data-setting="ai" ${p.ai ? 'checked' : ''} aria-label="AI tagging"></label></div></section>
  <section class="card"><div class="card-head"><h2>Account</h2></div>
    <div class="form-row"><div>Signed in as<small>${esc(state.auth.email)}</small></div><span class="badge ok">Active now</span></div>
    <div class="form-row"><div>Sign out<small>Ends the session on this device</small></div><button class="btn secondary" data-act="signout">Sign out</button></div>
    <div class="form-row"><div>Sign out everywhere else<small>Revokes every other device</small></div><button class="btn secondary" data-act="revoke">Sign out others</button></div>
    <div class="form-row"><div>Sample data<small>Fill an empty account with demo wallets, transactions, budgets and a portfolio so you can explore</small></div><button class="btn secondary" data-act="load-demo">Load sample data</button></div></section></div>`;
}

const GOOGLE_LOGO = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3A12 12 0 1 1 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7A20 20 0 1 0 44 24c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/><path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.5-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';
const authMsg = (a) => (a.error ? `<p class="auth-err" role="alert">${esc(a.error)}</p>` : '') + (a.notice ? `<p class="hint" role="status">${esc(a.notice)}</p>` : '');
const authLink = (view, text) => `<button type="button" class="legend-btn" data-act="auth-view" data-view="${view}">${text}</button>`;
function viewAuth() {
  const a = state.auth, v = a.view, logo = '<div class="logo"><img src="icon.svg" alt="">Stiver</div>';
  const emailField = `<label class="field">Email<input name="email" type="email" required autocomplete="email" placeholder="you@example.com" value="${esc(a.email)}"></label>`;
  const google = `<button type="button" class="btn secondary lg google" data-act="auth-google">${GOOGLE_LOGO} Continue with Google</button><div class="or"><span>or</span></div>`;
  let body;
  if (v === 'signup') body = `<form class="card" data-form="signup">${logo}
    <div><h2 style="font-size:24px">Create your account</h2><p class="muted">Your data is private to you and saved to your account.</p></div>
    ${google}${authMsg(a)}
    <label class="field">Name<input name="name" required placeholder="Ari Nolan" autocomplete="name"></label>
    ${emailField}
    <label class="field">Password<input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters"></label>
    <label class="field">Reporting currency<select name="currency">${Object.keys(RATES).map((c) => `<option>${c}</option>`).join('')}</select></label>
    <button class="btn lg" type="submit">Create account</button>
    <p class="muted" style="text-align:center">We'll email you a link to confirm your address. Already have an account? ${authLink('signin', 'Sign in')}</p></form>`;
  else if (v === 'forgot') body = `<form class="card" data-form="forgot">${logo}
    <div><h2 style="font-size:24px">Reset your password</h2><p class="muted">Enter your email and we'll send you a reset link.</p></div>
    ${authMsg(a)}${emailField}<button class="btn lg" type="submit">Send reset link</button>
    <p class="muted" style="text-align:center">${authLink('signin', 'Back to sign in')}</p></form>`;
  else if (v === 'recovery') body = `<form class="card" data-form="recovery">${logo}
    <div><h2 style="font-size:24px">Choose a new password</h2></div>${authMsg(a)}
    <label class="field">New password<input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters"></label>
    <button class="btn lg" type="submit">Save password</button></form>`;
  else if (v === 'sent') body = `<div class="card">${logo}
    <div><h2 style="font-size:24px">Check your email</h2><p class="muted">We sent a link to <b>${esc(a.email)}</b>. Open it to confirm your address, then sign in. If you already have an account, just sign in.</p></div>
    ${authMsg(a)}<button class="btn secondary lg" data-act="auth-resend">Resend the email</button>
    <p class="muted" style="text-align:center">${authLink('signin', 'Back to sign in')}</p></div>`;
  else body = `<form class="card" data-form="signin">${logo}
    <div><h2 style="font-size:24px">Welcome back</h2><p class="muted">Sign in to see your spending, budgets and net worth.</p></div>
    ${google}${authMsg(a)}${emailField}
    <label class="field">Password<input name="password" type="password" required autocomplete="current-password"></label>
    <button class="btn lg" type="submit">Sign in</button>
    <p class="muted" style="text-align:center">${authLink('forgot', 'Forgot password?')}</p>
    <p class="muted" style="text-align:center">New here? ${authLink('signup', 'Create an account')}</p></form>`;
  return `<div class="onboard">${body}</div>`;
}
const viewSplash = (msg) => `<div class="onboard"><div class="card" role="status"><div class="logo"><img src="icon.svg" alt="">Stiver</div><p class="muted">${esc(msg)}</p></div></div>`;

/* ---------- render ---------- */
const VIEWS = { overview: viewOverview, transactions: viewTransactions, budgets: viewBudgets, portfolio: viewPortfolio, settings: viewSettings };
function render() {
  const app = $('#app');
  const a = state.auth;
  if (a.status === 'loading') { app.innerHTML = viewSplash('Loading…'); return; }
  if (a.status === 'out' || a.view === 'recovery') { app.innerHTML = viewAuth(); return; }
  if (!D()) {
    app.innerHTML = a.loadError
      ? `<div class="onboard"><div class="card"><div class="logo"><img src="icon.svg" alt="">Stiver</div><p class="auth-err" role="alert">Couldn't load your data: ${esc(a.loadError)}</p><button class="btn lg" data-act="retry-load">Try again</button><button class="btn secondary lg" data-act="signout">Sign out</button></div></div>`
      : viewSplash('Loading your data…');
    return;
  }
  const r = VIEWS[route()] ? route() : 'overview';
  app.innerHTML = `<div class="shell">${sidebar()}<main class="main">${VIEWS[r]()}</main></div>${bottomNav()}`;
  if (r === 'portfolio') bindValue(state.chart.months, state.chart.series, state.chart.vc);
  if (r === 'overview') {
    const months = lastMonths(6);
    bindFlow(months, months.map((m) => sumBy(inMonth(m), 'income')), months.map((m) => sumBy(inMonth(m), 'expense')));
  }
}

/* ---------- dialogs ---------- */
const dlg = () => $('#dlg');
function open(html) { dlg().innerHTML = `<div class="dlg">${html}</div>`; if (!dlg().open) dlg().showModal(); }
const close = () => dlg().open && dlg().close();
const catOptions = (type, sel) => `<option value="">— None (AI may suggest) —</option>${catTree(type).map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.parent_id ? '  ↳ ' : ''}${c.icon} ${esc(c.name)}</option>`).join('')}`;

function txnDialog(t, presetType) {
  const type = t?.type || presetType || 'expense', ws = D().wallets.filter((w) => !w.archived);
  // the amount is entered in the chosen wallet's currency
  const c = t ? t.currency : (ws.find((w) => w.currency === cur()) || ws[0]).currency, step = expOf(c) ? '0.01' : '1';
  open(`<h2>${t ? 'Edit' : 'Add'} transaction</h2>
  <form data-form="txn" data-id="${t?.id || ''}" style="display:contents">
    <div class="seg ${t ? '' : 'seg3'}"><label><input type="radio" name="type" value="expense" ${type === 'expense' ? 'checked' : ''}>Expense</label><label><input type="radio" name="type" value="income" ${type === 'income' ? 'checked' : ''}>Income</label>${t ? '' : '<label><input type="radio" name="type" value="invest">Invest</label>'}</div>
    <div class="two"><label class="field"><span data-amt-label>Amount (${esc(c)})</span><input name="amount" type="number" inputmode="decimal" min="0" step="${step}" required value="${t ? toMajor(t.amount_minor, c) : ''}" autofocus></label>
      <label class="field">Date<input name="date" type="date" required value="${t?.occurred_at || isoDate(new Date())}"></label></div>
    <label class="field">Category<select name="category">${catOptions(type, t?.category_id)}</select></label>
    <label class="field">Wallet<select name="wallet">${ws.map((w) => `<option value="${w.id}" ${t ? (w.id === t.wallet_id ? 'selected' : '') : (w.currency === c && w === ws.find((x) => x.currency === c) ? 'selected' : '')}>${esc(w.name)} (${esc(w.currency)})</option>`).join('')}</select></label>
    ${D().occasions.some((o) => !o.archived || o.id === t?.occasion_id) ? `<label class="field">Special occasion (optional)<select name="occasion"><option value="">None</option>${D().occasions.filter((o) => !o.archived || o.id === t?.occasion_id).map((o) => `<option value="${o.id}" ${o.id === t?.occasion_id ? 'selected' : ''}>🎉 ${esc(o.name)}</option>`).join('')}</select></label>` : ''}
    <label class="field">Note<textarea name="note" maxlength="140" placeholder="e.g. Coffee shop">${esc(t?.note || '')}</textarea></label>
    <div class="actions">${t ? '<button type="button" class="btn danger" data-act="delete-txn" data-id="' + t.id + '">Delete</button>' : ''}<button type="button" class="btn secondary" data-act="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>`);
}
function budgetDialog(b) {
  const used = new Set(D().budgets.map((x) => x.category_id));
  const opts = [{ id: '', name: '💰 All spending (global)' }, ...catTree('expense').filter((c) => !c.parent_id).map((c) => ({ id: c.id, name: `${c.icon} ${c.name}` }))];
  open(`<h2>${b ? 'Edit' : 'Add'} budget</h2><form data-form="budget" data-id="${b?.id || ''}" style="display:contents">
    <label class="field">Applies to<select name="category" ${b ? 'disabled' : ''}>${opts.map((o) => `<option value="${o.id}" ${o.id === (b?.category_id || '') ? 'selected' : ''}>${esc(o.name)}${!b && used.has(o.id || null) ? ' (replace)' : ''}</option>`).join('')}</select></label>
    <label class="field">Monthly limit (${esc(cur())})<input name="amount" type="number" min="1" step="${expOf(cur()) ? '0.01' : '1'}" required value="${b ? toMajor(b.budget, cur()) : ''}"></label>
    <p class="hint">Applies from ${esc(monthLabel(state.ui.month))} onward until you set a new amount.</p>
    <div class="actions">${b ? `<button type="button" class="btn danger" data-act="delete-budget" data-id="${b.id}">Delete</button>` : ''}<button type="button" class="btn secondary" data-act="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>`);
}
function occasionDialog(o) {
  open(`<h2>${o ? 'Edit' : 'New'} special occasion</h2><form data-form="occasion" data-id="${o?.id || ''}" style="display:contents">
    <label class="field">Name<input name="name" required maxlength="40" value="${esc(o?.name || '')}" placeholder="e.g. Bali Trip, Birthday Dinner" autofocus></label>
    <div class="two">${o ? '' : `<label class="field">Currency<select name="currency">${Object.keys(RATES).map((c) => `<option ${c === cur() ? 'selected' : ''}>${c}</option>`).join('')}</select></label>`}
      <label class="field">Budget${o ? ` (${esc(o.currency)})` : ''}<input name="amount" type="number" min="1" step="any" required value="${o ? toMajor(o.amount_minor, o.currency) : ''}"></label></div>
    <div class="two"><label class="field">Starts (optional)<input name="start" type="date" value="${esc(o?.start || '')}"></label>
      <label class="field">Ends (optional)<input name="end" type="date" value="${esc(o?.end || '')}"></label></div>
    <p class="hint">Expenses you tag to this occasion still count in your monthly budgets. This budget is an extra view of what the occasion costs.</p>
    <div class="actions">${o ? `<button type="button" class="btn danger" data-act="delete-occasion" data-id="${o.id}">Delete</button><button type="button" class="btn secondary" data-act="archive-occasion" data-id="${o.id}">${o.archived ? 'Reopen' : 'Archive'}</button>` : ''}<button type="button" class="btn secondary" data-act="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>`);
}
const SWATCHES = ['#4A44C6', '#8B8FF0', '#F5B800', '#EC4899', '#14B8A6', '#F97316', '#EF4444', '#0EA5E9', '#22C55E', '#94A3B8'];
function catDialog(c, parentId) {
  const parent = catOf(c ? c.parent_id : parentId) || null;
  const hasKids = c && childrenOf(c.id).length > 0;
  const tops = D().categories.filter((x) => !x.parent_id && !x.archived && (!c || x.id !== c.id));
  open(`<h2>${c ? 'Edit' : 'New'} ${parent ? 'sub-category' : 'category'}</h2>
  <form data-form="cat" data-id="${c?.id || ''}" style="display:contents">
    <label class="field">Name<input name="name" required maxlength="30" value="${esc(c?.name || '')}" placeholder="e.g. Pets" autofocus></label>
    <div class="two"><label class="field">Icon (emoji)<input name="icon" maxlength="4" value="${esc(c?.icon || '🏷️')}"></label>
      <label class="field">Color<input name="color" type="color" value="${esc(c?.color || parent?.color || SWATCHES[0])}"></label></div>
    <label class="field">Parent category<select name="parent" ${hasKids ? 'disabled' : ''}><option value="">None (top-level)</option>${tops.map((x) => `<option value="${x.id}" ${parent && x.id === parent.id ? 'selected' : ''}>${x.icon} ${esc(x.name)}</option>`).join('')}</select></label>
    <label class="field">Type<select name="type" ${parent || c ? 'disabled' : ''}><option value="expense" ${c?.type === 'expense' || !c ? 'selected' : ''}>Expense</option><option value="income" ${c?.type === 'income' ? 'selected' : ''}>Income</option></select></label>
    <p class="hint">${hasKids ? 'This category has sub-categories, so it stays top-level.' : 'Sub-categories show up in the spending breakdown and roll up into their parent.'}</p>
    <div class="actions">${c ? `<button type="button" class="btn danger" data-act="archive-cat" data-id="${c.id}">Archive</button>` : ''}<button type="button" class="btn secondary" data-act="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>`);
}

/* month breakdown: parent categories, each expandable to its sub-categories */
function breakdownDialog(selId) {
  const k = state.ui.month, tree = spendTree(k), total = tree.reduce((a, n) => a + n.value, 0), c$ = cur();
  const bar = (v, of, color) => `<div class="bar"><i style="width:${of ? Math.round((v / of) * 100) : 0}%;background:${color}"></i></div>`;
  const row = (n) => {
    const has = n.subs.length > 0, pct = total ? Math.round((n.value / total) * 100) : 0;
    const head = `<span class="bk-name">${tile({ icon: n.icon, color: n.color }, true)}<b>${esc(n.name)}</b></span><span class="bk-amt num">${money(n.value, c$)} <small class="muted">${pct}%</small></span>`;
    if (!has) return `<div class="bk-item"><div class="bk-sum nochev">${head}</div>${bar(n.value, total, n.color)}
      ${n.id ? `<div class="bk-subs"><button class="legend-btn" data-act="add-cat" data-parent="${n.id}">+ Add sub-category</button></div>` : ''}</div>`;
    return `<details class="bk-item" ${String(n.id) === selId ? 'open' : ''}><summary class="bk-sum">${head}</summary>${bar(n.value, total, n.color)}
      <div class="bk-subs">${n.subs.map((s) => `<div class="bk-sub"><span>${s.icon} ${esc(s.name)}</span><span class="num">${money(s.value, c$)} <small class="muted">${Math.round((s.value / n.value) * 100)}%</small></span></div>${bar(s.value, n.value, n.color)}`).join('')}
        ${n.direct ? `<div class="bk-sub"><span class="muted">Not in a sub-category</span><span class="num">${money(n.direct, c$)}</span></div>` : ''}
        <button class="legend-btn" data-act="add-cat" data-parent="${n.id}">+ Add sub-category</button></div></details>`;
  };
  open(`<h2>Spending breakdown</h2><p class="muted" style="margin-top:-10px">${esc(monthLabel(k))} · ${money(total, c$)} total</p>
    <div class="bk">${tree.map(row).join('') || '<div class="empty">No spending this month.</div>'}</div>
    <div class="actions"><button type="button" class="btn secondary" data-act="close">Close</button></div>`);
}

function walletDialog(w) {
  const types = [['cash', 'Cash'], ['bank', 'Bank'], ['ewallet', 'E-wallet'], ['card', 'Card']];
  open(`<h2>${w ? 'Edit' : 'Add'} wallet</h2><form data-form="wallet" data-id="${w?.id || ''}" style="display:contents">
    <label class="field">Name<input name="name" required maxlength="40" placeholder="Savings" value="${esc(w?.name || '')}"></label>
    <div class="two"><label class="field">Type<select name="type">${types.map(([k, n]) => `<option value="${k}" ${k === w?.type ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    ${w ? `<label class="field">Currency<input value="${esc(w.currency)}" disabled></label>`
      : `<label class="field">Currency<select name="currency">${Object.keys(RATES).map((x) => `<option ${x === cur() ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`}</div>
    <label class="field">${w ? `Current balance (${esc(w.currency)})` : 'Opening balance'}<input name="${w ? 'balance' : 'opening'}" type="number" step="any" required value="${w ? toMajor(walletBalance(w), w.currency) : 0}"></label>
    <p class="hint">${w ? 'Changing the balance adjusts this wallet\'s starting amount, so your past transactions stay exactly as they are. The currency can\'t be changed because existing transactions use it.' : `Pick any currency, for example USD for savings. Totals convert to your reporting currency (${esc(cur())}).`}</p>
    <div class="actions">${w ? `<button type="button" class="btn danger" data-act="archive-wallet" data-id="${w.id}">Archive</button>` : ''}<button type="button" class="btn secondary" data-act="close">Cancel</button><button class="btn" type="submit">${w ? 'Save' : 'Add'}</button></div></form>`);
}

/* ---------- investment dialogs ---------- */
function accountDialog(a) {
  open(`<h2>${a ? 'Edit' : 'New'} investment account</h2><form data-form="account" data-id="${a?.id || ''}" style="display:contents">
    <label class="field">Name<input name="name" required maxlength="40" value="${esc(a?.name || '')}" placeholder="e.g. Crypto Exchange, US Brokerage" autofocus></label>
    <p class="hint">An account can hold several assets: crypto, US stocks and ETFs.</p>
    <div class="actions">${a ? `<button type="button" class="btn danger" data-act="archive-account" data-id="${a.id}">Archive</button>` : ''}<button type="button" class="btn secondary" data-act="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>`);
}
function holdingDialog(h, accId, opts = {}) {
  const accounts = activeAccounts(), info = h && assetInfo(h.symbol), invest = !!opts.invest;
  const ws = D().wallets.filter((w) => !w.archived), firstW = ws.find((w) => w.currency === cur()) || ws[0];
  open(`<h2>${h ? `Edit ${esc(info.symbol)}` : invest ? 'Add transaction' : 'Add asset'}</h2><form data-form="holding" data-id="${h?.id || ''}" ${invest ? 'data-invest="1"' : ''} style="display:contents">
    ${invest ? '<div class="seg seg3"><label><input type="radio" name="txkind" value="expense">Expense</label><label><input type="radio" name="txkind" value="income">Income</label><label><input type="radio" name="txkind" value="invest" checked>Invest</label></div>' : ''}
    <label class="field">Account<select name="account">${accounts.map((a) => `<option value="${a.id}" ${a.id === (h?.account_id || accId) ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
    ${h ? `<p><b>${esc(info.name)}</b> <span class="badge">${esc(info.type)}</span></p>` : `
    <div class="field" id="picker">Asset
      <div class="pills" role="group" aria-label="Asset type"><button type="button" class="pill on" data-act="pick-type" data-type="">All</button><button type="button" class="pill" data-act="pick-type" data-type="crypto">Crypto</button><button type="button" class="pill" data-act="pick-type" data-type="stock">US stocks &amp; ETFs</button></div>
      <input name="assetq" autocomplete="off" placeholder="Search name or ticker, e.g. BTC, AAPL, VOO" autofocus>
      <div class="results" id="asset-results" role="listbox" hidden></div>
      <div class="picked" id="picked" hidden></div>
      <small>${api.finnhub ? 'Searching the full Finnhub list of US stocks, ETFs and crypto.' : 'Live list unavailable (run tools/dev_server.py with a Finnhub key). Showing built-in assets.'}</small>
      <input type="hidden" name="asset"><input type="hidden" name="assetmeta">
      <label class="field price-fallback" hidden>Price (USD)<input name="price" type="number" min="0" step="any" placeholder="Live price unavailable, enter it"></label>
      <button type="button" class="legend-btn" data-act="manual-asset">Not listed? Add an asset manually</button></div>
    <div class="custom-fields" hidden><div class="two"><label class="field">Symbol<input name="symbol" maxlength="10" placeholder="e.g. GOLD"></label><label class="field">Name<input name="cname" maxlength="40" placeholder="Name"></label></div>
      <div class="two"><label class="field">Type<select name="ctype"><option value="crypto">Crypto</option><option value="stock">Stock</option><option value="etf">ETF</option><option value="manual">Other</option></select></label><label class="field">Price (USD)<input name="cprice" type="number" min="0" step="any"></label></div></div>`}
    ${h ? `<div class="holding-now"><div><small class="muted">You hold</small><b class="num">${qtyFmt(h.quantity)} ${esc(info.symbol)}</b></div>
      <div class="tools"><button type="button" class="btn" data-act="trade" data-side="buy" data-id="${h.id}">Buy</button><button type="button" class="btn secondary" data-act="trade" data-side="sell" data-id="${h.id}">Sell</button></div></div>
      ${tradeList(h)}` : `
    <label class="field">${invest ? 'Quantity bought' : 'Quantity you hold'}<input name="quantity" type="number" min="0" step="any" required placeholder="e.g. 0.05"></label>
    <div class="two"><label class="field">${invest ? 'Pay with' : 'Paid from'}<select name="fund">${invest ? '' : '<option value="">Already owned (no payment)</option>'}${sourceOptions('buy', null, invest && firstW ? 'w:' + firstW.id : '')}</select></label>
      <label class="field"><span data-fund-amt>Amount paid</span><input name="fundamount" type="number" min="0" step="any" ${invest ? 'required' : ''} placeholder="amount"></label></div>
    ${invest ? `<label class="field">Date<input name="date" type="date" required value="${isoDate(new Date())}"></label>` : ''}
    <p class="hint">${invest ? 'The money leaves the wallet (or your USDT/USDC balance) and the asset is added to your investments. It is not counted as spending.' : 'Choose a payment source if you just bought it. Leave it as "Already owned" for assets you held before.'}</p>`}
    <div class="actions">${h ? `<button type="button" class="btn danger" data-act="delete-holding" data-id="${h.id}">Remove</button>` : ''}<button type="button" class="btn secondary" data-act="close">${h ? 'Close' : 'Cancel'}</button><button class="btn" type="submit">${h ? 'Save' : invest ? 'Invest' : 'Add asset'}</button></div></form>`);
  if (!h) syncFund($('#dlg form'));
}
/* the amount's unit follows the payment source: a wallet's currency, or coins for a stablecoin */
function syncFund(form) {
  const src = parseSource(form.fund.value), label = $('[data-fund-amt]', form);
  label.textContent = src ? `Amount paid (${sourceUnit(src)})` : 'Amount paid';
}

/* ---------- trades ----------
   A buy or sell has two sides. The other side is either a wallet (money leaves/enters it as a
   'transfer', never income or spending) or a stablecoin you hold (USDT/USDC): the coin's quantity
   moves the opposite way as a paired trade, so everything stays in circulation. */
const stableHoldings = (excludeId) => D().holdings.filter((x) => x.id !== excludeId && activeAccounts().some((a) => a.id === x.account_id) && assetInfo(x.symbol).type === 'stablecoin');
const accountName = (id) => D().investments.find((a) => a.id === id)?.name || '';

/* option list for "pay from / receive into": wallets, held stablecoins, and (when selling) a new USDT/USDC position */
function sourceOptions(side, h, selected) {
  const ws = D().wallets.filter((w) => !w.archived), st = stableHoldings(h?.id);
  const held = new Set(st.filter((x) => x.account_id === h?.account_id).map((x) => x.symbol));
  const fresh = h && side === 'sell' ? ['USDT', 'USDC'].filter((s) => !held.has(s) && s !== h.symbol) : [];
  const sel = (v) => (v === selected ? 'selected' : '');
  return `<optgroup label="Wallets">${ws.map((w) => `<option value="w:${w.id}" ${sel('w:' + w.id)}>${esc(w.name)} (${esc(w.currency)}) · ${money(walletBalance(w), w.currency)}</option>`).join('')}</optgroup>`
    + (st.length || fresh.length ? `<optgroup label="Stablecoins">${st.map((x) => `<option value="h:${x.id}" ${sel('h:' + x.id)}>${esc(assetInfo(x.symbol).symbol)} · ${qtyFmt(x.quantity)} held (${esc(accountName(x.account_id))})</option>`).join('')}${fresh.map((s) => `<option value="n:${s}" ${sel('n:' + s)}>${s} · new in ${esc(accountName(h.account_id))}</option>`).join('')}</optgroup>` : '');
}
function parseSource(val) {
  if (!val) return null;
  const [k, id] = [val.slice(0, 1), val.slice(2)];
  if (k === 'w') return { kind: 'wallet', wallet: walletOf(id) };
  if (k === 'h') return { kind: 'holding', holding: D().holdings.find((x) => x.id === id) };
  return { kind: 'new', symbol: id };
}
const sourceUnit = (src) => (src.kind === 'wallet' ? src.wallet.currency : src.kind === 'holding' ? assetInfo(src.holding.symbol).symbol : src.symbol);
/* amount typed by the user -> stored amount: minor units for a wallet, coin units for a stablecoin */
const parseAmount = (src, text) => (src.kind === 'wallet' ? toMinor(parseFloat(text), src.wallet.currency) : parseFloat(text));

/* returns a message when the paying side can't cover a buy; null when it is fine */
function payShortfall(src, side, amount) {
  if (side !== 'buy') return null;
  if (src.kind === 'wallet' && amount > walletBalance(src.wallet)) return `${src.wallet.name} doesn't have enough balance`;
  if (src.kind === 'holding' && amount > src.holding.quantity + 1e-12) return `You only hold ${qtyFmt(src.holding.quantity)} ${assetInfo(src.holding.symbol).symbol}`;
  if (src.kind === 'new') return `You don't hold any ${src.symbol} to pay with`;
  return null;
}

function recordTrade(h, { side, quantity, source, amount, date }) {
  const id = uid(), sym = assetInfo(h.symbol).symbol, word = side === 'buy' ? 'Bought' : 'Sold';
  const addTrade = (hh, tr) => { hh.trades.push(tr); if (tr.side === 'buy' && tr.date.slice(0, 7) < hh.since) hh.since = tr.date.slice(0, 7); };
  h.quantity = r12(h.quantity + (side === 'buy' ? quantity : -quantity));
  if (source.kind === 'wallet') {
    const w = source.wallet;
    addTrade(h, { id, date, side, quantity, amount_minor: amount, currency: w.currency, wallet_id: w.id });
    D().transactions.push({ id: uid(), trade_id: id, wallet_id: w.id, category_id: null, type: 'transfer', flow: side === 'buy' ? 'out' : 'in',
      amount_minor: amount, currency: w.currency, occurred_at: date, note: `${word} ${qtyFmt(quantity)} ${sym}`, category_source: 'user', ai_confidence: null });
    D().transactions.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    return;
  }
  let s = source.holding;
  if (source.kind === 'new') { s = { id: uid(), account_id: h.account_id, symbol: source.symbol, quantity: 0, since: monthKey(new Date()), trades: [] }; D().holdings.push(s); }
  const mirror = uid(), ssym = assetInfo(s.symbol).symbol;
  s.quantity = r12(s.quantity + (side === 'buy' ? -amount : amount));
  addTrade(h, { id, date, side, quantity, via: { holding_id: s.id, symbol: ssym, quantity: amount, pair: mirror } });
  addTrade(s, { id: mirror, date, side: side === 'buy' ? 'sell' : 'buy', quantity: amount, via: { holding_id: h.id, symbol: sym, quantity, pair: id } });
}

/* undo a trade (and its paired trade, or the wallet transfer) */
function removeTrade(h, tr) {
  const other = tr.via ? D().holdings.find((x) => x.id === tr.via.holding_id) : null, ot = other?.trades.find((x) => x.id === tr.via.pair);
  const back = h.quantity - tradeSign(tr) * tr.quantity, oback = ot ? other.quantity - tradeSign(ot) * ot.quantity : 0;
  if (back < -1e-12 || oback < -1e-12) return false;
  h.quantity = r12(Math.max(0, back)); h.trades = h.trades.filter((x) => x.id !== tr.id);
  if (ot) { other.quantity = r12(Math.max(0, oback)); other.trades = other.trades.filter((x) => x.id !== ot.id); }
  D().transactions = D().transactions.filter((t) => t.trade_id !== tr.id);   // the wallet gets its money back
  return true;
}

function tradeList(h) {
  const trades = [...h.trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6), sym = assetInfo(h.symbol).symbol;
  if (!trades.length) return '<p class="muted" style="font-size:13px">No buys or sells recorded yet.</p>';
  return `<div class="list">${trades.map((tr) => {
    const tail = tr.via ? `in exchange for ${qtyFmt(tr.via.quantity)} ${esc(tr.via.symbol)}` : `${tr.side === 'buy' ? 'paid' : 'received'} ${money(tr.amount_minor, tr.currency)} · ${esc(walletOf(tr.wallet_id)?.name || 'wallet')}`;
    return `<div class="pay-row"><span>${esc(new Date(tr.date + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }))} · ${tr.side === 'buy' ? 'Bought' : 'Sold'} ${qtyFmt(tr.quantity)} ${esc(sym)}<br><small class="muted">${tail}</small></span><span></span><button type="button" class="icon-x" data-act="delete-trade" data-id="${h.id}" data-tid="${tr.id}" aria-label="Remove trade">×</button></div>`;
  }).join('')}</div>`;
}

function tradeDialog(h, side) {
  const info = assetInfo(h.symbol), ws = D().wallets.filter((w) => !w.archived), first = ws.find((w) => w.currency === cur()) || ws[0];
  open(`<h2>${side === 'buy' ? 'Buy' : 'Sell'} ${esc(info.symbol)}</h2><p class="muted" style="margin-top:-10px">You hold ${qtyFmt(h.quantity)} ${esc(info.symbol)}</p>
  <form data-form="trade" data-id="${h.id}" style="display:contents">
    <div class="seg"><label><input type="radio" name="side" value="buy" ${side === 'buy' ? 'checked' : ''}>Buy</label><label><input type="radio" name="side" value="sell" ${side === 'sell' ? 'checked' : ''}>Sell</label></div>
    <div class="two"><label class="field">Quantity<input name="quantity" type="number" min="0" step="any" required placeholder="e.g. 0.01" autofocus></label>
      <label class="field"><span data-trade-amt></span><input name="amount" type="number" min="0" step="any" required placeholder="amount"></label></div>
    <label class="field"><span data-trade-wallet></span><select name="source">${sourceOptions(side, h, first ? 'w:' + first.id : '')}</select></label>
    <label class="field">Date<input name="date" type="date" required value="${isoDate(new Date())}"></label>
    <p class="hint" id="trade-hint"></p>
    <div class="actions"><button type="button" class="btn secondary" data-act="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>`);
  syncTradeForm($('#dlg form'), false);
}
/* keep labels, the stablecoin options and the price hint in step with the side and the chosen source */
function syncTradeForm(form, rebuild) {
  const h = D().holdings.find((x) => x.id === form.dataset.id), buy = form.side.value === 'buy';
  if (rebuild) { const keep = form.source.value; form.source.innerHTML = sourceOptions(form.side.value, h, keep); }
  const src = parseSource(form.source.value);
  $('[data-trade-wallet]', form).textContent = buy ? 'Pay with' : 'Receive into';
  $('[data-trade-amt]', form).textContent = `${buy ? 'Amount paid' : 'Amount received'} (${src ? sourceUnit(src) : ''})`;
  tradeHint(form);
}
/* price per unit implied by what was typed, next to the market price */
function tradeHint(form) {
  const h = D().holdings.find((x) => x.id === form.dataset.id), src = parseSource(form.source.value), q = parseFloat(form.quantity.value), a = parseFloat(form.amount.value);
  const hint = $('#trade-hint', form), buy = form.side.value === 'buy';
  const base = `The ${src?.kind === 'wallet' ? 'money ' + (buy ? 'leaves' : 'goes into') + ' that wallet' : (buy ? 'coins are taken from' : 'coins are added to') + ' your stablecoin balance'}. Not counted as spending or income.`;
  if (!h || !src || !(q > 0) || !(a > 0)) { hint.textContent = base; return; }
  const info = assetInfo(h.symbol), month = monthKey(new Date());
  const usd = src.kind === 'wallet' ? a / RATES[src.wallet.currency] : a * assetInfo(src.kind === 'holding' ? src.holding.symbol : src.symbol).usd(month);
  const per = usd / q, market = info.usd(month), diff = market > 0 ? ((per - market) / market) * 100 : null;
  hint.textContent = `About $${per.toLocaleString('en', { maximumFractionDigits: 4 })} per ${info.symbol}` + (market > 0 ? ` (market $${market.toLocaleString('en', { maximumFractionDigits: 4 })}, ${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}%). ` : '. ') + base;
}

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const { act, id, type } = el.dataset, find = (arr) => arr.find((x) => x.id === id);
  if (act === 'close') close();
  else if (act === 'add-txn') txnDialog(null, type);
  else if (act === 'invest') holdingDialog(null, null, { invest: true });
  else if (act === 'edit-txn') txnDialog(find(D().transactions));
  else if (act === 'add-budget') budgetDialog();
  else if (act === 'edit-budget') budgetDialog(budgetStatus(state.ui.month).find((b) => b.id === id));
  else if (act === 'toggle-cats') { state.ui.catsOpen = !state.ui.catsOpen; render(); }
  else if (act === 'toggle-cat') { const o = state.ui.openCats; if (o.has(id)) o.delete(id); else o.add(id); render(); }
  else if (act === 'add-wallet') walletDialog();
  else if (act === 'add-occasion') occasionDialog();
  else if (act === 'edit-occasion') occasionDialog(occasionStatus().find((o) => o.id === id));
  else if (act === 'archive-occasion') { const o = occasionOf(id); o.archived = !o.archived; save(); close(); render(); toast(o.archived ? 'Occasion archived' : 'Occasion reopened'); }
  else if (act === 'delete-occasion') { D().occasions = D().occasions.filter((o) => o.id !== id); D().transactions.forEach((t) => { if (t.occasion_id === id) delete t.occasion_id; }); save(); close(); render(); toast('Occasion deleted. Its expenses were kept.'); }
  else if (act === 'view-occasion') { state.ui.occ = id; state.ui.q = ''; state.ui.cat = ''; state.ui.wallet = ''; const o = occasionOf(id); state.ui.month = (o.start || isoDate(new Date())).slice(0, 7); location.hash = '#/transactions'; render(); }
  else if (act === 'pf-cur') { state.ui.pf = el.dataset.cur; render(); }
  else if (act === 'pf-tab') { state.ui.pfTab = el.dataset.tab; render(); }
  else if (act === 'add-loan') loanDialog();
  else if (act === 'edit-loan') loanDialog(find(D().loans));
  else if (act === 'pay-loan') paymentDialog(find(D().loans), 'loan');
  else if (act === 'archive-loan') { find(D().loans).archived = true; save(); close(); render(); toast('Loan archived'); }
  else if (act === 'add-lent') lentDialog();
  else if (act === 'edit-lent') lentDialog(find(D().lent));
  else if (act === 'pay-lent') paymentDialog(find(D().lent), 'lent');
  else if (act === 'archive-lent') { find(D().lent).archived = true; save(); close(); render(); toast('Archived'); }
  else if (act === 'delete-payment') { const l = find(el.dataset.kind === 'lent' ? D().lent : D().loans); l.payments = l.payments.filter((p) => p.id !== el.dataset.pid); save(); render(); toast('Removed'); }
  else if (act === 'refresh-prices') { el.textContent = 'Refreshing…'; refreshPrices(false); }
  else if (act === 'pick-type') { state.ui.pickType = el.dataset.type; $$('.pill', el.parentElement).forEach((b) => b.classList.toggle('on', b === el)); runAssetSearch(); }
  else if (act === 'pick-asset') pickAsset(state.pick[+el.dataset.i], el.closest('form'));
  else if (act === 'manual-asset') { const f = el.closest('form'); f.asset.value = '__custom'; f.assetmeta.value = ''; $('#picker', f).hidden = true; $('.custom-fields', f).hidden = false; }
  else if (act === 'add-account') accountDialog();
  else if (act === 'edit-account') accountDialog(find(D().investments));
  else if (act === 'archive-account') { find(D().investments).archived = true; save(); close(); render(); toast('Account archived'); }
  else if (act === 'add-holding') holdingDialog(null, el.dataset.account);
  else if (act === 'edit-holding') holdingDialog(find(D().holdings));
  else if (act === 'trade') tradeDialog(find(D().holdings), el.dataset.side);
  else if (act === 'delete-trade') {
    const h = find(D().holdings), tr = h.trades.find((x) => x.id === el.dataset.tid);
    if (!removeTrade(h, tr)) { toast("Can't remove this: it would leave a negative holding (part of it was sold or spent since)"); return; }
    save(); render(); holdingDialog(h); toast('Trade removed and balances restored');
  }
  else if (act === 'delete-holding') { D().holdings = D().holdings.filter((x) => x.id !== id); save(); close(); render(); toast('Asset removed'); }
  else if (act === 'breakdown') breakdownDialog(id);
  else if (act === 'add-cat') catDialog(null, el.dataset.parent);
  else if (act === 'edit-cat') catDialog(catOf(id));
  else if (act === 'archive-cat') {
    [id, ...childrenOf(id).map((c) => c.id)].forEach((cid) => { catOf(cid).archived = true; });
    save(); close(); render(); toast('Category archived. Past transactions keep it.');
  }
  else if (act === 'notify') toast(budgetStatus(state.ui.month).some((b) => b.status !== 'ok') ? 'Some budgets are near or over their limit' : 'All budgets on track');
  else if (act === 'revoke') Cloud.signOut('others').then(({ error }) => toast(error ? error.message : 'Other devices signed out'));
  else if (act === 'edit-wallet') walletDialog(walletOf(id));
  else if (act === 'toggle-arch') { state.ui.archOpen = !state.ui.archOpen; render(); }
  else if (act === 'restore-wallet') { walletOf(id).archived = false; save(); render(); toast('Wallet restored'); }
  else if (act === 'delete-wallet') {
    const w = walletOf(id), n = D().transactions.filter((t) => t.wallet_id === id).length;
    if (n) { toast(`Can't delete: ${n} transaction${n === 1 ? '' : 's'} use this wallet. Restore it instead.`); return; }
    if (!confirm(`Delete "${w.name}" permanently? This can't be undone.`)) return;
    D().wallets = D().wallets.filter((x) => x.id !== id); save(); render(); toast('Wallet deleted');
  }
  else if (act === 'archive-wallet') { find(D().wallets).archived = true; save(); close(); render(); toast('Wallet archived'); }
  else if (act === 'delete-txn') { D().transactions = D().transactions.filter((t) => t.id !== id); save(); close(); render(); toast('Transaction deleted'); }
  else if (act === 'delete-budget') { D().budgets = D().budgets.filter((b) => b.id !== id); save(); close(); render(); toast('Budget deleted'); }
  else if (act === 'signout') Cloud.idle().then(() => Cloud.signOut()).then(() => { state.data = null; state.auth = { status: 'out', view: 'signin', email: '', notice: '', error: '' }; render(); });
  else if (act === 'auth-view') { Object.assign(state.auth, { view: el.dataset.view, error: '', notice: '' }); render(); }
  else if (act === 'auth-google') Cloud.google().then(({ error }) => { if (error) { state.auth.error = error.message; render(); } });
  else if (act === 'auth-resend') Cloud.resend(state.auth.email).then(({ error }) => { Object.assign(state.auth, error ? { error: error.message, notice: '' } : { error: '', notice: 'Email sent again. Check your inbox and spam folder.' }); render(); });
  else if (act === 'retry-load') { state.auth.loadError = ''; render(); loadUserData(); }
  else if (act === 'load-demo') loadDemo();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.row[data-act]')) e.target.click(); });

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('[data-bind="month"]')) { state.ui.month = t.value; render(); }
  else if (t.matches('[data-filter]')) { state.ui[t.dataset.filter] = t.value; const l = $('#txn-list'); if (l) l.innerHTML = txnListHtml(); }
  else if (t.name === 'type' && t.form?.dataset.form === 'txn') {
    if (t.value === 'invest') holdingDialog(null, null, { invest: true });
    else $('select[name=category]', t.form).innerHTML = catOptions(t.value);
  }
  else if (t.matches('[data-setting]')) applySetting(t);
  else if (t.name === 'side' && t.form?.dataset.form === 'trade') syncTradeForm(t.form, true);
  else if (t.name === 'source' && t.form?.dataset.form === 'trade') syncTradeForm(t.form, false);
  else if (t.name === 'fund' && t.form?.dataset.form === 'holding') syncFund(t.form);
  else if (t.name === 'txkind') { if (t.value !== 'invest') txnDialog(null, t.value); }
  else if (t.name === 'wallet' && t.form?.dataset.form === 'txn') {
    const wc = walletOf(t.value).currency;
    $('[data-amt-label]', t.form).textContent = `Amount (${wc})`; $('input[name=amount]', t.form).step = expOf(wc) ? '0.01' : '1';
  }
});
/* asset picker: debounced search -> result list -> pick (then fetch its live price) */
state.pick = []; state.ui.pickType = '';
let searchTimer;
function runAssetSearch() {
  const input = $('#dlg input[name=assetq]'); if (!input) return;
  clearTimeout(searchTimer);
  const q = input.value.trim(), box = $('#asset-results');
  if (!q) { box.hidden = true; return; }
  searchTimer = setTimeout(async () => {
    box.hidden = false; box.innerHTML = '<div class="res-note">Searching…</div>';
    try {
      state.pick = await searchAssets(q, state.ui.pickType);
      box.innerHTML = state.pick.map((a, i) => `<button type="button" class="res" role="option" data-act="pick-asset" data-i="${i}"><b>${esc(a.symbol)}</b><span>${esc(a.name)}</span><span class="badge">${esc(a.type)}</span></button>`).join('') || '<div class="res-note">No matches. Try another name or ticker.</div>';
    } catch (err) { box.innerHTML = `<div class="res-note">Search failed: ${esc(err.message)}</div>`; }
  }, 220);
}
async function pickAsset(a, form) {
  form.asset.value = a.key; form.assetmeta.value = JSON.stringify(a); form.price.value = '';
  $('#asset-results').hidden = true; form.assetq.value = '';
  const chip = $('#picked'), fb = $('.price-fallback', form); chip.hidden = false; fb.hidden = true;
  chip.innerHTML = `<b>${esc(a.symbol)}</b> ${esc(a.name)} <span class="badge">${esc(a.type)}</span> <span class="muted" id="picked-price"></span>`;
  if (!a.fh) return; // built-in asset: priced from the mock catalog
  $('#picked-price').textContent = 'getting price…';
  try { const p = await quote(a); form.price.value = p; $('#picked-price').textContent = `$${p.toLocaleString('en', { maximumFractionDigits: 6 })} live`; }
  catch { $('#picked-price').textContent = 'price unavailable'; fb.hidden = false; }
}

document.addEventListener('input', (e) => {
  if (e.target.form?.dataset.form === 'trade' && ['quantity', 'amount'].includes(e.target.name)) tradeHint(e.target.form);
  if (e.target.name === 'assetq') runAssetSearch();
  if (e.target.matches('[data-filter="q"]')) { state.ui.q = e.target.value; const l = $('#txn-list'); if (l) l.innerHTML = txnListHtml(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'gsearch') { state.ui.q = e.target.value; location.hash = '#/transactions'; }
});

function applySetting(el) {
  const p = D().profile, k = el.dataset.setting;
  if (k === 'name') p.name = el.value.trim() || p.name;
  else if (k === 'ai') p.ai = el.checked;
  else if (k === 'currency' && el.value !== p.currency) {
    // only the reporting currency changes; wallets and transactions keep their own currency
    const from = p.currency, to = el.value;
    D().budgets.forEach((b) => { b.amount_minor = convert(b.amount_minor, from, to); b.currency = to; });
    p.currency = to; state.ui.pf = null; toast(`Reporting currency changed to ${to}`);
  }
  save(); render();
}

document.addEventListener('submit', (e) => {
  const f = e.target, kind = f.dataset.form; if (!kind) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(f));
  if (['signin', 'signup', 'forgot', 'recovery'].includes(kind)) { submitAuth(kind, v, f); return; }
  if (kind === 'txn') {
    const type = v.type, wc = walletOf(v.wallet).currency, minor = toMinor(parseFloat(v.amount), wc), existing = f.dataset.id && D().transactions.find((t) => t.id === f.dataset.id);
    if (!(minor > 0)) { toast('Enter an amount above zero'); return; }
    const row = existing || { id: uid(), category_source: 'user', ai_confidence: null };
    Object.assign(row, { type, amount_minor: minor, currency: wc, occurred_at: v.date, wallet_id: v.wallet, note: v.note.trim(), category_id: v.category || null });
    if (type === 'expense' && v.occasion) row.occasion_id = v.occasion; else delete row.occasion_id;
    let msg = existing ? 'Saved' : 'Transaction added';
    if (v.category) { row.category_source = 'user'; row.ai_confidence = null; }
    else {
      const tag = aiTag(row.note, type);
      if (tag) { row.category_id = tag.category_id; row.category_source = 'ai'; row.ai_confidence = tag.confidence; msg = `AI tagged it as ${catOf(tag.category_id).name}`; }
      else { row.category_source = 'user'; msg += ' · left uncategorized'; }
    }
    if (!existing) D().transactions.push(row);
    D().transactions.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    state.ui.month = row.occurred_at.slice(0, 7) <= monthKey(new Date()) ? row.occurred_at.slice(0, 7) : state.ui.month;
    save(); close(); render(); toast(msg);
  }
  if (kind === 'occasion') {
    const existing = f.dataset.id && occasionOf(f.dataset.id), c = existing ? existing.currency : v.currency, minor = toMinor(parseFloat(v.amount), c), name = v.name.trim();
    if (!name || !(minor > 0)) { toast('Enter a name and a budget above zero'); return; }
    if (v.start && v.end && v.end < v.start) { toast('The end date is before the start date'); return; }
    const fields = { name, amount_minor: minor, start: v.start || '', end: v.end || '' };
    if (existing) Object.assign(existing, fields); else D().occasions.push({ id: uid(), currency: c, archived: false, ...fields });
    save(); close(); render(); toast('Occasion saved'); return;
  }
  if (kind === 'budget') {
    const minor = toMinor(parseFloat(v.amount), cur()), start = state.ui.month + '-01';
    if (f.dataset.id) { D().budgets.find((b) => b.id === f.dataset.id).amount_minor = minor; }
    else {
      const cat = v.category || null;
      const same = D().budgets.find((b) => b.category_id === cat && b.start_month === start);   // update in place: one budget per category and month
      if (same) Object.assign(same, { amount_minor: minor, currency: cur() });
      else D().budgets.push({ id: uid(), category_id: cat, amount_minor: minor, currency: cur(), start_month: start });
    }
    save(); close(); render(); toast('Budget saved');
  }
  if (kind === 'cat') {
    const existing = f.dataset.id ? catOf(f.dataset.id) : null, name = v.name.trim();
    const parent = existing && childrenOf(existing.id).length ? null : catOf(v.parent) || null;
    const type = parent ? parent.type : existing ? existing.type : v.type || 'expense';
    const dup = D().categories.some((c) => c.id !== existing?.id && !c.archived && (c.parent_id || null) === (parent?.id || null) && c.type === type && c.name.toLowerCase() === name.toLowerCase());
    if (!name || dup) { toast(dup ? 'That name already exists here' : 'Enter a name'); return; }
    const fields = { name, icon: v.icon.trim() || '🏷️', color: v.color, parent_id: parent ? parent.id : null, type };
    if (existing) Object.assign(existing, fields);
    else D().categories.push({ id: uid(), archived: false, ...fields });
    if (parent) { state.ui.catsOpen = true; state.ui.openCats.add(parent.id); }   // show the sub-category you just added
    save(); close(); render(); toast(existing ? 'Category saved' : 'Category added');
    return;
  }
  if (kind === 'wallet' && f.dataset.id) {
    const w = walletOf(f.dataset.id), name = v.name.trim(), bal = toMinor(parseFloat(v.balance), w.currency);
    if (!name || !Number.isFinite(bal)) { toast('Enter a name and a balance'); return; }
    // the shown balance = opening balance + transactions, so move the opening balance by the difference
    w.opening_balance_minor += bal - walletBalance(w);
    Object.assign(w, { name, type: v.type });
    save(); close(); render(); toast('Wallet saved'); return;
  }
  if (kind === 'wallet') {
    D().wallets.push({ id: uid(), name: v.name.trim(), type: v.type, currency: v.currency, opening_balance_minor: toMinor(parseFloat(v.opening || 0), v.currency), since: monthKey(new Date()), archived: false });
    save(); close(); render(); toast(`Wallet added in ${v.currency}`);
  }
  if (kind === 'loan') {
    const existing = f.dataset.id && D().loans.find((x) => x.id === f.dataset.id), c = existing ? existing.currency : v.currency;
    const amount = toMinor(parseFloat(v.amount), c), monthly = toMinor(parseFloat(v.monthly || 0), c);
    if (!(amount > 0) || !v.name.trim()) { toast('Enter a name and an amount above zero'); return; }
    const fields = { name: v.name.trim(), type: v.type, original_minor: amount, monthly_minor: monthly, rate: parseFloat(v.rate) || 0 };
    if (existing) Object.assign(existing, fields);
    else D().loans.push({ id: uid(), currency: c, since: monthKey(new Date()), archived: false, payments: [], ...fields });
    state.ui.pfTab = 'loan'; save(); close(); render(); toast('Loan saved'); return;
  }
  if (kind === 'lent') {
    const existing = f.dataset.id && D().lent.find((x) => x.id === f.dataset.id), c = existing ? existing.currency : v.currency;
    const amount = toMinor(parseFloat(v.amount), c);
    if (!(amount > 0) || !v.name.trim()) { toast('Enter a name and an amount above zero'); return; }
    const fields = { name: v.name.trim(), original_minor: amount, due: v.due || '', note: v.note.trim() };
    if (existing) Object.assign(existing, fields);
    else D().lent.push({ id: uid(), currency: c, since: monthKey(new Date()), archived: false, payments: [], ...fields });
    state.ui.pfTab = 'lent'; save(); close(); render(); toast('Saved'); return;
  }
  if (kind === 'payment') {
    const l = (f.dataset.kind === 'lent' ? D().lent : D().loans).find((x) => x.id === f.dataset.id), amount = toMinor(parseFloat(v.amount), l.currency);
    if (!(amount > 0)) { toast('Enter an amount above zero'); return; }
    const owed = loanBalance(l); const applied = Math.min(amount, owed);
    if (applied <= 0) { toast('Nothing left to pay'); return; }
    l.payments.push({ id: uid(), date: v.date, amount_minor: applied });
    save(); close(); render(); toast(applied < amount ? `Recorded ${money(applied, l.currency)} (the remaining balance)` : 'Recorded'); return;
  }
  if (kind === 'account') {
    const name = v.name.trim(); if (!name) return;
    if (f.dataset.id) D().investments.find((a) => a.id === f.dataset.id).name = name;
    else D().investments.push({ id: uid(), name, archived: false });
    save(); close(); render(); toast('Account saved');
  }
  if (kind === 'trade') {
    const h = D().holdings.find((x) => x.id === f.dataset.id), info = assetInfo(h.symbol), src = parseSource(v.source), side = v.side;
    const qty = parseFloat(v.quantity), amount = parseAmount(src, v.amount);
    if (!(qty > 0) || !(amount > 0)) { toast('Enter a quantity and an amount above zero'); return; }
    if (side === 'sell' && qty > h.quantity + 1e-12) { toast(`You only hold ${qtyFmt(h.quantity)} ${info.symbol}`); return; }
    const short = payShortfall(src, side, amount); if (short) { toast(short); return; }
    recordTrade(h, { side, quantity: qty, source: src, amount, date: v.date });
    save(); close(); render(); toast(`${side === 'buy' ? 'Bought' : 'Sold'} ${qtyFmt(qty)} ${info.symbol}`); return;
  }
  if (kind === 'holding') {
    if (f.dataset.id) {
      const h = D().holdings.find((x) => x.id === f.dataset.id);
      h.account_id = v.account; save(); close(); render(); toast('Saved'); return;
    }
    const qty = parseFloat(v.quantity);
    if (!(qty > 0)) { toast('Enter a quantity'); return; }
    let sym = v.asset;
    if (sym === '__custom') {
      sym = (v.symbol || '').trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
      const price = parseFloat(v.cprice);
      if (!sym || !(price > 0)) { toast('Enter a symbol and a price above zero'); return; }
      if (!CATALOG.some((c) => c[0] === sym)) D().customAssets[sym] = { symbol: sym, name: (v.cname || sym).trim(), type: v.ctype, price };
    } else {
      // picked from the Finnhub list (or the built-in fallback)
      const meta = v.assetmeta ? JSON.parse(v.assetmeta) : null;
      if (!sym || !meta) { toast('Search and pick an asset first'); return; }
      if (meta.fh) {
        const price = parseFloat(v.price);
        if (!(price > 0)) { toast('No live price yet. Enter one or wait a moment.'); return; }
        D().livePrices[sym] = price;
        if (!CATALOG.some((c) => c[0] === sym)) D().customAssets[sym] = { symbol: meta.symbol, name: meta.name, type: meta.type, fh: meta.fh, source: 'finnhub' };
      }
    }
    // paid from a wallet or a stablecoin: that side loses the money. No source = an asset you already owned.
    const src = parseSource(v.fund), paid = src ? parseAmount(src, v.fundamount || 0) : 0;
    if (src && !(paid > 0)) { toast('Enter the amount you paid'); return; }
    if (src) { const short = payShortfall(src, 'buy', paid); if (short) { toast(short); return; } }
    let h = D().holdings.find((x) => x.account_id === v.account && x.symbol === sym);
    if (!h) { h = { id: uid(), account_id: v.account, symbol: sym, quantity: 0, since: monthKey(new Date()), trades: [] }; D().holdings.push(h); }
    if (src) recordTrade(h, { side: 'buy', quantity: qty, source: src, amount: paid, date: v.date || isoDate(new Date()) });
    else h.quantity += qty;
    if (f.dataset.invest) state.ui.pfTab = 'investment';
    save(); close(); render(); toast(`${assetInfo(sym).symbol} ${src ? 'bought' : 'added'}${src ? ` · ${qtyFmt(paid)} ${sourceUnit(src)} paid` : ''}`);
  }
});

window.addEventListener('hashchange', render);
window.addEventListener('beforeunload', (e) => { if (Cloud.pending > 0) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- auth + data loading ---------- */
const friendlyAuthError = (e) => (/invalid login/i.test(e.message) ? 'Wrong email or password.' : /already registered/i.test(e.message) ? 'That email already has an account. Try signing in.' : e.message);
async function submitAuth(kind, v, f) {
  const a = state.auth, btn = $('button[type=submit]', f);
  if (btn) btn.disabled = true;
  Object.assign(a, { error: '', notice: '' }); if (v.email) a.email = v.email.trim();
  try {
    if (kind === 'signin') {
      const { error } = await Cloud.signIn(a.email, v.password);
      if (error) {
        if (/not confirmed/i.test(error.message)) Object.assign(a, { view: 'sent', notice: 'Your email is not confirmed yet. Open the link we sent you, or resend it below.' });
        else a.error = friendlyAuthError(error);
      }
    } else if (kind === 'signup') {
      const { data, error } = await Cloud.signUp(a.email, v.password, v.name.trim(), v.currency);
      if (error) a.error = friendlyAuthError(error);
      else if (!data.session) a.view = 'sent';   // email confirmation is on: wait for the link
    } else if (kind === 'forgot') {
      const { error } = await Cloud.reset(a.email);
      if (error) a.error = error.message; else a.notice = 'If that email has an account, a reset link is on its way.';
    } else if (kind === 'recovery') {
      const { error } = await Cloud.setPassword(v.password);
      if (error) a.error = error.message; else { a.view = 'signin'; toast('Password updated'); }
    }
  } catch (err) { a.error = err.message || 'Something went wrong. Try again.'; }
  render();
}

async function onAuth(event, session) {
  const a = state.auth;
  if (event === 'PASSWORD_RECOVERY') { Object.assign(a, { status: 'in', view: 'recovery', error: '', notice: '' }); render(); return; }
  if (!session) { state.data = null; Cloud.forget(); Object.assign(a, { status: 'out', uid: null }); if (a.view === 'recovery') a.view = 'signin'; render(); return; }
  a.email = session.user.email || a.email;
  if (a.uid === session.user.id && state.data) return;   // token refresh or tab refocus: nothing to reload
  Object.assign(a, { status: 'in', uid: session.user.id, loadError: '', view: a.view === 'recovery' ? 'recovery' : 'signin', error: '', notice: '' });
  render(); loadUserData();
}
async function loadUserData() {
  try {
    state.data = await Cloud.load();
    state.data.livePrices = loadPrices();
    if (api.finnhub) refreshPrices(true);
  } catch (err) { state.auth.loadError = err.message || 'network error'; }
  render();
}
/* a failed save leaves the screen ahead of the database, so show the server's truth again */
function onSaveError(err) {
  console.error(err);
  toast(`Couldn't save your last change (${String(err.message || err).slice(0, 80)}). Showing your saved data.`);
  loadUserData();
}
async function loadDemo() {
  const d = D();
  if (d.transactions.length || d.budgets.length || d.holdings.length || d.loans.length || d.lent.length) { toast('Sample data can only be loaded into an empty account'); return; }
  const s = seed(d.profile.name || 'You', cur());
  // remove the starter categories and wallet first: the database keeps category names unique and the sample set reuses them
  Object.assign(d, { categories: [], wallets: [] }); save(); await Cloud.idle();
  if (state.data !== d) return;   // the save failed and the saved data was reloaded
  Object.assign(d, { categories: s.categories, wallets: s.wallets, transactions: s.transactions, budgets: s.budgets, investments: s.investments, holdings: s.holdings, customAssets: s.customAssets, loans: s.loans, lent: s.lent });
  save(); render(); toast('Sample data loaded');
}
if (Cloud.configured) Cloud.init(onAuth, new Map(CATALOG.map((c) => [c[0], [c[1], c[2]]])), onSaveError);
else { Object.assign(state.auth, { status: 'out', error: 'The app is not connected to Supabase (missing config).' }); render(); }
/* live fiat rates replace the demo ones (works without a Finnhub key; falls back silently) */
getJSON(`/api/fx?currencies=${Object.keys(RATES).join(',')}`).then((fx) => {
  Object.assign(RATES, fx.rates); api.fx = { source: fx.source, date: fx.date };
  if (D()) render();
}).catch(() => { /* keep the built-in demo rates */ });
getJSON('/api/status').then((s) => {
  api.finnhub = !!s.finnhub;
  if (api.finnhub && D()) refreshPrices(true); // pull current prices once per page load
}).catch(() => { /* static hosting: no proxy, built-in catalog only */ });
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
