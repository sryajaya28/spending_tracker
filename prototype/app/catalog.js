'use strict';
/* Stiver app: price catalog, live price and asset search calls. Part of the former prototype/app.js; see docs/MAP.md. */
/* mock price catalog: [symbol, name, type, current USD price, monthly volatility].
   The real app reads these from price_snapshots (filled by a daily job from Finnhub / CoinGecko). */
const CATALOG = [
  ['BTC', 'Bitcoin', 'crypto', 67000, 0.12], ['ETH', 'Ethereum', 'crypto', 3400, 0.13], ['SOL', 'Solana', 'crypto', 160, 0.18],
  ['USDT', 'Tether', 'stablecoin', 1, 0.0006], ['USDC', 'USD Coin', 'stablecoin', 1, 0.0006],
  ['AAPL', 'Apple', 'stock', 225, 0.05], ['MSFT', 'Microsoft', 'stock', 420, 0.045], ['NVDA', 'NVIDIA', 'stock', 130, 0.1], ['TSLA', 'Tesla', 'stock', 250, 0.12],
  ['VOO', 'Vanguard S&P 500 ETF', 'etf', 520, 0.03], ['VTI', 'Vanguard Total Market ETF', 'etf', 280, 0.03], ['QQQ', 'Invesco QQQ ETF', 'etf', 480, 0.04], ['SPY', 'SPDR S&P 500 ETF', 'etf', 570, 0.03],
];
const TYPE_COLOR = { crypto: '#F5B800', stablecoin: '#14B8A6', stock: '#4A44C6', etf: '#8B8FF0', commodity: '#D97706', cash: '#64748B', manual: '#94A3B8' };
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
  if (m.cash) return { key, symbol: m.cash, name: m.name || `Cash (${m.cash})`, type: 'cash', cash: m.cash, usd: () => 1 / (RATES[m.cash] || 1) };   // fiat balance inside an investment account: worth its face value
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
  if (type === 'cash') { const ql = q.trim().toUpperCase(); return Object.keys(RATES).filter((c) => !ql || c.includes(ql) || 'CASH'.includes(ql)).map((c) => ({ key: 'CASH:' + c, symbol: c, name: `Cash (${c})`, type: 'cash', cash: c })); }
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
    if (info.cash) continue;
    if (info.yh ? !api.yahoo : !api.finnhub) continue;   // that price source is not available
    try { D().livePrices[key] = await quote(info); ok++; } catch { /* keep the previous price */ }
  }
  save(); if (route() === 'portfolio') render();
  if (!silent) toast(__('Updated {ok} of {n} prices', { ok, n: keys.length }));
}

