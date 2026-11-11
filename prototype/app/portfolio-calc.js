'use strict';
/* Stiver app: investments: holdings, cost basis, profit and loss. Part of the former prototype/app.js; see docs/MAP.md. */
/* ---------- portfolio (investments), valued in USD then shown in a chosen currency ---------- */
const activeAccounts = () => D().investments.filter((a) => !a.archived);
const holdingsOf = (accId) => D().holdings.filter((h) => h.account_id === accId);
/* buys/sells: each trade moves quantity and cash together. Quantity at a month end is today's
   quantity minus the trades that happen after that month. */
const tradeSign = (tr) => (tr.side === 'buy' ? 1 : -1);
const r12 = (x) => Math.round(x * 1e12) / 1e12;   // keep quantities free of floating-point dust
const qtyAt = (h, k) => h.quantity - h.trades.filter((tr) => tr.date > [periodEnd(k), todayIso()].sort()[0]).reduce((a, tr) => a + tradeSign(tr) * tr.quantity, 0);
const heldNow = (h) => qtyAt(h, currentPeriod());   // what you hold today (trades dated later are not in yet)
/* ---- cost basis: weighted average cost ----
   Every holding has a cost currency h.ccy. The quantity you held before any recorded trade is the "opening" quantity
   (q0 = quantity - signed trades) priced at h.open_price (average price per unit, in h.ccy). A buy adds qty*price to the cost;
   a sell realizes qty*(price - average) and removes qty*average from the cost, so the average only moves on buys.
   A trade's price is what was typed (tr.price) or what it cost (wallet amount, or the coins it was swapped for).
   Cash and stablecoins have no cost basis. If the opening quantity has no price, the cost is unknown (shown as "—"). */
const trackCost = (h) => { const t = assetInfo(h.symbol).type; return t !== 'cash' && t !== 'stablecoin'; };
function tradePrice(h, tr, ccy) {
  if (tr.price != null) return tr.price;
  if (!(tr.quantity > 0)) return null;
  if (tr.wallet_id || (tr.amount_minor != null && tr.currency)) return (toMajor(tr.amount_minor, tr.currency) / RATES[tr.currency]) * RATES[ccy] / tr.quantity;
  if (tr.via) return (tr.via.quantity * assetInfo(tr.via.symbol).usd(currentPeriod())) * RATES[ccy] / tr.quantity;
  return null;
}
function holdingCost(h) {
  const ccy = h.ccy || cur(), today = todayIso();
  const all = [...h.trades].sort((a, b) => a.date.localeCompare(b.date));
  const q0 = Math.max(0, r12(h.quantity - all.reduce((a, t) => a + tradeSign(t) * t.quantity, 0)));
  const out = { ccy, known: true, q0, qty: 0, avg: 0, cost: 0, realized: 0, per: {} };
  let qty = q0, cost = 0;
  if (q0 > 1e-12) { if (h.open_price != null) cost = q0 * h.open_price; else out.known = false; }
  for (const tr of all) {
    if (tr.date > today || tr.kind) continue;   // trades dated later are not in yet
    const price = tradePrice(h, tr, ccy);
    if (price == null) { out.known = false; continue; }
    let r = 0;
    if (tr.side === 'buy') { cost += tr.quantity * price; qty += tr.quantity; }
    else { const avg = qty > 1e-12 ? cost / qty : 0, sq = Math.min(tr.quantity, qty); r = sq * (price - avg); out.realized += r; cost -= sq * avg; qty -= sq; }
    if (qty < 1e-12) { qty = 0; cost = 0; }
    out.per[tr.id] = { price, avg: qty > 0 ? cost / qty : 0, realized: r };
  }
  out.qty = qty; out.cost = cost; out.avg = qty > 0 ? cost / qty : 0;
  return out;
}
/* what the holding is worth against its cost, in its own cost currency; null when there is nothing to compare */
function pnlOf(h) {
  if (!trackCost(h)) return null;
  const c = holdingCost(h); if (!c.known) return null;
  const k = lastMonths(6)[5], price = assetInfo(h.symbol).usd(k) * RATES[c.ccy], value = c.qty * price, pnl = value - c.cost;
  return { ...c, price, value, pnl, pct: c.cost > 0 ? (pnl / c.cost) * 100 : null };
}
const usdOfCcy = (x, ccy) => x / RATES[ccy];
const signed = (n, text) => (n > 0 ? '+' : n < 0 ? '−' : '') + text;
const pctText = (p) => `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`;
/* a per-unit price in its own currency (cents and small decimals kept) */
const priceFmt = (x, ccy) => rpSpace(new Intl.NumberFormat(nativeLocale(ccy), { style: 'currency', currency: ccy, minimumFractionDigits: 0, maximumFractionDigits: Math.abs(x) >= 1000 || expOf(ccy) === 0 ? 0 : Math.abs(x) >= 1 ? 2 : 6 }).format(x));
const holdingUSD = (h, k) => (!liveIn(h.since, k) ? 0 : Math.max(0, qtyAt(h, k)) * assetInfo(h.symbol).usd(k));
const portfolioUSD = (k, accId) => D().holdings
  .filter((h) => (accId ? h.account_id === accId : activeAccounts().some((a) => a.id === h.account_id)))
  .reduce((a, h) => a + holdingUSD(h, k), 0);
const isFiatQty = (x) => x === true || (!!x && typeof x !== 'boolean' && assetInfo(typeof x === 'string' ? x : x.symbol)?.type === 'cash');
const fiatOf = (of) => (of && of !== true ? assetInfo(typeof of === 'string' ? of : of.symbol)?.cash : '') || '';
const qtyFmt = (q, of = false) => new Intl.NumberFormat(fiatOf(of) ? nativeLocale(fiatOf(of)) : locale(), { maximumFractionDigits: isFiatQty(of) ? 2 : 8 }).format(q);   // fiat cash uses its currency's own separators (IDR 46.600.561), like money()   // of: true, a holding or a symbol; cash in a fiat currency shows at most 2 decimals   // cash in a fiat currency: at most 2 decimals (also hides float noise like 560.99999999)
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

