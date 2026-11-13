'use strict';
/* Stiver app: the trades section: buying and selling investments, trade records and the pop-ups for them. Part of the former prototype/app.js; see docs/MAP.md. Top-level names: stableHoldings, accountName, sourceOptions, parseSource, sourceUnit, parseAmount, addOpening, payShortfall, srcCcy, needsFx, freshFx, feeCategory, addFeeRecord, ensureFeeCategory, pnlCategory, addSaleRecord, addSaleFee, convertCashTrades, backfillSaleRecords, recordTrade, removeTrade, tradeList, costDialog, cashDialog, syncCashForm, tradeDialog, syncTradeForm, syncTradePrice, tradeHint. */
/* ---------- trades ----------
   A buy or sell has two sides. The other side is either a wallet (money leaves/enters it as a
   'transfer', never income or spending) or a stablecoin you hold (USDT/USDC): the coin's quantity
   moves the opposite way as a paired trade, so everything stays in circulation. */
const stableHoldings = (excludeId) => D().holdings.filter((x) => x.id !== excludeId && activeAccounts().some((a) => a.id === x.account_id) && assetInfo(x.symbol).type === 'stablecoin');
const accountName = (id) => D().investments.find((a) => a.id === id)?.name || '';

/* option list for "pay from / receive into": wallets, held stablecoins, and (when selling) a new USDT/USDC position */
function sourceOptions(side, h, selected) {
  const selling = side === 'sell' && !!h && assetInfo(h.symbol).type !== 'cash', ws = selling ? [] : D().wallets.filter((w) => !w.archived), st = stableHoldings(h?.id).filter((x) => !selling || (h && x.account_id === h.account_id));   // a sale is received in the investment account itself: its cash or stablecoins, never a bank account
  const held = new Set(st.filter((x) => x.account_id === h?.account_id).map((x) => x.symbol));
  const fresh = h && side === 'sell' ? ['USDT', 'USDC'].filter((s) => !held.has(s) && s !== h.symbol) : [];
  const cashes = D().holdings.filter((x) => x.id !== h?.id && assetInfo(x.symbol).type === 'cash' && activeAccounts().some((a) => a.id === x.account_id) && (!h || x.account_id === h.account_id));
  const sel = (v) => (v === selected ? 'selected' : '');
  return (selling && !st.length && !cashes.length && !['USDT', 'USDC'].some((c) => fresh.includes(c)) ? `<option value="">${__('Add a Cash balance to this account first')}</option>` : '')
    + (ws.length ? `<optgroup label="Accounts">${ws.map((w) => `<option value="w:${w.id}" ${sel('w:' + w.id)}>${esc(w.name)} (${esc(w.currency)}) · ${money(walletBalance(w), w.currency)}</option>`).join('')}</optgroup>` : '')
    + (cashes.length ? `<optgroup label="${__('Cash balance')}">${cashes.map((x) => `<option value="h:${x.id}" ${sel('h:' + x.id)}>${esc(accountName(x.account_id))} (${esc(assetInfo(x.symbol).symbol)}) · ${qtyFmt(heldNow(x), x)}</option>`).join('')}</optgroup>` : '')
    + (st.length || fresh.length ? `<optgroup label="Stablecoins">${st.map((x) => `<option value="h:${x.id}" ${sel('h:' + x.id)}>${esc(accountName(x.account_id))} (${esc(assetInfo(x.symbol).symbol)}) · ${qtyFmt(heldNow(x))}</option>`).join('')}${fresh.map((s) => `<option value="n:${s}" ${sel('n:' + s)}>${esc(accountName(h.account_id))} (${s}) · 0</option>`).join('')}</optgroup>` : '');
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

/* quantity you already owned, with the average price you paid for it: blended into the starting price (weighted average) */
function addOpening(h, qty, price, ccy) {
  const had = holdingCost(h), q0 = had.q0;
  h.quantity = r12(h.quantity + qty);
  if (!trackCost(h)) return;
  if (!h.ccy) h.ccy = ccy || cur();
  const p = price > 0 ? (price * RATES[h.ccy]) / RATES[ccy || h.ccy] : null;
  if (p != null && (q0 <= 1e-12 || h.open_price != null)) h.open_price = q0 > 1e-12 ? (q0 * h.open_price + qty * p) / (q0 + qty) : p;
  else if (q0 > 1e-12) delete h.open_price;   // an unpriced addition makes the starting price unknown
}

/* move a holding to another investment account. An account holds each asset once (unique account + symbol), so when the target
   already holds it the two are merged into the target's: quantities, events and opening cost (blended into one starting price)
   add up, and anything that pointed at the moved holding (swap pairs, recurring rules) is re-pointed. Returns the holding that results. */
function moveHolding(h, accId) {
  if (!h || !accId || h.account_id === accId) return h;
  const dest = D().holdings.find((x) => x.id !== h.id && x.account_id === accId && x.symbol === h.symbol);
  if (!dest) { h.account_id = accId; return h; }
  const qa = holdingCost(dest).q0, qb = holdingCost(h).q0;
  if (trackCost(h) && qb > 1e-12) {
    if (!dest.ccy) dest.ccy = h.ccy || cur();
    const pb = h.open_price != null ? (h.open_price * RATES[dest.ccy]) / RATES[h.ccy || dest.ccy] : null;
    if (pb == null || (qa > 1e-12 && dest.open_price == null)) delete dest.open_price;   // an unpriced part makes the starting price unknown
    else dest.open_price = qa > 1e-12 ? (qa * dest.open_price + qb * pb) / (qa + qb) : pb;
  }
  dest.quantity = r12(dest.quantity + h.quantity);
  dest.trades.push(...h.trades);
  if (h.since < dest.since) dest.since = h.since;
  D().holdings = D().holdings.filter((x) => x.id !== h.id);
  D().holdings.forEach((x) => x.trades.forEach((tr) => { if (tr.via && tr.via.holding_id === h.id) tr.via.holding_id = dest.id; }));
  (D().recurring || []).forEach((r) => { if (r.spec) for (const k of Object.keys(r.spec)) if (r.spec[k] === 'h:' + h.id) r.spec[k] = 'h:' + dest.id; });
  return dest;
}

/* returns a message when the paying side can't cover a buy; null when it is fine */
function payShortfall(src, side, amount) {
  if (side !== 'buy') return null;
  if (src.kind === 'wallet' && amount > walletBalance(src.wallet)) return __("{name} doesn't have enough balance", { name: src.wallet.name });
  if (src.kind === 'holding' && amount > heldNow(src.holding) + 1e-12) return __('You only hold {qty} {symbol}', { qty: qtyFmt(heldNow(src.holding), src.holding), symbol: assetInfo(src.holding.symbol).symbol });
  if (src.kind === 'new') return __("You don't hold any {symbol} to pay with", { symbol: src.symbol });
  return null;
}

/* the currency a payment source works in: an account's own currency, a cash balance's currency, or USD for USDT/USDC */
const srcCcy = (src) => (!src ? cur() : src.kind === 'wallet' ? src.wallet.currency : src.kind === 'holding' ? (assetInfo(src.holding.symbol).type === 'cash' ? assetInfo(src.holding.symbol).cash : 'USD') : 'USD');
/* the latest fiat rates from the rate service, fetched when a trade is saved so its price is converted at today's rate, never at a stored one */
function needsFx(kind, f, v) {
  if (kind !== 'trade' && kind !== 'holding') return false;
  const h = kind === 'trade' ? D().holdings.find((x) => x.id === f.dataset.id) : D().holdings.find((x) => x.account_id === v.account && x.symbol === v.asset);
  if (!h || !h.ccy) return false;
  const src = parseSource(kind === 'trade' ? v.source : v.fund);
  return (src && srcCcy(src) !== h.ccy) || (kind === 'holding' && !src && v.pccy && v.pccy !== h.ccy);
}
async function freshFx() {
  try {
    const fx = await Promise.race([getJSON(`/api/fx?currencies=${Object.keys(RATES).join(',')}`), new Promise((_, no) => setTimeout(no, 4000))]);
    if (fx && fx.rates) { Object.assign(RATES, fx.rates); api.fx = { source: fx.source, date: fx.date }; }
  } catch { /* offline: the rates already loaded are used */ }
}
/* the default "Fee" category (expense, 💸): every fee is recorded under it. It is created when missing (existing accounts get it on load);
   one the user archived or renamed in place is reused as long as it is still called Fee. */
function feeCategory() {
  const d = D(); let c = d.categories.find((x) => !x.parent_id && x.type === 'expense' && x.name.trim().toLowerCase() === 'fee');
  if (!c) { c = { id: defaultCatId('Fee'), parent_id: null, name: 'Fee', type: 'expense', icon: '💸', color: '#94A3B8', archived: false }; d.categories.push(c); }
  return c;
}
/* a fee is its own expense on the account it was paid from */
function addFeeRecord(wallet, minor, date, note) {
  if (!(minor > 0)) return;
  D().transactions.push({ id: uid(), wallet_id: wallet.id, category_id: feeCategory().id, type: 'expense', amount_minor: minor, currency: wallet.currency, occurred_at: date, note, category_source: 'user', ai_confidence: null });
}
/* on load: make sure the Fee category exists and give earlier transfer fees (they had no category) that category; true when something changed */
function ensureFeeCategory() {
  const n = D().categories.length, c = feeCategory(); let changed = D().categories.length !== n;
  D().transactions.forEach((t) => { if (t.type === 'expense' && t.transfer_id && !t.category_id) { t.category_id = c.id; changed = true; } });
  return changed;
}
/* selling an asset at a profit or loss: the profit is income in Investment Profit > Capital Gain, the loss an expense in Investment Loss (a category of its own),
   both on the receiving account. Created on demand with fixed ids (same rows on every device). */
function pnlCategory(profit) {
  const d = D(), name = profit ? 'Investment Profit' : 'Investment Loss', type = profit ? 'income' : 'expense', [, , icon, color] = CATS.find((x) => x[0] === name);
  let par = d.categories.find((c) => !c.parent_id && c.type === type && c.name.trim().toLowerCase() === name.toLowerCase());
  if (!par) { par = { id: defaultCatId(name, ''), parent_id: null, name, type, icon, color, archived: false }; d.categories.push(par); }
  if (!profit) return par;
  let sc = d.categories.find((c) => c.parent_id === par.id && c.name.trim().toLowerCase() === 'capital gain');
  if (!sc) { sc = { id: defaultCatId(name, 'Capital Gain'), parent_id: par.id, name: 'Capital Gain', type, icon: '📈', color, archived: false }; d.categories.push(sc); }
  return sc;
}
/* a sale paid into the account's own cash or coin has no bank account, but its profit or loss still is Capital Gain income or an Investment Loss expense:
   a record with no wallet, tied to the sale (same id as the wallet kind: removed together with the sale) */
function addSaleRecord(h, tradeId) {
  const tr = h.trades.find((x) => x.id === tradeId);
  if (!tr || tr.side !== 'sell' || !tr.via || !trackCost(h) || D().transactions.some((t) => t.id === detId('pnl', tradeId))) return false;
  const hc = holdingCost(h), pi = hc.per[tradeId]; if (!hc.known || !pi || !Number.isFinite(pi.realized)) return false;
  const pnl = toMinor(pi.realized, hc.ccy); if (!pnl) return false;
  D().transactions.push({ id: detId('pnl', tradeId), wallet_id: null, trade_id: tradeId, category_id: pnlCategory(pnl > 0).id, type: pnl > 0 ? 'income' : 'expense', amount_minor: Math.abs(pnl), currency: hc.ccy, occurred_at: tr.date, note: `${assetInfo(h.symbol).symbol} ${pnl > 0 ? __('profit') : __('loss')}`, category_source: 'user', ai_confidence: null });
  return true;
}
/* the broker's fee on a sale is its own expense in Fee, on top of the amount received: the cash receives the whole amount, the fee does not reduce it.
   No wallet; tied to the cash side of the sale (the event the profit/loss record does not use) so it goes with the sale */
function addSaleFee(s, fee, date, note, mirror) {
  const info = assetInfo(s.symbol), ccy = info.type === 'cash' ? info.cash : 'USD', minor = toMinor(fee, ccy);
  if (!(minor > 0)) return;
  D().transactions.push({ id: detId('fee', mirror), wallet_id: null, trade_id: mirror, category_id: feeCategory().id, type: 'expense', amount_minor: minor, currency: ccy, occurred_at: date, note, category_source: 'user', ai_confidence: null });
}
/* sales made before this existed: add the missing record for each */
/* deposits into and withdrawals from an investment Cash balance made before they were transfers: give each its transfer id and wording */
function convertCashTrades() {
  let n = 0;
  D().holdings.filter((h) => assetInfo(h.symbol).type === 'cash').forEach((h) => h.trades.forEach((tr) => {
    D().transactions.forEach((t) => { if (t.trade_id === tr.id && t.type === 'transfer' && !t.transfer_id) { t.transfer_id = detId('cashx', tr.id); t.note = t.flow === 'out' ? __('Transfer to {name}', { name: cashName(h) }) : __('Transfer from {name}', { name: cashName(h) }); n++; } });
  }));
  return n > 0;
}
function backfillSaleRecords() {
  let n = 0; D().holdings.forEach((h) => { h.trades.forEach((tr) => { if (tr.side === 'sell' && tr.via && tr.date <= todayIso() && addSaleRecord(h, tr.id)) n++; }); });
  if (n) sortTxns();
  return n > 0;
}
function recordTrade(h, { side, quantity, source, amount, date, price, fee }) {
  const id = uid(), sym = assetInfo(h.symbol).symbol, word = side === 'buy' ? __('Bought') : __('Sold');
  const addTrade = (hh, tr) => { hh.trades.push(tr); if (tr.side === 'buy' && tr.date.slice(0, 7) < hh.since) hh.since = tr.date.slice(0, 7); };
  h.quantity = r12(h.quantity + (side === 'buy' ? quantity : -quantity));
  // the price per unit is what you paid in the account's own currency, converted once into the holding's cost currency at today's rate
  let px = {};
  if (trackCost(h)) {
    const sc = srcCcy(source), paid = source.kind === 'wallet' ? toMajor(amount, sc) : amount, per = price > 0 ? price : paid / quantity;
    if (!h.ccy) h.ccy = sc;
    px = { price: (per * RATES[h.ccy]) / RATES[sc] };
  }
  if (source.kind === 'wallet') {
    const w = source.wallet;
    addTrade(h, { id, date, side, quantity, amount_minor: amount, currency: w.currency, wallet_id: w.id, ...px });
    // selling: only the cost of what was sold goes back as a transfer in; the profit or loss on top is its own record (below) on the same account
    let moved = amount, pnl = 0;
    if (side === 'sell' && trackCost(h)) { const hc = holdingCost(h), pi = hc.per[id]; if (hc.known && pi && Number.isFinite(pi.realized)) { pnl = toMinor((pi.realized * RATES[w.currency]) / RATES[h.ccy], w.currency); if (amount - pnl <= 0) pnl = 0; moved = amount - pnl; } }
    // a deposit into or withdrawal from an investment Cash balance is a transfer (it is shown and edited as one)
    const cashX = assetInfo(h.symbol).type === 'cash';
    D().transactions.push({ id: uid(), trade_id: id, wallet_id: w.id, category_id: null, type: 'transfer', flow: side === 'buy' ? 'out' : 'in',
      amount_minor: moved, currency: w.currency, occurred_at: date, note: cashX ? `${side === 'buy' ? __('Transfer to {name}', { name: cashName(h) }) : __('Transfer from {name}', { name: cashName(h) })}` : `${word} ${qtyFmt(quantity)} ${sym}`, category_source: 'user', ai_confidence: null, ...(cashX ? { transfer_id: detId('cashx', id) } : {}) });
    if (pnl !== 0) D().transactions.push({ id: detId('pnl', id), wallet_id: w.id, category_id: pnlCategory(pnl > 0).id, type: pnl > 0 ? 'income' : 'expense', amount_minor: Math.abs(pnl), currency: w.currency, occurred_at: date, note: `${sym} ${pnl > 0 ? __('profit') : __('loss')}`, category_source: 'user', ai_confidence: null });
    addFeeRecord(w, fee, date, `${__('Investment fee')} (${word} ${qtyFmt(quantity)} ${sym})`);   // what the broker charged, from the same account
    sortTxns();
    return;
  }
  let s = source.holding;
  if (source.kind === 'new') { s = { id: uid(), account_id: h.account_id, symbol: source.symbol, quantity: 0, since: monthKey(new Date()), trades: [] }; D().holdings.push(s); }
  const mirror = uid(), ssym = assetInfo(s.symbol).symbol;
  s.quantity = r12(s.quantity + (side === 'buy' ? -amount : amount));
  addTrade(h, { id, date, side, quantity, via: { holding_id: s.id, symbol: ssym, quantity: amount, pair: mirror }, ...px });
  addTrade(s, { id: mirror, date, side: side === 'buy' ? 'sell' : 'buy', quantity: amount, via: { holding_id: h.id, symbol: sym, quantity, pair: id } });
  addSaleRecord(h, id);
  if (side === 'sell' && fee > 0) addSaleFee(s, fee, date, `${__('Investment fee')} (${word} ${qtyFmt(quantity)} ${sym})`, mirror);
}

/* undo a trade (and its paired trade, or the wallet transfer) */
function removeTrade(h, tr) {
  const other = tr.via ? D().holdings.find((x) => x.id === tr.via.holding_id) : null, ot = other?.trades.find((x) => x.id === tr.via.pair);
  const back = h.quantity - tradeSign(tr) * tr.quantity, oback = ot ? other.quantity - tradeSign(ot) * ot.quantity : 0;
  if (back < -1e-12 || oback < -1e-12) return false;
  h.quantity = r12(Math.max(0, back)); h.trades = h.trades.filter((x) => x.id !== tr.id);
  if (ot) { other.quantity = r12(Math.max(0, oback)); other.trades = other.trades.filter((x) => x.id !== ot.id); }
  D().transactions = D().transactions.filter((t) => t.trade_id !== tr.id && t.trade_id !== ot?.id && t.id !== detId('pnl', tr.id) && !(ot && t.id === detId('pnl', ot.id)));   // the wallet gets its money back (and the profit or loss record goes)
  return true;
}

function tradeList(h) {
  const trades = [...h.trades].sort((a, b) => b.date.localeCompare(a.date)), sym = assetInfo(h.symbol).symbol, sym2 = assetInfo(h.symbol).type;
  if (!trades.length) return ('<p class="muted" style="font-size:13px">' + (sym2 === 'cash' ? __('No deposits or withdrawals yet.') : __('No buys or sells recorded yet.')) + '</p>');
  const hc = trackCost(h) ? holdingCost(h) : null;
  return `<div class="list">${trades.map((tr) => {
    const pi = hc && hc.per[tr.id] ? hc.per[tr.id] : null, ptxt = pi ? ` · @ ${priceFmt(pi.price, hc.ccy)}` : '', rtxt = pi && tr.side === 'sell' && hc.known ? ` · ${__('P&L')} <span class="pl ${pi.realized >= 0 ? 'up' : 'down'}">${signed(pi.realized, money(usdToMinor(usdOfCcy(Math.abs(pi.realized), hc.ccy), vcOf(h)), vcOf(h)))}</span>` : '';
    const tail = tr.kind ? `${tr.kind === 'income' ? __('Income') : __('Expense')} · ${money(tr.amount_minor, tr.currency)}` : tr.via ? __('in exchange for {qty} {symbol}', { qty: qtyFmt(tr.via.quantity), symbol: esc(tr.via.symbol) }) : `${tr.side === 'buy' ? __('paid') : __('received')} ${money(tr.amount_minor, tr.currency)} · ${esc(walletOf(tr.wallet_id)?.name || __('account'))}`;
    return `<div class="pay-row"><span>${esc(new Date(tr.date + 'T00:00').toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' }))} · ${tr.kind === 'income' ? __('Received') : tr.kind === 'expense' ? __('Spent') : sym2 === 'cash' ? (tr.side === 'buy' ? __('Deposited') : __('Withdrew')) : tr.side === 'buy' ? __('Bought') : __('Sold')} ${qtyFmt(tr.quantity, h)} ${esc(sym)}<br><small class="muted">${tail}${ptxt}${rtxt}</small></span><span></span><button type="button" class="icon-x" data-act="delete-trade" data-id="${h.id}" data-tid="${tr.id}" aria-label="${__('Remove trade')}">×</button></div>`;
  }).join('')}</div>`;
}

/* set or correct the average price of what you held before the first recorded trade */
function costDialog(h) {
  const info = assetInfo(h.symbol), c = holdingCost(h);
  open(`<h2>${__('Average price')}</h2><p class="muted" style="margin-top:-10px">${__('What you paid per {symbol} for the {qty} you held before your first recorded buy or sell.', { symbol: esc(info.symbol), qty: qtyFmt(c.q0) })}</p>
  <form data-form="cost" data-id="${h.id}" style="display:contents"><div class="two"><label class="field">${__('Average price')}<input name="avgprice" type="number" inputmode="decimal" min="0" step="any" required value="${h.open_price != null ? h.open_price : ''}"></label>
    <label class="field">${__('Price currency')}${h.ccy ? `<input value="${h.ccy}" disabled>` : `<select name="pccy">${ccyOptions(defaultPriceCcy(info, cur()))}</select>`}</label></div>
  <div class="actions"><button class="btn" type="submit">${__('Save')}</button></div></form>`);
}
/* Deposit / Withdraw on an investment Cash balance (Portfolio): amount, optional fee, no quantity; saved as a transfer with a bank / e-wallet account */
function cashDialog(h, side) {
  const info = assetInfo(h.symbol), ws = D().wallets.filter((w) => !w.archived), dep = side === 'buy', hc = cashCcy(h);
  if (!ws.length) { toast('Add an account first'); return; }
  const last = recallAcct(dep ? 'cashin' : 'cashout', ws.map((w) => `value="${w.id}"`).join('')), first = ws.find((w) => w.id === last) || ws.find((w) => w.currency === hc) || ws[0];
  open(`<h2>${dep ? __('Deposit {symbol}', { symbol: esc(info.symbol) }) : __('Withdraw {symbol}', { symbol: esc(info.symbol) })}</h2><p class="muted" style="margin-top:-10px">${__('You hold {qty} {symbol}', { qty: qtyFmt(heldNow(h), h), symbol: esc(info.symbol) })}</p>
  <form data-form="cashx" data-id="${h.id}" style="display:contents">
    <div class="seg"><label><input type="radio" name="side" value="buy" ${dep ? 'checked' : ''}>${__('Deposit')}</label><label><input type="radio" name="side" value="sell" ${dep ? '' : 'checked'}>${__('Withdraw')}</label></div>
    <label class="field"><span>${dep ? __('Pay with') : __('Receive into')}</span><select name="account">${ws.map((w) => `<option value="${w.id}" ${w.id === first.id ? 'selected' : ''}>${esc(w.name)} (${esc(w.currency)}) · ${money(walletBalance(w), w.currency)}</option>`).join('')}</select></label>
    <div class="two"><label class="field"><span data-cx-amt></span><input name="amount" type="number" inputmode="decimal" min="0" step="any" required placeholder="${__('amount')}"></label>
      <label class="field"><span data-cx-fee></span><input name="fee" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label></div>
    <label class="field" data-cx-recv hidden><span data-cx-recv-label></span><input name="received" type="number" inputmode="decimal" min="0" step="any"></label>
    <label class="field">${__('Date')}<input name="date" type="date" required value="${isoDate(new Date())}"></label>
    <p class="hint" data-cx-hint></p>
    <div class="actions"><button class="btn" type="submit">${__('Save')}</button></div></form>`);
  syncCashForm($('#dlg form'));
}
/* labels follow the side and the chosen account; the received amount only appears when the account and the Cash balance use different currencies */
function syncCashForm(form) {
  const h = D().holdings.find((x) => x.id === form.dataset.id), w = walletOf(form.account.value); if (!h || !w) return;
  const dep = form.side.value === 'buy', hc = cashCcy(h), src = dep ? w.currency : hc, dst = dep ? hc : w.currency, cross = src !== dst;
  $('[data-cx-amt]', form).textContent = dep ? __('Amount paid ({unit})', { unit: src }) : __('Amount ({cur})', { cur: src });
  $('[data-cx-fee]', form).textContent = __('Fee, optional ({cur})', { cur: src });
  $('[data-cx-recv]', form).hidden = !cross;
  if (cross) {
    $('[data-cx-recv-label]', form).textContent = __('Amount received ({cur}) · estimated, edit if different', { cur: dst });
    const a = parseFloat(form.amount.value);
    if (!form.received.dataset.touched) form.received.value = a > 0 ? toMajor(convert(toMinor(a, src), src, dst), dst).toFixed(expOf(dst)) : '';
  }
  $('[data-cx-hint]', form).textContent = dep ? __('The money leaves that account. A fee is taken from it on top and counts as spending; the deposit itself is not spending or income.') : __('The money goes into that account. A fee comes out of the Cash balance and counts as spending; the withdrawal itself is not spending or income.');
}
function tradeDialog(h, side) {
  const info = assetInfo(h.symbol), ws = D().wallets.filter((w) => !w.archived), first = ws.find((w) => w.currency === cur()) || ws[0];
  open(`<h2>${info.cash ? (side === 'buy' ? __('Deposit {symbol}', { symbol: esc(info.symbol) }) : __('Withdraw {symbol}', { symbol: esc(info.symbol) })) : side === 'buy' ? __('Buy {symbol}', { symbol: esc(info.symbol) }) : __('Sell {symbol}', { symbol: esc(info.symbol) })}</h2><p class="muted" style="margin-top:-10px">${__('You hold {qty} {symbol}', { qty: qtyFmt(heldNow(h)), symbol: esc(info.symbol) })}</p>
  <form data-form="trade" data-id="${h.id}" style="display:contents">
    <div class="seg"><label><input type="radio" name="side" value="buy" ${side === 'buy' ? 'checked' : ''}>${info.cash ? __('Deposit') : __('Buy')}</label><label><input type="radio" name="side" value="sell" ${side === 'sell' ? 'checked' : ''}>${info.cash ? __('Withdraw') : __('Sell')}</label></div>
    <label class="field"><span data-trade-wallet></span><select name="source">${sourceOptions(side, h, first ? 'w:' + first.id : '')}</select></label>
    <div class="two"><label class="field">${__('Quantity')}<input name="quantity" type="number" inputmode="decimal" min="0" step="any" required placeholder="e.g. 0.01"></label>
      <label class="field"><span data-trade-amt></span><input name="amount" type="number" inputmode="decimal" min="0" step="any" required placeholder="${__('amount')}"></label></div>
    ${trackCost(h) ? `<label class="field"><span data-price-unit></span><input name="price" type="number" inputmode="decimal" min="0" step="any" placeholder="${__('fills in from the amount')}"></label>` : ''}
    <label class="field" data-fee-box hidden><span data-fee-label>${__('Fee (optional)')}</span><input name="fee" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label>
    <label class="field">${__('Date')}<input name="date" type="date" required value="${isoDate(new Date())}"></label>
    <p class="hint" id="trade-hint"></p>
    <div class="actions"><button class="btn" type="submit">${__('Save')}</button></div></form>`);
  syncTradeForm($('#dlg form'), false);
}
/* keep labels, the stablecoin options and the price hint in step with the side and the chosen source */
function syncTradeForm(form, rebuild) {
  const h = D().holdings.find((x) => x.id === form.dataset.id), buy = form.side.value === 'buy';
  if (rebuild) { const keep = form.source.value; form.source.innerHTML = sourceOptions(form.side.value, h, keep); }
  const src = parseSource(form.source.value);
  $('[data-trade-wallet]', form).textContent = buy ? __('Pay with') : __('Receive into');
  $('[data-trade-amt]', form).textContent = `${buy ? __('Amount paid') : __('Amount received')} (${src ? sourceUnit(src) : ''})`;
  const pu = $('[data-price-unit]', form); if (pu) pu.textContent = __('Price per unit ({ccy})', { ccy: srcCcy(src) });
  syncFeeBox(form, src, assetInfo(h.symbol).cash, !buy);
  syncTradePrice(form, 'source');
  tradeHint(form);
}
/* price per unit implied by what was typed, next to the market price */
/* quantity, price per unit and amount move together: type the price and the amount follows; type the amount and the price follows */
function syncTradePrice(form, changed) {
  if (!form.price) return;
  const q = parseFloat(form.quantity.value), src = parseSource(form.source.value);
  if (changed === 'price' || changed === 'amount') form.dataset.last = changed;
  if (!src || !(q > 0)) return;
  // the price is in the payment source's currency, so amount = quantity x price with no conversion
  if (form.dataset.last === 'price' && changed !== 'amount') {
    const p = parseFloat(form.price.value);
    if (p > 0) { const a = q * p; form.amount.value = src.kind === 'wallet' ? a.toFixed(expOf(src.wallet.currency)) : +a.toPrecision(10); }
  } else {
    const a = parseFloat(form.amount.value);
    if (a > 0) form.price.value = +(a / q).toPrecision(8);
  }
}
function tradeHint(form) {
  const h = D().holdings.find((x) => x.id === form.dataset.id), src = parseSource(form.source.value), q = parseFloat(form.quantity.value), a = parseFloat(form.amount.value);
  const hint = $('#trade-hint', form), buy = form.side.value === 'buy';
  const base = src?.kind === 'wallet' ? (buy ? __('The money leaves that account. Not counted as spending or income.') : __('The money goes into that account. Not counted as spending or income.')) : (buy ? __('The coins are taken from your stablecoin balance. Not counted as spending or income.') : __('The coins are added to your stablecoin balance. Not counted as spending or income.'));
  const conv = h && trackCost(h) && h.ccy && src && srcCcy(src) !== h.ccy ? ' ' + __('The average price is kept in {ccy}, converted at the latest rate.', { ccy: h.ccy }) : '';
  if (!h || !src || !(q > 0) || !(a > 0)) { hint.textContent = base + conv; return; }
  const info = assetInfo(h.symbol), month = currentPeriod();
  const usd = src.kind === 'wallet' ? a / RATES[src.wallet.currency] : a * assetInfo(src.kind === 'holding' ? src.holding.symbol : src.symbol).usd(month);
  const per = usd / q, market = info.usd(month), diff = market > 0 ? ((per - market) / market) * 100 : null;
  hint.textContent = __('About ${price} per {symbol}', { price: per.toLocaleString('en-US', { maximumFractionDigits: 4 }), symbol: info.symbol }) + (market > 0 ? ' ' + __('(market ${price}, {diff}).', { price: market.toLocaleString('en-US', { maximumFractionDigits: 4 }), diff: `${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}%` }) + ' ' : '. ') + base + conv;
}

