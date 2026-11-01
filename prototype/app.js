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

/* Decimal places per currency, fixed here on purpose. Asking the browser (Intl) gives different answers on
   different devices (an iPhone says IDR has 2 decimals, desktop Chrome says 0), which made the same stored
   amount read 100 times smaller on a phone. Amounts are stored in minor units using these exponents. */
const ZERO_DECIMAL = new Set(['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'UGX', 'XAF', 'XOF', 'PYG', 'RWF']);
const expOf = (cur) => (ZERO_DECIMAL.has(cur) ? 0 : 2);
const curFmt = (cur) => new Intl.NumberFormat(locale(), { style: 'currency', currency: cur, minimumFractionDigits: expOf(cur), maximumFractionDigits: expOf(cur) });
const toMinor = (major, cur) => Math.round(major * 10 ** expOf(cur));
const toMajor = (minor, cur) => minor / 10 ** expOf(cur);
const money = (minor, cur) => curFmt(cur).format(toMajor(minor, cur));
const convert = (minor, from, to) => (from === to ? minor : Math.round((toMajor(minor, from) / RATES[from]) * RATES[to] * 10 ** expOf(to)));
const usdToMinor = (usd, cur) => toMinor(usd * RATES[cur], cur);
const compact = (minor, cur) => new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(toMajor(minor, cur));
function moneyHtml(minor, cur) {
  return curFmt(cur).formatToParts(toMajor(minor, cur))
    .map((p) => (p.type === 'fraction' || p.type === 'decimal' ? `<span class="dim">${p.value}</span>` : esc(p.value))).join('');
}

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
/* ---------- budget periods ----------
   A "month" key (YYYY-MM) names the period that STARTS in that month. With the default start day 1 a period is a calendar
   month; with start day 25 the period "2026-10" runs 25 Oct to 24 Nov (set in Settings, saved on the profile). */
const periodDay = () => (state.data && state.data.profile && state.data.profile.period) || 1;
const periodStart = (k) => `${k}-${pad(periodDay())}`;
const periodEnd = (k) => { const d = periodDay(), y = +k.slice(0, 4), m = +k.slice(5, 7) - 1; return d === 1 ? `${k}-${pad(new Date(y, m + 1, 0).getDate())}` : isoDate(new Date(y, m + 1, d - 1)); };
const inPeriod = (iso, k) => iso >= periodStart(k) && iso <= periodEnd(k);
const periodKeyOf = (iso) => (+iso.slice(8, 10) >= periodDay() ? iso.slice(0, 7) : monthKey(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 2, 1)));
const currentPeriod = () => periodKeyOf(isoDate(new Date()));
/* "since" fields (wallet, holding, loan) are calendar months of creation; a period includes anything that started by its last day */
const liveIn = (since, k) => `${since || '0000-00'}-01` <= periodEnd(k);
const monthLabel = (k, style = 'long') => {
  const d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1);
  if (style !== 'long') return d.toLocaleDateString(locale(), { month: 'short' });
  if (periodDay() === 1) return d.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  const f = (iso) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  return `${f(periodStart(k))} – ${f(periodEnd(k))}`;
};
/* compact label for filters: "Oct 2026", or "Oct 25–Nov 24" when the period does not start on the 1st */
const periodShort = (k) => {
  if (periodDay() === 1) return new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'short', year: 'numeric' });
  const f = (iso) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  return `${f(periodStart(k))}–${f(periodEnd(k))}`;
};
const periodName = (k) => (periodDay() === 1 ? new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'long' }) : monthLabel(k));
const lastMonths = (n) => { const c = currentPeriod(), t = new Date(+c.slice(0, 4), +c.slice(5, 7) - 1, 1); return Array.from({ length: n }, (_, i) => monthKey(new Date(t.getFullYear(), t.getMonth() - (n - 1 - i), 1))); };

/* ---------- icons ---------- */
const ICON = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  swap: '<path d="M7 4v16M7 4L3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4"/>',
  pie: '<path d="M12 3v9h9A9 9 0 1 1 12 3z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1zM16 14h2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
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
const TYPE_COLOR = { crypto: '#F5B800', stablecoin: '#14B8A6', stock: '#4A44C6', etf: '#8B8FF0', commodity: '#D97706', manual: '#94A3B8' };
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
  const live = D().livePrices?.[key], thisMonth = currentPeriod();
  const c = CATALOG.find((x) => x[0] === key);
  if (c) return { key, symbol: key, name: c[1], type: c[2], usd: (k) => (k === thisMonth && live > 0 ? live : priceSeries(key)[Math.max(0, lastMonths(6).indexOf(k))]) };
  const m = D().customAssets[key] || { name: key, type: 'manual', price: 0 };
  return { key, symbol: m.symbol || key, name: m.name, type: m.type, fh: m.fh, yh: m.yh, mult: m.mult, usd: () => (live > 0 ? live : m.price || 0) };
};

/* Finnhub proxy (tools/dev_server.py). Without it the picker falls back to the built-in catalog. */
const api = { finnhub: false, yahoo: false, fx: null };   // yahoo = IDX stocks and commodities (no key needed)
async function getJSON(url) {
  const r = await fetch(url); const j = await r.json();
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
async function searchAssets(q, type) {
  if (api.yahoo && (type === 'idx' || type === 'commodity')) return (await getJSON(`/api/assets?q=${encodeURIComponent(q)}&type=${type}&limit=25`)).results;
  if (api.finnhub) return (await getJSON(`/api/assets?q=${encodeURIComponent(q)}&type=${type}&limit=25`)).results;
  const ql = q.toUpperCase();
  const base = CATALOG.filter((c) => (!type || (type === 'crypto' ? ['crypto', 'stablecoin'] : ['stock', 'etf']).includes(c[2])) && (c[0].includes(ql) || c[1].toUpperCase().includes(ql)))
    .map((c) => ({ key: c[0], symbol: c[0], name: c[1], type: c[2] }));
  if (api.yahoo && !type) { try { return [...base, ...(await getJSON(`/api/assets?q=${encodeURIComponent(q)}&type=commodity&limit=5`)).results]; } catch { /* just the built-in list */ } }
  return base;
}
const priceClass = (type) => (type === 'crypto' || type === 'stablecoin' ? 'crypto' : 'stock');
async function quoteFull(a) {   // { price (USD), native, currency }
  if (a.yh) return getJSON(`/api/price?symbol=${encodeURIComponent(a.symbol)}&yh=${encodeURIComponent(a.yh)}&mult=${a.mult || 1}`);
  return getJSON(`/api/price?symbol=${encodeURIComponent(a.symbol)}&type=${priceClass(a.type)}&fh=${encodeURIComponent(a.fh || '')}`);
}
const quote = async (a) => (await quoteFull(a)).price;
async function refreshPrices(silent) {
  if (!api.finnhub && !api.yahoo) { if (!silent) toast('Live prices need the dev server and a Finnhub key'); return; }
  const keys = [...new Set(D().holdings.map((h) => h.symbol))]; let ok = 0;
  for (const key of keys) {
    const info = assetInfo(key);
    if (info.yh ? !api.yahoo : !api.finnhub) continue;   // that price source is not available
    try { D().livePrices[key] = await quote(info); ok++; } catch { /* keep the previous price */ }
  }
  save(); if (route() === 'portfolio') render();
  if (!silent) toast(__('Updated {ok} of {n} prices', { ok, n: keys.length }));
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

const state = { data: null, real: null, auth: { status: 'loading', view: 'landing', email: '', notice: '', error: '' }, ui: { month: monthKey(new Date()), q: '', cat: '', wallet: '', catsOpen: false, openCats: new Set(), archOpen: false } };
function loadPrices() { try { return JSON.parse(localStorage.getItem(PRICES_KEY)) || {}; } catch { return {}; } }
function save() {
  if (state.real) return;   // demo mode: nothing is saved or synced
  try { localStorage.setItem(PRICES_KEY, JSON.stringify(state.data.livePrices)); } catch { /* storage unavailable */ }
  Cloud.save(state.data);   // sends only what changed since the last save
}

/* ---------- selectors (mirror the SQL functions) ---------- */
const D = () => state.data;
const cur = () => D().profile.currency;
const occasionOf = (id) => D().occasions.find((o) => o.id === id);
/* special-occasion budgets: a one-off amount; spent = expenses tagged to it (converted to the reporting currency) */
// an occasion belongs to the months its dates span (or any month with an expense tagged to it); undated ones show every month
const occasionInMonth = (o, k) => !o.start || (o.start <= periodEnd(k) && (o.end || o.start) >= periodStart(k)) || D().transactions.some((t) => t.occasion_id === o.id && inPeriod(t.occurred_at, k));
function occasionStatus() {
  return D().occasions.map((o) => {
    const txns = D().transactions.filter((t) => t.occasion_id === o.id && t.type === 'expense' && t.occurred_at <= todayIso());
    const budget = convert(o.amount_minor, o.currency, cur()), spent = txns.reduce((a, t) => a + amt(t), 0), pct = (spent * 100) / budget;
    return { ...o, count: txns.length, budget, spent, remaining: budget - spent, pct, status: spent > budget ? 'exceeded' : pct >= 80 ? 'warning' : 'ok' };
  });
}
const catOf = (id) => D().categories.find((c) => c.id === id);
const walletOf = (id) => D().wallets.find((w) => w.id === id);
const inMonth = (k) => D().transactions.filter((t) => inPeriod(t.occurred_at, k) && t.occurred_at <= todayIso());   // money not yet received or spent is left out of every total
/* a transaction's amount in the reporting currency (each wallet keeps its own currency) */
const amt = (t) => convert(t.amount_minor, t.currency, cur());
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
const totalBalance = () => D().wallets.filter((w) => !w.archived).reduce((a, w) => a + convert(walletBalance(w), w.currency, cur()), 0);
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
  const txns = inMonth(k).filter((t) => t.type === 'expense');
  return [...scopes.values()].map((b) => {
    const spent = txns.filter((t) => b.category_id === null || (t.category_id && rootOf(t.category_id) === b.category_id)).reduce((a, t) => a + amt(t), 0);
    const pct = (spent * 100) / b.amount_minor;
    const status = spent > b.amount_minor ? 'exceeded' : pct >= 80 ? 'warning' : 'ok';
    const c = catOf(b.category_id);
    return { id: b.id, category_id: b.category_id, name: c ? c.name : __('All spending'), icon: c ? c.icon : '💰', color: c ? c.color : '#4A44C6', budget: b.amount_minor, spent, remaining: b.amount_minor - spent, pct, status, start_month: b.start_month };
  }).sort((a, b) => (a.category_id === null ? -1 : b.category_id === null ? 1 : a.name.localeCompare(b.name)));
}

/* ---------- portfolio (investments), valued in USD then shown in a chosen currency ---------- */
const activeAccounts = () => D().investments.filter((a) => !a.archived);
const holdingsOf = (accId) => D().holdings.filter((h) => h.account_id === accId);
/* buys/sells: each trade moves quantity and cash together. Quantity at a month end is today's
   quantity minus the trades that happen after that month. */
const tradeSign = (tr) => (tr.side === 'buy' ? 1 : -1);
const r12 = (x) => Math.round(x * 1e12) / 1e12;   // keep quantities free of floating-point dust
const qtyAt = (h, k) => h.quantity - h.trades.filter((tr) => tr.date > [periodEnd(k), todayIso()].sort()[0]).reduce((a, tr) => a + tradeSign(tr) * tr.quantity, 0);
const heldNow = (h) => qtyAt(h, currentPeriod());   // what you hold today (trades dated later are not in yet)
const holdingUSD = (h, k) => (!liveIn(h.since, k) ? 0 : Math.max(0, qtyAt(h, k)) * assetInfo(h.symbol).usd(k));
const portfolioUSD = (k, accId) => D().holdings
  .filter((h) => (accId ? h.account_id === accId : activeAccounts().some((a) => a.id === h.account_id)))
  .reduce((a, h) => a + holdingUSD(h, k), 0);
const qtyFmt = (q) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 8 }).format(q);
const pctFmt = (p) => (p === null ? '—' : `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`);
const pf = () => state.ui.pf || cur();
/* time frame of the Portfolio chart and history list (month granularity) */
const PF_RANGES = [['1m', 1, '1 month'], ['3m', 3, '3 months'], ['6m', 6, '6 months'], ['9m', 9, '9 months'], ['1y', 12, '1 year'], ['3y', 36, '3 years'], ['5y', 60, '5 years'], ['all', 0, 'All time']];
const monthsBetween = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
function earliestMonth() {
  const d = D(), all = [...d.wallets.map((w) => w.since), ...d.holdings.map((h) => h.since), ...d.loans.map((l) => l.since), ...(d.lent || []).map((l) => l.since), ...d.transactions.map((t) => periodKeyOf(t.occurred_at))].filter((x) => x && /^\d{4}-\d{2}/.test(x)).map((x) => x.slice(0, 7));
  return all.length ? all.sort()[0] : currentPeriod();
}
function pfMonths() {
  const sel = PF_RANGES.find((r) => r[0] === (state.ui.pfRange || '6m')) || PF_RANGES[2], now = currentPeriod();
  const n = sel[1] ? Math.max(sel[1], 2) : Math.min(Math.max(monthsBetween(earliestMonth(), now) + 1, 2), 600);   // 1 month still needs two points to draw a line
  return lastMonths(n);
}
const pfRangeSelect = () => `<select class="chip pill-select" data-bind="pfRange" aria-label="${__('Time frame')}">${PF_RANGES.map((r) => `<option value="${r[0]}" ${r[0] === (state.ui.pfRange || '6m') ? 'selected' : ''}>${__(r[2])}</option>`).join('')}</select>`;

/* ---------- savings, loans and net worth (everything is compared in USD, shown in a chosen currency) ---------- */
const toUSD = (minor, c) => toMajor(minor, c) / RATES[c];
const savingsUSD = (k) => toUSD(balanceAtEnd(k), cur());
const activeLoans = () => D().loans.filter((l) => !l.archived);
const paidOf = (l, upto) => l.payments.filter((p) => !upto || p.date <= upto).reduce((a, p) => a + p.amount_minor, 0);
const loanBalance = (l, upto) => Math.max(0, l.original_minor - paidOf(l, upto || todayIso()));   // payments dated later have not been made yet
const loanUSD = (k) => activeLoans().reduce((a, l) => (!liveIn(l.since, k) ? a : a + toUSD(loanBalance(l, [periodEnd(k), todayIso()].sort()[0]), l.currency)), 0);
/* money you lent out: shares the loan shape (original amount + payments received) but counts as an asset */
const activeLent = () => D().lent.filter((l) => !l.archived);
const lentUSD = (k) => activeLent().reduce((a, l) => (!liveIn(l.since, k) ? a : a + toUSD(loanBalance(l, [periodEnd(k), todayIso()].sort()[0]), l.currency)), 0);
const typeLabel = (t) => __({ cash: 'Cash', bank: 'Bank', ewallet: 'E-wallet', card: 'Card', expense: 'Expense', income: 'Income', crypto: 'Crypto', stablecoin: 'Stablecoin', stock: 'Stock', etf: 'ETF', commodity: 'Commodity', manual: 'Other' }[t] || t);
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
  el.textContent = __(msg); el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}
const tile = (c, sm) => `<span class="tile ${sm ? 'sm' : ''}" style="--c:${c ? c.color : '#94A3B8'}">${c ? c.icon : '❔'}</span>`;
const monthSelect = (short) => `<select class="pill-select" data-bind="month" aria-label="${__('Month')}">${lastMonths(6).reverse().map((k) => `<option value="${k}" ${k === state.ui.month ? 'selected' : ''}>${short ? periodShort(k) : monthLabel(k)}</option>`).join('')}</select>`;
const routeParts = () => (location.hash.replace('#/', '') || 'overview').split('?')[0].split('/');
const route = () => { const r = routeParts()[0]; return r === 'wallets' ? 'portfolio' : r; };
const routeArg = () => routeParts()[1] || '';

/* ---------- charts (hand-built SVG) ---------- */
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
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${__('Income versus spending by month')}">
      ${ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" style="stroke:var(--line)"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted)">${esc(compact(t, cur()))}</text>`).join('')}
      <path d="${area}" fill="#8B8FF0" fill-opacity=".16"/>
      <path d="${line(inc)}" fill="none" stroke="#4A44C6" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="${line(exp)}" fill="none" stroke="#F5B800" stroke-width="2.5" stroke-linejoin="round"/>
      ${months.map((k, i) => `<circle cx="${x(i)}" cy="${y(inc[i])}" r="4" fill="#4A44C6"/><circle cx="${x(i)}" cy="${y(exp[i])}" r="4" fill="#F5B800"/><text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" style="fill:var(--muted)">${monthLabel(k, 'short')}</text>`).join('')}
      <line id="flow-cursor" x1="0" x2="0" y1="${pt}" y2="${H - pb}" style="stroke:var(--ink)" stroke-width="1.5" opacity="0"/>
    </svg><div class="tip" id="flow-tip"></div></div>
    <div class="legend-row" style="margin-top:10px"><span><i style="background:#4A44C6"></i>${__('Income')}</span><span><i style="background:#F5B800"></i>${__('Spending')}</span></div>`;
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
  // a donut: one arc per category (top 5 + Others). Hover (mouse) or tap shows name, amount and share in the centre.
  const cx = 130, R = 100, SW = 40, C = 2 * Math.PI * R, GAP = 3;
  const top = items.slice(0, 5), rest = items.slice(5).reduce((a, i) => a + i.value, 0);
  const parts = rest ? [...top, { name: __('Others'), color: '#CBD0E8', value: rest }] : top;
  let acc = 0;
  const arcs = total ? parts.map((p, i) => {
    const f = p.value / total, len = Math.max(f * C - (parts.length > 1 ? GAP : 0), 0.5), off = -acc * C; acc += f;
    const pct = f * 100, pctTxt = pct > 0 && pct < 1 ? '<1%' : pct.toLocaleString(locale(), { maximumFractionDigits: 1 }) + '%';
    return `<circle class="dseg" cx="${cx}" cy="${cx}" r="${R}" fill="none" stroke="${p.color}" stroke-width="${SW}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${cx} ${cx})" data-name="${esc(p.name)}" data-amt="${esc(money(p.value, cur()))}" data-pct="${pctTxt}" data-color="${p.color}" tabindex="0" role="img" aria-label="${esc(p.name)}: ${esc(money(p.value, cur()))}, ${pctTxt}"/>`;
  }).join('') : `<circle cx="${cx}" cy="${cx}" r="${R}" fill="none" stroke="#E6E8F5" stroke-width="${SW}"/>`;
  const dflt = `<p>${__('Spent in {month}', { month: esc(periodName(state.ui.month)) })}</p><b class="num" style="--len:${money(total, cur()).length}">${money(total, cur())}</b>`;
  return `<div class="donut"><svg viewBox="0 0 260 260" class="chart" role="group" aria-label="${__('Spending by category')}">${arcs}</svg>
    <div class="center" data-default="${esc(dflt)}">${dflt}</div></div>`;
}
// centre readout for the donut: hover on a mouse, tap to pin on touch; tap the same arc or anywhere else to clear
function donutShow(seg) {
  const wrap = seg.closest('.donut'), c = $('.center', wrap), svg = $('svg', wrap);
  $$('.dseg', wrap).forEach((x) => x.classList.toggle('on', x === seg));
  svg.classList.add('has-sel');
  const amt = seg.dataset.amt;
  c.innerHTML = `<p><i style="background:${seg.dataset.color}"></i>${seg.dataset.name}</p><b class="num" style="--len:${amt.length}">${amt}</b><p class="pct">${seg.dataset.pct} ${__('of total spending')}</p>`;
}
function donutReset(wrap) {
  if (!wrap || wrap.dataset.pinned) return;
  $$('.dseg', wrap).forEach((x) => x.classList.remove('on')); $('svg', wrap).classList.remove('has-sel');
  const c = $('.center', wrap); c.innerHTML = c.dataset.default;
}
document.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') { const g = e.target.closest('.dseg'); if (g && !g.closest('.donut').dataset.pinned) donutShow(g); } });
document.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && e.target.closest && e.target.closest('.dseg')) donutReset(e.target.closest('.donut')); });
document.addEventListener('click', (e) => {
  const g = e.target.closest && e.target.closest('.dseg');
  $$('.donut[data-pinned]').forEach((w) => { if (!g || g.closest('.donut') !== w || g.classList.contains('on')) { delete w.dataset.pinned; donutReset(w); } });
  if (g && !g.closest('.donut').dataset.pinned) { g.closest('.donut').dataset.pinned = '1'; donutShow(g); }
});
document.addEventListener('focusin', (e) => { const g = e.target.closest && e.target.closest('.dseg'); if (g) donutShow(g); });

function valueChart(months, usd, vc) {
  const W = 560, H = 250, pl = 58, pr = 18, pt = 14, pb = 30;
  const vals = usd.map((u) => u * RATES[vc]);
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.18 || hi * 0.1 || 1;
  const min = Math.max(0, lo - pad), max = hi + pad;
  const x = (i) => pl + ((W - pl - pr) * i) / (months.length - 1);
  const y = (v) => pt + (H - pt - pb) * (1 - (v - min) / (max - min));
  const cmp = (v) => new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(v);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3);
  return `<div class="chart-wrap" id="pf"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${__('Portfolio value by month')}">
    <defs><linearGradient id="pfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A44C6" stop-opacity=".25"/><stop offset="1" stop-color="#4A44C6" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" style="stroke:var(--line)"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted)">${cmp(t)}</text>`).join('')}
    <path d="${line} L${x(vals.length - 1)},${H - pb} L${x(0)},${H - pb} Z" fill="url(#pfg)"/>
    <path d="${line}" fill="none" stroke="#4A44C6" stroke-width="2.5" stroke-linejoin="round"/>
    ${vals.map((v, i) => { const step = Math.ceil(months.length / 6), last = months.length - 1, show = i === last || (i % step === 0 && last - i >= step / 2), lbl = months.length > 12 ? new Date(+months[i].slice(0, 4), +months[i].slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'short', year: '2-digit' }) : monthLabel(months[i], 'short'); return (months.length <= 14 || i === last ? `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="#4A44C6"/>` : '') + (show ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" style="fill:var(--muted)">${lbl}</text>` : ''); }).join('')}
    <line id="pf-cursor" x1="0" x2="0" y1="${pt}" y2="${H - pb}" style="stroke:var(--ink)" stroke-width="1.5" opacity="0"/></svg><div class="tip" id="pf-tip"></div></div>`;
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
    tip.textContent = `${new Date(+months[i].slice(0, 4), +months[i].slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'short', year: 'numeric' })}: ${money(usdToMinor(usd[i], vc), vc)} (${pctFmt(mom)} MoM)`;
    tip.style.left = `${(cx / W) * r.width}px`; tip.style.top = `${r.height * 0.3}px`; tip.style.opacity = 1;
  });
  svg.addEventListener('pointerleave', () => { tip.style.opacity = 0; cursor.setAttribute('opacity', 0); });
}

function holdingRow(h, vc, accTotal) {
  const info = assetInfo(h.symbol), k = lastMonths(6)[5], price = info.usd(k), value = heldNow(h) * price;
  return `<div class="row" data-act="edit-holding" data-id="${h.id}" tabindex="0"><span class="tile sym" style="--c:${TYPE_COLOR[info.type]}">${esc(info.symbol.slice(0, 4))}</span>
    <div><div class="title">${esc(info.name)} <span class="badge">${esc(typeLabel(info.type))}</span></div><div class="sub num">${qtyFmt(heldNow(h))} ${esc(info.symbol)} ×${money(usdToMinor(price, vc), vc)}</div></div>
    <div class="amt num">${money(usdToMinor(value, vc), vc)}<div class="sub">${accTotal ? Math.round((value / accTotal) * 100) : 0}%</div></div></div>`;
}

/* archived wallets: hidden from totals; can be restored, or deleted for good when no transaction uses them */
function archivedWallets() {
  const list = D().wallets.filter((w) => w.archived); if (!list.length) return '';
  const open = state.ui.archOpen;
  return `<div style="margin-top:18px"><button type="button" class="legend-btn card-toggle" data-act="toggle-arch" aria-expanded="${open}"><span class="chev" aria-hidden="true">›</span><b>${__('Archived accounts ({n})', { n: list.length })}</b></button>
    ${open ? list.map((w) => { const n = D().transactions.filter((t) => t.wallet_id === w.id).length;
      return `<div class="brow wrap">${tile({ icon: '👛', color: '#94A3B8' })}<div><b>${esc(w.name)}</b> <span class="badge">${esc(typeLabel(w.type))} · ${esc(w.currency)}</span><br><small class="muted">${money(walletBalance(w), w.currency)} · ${n} transaction${n === 1 ? '' : 's'}</small></div>
        <div class="tools"><button class="btn secondary" data-act="restore-wallet" data-id="${w.id}">${__('Restore')}</button><button class="btn danger" data-act="delete-wallet" data-id="${w.id}">${__('Delete')}</button></div></div>`; }).join('') : ''}</div>`;
}
/* every list on Portfolio is sorted from the highest amount (compared in one currency) */
const byValue = (val) => (a, b) => val(b) - val(a);
const walletCard = (w) => {
  const open = state.ui.walletMenu === w.id;
  return `<div class="wallet"><div class="wtop"><div class="wtitle"><b class="wname">${esc(w.name)}</b><span class="kind">${esc(typeLabel(w.type))} · ${esc(w.currency)}</span></div>
    <div class="menu-wrap"><button type="button" class="dots" data-act="wallet-menu" data-id="${w.id}" aria-label="${__('More actions')}" aria-haspopup="menu" aria-expanded="${open}">⋯</button>
      ${open ? `<div class="menu" role="menu"><button type="button" role="menuitem" data-act="edit-wallet" data-id="${w.id}">${__('Edit')}</button><button type="button" role="menuitem" class="warn" data-act="archive-wallet" data-id="${w.id}">${__('Archive')}</button></div>` : ''}</div></div>
    <b class="num bal">${money(walletBalance(w), w.currency)}</b>${w.currency !== cur() ? `<small class="muted num">≈ ${money(convert(walletBalance(w), w.currency, cur()), cur())}</small>` : ''}</div>`;
};
/* the biggest 3 accounts show first; See more / Show less toggles the rest */
const walletCards = () => {
  const all = D().wallets.filter((w) => !w.archived).sort(byValue((w) => toUSD(walletBalance(w), w.currency))), more = !!state.ui.walletsMore, rest = all.length - 3;
  return all.map((w, i) => walletCard(w).replace('<div class="wallet"', i >= 3 ? '<div class="wallet more-item"' : '<div class="wallet"')).join('')
    + (rest > 0 ? `<button type="button" class="see-more" data-act="toggle-more" data-key="wallets" aria-expanded="${more}">${more ? __('Show less') : __('See more ({n})', { n: rest })}<span class="chev" aria-hidden="true">${more ? '⌃' : '⌄'}</span></button>` : '');
};


/* one card for both kinds: 'loan' = debt you owe, 'lent' = money others owe you */
function loanCard(l, vc, kind = 'loan') {
  const lent = kind === 'lent', coll = lent ? D().lent : D().loans;
  const bal = loanBalance(l), paid = paidOf(l), pct = l.original_minor ? Math.min(100, Math.round((paid / l.original_minor) * 100)) : 0;
  const shown = (m) => money(convert(m, l.currency, vc), vc);
  const recent = [...l.payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const word = lent ? __('repayment') : __('payment');
  const meta = lent ? `${l.due ? __('Due {date}', { date: new Date(l.due + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' }) }) : __('No due date')}${l.note ? ` · ${esc(l.note)}` : ''}`
    : `${l.monthly_minor ? __('Monthly {amount}', { amount: shown(l.monthly_minor) }) : ''}${l.rate ? ` · ${l.rate}% APR` : ''}`;
  return `<section class="card"><div class="card-head"><div><h2>${esc(l.name)} <span class="badge">${lent ? __('Lent') : esc(__(LOAN_TYPES[l.type] || 'Loan'))}</span></h2>
      <div class="big num" style="font-size:26px;margin-top:4px">${shown(bal)}</div>${l.currency !== vc ? `<small class="muted num">${money(bal, l.currency)} ${esc(l.currency)}</small>` : ''}</div>
      <div class="tools"><button class="btn secondary" data-act="edit-${kind}" data-id="${l.id}">${__('Edit')}</button><button class="btn" data-act="pay-${kind}" data-id="${l.id}">+ ${lent ? __('Repayment') : __('Payment')}</button></div></div>
    <div class="bar"><i style="width:${pct}%;${lent ? 'background:#1fa971' : ''}"></i></div>
    <div class="loan-meta"><span>${__(lent ? '{pct}% repaid · {paid} of {total}' : '{pct}% paid · {paid} of {total}', { pct, paid: shown(paid), total: shown(l.original_minor) })}</span><span>${meta}</span></div>
    ${bal === 0 ? `<p class="hint" style="margin-top:10px">${lent ? __('Fully repaid. You can archive this.') : __('Paid off. You can archive this.')}</p>` : ''}
    ${recent.length ? `<div class="list" style="margin-top:10px">${recent.map((p) => `<div class="pay-row"><span>${esc(new Date(p.date + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' }))}</span><span class="num">${shown(p.amount_minor)}</span><button class="icon-x" data-act="delete-payment" data-kind="${kind}" data-id="${l.id}" data-pid="${p.id}" aria-label="${__('Remove {what}', { what: word })}">×</button></div>`).join('')}</div>` : `<p class="muted" style="margin-top:10px">${__('No {what}s yet.', { what: word })}</p>`}</section>`;
}

/* an (i) button with a small popover: tap/click toggles it, hover shows it on desktop, tapping elsewhere closes it */
const infoTip = (id, text) => `<span class="info-wrap${state.ui.infoOpen === id ? ' open' : ''}"><button type="button" class="info-btn" data-act="toggle-info" data-id="${id}" aria-expanded="${state.ui.infoOpen === id}" aria-label="${__('Info')}">i</button><span class="info-pop" role="tooltip">${esc(text)}</span></span>`;
function viewPortfolio() {
  const months = lastMonths(6), vc = pf(), base = cur(), tab = state.ui.pfTab || 'savings';
  const S = months.map(savingsUSD), I = months.map((k) => portfolioUSD(k)), L = months.map(loanUSD), LT = months.map(lentUSD);
  const N = months.map((_, i) => S[i] + I[i] + LT[i] - L[i]);
  const now = N[5], prev = N[4], mom = prev > 0 ? ((now - prev) / prev) * 100 : null;
  const m = (usd) => money(usdToMinor(usd, vc), vc);
  const assets = S[5] + I[5] + LT[5];
  const share = (v) => (assets > 0 ? Math.round((v / assets) * 100) : 0);
  const rm = pfMonths(), series = rm.map({ savings: savingsUSD, investment: (k) => portfolioUSD(k), lent: lentUSD, loan: loanUSD }[tab]);
  state.chart = { months: rm, series, vc };
  const titles = { savings: __('Savings over time'), investment: __('Investment growth month over month'), lent: __('Money lent over time'), loan: __('Loan balance over time') };
  const months6 = rm.map((k, i) => {
    const d = i ? series[i] - series[i - 1] : null, p = i && series[i - 1] > 0 ? (d / series[i - 1]) * 100 : null;
    const good = p === null ? '' : (tab === 'loan' ? p <= 0 : p >= 0) ? 'up' : 'down';
    // a list, not a table: the value gets its own line, so figures of any size (hundreds of billions) never push other columns off screen
    const chg = d === null ? '—' : `${d >= 0 ? '+' : '−'}${m(Math.abs(d))}`;
    return `<div class="mrow"><span class="mname">${esc(new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'short', year: 'numeric' }))}</span><div class="mval"><b class="num">${m(series[i])}</b><small class="num">${chg}${p === null ? '' : ` · <span class="${good}">${pctFmt(p)}</span>`}</small></div></div>`;
  }).reverse();
  const histMore = !!state.ui.histMore, histRest = months6.length - 3;
  const histHtml = months6.map((r, i) => (i >= 3 ? r.replace('<div class="mrow">', '<div class="mrow more-item">') : r)).join('')
    + (histRest > 0 ? `<button type="button" class="see-more" data-act="toggle-more" data-key="hist" aria-expanded="${histMore}">${histMore ? __('Show less') : __('See more ({n})', { n: histRest })}<span class="chev" aria-hidden="true">${histMore ? '⌃' : '⌄'}</span></button>` : '');
  const noData = series.every((v) => !v);   // nothing to chart yet: say so instead of a flat line and a table of zeros
  const growth = noData ? `<section class="card" style="margin-top:20px"><div class="card-head"><h2>${titles[tab]}</h2>${pfRangeSelect()}</div>
    <div class="empty sm">${__('Nothing to chart yet. This fills in as you add {what}.', { what: { savings: __('accounts'), investment: __('investments'), lent: __('money you lent'), loan: __('loans') }[tab] })}</div></section>`
    : `<section class="card" style="margin-top:20px"><div class="card-head"><h2>${titles[tab]}</h2>${pfRangeSelect()}</div>
    ${valueChart(rm, series, vc)}<div class="mlist ${histMore ? '' : 'collapsed'}">${histHtml}</div></section>`;

  let body = '';
  if (tab === 'savings') {
    body = `<section class="card"><div class="card-head"><div><h2>${__('Savings accounts')}</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(S[5])}</div></div><div class="tools"><button class="btn secondary" data-act="transfer">${__('Transfer')}</button><button class="btn" data-act="add-wallet">${__('+ Account')}</button></div></div>
      <div class="wallets ${state.ui.walletsMore ? '' : 'collapsed'}">${walletCards()}</div>${archivedWallets()}</section>${growth}`;
  } else if (tab === 'investment') {
    const byType = {};
    D().holdings.filter((h) => activeAccounts().some((a) => a.id === h.account_id)).forEach((h) => { const t = assetInfo(h.symbol).type; byType[t] = (byType[t] || 0) + holdingUSD(h, months[5]); });
    const alloc = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    body = `<section class="card"><div class="card-head"><div><h2>${__('Investments')} ${infoTip('pf-prices', __('Prices and exchange rates update every 6 hours and can be delayed. Values are estimates, not financial advice.'))}</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(I[5])}</div></div>
        <div class="tools"><button class="btn" data-act="add-account">${__('+ Account')}</button></div></div>
      ${alloc.length ? `<div class="alloc">${alloc.map(([t, v]) => `<i style="flex:${v};background:${TYPE_COLOR[t]}" title="${esc(t)}"></i>`).join('')}</div>
      <div class="alloc-legend">${alloc.map(([t, v]) => `<div><span class="key"><i style="background:${TYPE_COLOR[t]}"></i>${esc(t)}</span><b class="num">${m(v)}</b><span class="muted">${I[5] ? Math.round((v / I[5]) * 100) : 0}%</span></div>`).join('')}</div>` : `<div class="empty sm">${activeAccounts().length ? __('Add assets to an account to see your allocation.') : __('No investment accounts yet. Tap + Account to add one, for example your exchange or brokerage.')}</div>`}
</section>
      ${growth}
      <div class="stack" style="margin-top:20px">${[...activeAccounts()].sort(byValue((a) => portfolioUSD(months[5], a.id))).map((a) => {
        const hs = [...holdingsOf(a.id)].sort(byValue((h) => holdingUSD(h, months[5]))), total = portfolioUSD(months[5], a.id);
        return `<section class="card"><div class="card-head"><div><h2>${esc(a.name)}</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(total)}</div></div>
          <div class="tools"><button class="btn secondary" data-act="edit-account" data-id="${a.id}">${__('Edit')}</button><button class="btn" data-act="add-holding" data-account="${a.id}">${__('+ Asset')}</button></div></div>
          <div class="list">${hs.map((h) => holdingRow(h, vc, total)).join('') || ('<div class="empty">' + __('No assets yet. Add one to start tracking.') + '</div>')}</div></section>`;
      }).join('')}</div>`;
  } else if (tab === 'lent') {
    const owed = activeLent().reduce((a, l) => a + toUSD(loanBalance(l), l.currency), 0);
    body = `<section class="card"><div class="card-head"><div><h2>${__('Money you lent')}</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(LT[5])}</div>
        <small class="muted">${__('{n} open · {amount} still owed to you', { n: activeLent().length, amount: m(owed) })}</small></div><button class="btn" data-act="add-lent">${__('+ Lent')}</button></div></section>
      <div class="stack" style="margin-top:20px">${[...activeLent()].sort(byValue((l) => toUSD(loanBalance(l), l.currency))).map((l) => loanCard(l, vc, 'lent')).join('') || ('<div class="card empty">' + __('Nothing lent out. Add money you lent to a friend or family member to track repayments.') + '</div>')}</div>${growth}`;
  } else {
    const monthly = activeLoans().reduce((a, l) => a + toUSD(l.monthly_minor, l.currency), 0);
    body = `<section class="card"><div class="card-head"><div><h2>${__('Loans you owe')}</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(L[5])}</div>
        <small class="muted">${monthly ? __('{amount} due each month', { amount: m(monthly) }) : __('No monthly payments set')}</small></div><button class="btn" data-act="add-loan">${__('+ Loan')}</button></div></section>
      <div class="stack" style="margin-top:20px">${[...activeLoans()].sort(byValue((l) => toUSD(loanBalance(l), l.currency))).map((l) => loanCard(l, vc)).join('') || ('<div class="card empty">' + __('No loans. Add a mortgage, car loan or credit card balance to include it in your net worth.') + '</div>')}</div>${growth}`;
  }

  const tabBtn = (id, label) => `<button class="tab ${tab === id ? 'on' : ''}" data-act="pf-tab" data-tab="${id}">${__(label)}</button>`;
  return `${topbar('Portfolio', __('Net worth across savings, investments and loans · shown in {cur}', { cur: vc }))}
  <div class="grid">
    <section class="card hero"><div class="label">${__('Net worth')}</div>
      <div class="amount num" style="--len:${m(now).length}">${moneyHtml(usdToMinor(now, vc), vc)}</div>
      <div class="delta"><b>${pctFmt(mom)}</b><span>${__('vs last month')}</span></div>
      <label class="hero-cur"><select data-setting="currency" aria-label="${__('Preferred currency')}">${Object.keys(RATES).map((c) => `<option ${c === base ? 'selected' : ''}>${c}</option>`).join('')}</select></label></section>
    <section class="card"><div class="card-head"><h2>${__('Breakdown')}</h2></div>
      <div class="alloc-legend">
        <div><span class="key"><i style="background:#4A44C6"></i>${__('Savings')}</span><b class="num">${m(S[5])}</b><span class="muted">${share(S[5])}%</span></div>
        <div><span class="key"><i style="background:#F5B800"></i>${__('Investments')}</span><b class="num">${m(I[5])}</b><span class="muted">${share(I[5])}%</span></div>
        <div><span class="key"><i style="background:#1fa971"></i>${__('Lent to others')}</span><b class="num">${m(LT[5])}</b><span class="muted">${share(LT[5])}%</span></div></div>
      <div class="alloc-legend alloc-debt"><div><span class="key"><i style="background:#E5484D"></i>${__('Less: Loans')}</span><b class="num">−${m(L[5])}</b><span class="muted"></span></div></div></section>
  </div>
  <div class="tabs" role="tablist" style="margin:20px 0">${tabBtn('savings', 'Savings')}${tabBtn('investment', 'Investment')}${tabBtn('lent', 'Lent')}${tabBtn('loan', 'Loan')}</div>
  ${body}`;
}

function loanDialog(l) {
  open(`<h2>${l ? __('Edit loan') : __('Add loan')}</h2><form data-form="loan" data-id="${l?.id || ''}" style="display:contents">
    <label class="field">${__('Name')}<input name="name" required maxlength="40" value="${esc(l?.name || '')}" placeholder="${__('e.g. Car loan')}"></label>
    <div class="two"><label class="field">${__('Type')}<select name="type">${Object.entries(LOAN_TYPES).map(([k, v]) => `<option value="${k}" ${k === (l?.type || 'car') ? 'selected' : ''}>${__(v)}</option>`).join('')}</select></label>
      <label class="field">${__('Currency')}<select name="currency" ${l ? 'disabled' : ''}>${Object.keys(RATES).map((c) => `<option ${c === (l?.currency || cur()) ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <div class="two"><label class="field">${l ? __('Original amount') : __('Amount owed now')}<input name="amount" type="number" min="1" step="any" required value="${l ? toMajor(l.original_minor, l.currency) : ''}"></label>
      <label class="field">${__('Monthly payment')}<input name="monthly" type="number" min="0" step="any" value="${l ? toMajor(l.monthly_minor, l.currency) : ''}"></label></div>
    <label class="field">${__('Interest rate (% per year, optional)')}<input name="rate" type="number" min="0" step="any" value="${l?.rate || ''}"></label>
    <div class="actions">${l ? `<button type="button" class="btn danger" data-act="archive-loan" data-id="${l.id}">${__('Archive')}</button>` : ''}<button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button class="btn" type="submit">${__('Save')}</button></div></form>`);
}
function lentDialog(l) {
  open(`<h2>${l ? __('Edit money lent') : __('Add money lent')}</h2><form data-form="lent" data-id="${l?.id || ''}" style="display:contents">
    <label class="field">${__('Who borrowed it')}<input name="name" required maxlength="40" value="${esc(l?.name || '')}" placeholder="${__('e.g. Budi')}"></label>
    <div class="two"><label class="field">${__('Amount lent')}<input name="amount" type="number" min="1" step="any" required value="${l ? toMajor(l.original_minor, l.currency) : ''}"></label>
      <label class="field">${__('Currency')}<select name="currency" ${l ? 'disabled' : ''}>${Object.keys(RATES).map((c) => `<option ${c === (l?.currency || cur()) ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <div class="two"><label class="field">${__('Due date (optional)')}<input name="due" type="date" value="${esc(l?.due || '')}"></label>
      <label class="field">${__('Note (optional)')}<input name="note" maxlength="60" value="${esc(l?.note || '')}" placeholder="${__('e.g. Laptop repair')}"></label></div>
    <div class="actions">${l ? `<button type="button" class="btn danger" data-act="archive-lent" data-id="${l.id}">${__('Archive')}</button>` : ''}<button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button class="btn" type="submit">${__('Save')}</button></div></form>`);
}
function paymentDialog(l, kind = 'loan') {
  const lent = kind === 'lent';
  open(`<h2>${lent ? __('Record repayment') : __('Record payment')}</h2><p class="muted" style="margin-top:-10px">${esc(l.name)} · ${money(loanBalance(l), l.currency)} ${lent ? __('still owed to you') : __('remaining')}</p>
  <form data-form="payment" data-kind="${kind}" data-id="${l.id}" style="display:contents">
    <div class="two"><label class="field">${__('Amount ({cur})', { cur: esc(l.currency) })}<input name="amount" type="number" min="0" step="any" required value="${l.monthly_minor ? toMajor(l.monthly_minor, l.currency) : ''}"></label>
      <label class="field">${__('Date')}<input name="date" type="date" required value="${isoDate(new Date())}"></label></div>
    <p class="hint">${lent ? __('Repayments lower what you are owed. They are not counted as income.') : __('Payments lower the loan balance and your debt in net worth. They are not counted as spending.')}</p>
    <div class="actions"><button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button class="btn" type="submit">${lent ? __('Save repayment') : __('Save payment')}</button></div></form>`);
}

/* ---------- views ---------- */
function sidebar() {
  const r = route();
  const link = (id, ic, label) => `<a href="#/${id}" class="${r === id ? 'active' : ''}">${icon(ic)}<span>${__(label)}</span></a>`;
  return `<aside class="sidebar"><div class="logo"><img src="icon.svg" alt="">Stiver</div>
    <div class="nav-label">${__('MENU')}</div><nav class="nav">${link('overview', 'home', 'Overview')}${link('transactions', 'swap', 'Transactions')}${link('budgets', 'pie', 'Budgets')}${link('portfolio', 'trend', 'Portfolio')}</nav>
    <div class="nav-label">${__('ACCOUNT')}</div><nav class="nav">${link('settings', 'gear', 'Settings')}</nav></aside>`;
}
function bottomNav() {
  const r = route();
  const l = (id, ic, label) => `<a href="#/${id}" class="${r === id ? 'active' : ''}">${icon(ic)}${__(label)}</a>`;
  return `<nav class="bottom-nav">${l('overview', 'home', 'Overview')}${l('transactions', 'swap', 'Activity')}<button type="button" class="nav-add" data-act="add-txn" aria-label="${__('Add transaction')}"><span>${icon('plus')}</span>${__('Add')}</button>${l('budgets', 'pie', 'Budgets')}${l('portfolio', 'trend', 'Portfolio')}</nav>`;
}
function topbar(title, sub) {
  const p = D().profile, hour = new Date().getHours();
  const first = esc(p.name.split(' ')[0]);
  const greet = title ? __(title) : hour < 12 ? __('Good morning, {name}', { name: first }) : hour < 18 ? __('Good afternoon, {name}', { name: first }) : __('Good evening, {name}', { name: first });
  return `<header class="topbar"><div><h1>${greet}</h1></div>
    <div class="tools"><label class="search">${icon('search')}<input id="gsearch" placeholder="${__('Search transactions')}" aria-label="${__('Search transactions')}"></label>
    <a class="profile" href="#/settings" aria-label="${__('Settings')}"><div class="avatar">${esc(p.name[0].toUpperCase())}</div><div><b>${esc(p.name)}</b><small>${esc(p.currency)} · ${__('signed in')}</small></div></a></div></header>`;
}

function viewOverview() {
  const k = state.ui.month, list = inMonth(k), inc = sumBy(list, 'income'), exp = sumBy(list, 'expense'), net = inc - exp;
  const months = lastMonths(6);
  const incs = months.map((m) => sumBy(inMonth(m), 'income')), exps = months.map((m) => sumBy(inMonth(m), 'expense'));
  const cats = spendByCategory(k), bs = budgetStatus(k);
  const global = bs.find((b) => b.category_id === null);
  const tiles = global ? [global] : [];   // Overview shows only the overall budget; the Budgets page has the rest
  const startBal = totalBalance() - net, balChange = startBal > 0 ? (net / startBal) * 100 : null;   // this period's change as a % of the balance it started with
  const recent = D().transactions.slice(0, 6);
  return `${topbar('', 'Here is where your money stands today.')}
  <div class="grid">
    <section class="card hero"><div class="label">${__('Total Balance')}</div>
      <div class="amount num" style="--len:${money(totalBalance(), cur()).length}">${moneyHtml(totalBalance(), cur())}</div>
      <div class="delta"><b>${pctFmt(balChange)}</b><span>${__('{amount} this month', { amount: (net >= 0 ? '+' : '−') + money(Math.abs(net), cur()) })}</span></div>
      <div class="hero-actions"><button class="ghost" data-act="add-txn" data-type="expense">${icon('plus')} ${__('Expense')}</button><button class="ghost" data-act="add-txn" data-type="income">${icon('plus')} ${__('Income')}</button><button class="ghost" data-act="invest">${icon('plus')} ${__('Invest')}</button><button class="ghost" data-act="transfer">${icon('swap')} ${__('Transfer')}</button></div>
      </section>
    <section class="card"><div class="card-head"><h2>${__('Money Flow')}</h2><span class="chip">${__('6 months')}</span></div>
      <div class="big num">${money(Math.max(net, 0), cur())}</div><p class="muted" style="margin-bottom:14px">${__('Saved in {month}', { month: esc(monthLabel(k)) })}</p>
      ${flowChart(months, incs, exps)}</section>
    <section class="card"><div class="card-head"><h2>${__('Spending')}</h2><div class="tools"><button class="chip" data-act="breakdown">${__('Details')}</button>${monthSelect()}</div></div>
      ${halfDonut(cats, exp)}</section>
    <section class="card tap-card" data-act="goto" data-route="budgets" tabindex="0" role="link"><div class="card-head"><h2>${__('Budgets')}</h2><div class="tools">${monthSelect()}<a class="chip" href="#/budgets">${__('Details')}</a></div></div>
      ${global ? `<div class="big num">${money(global.spent, cur())}</div><p class="muted">${__('of {amount} monthly budget', { amount: money(global.budget, cur()) })}</p>` : ('<div class="big">' + __('No monthly budget') + '</div><p class="muted">' + __('Set one to track your month') + '</p>')}
      <div class="ov-buds">${tiles.map((b) => `<div class="ov-occ"><div class="meta"><span>${b.icon} ${esc(b.name)}</span><span class="num">${money(b.spent, cur())} / ${money(b.budget, cur())} · ${Math.round(b.pct)}%</span></div><div class="bar"><i class="${b.status}" style="width:${Math.min(100, b.pct)}%"></i></div></div>`).join('')}</div></section>
  <section class="card"><div class="card-head"><h2>${__('Recent transactions')}</h2><a class="chip" href="#/transactions">${__('View all')}</a></div><div class="list">${recent.map(txnRow).join('')}</div></section>
  </div>`;
}

function txnRow(t) {
  if (t.type === 'transfer') {
    // money moved to/from an investment: not income or spending, so not editable here (edit it on the Portfolio page)
    const xfer = !!t.transfer_id;
    return `<div class="row" ${xfer ? `data-act="view-transfer" data-id="${t.transfer_id}" tabindex="0"` : ''}><span class="tile" style="--c:${xfer ? '#4A44C6' : '#F5B800'}">${xfer ? '🔁' : t.flow === 'out' ? '📈' : '💵'}</span>
    <div><div class="title">${esc(t.note)}<span class="badge">${xfer ? __('Transfer') : __('Investment')}</span></div>
    <div class="sub">${__('Transfer')} · ${esc(walletOf(t.wallet_id)?.name || '')} · ${esc(new Date(t.occurred_at + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric' }))}</div></div>
    <div class="amt num">${t.flow === 'out' ? '−' : '+'}${money(t.amount_minor, t.currency)}</div></div>`;
  }
  const c = catOf(t.category_id), sign = t.type === 'income' ? '+' : '−';
  return `<div class="row" data-act="edit-txn" data-id="${t.id}" tabindex="0">${tile(c)}
    <div><div class="title">${esc(t.note || c?.name || __('Transaction'))}${t.occurred_at > todayIso() ? ('<span class="badge">' + __('Upcoming') + '</span>') : ''}${t.category_source === 'ai' ? ('<span class="badge ai" title="' + __('Tagged by AI') + '">AI</span>') : ''}${!c ? ('<span class="badge">' + __('Uncategorized') + '</span>') : ''}${t.transfer_id ? ('<span class="badge">' + __('Transfer fee') + '</span>') : ''}${t.occasion_id && occasionOf(t.occasion_id) ? `<span class="badge">🎉 ${esc(occasionOf(t.occasion_id).name)}</span>` : ''}</div>
    <div class="sub">${esc(c ? catPath(c.id) : __('No category'))} · ${esc(txnWhere(t))} · ${esc(new Date(t.occurred_at + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric' }))}</div></div>
    <div class="amt num ${t.type}">${sign}${money(t.amount_minor, t.currency)}</div></div>`;
}
function filteredTxns() {
  const { q, cat, wallet, occ } = state.ui, ql = q.trim().toLowerCase();
  return D().transactions.filter((t) => (occ || inPeriod(t.occurred_at, state.ui.month))
    && (!cat || (cat === 'none' ? !t.category_id && t.type !== 'transfer' : t.category_id === cat || (t.category_id && rootOf(t.category_id) === cat))) && (!wallet || t.wallet_id === wallet || (wallet.startsWith('h:') && coinOf(t)?.id === wallet.slice(2))) && (!occ || t.occasion_id === occ)
    && (!ql || (t.note || '').toLowerCase().includes(ql) || (catOf(t.category_id)?.name || '').toLowerCase().includes(ql)));
}
const dayTitle = (d) => new Date(d + 'T00:00').toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
const countLabel = (n) => n === 1 ? __('1 transaction') : __('{n} transactions', { n });
// one row per day with the day's totals (transfers are neither income nor spending)
function txnListHtml() {
  const rows = filteredTxns();
  if (!rows.length) return '<div class="empty">' + __('No transactions match.') + '</div>';
  const days = {};
  rows.forEach((t) => { (days[t.occurred_at] = days[t.occurred_at] || []).push(t); });
  return Object.keys(days).sort().reverse().map((d) => {
    const l = days[d], inc = sumBy(l, 'income'), exp = sumBy(l, 'expense'), net = inc - exp;
    return `<div class="row day-row" data-act="open-day" data-id="${d}" tabindex="0" role="link"><span class="daybox"><b>${+d.slice(8)}</b><small>${esc(new Date(d + 'T00:00').toLocaleDateString(locale(), { month: 'short' }))}</small></span>
    <div><div class="title">${esc(new Date(d + 'T00:00').toLocaleDateString(locale(), { weekday: 'long' }))}</div>
    <div class="sub">${countLabel(l.length)}${inc ? ' · ' + __('Income') + ' ' + money(inc, cur()) : ''}${exp ? ' · ' + __('Spent') + ' ' + money(exp, cur()) : ''}</div></div>
    <div class="amt num ${net < 0 ? 'expense' : net > 0 ? 'income' : ''}">${net < 0 ? '−' : net > 0 ? '+' : ''}${money(Math.abs(net), cur())}</div></div>`;
  }).join('');
}
// the detail page for one day: every transaction on it
function viewDay(d) {
  const l = D().transactions.filter((t) => t.occurred_at === d), inc = sumBy(l, 'income'), exp = sumBy(l, 'expense');
  return `${topbar('Transactions', countLabel(l.length) + ' · ' + __('Income') + ' ' + money(inc, cur()) + ' · ' + __('Spent') + ' ' + money(exp, cur()))}
  <section class="card"><div class="card-head"><div><a class="back-link" href="#/transactions">← ${__('Back to Transactions')}</a><h2>${esc(dayTitle(d))}</h2></div><div class="tools"><button class="btn" data-act="add-txn" data-date="${d}">${__('+ Add')}</button></div></div>
    <div class="list" id="day-list">${l.length ? l.map(txnRow).join('') : '<div class="empty">' + __('No transactions on this day.') + '</div>'}</div></section>`;
}
function viewTransactions() {
  const list = inMonth(state.ui.month);
  return `${topbar('Transactions', __('{n} in {month} · income {income} · spent {spent}', { n: list.length, month: monthLabel(state.ui.month), income: money(sumBy(list, 'income'), cur()), spent: money(sumBy(list, 'expense'), cur()) }))}
  <section class="card"><div class="txn-top"><input data-filter="q" placeholder="${__('Search')}" value="${esc(state.ui.q)}" aria-label="${__('Search note or category')}">${monthSelect(true)}<button class="btn add-desk" data-act="add-txn">${__('+ Add')}</button></div>
    <div class="filters scroll-row">
      <select data-filter="cat" aria-label="${__('Category')}"><option value="">${__('All categories')}</option><option value="none" ${state.ui.cat === 'none' ? 'selected' : ''}>Uncategorized</option>${catTree().map((c) => `<option value="${c.id}" ${state.ui.cat === c.id ? 'selected' : ''}>${c.parent_id ? '  ↳ ' : ''}${esc(c.name)}</option>`).join('')}</select>
      ${D().occasions.length ? `<select data-filter="occ" aria-label="${__('Occasion')}"><option value="">${__('All occasions')}</option>${D().occasions.map((o) => `<option value="${o.id}" ${state.ui.occ === o.id ? 'selected' : ''}>🎉 ${esc(o.name)}</option>`).join('')}</select>` : ''}
      <select data-filter="wallet" aria-label="${__('Account')}"><option value="">${__('All accounts')}</option>${D().wallets.map((w) => `<option value="${w.id}" ${state.ui.wallet === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}${stableHoldings().map((h) => `<option value="h:${h.id}" ${state.ui.wallet === 'h:' + h.id ? 'selected' : ''}>${esc(accountName(h.account_id))} (${esc(assetInfo(h.symbol).symbol)})</option>`).join('')}</select></div>
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
  <section class="card"><div class="card-head"><h2>${__('By category')}</h2></div>
    ${rest.length ? rest.map((b) => `<div class="brow">${tile({ icon: b.icon, color: b.color })}<div><div class="meta"><span>${esc(b.name)} ${cap(b)}</span><span class="num">${money(b.spent, cur())} / ${money(b.budget, cur())} · ${Math.round(b.pct)}%</span></div><div class="bar"><i class="${b.status}" style="width:${Math.min(100, b.pct)}%"></i></div></div><button class="btn secondary" data-act="edit-budget" data-id="${b.id}">${__('Edit')}</button></div>`).join('') : ('<div class="empty">' + __('No category budgets yet.') + '</div>')}</section>
  <section class="card"><div class="card-head"><h2>${__('Special occasions')}</h2><button class="btn" data-act="add-occasion">${__('+ Occasion')}</button></div>
    ${(() => { const all = occasionStatus(), live = all.filter((o) => !o.archived && occasionInMonth(o, state.ui.month)), past = all.filter((o) => o.archived); return (live.length ? live.map(occasionRow).join('') : ('<div class="empty">' + __('No occasion budgets yet. Add one like "Bali Trip" or "Birthday Dinner".') + '</div>')) + (past.length ? `<h3 class="muted" style="margin:16px 0 6px;font-size:13px">${__('Past occasions')}</h3>${past.map(occasionRow).join('')}` : ''); })()}</section></div>`;
}
const occasionRow = (o) => {
  const dates = [o.start, o.end].filter(Boolean).map((d) => new Date(d + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' })).join(' – ');
  return `<div class="brow wrap"><span class="tile" style="--c:#EC4899">🎉</span><div><div class="meta"><span>${esc(o.name)} <span class="badge ${o.status}">${o.status === 'ok' ? __('On track') : o.status === 'warning' ? __('Almost there') : __('Over budget')}</span></span><span class="num">${money(o.spent, cur())} / ${money(o.budget, cur())} · ${Math.round(o.pct)}%</span></div>
    <div class="bar"><i class="${o.status}" style="width:${Math.min(100, o.pct)}%"></i></div>${dates ? `<small class="muted">${esc(dates)}</small>` : ''}</div>
    <div class="tools"><button class="btn" data-act="add-occasion-txn" data-id="${o.id}">${__('+ Expense')}</button><button class="btn secondary" data-act="view-occasion" data-id="${o.id}">${__('Expenses')}</button><button class="btn secondary" data-act="edit-occasion" data-id="${o.id}">${__('Edit')}</button></div></div>`;
};

/* Settings > Categories: collapsed by default; each parent with sub-categories expands on its own */
function categoriesCard() {
  const roots = D().categories.filter((c) => !c.parent_id && !c.archived), subs = D().categories.filter((c) => c.parent_id && !c.archived).length;
  const open = state.ui.catsOpen;
  const rows = roots.map((c) => {
    const kids = childrenOf(c.id), isOpen = state.ui.openCats.has(c.id);
    return `<div class="brow cat-row">${tile(c)}<div class="cat-main"><b class="cat-name">${esc(c.name)}</b><div class="cat-meta"><span class="badge">${typeLabel(c.type)}</span>${kids.length ? `<button type="button" class="legend-btn" data-act="toggle-cat" data-id="${c.id}" aria-expanded="${isOpen}">${__(kids.length === 1 ? '{n} sub-category' : '{n} sub-categories', { n: kids.length })} <span class="chev" aria-hidden="true">›</span></button>` : ''}</div></div>
      <div class="tools"><button class="btn secondary" data-act="add-cat" data-parent="${c.id}">${__('+ Sub')}</button><button class="btn secondary" data-act="edit-cat" data-id="${c.id}">${__('Edit')}</button></div></div>`
      + (isOpen ? kids.map((k) => `<div class="brow indent cat-row">${tile(k, true)}<div class="cat-main"><b class="cat-name">${esc(k.name)}</b></div><div class="tools"><button class="btn secondary" data-act="edit-cat" data-id="${k.id}">${__('Edit')}</button></div></div>`).join('') : '');
  }).join('');
  return `<section class="card"><div class="card-head"><button type="button" class="legend-btn card-toggle" data-act="toggle-cats" aria-expanded="${open}"><span class="chev" aria-hidden="true">›</span><h2>${__('Categories')}</h2></button><button class="btn" data-act="add-cat">${__('+ Category')}</button></div>
    ${open ? `<div style="margin-top:6px">${rows}</div>` : ''}</section>`;
}
function viewSettings() {
  const p = D().profile;
  return `${topbar('Settings', 'Profile, currency and privacy')}
  <div class="stack">
  ${categoriesCard()}
  ${recurringCard()}
  <section class="card"><div class="card-head"><h2>${__('Profile')}</h2></div>
    <div class="form-row"><div>${__('Display name')}</div><div class="field"><input data-setting="name" value="${esc(p.name)}" aria-label="${__('Display name')}"></div></div>
    <div class="form-row"><div>${__('Reporting currency')}</div><div class="field"><select data-setting="currency" aria-label="${__('Currency')}">${Object.keys(RATES).map((c) => `<option ${c === p.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
    <div class="form-row"><div>${__('Budget period starts on')}</div><div class="field"><select data-setting="period" aria-label="${__('Budget period starts on')}">${Array.from({ length: 28 }, (_, n) => `<option value="${n + 1}" ${n + 1 === periodDay() ? 'selected' : ''}>${n === 0 ? __('Day 1 (calendar month)') : __('Day {n}', { n: n + 1 })}</option>`).join('')}</select></div></div>
    <div class="form-row"><div>${__('Language')}</div><div class="field"><select data-lang aria-label="${__('Language')}">${Object.entries(LANGS).map(([k, n]) => `<option value="${k}" ${k === LANG ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="form-row"><div>${__('Appearance')}</div><div class="field"><select data-theme-select aria-label="${__('Appearance')}">${[['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([k, n]) => `<option value="${k}" ${k === THEME ? 'selected' : ''}>${__(n)}</option>`).join('')}</select></div></div></section>
  <section class="card"><div class="card-head"><h2>${__('Smart tagging')}</h2></div>
    <div class="form-row"><div>${__('AI category suggestions')}</div><label class="switch"><input type="checkbox" data-setting="ai" ${p.ai ? 'checked' : ''} aria-label="${__('AI tagging')}"></label></div></section>
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
/* ---------- landing page (what signed-out visitors see first) ---------- */
const langSelect = () => `<select class="lang-select" data-lang aria-label="${__('Language')}">${Object.entries(LANGS).map(([k, n]) => `<option value="${k}" ${k === LANG ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
function viewLanding() {
  const feat = (ic, title, text) => `<div class="feat"><span class="feat-ic" aria-hidden="true">${ic}</span><h3>${__(title)}</h3><p>${__(text)}</p></div>`;
  const step = (n, text) => `<li><span class="step-n">${n}</span><span>${__(text)}</span></li>`;
  return `<div class="land">
  <header class="land-nav"><a class="logo" href="#"><img src="icon.svg" alt="">Stiver</a>
    <div class="land-nav-r">${langSelect()}<button type="button" class="theme-btn" data-act="theme-toggle" aria-label="${__('Switch between light and dark')}">${effectiveTheme() === 'dark' ? '☀️' : '🌙'}</button><button class="btn secondary" data-act="auth-view" data-view="signin">${__('Sign in')}</button><button class="btn" data-act="auth-view" data-view="signup">${__('Get started')}</button></div></header>
  <section class="land-hero">
    <div class="land-copy">
      <h1>${__('Your money, finally in one place.')}</h1>
      <p class="land-sub">${__('Track spending, set budgets, and watch your net worth grow across savings, investments and loans. Simple, private and built for how you actually live.')}</p>
      <div class="land-cta"><button class="btn lg" data-act="auth-view" data-view="signup">${__('Get started')}</button><button class="btn secondary lg" data-act="auth-view" data-view="signin">${__('Sign in')}</button></div>
    </div>
    <div class="land-mock" aria-hidden="true">
      <div class="mock-card"><div class="mock-label">${__('Net worth')}</div><div class="mock-amt">IDR 54,328,869</div><div class="mock-delta"><b>+12.4%</b> ${__('vs last month')}</div>
        <svg viewBox="0 0 300 70" preserveAspectRatio="none" class="mock-spark"><polyline points="4,58 54,50 104,54 154,38 204,30 254,22 296,10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="mock-bud"><div class="mock-row"><span>🛒 ${__('Groceries')}</span><span>63%</span></div><div class="bar"><i class="ok" style="width:63%"></i></div>
        <div class="mock-row"><span>🍽️ ${__('Dining')}</span><span>86%</span></div><div class="bar"><i class="warning" style="width:86%"></i></div>
        <div class="mock-row"><span>🎉 ${__('Bali Trip')}</span><span>41%</span></div><div class="bar"><i class="ok" style="width:41%"></i></div></div>
    </div>
  </section>
  <section class="land-sec land-demo"><h2>${__('See Stiver in action')}</h2><p class="land-demo-sub">${__('A quick tour: add an expense, check your budgets, and move money between accounts.')}</p>
    <div class="demo-frame"><video controls playsinline preload="metadata" poster="media/demo-poster.jpg" aria-label="${__('Stiver demo video')}"><source src="media/demo.mp4" type="video/mp4"><source src="media/demo.webm" type="video/webm"></video></div></section>
  <section class="land-sec"><h2>${__('Everything you need, nothing you don’t')}</h2>
    <div class="feats">
      ${feat('💸', 'Spending that makes sense', 'Log expenses and income in seconds, with categories and sub-categories that roll up into clear monthly totals.')}
      ${feat('🎯', 'Budgets that keep you honest', "Set an overall limit or one per category, and see at a glance when you're close. Add special budgets for trips and celebrations.")}
      ${feat('👛', 'Savings across accounts and currencies', 'Cash, bank accounts and e-wallets in any currency, with easy transfers between them.')}
      ${feat('📈', 'Investments with live prices', 'Track stocks, ETFs and crypto with current prices, buys and sells.')}
      ${feat('🤝', 'Loans and money you lent', "Know what you owe and what you're owed, and record each payment as it happens.")}
      ${feat('🌱', 'Net worth over time', 'See everything together and how it changes month by month.')}
    </div></section>
  <section class="land-sec"><h2>${__('How it works')}</h2>
    <ol class="steps">${step(1, 'Create your account with email or Google.')}${step(2, 'Add your accounts and your first transactions.')}${step(3, 'See your full picture on every device.')}</ol></section>
  <section class="land-final"><h2>${__('Ready to take control of your money?')}</h2><button class="btn lg" data-act="auth-view" data-view="signup">${__('Create your account')}</button></section>
  <footer class="land-foot"><span>© ${new Date().getFullYear()} Stiver</span><span><a href="privacy.html">${__('Privacy Policy')}</a> · <a href="terms.html">${__('Terms of Service')}</a></span></footer>
</div>`;
}

const authLink = (view, text) => `<button type="button" class="legend-btn" data-act="auth-view" data-view="${view}">${__(text)}</button>`;
function viewAuth() {
  const a = state.auth, v = a.view, logo = `<button type="button" class="logo logo-btn" data-act="auth-view" data-view="landing" aria-label="${__('Back to home')}"><img src="icon.svg" alt="">Stiver</button>`;
  const emailField = `<label class="field">${__('Email')}<input name="email" type="email" required autocomplete="email" placeholder="${__('you@example.com')}" value="${esc(a.email)}"></label>`;
  const google = `<button type="button" class="btn secondary lg google" data-act="auth-google">${GOOGLE_LOGO} ${__('Continue with Google')}</button><div class="or"><span>${__('or')}</span></div>`;
  let body;
  if (v === 'signup') body = `<form class="card" data-form="signup">${logo}
    <div><h2 style="font-size:24px">${__('Create your account')}</h2><p class="muted">${__('Your data is private to you and saved to your account.')}</p></div>
    ${google}${authMsg(a)}
    <label class="field">${__('Name')}<input name="name" required placeholder="${__('Ari Nolan')}" autocomplete="name"></label>
    ${emailField}
    <label class="field">${__('Password')}<input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="${__('At least 8 characters')}"></label>
    <label class="field">${__('Reporting currency')}<select name="currency">${Object.keys(RATES).map((c) => `<option>${c}</option>`).join('')}</select></label>
    ${captchaBox()}<button class="btn lg" type="submit">${__('Create account')}</button>
    <p class="muted" style="text-align:center">${__("We'll email you a link to confirm your address. Already have an account?")} ${authLink('signin', 'Sign in')}</p></form>`;
  else if (v === 'forgot') body = `<form class="card" data-form="forgot">${logo}
    <div><h2 style="font-size:24px">${__('Reset your password')}</h2><p class="muted">${__('Enter your email and we\'ll send you a reset link.')}</p></div>
    ${authMsg(a)}${emailField}${captchaBox()}<button class="btn lg" type="submit">${__('Send reset link')}</button>
    <p class="muted" style="text-align:center">${authLink('signin', 'Back to sign in')}</p></form>`;
  else if (v === 'recovery') body = `<form class="card" data-form="recovery">${logo}
    <div><h2 style="font-size:24px">${__('Choose a new password')}</h2></div>${authMsg(a)}
    <label class="field">${__('New password')}<input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="${__('At least 8 characters')}"></label>
    <button class="btn lg" type="submit">${__('Save password')}</button></form>`;
  else if (v === 'sent') body = `<div class="card">${logo}
    <div><h2 style="font-size:24px">${__('Check your email')}</h2><p class="muted">${__('We sent a link to {email}. Open it to confirm your address, then sign in. If you already have an account, just sign in.', { email: '<b>' + esc(a.email) + '</b>' })}</p></div>
    ${authMsg(a)}<p class="hint" role="status">${__('Waiting for you to confirm. Open the link on any device, and this page signs you in on its own.')}</p>
    ${captchaBox()}<button class="btn lg" data-act="auth-check">${__('I\'ve confirmed my email')}</button><button class="btn secondary lg" data-act="auth-resend">${__('Resend the email')}</button>
    <p class="muted" style="text-align:center">${authLink('signin', 'Back to sign in')}</p></div>`;
  else body = `<form class="card" data-form="signin">${logo}
    <div><h2 style="font-size:24px">${__('Welcome back')}</h2><p class="muted">${__('Sign in to see your spending, budgets and net worth.')}</p></div>
    ${google}${authMsg(a)}${emailField}
    <label class="field">${__('Password')}<input name="password" type="password" required autocomplete="current-password"></label>
    ${captchaBox()}<button class="btn lg" type="submit">${__('Sign in')}</button>
    <p class="muted" style="text-align:center">${authLink('forgot', 'Forgot password?')}</p>
    <p class="muted" style="text-align:center">${__('New here?')} ${authLink('signup', 'Create an account')}</p></form>`;
  return `<div class="onboard">${body}<p class="legal-links"><a href="privacy.html">${__('Privacy Policy')}</a> · <a href="terms.html">${__('Terms of Service')}</a></p></div>`;
}
const viewSplash = (msg) => `<div class="onboard"><div class="card" role="status"><div class="logo"><img src="icon.svg" alt="">Stiver</div><p class="muted">${esc(__(msg))}</p></div></div>`;

/* ---------- render ---------- */
const VIEWS = { overview: viewOverview, transactions: () => (/^\d{4}-\d{2}-\d{2}$/.test(routeArg()) ? viewDay(routeArg()) : viewTransactions()), budgets: viewBudgets, portfolio: viewPortfolio, settings: viewSettings };
function render() {
  const app = $('#app');
  const a = state.auth;
  if (a.status === 'loading') { app.innerHTML = viewSplash('Loading…'); return; }
  if (a.status === 'out' && a.view === 'landing') { app.innerHTML = viewLanding(); return; }
  if (a.status === 'out' || a.view === 'recovery') { app.innerHTML = viewAuth(); mountCaptcha(); return; }
  if (!D()) {
    app.innerHTML = a.loadError
      ? `<div class="onboard"><div class="card"><div class="logo"><img src="icon.svg" alt="">Stiver</div><p class="auth-err" role="alert">${__("Couldn't load your data: {error}", { error: esc(a.loadError) })}</p><button class="btn lg" data-act="retry-load">${__('Try again')}</button><button class="btn secondary lg" data-act="signout">${__('Sign out')}</button></div></div>`
      : viewSplash('Loading your data…');
    return;
  }
  if (state.ui.monthSrc !== periodDay()) { state.ui.month = currentPeriod(); state.ui.monthSrc = periodDay(); }   // a new start day (or switching demo/real data) re-selects the current period
  const r = VIEWS[route()] ? route() : 'overview';
  app.innerHTML = `<div class="shell">${sidebar()}<main class="main">${state.real ? demoBar() : ''}${VIEWS[r]()}</main></div>${bottomNav()}`;
  if (r === 'portfolio') bindValue(state.chart.months, state.chart.series, state.chart.vc);
  if (r === 'overview') {
    const months = lastMonths(6);
    bindFlow(months, months.map((m) => sumBy(inMonth(m), 'income')), months.map((m) => sumBy(inMonth(m), 'expense')));
  }
}

/* ---------- dialogs ---------- */
const dlg = () => $('#dlg');
// no field is focused on open, so the phone keyboard stays down until the user taps an input
function open(html) { dlg().innerHTML = `<div class="dlg" tabindex="-1">${html}</div>`; if (!dlg().open) dlg().showModal(); $('.dlg', dlg()).focus({ preventScroll: true }); }
const close = () => dlg().open && dlg().close();
const catOptions = (type, sel) => `<option value="">${__('— None (AI may suggest) —')}</option>${catTree(type).map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.parent_id ? '  ↳ ' : ''}${c.icon} ${esc(c.name)}</option>`).join('')}`;

/* parents a new category can live in: none (a new top-level category) or an existing top-level one of this type */
const quickParentOptions = (type) => `<option value="">${__('Nothing: a new top-level category')}</option>${D().categories.filter((c) => !c.parent_id && !c.archived && c.type === type).map((c) => `<option value="${c.id}">${c.icon} ${esc(c.name)} ${__('(as a sub-category)')}</option>`).join('')}`;
/* add a category without leaving the transaction form, then select it */
function quickAddCategory(form) {
  const type = form.type.value === 'income' ? 'income' : 'expense', name = form.qc_name.value.trim(), parent = form.qc_parent.value ? catOf(form.qc_parent.value) : null;
  if (!name) { toast('Enter a name for the category'); form.qc_name.focus(); return; }
  if (D().categories.some((c) => !c.archived && (c.parent_id || null) === (parent?.id || null) && c.type === type && c.name.toLowerCase() === name.toLowerCase())) { toast('That name already exists here'); return; }
  const c = { id: uid(), parent_id: parent ? parent.id : null, name, type, icon: form.qc_icon.value.trim() || '🏷️', color: parent ? parent.color : SWATCHES[D().categories.length % SWATCHES.length], archived: false };
  D().categories.push(c); save();
  $('select[name=category]', form).innerHTML = catOptions(type, c.id);
  form.qc_name.value = ''; form.qc_icon.value = ''; $('.quick-cat', form).hidden = true;
  toast(parent ? __('Added {name} under {parent}', { name, parent: parent.name }) : __('Added {name}', { name }));
}
/* active occasions whose dates include this day (an occasion without dates never matches by date) */
const occasionOn = (date) => D().occasions.filter((o) => !o.archived && o.start && date >= o.start && date <= (o.end || o.start));
/* the four ways to add money movement; the active one is highlighted and the others switch dialogs */
const kindSeg = (active) => `<div class="seg seg4">${[['expense', 'Expense'], ['income', 'Income'], ['invest', 'Invest'], ['transfer', 'Transfer']].map(([k, n]) => `<label><input type="radio" name="txkind" value="${k}" ${k === active ? 'checked' : ''}>${__(n)}</label>`).join('')}</div>`;

/* ---------- transfers between wallets ----------
   Stored as linked transactions sharing a transfer_id: an 'out' leg on the source wallet, an 'in' leg on the
   destination (in its own currency) and an optional fee as a normal expense on the source wallet. Transfers
   are not income or spending; the fee is spending. */
function transferDialog(preset) {
  const ws = D().wallets.filter((w) => !w.archived);
  if (ws.length < 2) { toast('Add a second account first to transfer between accounts'); return; }
  const from = preset?.from || ws[0], to = ws.find((w) => w.id !== from.id);
  const opt = (w, sel) => `<option value="${w.id}" ${w.id === sel ? 'selected' : ''}>${esc(w.name)} (${esc(w.currency)}) · ${money(walletBalance(w), w.currency)}</option>`;
  open(`<h2>${__('Transfer between accounts')}</h2><form data-form="transfer" style="display:contents">
    ${kindSeg('transfer')}
    <div class="two"><label class="field">${__('From')}<select name="from">${ws.map((w) => opt(w, from.id)).join('')}</select></label>
      <label class="field">${__('To')}<select name="to">${ws.map((w) => opt(w, to.id)).join('')}</select></label></div>
    <div class="two"><label class="field"><span data-send-label>${__('Amount sent')}</span><input name="amount" type="number" inputmode="decimal" min="0" step="any" required></label>
      <label class="field">${__('Date')}<input name="date" type="date" required value="${isoDate(new Date())}"></label></div>
    <label class="field" data-recv hidden><span data-recv-label>${__('Amount received')}</span><input name="received" type="number" inputmode="decimal" min="0" step="any"></label>
    <label class="field"><span data-fee-label>${__('Transfer fee (optional)')}</span><input name="fee" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label>
    <label class="field">${__('Note (optional)')}<input name="note" maxlength="140" placeholder="${__('e.g. Top up e-wallet')}"></label>
    ${repeatField()}
    <p class="hint">${__('A transfer is not income or spending. If you enter a fee it is taken from the source account on top of the amount and counts as spending.')}</p>
    <div class="actions"><button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button class="btn" type="submit">${__('Transfer')}</button></div></form>`);
  syncTransfer($('#dlg form'));
}
/* keep labels in the right currency; when the two wallets differ, show and prefill the received amount */
function syncTransfer(form) {
  const A = walletOf(form.from.value), B = walletOf(form.to.value), cross = A.currency !== B.currency;
  $('[data-send-label]', form).textContent = __('Amount sent ({cur})', { cur: A.currency });
  $('[data-fee-label]', form).textContent = __('Transfer fee, optional ({cur})', { cur: A.currency });
  $('[data-recv]', form).hidden = !cross;
  if (cross) {
    $('[data-recv-label]', form).textContent = __('Amount received ({cur}) · estimated, edit if different', { cur: B.currency });
    const a = parseFloat(form.amount.value);
    if (!form.received.dataset.touched) form.received.value = a > 0 ? toMajor(convert(toMinor(a, A.currency), A.currency, B.currency), B.currency).toFixed(expOf(B.currency)) : '';
  }
}
function transferDetail(gid) {
  const legs = D().transactions.filter((t) => t.transfer_id === gid), out = legs.find((t) => t.flow === 'out'), inn = legs.find((t) => t.flow === 'in'), fee = legs.find((t) => t.type === 'expense');
  const row = (k, v) => `<div class="form-row"><div>${__(k)}</div><b class="num">${v}</b></div>`;
  open(`<h2>${__('Transfer')}</h2>
    ${row('From', esc(walletOf(out?.wallet_id)?.name || '—'))}${row('To', esc(walletOf(inn?.wallet_id)?.name || '—'))}
    ${out ? row('Sent', money(out.amount_minor, out.currency)) : ''}${inn ? row('Received', money(inn.amount_minor, inn.currency)) : ''}${fee ? row('Fee', money(fee.amount_minor, fee.currency)) : ''}
    ${row('Date', esc(new Date((out || inn || fee).occurred_at + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' })))}
    <p class="hint">${__('Deleting removes the transfer and its fee, and both account balances go back to what they were.')}</p>
    <div class="actions"><button type="button" class="btn danger" data-act="delete-transfer" data-id="${gid}">${__('Delete transfer')}</button><button type="button" class="btn secondary" data-act="close">${__('Close')}</button></div>`);
}
/* USDT/USDC in an investment account can receive income and pay expenses directly: the coins move as a trade
   linked to an income/expense transaction (no wallet; 1 coin = 1 USD, amounts stored in USD cents). */
const coinOf = (t) => (t && !t.wallet_id && t.trade_id ? D().holdings.find((h) => h.trades.some((x) => x.id === t.trade_id)) : null);
const txnWhere = (t) => { const w = walletOf(t.wallet_id); if (w) return w.name; const h = coinOf(t); return h ? `${accountName(h.account_id)} (${assetInfo(h.symbol).symbol})` : ''; };
const coinOption = (h, sel) => `<option value="h:${h.id}" ${sel ? 'selected' : ''}>${esc(accountName(h.account_id))} (${esc(assetInfo(h.symbol).symbol)})</option>`;
function recordCoinTxn(h, { type, quantity, date, note, category_id, category_source, ai_confidence, occasion_id, id, tradeId }) {
  const tid = tradeId || uid(), side = type === 'income' ? 'buy' : 'sell', amount_minor = Math.max(1, Math.round(quantity * 100));
  h.quantity = r12(h.quantity + (side === 'buy' ? quantity : -quantity));
  h.trades.push({ id: tid, date, side, kind: type, quantity, amount_minor, currency: 'USD', wallet_id: null });
  if (side === 'buy' && date.slice(0, 7) < h.since) h.since = date.slice(0, 7);
  const row = { id: id || uid(), type, amount_minor, currency: 'USD', occurred_at: date, wallet_id: null, trade_id: tid, note: note || '', category_id: category_id || null, category_source: category_source || 'user', ai_confidence: ai_confidence ?? null };
  if (type === 'expense' && occasion_id && occasionOf(occasion_id)) row.occasion_id = occasion_id;
  D().transactions.push(row);
  return row;
}
/* the Account list of the add-transaction form: wallets, USDT/USDC you hold, and (income only) USDT/USDC to start receiving
   into an investment account that does not hold it yet ("n:SYMBOL:accountId", created when you save) */
function acctOptions(type, selected) {
  const ws = D().wallets.filter((w) => !w.archived), coins = stableHoldings(), accts = activeAccounts();
  const fresh = type === 'income' ? ['USDT', 'USDC'].flatMap((sym) => (accts.length ? accts : [{ id: '', name: '' }]).filter((a) => !D().holdings.some((h) => h.account_id === a.id && h.symbol === sym)).map((a) => ({ sym, a }))) : [];
  const sel = (v) => (v === selected ? 'selected' : '');
  return ws.map((w) => `<option value="${w.id}" ${sel(w.id)}>${esc(w.name)} (${esc(w.currency)})</option>`).join('')
    + (coins.length || fresh.length ? `<optgroup label="${__('Investment Account')}">${coins.map((h) => `<option value="h:${h.id}" ${sel('h:' + h.id)}>${esc(accountName(h.account_id))} (${esc(assetInfo(h.symbol).symbol)})</option>`).join('')}${fresh.map(({ sym, a }) => `<option value="n:${sym}:${a.id}" ${sel('n:' + sym + ':' + a.id)}>${a.name ? esc(a.name) : __('Crypto')} (${sym})</option>`).join('')}</optgroup>` : '');
}
/* the amount's unit and step follow the chosen account */
function syncTxnUnit(form) {
  const v = form.wallet.value, coin = v.startsWith('h:') ? D().holdings.find((x) => x.id === v.slice(2)) : null, sym = coin ? assetInfo(coin.symbol).symbol : v.startsWith('n:') ? v.split(':')[1] : null;
  const unit = sym || walletOf(v)?.currency || cur();
  $('[data-amt-label]', form).textContent = __('Amount ({cur})', { cur: unit }); $('input[name=amount]', form).step = sym ? 'any' : expOf(unit) ? '0.01' : '1';
}
function txnDialog(t, presetType, presetOccasion, presetDate) {
  const type = t?.type || presetType || 'expense', ws = D().wallets.filter((w) => !w.archived);
  const live = D().occasions.filter((o) => !o.archived || o.id === t?.occasion_id), occ0 = t ? t.occasion_id : presetOccasion?.id || (occasionOn(isoDate(new Date()))[0]?.id);
  const date0 = t?.occurred_at || presetDate || (presetOccasion?.start && presetOccasion.start > isoDate(new Date()) ? presetOccasion.start : isoDate(new Date()));
  // the amount is entered in the chosen wallet's currency
  const tcoin = coinOf(t);
  const c = t ? t.currency : (ws.find((w) => w.currency === cur()) || ws[0]).currency, step = tcoin ? 'any' : expOf(c) ? '0.01' : '1';
  const unit = tcoin ? assetInfo(tcoin.symbol).symbol : c;
  open(`<h2>${t ? __('Edit transaction') : __('Add transaction')}</h2>
  <form data-form="txn" data-id="${t?.id || ''}" style="display:contents">
    <div class="seg ${t ? '' : 'seg4'}"><label><input type="radio" name="type" value="expense" ${type === 'expense' ? 'checked' : ''}>${__('Expense')}</label><label><input type="radio" name="type" value="income" ${type === 'income' ? 'checked' : ''}>${__('Income')}</label>${t ? '' : ('<label><input type="radio" name="type" value="invest">' + __('Invest') + '</label><label><input type="radio" name="type" value="transfer">' + __('Transfer') + '</label>')}</div>
    <label class="field">${__('Account')}<select name="wallet">${tcoin ? coinOption(tcoin, true) : acctOptions(type, t ? t.wallet_id : (ws.find((w) => w.currency === cur()) || ws[0]).id)}</select></label>
    <div class="two"><label class="field"><span data-amt-label>${__('Amount ({cur})', { cur: esc(unit) })}</span><input name="amount" type="number" inputmode="decimal" min="0" step="${step}" required value="${tcoin ? tcoin.trades.find((x) => x.id === t.trade_id).quantity : t ? toMajor(t.amount_minor, c) : ''}"></label>
      <label class="field">${__('Date')}<input name="date" type="date" required value="${date0}"></label></div>
    <label class="field">${__('Category')}<select name="category">${catOptions(type, t?.category_id)}</select></label>
    <button type="button" class="legend-btn" data-act="quick-cat" style="align-self:flex-start;margin-top:-6px">${__('+ New category or sub-category')}</button>
    <div class="quick-cat" hidden>
      <div class="two"><label class="field">${__('Name')}<input name="qc_name" maxlength="40" placeholder="${__('e.g. Gym, or Snacks')}" autocomplete="off"></label>
        <label class="field">${__('Icon')}<input name="qc_icon" maxlength="4" placeholder="🏷️" autocomplete="off"></label></div>
      <label class="field">${__('Inside')}<select name="qc_parent">${quickParentOptions(type)}</select></label>
      <div class="actions"><button type="button" class="btn secondary" data-act="quick-cat-cancel">${__('Cancel')}</button><button type="button" class="btn" data-act="quick-cat-add">${__('Add category')}</button></div></div>
    ${live.length ? `<label class="field">${__('🎉 Special occasion (optional)')}<select name="occasion"><option value="">${__('None')}</option>${live.map((o) => `<option value="${o.id}" ${o.id === occ0 ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>` : ''}
    <label class="field">${__('Note')}<textarea name="note" maxlength="140" placeholder="${__('e.g. Coffee shop')}">${esc(t?.note || '')}</textarea></label>
    ${t ? '' : repeatField()}
    <div class="actions">${t ? '<button type="button" class="btn danger" data-act="delete-txn" data-id="' + t.id + ('">' + __('Delete') + '</button>') : ''}<button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button class="btn" type="submit">${__('Save')}</button></div></form>`);
}
function budgetDialog(b) {
  const used = new Set(D().budgets.map((x) => x.category_id));
  const opts = [{ id: '', name: '💰 ' + __('All spending (global)') }, ...catTree('expense').filter((c) => !c.parent_id).map((c) => ({ id: c.id, name: `${c.icon} ${c.name}` }))];
  open(`<h2>${b ? __('Edit budget') : __('Add budget')}</h2><form data-form="budget" data-id="${b?.id || ''}" style="display:contents">
    <label class="field">${__('Applies to')}<select name="category" ${b ? 'disabled' : ''}>${opts.map((o) => `<option value="${o.id}" ${o.id === (b?.category_id || '') ? 'selected' : ''}>${esc(o.name)}${!b && used.has(o.id || null) ? ' ' + __('(replace)') : ''}</option>`).join('')}</select></label>
    <label class="field">${__('Monthly limit ({cur})', { cur: esc(cur()) })}<input name="amount" type="number" min="1" step="${expOf(cur()) ? '0.01' : '1'}" required value="${b ? toMajor(b.budget, cur()) : ''}"></label>
    <p class="hint">${__('Applies from {month} onward until you set a new amount.', { month: esc(monthLabel(state.ui.month)) })}</p>
    <div class="actions">${b ? `<button type="button" class="btn danger" data-act="delete-budget" data-id="${b.id}">${__('Delete')}</button>` : ''}<button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button class="btn" type="submit">${__('Save')}</button></div></form>`);
}
function occasionDialog(o) {
  open(`<h2>${o ? __('Edit special occasion') : __('New special occasion')}</h2><form data-form="occasion" data-id="${o?.id || ''}" style="display:contents">
    <label class="field">${__('Name')}<input name="name" required maxlength="40" value="${esc(o?.name || '')}" placeholder="${__('e.g. Bali Trip, Birthday Dinner')}"></label>
    <div class="two">${o ? '' : `<label class="field">${__('Currency')}<select name="currency">${Object.keys(RATES).map((c) => `<option ${c === cur() ? 'selected' : ''}>${c}</option>`).join('')}</select></label>`}
      <label class="field">${o ? __('Budget ({cur})', { cur: esc(o.currency) }) : __('Budget')}<input name="amount" type="number" min="1" step="any" required value="${o ? toMajor(o.amount_minor, o.currency) : ''}"></label></div>
    <div class="two"><label class="field">${__('Starts (optional)')}<input name="start" type="date" value="${esc(o?.start || '')}"></label>
      <label class="field">${__('Ends (optional)')}<input name="end" type="date" value="${esc(o?.end || '')}"></label></div>
    <p class="hint">${__('Expenses you tag to this occasion still count in your monthly budgets. This budget is an extra view of what the occasion costs.')}</p>
    <div class="actions">${o ? `<button type="button" class="btn danger" data-act="delete-occasion" data-id="${o.id}">${__('Delete')}</button><button type="button" class="btn secondary" data-act="archive-occasion" data-id="${o.id}">${o.archived ? __('Reopen') : __('Archive')}</button>` : ''}<button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button class="btn" type="submit">${__('Save')}</button></div></form>`);
}
const SWATCHES = ['#4A44C6', '#8B8FF0', '#F5B800', '#EC4899', '#14B8A6', '#F97316', '#EF4444', '#0EA5E9', '#22C55E', '#94A3B8'];
function catDialog(c, parentId) {
  const parent = catOf(c ? c.parent_id : parentId) || null;
  const hasKids = c && childrenOf(c.id).length > 0;
  const tops = D().categories.filter((x) => !x.parent_id && !x.archived && (!c || x.id !== c.id));
  open(`<h2>${c ? (parent ? __('Edit sub-category') : __('Edit category')) : (parent ? __('New sub-category') : __('New category'))}</h2>
  <form data-form="cat" data-id="${c?.id || ''}" style="display:contents">
    <label class="field">${__('Name')}<input name="name" required maxlength="30" value="${esc(c?.name || '')}" placeholder="${__('e.g. Pets')}"></label>
    <div class="two"><label class="field">${__('Icon (emoji)')}<input name="icon" maxlength="4" value="${esc(c?.icon || '🏷️')}"></label>
      <label class="field">${__('Color')}<input name="color" type="color" value="${esc(c?.color || parent?.color || SWATCHES[0])}"></label></div>
    <label class="field">${__('Parent category')}<select name="parent" ${hasKids ? 'disabled' : ''}><option value="">${__('None (top-level)')}</option>${tops.map((x) => `<option value="${x.id}" ${parent && x.id === parent.id ? 'selected' : ''}>${x.icon} ${esc(x.name)}</option>`).join('')}</select></label>
    <label class="field">${__('Type')}<select name="type" ${parent || c ? 'disabled' : ''}><option value="expense" ${c?.type === 'expense' || !c ? 'selected' : ''}>${__('Expense')}</option><option value="income" ${c?.type === 'income' ? 'selected' : ''}>${__('Income')}</option></select></label>
    <p class="hint">${hasKids ? __('This category has sub-categories, so it stays top-level.') : __('Sub-categories show up in the spending breakdown and roll up into their parent.')}</p>
    <div class="actions">${c ? `<button type="button" class="btn danger" data-act="archive-cat" data-id="${c.id}">${__('Archive')}</button>` : ''}<button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button class="btn" type="submit">${__('Save')}</button></div></form>`);
}

/* month breakdown: parent categories, each expandable to its sub-categories */
function breakdownDialog(selId) {
  const k = state.ui.month, tree = spendTree(k), total = tree.reduce((a, n) => a + n.value, 0), c$ = cur();
  const bar = (v, of, color) => `<div class="bar"><i style="width:${of ? Math.round((v / of) * 100) : 0}%;background:${color}"></i></div>`;
  const row = (n) => {
    const has = n.subs.length > 0, pct = total ? Math.round((n.value / total) * 100) : 0;
    const head = `<span class="bk-name">${tile({ icon: n.icon, color: n.color }, true)}<b>${esc(n.name)}</b></span><span class="bk-amt num">${money(n.value, c$)} <small class="muted">${pct}%</small></span>`;
    if (!has) return `<div class="bk-item"><div class="bk-sum nochev">${head}</div>${bar(n.value, total, n.color)}
      ${n.id ? `<div class="bk-subs"><button class="legend-btn" data-act="add-cat" data-parent="${n.id}">${__('+ Add sub-category')}</button></div>` : ''}</div>`;
    return `<details class="bk-item" ${String(n.id) === selId ? 'open' : ''}><summary class="bk-sum">${head}</summary>${bar(n.value, total, n.color)}
      <div class="bk-subs">${n.subs.map((s) => `<div class="bk-sub"><span>${s.icon} ${esc(s.name)}</span><span class="num">${money(s.value, c$)} <small class="muted">${Math.round((s.value / n.value) * 100)}%</small></span></div>${bar(s.value, n.value, n.color)}`).join('')}
        ${n.direct ? `<div class="bk-sub"><span class="muted">${__('Not in a sub-category')}</span><span class="num">${money(n.direct, c$)}</span></div>` : ''}
        <button class="legend-btn" data-act="add-cat" data-parent="${n.id}">${__('+ Add sub-category')}</button></div></details>`;
  };
  open(`<h2>${__('Spending breakdown')}</h2><p class="muted" style="margin-top:-10px">${esc(monthLabel(k))} · ${money(total, c$)} total</p>
    <div class="bk">${tree.map(row).join('') || ('<div class="empty">' + __('No spending this month.') + '</div>')}</div>
    <div class="actions"><button type="button" class="btn secondary" data-act="close">${__('Close')}</button></div>`);
}

function walletDialog(w) {
  const types = [['cash', 'Cash'], ['bank', 'Bank'], ['ewallet', 'E-wallet'], ['card', 'Card']];
  open(`<h2>${w ? __('Edit account') : __('Add account')}</h2><form data-form="wallet" data-id="${w?.id || ''}" style="display:contents">
    <label class="field">${__('Name')}<input name="name" required maxlength="40" placeholder="${__('Savings')}" value="${esc(w?.name || '')}"></label>
    <div class="two"><label class="field">${__('Type')}<select name="type">${types.map(([k, n]) => `<option value="${k}" ${k === w?.type ? 'selected' : ''}>${__(n)}</option>`).join('')}</select></label>
    ${w ? `<label class="field">${__('Currency')}<input value="${esc(w.currency)}" disabled></label>`
      : `<label class="field">${__('Currency')}<select name="currency">${Object.keys(RATES).map((x) => `<option ${x === cur() ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`}</div>
    <label class="field">${w ? __('Current balance ({cur})', { cur: esc(w.currency) }) : __('Opening balance')}<input name="${w ? 'balance' : 'opening'}" type="number" step="any" required value="${w ? toMajor(walletBalance(w), w.currency) : 0}"></label>
    <p class="hint">${w ? __("Changing the balance adjusts this account's starting amount, so your past transactions stay exactly as they are. The currency can't be changed because existing transactions use it.") : __('Pick any currency, for example USD for savings. Totals convert to your reporting currency ({cur}).', { cur: esc(cur()) })}</p>
    <div class="actions">${w ? `<button type="button" class="btn danger" data-act="archive-wallet" data-id="${w.id}">${__('Archive')}</button>` : ''}<button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button class="btn" type="submit">${w ? __('Save') : __('Add')}</button></div></form>`);
}

/* ---------- investment dialogs ---------- */
function accountDialog(a) {
  open(`<h2>${a ? __('Edit investment account') : __('New investment account')}</h2><form data-form="account" data-id="${a?.id || ''}" style="display:contents">
    <label class="field">${__('Name')}<input name="name" required maxlength="40" value="${esc(a?.name || '')}" placeholder="${__('e.g. Crypto Exchange, US Brokerage')}"></label>
    <p class="hint">${__('An account can hold several assets: crypto, US stocks and ETFs.')}</p>
    <div class="actions">${a ? `<button type="button" class="btn danger" data-act="archive-account" data-id="${a.id}">${__('Archive')}</button>` : ''}<button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button class="btn" type="submit">${__('Save')}</button></div></form>`);
}
function holdingDialog(h, accId, opts = {}) {
  if (!h) state.ui.pickType = '';   // the asset picker starts on All
  const accounts = activeAccounts(), info = h && assetInfo(h.symbol), invest = !!opts.invest;
  const ws = D().wallets.filter((w) => !w.archived), firstW = ws.find((w) => w.currency === cur()) || ws[0];
  open(`<h2>${h ? __('Edit {symbol}', { symbol: esc(info.symbol) }) : invest ? __('Add transaction') : __('Add asset')}</h2><form data-form="holding" data-id="${h?.id || ''}" ${invest ? 'data-invest="1"' : ''} style="display:contents">
    ${invest ? kindSeg('invest') : ''}
    <label class="field">${__('Account')}<select name="account">${accounts.map((a) => `<option value="${a.id}" ${a.id === (h?.account_id || accId) ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
    ${h ? `<p><b>${esc(info.name)}</b> <span class="badge">${esc(typeLabel(info.type))}</span></p>` : `
    <div class="field" id="picker">${__('Asset')}
      <div class="asset-search"><select data-pick-type aria-label="${__('Asset type')}">${[['', 'All'], ['crypto', 'Crypto'], ['stock', 'US stocks &amp; ETFs'], ['idx', 'Indonesia (IDX)'], ['commodity', 'Commodities']].map(([v, l]) => `<option value="${v}" ${(state.ui.pickType || '') === v ? 'selected' : ''}>${__(l)}</option>`).join('')}</select>
      <input name="assetq" autocomplete="off" placeholder="${__('Name or ticker')}"></div>
      <div class="results" id="asset-results" role="listbox" hidden></div>
      <div class="picked" id="picked" hidden></div>
      <input type="hidden" name="asset"><input type="hidden" name="assetmeta">
      <label class="field price-fallback" hidden>${__('Price (USD)')}<input name="price" type="number" min="0" step="any" placeholder="${__('Live price unavailable, enter it')}"></label>
      <button type="button" class="legend-btn" data-act="manual-asset">${__('Not listed? Add an asset manually')}</button></div>
    <div class="custom-fields" hidden><div class="two"><label class="field">${__('Symbol')}<input name="symbol" maxlength="10" placeholder="${__('e.g. GOLD')}"></label><label class="field">${__('Name')}<input name="cname" maxlength="40" placeholder="${__('Name')}"></label></div>
      <div class="two"><label class="field">${__('Type')}<select name="ctype"><option value="crypto">${__('Crypto')}</option><option value="stock">${__('Stock')}</option><option value="etf">${__('ETF')}</option><option value="manual">${__('Other')}</option></select></label><label class="field">${__('Price (USD)')}<input name="cprice" type="number" min="0" step="any"></label></div></div>`}
    ${h ? `<div class="holding-now"><div><small class="muted">${__('You hold')}</small><b class="num">${qtyFmt(heldNow(h))} ${esc(info.symbol)}</b></div>
      <div class="tools"><button type="button" class="btn" data-act="trade" data-side="buy" data-id="${h.id}">${__('Buy')}</button><button type="button" class="btn secondary" data-act="trade" data-side="sell" data-id="${h.id}">${__('Sell')}</button></div></div>
      ${tradeList(h)}` : `
    <label class="field">${invest ? __('Quantity bought') : __('Quantity you hold')}<input name="quantity" type="number" min="0" step="any" required placeholder="${__('e.g. 0.05')}"></label>
    <div class="two"><label class="field">${invest ? __('Pay with') : __('Paid from')}<select name="fund">${invest ? '' : ('<option value="">' + __('Already owned (no payment)') + '</option>')}${sourceOptions('buy', null, invest && firstW ? 'w:' + firstW.id : '')}</select></label>
      <label class="field"><span data-fund-amt>${__('Amount paid')}</span><input name="fundamount" type="number" min="0" step="any" ${invest ? 'required' : ''} placeholder="${__('amount')}"></label></div>
    ${invest ? `<label class="field">${__('Date')}<input name="date" type="date" required value="${isoDate(new Date())}"></label>` : ''}
    ${invest ? repeatField() : ''}
    <p class="hint">${invest ? __('The money leaves the account (or your USDT/USDC balance) and the asset is added to your investments. It is not counted as spending.') : __('Choose a payment source if you just bought it. Leave it as "Already owned" for assets you held before.')}</p>`}
    <div class="actions">${h ? `<button type="button" class="btn danger" data-act="delete-holding" data-id="${h.id}">${__('Remove')}</button>` : ''}<button type="button" class="btn secondary" data-act="close">${h ? __('Close') : __('Cancel')}</button><button class="btn" type="submit">${h ? __('Save') : invest ? __('Invest') : __('Add asset')}</button></div></form>`);
  if (!h) syncFund($('#dlg form'));
}
/* the amount's unit follows the payment source: a wallet's currency, or coins for a stablecoin */
function syncFund(form) {
  const src = parseSource(form.fund.value), label = $('[data-fund-amt]', form);
  label.textContent = src ? __('Amount paid ({unit})', { unit: sourceUnit(src) }) : __('Amount paid');
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
  return `<optgroup label="Accounts">${ws.map((w) => `<option value="w:${w.id}" ${sel('w:' + w.id)}>${esc(w.name)} (${esc(w.currency)}) · ${money(walletBalance(w), w.currency)}</option>`).join('')}</optgroup>`
    + (st.length || fresh.length ? `<optgroup label="Stablecoins">${st.map((x) => `<option value="h:${x.id}" ${sel('h:' + x.id)}>${esc(assetInfo(x.symbol).symbol)} · ${qtyFmt(heldNow(x))} held (${esc(accountName(x.account_id))})</option>`).join('')}${fresh.map((s) => `<option value="n:${s}" ${sel('n:' + s)}>${s} · new in ${esc(accountName(h.account_id))}</option>`).join('')}</optgroup>` : '');
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
  if (src.kind === 'wallet' && amount > walletBalance(src.wallet)) return __("{name} doesn't have enough balance", { name: src.wallet.name });
  if (src.kind === 'holding' && amount > heldNow(src.holding) + 1e-12) return __('You only hold {qty} {symbol}', { qty: qtyFmt(heldNow(src.holding)), symbol: assetInfo(src.holding.symbol).symbol });
  if (src.kind === 'new') return __("You don't hold any {symbol} to pay with", { symbol: src.symbol });
  return null;
}

function recordTrade(h, { side, quantity, source, amount, date }) {
  const id = uid(), sym = assetInfo(h.symbol).symbol, word = side === 'buy' ? __('Bought') : __('Sold');
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
  if (!trades.length) return ('<p class="muted" style="font-size:13px">' + __('No buys or sells recorded yet.') + '</p>');
  return `<div class="list">${trades.map((tr) => {
    const tail = tr.kind ? `${tr.kind === 'income' ? __('Income') : __('Expense')} · ${money(tr.amount_minor, tr.currency)}` : tr.via ? __('in exchange for {qty} {symbol}', { qty: qtyFmt(tr.via.quantity), symbol: esc(tr.via.symbol) }) : `${tr.side === 'buy' ? __('paid') : __('received')} ${money(tr.amount_minor, tr.currency)} · ${esc(walletOf(tr.wallet_id)?.name || __('account'))}`;
    return `<div class="pay-row"><span>${esc(new Date(tr.date + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric' }))} · ${tr.kind === 'income' ? __('Received') : tr.kind === 'expense' ? __('Spent') : tr.side === 'buy' ? __('Bought') : __('Sold')} ${qtyFmt(tr.quantity)} ${esc(sym)}<br><small class="muted">${tail}</small></span><span></span><button type="button" class="icon-x" data-act="delete-trade" data-id="${h.id}" data-tid="${tr.id}" aria-label="${__('Remove trade')}">×</button></div>`;
  }).join('')}</div>`;
}

function tradeDialog(h, side) {
  const info = assetInfo(h.symbol), ws = D().wallets.filter((w) => !w.archived), first = ws.find((w) => w.currency === cur()) || ws[0];
  open(`<h2>${side === 'buy' ? __('Buy {symbol}', { symbol: esc(info.symbol) }) : __('Sell {symbol}', { symbol: esc(info.symbol) })}</h2><p class="muted" style="margin-top:-10px">${__('You hold {qty} {symbol}', { qty: qtyFmt(heldNow(h)), symbol: esc(info.symbol) })}</p>
  <form data-form="trade" data-id="${h.id}" style="display:contents">
    <div class="seg"><label><input type="radio" name="side" value="buy" ${side === 'buy' ? 'checked' : ''}>${__('Buy')}</label><label><input type="radio" name="side" value="sell" ${side === 'sell' ? 'checked' : ''}>${__('Sell')}</label></div>
    <div class="two"><label class="field">${__('Quantity')}<input name="quantity" type="number" min="0" step="any" required placeholder="e.g. 0.01"></label>
      <label class="field"><span data-trade-amt></span><input name="amount" type="number" min="0" step="any" required placeholder="${__('amount')}"></label></div>
    <label class="field"><span data-trade-wallet></span><select name="source">${sourceOptions(side, h, first ? 'w:' + first.id : '')}</select></label>
    <label class="field">${__('Date')}<input name="date" type="date" required value="${isoDate(new Date())}"></label>
    <p class="hint" id="trade-hint"></p>
    <div class="actions"><button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button class="btn" type="submit">${__('Save')}</button></div></form>`);
  syncTradeForm($('#dlg form'), false);
}
/* keep labels, the stablecoin options and the price hint in step with the side and the chosen source */
function syncTradeForm(form, rebuild) {
  const h = D().holdings.find((x) => x.id === form.dataset.id), buy = form.side.value === 'buy';
  if (rebuild) { const keep = form.source.value; form.source.innerHTML = sourceOptions(form.side.value, h, keep); }
  const src = parseSource(form.source.value);
  $('[data-trade-wallet]', form).textContent = buy ? __('Pay with') : __('Receive into');
  $('[data-trade-amt]', form).textContent = `${buy ? __('Amount paid') : __('Amount received')} (${src ? sourceUnit(src) : ''})`;
  tradeHint(form);
}
/* price per unit implied by what was typed, next to the market price */
function tradeHint(form) {
  const h = D().holdings.find((x) => x.id === form.dataset.id), src = parseSource(form.source.value), q = parseFloat(form.quantity.value), a = parseFloat(form.amount.value);
  const hint = $('#trade-hint', form), buy = form.side.value === 'buy';
  const base = src?.kind === 'wallet' ? (buy ? __('The money leaves that account. Not counted as spending or income.') : __('The money goes into that account. Not counted as spending or income.')) : (buy ? __('The coins are taken from your stablecoin balance. Not counted as spending or income.') : __('The coins are added to your stablecoin balance. Not counted as spending or income.'));
  if (!h || !src || !(q > 0) || !(a > 0)) { hint.textContent = base; return; }
  const info = assetInfo(h.symbol), month = currentPeriod();
  const usd = src.kind === 'wallet' ? a / RATES[src.wallet.currency] : a * assetInfo(src.kind === 'holding' ? src.holding.symbol : src.symbol).usd(month);
  const per = usd / q, market = info.usd(month), diff = market > 0 ? ((per - market) / market) * 100 : null;
  hint.textContent = __('About ${price} per {symbol}', { price: per.toLocaleString(locale(), { maximumFractionDigits: 4 }), symbol: info.symbol }) + (market > 0 ? ' ' + __('(market ${price}, {diff}).', { price: market.toLocaleString(locale(), { maximumFractionDigits: 4 }), diff: `${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}%` }) + ' ' : '. ') + base;
}

/* ---------- recurring: a rule repeats an expense, income, transfer or investment buy every week or month ----------
   The app has no server job, so due entries are created when the app opens (and when the tab returns to the
   front), dated on the day they were due. Ids are derived from rule + date, so two devices never double-add. */
const REPEATS = [['', 'Does not repeat'], ['weekly', 'Every week'], ['monthly', 'Every month']];
const repeatField = () => `<label class="field">${__('Repeat')}<select name="repeat">${REPEATS.map(([v, l]) => `<option value="${v}">${__(l)}</option>`).join('')}</select></label>`;
const dateOf = (iso) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
function nthDate(start, freq, k) {   // the k-th repeat after `start`: +7k days, or the same day-of-month (clamped to short months)
  const d = dateOf(start);
  if (freq === 'weekly') return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * k));
  const last = new Date(d.getFullYear(), d.getMonth() + k + 1, 0).getDate();
  return isoDate(new Date(d.getFullYear(), d.getMonth() + k, Math.min(d.getDate(), last)));
}
function nextAfter(r, date) { for (let k = 1; k < 5000; k++) { const x = nthDate(r.start, r.freq, k); if (x > date) return x; } return date; }
function detId(...parts) {   // stable uuid-shaped id from text (two 53-bit hashes)
  const str = parts.join('|'); let a = 0xdeadbeef, b = 0x41c6ce57, c = 0x9e3779b9, e = 0x85ebca6b;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); a = Math.imul(a ^ ch, 2654435761); b = Math.imul(b ^ ch, 1597334677); c = Math.imul(c ^ ch, 2246822519); e = Math.imul(e ^ ch, 3266489917); }
  const h = [a, b, c, e].map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function addRule(kind, freq, start, spec) {
  const r = { id: uid(), kind, freq, start, next: '', end: '', active: true, spec };
  r.next = nextAfter(r, start);
  (D().recurring = D().recurring || []).push(r);
  return r;
}
function generateRecurring(r, date) {
  const sp = r.spec, T = D().transactions, add = (row) => { if (!T.some((t) => t.id === row.id)) T.push(row); };
  if (r.kind === 'txn') {
    if (String(sp.wallet_id).startsWith('h:')) {   // USDT/USDC in an investment account
      const h = D().holdings.find((x) => x.id === sp.wallet_id.slice(2)); if (!h || T.some((t) => t.id === detId(r.id, date, 't'))) return;
      if (sp.type === 'expense' && heldNow(h) < sp.quantity - 1e-12) return;   // not enough coins: skip this one
      recordCoinTxn(h, { type: sp.type, quantity: sp.quantity, date, note: sp.note, category_id: sp.category_id, occasion_id: sp.occasion_id, id: detId(r.id, date, 't'), tradeId: detId(r.id, date, 'e') }); return;
    }
    if (!walletOf(sp.wallet_id)) return;
    add({ id: detId(r.id, date, 't'), type: sp.type, amount_minor: sp.amount_minor, currency: sp.currency, occurred_at: date, wallet_id: sp.wallet_id, note: sp.note || '', category_id: sp.category_id || null, category_source: 'user', ai_confidence: null, ...(sp.occasion_id && occasionOf(sp.occasion_id) ? { occasion_id: sp.occasion_id } : {}) });
  } else if (r.kind === 'transfer') {
    const A = walletOf(sp.from), B = walletOf(sp.to); if (!A || !B) return;
    const base = { category_id: null, category_source: 'user', ai_confidence: null, occurred_at: date, transfer_id: detId(r.id, date, 'g') }, extra = sp.note ? ` · ${sp.note}` : '';
    add({ id: detId(r.id, date, 'o'), wallet_id: A.id, type: 'transfer', flow: 'out', amount_minor: sp.amount_minor, currency: A.currency, note: __('Transfer to {name}', { name: B.name }) + extra, ...base });
    add({ id: detId(r.id, date, 'i'), wallet_id: B.id, type: 'transfer', flow: 'in', amount_minor: sp.received_minor, currency: B.currency, note: __('Transfer from {name}', { name: A.name }) + extra, ...base });
    if (sp.fee_minor > 0) add({ id: detId(r.id, date, 'f'), wallet_id: A.id, type: 'expense', amount_minor: sp.fee_minor, currency: A.currency, note: __('Transfer fee ({from} → {to})', { from: A.name, to: B.name }), ...base });
  } else if (r.kind === 'invest') {
    const src = parseSource(sp.fund); if (!src || (src.kind === 'wallet' && !src.wallet) || (src.kind === 'holding' && !src.holding)) return;
    let h = D().holdings.find((x) => x.account_id === sp.account && x.symbol === sp.symbol);
    if (!h) { h = { id: uid(), account_id: sp.account, symbol: sp.symbol, quantity: 0, since: date.slice(0, 7), trades: [] }; D().holdings.push(h); }
    recordTrade(h, { side: 'buy', quantity: sp.quantity, source: src, amount: parseAmount(src, sp.fundamount), date });
  }
}
function runRecurring() {
  const d = state.data; if (!d || state.real || !(d.recurring || []).length) return 0;
  const today = isoDate(new Date()); let n = 0;
  d.recurring.forEach((r) => {
    if (r.active === false) return;
    for (let guard = 0; r.next <= today && (!r.end || r.next <= r.end) && guard < 400; guard++) { generateRecurring(r, r.next); n++; r.next = nextAfter(r, r.next); }
  });
  if (n) { d.transactions.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)); save(); }
  return n;
}
function recurringNow() { const n = runRecurring(); if (n) { render(); toast(__(n === 1 ? '{n} recurring entry added' : '{n} recurring entries added', { n })); } }
const ruleTitle = (r) => {
  const sp = r.spec;
  if (r.kind === 'txn') { const c = catOf(sp.category_id), w = walletOf(sp.wallet_id) || (String(sp.wallet_id).startsWith('h:') ? { name: accountName((D().holdings.find((x) => x.id === sp.wallet_id.slice(2)) || {}).account_id) } : null); return { icon: sp.type === 'income' ? '💵' : '🧾', name: sp.note || (c && c.name) || (sp.type === 'income' ? __('Income') : __('Expense')), amount: `${sp.type === 'income' ? '+' : '−'}${money(sp.amount_minor, sp.currency)}`, where: w ? w.name : '' }; }
  if (r.kind === 'transfer') { const A = walletOf(sp.from), B = walletOf(sp.to); return { icon: '🔁', name: `${A ? A.name : '?'} → ${B ? B.name : '?'}`, amount: money(sp.amount_minor, A ? A.currency : cur()), where: sp.note || '' }; }
  const info = assetInfo(sp.symbol), src = parseSource(sp.fund);
  return { icon: '📈', name: __('Buy {qty} {symbol}', { qty: qtyFmt(sp.quantity), symbol: info.symbol }), amount: src ? `${qtyFmt(parseAmount(src, sp.fundamount))} ${sourceUnit(src)}` : '', where: '' };
};
function recurringCard() {
  const list = D().recurring || []; if (!list.length) return '';
  return `<section class="card"><div class="card-head"><h2>${__('Recurring')}</h2></div>${list.map((r) => {
    const t = ruleTitle(r), freq = r.freq === 'weekly' ? __('Every week') : __('Every month');
    return `<div class="brow cat-row"><span class="tile" style="--c:#8B8FF0">${t.icon}</span><div class="cat-main"><b class="cat-name">${esc(t.name)}</b><small class="muted">${esc(t.amount)}${t.where ? ' · ' + esc(t.where) : ''}</small><small class="muted">${freq} · ${r.active === false ? __('Paused') : __('Next {date}', { date: dateOf(r.next).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) })}</small></div>
      <div class="tools"><button class="btn secondary" data-act="rec-toggle" data-id="${r.id}">${r.active === false ? __('Resume') : __('Pause')}</button><button class="btn secondary" data-act="rec-del" data-id="${r.id}" aria-label="${__('Delete')}">🗑</button></div></div>`;
  }).join('')}</section>`;
}

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) { if (state.ui.walletMenu || state.ui.infoOpen) { state.ui.walletMenu = null; state.ui.infoOpen = null; render(); } return; }
  const { act, id, type, date } = el.dataset, find = (arr) => arr.find((x) => x.id === id);
  if (act !== 'wallet-menu') state.ui.walletMenu = null;
  if (act !== 'toggle-info') state.ui.infoOpen = null;
  if (act === 'close') close();
  else if (act === 'theme-toggle') { applyTheme(effectiveTheme() === 'dark' ? 'light' : 'dark'); render(); }
  else if (act === 'wallet-menu') { state.ui.walletMenu = state.ui.walletMenu === id ? null : id; render(); }
  else if (act === 'add-txn') txnDialog(null, type, undefined, date);
  else if (act === 'open-day') location.hash = '#/transactions/' + id;
  else if (act === 'invest') holdingDialog(null, null, { invest: true });
  else if (act === 'transfer') transferDialog();
  else if (act === 'view-transfer') transferDetail(id);
  else if (act === 'delete-transfer') { D().transactions = D().transactions.filter((t) => t.transfer_id !== id); save(); close(); render(); toast('Transfer deleted'); }
  else if (act === 'edit-txn') txnDialog(find(D().transactions));
  else if (act === 'rec-toggle') { const r = find(D().recurring); r.active = r.active === false; if (r.active) { const today = isoDate(new Date()); while (r.next < today) r.next = nextAfter(r, r.next); } save(); render(); }   // resuming skips what was missed while paused
  else if (act === 'rec-del') { D().recurring = D().recurring.filter((r) => r.id !== id); save(); render(); toast('Recurring entry deleted'); }
  else if (act === 'add-budget') budgetDialog();
  else if (act === 'edit-budget') budgetDialog(budgetStatus(state.ui.month).find((b) => b.id === id));
  else if (act === 'toggle-cats') { state.ui.catsOpen = !state.ui.catsOpen; render(); }
  else if (act === 'toggle-cat') { const o = state.ui.openCats; if (o.has(id)) o.delete(id); else o.add(id); render(); }
  else if (act === 'quick-cat') { const q = $('.quick-cat', el.form || el.closest('form')); q.hidden = !q.hidden; if (!q.hidden) $('input[name=qc_name]', q).focus(); }
  else if (act === 'quick-cat-cancel') $('.quick-cat', el.closest('form')).hidden = true;
  else if (act === 'quick-cat-add') quickAddCategory(el.closest('form'));
  else if (act === 'add-wallet') walletDialog();
  else if (act === 'add-occasion') occasionDialog();
  else if (act === 'add-occasion-txn') txnDialog(null, 'expense', occasionOf(id));
  else if (act === 'edit-occasion') occasionDialog(occasionStatus().find((o) => o.id === id));
  else if (act === 'archive-occasion') { const o = occasionOf(id); o.archived = !o.archived; save(); close(); render(); toast(o.archived ? 'Occasion archived' : 'Occasion reopened'); }
  else if (act === 'delete-occasion') { D().occasions = D().occasions.filter((o) => o.id !== id); D().transactions.forEach((t) => { if (t.occasion_id === id) delete t.occasion_id; }); save(); close(); render(); toast('Occasion deleted. Its expenses were kept.'); }
  else if (act === 'view-occasion') { state.ui.occ = id; state.ui.q = ''; state.ui.cat = ''; state.ui.wallet = ''; const o = occasionOf(id); state.ui.month = periodKeyOf(o.start || isoDate(new Date())); location.hash = '#/transactions'; render(); }
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
  else if (act === 'pick-type-old') { state.ui.pickType = el.dataset.type; $$('.pill', el.parentElement).forEach((b) => b.classList.toggle('on', b === el)); runAssetSearch(); }
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
  else if (act === 'revoke') Cloud.signOut('others').then(({ error }) => toast(error ? error.message : 'Other devices signed out'));
  else if (act === 'edit-wallet') walletDialog(walletOf(id));
  else if (act === 'toggle-more') { const k = el.dataset.key === 'hist' ? 'histMore' : 'walletsMore'; state.ui[k] = !state.ui[k]; render(); }
  else if (act === 'goto') location.hash = '#/' + el.dataset.route;
  else if (act === 'toggle-info') { state.ui.infoOpen = state.ui.infoOpen === id ? null : id; render(); }
  else if (act === 'toggle-arch') { state.ui.archOpen = !state.ui.archOpen; render(); }
  else if (act === 'restore-wallet') { walletOf(id).archived = false; save(); render(); toast('Account restored'); }
  else if (act === 'delete-wallet') {
    const w = walletOf(id), n = D().transactions.filter((t) => t.wallet_id === id).length;
    if (n) { toast(__(n === 1 ? "Can't delete: {n} transaction uses this account. Restore it instead." : "Can't delete: {n} transactions use this account. Restore it instead.", { n })); return; }
    if (!confirm(__('Delete "{name}" permanently? This can\'t be undone.', { name: w.name }))) return;
    D().wallets = D().wallets.filter((x) => x.id !== id); save(); render(); toast('Account deleted');
  }
  else if (act === 'archive-wallet') { find(D().wallets).archived = true; save(); close(); render(); toast('Account archived'); }
  else if (act === 'delete-txn') {
    const tx = find(D().transactions), coin = coinOf(tx);
    if (coin) { if (!removeTrade(coin, coin.trades.find((x) => x.id === tx.trade_id))) { toast(__("Can't delete: the {symbol} has already been spent", { symbol: assetInfo(coin.symbol).symbol })); return; } }
    else D().transactions = D().transactions.filter((t) => t.id !== id);
    save(); close(); render(); toast('Transaction deleted');
  }
  else if (act === 'delete-budget') { D().budgets = D().budgets.filter((b) => b.id !== id); save(); close(); render(); toast('Budget deleted'); }
  else if (act === 'signout') Cloud.idle().then(() => Cloud.signOut()).then(() => { state.data = null; state.real = null; state.auth = { status: 'out', view: 'landing', email: '', notice: '', error: '' }; render(); });
  else if (act === 'auth-check') checkConfirmed(true);
  else if (act === 'auth-view') { stopPolling(); Object.assign(state.auth, { view: el.dataset.view, error: '', notice: '' }); render(); }
  else if (act === 'auth-google') Cloud.google().then(({ error }) => { if (error) { state.auth.error = error.message; render(); } });
  else if (act === 'auth-resend') { if (CAPTCHA_KEY && !captchaToken) { state.auth.error = 'Please complete the verification first.'; render(); return; } Cloud.resend(state.auth.email, captchaToken || undefined).then(({ error }) => { Object.assign(state.auth, error ? { error: error.message, notice: '' } : { error: '', notice: 'Email sent again. Check your inbox and spam folder.' }); render(); }); }
  else if (act === 'retry-load') { state.auth.loadError = ''; render(); loadUserData(); }
  else if (act === 'demo-off') setDemo(false);
  else if (act === 'remove-sample') { if (confirm(__('Remove the sample data? Anything you added yourself stays.'))) removeSample(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.row[data-act]')) e.target.click(); if (e.key === 'Escape' && state.ui.walletMenu) { state.ui.walletMenu = null; render(); } });

document.addEventListener('input', (e) => {
  const t = e.target, f = t.form;
  if (f?.dataset.form !== 'transfer') return;
  if (t.name === 'received') t.dataset.touched = '1';   // the user set it: stop auto-filling
  else if (t.name === 'amount') syncTransfer(f);
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('[data-bind="month"]')) { state.ui.month = t.value; render(); }
  else if (t.matches('[data-bind="pfRange"]')) { state.ui.pfRange = t.value; render(); }
  else if (t.matches('[data-filter]')) { state.ui[t.dataset.filter] = t.value; const l = $('#txn-list'); if (l) l.innerHTML = txnListHtml(); }
  else if (t.name === 'type' && t.form?.dataset.form === 'txn') {
    if (t.value === 'invest') holdingDialog(null, null, { invest: true });
    else if (t.value === 'transfer') transferDialog();
    else {
      $('select[name=category]', t.form).innerHTML = catOptions(t.value); $('select[name=qc_parent]', t.form).innerHTML = quickParentOptions(t.value);
      if (!t.form.dataset.id) { const w = t.form.wallet, keep = w.value; w.innerHTML = acctOptions(t.value, keep); if (![...w.options].some((o) => o.value === keep)) w.selectedIndex = 0; syncTxnUnit(t.form); }   // "new" coin options exist for income only
    }
  }
  else if (t.matches('[data-pick-type]')) { state.ui.pickType = t.value; runAssetSearch(); }
  else if (t.matches('[data-theme-select]')) { applyTheme(t.value); if (state.data && !state.real) { state.data.profile.theme = THEME; save(); } render(); }
  else if (t.matches('[data-lang]')) { setLang(t.value); if (state.data && !state.real) { state.data.profile.language = LANG; save(); } render(); }
  else if (t.matches('[data-demo]')) setDemo(t.checked);
  else if (t.matches('[data-setting]')) applySetting(t);
  else if (t.name === 'side' && t.form?.dataset.form === 'trade') syncTradeForm(t.form, true);
  else if (t.name === 'source' && t.form?.dataset.form === 'trade') syncTradeForm(t.form, false);
  else if (t.name === 'fund' && t.form?.dataset.form === 'holding') syncFund(t.form);
  else if (t.name === 'txkind') {
    const here = t.form?.dataset.form;   // 'holding' is the Invest dialog
    if (t.value === 'invest' && here !== 'holding') holdingDialog(null, null, { invest: true });
    else if (t.value === 'transfer' && here !== 'transfer') transferDialog();
    else if (t.value === 'expense' || t.value === 'income') txnDialog(null, t.value);
  }
  else if (t.form?.dataset.form === 'transfer' && (t.name === 'from' || t.name === 'to')) {
    const f = t.form;   // never the same wallet on both sides
    if (f.from.value === f.to.value) { const other = D().wallets.find((w) => !w.archived && w.id !== t.value); (t.name === 'from' ? f.to : f.from).value = other.id; }
    delete f.received.dataset.touched; syncTransfer(f);
  }
  else if (t.name === 'date' && t.form?.dataset.form === 'txn' && t.form.occasion && !t.form.occasion.value) {
    const hit = occasionOn(t.value)[0]; if (hit) t.form.occasion.value = hit.id;   // a date inside an occasion tags it automatically
  }
  else if (t.name === 'wallet' && t.form?.dataset.form === 'txn') {
    syncTxnUnit(t.form);
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
    box.hidden = false; box.innerHTML = ('<div class="res-note">' + __('Searching…') + '</div>');
    try {
      state.pick = await searchAssets(q, state.ui.pickType);
      box.innerHTML = state.pick.map((a, i) => `<button type="button" class="res" role="option" data-act="pick-asset" data-i="${i}"><b>${esc(a.symbol)}</b><span>${esc(a.name)}</span><span class="badge">${esc(a.type)}</span></button>`).join('') || ('<div class="res-note">' + __('No matches. Try another name or ticker.') + '</div>');
    } catch (err) { box.innerHTML = `<div class="res-note">Search failed: ${esc(err.message)}</div>`; }
  }, 220);
}
async function pickAsset(a, form) {
  form.asset.value = a.key; form.assetmeta.value = JSON.stringify(a); form.price.value = '';
  $('#asset-results').hidden = true; form.assetq.value = '';
  const chip = $('#picked'), fb = $('.price-fallback', form); chip.hidden = false; fb.hidden = true;
  chip.innerHTML = `<b>${esc(a.symbol)}</b> ${esc(a.name)} <span class="badge">${esc(a.type)}</span> <span class="muted" id="picked-price"></span>`;
  if (!a.fh && !a.yh) return; // built-in asset: priced from the mock catalog
  $('#picked-price').textContent = __('getting price…');
  try {
    const q = await quoteFull(a), p = q.price; form.price.value = p;
    const nat = q.currency && q.currency !== 'USD' ? ` (${money(toMinor(q.native, q.currency), q.currency)})` : '';
    $('#picked-price').textContent = `$${p.toLocaleString(locale(), { maximumFractionDigits: 6 })}${nat} live`;
  }
  catch { $('#picked-price').textContent = __('price unavailable'); fb.hidden = false; }
}

document.addEventListener('input', (e) => {
  if (e.target.form?.dataset.form === 'trade' && ['quantity', 'amount'].includes(e.target.name)) tradeHint(e.target.form);
  if (e.target.name === 'assetq') runAssetSearch();
  if (e.target.matches('[data-filter="q"]')) { state.ui.q = e.target.value; const l = $('#txn-list'); if (l) l.innerHTML = txnListHtml(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.name?.startsWith('qc_')) { e.preventDefault(); quickAddCategory(e.target.form); return; }   // Enter adds the category, not the transaction
  if (e.key === 'Enter' && e.target.id === 'gsearch') { state.ui.q = e.target.value; location.hash = '#/transactions'; }
});

function applySetting(el) {
  const p = D().profile, k = el.dataset.setting;
  if (k === 'name') p.name = el.value.trim() || p.name;
  else if (k === 'ai') p.ai = el.checked;
  else if (k === 'period') p.period = Math.min(28, Math.max(1, +el.value || 1));
  else if (k === 'currency' && el.value !== p.currency) {
    // only the reporting currency changes; wallets and transactions keep their own currency
    const from = p.currency, to = el.value;
    D().budgets.forEach((b) => { b.amount_minor = convert(b.amount_minor, from, to); b.currency = to; });
    p.currency = to; state.ui.pf = null; toast(__('Reporting currency changed to {cur}', { cur: to }));
  }
  save(); render();
}

document.addEventListener('submit', (e) => {
  const f = e.target, kind = f.dataset.form; if (!kind) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(f));
  if (['signin', 'signup', 'forgot', 'recovery'].includes(kind)) { submitAuth(kind, v, f); return; }
  if (kind === 'txn') {
    // a USDT/USDC "new" choice builds its holding now but only keeps it once the transaction is valid
    const fresh = v.wallet.startsWith('n:') ? v.wallet.split(':') : null;
    const coin = v.wallet.startsWith('h:') ? D().holdings.find((x) => x.id === v.wallet.slice(2)) : fresh ? { id: uid(), account_id: fresh[2], symbol: fresh[1], quantity: 0, since: monthKey(new Date()), trades: [], _new: true } : null, type = v.type;
    const wc = coin ? 'USD' : walletOf(v.wallet).currency, minor = coin ? Math.round(parseFloat(v.amount) * 100) : toMinor(parseFloat(v.amount), wc), existing = f.dataset.id && D().transactions.find((t) => t.id === f.dataset.id);
    if (!(minor > 0)) { toast('Enter an amount above zero'); return; }
    const row = existing || { id: uid(), category_source: 'user', ai_confidence: null };
    Object.assign(row, { type, amount_minor: minor, currency: wc, occurred_at: v.date, wallet_id: coin ? null : v.wallet, note: v.note.trim(), category_id: v.category || null });
    if (type === 'expense' && v.occasion) row.occasion_id = v.occasion; else delete row.occasion_id;
    let msg = existing ? 'Saved' : 'Transaction added';
    if (v.category) { row.category_source = 'user'; row.ai_confidence = null; }
    else {
      const tag = aiTag(row.note, type);
      if (tag) { row.category_id = tag.category_id; row.category_source = 'ai'; row.ai_confidence = tag.confidence; msg = __('AI tagged it as {name}', { name: catOf(tag.category_id).name }); }
      else { row.category_source = 'user'; msg = __(existing ? 'Saved · left uncategorized' : 'Transaction added · left uncategorized'); }
    }
    if (coin) {   // paid from / received in USDT or USDC: the coins move as a trade linked to this transaction
      if (coin._new) {
        if (type !== 'income') { toast(__('You only hold {qty} {symbol}', { qty: 0, symbol: coin.symbol })); return; }
        delete coin._new;
        if (!coin.account_id || !D().investments.some((a) => a.id === coin.account_id)) { const a = D().investments.find((x) => !x.archived) || (D().investments.push({ id: uid(), name: __('Crypto'), archived: false }), D().investments[D().investments.length - 1]); coin.account_id = a.id; }
        D().holdings.push(coin);
      }
      const qty = parseFloat(v.amount), tr = existing && coin.trades.find((x) => x.id === existing.trade_id), oldQ = tr ? tr.side === 'buy' ? tr.quantity : -tr.quantity : 0;
      const newQ = type === 'income' ? qty : -qty, after = r12(coin.quantity - oldQ + newQ);
      const nowOk = v.date > todayIso() || heldNow(coin) - (tr && tr.date <= todayIso() ? oldQ : 0) + newQ >= -1e-12;   // coins dated later are not spendable yet
      if (after < -1e-12 || !nowOk) { toast(__('You only hold {qty} {symbol}', { qty: qtyFmt(Math.max(0, heldNow(coin))), symbol: assetInfo(coin.symbol).symbol })); return; }
      if (tr) { coin.quantity = after; Object.assign(tr, { date: v.date, side: type === 'income' ? 'buy' : 'sell', kind: type, quantity: qty, amount_minor: minor }); if (type === 'income' && v.date.slice(0, 7) < coin.since) coin.since = v.date.slice(0, 7); }
      else recordCoinTxn(coin, { type, quantity: qty, date: v.date, note: row.note, category_id: row.category_id, category_source: row.category_source, ai_confidence: row.ai_confidence, occasion_id: row.occasion_id });
      if (v.repeat && !existing) addRule('txn', v.repeat, v.date, { type, amount_minor: minor, currency: wc, wallet_id: 'h:' + coin.id, quantity: qty, note: row.note, category_id: row.category_id, occasion_id: row.occasion_id || null });
    } else if (!existing) D().transactions.push(row);
    if (!coin && !existing && v.repeat) addRule('txn', v.repeat, v.date, { type, amount_minor: minor, currency: wc, wallet_id: v.wallet, note: row.note, category_id: row.category_id, occasion_id: row.occasion_id || null });
    D().transactions.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    state.ui.month = periodKeyOf(row.occurred_at) <= currentPeriod() ? periodKeyOf(row.occurred_at) : state.ui.month;
    save(); close(); render(); toast(msg);
  }
  if (kind === 'transfer') {
    const A = walletOf(v.from), B = walletOf(v.to);
    if (!A || !B || A.id === B.id) { toast('Pick two different accounts'); return; }
    const cross = A.currency !== B.currency, amount = toMinor(parseFloat(v.amount), A.currency), fee = v.fee ? toMinor(parseFloat(v.fee), A.currency) : 0;
    const received = cross ? toMinor(parseFloat(v.received), B.currency) : amount;
    if (!(amount > 0) || !(received > 0)) { toast(cross && !(received > 0) ? 'Enter the amount received' : 'Enter an amount above zero'); return; }
    if (!(fee >= 0)) { toast('The fee must be zero or more'); return; }
    if (A.type !== 'card' && amount + fee > walletBalance(A)) { toast(__("{name} doesn't have enough balance", { name: A.name })); return; }
    const gid = uid(), base = { category_id: null, category_source: 'user', ai_confidence: null, occurred_at: v.date, transfer_id: gid }, extra = v.note.trim() ? ` · ${v.note.trim()}` : '';
    D().transactions.push({ id: uid(), wallet_id: A.id, type: 'transfer', flow: 'out', amount_minor: amount, currency: A.currency, note: __('Transfer to {name}', { name: B.name }) + extra, ...base });
    D().transactions.push({ id: uid(), wallet_id: B.id, type: 'transfer', flow: 'in', amount_minor: received, currency: B.currency, note: __('Transfer from {name}', { name: A.name }) + extra, ...base });
    if (fee > 0) D().transactions.push({ id: uid(), wallet_id: A.id, type: 'expense', amount_minor: fee, currency: A.currency, note: __('Transfer fee ({from} → {to})', { from: A.name, to: B.name }), ...base });
    if (v.repeat) addRule('transfer', v.repeat, v.date, { from: A.id, to: B.id, amount_minor: amount, received_minor: received, fee_minor: fee, note: v.note.trim() });
    D().transactions.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    state.ui.month = periodKeyOf(v.date) <= currentPeriod() ? periodKeyOf(v.date) : state.ui.month;
    save(); close(); render(); toast(__('Moved {amount} from {from} to {to}', { amount: money(amount, A.currency), from: A.name, to: B.name }) + (fee > 0 ? ' ' + __('(fee {fee})', { fee: money(fee, A.currency) }) : '')); return;
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
    save(); close(); render(); toast('Account saved'); return;
  }
  if (kind === 'wallet') {
    D().wallets.push({ id: uid(), name: v.name.trim(), type: v.type, currency: v.currency, opening_balance_minor: toMinor(parseFloat(v.opening || 0), v.currency), since: monthKey(new Date()), archived: false });
    save(); close(); render(); toast(__('Account added in {cur}', { cur: v.currency }));
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
    save(); close(); render(); toast(applied < amount ? __('Recorded {amount} (the remaining balance)', { amount: money(applied, l.currency) }) : 'Recorded'); return;
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
    if (side === 'sell' && qty > heldNow(h) + 1e-12) { toast(__('You only hold {qty} {symbol}', { qty: qtyFmt(heldNow(h)), symbol: info.symbol })); return; }
    const short = payShortfall(src, side, amount); if (short) { toast(short); return; }
    recordTrade(h, { side, quantity: qty, source: src, amount, date: v.date });
    save(); close(); render(); toast(`${side === 'buy' ? __('Bought') : __('Sold')} ${qtyFmt(qty)} ${info.symbol}`); return;
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
      if (meta.fh || meta.yh) {
        const price = parseFloat(v.price);
        if (!(price > 0)) { toast('No live price yet. Enter one or wait a moment.'); return; }
        D().livePrices[sym] = price;
        if (!CATALOG.some((c) => c[0] === sym)) D().customAssets[sym] = { symbol: meta.symbol, name: meta.name, type: meta.type, fh: meta.fh, yh: meta.yh, mult: meta.mult, source: meta.yh ? 'yahoo' : 'finnhub' };
      }
    }
    // paid from a wallet or a stablecoin: that side loses the money. No source = an asset you already owned.
    const src = parseSource(v.fund), paid = src ? parseAmount(src, v.fundamount || 0) : 0;
    if (src && !(paid > 0)) { toast('Enter the amount you paid'); return; }
    if (src) { const short = payShortfall(src, 'buy', paid); if (short) { toast(short); return; } }
    let h = D().holdings.find((x) => x.account_id === v.account && x.symbol === sym);
    if (!h) { h = { id: uid(), account_id: v.account, symbol: sym, quantity: 0, since: monthKey(new Date()), trades: [] }; D().holdings.push(h); }
    if (src) {
      recordTrade(h, { side: 'buy', quantity: qty, source: src, amount: paid, date: v.date || isoDate(new Date()) });
      if (v.repeat && f.dataset.invest) addRule('invest', v.repeat, v.date || isoDate(new Date()), { account: v.account, symbol: sym, quantity: qty, fund: v.fund, fundamount: v.fundamount });
    } else h.quantity += qty;
    if (f.dataset.invest) state.ui.pfTab = 'investment';
    save(); close(); render(); toast(`${assetInfo(sym).symbol} ${src ? 'bought' : 'added'}${src ? ` · ${qtyFmt(paid)} ${sourceUnit(src)} paid` : ''}`);
  }
});

window.addEventListener('hashchange', render);
window.addEventListener('beforeunload', (e) => { if (Cloud.pending > 0) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- auth + data loading ---------- */
const friendlyAuthError = (e) => (/invalid login/i.test(e.message) ? 'Wrong email or password.' : /already registered/i.test(e.message) ? 'That email already has an account. Try signing in.' : e.message);
/* After sign-up the person confirms their email, often on another device (their phone). This tab can't
   know, so while the 'Check your email' screen is open it quietly retries the sign-in (password kept only in
   memory, never saved) every 15s and when the tab regains focus, and continues as soon as it works. */
let pending = null, pollTimer = null;
function stopPolling() { clearInterval(pollTimer); pollTimer = null; pending = null; }
function startPolling(email, password) {
  stopPolling(); pending = { email, password, until: Date.now() + 20 * 60 * 1000 };
  if (!CAPTCHA_KEY) pollTimer = setInterval(() => checkConfirmed(false), 15000);   // with CAPTCHA on, only the button works
}
async function checkConfirmed(manual) {
  if (!pending || state.auth.status !== 'out' || state.auth.view !== 'sent') return;
  if (Date.now() > pending.until) { stopPolling(); return; }
  if (CAPTCHA_KEY && !captchaToken) { if (manual) { state.auth.error = 'Please complete the verification first.'; render(); } return; }
  const { error } = await Cloud.signIn(pending.email, pending.password, captchaToken || undefined);
  if (!error) { stopPolling(); return; }   // the signed-in event takes it from here
  if (/not confirmed/i.test(error.message)) { if (manual) toast('Not confirmed yet. Open the link in the email, then try again.'); }
  else { stopPolling(); if (manual) { state.auth.error = friendlyAuthError(error); render(); } }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkConfirmed(false); if (state.data && !state.real) recurringNow(); } });
async function submitAuth(kind, v, f) {
  const a = state.auth, btn = $('button[type=submit]', f);
  if (btn) btn.disabled = true;
  Object.assign(a, { error: '', notice: '' }); if (v.email) a.email = v.email.trim();
  if (CAPTCHA_KEY && kind !== 'recovery' && !captchaToken) { a.error = 'Please complete the verification first.'; render(); return; }
  try {
    if (kind === 'signin') {
      const { error } = await Cloud.signIn(a.email, v.password, captchaToken || undefined);
      if (error) {
        if (/not confirmed/i.test(error.message)) { Object.assign(a, { view: 'sent', notice: 'Your email is not confirmed yet. Open the link we sent you, or resend it below.' }); startPolling(a.email, v.password); }
        else a.error = friendlyAuthError(error);
      }
    } else if (kind === 'signup') {
      const { data, error } = await Cloud.signUp(a.email, v.password, v.name.trim(), v.currency, captchaToken || undefined);
      if (error) a.error = friendlyAuthError(error);
      else if (!data.session) { a.view = 'sent'; startPolling(a.email, v.password); }   // email confirmation is on: wait for the link
    } else if (kind === 'forgot') {
      const { error } = await Cloud.reset(a.email, captchaToken || undefined);
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
  if (!session) { state.data = null; state.real = null; Cloud.forget(); Object.assign(a, { status: 'out', uid: null }); if (a.view === 'recovery') a.view = 'signin'; render(); return; }
  stopPolling(); a.email = session.user.email || a.email;
  if (a.uid === session.user.id && state.data) return;   // token refresh or tab refocus: nothing to reload
  Object.assign(a, { status: 'in', uid: session.user.id, loadError: '', view: a.view === 'recovery' ? 'recovery' : 'signin', error: '', notice: '' });
  render(); loadUserData();
}
async function loadUserData() {
  try {
    state.real = null;   // leave demo mode while reloading; it is switched back on below if you had it on
    state.data = await Cloud.load();
    state.data.livePrices = loadPrices();
    if (api.finnhub || api.yahoo) refreshPrices(true);
    if (state.data.profile.theme && THEMES.includes(state.data.profile.theme)) applyTheme(state.data.profile.theme);
    if (state.data.profile.language && LANGS[state.data.profile.language]) { setLang(state.data.profile.language); render(); }   // your saved choice wins over this device's
    if (demoWanted()) await setDemo(true);
    else setTimeout(recurringNow, 300);
  } catch (err) { state.auth.loadError = err.message || 'network error'; }
  render();
}
/* a failed save leaves the screen ahead of the database, so show the server's truth again */
function onSaveError(err) {
  console.error(err);
  toast(__("Couldn't save your last change ({error}). Showing your saved data.", { error: String(err.message || err).slice(0, 80) }));
  loadUserData();
}
/* ---------- sample data: a demo mode, not saved data ----------
   Turning it on swaps in a ready-made demo account (wallets, transactions, budgets, a portfolio, loans) in memory.
   Your own data is kept aside untouched, and nothing you do while the demo is on is saved or synced.
   Turning it off brings your own data back. The choice is remembered on this device. */
const DEMO_KEY = 'stiver.demo.v1';
const demoWanted = () => { try { return localStorage.getItem(DEMO_KEY) === '1'; } catch { return false; } };
async function setDemo(on) {
  if (on === !!state.real || !state.data) return;
  if (on) {
    await Cloud.idle();   // let any pending save of your own data finish first
    const own = state.data, d = seed(own.profile.name || 'You', own.profile.currency);
    d.profile = { ...own.profile, sample: null }; d.livePrices = own.livePrices || {};
    state.real = own; state.data = d;
  } else { state.data = state.real; state.real = null; }
  try { localStorage.setItem(DEMO_KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
  Object.assign(state.ui, { pf: null, pfTab: 'savings', cat: '', wallet: '', occ: '', q: '' });
  render();
}
const demoBar = () => `<div class="demo-bar" role="status"><span>${__("🧪 You're viewing {sample}. Your own data is safe, and changes made here aren't saved.", { sample: '<b>' + __('sample data') + '</b>' })}</span><button class="btn secondary" data-act="demo-off">${__('Back to my data')}</button></div>`;
function removeSample() {
  const d = D(), smp = d.profile.sample; if (!smp) return;
  const is = (k, id) => (smp[k] || []).includes(id);
  d.transactions = d.transactions.filter((t) => !is('transactions', t.id));
  d.budgets = d.budgets.filter((b) => !is('budgets', b.id));
  d.loans = d.loans.filter((l) => !is('loans', l.id)); d.lent = d.lent.filter((l) => !is('lent', l.id));
  d.holdings = d.holdings.filter((h) => !is('holdings', h.id));
  // things the sample created that you have since used stay (a wallet or category your own transactions point to)
  const usedWallets = new Set(d.transactions.map((t) => t.wallet_id)), usedCats = new Set([...d.transactions.map((t) => t.category_id), ...d.budgets.map((b) => b.category_id)].filter(Boolean));
  const usedAcc = new Set(d.holdings.map((h) => h.account_id));
  let kept = 0;
  d.wallets = d.wallets.filter((w) => { if (!is('wallets', w.id)) return true; if (usedWallets.has(w.id)) { kept++; return true; } return false; });
  d.investments = d.investments.filter((a) => { if (!is('investments', a.id)) return true; if (usedAcc.has(a.id)) { kept++; return true; } return false; });
  const keepCat = (c) => usedCats.has(c.id) || d.categories.some((k) => k.parent_id === c.id && (usedCats.has(k.id)));
  d.categories = d.categories.filter((c) => { if (!is('categories', c.id)) return true; if (keepCat(c)) { kept++; return true; } return false; });
  d.profile.sample = null;
  save(); render(); toast(kept ? __(kept === 1 ? 'Sample data removed. Kept {n} item you have since used.' : 'Sample data removed. Kept {n} items you have since used.', { n: kept }) : 'Sample data removed.');
}
setLang(initialLang()); applyTheme(initialTheme());
if (Cloud.configured) Cloud.init(onAuth, new Map(CATALOG.map((c) => [c[0], [c[1], c[2]]])), onSaveError);
else { Object.assign(state.auth, { status: 'out', error: 'The app is not connected to Supabase (missing config).' }); render(); }
/* live fiat rates replace the demo ones (works without a Finnhub key; falls back silently) */
getJSON(`/api/fx?currencies=${Object.keys(RATES).join(',')}`).then((fx) => {
  Object.assign(RATES, fx.rates); api.fx = { source: fx.source, date: fx.date };
  if (D()) render();
}).catch(() => { /* keep the built-in demo rates */ });
getJSON('/api/status').then((s) => {
  api.finnhub = !!s.finnhub; api.yahoo = !!s.yahoo;
  if ((api.finnhub || api.yahoo) && D()) refreshPrices(true); // pull current prices once per page load
}).catch(() => { /* static hosting: no proxy, built-in catalog only */ });
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
