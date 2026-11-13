'use strict';
/* Stiver app: the investment dialogs: holding summary and cost rows, buy/sell forms, sell-asset and holding dialogs, currency options and the form sync helpers. Part of the former prototype/app.js; see docs/MAP.md. Main names: holdingSummary, costRows, sellAssetDialog, syncSellForm, holdingDialog, syncPickType, syncFeeBox, syncFund, syncOwnPrice, syncAvgPrice. */
/* ---------- investment dialogs ---------- */
function accountDialog(a) {
  open(`<h2>${a ? __('Edit investment account') : __('New investment account')}</h2><form data-form="account" data-id="${a?.id || ''}" style="display:contents">
    <label class="field">${__('Name')}<input name="name" required maxlength="40" value="${esc(a?.name || '')}" placeholder="${__('e.g. Crypto Exchange, US Brokerage')}"></label>
    <p class="hint">${__('An account can hold several assets: crypto, US stocks and ETFs.')}</p>
    <div class="actions">${a ? `<button type="button" class="btn danger" data-act="archive-account" data-id="${a.id}">${__('Archive')}</button>` : ''}<button class="btn" type="submit">${__('Save')}</button></div></form>`);
}
/* detail of one holding: quantity, current price, value, share of its account (opened by tapping a row) */
const vcOf = () => pf();
function holdingSummary(h, info, vc) {
  const k = lastMonths(6)[5], price = info.usd(k), qty = heldNow(h), value = qty * price, accTotal = portfolioUSD(k, h.account_id);
  const row = (l, v) => `<div class="hs-row"><span>${l}</span><b class="num">${v}</b></div>`;
  return `<div class="hold-sum"><div class="hs-top"><span class="tile sym" style="--c:${TYPE_COLOR[info.type]}">${esc(info.symbol.slice(0, 4))}</span><div><b>${esc(info.symbol)}</b><small class="muted">${esc(typeLabel(info.type))} · ${esc(accountName(h.account_id))}</small></div></div>
    ${row(info.cash ? __('Balance') : __('You hold'), `${qtyFmt(qty, h)} ${esc(info.symbol)}`)}${info.cash ? '' : row(__('Current price'), money(usdToMinor(price, vc), vc))}${row(__('Total value'), moneyP(usdToMinor(value, vc), vc))}${costRows(h, vc, row)}${row(__('Share of account'), `${accTotal ? Math.round((value / accTotal) * 100) : 0}%`)}</div>`;
}
/* average price, cost, unrealized and realized profit (not for cash and stablecoins) */
function costRows(h, vc, row) {
  if (!trackCost(h)) return '';
  const c = holdingCost(h), m = (x) => money(usdToMinor(usdOfCcy(x, c.ccy), vc), vc), colored = (n, t) => `<span class="pl ${n >= 0 ? 'up' : 'down'}">${t}</span>`;
  const setBtn = `<button type="button" class="legend-btn" data-act="set-cost" data-id="${h.id}">${__('Set average price')}</button>`;
  let out = '';
  if (!c.known) out += row(__('Average price'), c.q0 > 1e-12 ? setBtn : '—') + row(__('Profit / loss'), '—');
  else {
    const pl = pnlOf(h);
    out += row(__('Average price'), c.qty > 0 ? priceFmt(c.avg, c.ccy) : '—');
    if (c.qty > 0) out += row(__('Cost'), m(c.cost)) + row(__('Profit / loss'), colored(pl.pnl, signed(pl.pnl, m(Math.abs(pl.pnl))) + (pl.pct != null ? ` (${pctText(pl.pct)})` : '')));
  }
  if (c.realized) out += row(__('Realized P&L'), colored(c.realized, signed(c.realized, m(Math.abs(c.realized)))));
  if (c.q0 > 1e-12 && c.known) out += row(__('Starting price'), `${priceFmt(h.open_price, c.ccy)} <button type="button" class="legend-btn" data-act="set-cost" data-id="${h.id}">${__('Edit')}</button>`);
  return out;
}
/* Invest tab: Buy (a new or existing asset) or Sell (something you hold in that account) */
const buySellSeg = (active) => `<div class="seg"><label><input type="radio" name="side" value="buy" ${active === 'buy' ? 'checked' : ''}>${__('Buy')}</label><label><input type="radio" name="side" value="sell" ${active === 'sell' ? 'checked' : ''}>${__('Sell')}</label></div>`;
const sellable = (accId) => D().holdings.filter((x) => x.account_id === accId && assetInfo(x.symbol).type !== 'cash' && heldNow(x) > 1e-12);
const sellAssetOptions = (accId, sel) => sellable(accId).map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(assetInfo(x.symbol).symbol)} · ${esc(assetInfo(x.symbol).name)} · ${qtyFmt(heldNow(x), x)} ${__('held')}</option>`).join('');
function sellAssetDialog(accId) {
  const accounts = activeAccounts(), acc = accounts.find((a) => a.id === accId) || accounts.find((a) => sellable(a.id).length) || accounts[0], list = acc ? sellable(acc.id) : [], first = list[0] || null;
  const ws = D().wallets.filter((w) => !w.archived), firstW = ws.find((w) => w.currency === cur()) || ws[0];
  open(`<h2>${__('Add transaction')}</h2><form data-form="holding" data-invest="1" data-sell="1" style="display:contents">
    ${kindSeg('invest')}${buySellSeg('sell')}
    <label class="field">${__('Account')}<select name="account">${accounts.map((a) => `<option value="${a.id}" ${acc && a.id === acc.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
    <label class="field">${__('Asset you hold')}<select name="sellasset" data-search data-empty="${__('Asset not found')}">${sellAssetOptions(acc?.id, first?.id) || `<option value="">${__('Nothing to sell in this account')}</option>`}</select></label>
    <div class="two"><label class="field">${__('Receive into')}<select name="fund">${sourceOptions('sell', first, recallAcct('investsell', sourceOptions('sell', first, '')) || '')}</select></label>
      <label class="field"><span data-fund-amt>${__('Amount received')}</span><input name="fundamount" type="number" inputmode="decimal" min="0" step="any" required placeholder="${__('amount')}"></label></div>
    <label class="field" data-fee-box hidden><span data-fee-label>${__('Fee (optional)')}</span><input name="fee" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label>
    <label class="field">${__('Quantity sold')}<input name="quantity" type="number" inputmode="decimal" min="0" step="any" required placeholder="${__('e.g. 0.05')}"></label>
    <label class="field">${__('Date')}<input name="date" type="date" required value="${isoDate(new Date())}"></label>
    <p class="hint">${__('The money goes into the account. Only the cost of what you sold is moved; any profit or loss becomes its own record. It is not counted as spending.')}</p>
    <div class="actions"><button class="btn" type="submit">${__('Sell')}</button></div></form>`);
  syncSellForm($('#dlg form'));
}
/* keep the sell form in step: the receiving list follows the chosen asset (it cannot pay into itself), the labels follow the receiving account */
function syncSellForm(form, rebuild) {
  const h = D().holdings.find((x) => x.id === form.sellasset.value) || null;
  if (rebuild) { const keep = form.fund.value; form.fund.innerHTML = sourceOptions('sell', h, keep); }
  const src = parseSource(form.fund.value), label = $('[data-fund-amt]', form);
  label.textContent = src ? __('Amount received ({unit})', { unit: sourceUnit(src) }) : __('Amount received');
  syncFeeBox(form, src, false, true);
}
function holdingDialog(h, accId, opts = {}) {
  if (!h) state.ui.pickType = opts.pickType || '';   // the asset picker starts on All (or Cash balance from the + Cash button)
  const accounts = activeAccounts(), info = h && assetInfo(h.symbol), invest = !!opts.invest;
  const ws = D().wallets.filter((w) => !w.archived), firstW = ws.find((w) => w.currency === cur()) || ws[0];
  open(`<h2>${h ? esc(info.name) : invest ? __('Add transaction') : __('Add asset')}</h2><form data-form="holding" data-id="${h?.id || ''}" ${invest ? 'data-invest="1"' : ''} style="display:contents">
    ${invest ? kindSeg('invest') + buySellSeg('buy') : ''}
    ${h ? '' : `<label class="field">${__('Account')}<select name="account">${accounts.map((a) => `<option value="${a.id}" ${a.id === (h?.account_id || accId || (invest ? recallAcct('investacct', accounts.map((x) => `value="${x.id}"`).join('')) : '')) ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>`}
    ${h ? '' : `
    <div class="field" id="picker">${__('Asset')}
      <div class="asset-search"><select data-pick-type aria-label="${__('Asset type')}">${[['', 'All'], ['crypto', 'Crypto'], ['stock', 'US stocks &amp; ETFs'], ['idx', 'Indonesia (IDX)'], ['commodity', 'Commodities'], ['cash', 'Cash balance']].map(([v, l]) => `<option value="${v}" ${(state.ui.pickType || '') === v ? 'selected' : ''}>${__(l)}</option>`).join('')}</select>
      <input name="assetq" autocomplete="off" placeholder="${__('Name or ticker')}" ${state.ui.pickType === 'cash' ? 'hidden' : ''}>
      <select data-cash-ccy data-search data-empty="${__('Currency not found')}" aria-label="${__('Currency')}" ${state.ui.pickType === 'cash' ? '' : 'hidden'}>${Object.keys(RATES).map((c) => `<option value="${c}" data-s="${c} ${esc(ccyName(c))}" ${c === cur() ? 'selected' : ''}>${c} · ${esc(ccyName(c))}</option>`).join('')}</select></div>
      <div class="results" id="asset-results" role="listbox" hidden></div>
      <div class="picked" id="picked" hidden></div>
      <input type="hidden" name="asset"><input type="hidden" name="assetmeta">
      <label class="field price-fallback" hidden>${__('Price (USD)')}<input name="price" type="number" inputmode="decimal" min="0" step="any" placeholder="${__('Live price unavailable, enter it')}"></label>
      <button type="button" class="legend-btn" data-act="manual-asset">${__('Not listed? Add an asset manually')}</button></div>
    <div class="custom-fields" hidden><div class="two"><label class="field">${__('Symbol')}<input name="symbol" maxlength="10" placeholder="${__('e.g. GOLD')}"></label><label class="field">${__('Name')}<input name="cname" maxlength="40" placeholder="${__('Name')}"></label></div>
      <div class="two"><label class="field">${__('Type')}<select name="ctype"><option value="crypto">${__('Crypto')}</option><option value="stock">${__('Stock')}</option><option value="etf">${__('ETF')}</option><option value="manual">${__('Other')}</option></select></label><label class="field">${__('Price (USD)')}<input name="cprice" type="number" inputmode="decimal" min="0" step="any"></label></div></div>`}
    ${h ? holdingSummary(h, info, vcOf(h)) + `<div class="hold-actions"><button type="button" class="btn" data-act="trade" data-side="buy" data-id="${h.id}">${info.cash ? __('Deposit') : __('Buy')}</button><button type="button" class="btn secondary sell" data-act="trade" data-side="sell" data-id="${h.id}">${info.cash ? __('Withdraw') : __('Sell')}</button></div>
      <button type="button" class="btn secondary wide" data-act="view-history" data-id="${h.id}">${__('View history')}</button>
      <label class="field">${__('Move to account')}<select name="account">${accounts.map((a) => `<option value="${a.id}" ${a.id === (h?.account_id || accId) ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      ${isCoinMovable(h) ? `<div data-move-box hidden><div class="two"><label class="field">${__('Quantity')}<input name="mvqty" type="number" inputmode="decimal" min="0" step="any" value="${+heldNow(h).toPrecision(12)}"></label>
        <label class="field">${__('Network fee ({unit})', { unit: esc(info.symbol) })}<input name="mvfee" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label></div>
        <label class="field">${__('Date')}<input name="mvdate" type="date" value="${isoDate(new Date())}"></label>
        <p class="hint">${__('The fee is taken from the amount you move: the other account receives the quantity minus the fee. The fee counts as spending; the move itself does not.')}</p></div>` : ''}` : `
    <div class="two"><label class="field">${invest ? __('Pay with') : __('Paid from')}<select name="fund">${invest ? '' : ('<option value="">' + __('Already owned (no payment)') + '</option>')}${sourceOptions('buy', null, invest ? (recallAcct('invest', sourceOptions('buy', null, '')) || (firstW ? 'w:' + firstW.id : '')) : '')}</select></label>
      <label class="field"><span data-fund-amt>${__('Amount paid')}</span><input name="fundamount" type="number" inputmode="decimal" min="0" step="any" ${invest ? 'required' : ''} placeholder="${__('amount')}"></label></div>
 <label class="field" data-fee-box hidden><span data-fee-label>${__('Fee (optional)')}</span><input name="fee" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label>
    <label class="field">${invest ? __('Quantity bought') : __('Quantity you hold')}<input name="quantity" type="number" inputmode="decimal" min="0" step="any" required placeholder="${__('e.g. 0.05')}"></label>
    <div class="two" data-own-price><label class="field">${__('Average price')}<input name="avgprice" type="number" inputmode="decimal" min="0" step="any" placeholder="${__('optional')}"></label>
      <label class="field">${__('Price currency')}<select name="pccy">${ccyOptions(cur())}</select></label></div>
    ${invest ? `<label class="field">${__('Date')}<input name="date" type="date" required value="${isoDate(new Date())}"></label>` : ''}
    ${invest ? repeatField() : ''}
    <p class="hint">${invest ? __('The money leaves the account (or your USDT/USDC balance) and the asset is added to your investments. It is not counted as spending.') : __('Choose a payment source if you just bought it. Leave it as "Already owned" for assets you held before.')}</p>`}
    <div class="actions">${h ? `<button type="button" class="btn danger" data-act="delete-holding" data-id="${h.id}">${__('Remove')}</button>` : ''}<button class="btn" type="submit">${h ? __('Save') : invest ? __('Invest') : __('Add asset')}</button></div></form>`);
  if (!h) { syncFund($('#dlg form')); syncPickType($('#dlg form')); }
}
const CCY_NAMES = { IDR: 'Indonesian rupiah', USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', SGD: 'Singapore dollar', AUD: 'Australian dollar', JPY: 'Japanese yen', HKD: 'Hong Kong dollar', CNY: 'Chinese yuan' , INR: 'Indian rupee', PHP: 'Philippine peso'};
/* the currency an asset is usually quoted in */
const defaultPriceCcy = (a, fallback) => (a.yh && /\.JK$/.test(a.yh) ? 'IDR' : a.yh || a.fh || ['crypto', 'stock', 'etf', 'commodity'].includes(a.type) ? 'USD' : fallback);
const ccyOptions = (sel) => Object.keys(RATES).map((c) => `<option value="${c}" ${c === sel ? 'selected' : ''} data-list="${flagLabel(c)}">${c}</option>`).join('');
const ccyName = (c) => __(CCY_NAMES[c] || c);
/* Cash balance type: the text box becomes a searchable list of currencies and the choice goes straight into that field (no chip below) */
function syncPickType(form) {
  if (!form || !form.assetq) return;
  const cash = state.ui.pickType === 'cash', sel = $('[data-cash-ccy]', form);
  form.assetq.hidden = cash; sel.hidden = !cash;
  if (cash) { pickAsset({ key: 'CASH:' + sel.value, symbol: sel.value, name: `Cash (${sel.value})`, type: 'cash', cash: sel.value }, form, true); $('#asset-results').hidden = true; }
  else if (form.asset.value.startsWith('CASH:')) { form.asset.value = ''; form.assetmeta.value = ''; $('#picked').hidden = true; }
}
/* Move to account on a stablecoin or crypto holding: Quantity, Network fee and Date appear once another account is chosen */
function syncMoveBox(form) {
  const box = $('[data-move-box]', form), h = D().holdings.find((x) => x.id === form.dataset.id); if (box && h) box.hidden = form.account.value === h.account_id;
}
/* a fee is asked only when the other side is a normal account (it is charged to that account, in its currency); not for cash deposits */
/* a purchase paid from a bank account, or a sale of an asset (received in the investment account itself), can carry the broker's fee */
function syncFeeBox(form, src, isCash, sell) {
  const box = $('[data-fee-box]', form); if (!box) return;
  const on = !!src && !isCash && (src.kind === 'wallet' || !!sell); box.hidden = !on;
  if (on) $('[data-fee-label]', box).textContent = __('Fee, optional ({cur})', { cur: sourceUnit(src) }); else form.fee.value = '';
}
/* the amount's unit follows the payment source: a wallet's currency, or coins for a stablecoin */
function syncFund(form) {
  const src = parseSource(form.fund.value), label = $('[data-fund-amt]', form);
  label.textContent = src ? __('Amount paid ({unit})', { unit: sourceUnit(src) }) : __('Amount paid');
  // "Already owned (no payment)": there is nothing paid, so the amount cannot be filled in
  form.fundamount.disabled = !src; form.fundamount.placeholder = src ? __('amount') : __('No payment'); if (!src) form.fundamount.value = '';
  syncFeeBox(form, src, false);
  syncOwnPrice(form);
}
/* the average-price fields are for assets you already owned (no payment) and that have a cost (not cash or stablecoins) */
function syncOwnPrice(form) {
  const box = $('[data-own-price]', form); if (!box) return;
  box.hidden = form.dataset.nocost === '1';   // cash and stablecoins have no cost to track; otherwise the box is always there (typed when already owned, automatic when paid)
  syncAvgPrice(form);
}
/* paid from an account / coin: the average price is worked out (amount paid / quantity, in that account's currency) and cannot be typed;
   already owned: you type it with its price currency */
function syncAvgPrice(form) {
  const avg = form.avgprice, pc = form.pccy; if (!avg) return;
  const src = parseSource(form.fund.value);
  if (!src) { if (avg.dataset.auto) { avg.value = ''; delete avg.dataset.auto; } avg.readOnly = false; avg.placeholder = __('optional'); if (pc) pc.disabled = false; return; }
  const q = parseFloat(form.quantity.value), a = parseAmount(src, form.fundamount.value || 0), sc = srcCcy(src);
  avg.readOnly = true; avg.dataset.auto = '1'; avg.placeholder = __('fills in from the amount');
  if (pc) { if ([...pc.options].some((o) => o.value === sc || o.text === sc)) pc.value = sc; pc.disabled = true; }
  avg.value = q > 0 && a > 0 ? String(+((src.kind === 'wallet' ? toMajor(a, sc) : a) / q).toPrecision(8)) : '';
}

