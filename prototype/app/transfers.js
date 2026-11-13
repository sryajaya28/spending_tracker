'use strict';
/* Stiver app: transfers between wallets, the add/edit transaction, budget, occasion, category, breakdown, wallet and account dialogs, and the coin-account helpers. Part of the former prototype/app.js; see docs/MAP.md. Main names: xferEnd, xferRead, transferDialog, syncTransfer, saveTransfer, removeTransferGroup, recordCoinTxn, rememberAcct, latestAcct, recallAcct, acctOptions, txnDialog, budgetDialog, occasionDialog, occasionsCard, archivedOccasionsDialog, archivedCatsDialog, catDialog, breakdownDialog, walletDialog, accountDialog. */
/* ---------- transfers between wallets ----------
   Stored as linked transactions sharing a transfer_id: an 'out' leg on the source wallet, an 'in' leg on the
   destination (in its own currency) and an optional fee as a normal expense on the source wallet. Transfers
   are not income or spending; the fee is spending. */
/* an end of a transfer is a bank / e-wallet account ("w:<id>") or an investment account's Cash balance ("h:<id>") */
const cashName = (h) => `${accountName(h.account_id)} (${__('Cash')})`;
const cashCcy = (h) => assetInfo(h.symbol).cash;
const cashHoldings = () => D().holdings.filter((h) => assetInfo(h.symbol).type === 'cash' && activeAccounts().some((a) => a.id === h.account_id));
function xferEnd(v) {
  if (!v) return null; const id = v.slice(2);
  if (v[0] === 'w') { const w = walletOf(id); return w ? { kind: 'w', w, id: v, name: w.name, ccy: w.currency, bal: walletBalance(w) } : null; }
  const h = D().holdings.find((x) => x.id === id); return h ? { kind: 'h', h, id: v, name: cashName(h), ccy: cashCcy(h), bal: toMinor(heldNow(h), cashCcy(h)) } : null;
}
/* the two ends of a saved transfer, read back from its legs: { from, to, sent, received, fee, date, note } (amounts in major units) */
function xferRead(gid) {
  const legs = D().transactions.filter((t) => t.transfer_id === gid), out = legs.find((t) => t.type === 'transfer' && t.flow === 'out'), inn = legs.find((t) => t.type === 'transfer' && t.flow === 'in'), feeRow = legs.find((t) => t.type === 'expense');
  if (!legs.length) return null;
  const holdingOf = (l) => (l && l.trade_id ? D().holdings.find((h) => h.trades.some((x) => x.id === l.trade_id)) : null), evOf = (l, h) => h.trades.find((x) => x.id === l.trade_id);
  let from, to, sent, received;
  if (out && inn) { from = 'w:' + out.wallet_id; to = 'w:' + inn.wallet_id; sent = toMajor(out.amount_minor, out.currency); received = toMajor(inn.amount_minor, inn.currency); }
  else if (out) { const h = holdingOf(out); from = 'w:' + out.wallet_id; to = h ? 'h:' + h.id : ''; sent = toMajor(out.amount_minor, out.currency); received = h ? evOf(out, h).quantity : sent; }
  else if (inn) { const h = holdingOf(inn); from = h ? 'h:' + h.id : ''; to = 'w:' + inn.wallet_id; received = toMajor(inn.amount_minor, inn.currency); sent = h ? evOf(inn, h).quantity : received; }
  else return null;
  const lead = out || inn;
  return { gid, from, to, sent, received, fee: feeRow ? toMajor(feeRow.amount_minor, feeRow.currency) : 0, date: lead.occurred_at, note: transferNote(lead), legs };
}
function transferDialog(preset, editGid) {
  const ws = D().wallets.filter((w) => !w.archived), cashes = cashHoldings();
  if (ws.length + cashes.length < 2) { toast('Add a second account first to transfer between accounts'); return; }
  const cur0 = editGid ? xferRead(editGid) : null;
  const ends = [...ws.map((w) => 'w:' + w.id), ...cashes.map((h) => 'h:' + h.id)];
  const from = (cur0 && cur0.from) || preset?.from || ends[0], to = (cur0 && cur0.to) || preset?.to || ends.find((e) => e !== from);
  const opt = (v, sel) => { const e = xferEnd(v); return `<option value="${v}" data-s="${esc(e.name)}" ${v === sel ? 'selected' : ''}>${esc(e.name)} (${esc(e.ccy)}) · ${money(e.bal, e.ccy)}</option>`; };
  const group = (sel) => `<optgroup label="${__('Accounts')}">${ws.map((w) => opt('w:' + w.id, sel)).join('')}</optgroup>${cashes.length ? `<optgroup label="${__('Investment cash')}">${cashes.map((h) => opt('h:' + h.id, sel)).join('')}</optgroup>` : ''}`;
  open(`<h2>${editGid ? __('Edit transfer') : __('Transfer between accounts')}</h2><form data-form="transfer" data-gid="${editGid || ''}" style="display:contents">
    ${editGid ? '' : kindSeg('transfer')}
    <label class="field">${__('From')}<select name="from"${searchAttr(group(from), 'Account not found')}>${group(from)}</select></label>
    <label class="field">${__('To')}<select name="to"${searchAttr(group(to), 'Account not found')}>${group(to)}</select></label>
    <div class="two"><label class="field"><span data-send-label>${__('Amount sent')}</span><input name="amount" type="number" inputmode="decimal" min="0" step="any" required value="${cur0 ? cur0.sent : ''}"></label>
      <label class="field">${__('Date')}<input name="date" type="date" required value="${cur0 ? cur0.date : isoDate(new Date())}"></label></div>
    <label class="field" data-recv hidden><span data-recv-label>${__('Amount received')}</span><input name="received" type="number" inputmode="decimal" min="0" step="any" value="${cur0 ? cur0.received : ''}"></label>
    <label class="field"><span data-fee-label>${__('Transfer fee (optional)')}</span><input name="fee" type="number" inputmode="decimal" min="0" step="any" placeholder="0" value="${cur0 && cur0.fee ? cur0.fee : ''}"></label>
    <label class="field">${__('Note (optional)')}<input name="note" maxlength="140" placeholder="${__('e.g. Top up e-wallet')}" value="${esc(cur0 ? cur0.note : '')}"></label>
    ${editGid ? '' : repeatField()}
    <p class="hint">${__('A transfer is not income or spending. If you enter a fee it is taken from the source account on top of the amount and counts as spending.')}</p>
    <div class="actions">${editGid ? `<button type="button" class="btn danger" data-act="delete-transfer" data-id="${editGid}">${__('Delete')}</button>` : ''}<button class="btn" type="submit">${editGid ? __('Save') : __('Transfer')}</button></div></form>`);
  const f = $('#dlg form'); if (cur0 && cur0.sent !== cur0.received) f.received.dataset.touched = '1';
  syncTransfer(f);
}
/* keep labels in the right currency; when the two ends differ in currency, show and prefill the received amount */
function syncTransfer(form) {
  const A = xferEnd(form.from.value), B = xferEnd(form.to.value); if (!A || !B) return;
  const cross = A.ccy !== B.ccy;
  $('[data-send-label]', form).textContent = __('Amount sent ({cur})', { cur: A.ccy });
  $('[data-fee-label]', form).textContent = __('Transfer fee, optional ({cur})', { cur: A.ccy });
  $('[data-recv]', form).hidden = !cross;
  if (form.repeat) { const lab = form.repeat.closest('label'); lab.hidden = A.kind === 'h' || B.kind === 'h'; if (lab.hidden) form.repeat.value = ''; }
  if (cross) {
    $('[data-recv-label]', form).textContent = __('Amount received ({cur}) · estimated, edit if different', { cur: B.ccy });
    const a = parseFloat(form.amount.value);
    if (!form.received.dataset.touched) form.received.value = a > 0 ? toMajor(convert(toMinor(a, A.ccy), A.ccy, B.ccy), B.ccy).toFixed(expOf(B.ccy)) : '';
  }
}
/* write a transfer between two ends (amounts in minor units of each end's currency). editGid: replace that transfer. Returns { error } or { ok: true }; changes nothing on an error. */
function saveTransfer({ from, to, amount, received, fee, date, note, editGid, repeat }) {
  let snap = null;
  if (editGid) { snap = JSON.stringify({ t: D().transactions, h: D().holdings }); if (!removeTransferGroup(editGid)) return { error: __("Can't change: the cash has already been spent") }; }   // put the old transfer back first (restores the Cash balance), so the checks see the right numbers
  const fail = (msg) => { if (snap) { const o = JSON.parse(snap); D().transactions = o.t; D().holdings = o.h; } return { error: msg }; };
  const A = xferEnd(from), B = xferEnd(to);
  if (A.kind === 'w' && A.w.type !== 'card' && amount + fee > A.bal) return fail(__("{name} doesn't have enough balance", { name: A.name }));
  if (A.kind === 'h' && toMinor(heldNow(A.h), A.ccy) < amount + fee) return fail(__("{name} doesn't have enough balance", { name: A.name }));
  const gid = editGid || uid(), base = { category_id: null, category_source: 'user', ai_confidence: null, occurred_at: date, transfer_id: gid }, extra = note ? ` · ${note}` : '';
  const noteTo = __('Transfer to {name}', { name: B.name }) + extra, noteFrom = __('Transfer from {name}', { name: A.name }) + extra;
  const cashEvent = (h, side, quantity, wallet, walletMinor, wcur) => { const tid = uid(); h.quantity = r12(h.quantity + (side === 'buy' ? quantity : -quantity)); h.trades.push({ id: tid, date, side, quantity, amount_minor: walletMinor, currency: wcur, wallet_id: wallet.id }); if (side === 'buy' && date.slice(0, 7) < h.since) h.since = date.slice(0, 7); return tid; };
  if (A.kind === 'w' && B.kind === 'w') {
    D().transactions.push({ id: uid(), wallet_id: A.w.id, type: 'transfer', flow: 'out', amount_minor: amount, currency: A.ccy, note: noteTo, ...base });
    D().transactions.push({ id: uid(), wallet_id: B.w.id, type: 'transfer', flow: 'in', amount_minor: received, currency: B.ccy, note: noteFrom, ...base });
  } else if (A.kind === 'w') {   // a deposit into an investment Cash balance: the account's leg is tied to the cash event
    const tid = cashEvent(B.h, 'buy', toMajor(received, B.ccy), A.w, amount, A.ccy);
    D().transactions.push({ id: uid(), wallet_id: A.w.id, type: 'transfer', flow: 'out', amount_minor: amount, currency: A.ccy, note: noteTo, trade_id: tid, ...base });
  } else {   // a withdrawal from an investment Cash balance into an account
    const tid = cashEvent(A.h, 'sell', toMajor(amount, A.ccy), B.w, received, B.ccy);
    D().transactions.push({ id: uid(), wallet_id: B.w.id, type: 'transfer', flow: 'in', amount_minor: received, currency: B.ccy, note: noteFrom, trade_id: tid, ...base });
  }
  if (fee > 0) {
    const feeNote = __('Transfer fee ({from} → {to})', { from: A.name, to: B.name });
    if (A.kind === 'w') D().transactions.push({ id: uid(), wallet_id: A.w.id, type: 'expense', amount_minor: fee, currency: A.ccy, note: feeNote, ...base, category_id: feeCategory().id });
    else {   // the fee of a withdrawal comes out of the Cash balance itself: its own event, and an expense in Fee with no account
      const ftid = uid(); A.h.quantity = r12(A.h.quantity - toMajor(fee, A.ccy)); A.h.trades.push({ id: ftid, date, side: 'sell', kind: 'expense', quantity: toMajor(fee, A.ccy), amount_minor: fee, currency: A.ccy, wallet_id: null });
      D().transactions.push({ id: detId('fee', ftid), wallet_id: null, trade_id: ftid, type: 'expense', amount_minor: fee, currency: A.ccy, note: feeNote, ...base, category_id: feeCategory().id });
    }
  }
  if (repeat && A.kind === 'w' && B.kind === 'w') addRule('transfer', repeat, date, { from: A.w.id, to: B.w.id, amount_minor: amount, received_minor: received, fee_minor: fee, note });
  sortTxns();
  state.ui.month = periodKeyOf(date) <= currentPeriod() ? periodKeyOf(date) : state.ui.month;
  return { ok: true };
}
/* details of a stablecoin / crypto move between investment accounts: what was sent, the network fee, what arrived, with Delete */
function coinTransferDialog(gid) {
  const ev = coinEv(gid), at = (id) => { for (const h of D().holdings) { const tr = h.trades.find((x) => x.id === id); if (tr) return { h, tr }; } return null; };
  const o = at(ev.out), f = at(ev.fee), i = at(ev.inn); if (!o || !i) return;
  const sym = assetInfo(o.h.symbol).symbol, fee = f ? f.tr.quantity : 0, row = (l, v) => `<div class="hs-row"><span>${l}</span><b class="num">${v}</b></div>`;
  open(`<h2>${esc(accountName(o.h.account_id))} → ${esc(accountName(i.h.account_id))}</h2>
    <div class="hold-sum">${row(__('Asset'), esc(assetInfo(o.h.symbol).name))}${row(__('Sent'), `${qtyFmt(r12(o.tr.quantity + fee))} ${esc(sym)}`)}${row(__('Network fee'), `${qtyFmt(fee)} ${esc(sym)}`)}${row(__('Received'), `${qtyFmt(i.tr.quantity)} ${esc(sym)}`)}${row(__('Date'), esc(new Date(o.tr.date + 'T00:00').toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' })))}</div>
    <p class="hint">${__('The fee counts as spending (category Fee); the move itself does not. To change it, delete it and record it again.')}</p>
    <div class="actions"><button type="button" class="btn danger" data-act="delete-coin-transfer" data-id="${gid}">${__('Delete')}</button></div>`);
}
/* take a saved transfer apart: restore the Cash balance it moved and remove its legs and fee; false when that cash was already spent */
function removeTransferGroup(gid) {
  const legs = D().transactions.filter((t) => t.transfer_id === gid), undo = new Map();
  legs.forEach((l) => { if (!l.trade_id) return; const h = D().holdings.find((x) => x.trades.some((y) => y.id === l.trade_id)); if (!h) return; const tr = h.trades.find((y) => y.id === l.trade_id); undo.set(tr.id, { h, tr }); });
  const after = new Map(); undo.forEach(({ h, tr }) => after.set(h, (after.has(h) ? after.get(h) : h.quantity) - tradeSign(tr) * tr.quantity));
  for (const [, q] of after) if (q < -1e-9) return false;
  undo.forEach(({ h, tr }) => { h.quantity = r12(Math.max(0, h.quantity - tradeSign(tr) * tr.quantity)); h.trades = h.trades.filter((y) => y.id !== tr.id); });
  D().transactions = D().transactions.filter((t) => t.transfer_id !== gid);
  return true;
}
/* USDT/USDC in an investment account can receive income and pay expenses directly: the coins move as a trade
   linked to an income/expense transaction (no wallet; 1 coin = 1 USD, amounts stored in USD cents). */
/* the profit or loss of a sale paid into an investment account's own cash (no bank account): no wallet, tied to the sale */
const isSaleRecord = (t) => !!t && !t.wallet_id && !!t.trade_id && (t.id === detId('pnl', t.trade_id) || t.id === detId('fee', t.trade_id));
const coinOf = (t) => (t && !t.wallet_id && t.trade_id && !isSaleRecord(t) ? D().holdings.find((h) => h.trades.some((x) => x.id === t.trade_id)) : null);
const txnWhere = (t) => { const w = walletOf(t.wallet_id); if (w) return w.name; if (t.loan_id) return D().loans.find((l) => l.id === t.loan_id)?.name || '';  if (isSaleRecord(t)) { const sh = D().holdings.find((x) => x.trades.some((y) => y.id === t.trade_id)); return sh ? accountName(sh.account_id) : ''; }
  const h = coinOf(t); return h ? coinLabel(h) : ''; };
/* an investment account holding stablecoins: just the account name; the coin is added only when the account holds more than one stablecoin */
const coinLabel = (h) => accountName(h.account_id) + (D().holdings.filter((x) => x.account_id === h.account_id && assetInfo(x.symbol).type === 'stablecoin').length > 1 ? ` (${assetInfo(h.symbol).symbol})` : '');
/* an amount paid or received in a stablecoin is written with the coin, not a dollar sign: "USDT 5,584.00" */
const coinAmount = (h, minor) => `${h ? assetInfo(h.symbol).symbol : 'USDT'} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100)}`;
const coinOption = (h, sel) => `<option value="h:${h.id}" ${sel ? 'selected' : ''}>${esc(coinLabel(h))}</option>`;
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
/* the account used last, kept per kind (expense, income, invest) on this device, and offered first the next time */
const ACCT_KEY = 'stiver.lastacct.v1';
function rememberAcct(kind, value) {
  if (state.real || !value) return;   // sample data never writes it
  try { const m = JSON.parse(localStorage.getItem(ACCT_KEY) || '{}'); m[kind] = value; localStorage.setItem(ACCT_KEY, JSON.stringify(m)); } catch { /* storage unavailable */ }
}
/* with nothing remembered on this device (first use, another phone, records added before this existed) the account of the latest matching record is used */
function latestAcct(kind) {
  const today = todayIso(), list = D().transactions;   // newest first
  if (kind === 'expense' || kind === 'income') { const t = list.find((x) => x.type === kind && x.occurred_at <= today && (x.wallet_id || coinOf(x))); return t ? (t.wallet_id || 'h:' + coinOf(t).id) : ''; }
  const t = list.find((x) => x.type === 'transfer' && x.trade_id && x.flow === 'out' && x.occurred_at <= today);
  if (!t) return '';
  if (kind === 'invest') return 'w:' + t.wallet_id;
  const h = D().holdings.find((x) => x.trades.some((tr) => tr.id === t.trade_id)); return h ? h.account_id : '';
}
function recallAcct(kind, optionsHtml) {   // only a value that is still one of the options (not archived or removed)
  const ok = (v) => v && optionsHtml.includes(`value="${v}"`);
  try { const v = (JSON.parse(localStorage.getItem(ACCT_KEY) || '{}'))[kind]; if (ok(v)) return v; } catch { /* storage unavailable */ }
  const d = latestAcct(kind); return ok(d) ? d : '';
}
function acctOptions(type, selected, noNew) {
  const ws = D().wallets.filter((w) => !w.archived), coins = stableHoldings(), accts = activeAccounts();
  const fresh = type === 'income' && !noNew ? ['USDT', 'USDC'].flatMap((sym) => (accts.length ? accts : [{ id: '', name: '' }]).filter((a) => !D().holdings.some((h) => h.account_id === a.id && h.symbol === sym)).map((a) => ({ sym, a }))) : [];
  const sel = (v) => (v === selected ? 'selected' : '');
  const loans = type === 'expense' ? activeLoans() : [];   // a loan account can pay for expenses; what is paid raises the loan
  return (ws.length ? `<optgroup label="${__('Savings Account')}">${ws.map((w) => `<option value="${w.id}" data-s="${esc(w.name)}" ${sel(w.id)}>${esc(w.name)} (${esc(w.currency)})</option>`).join('')}</optgroup>` : '')
    + (coins.length || fresh.length ? `<optgroup label="${__('Investment Account')}">${coins.map((h) => `<option value="h:${h.id}" data-s="${esc(coinLabel(h))}" ${sel('h:' + h.id)}>${esc(coinLabel(h))}</option>`).join('')}${fresh.map(({ sym, a }) => `<option value="n:${sym}:${a.id}" ${sel('n:' + sym + ':' + a.id)}>${a.name ? esc(a.name) : __('Crypto')} (${sym})</option>`).join('')}</optgroup>` : '')
    + (loans.length ? `<optgroup label="${__('Debt Account')}">${loans.map((l) => `<option value="l:${l.id}" data-s="${esc(l.name)}" ${sel('l:' + l.id)}>${esc(l.name)} (${esc(l.currency)})</option>`).join('')}</optgroup>` : '');
}
/* the amount's unit and step follow the chosen account */
function syncTxnUnit(form) {
  const v = form.wallet.value, coin = v.startsWith('h:') ? D().holdings.find((x) => x.id === v.slice(2)) : null, sym = coin ? assetInfo(coin.symbol).symbol : v.startsWith('n:') ? v.split(':')[1] : null;
  const unit = sym || walletOf(v)?.currency || D().loans.find((l) => 'l:' + l.id === v)?.currency || cur();
  $('[data-amt-label]', form).textContent = __('Amount ({cur})', { cur: unit }); $('input[name=amount]', form).step = sym ? 'any' : expOf(unit) ? '0.01' : '1';
}
function txnDialog(t, presetType, presetOccasion, presetDate) {
  const type = t?.type || presetType || 'expense', ws = D().wallets.filter((w) => !w.archived);
  const live = D().occasions.filter((o) => !o.archived || o.id === t?.occasion_id), occ0 = t ? t.occasion_id : presetOccasion?.id;   // a new expense starts with no special occasion (only the occasion's own + Expense button presets it); nothing is remembered from the last time
  const date0 = t?.occurred_at || presetDate || (presetOccasion?.start && presetOccasion.start > isoDate(new Date()) ? presetOccasion.start : isoDate(new Date()));
  // the amount is entered in the chosen wallet's currency
  const tcoin = coinOf(t);
  const c = t ? t.currency : (ws.find((w) => w.currency === cur()) || ws[0]).currency, step = tcoin ? 'any' : expOf(c) ? '0.01' : '1';
  const unit = tcoin ? assetInfo(tcoin.symbol).symbol : c;
  open(`<h2>${t ? __('Edit transaction') : __('Add transaction')}</h2>${t && hhMulti() && t.by ? `<p class="muted hh-who-line">${whoLine(t)}</p>` : ''}
  <form data-form="txn" data-id="${t?.id || ''}" style="display:contents">
    <div class="seg ${t ? '' : 'seg4'}"><label><input type="radio" name="type" value="expense" ${type === 'expense' ? 'checked' : ''}>${__('Expense')}</label><label><input type="radio" name="type" value="income" ${type === 'income' ? 'checked' : ''}>${__('Income')}</label>${t ? '' : ('<label><input type="radio" name="type" value="invest">' + __('Invest') + '</label><label><input type="radio" name="type" value="transfer">' + __('Transfer') + '</label>')}</div>
    <label class="field">${__('Account')}<select name="wallet"${tcoin ? '' : searchAttr(acctOptions(type, ''), 'Account not found')}>${tcoin ? coinOption(tcoin, true) : acctOptions(type, t ? (t.loan_id ? 'l:' + t.loan_id : t.wallet_id) : (recallAcct(type, acctOptions(type, '')) || (ws.find((w) => w.currency === cur()) || ws[0]).id))}</select></label>
    <div class="two"><label class="field"><span data-amt-label>${__('Amount ({cur})', { cur: esc(unit) })}</span><input name="amount" type="number" inputmode="decimal" min="0" step="${step}" required value="${tcoin ? tcoin.trades.find((x) => x.id === t.trade_id).quantity : t ? toMajor(t.amount_minor, c) : ''}"></label>
      <label class="field">${__('Date')}<input name="date" type="date" required value="${date0}"></label></div>
    <label class="field">${__('Category')}<select name="category" data-search data-empty="${__('Category not found')}" data-prev="${t?.category_id || ''}">${catOptions(type, t?.category_id, true)}</select></label>
    <div class="quick-cat" hidden>
      <div class="two"><label class="field">${__('Name')}<input name="qc_name" maxlength="40" placeholder="${__('e.g. Gym, or Snacks')}" autocomplete="off"></label>
        ${iconField('qc_icon', __('Icon'), '🏷️')}</div>${iconPicks('qc_icon', '🏷️')}
      <label class="field">${__('Inside')}<select name="qc_parent">${quickParentOptions(type)}</select></label>
      <div class="actions"><button type="button" class="btn secondary" data-act="quick-cat-cancel">${__('Cancel')}</button><button type="button" class="btn" data-act="quick-cat-add">${__('Add category')}</button></div></div>
    ${live.length ? `<label class="field">${__('🎉 Special occasion (optional)')}<select name="occasion"${live.length > SEARCH_OVER ? ` data-search data-empty="${__('Occasion not found')}"` : ''}><option value="">${__('None')}</option>${live.map((o) => `<option value="${o.id}" ${o.id === occ0 ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>` : ''}
    <label class="field">${__('Note')}<textarea name="note" maxlength="140" placeholder="${__('e.g. Coffee shop')}">${esc(t?.note || '')}</textarea></label>
    ${t ? '' : repeatField()}
    <div class="actions">${t ? '<button type="button" class="btn danger" data-act="delete-txn" data-id="' + t.id + ('">' + __('Delete') + '</button>') : ''}<button class="btn" type="submit">${__('Save')}</button></div></form>`);
}
/* the "Applies to" list of a new budget: all spending, each top-level expense category, and "Add new category" (opens the inline form) */
const budgetCatOptions = (selected, used, withNew = true) => [{ id: '', name: '💰 ' + __('All spending (global)') }, ...catTree('expense').filter((c) => !c.parent_id).map((c) => ({ id: c.id, name: `${c.icon} ${c.name}` }))]
  .map((o) => `<option value="${o.id}" ${o.id === selected ? 'selected' : ''}>${esc(o.name)}${used.has(o.id || null) ? ' ' + __('(replace)') : ''}</option>`).join('') + (withNew ? `<option value="__new" data-cta>＋ ${__('Add new category')}</option>` : '');
function budgetDialog(b, preset) {
  const used = new Set(D().budgets.map((x) => x.category_id));
  const opts = [{ id: '', name: '' }, ...catTree('expense').filter((c) => !c.parent_id).map((c) => ({ id: c.id }))];
  const pick = !b && preset === 'category' ? (opts.find((o) => o.id && !used.has(o.id)) || { id: '' }).id : '';   // the "By category" Add button starts on a category without a budget yet
  open(`<h2>${b ? __('Edit budget') : __('Add budget')}</h2>${b && hhMulti() && b.by ? `<p class="muted hh-who-line">${whoLine(b)}</p>` : ''}<form data-form="budget" data-id="${b?.id || ''}" style="display:contents">
    <label class="field">${__('Applies to')}<select name="category" data-search data-empty="${__('Category not found')}" data-prev="${b ? b.category_id || '' : pick}" ${b ? 'disabled' : ''}>${b ? budgetCatOptions(b.category_id || '', new Set(), false) : budgetCatOptions(pick, used)}</select></label>
    ${b ? '' : `<div class="quick-cat" hidden>
      <div class="two"><label class="field">${__('Name')}<input name="qc_name" maxlength="40" placeholder="${__('e.g. Gym, or Snacks')}" autocomplete="off"></label>
        ${iconField('qc_icon', __('Icon'), '🏷️')}</div>${iconPicks('qc_icon', '🏷️')}
      <div class="actions"><button type="button" class="btn secondary" data-act="quick-cat-cancel">${__('Cancel')}</button><button type="button" class="btn" data-act="quick-cat-add">${__('Add category')}</button></div></div>`}
    <label class="field">${__('Monthly limit ({cur})', { cur: esc(cur()) })}<input name="amount" type="number" inputmode="decimal" min="1" step="${expOf(cur()) ? '0.01' : '1'}" required value="${b ? toMajor(b.budget, cur()) : ''}"></label>
    <p class="hint">${__('Applies from {month} onward until you set a new amount.', { month: esc(monthLabel(state.ui.month)) })}</p>
    <div class="actions">${b ? `<button type="button" class="btn danger" data-act="delete-budget" data-id="${b.id}">${__('Delete')}</button>` : ''}<button class="btn" type="submit">${__('Save')}</button></div></form>`);
}
/* a special occasion groups expenses (a trip, a birthday dinner). The budget is optional: leave it empty to only tag spending.
   From Budgets (fromBudget) the user adds a budget to a pre-added occasion (picked from a list) or to a new one. */
function occasionDialog(o, fromBudget) {
  const cands = fromBudget && !o ? D().occasions.filter((x) => !x.archived) : [], free = cands.filter((x) => !(x.amount_minor > 0)), taken = cands.filter((x) => x.amount_minor > 0);   // every occasion is listed; the ones that already have a budget are greyed out
  const title = o ? __('Edit special occasion') : fromBudget ? __('Add occasion budget') : __('New special occasion');
  const pick = cands.length ? `<label class="field">${__('Occasion')}<select name="pick" data-occ-pick>${free.map((x, i) => `<option value="${x.id}" data-ccy="${x.currency}" ${i === 0 ? 'selected' : ''}>🎉 ${esc(x.name)}</option>`).join('')}${taken.map((x) => `<option value="${x.id}" data-ccy="${x.currency}" data-tag="${__('Budget Added')}" disabled>🎉 ${esc(x.name)}</option>`).join('')}<option value="__new" data-ccy="" ${free.length ? '' : 'selected'}>${__('+ New occasion')}</option></select></label>` : '';
  open(`<h2>${title}</h2><form data-form="occasion" data-id="${o?.id || ''}" data-from-budget="${fromBudget ? 1 : ''}" style="display:contents">
    ${pick}
    <div class="occ-new"><label class="field">${__('Name')}<input name="name" maxlength="40" value="${esc(o?.name || '')}" placeholder="${__('e.g. Bali Trip, Birthday Dinner')}"></label></div>
    <div class="two">${o ? '' : `<label class="field occ-new">${__('Currency')}<select name="currency">${Object.keys(RATES).map((c) => `<option ${c === cur() ? 'selected' : ''} data-list="${flagLabel(c)}">${c}</option>`).join('')}</select></label>`}
      <label class="field"><span data-occ-amt>${o ? __('Budget ({cur})', { cur: esc(o.currency) }) + (fromBudget ? '' : ' · ' + __('optional')) : fromBudget ? __('Budget') : __('Budget (optional)')}</span><input name="amount" type="number" inputmode="decimal" min="1" step="any" ${fromBudget ? 'required' : ''} value="${o && o.amount_minor > 0 ? toMajor(o.amount_minor, o.currency) : ''}"></label></div>
    <div class="two occ-new"><label class="field">${__('Starts (optional)')}<input name="start" type="date" value="${esc(o?.start || '')}"></label>
      <label class="field">${__('Ends (optional)')}<input name="end" type="date" value="${esc(o?.end || '')}"></label></div>
    <p class="hint">${o || !fromBudget ? __('Without a budget the occasion only groups the expenses you tag to it. Expenses tagged to it still count in your monthly budgets.') : __('Expenses you tag to this occasion still count in your monthly budgets. This budget is an extra view of what the occasion costs.')}</p>
    <div class="actions">${o ? `<button type="button" class="btn danger" data-act="delete-occasion" data-id="${o.id}">${__('Delete')}</button><button type="button" class="btn secondary" data-act="archive-occasion" data-id="${o.id}">${o.archived ? __('Reopen') : __('Archive')}</button>` : ''}<button class="btn" type="submit">${__('Save')}</button></div></form>`);
  const f = $('#dlg form'); if (f) syncOccPick(f);
}
/* when an existing occasion is picked its name, dates and currency are fixed: only the budget is asked */
function syncOccPick(form) {
  const sel = form.elements.pick; if (!sel) return;
  const isNew = sel.value === '__new', ccy = sel.selectedOptions[0]?.dataset.ccy || '';
  $$('.occ-new', form).forEach((e) => { e.hidden = !isNew; });
  const lab = $('[data-occ-amt]', form); if (lab) lab.textContent = isNew ? __('Budget') : __('Budget ({cur})', { cur: ccy });
}
/* Settings > Special occasions: the active occasions, with or without a budget (the ones with a budget also show on Budgets).
   Archived ones are not listed here: the Archived button opens them in a pop-up (Edit there reopens or deletes one). */
const occasionSettingsRow = (o) => {
  const fmt = (d) => new Date(d + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' });
  const dates = [o.start, o.end].filter(Boolean).map(fmt).join(' – '), bits = [dates, o.hasBudget ? __('Budget {amount}', { amount: money(o.amount_minor, o.currency) }) : __('No budget'), countLabel(o.count)].filter(Boolean);
  return `<div class="brow cat-row"><span class="tile" style="--c:#EC4899">🎉</span><div class="cat-main"><b class="cat-name">${esc(o.name)}</b><small class="muted">${esc(bits.join(' · '))}</small></div>
    <div class="tools"><button class="btn secondary" data-act="edit-occasion" data-id="${o.id}">${__('Edit')}</button></div></div>`;
};
function occasionsCard() {
  const list = occasionStatus().filter((o) => !o.archived).sort((a, b) => (b.start || '').localeCompare(a.start || '') || a.name.localeCompare(b.name));
  return `<section class="card" id="occasions-card"><div class="card-head"><h2>${__('Special occasions')}</h2><div class="tools"><button class="chip" data-act="occasion-archived">${__('Archived')}</button><button class="btn" data-act="add-occasion">${__('+ Add')}</button></div></div>
    ${list.length ? list.map(occasionSettingsRow).join('') : ('<div class="empty">' + __('No special occasions yet. Add one (a trip, a birthday dinner) to tag expenses to it, with or without a budget.') + '</div>')}</section>`;
}
function archivedOccasionsDialog() {
  const list = occasionStatus().filter((o) => o.archived).sort((a, b) => (b.end || b.start || '').localeCompare(a.end || a.start || '') || a.name.localeCompare(b.name));
  open(`<h2>${__('Archived special occasions')}</h2>
  <div class="list up-list">${list.map(occasionSettingsRow).join('') || ('<div class="empty">' + __('No archived special occasions.') + '</div>')}</div>
  <div class="actions"><button type="button" class="btn" data-act="close">${__('Close')}</button></div>`);
}
/* archived categories: a category archived with its sub-categories comes back with them; a sub-category archived on its own comes back on its own */
function archivedCatsDialog() {
  const list = D().categories.filter((c) => c.archived && (!c.parent_id || !catOf(c.parent_id)?.archived))
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'expense' ? -1 : 1) || a.name.localeCompare(b.name));
  const row = (c) => {
    const p = c.parent_id ? catOf(c.parent_id) : null, kids = D().categories.filter((k) => k.parent_id === c.id && k.archived).length;
    const sub = [c.type === 'expense' ? __('Expense') : __('Income'), p ? __('in {name}', { name: esc(p.name) }) : '', kids ? __(kids === 1 ? '{n} sub-category' : '{n} sub-categories', { n: kids }) : ''].filter(Boolean).join(' · ');
    return `<div class="brow cat-row">${tile(c, !!p)}<div class="cat-main"><b class="cat-name">${esc(c.name)}</b><small class="muted">${sub}</small></div>
      <div class="tools"><button class="btn secondary" data-act="restore-cat" data-id="${c.id}">${__('Restore')}</button></div></div>`;
  };
  open(`<h2>${__('Archived categories')}</h2>
  <div class="list up-list">${list.map(row).join('') || ('<div class="empty">' + __('No archived categories.') + '</div>')}</div>
  <div class="actions"><button type="button" class="btn" data-act="close">${__('Close')}</button></div>`);
}
const SWATCHES = ['#4A44C6', '#8B8FF0', '#F5B800', '#EC4899', '#14B8A6', '#F97316', '#EF4444', '#0EA5E9', '#22C55E', '#94A3B8'];
function catDialog(c, parentId) {
  const parent = catOf(c ? c.parent_id : parentId) || null;
  const hasKids = c && childrenOf(c.id).length > 0;
  const tops = D().categories.filter((x) => !x.parent_id && !x.archived && (!c || x.id !== c.id));
  open(`<h2>${c ? (parent ? __('Edit sub-category') : __('Edit category')) : (parent ? __('New sub-category') : __('New category'))}</h2>
  <form data-form="cat" data-id="${c?.id || ''}" style="display:contents">
    <label class="field">${__('Name')}<input name="name" required maxlength="30" value="${esc(c?.name || '')}" placeholder="${__('e.g. Pets')}"></label>
    <div class="two">${iconField('icon', __('Icon (emoji)'), c?.icon || '🏷️')}
      <label class="field">${__('Color')}<input name="color" type="color" value="${esc(c?.color || parent?.color || SWATCHES[0])}"></label></div>${iconPicks('icon', c?.icon || '🏷️')}
    <label class="field">${__('Parent category')}<select name="parent" ${hasKids ? 'disabled' : ''}><option value="">${__('None (top-level)')}</option>${tops.map((x) => `<option value="${x.id}" ${parent && x.id === parent.id ? 'selected' : ''}>${x.icon} ${esc(x.name)}</option>`).join('')}</select></label>
    <label class="field">${__('Type')}<select name="type" ${parent || c ? 'disabled' : ''}><option value="expense" ${c?.type === 'expense' || !c ? 'selected' : ''}>${__('Expense')}</option><option value="income" ${c?.type === 'income' ? 'selected' : ''}>${__('Income')}</option></select></label>
    <p class="hint">${hasKids ? __('This category has sub-categories, so it stays top-level.') : __('Sub-categories show up in the spending breakdown and roll up into their parent.')}</p>
    <div class="actions">${c ? `<button type="button" class="btn danger" data-act="archive-cat" data-id="${c.id}">${__('Archive')}</button>` : ''}<button class="btn" type="submit">${__('Save')}</button></div></form>`);
}

/* month breakdown: parent categories, each expandable to its sub-categories */
function breakdownDialog(selId) {
  const k = state.ui.month, tree = spendTree(k), total = tree.reduce((a, n) => a + n.value, 0), c$ = cur();
  const bar = (v, of, color) => `<div class="bar"><i style="width:${of ? Math.round((v / of) * 100) : 0}%;background:${color}"></i></div>`;
  const row = (n) => {
    const has = n.subs.length > 0, pct = total ? Math.round((n.value / total) * 100) : 0;
    const head = `<span class="bk-name">${tile({ icon: n.icon, color: n.color }, true)}<b>${esc(n.name)}</b></span><span class="bk-amt num">${money(n.value, c$)} <small class="muted">${pct}%</small></span>`;
    if (!has) return `<div class="bk-item"><div class="bk-sum nochev">${head}</div>${bar(n.value, total, n.color)}</div>`;
    return `<details class="bk-item" ${String(n.id) === selId ? 'open' : ''}><summary class="bk-sum">${head}</summary>${bar(n.value, total, n.color)}
      <div class="bk-subs">${n.subs.map((s) => `<div class="bk-sub"><span>${s.icon} ${esc(s.name)}</span><span class="num">${money(s.value, c$)} <small class="muted">${Math.round((s.value / n.value) * 100)}%</small></span></div>${bar(s.value, n.value, n.color)}`).join('')}
        ${n.direct ? `<div class="bk-sub"><span class="muted">${__('Not in a sub-category')}</span><span class="num">${money(n.direct, c$)}</span></div>` : ''}</div></details>`;
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
      : `<label class="field">${__('Currency')}<select name="currency">${Object.keys(RATES).map((x) => `<option ${x === cur() ? 'selected' : ''} data-list="${flagLabel(x)}">${x}</option>`).join('')}</select></label>`}</div>
    <label class="field">${w ? __('Current balance ({cur})', { cur: esc(w.currency) }) : __('Opening balance')}<input name="${w ? 'balance' : 'opening'}" type="number" inputmode="decimal" step="any" required value="${w ? toMajor(walletBalance(w), w.currency) : 0}"></label>
    <p class="hint">${w ? __("Changing the balance adjusts this account's starting amount, so your past transactions stay exactly as they are. The currency can't be changed because existing transactions use it.") : __('Pick any currency, for example USD for savings. Totals convert to your reporting currency ({cur}).', { cur: esc(cur()) })}</p>
    <div class="actions">${w ? `<button type="button" class="btn danger" data-act="archive-wallet" data-id="${w.id}">${__('Archive')}</button>` : ''}<button class="btn" type="submit">${w ? __('Save') : __('Add')}</button></div></form>`);
}

