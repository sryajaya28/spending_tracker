'use strict';
/* Stiver app: demo-data generator (seed). Part of the former prototype/app.js; see docs/MAP.md. */
function seed(name, cur) {
  let s = 11;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  /* a profile per country (sample.js): local banks, e-wallets, merchants, investment platforms and stocks. Unknown currencies use the USD one. */
  const P = SAMPLE[cur] || SAMPLE.USD, IDRP = P.unit === 'IDR';
  // round to a number a person would really pay: whole yen/rupiah, cents only for small amounts
  const nice = (x) => { const a = Math.abs(x); if (expOf(cur) === 0) return Math.round(x / (a >= 1e6 ? 1e4 : a >= 1e5 ? 1e3 : a >= 1e4 ? 100 : a >= 1e3 ? 10 : 1)) * (a >= 1e6 ? 1e4 : a >= 1e5 ? 1e3 : a >= 1e4 ? 100 : a >= 1e3 ? 10 : 1); const st = a >= 1e5 ? 1000 : a >= 1e4 ? 100 : a >= 1e3 ? 10 : a >= 100 ? 1 : a >= 20 ? 0.5 : 0.05; return Math.round(x / st) * st; };
  // a profile amount -> minor units of the reporting currency (rupiah profile: exact rupiah; others: USD-scale numbers x rate x local price level)
  const A = (v) => toMinor(IDRP ? (v > 100000 ? Math.round(v / 1000) * 1000 : v) : nice(v * (RATES[cur] || 1) * P.pl), cur);
  const major = (v) => toMajor(A(v), cur);
  const catId = {};
  const categories = CATS.map(([n, type, ic, color]) => { const id = uid(); catId[n] = id; return { id, parent_id: null, name: n, type, icon: ic, color, archived: false }; });
  CATS.forEach(([n, type, , color]) => subsOf(n, type).forEach(([sn, sic]) => {
    const id = uid(); catId[`${n}/${sn}`] = id;
    categories.push({ id, parent_id: catId[n], name: sn, type, icon: sic, color, archived: false });
  }));
  // merchant -> sub-category ("Name|Sub" in the profile)
  const noteSub = {}; P.plan.forEach(([cat, , , , notes]) => notes.forEach((n) => { const [nm, sub] = n.split('|'); noteSub[nm] = sub ? `${cat}/${sub}` : cat; })); P.subs.forEach(([n, , sub]) => { noteSub[n] = sub; });
  const today = new Date(), todayD = today.getDate(), dim = (y, m) => new Date(y, m + 1, 0).getDate();
  const HIST = 11, wsince = monthKey(new Date(today.getFullYear(), today.getMonth() - HIST, 1));   // sample history: the last 12 periods
  // accounts with the balance each should show today (opening balances are derived below)
  const W = (n, type, target, c = cur) => ({ id: uid(), name: n, type, currency: c, opening_balance_minor: 0, since: wsince, archived: false, _target: target });
  const wallets = P.names.map((n, i) => W(n, ['bank', 'bank', 'bank', 'cash', 'ewallet', 'ewallet', 'ewallet'][i], A(P.bal[i])));
  const [b1, b2, , cashW, e1, e2, e3] = wallets;
  const txns = [];
  const nowMonth = (back) => ({ y: today.getFullYear(), m: today.getMonth() - back });
  const add = (w, cat, type, date, v, note, extra = {}) => {
    txns.push({ id: uid(), wallet_id: w.id, category_id: cat ? catId[noteSub[note]] || catId[cat] : null, type, amount_minor: A(v), currency: w.currency, occurred_at: isoDate(date), note, category_source: 'user', ai_confidence: null, ...extra });
  };
  const usdOf = (v) => (IDRP ? v / 15500 : v);
  // everyday spending: small things on e-wallets, bigger ones on the banks
  const spendWallet = (cat, v) => (usdOf(v) < 7.7 && (cat === 'Dining' || cat === 'Transport' || cat === 'Groceries') ? [e1, e3, e2][Math.floor(rnd() * 3)] : usdOf(v) < 25.8 && rnd() < 0.15 ? cashW : rnd() < 0.78 ? b1 : b2);
  const V = (idr, usd) => (IDRP ? idr : usd);   // a rupiah amount for the IDR profile, a USD-scale one for the others
  const transfer = (from, to, v, date, note, fee) => {
    const gid = uid(), base = { category_id: null, category_source: 'user', ai_confidence: null, occurred_at: isoDate(date), transfer_id: gid, type: 'transfer', currency: cur };
    txns.push({ id: uid(), wallet_id: from.id, flow: 'out', amount_minor: A(v), note: `Transfer to ${to.name}${note ? ' · ' + note : ''}`, ...base });
    txns.push({ id: uid(), wallet_id: to.id, flow: 'in', amount_minor: A(v), note: `Transfer from ${from.name}${note ? ' · ' + note : ''}`, ...base });
    if (fee) txns.push({ id: uid(), wallet_id: from.id, category_id: catId.Fee, type: 'expense', amount_minor: A(fee), currency: cur, occurred_at: isoDate(date), note: `Transfer fee (${from.name} → ${to.name})`, category_source: 'user', ai_confidence: null, transfer_id: gid });
  };
  for (let back = HIST; back >= 0; back--) {
    const { y, m } = nowMonth(back), cur0 = back === 0, last = dim(y, m);
    const maxDay = cur0 ? Math.max(1, Math.min(todayD, last)) : Math.min(27, last);   // the running month only fills up to today
    const factor = cur0 ? Math.max(0.35, todayD / last) : 1;
    // fixed items (also dated later this month: they show as Upcoming)
    add(b1, 'Salary', 'income', new Date(y, m, 25), P.salary, 'Monthly salary');
    if (back % 2 === 0) add(b1, 'Freelance', 'income', new Date(y, m, 12), P.freelance[0] + Math.round(rnd() * P.freelance[1]), 'Design project');
    add(b1, 'Subscription', 'expense', new Date(y, m, 12), P.subs[0][1], P.subs[0][0]);
    add(b1, 'Subscription', 'expense', new Date(y, m, 5), P.subs[1][1], P.subs[1][0]);
    add(b2, 'Bills & Utilities', 'expense', new Date(y, m, 3), P.bill[1], P.bill[0]);
    if (back > 0 || todayD >= 2) { transfer(b1, e1, P.topup[0], new Date(y, m, 2), 'top up'); transfer(b1, e3, P.topup[1], new Date(y, m, 2), 'top up', P.fee[1]); transfer(b1, e2, P.topup[2], new Date(y, m, 3), 'top up'); }
    // a bank-to-bank transfer with a fee, every other month (only once its day has passed)
    if (back % 2 === 1 || (cur0 && todayD >= 20)) { const d = new Date(y, m, 20); if (d <= today) transfer(b1, b2, V(5000000, 320), d, 'savings', P.fee[0]); }
    // random everyday spending
    for (const [cat, n, lo, hi, notes] of P.plan) {
      const count = cur0 ? Math.max(1, Math.round(n * factor * 1.6)) : n;
      for (let i = 0; i < count; i++) {
        const day = 1 + Math.floor(rnd() * maxDay), v = IDRP ? Math.round((lo + rnd() * (hi - lo)) / 1000) * 1000 : lo + rnd() * (hi - lo);
        add(spendWallet(cat, v), cat, 'expense', new Date(y, m, day), v, notes[Math.floor(rnd() * notes.length)].split('|')[0]);
      }
    }
  }
  const fut = (t) => t.occurred_at > isoDate(today);
  // a few purchases are paid with the credit card (a loan account): the card's balance goes up by what was charged
  const cardId = uid(), cardCharges = [], cardCats = new Set([catId.Shopping, catId.Entertainment, catId['Entertainment/Movies'], catId['Entertainment/Events']]);
  txns.filter((t) => t.type === 'expense' && !fut(t) && cardCats.has(t.category_id)).slice(0, 6).forEach((t) => { t.wallet_id = null; t.loan_id = cardId; cardCharges.push({ id: uid(), date: t.occurred_at, amount_minor: t.amount_minor, kind: 'charge', txn_id: t.id }); });
  const start = monthKey(new Date(today.getFullYear(), today.getMonth() - HIST, 1)) + '-01';
  const mk = (cat, v) => ({ id: uid(), category_id: cat ? catId[cat] : null, amount_minor: A(v), currency: cur, start_month: start });
  const B = P.budget, budgets = [mk(null, B.total), mk('Groceries', B.Groceries), mk('Dining', B.Dining), mk('Transport', B.Transport), mk('Shopping', B.Shopping), mk('Entertainment', B.Entertainment), mk('Bills & Utilities', B['Bills & Utilities'])];
  // special occasions, one of each kind: upcoming with a budget, ongoing, ended (one period), ended across two periods, archived without a budget, and one with no budget or dates
  const D0 = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n), M0 = (mb, day) => new Date(today.getFullYear(), today.getMonth() - mb, day);
  const occ = (name, budget, start, end, archived = false) => ({ id: uid(), name, amount_minor: budget ? A(budget) : null, currency: cur, start: start ? isoDate(start) : '', end: end ? isoDate(end) : '', archived });
  const oBali = occ(P.trip[0], P.trip[1], new Date(today.getFullYear(), today.getMonth() + 1, 18), new Date(today.getFullYear(), today.getMonth() + 1, 22));
  const O = P.occ, oStay = occ(O.stay[0], V(3000000, 200), D0(-1), D0(1)), oWeekend = occ(O.weekend[0], V(4000000, 260), M0(2, 12), M0(2, 14));
  const oReunion = occ(O.long[0], V(12000000, 800), M0(4, 10), M0(3, 20)), oAnniv = occ(O.anniv[0], 0, M0(7, 14), M0(7, 14), true), oBirthday = occ(O.birthday, 0, null, null);
  const occasions = [oBali, oStay, oWeekend, oReunion, oAnniv, oBirthday];
  const tag = (o, w, cat, date, v, note) => add(w, cat, 'expense', date, v, note, { occasion_id: o.id });
  tag(oStay, b1, 'Travel', D0(-1), V(1200000, 90), O.stay[1]); tag(oStay, e1, 'Dining', D0(-1), V(180000, 14), O.stay[2]);
  tag(oWeekend, b1, 'Travel', M0(2, 12), V(1500000, 100), O.weekend[1]); tag(oWeekend, b2, 'Transport', M0(2, 12), V(600000, 40), O.weekend[2]); tag(oWeekend, e2, 'Dining', M0(2, 13), V(450000, 30), O.weekend[3]); tag(oWeekend, e2, 'Dining', M0(2, 14), V(380000, 25), O.weekend[4]); tag(oWeekend, b2, 'Shopping', M0(2, 14), V(500000, 35), O.weekend[5]);
  // 40 days: it crosses a period boundary whatever the period start day is, so its expenses sit in two periods
  tag(oReunion, b1, 'Travel', M0(4, 10), V(4000000, 270), O.long[1]); tag(oReunion, b2, 'Travel', M0(4, 10), V(2500000, 170), O.long[2]); tag(oReunion, e3, 'Dining', M0(4, 25), V(900000, 60), O.long[3]); tag(oReunion, b2, 'Shopping', M0(3, 12), V(1100000, 75), O.long[4]); tag(oReunion, b1, 'Dining', M0(3, 20), V(650000, 45), O.long[5]);
  tag(oAnniv, b1, 'Dining', M0(7, 14), V(850000, 60), O.anniv[1]);
  // investment accounts: a local platform with local stocks and a global one, each with a cash balance. Prices are fixed demo prices in USD.
  const since = wsince;
  const invA = { id: uid(), name: P.invest.a, archived: false }, invB = { id: uid(), name: P.invest.b, archived: false };
  const h = (a, symbol, quantity, open) => ({ id: uid(), account_id: a.id, symbol, quantity, since, trades: [], ...(open ? { open_price: open[0], ccy: open[1] } : {}) });
  const customAssets = { ['CASH:' + cur]: { symbol: cur, name: `Cash (${cur})`, type: 'cash', cash: cur }, XAUG: { symbol: 'XAUG', name: 'Gold (per gram)', type: 'commodity', yh: 'GC=F', mult: 0.0321507, price: 100 } };
  const round2 = (x) => +x.toFixed(expOf(cur) === 0 ? 0 : 2), stockQty = (x) => { const st = x >= 5000 ? 100 : x >= 500 ? 10 : 1; return Math.max(st, Math.round(x / st) * st); };
  // stocks resolved to [key, name, Yahoo symbol, mult, USD price, quantity, cost price in the reporting currency]
  const resolve = (list) => list.map((r) => (IDRP ? r : [r[0], r[1], r[2], r[6] || 1, r[3], stockQty(r[4] / r[3]), round2(r[3] * (RATES[cur] || 1) * r[5])]));
  const localA = resolve(P.stocks), localB = resolve(P.bStocks || []);
  [...localA, ...localB].forEach(([key, nm, yh, mult, usd]) => { customAssets[key] = { symbol: key.split('.')[0], name: nm, type: 'stock', yh, mult, price: usd }; });
  const cost = (sym) => (IDRP ? (sym === 'XAUG' ? [P.goldCost, 'IDR'] : P.globalCost[sym] ? [P.globalCost[sym], 'USD'] : undefined) : P.cost[sym] ? [P.cost[sym], 'USD'] : undefined);
  const holdings = [h(invA, 'CASH:' + cur, major(P.invest.cashA ?? P.cashA)), ...localA.map(([key, , , , , q, c]) => h(invA, key, q, [c, cur])), ...(P.catalogA || []).map(([sym, q]) => h(invA, sym, q, cost(sym))),
    h(invB, 'CASH:' + cur, major(P.invest.cashB ?? P.cashB)), ...localB.map(([key, , , , , q, c]) => h(invB, key, q, [c, cur])), ...P.global.map(([sym, q]) => h(invB, sym, q, cost(sym)))];
  // buying and selling: a buy and a sell on stocks held in the local account, paid from / into a bank account, each with a broker fee (its own expense in Fee).
  // The holding keeps its quantity; the earlier balance is derived from the trades.
  const heldStocks = holdings.filter((x) => x.account_id === invA.id && x.open_price != null && !x.symbol.startsWith('CASH:')).slice(0, 2);
  [[heldStocks[0], 'buy', 0.2, 3, 8, b1, P.fee[2]], [heldStocks[1], 'sell', 0.1, 1, 14, b1, P.fee[3]]].forEach(([hh, side, frac, mb, day, w, fee]) => {
    if (!hh) return;
    // the price is in the holding's cost currency, the money in the account's
    const date = M0(mb, day), qty = Math.max(1, Math.round(hh.quantity * frac)), price = +(hh.open_price * (side === 'buy' ? 0.96 : 1.12)).toFixed(hh.ccy === cur && expOf(cur) === 0 ? 0 : 2), amount = toMinor(price * qty * (RATES[cur] / RATES[hh.ccy || cur]), cur), tid = uid(), sym = hh.symbol.split('.')[0], word = side === 'buy' ? 'Bought' : 'Sold';
    hh.trades.push({ id: tid, date: isoDate(date), side, quantity: qty, amount_minor: amount, currency: cur, wallet_id: w.id, price });
    // a sale: the cost of what was sold comes back as the investment transfer, the profit on top is its own income record (Capital gains) on the same account
    const costMinor = side === 'sell' ? toMinor(hh.open_price * qty * (RATES[cur] / RATES[hh.ccy || cur]), cur) : amount, profit = side === 'sell' && amount > costMinor && costMinor > 0 ? amount - costMinor : 0;
    txns.push({ id: uid(), trade_id: tid, wallet_id: w.id, category_id: null, type: 'transfer', flow: side === 'buy' ? 'out' : 'in', amount_minor: profit ? costMinor : amount, currency: cur, occurred_at: isoDate(date), note: `${word} ${qty} ${sym}`, category_source: 'user', ai_confidence: null });
    if (profit) txns.push({ id: detId('pnl', tid), wallet_id: w.id, category_id: catId['Investment Profit/Capital Gain'], type: 'income', amount_minor: profit, currency: cur, occurred_at: isoDate(date), note: `${sym} profit`, category_source: 'user', ai_confidence: null });
    txns.push({ id: uid(), wallet_id: w.id, category_id: catId.Fee, type: 'expense', amount_minor: A(fee), currency: cur, occurred_at: isoDate(date), note: `Investment fee (${word} ${qty} ${sym})`, category_source: 'user', ai_confidence: null });
  });
  // loans: debts you owe. Balance = original - payments, so earlier months can be rebuilt.
  const payments = (monthly, n) => Array.from({ length: n }, (_, i) => ({ id: uid(), date: isoDate(new Date(today.getFullYear(), today.getMonth() - (n - 1 - i), 5)), amount_minor: monthly }));
  const L = P.loans, loans = [
    { id: uid(), name: 'Housing loan', type: 'mortgage', currency: cur, original_minor: A(L.home[0]), monthly_minor: A(L.home[1]), rate: L.home[2], since, archived: false, payments: payments(A(L.home[1]), 6) },
    { id: uid(), name: 'Car loan', type: 'car', currency: cur, original_minor: A(L.car[0]), monthly_minor: A(L.car[1]), rate: L.car[2], since, archived: false, payments: payments(A(L.car[1]), 6) },
    { id: cardId, name: 'Credit card', type: 'card', currency: cur, original_minor: A(L.card[0]), monthly_minor: A(L.card[1]), rate: 0, since, archived: false, payments: [...payments(A(L.card[1]), 3), ...cardCharges] },
  ];
  // the last payments of the car loan were made from a bank account: each is an expense there (category Debt Payment) linked to the loan's payment
  loans[1].payments.slice(-3).forEach((p) => {
    if (p.date > isoDate(today)) return;
    const t = { id: uid(), type: 'expense', amount_minor: p.amount_minor, currency: cur, occurred_at: p.date, wallet_id: b1.id, note: loans[1].name, category_id: catId['Debt Payment'], category_source: 'user', ai_confidence: null };
    txns.push(t); p.txn_id = t.id;
  });
  const lent = [{ id: uid(), name: P.lent[0], currency: cur, original_minor: A(P.lent[1]), note: P.lent[3], due: isoDate(new Date(today.getFullYear(), today.getMonth() + 3, 1)), since: monthKey(new Date(today.getFullYear(), today.getMonth() - 3, 1)), archived: false, payments: [{ id: uid(), date: isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 10)), amount_minor: A(P.lent[2]) }] }];
  // the money lent went out of the first bank account: a single transfer out there (category Lent), linked to the record by txn_id
  { const d0 = `${lent[0].since}-01`, t = { id: uid(), type: 'transfer', flow: 'out', amount_minor: lent[0].original_minor, currency: cur, occurred_at: d0, wallet_id: b1.id, note: lent[0].name, category_id: catId['Lent'], category_source: 'user', ai_confidence: null };
    if (t.category_id) { txns.push(t); lent[0].txn_id = t.id; } }
  // a second repayment arrived in the first bank account: a single transfer-in there (category Lent Repayment), linked to the repayment
  { const half = Math.round(A(P.lent[2]) / 2), d2 = isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 24)), t = { id: uid(), type: 'transfer', flow: 'in', amount_minor: half, currency: cur, occurred_at: d2, wallet_id: b1.id, note: `${lent[0].name} Repayment`, category_id: catId['Lent Repayment'], category_source: 'user', ai_confidence: null };
    txns.push(t); lent[0].payments.push({ id: uid(), date: d2, amount_minor: half, txn_id: t.id }); }
  // recurring rules (shown in Settings > Recurring; sample mode never creates entries from them)
  const next = (day) => { const d = new Date(today.getFullYear(), today.getMonth(), day); if (isoDate(d) <= isoDate(today)) d.setMonth(d.getMonth() + 1); return isoDate(d); };
  const rule = (kind, freq, day, spec) => ({ id: uid(), kind, freq, start: isoDate(new Date(today.getFullYear(), today.getMonth() - 5, day)), next: next(day), end: '', active: true, spec });
  const first = localA[0] || [(P.catalogA || [['VOO', 1]])[0][0], '', '', 1, 520, 2], rqty = localA[0] ? 100 : 2, rprice = first[4] * (RATES[cur] || 1) * (IDRP ? 1 : P.pl);
  const recurring = [
    rule('txn', 'monthly', 25, { type: 'income', amount_minor: A(P.salary), currency: cur, wallet_id: b1.id, note: 'Monthly salary', category_id: catId.Salary }),
    rule('txn', 'monthly', 12, { type: 'expense', amount_minor: A(P.subs[0][1]), currency: cur, wallet_id: b1.id, note: P.subs[0][0], category_id: catId['Entertainment/Streaming'] }),
    rule('txn', 'monthly', 5, { type: 'expense', amount_minor: A(P.subs[1][1]), currency: cur, wallet_id: b1.id, note: P.subs[1][0], category_id: catId.Subscription }),
    rule('transfer', 'monthly', 2, { from: b1.id, to: e1.id, amount_minor: A(P.topup[0]), received_minor: A(P.topup[0]), fee_minor: 0, note: 'top up' }),
    rule('txn', 'monthly', 5, { type: 'expense', debt: loans[1].id, wallet_id: b1.id, amount_minor: A(L.car[1]), currency: cur, note: loans[1].name, category_id: catId['Debt Payment'] }),
    rule('invest', 'monthly', 10, { account: invA.id, symbol: first[0], quantity: rqty, fund: 'w:' + b1.id, fundamount: String(Math.round(rqty * rprice)) }),
  ];
  // balances: derive each opening balance so today's balance is the target (future-dated rows do not count)
  wallets.forEach((w) => { const net = txns.filter((t) => t.wallet_id === w.id && !fut(t)).reduce((a, t) => a + (t.type === 'income' || (t.type === 'transfer' && t.flow === 'in') ? 1 : -1) * t.amount_minor, 0); w.opening_balance_minor = w._target - net; delete w._target; });
  txns.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  // show the AI state on a few rows (every sample transaction is categorized)
  const past = txns.filter((t) => t.type === 'expense' && !fut(t));
  past.slice(2, 12).forEach((t, i) => { if (i % 3 === 0) { t.category_source = 'ai'; t.ai_confidence = 0.86; } });
  return { profile: { name, currency: cur, ai: true }, categories, wallets, transactions: txns, budgets, occasions, investments: [invA, invB], holdings, customAssets, livePrices: {}, loans, lent, recurring };
}
