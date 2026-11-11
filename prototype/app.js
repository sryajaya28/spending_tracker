'use strict';
/* Stiver app: views, dialogs, events, auth and boot. The first part of the former app.js now lives in prototype/app/ (see docs/MAP.md). */
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
  const opt = (v, sel) => { const e = xferEnd(v); return `<option value="${v}" ${v === sel ? 'selected' : ''}>${esc(e.name)} (${esc(e.ccy)}) · ${money(e.bal, e.ccy)}</option>`; };
  const group = (sel) => `<optgroup label="${__('Accounts')}">${ws.map((w) => opt('w:' + w.id, sel)).join('')}</optgroup>${cashes.length ? `<optgroup label="${__('Investment cash')}">${cashes.map((h) => opt('h:' + h.id, sel)).join('')}</optgroup>` : ''}`;
  open(`<h2>${editGid ? __('Edit transfer') : __('Transfer between accounts')}</h2><form data-form="transfer" data-gid="${editGid || ''}" style="display:contents">
    ${editGid ? '' : kindSeg('transfer')}
    <label class="field">${__('From')}<select name="from">${group(from)}</select></label>
    <label class="field">${__('To')}<select name="to">${group(to)}</select></label>
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
  return (ws.length ? `<optgroup label="${__('Savings Account')}">${ws.map((w) => `<option value="${w.id}" ${sel(w.id)}>${esc(w.name)} (${esc(w.currency)})</option>`).join('')}</optgroup>` : '')
    + (coins.length || fresh.length ? `<optgroup label="${__('Investment Account')}">${coins.map((h) => `<option value="h:${h.id}" ${sel('h:' + h.id)}>${esc(coinLabel(h))}</option>`).join('')}${fresh.map(({ sym, a }) => `<option value="n:${sym}:${a.id}" ${sel('n:' + sym + ':' + a.id)}>${a.name ? esc(a.name) : __('Crypto')} (${sym})</option>`).join('')}</optgroup>` : '')
    + (loans.length ? `<optgroup label="${__('Debt Account')}">${loans.map((l) => `<option value="l:${l.id}" ${sel('l:' + l.id)}>${esc(l.name)} (${esc(l.currency)})</option>`).join('')}</optgroup>` : '');
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
    <label class="field">${__('Account')}<select name="wallet">${tcoin ? coinOption(tcoin, true) : acctOptions(type, t ? (t.loan_id ? 'l:' + t.loan_id : t.wallet_id) : (recallAcct(type, acctOptions(type, '')) || (ws.find((w) => w.currency === cur()) || ws[0]).id))}</select></label>
    <div class="two"><label class="field"><span data-amt-label>${__('Amount ({cur})', { cur: esc(unit) })}</span><input name="amount" type="number" inputmode="decimal" min="0" step="${step}" required value="${tcoin ? tcoin.trades.find((x) => x.id === t.trade_id).quantity : t ? toMajor(t.amount_minor, c) : ''}"></label>
      <label class="field">${__('Date')}<input name="date" type="date" required value="${date0}"></label></div>
    <label class="field">${__('Category')}<select name="category" data-search data-empty="${__('Category not found')}" data-prev="${t?.category_id || ''}">${catOptions(type, t?.category_id, true)}</select></label>
    <div class="quick-cat" hidden>
      <div class="two"><label class="field">${__('Name')}<input name="qc_name" maxlength="40" placeholder="${__('e.g. Gym, or Snacks')}" autocomplete="off"></label>
        ${iconField('qc_icon', __('Icon'), '🏷️')}</div>${iconPicks('qc_icon', '🏷️')}
      <label class="field">${__('Inside')}<select name="qc_parent">${quickParentOptions(type)}</select></label>
      <div class="actions"><button type="button" class="btn secondary" data-act="quick-cat-cancel">${__('Cancel')}</button><button type="button" class="btn" data-act="quick-cat-add">${__('Add category')}</button></div></div>
    ${live.length ? `<label class="field">${__('🎉 Special occasion (optional)')}<select name="occasion"><option value="">${__('None')}</option>${live.map((o) => `<option value="${o.id}" ${o.id === occ0 ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>` : ''}
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
    ${row(info.cash ? __('Balance') : __('You hold'), `${qtyFmt(qty, h)} ${esc(info.symbol)}`)}${info.cash ? '' : row(__('Current price'), money(usdToMinor(price, vc), vc))}${row(__('Total value'), money(usdToMinor(value, vc), vc))}${costRows(h, vc, row)}${row(__('Share of account'), `${accTotal ? Math.round((value / accTotal) * 100) : 0}%`)}</div>`;
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
      <label class="field">${__('Move to account')}<select name="account">${accounts.map((a) => `<option value="${a.id}" ${a.id === (h?.account_id || accId) ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>` : `
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
  // a first payment dated later is already on the books as an Upcoming entry: the next payment is that date, and the rule skips creating it again
  if (start > isoDate(new Date())) { r.next = start; r.spec = { ...spec, first_made: start }; } else r.next = nextAfter(r, start);
  (D().recurring = D().recurring || []).push(r);
  return r;
}
/* a repeating debt payment falls due: the loan's payment (and, when an account was chosen, the Debt Payment expense on it). Nothing when the debt is paid off or archived. */
function debtPaymentDue(r, date) {
  const sp = r.spec, l = D().loans.find((x) => x.id === sp.debt); if (!l || l.archived) return;
  const acct = sp.wallet_id ? walletOf(sp.wallet_id) : null; if (sp.wallet_id && !acct) return;
  const pid = detId(r.id, date, 'p'); if (l.payments.some((p) => p.id === pid)) return;
  const applied = Math.min(sp.amount_minor, loanBalance(l, date)); if (!(applied > 0)) return;
  const pay = { id: pid, date, amount_minor: applied };
  if (acct) {
    const id = detId(r.id, date, 't');
    if (!D().transactions.some((t) => t.id === id)) D().transactions.push({ id, type: 'expense', amount_minor: applied, currency: l.currency, occurred_at: date, wallet_id: acct.id, note: l.name, category_id: loanRepaymentCategory().id, category_source: 'user', ai_confidence: null });
    pay.txn_id = id;
  }
  l.payments.push(pay);
}
function generateRecurring(r, date) {
  const sp = r.spec, T = D().transactions, add = (row) => { if (!T.some((t) => t.id === row.id)) T.push(row); };
  if (r.kind === 'txn' && sp.debt) { debtPaymentDue(r, date); return; }
  if (r.kind === 'txn') {
    if (String(sp.wallet_id).startsWith('h:')) {   // USDT/USDC in an investment account
      const h = D().holdings.find((x) => x.id === sp.wallet_id.slice(2)); if (!h || T.some((t) => t.id === detId(r.id, date, 't'))) return;
      if (sp.type === 'expense' && heldNow(h) < sp.quantity - 1e-12) return;   // not enough coins: skip this one
      recordCoinTxn(h, { type: sp.type, quantity: sp.quantity, date, note: sp.note, category_id: sp.category_id, occasion_id: sp.occasion_id, id: detId(r.id, date, 't'), tradeId: detId(r.id, date, 'e') }); return;
    }
    if (String(sp.wallet_id).startsWith('l:')) {   // paid with a loan account: the expense and the matching charge on the loan
      const l = D().loans.find((x) => x.id === sp.wallet_id.slice(2)); if (!l) return;
      const id = detId(r.id, date, 't'); add({ id, type: 'expense', amount_minor: sp.amount_minor, currency: l.currency, occurred_at: date, wallet_id: null, loan_id: l.id, note: sp.note || '', category_id: sp.category_id || null, category_source: 'user', ai_confidence: null, ...(sp.occasion_id && occasionOf(sp.occasion_id) ? { occasion_id: sp.occasion_id } : {}) });
      if (!l.payments.some((p) => p.txn_id === id)) l.payments.push({ id: detId(r.id, date, 'c'), date, amount_minor: sp.amount_minor, kind: 'charge', txn_id: id });
      return;
    }
    if (!walletOf(sp.wallet_id)) return;
    add({ id: detId(r.id, date, 't'), type: sp.type, amount_minor: sp.amount_minor, currency: sp.currency, occurred_at: date, wallet_id: sp.wallet_id, note: sp.note || '', category_id: sp.category_id || null, category_source: 'user', ai_confidence: null, ...(sp.occasion_id && occasionOf(sp.occasion_id) ? { occasion_id: sp.occasion_id } : {}) });
  } else if (r.kind === 'transfer') {
    const A = walletOf(sp.from), B = walletOf(sp.to); if (!A || !B) return;
    const base = { category_id: null, category_source: 'user', ai_confidence: null, occurred_at: date, transfer_id: detId(r.id, date, 'g') }, extra = sp.note ? ` · ${sp.note}` : '';
    add({ id: detId(r.id, date, 'o'), wallet_id: A.id, type: 'transfer', flow: 'out', amount_minor: sp.amount_minor, currency: A.currency, note: __('Transfer to {name}', { name: B.name }) + extra, ...base });
    add({ id: detId(r.id, date, 'i'), wallet_id: B.id, type: 'transfer', flow: 'in', amount_minor: sp.received_minor, currency: B.currency, note: __('Transfer from {name}', { name: A.name }) + extra, ...base });
    if (sp.fee_minor > 0) add({ id: detId(r.id, date, 'f'), wallet_id: A.id, type: 'expense', amount_minor: sp.fee_minor, currency: A.currency, note: __('Transfer fee ({from} → {to})', { from: A.name, to: B.name }), ...base, category_id: feeCategory().id });
  } else if (r.kind === 'invest') {
    const src = parseSource(sp.fund); if (!src || (src.kind === 'wallet' && !src.wallet) || (src.kind === 'holding' && !src.holding)) return;
    let h = D().holdings.find((x) => x.account_id === sp.account && x.symbol === sp.symbol);
    if (!h) { h = { id: uid(), account_id: sp.account, symbol: sp.symbol, quantity: 0, since: date.slice(0, 7), trades: [] }; D().holdings.push(h); }
    recordTrade(h, { side: 'buy', quantity: sp.quantity, source: src, amount: parseAmount(src, sp.fundamount), date });
  }
}
/* the upcoming entry that stands for a rule's first payment (entered by hand when the rule was created). It is found by its link
   (spec.first_tx) or, for rules made before that link existed, by the same note and type among entries not linked to another rule. */
const plainAccount = (w) => !!w && !String(w).startsWith('h:') && !String(w).startsWith('l:');
function firstEntryOf(r) {
  const sp = r.spec, T = D().transactions, today = isoDate(new Date()); if (r.kind !== 'txn' || sp.debt || !plainAccount(sp.wallet_id)) return null;
  const linked = sp.first_tx && T.find((t) => t.id === sp.first_tx); if (linked) return linked.occurred_at > today ? linked : null;
  const taken = new Set((D().recurring || []).map((x) => x.spec && x.spec.first_tx).filter(Boolean));
  return T.filter((t) => t.occurred_at > today && t.type === sp.type && (t.note || '') === (sp.note || '') && !t.transfer_id && !t.trade_id && !t.loan_id && !taken.has(t.id)).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))[0] || null;
}
/* make that entry say what the rule says (account, amount, category, date) and remember the link */
function syncFirstEntry(r, e) {
  const sp = r.spec; Object.assign(e, { occurred_at: r.next, wallet_id: sp.wallet_id, currency: sp.currency, amount_minor: sp.amount_minor, category_id: sp.category_id || null });
  sp.first_tx = e.id; sp.first_made = r.next;
}
/* rules edited before the entry was linked left their upcoming entry behind (old account, old date): link and update it once */
function linkFirstEntries() {
  const d = state.data, today = isoDate(new Date()); let changed = false;
  (d.recurring || []).forEach((r) => {
    const sp = r.spec; if (r.active === false || r.kind !== 'txn' || !sp || sp.debt || r.next <= today || (sp.first_tx && d.transactions.some((t) => t.id === sp.first_tx))) return;
    const e = firstEntryOf(r); if (e) { syncFirstEntry(r, e); changed = true; }
  });
  if (changed) sortTxns(d);
  return changed;
}
let relinked = false;   // runRecurring just repaired an upcoming entry (the screen needs a redraw)
function runRecurring() {
  const d = state.data; if (!d || state.real || !canWrite() || !(d.recurring || []).length) return 0;   // a Viewer's app never generates entries (the database would refuse them)
  const today = isoDate(new Date()); let n = 0; const linked = linkFirstEntries(); relinked = linked;
  d.recurring.forEach((r) => {
    if (r.active === false) return;
    for (let guard = 0; r.next <= today && (!r.end || r.next <= r.end) && guard < 400; guard++) {
      if (r.spec && r.spec.first_made === r.next) { delete r.spec.first_made; r.next = nextAfter(r, r.next); n++; continue; }   // that one was entered by hand when the rule was created
      generateRecurring(r, r.next); n++; r.next = nextAfter(r, r.next);
    }
  });
  if (n || linked) { sortTxns(d); save(); }
  return n;
}
function recurringNow() { const n = runRecurring(); if (!n && relinked) render(); if (n) { render(); toast(__(n === 1 ? '{n} recurring entry added' : '{n} recurring entries added', { n })); } }
const ruleTitle = (r) => {
  const sp = r.spec;
  if (r.kind === 'txn' && sp.debt) { const l = D().loans.find((x) => x.id === sp.debt), w = sp.wallet_id ? walletOf(sp.wallet_id) : null; return { icon: '🏦', name: l ? l.name : __('Debt payment'), amount: `−${money(sp.amount_minor, sp.currency)}`, where: w ? w.name : __('No account') }; }
  if (r.kind === 'txn') { const c = catOf(sp.category_id), w = walletOf(sp.wallet_id) || (String(sp.wallet_id).startsWith('l:') ? { name: (D().loans.find((x) => 'l:' + x.id === sp.wallet_id) || {}).name || '' } : null) || (String(sp.wallet_id).startsWith('h:') ? { name: accountName((D().holdings.find((x) => x.id === sp.wallet_id.slice(2)) || {}).account_id) } : null); return { icon: sp.type === 'income' ? '💵' : '🧾', name: sp.note || (c && c.name) || (sp.type === 'income' ? __('Income') : __('Expense')), amount: `${sp.type === 'income' ? '+' : '−'}${String(sp.wallet_id).startsWith('h:') ? coinAmount(D().holdings.find((x) => x.id === sp.wallet_id.slice(2)), sp.amount_minor) : money(sp.amount_minor, sp.currency)}`, where: w ? w.name : '' }; }
  if (r.kind === 'transfer') { const A = walletOf(sp.from), B = walletOf(sp.to); return { icon: '🔁', name: `${A ? A.name : '?'} → ${B ? B.name : '?'}`, amount: money(sp.amount_minor, A ? A.currency : cur()), where: sp.note || '' }; }
  const info = assetInfo(sp.symbol), src = parseSource(sp.fund);
  return { icon: '📈', name: __('Buy {qty} {symbol}', { qty: qtyFmt(sp.quantity), symbol: info.symbol }), amount: src ? `${qtyFmt(parseAmount(src, sp.fundamount))} ${sourceUnit(src)}` : '', where: '' };
};
/* change what a rule will do from now on: the amount and the next payment date. Entries it already made are not touched. */
const ruleAmount = (r) => {
  const sp = r.spec;
  if (r.kind === 'txn') return String(sp.wallet_id).startsWith('h:') ? { unit: assetInfo((D().holdings.find((x) => x.id === sp.wallet_id.slice(2)) || {}).symbol || 'USDT').symbol, value: sp.quantity, step: 'any' } : { unit: sp.currency, value: toMajor(sp.amount_minor, sp.currency), step: expOf(sp.currency) ? '0.01' : '1' };
  if (r.kind === 'transfer') { const A = walletOf(sp.from), c = A ? A.currency : cur(); return { unit: c, value: toMajor(sp.amount_minor, c), step: expOf(c) ? '0.01' : '1' }; }
  const src = parseSource(sp.fund); return { unit: src ? sourceUnit(src) : '', value: parseFloat(sp.fundamount) || 0, step: 'any' };
};
/* the amount's unit follows the chosen account */
function syncRuleUnit(form) {
  const kind = form.dataset.kind, label = $('[data-amt-label]', form), input = $('input[name=amount]', form);
  let unit;
  if (kind === 'txn') { syncTxnUnit(form); return; }
  if (kind === 'transfer') unit = walletOf(form.from.value)?.currency || cur(); else { const src = parseSource(form.fund.value); unit = src ? sourceUnit(src) : ''; }
  label.textContent = __('Amount ({cur})', { cur: unit }); input.step = kind === 'transfer' && expOf(unit) ? '0.01' : kind === 'transfer' ? '1' : 'any';
}
function ruleDialog(r) {
  const t = ruleTitle(r), a = ruleAmount(r), sp = r.spec, ws = D().wallets.filter((w) => !w.archived);
  const walletSel = (name, sel) => `<select name="${name}">${ws.map((w) => `<option value="${w.id}" ${w.id === sel ? 'selected' : ''}>${esc(w.name)} (${esc(w.currency)})</option>`).join('')}</select>`;
  const debtL = sp.debt ? D().loans.find((x) => x.id === sp.debt) : null;
  const acct = sp.debt ? `<label class="field">${__('Paid from')}<select name="wallet"><option value="">${__('No account, just record the payment')}</option>${ws.filter((w) => !debtL || w.currency === debtL.currency).map((w) => `<option value="${w.id}" ${w.id === sp.wallet_id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></label>`
    : r.kind === 'txn' ? `<label class="field">${__('Account')}<select name="wallet">${acctOptions(sp.type, sp.wallet_id, true)}</select></label>`
    : r.kind === 'transfer' ? `<div class="two"><label class="field">${__('From')}${walletSel('from', sp.from)}</label><label class="field">${__('To')}${walletSel('to', sp.to)}</label></div>`
    : `<label class="field">${__('Pay with')}<select name="fund">${sourceOptions('buy', null, sp.fund)}</select></label>`;
  const cat = r.kind === 'txn' && !sp.debt ? `<label class="field">${__('Category')}<select name="category" data-search data-empty="${__('Category not found')}">${catOptions(sp.type, sp.category_id || '', false)}</select></label>` : '';
  open(`<h2>${esc(t.name)}</h2><p class="muted" style="margin-top:-10px">${__('Changes apply from the next payment. Entries already made stay as they are.')}</p>
  <form data-form="recedit" data-id="${r.id}" data-kind="${r.kind}"${sp.debt ? ' data-debt="1"' : ''} style="display:contents">${acct}${cat}<div class="two"><label class="field"><span data-amt-label>${__('Amount ({cur})', { cur: esc(a.unit) })}</span><input name="amount" type="number" inputmode="decimal" min="0" step="${a.step}" required value="${a.value}"></label>
    <label class="field">${__('Next payment')}<input name="next" type="date" required min="${isoDate(new Date())}" value="${r.next}"></label></div>
  <div class="two rec-actions"><button type="button" class="btn secondary" data-act="rec-toggle" data-id="${r.id}">${r.active === false ? __('Resume') : __('Pause')}</button><button type="button" class="btn danger" data-act="rec-del" data-id="${r.id}">${__('Delete')}</button></div>
  <div class="actions"><button class="btn" type="submit">${__('Save')}</button></div></form>`);
}
function recurringCard() {
  const list = D().recurring || []; if (!list.length) return '';
  return `<section class="card"><div class="card-head"><h2>${__('Recurring')}</h2></div>${list.map((r) => {
    const t = ruleTitle(r), freq = r.freq === 'weekly' ? __('Every week') : __('Every month');
    return `<div class="brow cat-row"><span class="tile" style="--c:#8B8FF0">${t.icon}</span><div class="cat-main"><b class="cat-name">${esc(t.name)}</b><small class="muted">${r.kind === 'txn' ? `<b class="pl ${r.spec.type === 'income' ? 'up' : 'down'}">${esc(t.amount)}</b>` : esc(t.amount)}${t.where ? ' · ' + esc(t.where) : ''}</small><small class="muted">${freq} · ${r.active === false ? __('Paused') : __('Next {date}', { date: dateOf(r.next).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) })}</small></div>
      <div class="tools"><button class="btn secondary" data-act="rec-manage" data-id="${r.id}">${__('Manage')}</button></div></div>`;
  }).join('')}</section>`;
}

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) { if (state.ui.walletMenu || state.ui.infoOpen) { state.ui.walletMenu = null; state.ui.infoOpen = null; render(); } return; }
  const { act, id, type, date } = el.dataset, find = (arr) => arr.find((x) => x.id === id);
  if (WRITE_ACT.test(act) && act !== 'edit-txn' && !canWrite()) { toast(__('You can view everything here, but not change it.')); return; }
  if (act !== 'wallet-menu') state.ui.walletMenu = null;
  if (act !== 'toggle-info') state.ui.infoOpen = null;
  if (act === 'close') close();
  else if (act === 'theme-toggle') { applyTheme(effectiveTheme() === 'dark' ? 'light' : 'dark'); render(); }
  else if (act === 'wallet-menu') { state.ui.walletMenu = state.ui.walletMenu === id ? null : id; render(); }
  else if (act === 'add-txn') txnDialog(null, type, undefined, date);
  else if (act === 'open-day') { state.ui.dayQ = ''; location.hash = '#/transactions/' + id; }
  else if (act === 'toggle-day') { const g = el.closest('.day-group'), on = !g.classList.contains('open'); g.classList.toggle('open', on); el.setAttribute('aria-expanded', on); if (on) state.ui.openDays.add(id); else state.ui.openDays.delete(id); }
  else if (act === 'cat-txns') { Object.assign(state.ui, { cat: el.dataset.cat, q: '', occ: '', wallet: '', allPeriods: false }); forgetScroll('#/transactions'); location.hash = '#/transactions'; }   // a budget row opens its transactions for the same period
  else if (act === 'reset-filters') { Object.assign(state.ui, { q: '', cat: '', occ: '', wallet: '' }); render(); }
  else if (act === 'days-all' || act === 'days-none') { $$('#txn-list .day-group').forEach((g) => { const on = act === 'days-all'; g.classList.toggle('open', on); $('.day-row', g).setAttribute('aria-expanded', on); if (on) state.ui.openDays.add(g.dataset.day); else state.ui.openDays.delete(g.dataset.day); }); }
  else if (act === 'invest') holdingDialog(null, null, { invest: true });
  else if (act === 'transfer') transferDialog();
  else if (act === 'view-transfer') transferDialog(null, id);
  else if (act === 'delete-transfer') { if (!removeTransferGroup(id)) { toast(__("Can't delete: the cash has already been spent")); return; } Analytics.track('delete_transfer'); save(); close(); render(); toast('Transfer deleted'); }
  else if (act === 'edit-txn') { const tx = find(D().transactions); if (!canEditRec(tx)) { txnReadDialog(tx); return; } if (tx.transfer_id && xferRead(tx.transfer_id)) { transferDialog(null, tx.transfer_id); return; } if (isSaleRecord(tx)) { toast(__('This follows the sale. Change or undo the sale on the asset.')); return; } txnDialog(tx); }
  else if (act === 'rec-toggle') { close(); const r = find(D().recurring); r.active = r.active === false; if (r.active) { const today = isoDate(new Date()); while (r.next < today) r.next = nextAfter(r, r.next); } save(); render(); }   // resuming skips what was missed while paused
  else if (act === 'rec-manage') ruleDialog(find(D().recurring));
  else if (act === 'rec-del') { close(); hhLastDel = find(D().recurring)?.note || find(D().recurring)?.name || ''; D().recurring = D().recurring.filter((r) => r.id !== id); save(); render(); toast('Recurring entry deleted'); }
  else if (act === 'add-budget') budgetDialog(null, el.dataset.preset);
  else if (act === 'edit-budget') budgetDialog(budgetStatus(state.ui.month).find((b) => b.id === id));
  else if (act === 'toggle-cat') { const o = state.ui.openCats; if (o.has(id)) o.delete(id); else o.add(id); render(); }
  else if (act === 'quick-cat-cancel') $('.quick-cat', el.closest('form')).hidden = true;
  else if (act === 'quick-cat-add') quickAddCategory(el.closest('form'));
  else if (act === 'pick-icon') { const f = el.closest('form')?.elements[el.dataset.for]; if (f) { f.value = el.dataset.e; f.dispatchEvent(new Event('input', { bubbles: true })); } }
  else if (act === 'add-wallet') walletDialog();
  else if (act === 'add-occasion') occasionDialog();
  else if (act === 'add-occasion-budget') occasionDialog(null, true);
  else if (act === 'occasion-history') occasionHistoryDialog();
  else if (act === 'occasion-archived') archivedOccasionsDialog();
  else if (act === 'add-occasion-txn') txnDialog(null, 'expense', occasionOf(id));
  else if (act === 'edit-occasion') occasionDialog(occasionStatus().find((o) => o.id === id));
  else if (act === 'archive-occasion') { const o = occasionOf(id); o.archived = !o.archived; save(); close(); render(); toast(o.archived ? 'Occasion archived' : 'Occasion reopened'); }
  else if (act === 'delete-occasion') { if (!hhOk(find(D().occasions)?.name || '')) return; D().occasions = D().occasions.filter((o) => o.id !== id); D().transactions.forEach((t) => { if (t.occasion_id === id) delete t.occasion_id; }); save(); close(); render(); toast('Occasion deleted. Its expenses were kept.'); }
  else if (act === 'view-occasion') { state.ui.occ = id; state.ui.q = ''; state.ui.cat = ''; state.ui.wallet = ''; const o = occasionOf(id); const view = occasionView(o); state.ui.month = view.month; state.ui.allPeriods = view.all; if (el.closest('#dlg')) close(); forgetScroll('#/transactions'); location.hash = '#/transactions'; render(); }
  else if (act === 'pf-tab') { state.ui.pfTab = el.dataset.tab; render(); }
  else if (act === 'add-loan') loanDialog();
  else if (act === 'loans-archived') archivedLoansDialog();
  else if (act === 'pnl-month') { state.ui.pfTab = 'investment'; location.hash = '#/portfolio/pnl-' + el.dataset.k; }
  else if (act === 'lent-repayment') { const l = D().lent.find((x) => x.id === id), pay = l && l.payments.find((x) => x.id === el.dataset.pid); if (pay) lentRepaymentDialog(l, pay); }
  else if (act === 'loan-payment') { const l = D().loans.find((x) => x.id === id), pay = l && l.payments.find((x) => x.id === el.dataset.pid); if (pay) loanPaymentDialog(l, pay); }
  else if (act === 'unarchive-loan') { const l = find(D().loans); l.archived = false; save(); render(); toast(__('{name} is back', { name: l.name })); if (D().loans.some((x) => x.archived)) archivedLoansDialog(); else close(); }
  else if (act === 'edit-loan') loanDialog(find(D().loans));
  else if (act === 'pay-loan') paymentDialog(find(D().loans), 'loan');
  else if (act === 'history-loan') {   // the Transactions page on that loan, in the period of its latest entry (change the period to go back in time)
    const l = find(D().loans), last = l.payments.filter((p) => p.date <= todayIso()).map((p) => p.date).sort().pop();
    Object.assign(state.ui, { wallet: 'l:' + id, month: last ? periodKeyOf(last) : currentPeriod(), cat: '', occ: '', q: '', allPeriods: false }); forgetScroll('#/transactions'); location.hash = '#/transactions';
  }
  else if (act === 'see-upcoming') upcomingDialog();
  else if (act === 'history-lent') loanHistoryDialog(find(D().lent), 'lent');
  else if (act === 'archive-loan') { find(D().loans).archived = true; save(); close(); render(); toast('Debt archived'); }
  else if (act === 'add-lent') lentDialog();
  else if (act === 'edit-lent') lentDialog(find(D().lent));
  else if (act === 'pay-lent') paymentDialog(find(D().lent), 'lent');
  else if (act === 'archive-lent') { find(D().lent).archived = true; save(); close(); render(); toast('Archived'); }
  else if (act === 'delete-payment') { const l = find(el.dataset.kind === 'lent' ? D().lent : D().loans), gone = l.payments.find((p) => p.id === el.dataset.pid); if (gone && gone.txn_id && gone.kind !== 'charge') D().transactions = D().transactions.filter((t) => t.id !== gone.txn_id); l.payments = l.payments.filter((p) => p.id !== el.dataset.pid); save(); render(); toast('Removed'); if (el.dataset.close) close(); else if (el.closest('#dlg')) loanHistoryDialog(l, el.dataset.kind); }
  else if (act === 'pick-type-old') { state.ui.pickType = el.dataset.type; $$('.pill', el.parentElement).forEach((b) => b.classList.toggle('on', b === el)); runAssetSearch(); }
  else if (act === 'pick-asset') pickAsset(state.pick[+el.dataset.i], el.closest('form'));
  else if (act === 'manual-asset') { const f = el.closest('form'); f.asset.value = '__custom'; f.assetmeta.value = ''; $('#picker', f).hidden = true; $('.custom-fields', f).hidden = false; }
  else if (act === 'add-account') accountDialog();
  else if (act === 'edit-account') accountDialog(find(D().investments));
  else if (act === 'archive-account') { find(D().investments).archived = true; save(); close(); render(); toast('Account archived'); }
  else if (act === 'add-holding') { holdingDialog(null, el.dataset.account, el.dataset.type === 'cash' ? { pickType: 'cash' } : {}); }
  else if (act === 'edit-holding') holdingDialog(find(D().holdings));
  else if (act === 'view-history') { close(); location.hash = '#/portfolio/' + id; }
  else if (act === 'trade') { const th = find(D().holdings); if (assetInfo(th.symbol).type === 'cash') cashDialog(th, el.dataset.side); else tradeDialog(th, el.dataset.side); }
  else if (act === 'set-cost') costDialog(find(D().holdings));
  else if (act === 'delete-trade') {
    const h = find(D().holdings), tr = h.trades.find((x) => x.id === el.dataset.tid);
    if (!removeTrade(h, tr)) { toast("Can't remove this: it would leave a negative holding (part of it was sold or spent since)"); return; }
    save(); render(); if (routeArg() !== h.id) holdingDialog(h); toast('Trade removed and balances restored');
  }
  else if (act === 'delete-holding') { if (!hhOk(assetInfo(find(D().holdings)?.symbol).name || '')) return; D().holdings = D().holdings.filter((x) => x.id !== id); save(); close(); render(); toast('Asset removed'); }
  else if (act === 'breakdown') breakdownDialog(id);
  else if (act === 'add-cat') catDialog(null, el.dataset.parent);
  else if (act === 'edit-cat') catDialog(catOf(id));
  else if (act === 'archived-cats') archivedCatsDialog();
  else if (act === 'restore-cat') {
    const c = catOf(id); if (!c) return;
    c.archived = false; if (!c.parent_id) D().categories.filter((k) => k.parent_id === c.id).forEach((k) => { k.archived = false; });
    Analytics.track('restore_category', { type: c.type, level: c.parent_id ? 'sub_category' : 'category' });
    save(); render(); archivedCatsDialog(); toast(__('Category restored'));
  }
  else if (act === 'archive-cat') {
    [id, ...childrenOf(id).map((c) => c.id)].forEach((cid) => { catOf(cid).archived = true; });
    save(); close(); render(); toast('Category archived. Past transactions keep it.');
  }
  else if (act === 'revoke') Cloud.signOut('others').then(({ error }) => toast(error ? error.message : 'Other devices signed out'));
  else if (act === 'edit-wallet') walletDialog(walletOf(id));
  else if (act === 'toggle-more') { const key = el.dataset.key, k = key === 'hist' ? 'histMore' : key === 'wallets' ? 'walletsMore' : key === 'pnlhist' ? 'pnlhistMore' : 'more_' + key; state.ui[k] = !state.ui[k]; render(); }
  else if (act === 'goto') { if (el.dataset.route === 'activity') { actState.rows = null; actState.who = ''; actState.type = 'all'; } location.hash = '#/' + el.dataset.route; }
  else if (act === 'demo-on') { Analytics.track('demo_on', {}, true); setDemo(true); }
  else if (act === 'onb-skip') skipOnboarding();
  else if (act === 'congrats-add') { endCongrats(); txnDialog(null, 'expense'); }   // on to the normal Overview, with the Add transaction pop-up open
  else if (act === 'toggle-info') { state.ui.infoOpen = state.ui.infoOpen === id ? null : id; render(); }
  else if (act === 'toggle-arch') { state.ui.archOpen = !state.ui.archOpen; render(); }
  else if (act === 'restore-wallet') { walletOf(id).archived = false; save(); render(); toast('Account restored'); }
  else if (act === 'delete-wallet') {
    const w = walletOf(id), n = D().transactions.filter((t) => t.wallet_id === id).length;
    if (n) { toast(__(n === 1 ? "Can't delete: {n} transaction uses this account. Restore it instead." : "Can't delete: {n} transactions use this account. Restore it instead.", { n })); return; }
    if (!confirm(__('Delete "{name}" permanently? This can\'t be undone.', { name: w.name }))) return;
    hhLastDel = w.name; D().wallets = D().wallets.filter((x) => x.id !== id); save(); render(); toast('Account deleted');
  }
  else if (act === 'archive-wallet') { find(D().wallets).archived = true; save(); close(); render(); toast('Account archived'); }
  else if (act === 'delete-txn') {
    const tx = find(D().transactions), coin = coinOf(tx);
    if (!hhOk(`${tx.note || catOf(tx.category_id)?.name || __('Transaction')} (${money(tx.amount_minor, tx.currency)})`)) return;
    if (coin) { if (!removeTrade(coin, coin.trades.find((x) => x.id === tx.trade_id))) { toast(__("Can't delete: the {symbol} has already been spent", { symbol: assetInfo(coin.symbol).symbol })); return; } }
    else { D().transactions = D().transactions.filter((t) => t.id !== id); D().loans.forEach((l) => { l.payments = l.payments.filter((p) => p.txn_id !== id); }); D().lent.forEach((l) => { l.payments = l.payments.filter((p) => p.txn_id !== id); }); }   // a loan charge or a repayment made from this account goes with it
    Analytics.track('delete_transaction', { type: tx.type });
    save(); close(); render(); toast('Transaction deleted');
  }
  else if (act === 'delete-budget') { if (!hhOk(catOf(find(D().budgets)?.category_id)?.name || __('Budget'))) return; Analytics.track('delete_budget'); D().budgets = D().budgets.filter((b) => b.id !== id); save(); close(); render(); toast('Budget deleted'); }
  else if (act === 'signout') Cloud.idle().then(() => Cloud.signOut()).then(() => { state.data = null; state.real = null; resetSessionView(); state.auth = { status: 'out', view: 'landing', email: '', notice: '', error: '' }; render(); window.scrollTo(0, 0); });
  else if (act === 'auth-check') checkConfirmed(true);
  else if (act === 'auth-view') { stopPolling(); Object.assign(state.auth, { view: el.dataset.view, error: '', notice: '' }); render(); }
  else if (act === 'install-app') installDialog();
  else if (act === 'support') supportDialog();
  else if (act === 'shot-del') { supportShots.splice(+el.dataset.i, 1); $('#shots').innerHTML = supportShotsHtml(); }
  else if (act === 'trend-detail') trendDialog(el.dataset.k);
  else if (act === 'trend-go') { state.ui.month = el.dataset.k; state.ui.allPeriods = false; state.ui.cat = el.dataset.cat || ''; state.ui.occ = ''; state.ui.q = ''; state.ui.wallet = ''; close(); forgetScroll('#/transactions'); location.hash = '#/transactions'; }
  else if (act === 'guide-tab') { state.ui.guide = el.dataset.k; $('#install-guide').innerHTML = installGuide(state.ui.guide); }
  else if (act === 'transfer-dialog') handoffDialog();
  else if (act === 'agree-terms') { state.auth.agree = !!el.checked; document.querySelectorAll('.onboard .btn.google, .onboard [data-form=signup] button[type=submit]').forEach((b) => { b.disabled = !state.auth.agree; }); }
  else if (act === 'toggle-password') { const inp = el.parentElement.querySelector('input'), show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; el.setAttribute('aria-pressed', String(show)); el.setAttribute('aria-label', show ? __('Hide password') : __('Show password')); el.innerHTML = icon(show ? 'eye-off' : 'eye'); }
  else if (act === 'auth-google' && state.auth.view === 'signup' && !state.auth.agree) { /* the agreement is not ticked yet */ }
  else if (act === 'auth-google') Cloud.google().then(({ error }) => { if (error) { state.auth.error = error.message; render(); } });
  else if (act === 'auth-resend') { if (CAPTCHA_KEY && !captchaToken) { state.auth.error = 'Please complete the verification first.'; render(); return; } Cloud.resend(state.auth.email, captchaToken || undefined).then(({ error }) => { Object.assign(state.auth, error ? { error: error.message, notice: '' } : { error: '', notice: 'Email sent again. Check your inbox and spam folder.' }); render(); }); }
  else if (act === 'join-exit') joinExit('/');
  else if (act === 'join-signout') Cloud.idle().then(() => Cloud.signOut()).then(() => render());
  else if (act === 'join-lang') { setLang(el.dataset.lang); render(); }
  else if (act === 'hh-invite') inviteDialog();
  else if (act === 'delete-my-login-ask') hhConfirm('delete-my-login', '', __('Delete your login?'), __('This permanently deletes your Stiver login. What you entered stays in the household under your name.'), __('Delete my login'));
  else if (act === 'act-who') { actState.who = el.dataset.id || ''; render(); }
  else if (act === 'act-type') { actState.type = el.dataset.type; render(); }
  else if (act === 'act-retry') { actState.rows = null; actState.error = ''; render(); }
  else if (act === 'hh-member') memberDialog(id);
  else if (act === 'hh-resend' || act === 'hh-revoke') hhInviteAction(act === 'hh-resend' ? 'resend' : 'revoke', id);
  else if (act === 'hh-remove') { const x = hhPeople().find((p) => p.user_id === id); { const nm = esc(hhFirstName(x && x.display_name) || __('this person')), ow = esc(hhFirstName(((Cloud.household.people || []).find((q) => q.role === 'owner') || {}).display_name) || __('the owner')); hhConfirm('hh-remove-go', id, __('Remove {name}?', { name: nm }), __("{name} will lose access to {owner}'s household. Things {name} added keep {name}'s name.", { name: nm, owner: ow }), __('Remove')); } }
  else if (act === 'hh-remove-go') hhDo(() => Cloud.removeMember(id), 'member_removed', __('Removed from the household'));
  else if (act === 'hh-leave') hhConfirm('hh-leave-go', '', __('Leave this household?'), __('You will lose access to its accounts and transactions. What you entered stays, under your name. You can only come back if the owner invites you again.'), __('Leave household'));
  else if (act === 'hh-leave-go') hhDo(() => Cloud.leaveHousehold(), 'household_left', __('You left the household'));
  else if (act === 'delete-my-login') { Cloud.deleteMyLogin().then((r) => { if (r && r.error) { toast(__("Couldn't delete your login. Try again.")); return; } Analytics.track('login_deleted'); Cloud.signOut().then(() => { state.auth.noAccess = false; }); }); }
  else if (act === 'retry-load') { state.auth.loadError = ''; render(); loadUserData(); }
  else if (act === 'demo-off') { Analytics.track('demo_off', {}, true); setDemo(false); }
  else if (act === 'remove-sample') { if (confirm(__('Remove the sample data? Anything you added yourself stays.'))) removeSample(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.row[data-act]')) e.target.click(); if (e.key === 'Escape' && state.ui.walletMenu) { state.ui.walletMenu = null; render(); } });

document.addEventListener('input', (e) => {
  const t = e.target, f = t.form;
  if (f?.dataset.form === 'cashx') { if (t.name === 'received') t.dataset.touched = '1'; else if (t.name === 'amount') syncCashForm(f); return; }
  if (f?.dataset.form !== 'transfer') return;
  if (t.name === 'received') t.dataset.touched = '1';   // the user set it: stop auto-filling
  else if (t.name === 'amount') syncTransfer(f);
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('input[name=shots]')) { addSupportShots(t.files).then(() => { t.value = ''; }); return; }
  if (t.form?.dataset.form === 'loan' && ['repeat', 'currency'].includes(t.name)) { debtFormChanged(t.form, t.name); return; }
  if (t.matches('[data-trend]')) { if (t.dataset.trend === 'n') { state.ui.trendN = +t.value; state.ui.trendCat = state.ui.trendCat || ''; } else state.ui.trendCat = t.value; $('#trend-chart').innerHTML = trendChart(); }
  else if (t.matches('[data-bind="month"]')) { if (t.value === 'all') state.ui.allPeriods = true; else { state.ui.allPeriods = false; state.ui.month = t.value; } render(); }   // "all": Transactions only, the period itself is kept for the other pages
  else if (t.matches('[data-bind="pfRange"]')) { state.ui.pfRange = t.value; render(); }
  else if (t.matches('[data-bind="pnlPeriod"]')) { location.hash = '#/portfolio/pnl-' + t.value; }
  // (the search box is handled on input: a change event from a removed, focused box must not bring its old text back)
  else if (t.matches('select[data-filter]')) { state.ui[t.dataset.filter] = t.value; t.classList.toggle('f-on', !!t.value); const l = $('#txn-list'); if (l) l.innerHTML = txnListHtml(); }
  else if (t.name === 'category' && (t.form?.dataset.form === 'txn' || t.form?.dataset.form === 'budget')) {
    const q = $('.quick-cat', t.form); if (!q) return;
    if (t.value === '__new') { t.value = t.dataset.prev || ''; q.hidden = false; q.scrollIntoView({ block: 'nearest' }); }   // open the add-category form; no keyboard until a field is tapped
    else { t.dataset.prev = t.value; q.hidden = true; }                                                                    // picking a category hides the add form
  }
  else if (t.name === 'side' && t.form?.dataset.invest && t.form?.dataset.form === 'holding') { const acc = t.form.account && t.form.account.value; if (t.value === 'sell') sellAssetDialog(acc); else holdingDialog(null, acc, { invest: true }); }
  else if (t.form?.dataset.sell && t.name === 'account') { sellAssetDialog(t.value); }
  else if (t.form?.dataset.sell && t.name === 'sellasset') syncSellForm(t.form, true);
  else if (t.form?.dataset.sell && t.name === 'fund') syncSellForm(t.form);
  else if (t.name === 'type' && t.form?.dataset.form === 'txn') {
    if (t.value === 'invest') holdingDialog(null, null, { invest: true });
    else if (t.value === 'transfer') transferDialog();
    else {
      $('select[name=category]', t.form).innerHTML = catOptions(t.value, '', true); $('select[name=category]', t.form).dataset.prev = ''; $('.quick-cat', t.form).hidden = true; $('select[name=qc_parent]', t.form).innerHTML = quickParentOptions(t.value);
      if (!t.form.dataset.id) { const w = t.form.wallet, keep = recallAcct(t.value, acctOptions(t.value, '')) || w.value; w.innerHTML = acctOptions(t.value, keep); if (![...w.options].some((o) => o.value === keep)) w.selectedIndex = 0; syncTxnUnit(t.form); }   // "new" coin options exist for income only
    }
  }
  else if (t.matches('[data-pick-type]')) { state.ui.pickType = t.value; syncPickType(t.form); runAssetSearch(); }
  else if (t.matches('[data-cash-ccy]')) syncPickType(t.form);
  else if (t.matches('[data-theme-select]')) { applyTheme(t.value); if (state.data && !state.real) { state.data.profile.theme = THEME; save(); } render(); }
  else if (t.matches('[data-lang]')) { setLang(t.value); if (state.data && !state.real) { state.data.profile.language = LANG; save(); } render(); }
  else if (t.matches('[data-demo]')) setDemo(t.checked);
  else if (t.matches('[data-setting]')) applySetting(t);
  else if (t.name === 'side' && t.form?.dataset.form === 'trade') syncTradeForm(t.form, true);
  else if (t.form?.dataset.form === 'cashx' && t.name === 'side') cashDialog(D().holdings.find((x) => x.id === t.form.dataset.id), t.value);
  else if (t.form?.dataset.form === 'cashx' && t.name === 'account') { delete t.form.received.dataset.touched; syncCashForm(t.form); }
  else if (t.name === 'source' && t.form?.dataset.form === 'trade') syncTradeForm(t.form, false);
  else if (t.name === 'fund' && t.form?.dataset.form === 'holding') syncFund(t.form);
  else if (t.form?.dataset.form === 'recedit' && !t.form.dataset.debt && ['wallet', 'from', 'fund'].includes(t.name)) syncRuleUnit(t.form);
  else if (t.name === 'txkind') {
    const here = t.form?.dataset.form;   // 'holding' is the Invest dialog
    if (t.value === 'invest' && here !== 'holding') holdingDialog(null, null, { invest: true });
    else if (t.value === 'transfer' && here !== 'transfer') transferDialog();
    else if (t.value === 'expense' || t.value === 'income') txnDialog(null, t.value);
  }
  else if (t.form?.dataset.form === 'transfer' && (t.name === 'from' || t.name === 'to')) {
    const f = t.form;   // never the same account on both sides, and never two investment Cash balances
    const both = () => xferEnd(f.from.value)?.kind === 'h' && xferEnd(f.to.value)?.kind === 'h';
    if (f.from.value === f.to.value || both()) { const other = D().wallets.find((w) => !w.archived && 'w:' + w.id !== t.value); const o = (t.name === 'from' ? f.to : f.from); if (other) o.value = 'w:' + other.id; }
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
async function pickAsset(a, form, quiet) {
  form.asset.value = a.key; form.assetmeta.value = JSON.stringify(a); form.price.value = '';
  $('#asset-results').hidden = true; form.assetq.value = quiet ? '' : a.symbol;   // the chosen ticker stays in the search box (BBRI), the details below
  form.dataset.nocost = a.type === 'cash' || a.type === 'stablecoin' ? '1' : ''; if (form.pccy) form.pccy.value = defaultPriceCcy(a, form.pccy.value); syncOwnPrice(form);
  const chip = $('#picked'), fb = $('.price-fallback', form); chip.hidden = !!quiet; fb.hidden = true;
  chip.innerHTML = `${esc(a.name)} <span class="badge">${esc(a.type)}</span> <span class="muted" id="picked-price"></span>`;
  if (!a.fh && !a.yh) return; // built-in asset: priced from the mock catalog
  $('#picked-price').textContent = __('getting price…');
  try {
    const q = await quoteFull(a), p = q.price; form.price.value = p;
    const nat = q.currency && q.currency !== 'USD' ? ` (${money(toMinor(q.native, q.currency), q.currency)})` : '';
    $('#picked-price').textContent = `$${p.toLocaleString('en-US', { maximumFractionDigits: 6 })}${nat} live`;
  }
  catch { $('#picked-price').textContent = __('price unavailable'); fb.hidden = false; }
}

document.addEventListener('change', (e) => { if (e.target.matches && e.target.matches('select[data-occ-pick]')) syncOccPick(e.target.form); });
document.addEventListener('input', (e) => {
  if (e.target.form?.dataset.form === 'trade' && ['quantity', 'amount', 'price'].includes(e.target.name)) { syncTradePrice(e.target.form, e.target.name); tradeHint(e.target.form); }
  if (e.target.name === 'assetq') runAssetSearch();
  if (e.target.form?.dataset.form === 'holding' && ['quantity', 'fundamount'].includes(e.target.name)) syncAvgPrice(e.target.form);
  if (e.target.classList?.contains('icon-input')) { const v = lastEmoji(e.target.value); if (v !== e.target.value) e.target.value = v; $$('.icon-pick', e.target.form).forEach((b) => b.classList.toggle('on', b.dataset.for === e.target.name && b.dataset.e === v)); }
  if (e.target.name === 'message' && e.target.form?.dataset.form === 'support') $('#support-count').textContent = `${e.target.value.length}/${SUPPORT_MAX_CHARS}`;
  if (e.target.matches('[data-filter="dayq"]')) { state.ui.dayQ = e.target.value; const l = $('#day-list'); if (l) l.innerHTML = dayListHtml(routeArg()); }
  if (e.target.matches('[data-filter="q"]')) { state.ui.q = e.target.value; e.target.classList.toggle('f-on', !!e.target.value.trim()); const l = $('#txn-list'); if (l) l.innerHTML = txnListHtml(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.name?.startsWith('qc_')) { e.preventDefault(); quickAddCategory(e.target.form); return; }   // Enter adds the category, not the transaction
  if (e.key === 'Enter' && e.target.id === 'gsearch') { state.ui.q = e.target.value; forgetScroll('#/transactions'); location.hash = '#/transactions'; }
});

function applySetting(el) {
  const p = D().profile, k = el.dataset.setting;
  if (k === 'name') p.name = el.value.trim() || p.name;
  else if (k === 'ai') p.ai = el.checked;
  else if (k === 'period') p.period = Math.min(28, Math.max(1, +el.value || 1));
  else if (k === 'currency' && el.value !== p.currency) {
    // only the reporting currency changes; wallets and transactions keep their own currency
    const from = p.currency, to = el.value;
    if (state.real) {   // sample data: rebuild the sample for that country (local banks, merchants, brokers); your own data is untouched
      const d = seed(p.name || 'You', to); d.profile = { ...p, currency: to }; d.livePrices = D().livePrices || {};
      state.data = d; state.ui.pf = null; Object.assign(state.ui, { cat: '', wallet: '', occ: '', q: '' }); toast(__('Reporting currency changed to {cur}', { cur: to })); render(); return;
    }
    D().budgets.forEach((b) => { b.amount_minor = convert(b.amount_minor, from, to); b.currency = to; });
    p.currency = to; state.ui.pf = null; toast(__('Reporting currency changed to {cur}', { cur: to }));
  }
  save(); render();
}

document.addEventListener('input', (e) => { const jf = e.target.form; if (jf && jf.dataset.form === 'join') joinValidate(jf); });
document.addEventListener('change', (e) => { const jf = e.target.form; if (jf && jf.dataset.form === 'join') joinValidate(jf); });
document.addEventListener('input', (e) => {
  const f = e.target.form; if (!f || f.dataset.form !== 'invite' || e.target.name !== 'email') return;
  const val = e.target.value.trim(), bad = val && !HH_EMAIL.test(val.toLowerCase());
  hhMsg(f, bad ? __('Enter a valid email address.') : ''); $('[data-send]', f).disabled = !!bad;
});
document.addEventListener('submit', async (e) => {
  const f = e.target, kind = f.dataset.form; if (!kind) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(f));
  if (needsFx(kind, f, v)) await freshFx();   // a price in another currency is converted at the latest rate
  if (['signin', 'signup', 'forgot', 'recovery'].includes(kind)) { submitAuth(kind, v, f); return; }
  if (kind === 'txn') {
    // a USDT/USDC "new" choice builds its holding now but only keeps it once the transaction is valid
    const fresh = v.wallet.startsWith('n:') ? v.wallet.split(':') : null;
    const coin = v.wallet.startsWith('h:') ? D().holdings.find((x) => x.id === v.wallet.slice(2)) : fresh ? { id: uid(), account_id: fresh[2], symbol: fresh[1], quantity: 0, since: monthKey(new Date()), trades: [], _new: true } : null, type = v.type;
    const loan = v.wallet.startsWith('l:') ? D().loans.find((x) => x.id === v.wallet.slice(2)) : null;
    if (v.wallet.startsWith('l:') && (!loan || type !== 'expense')) { toast(__('A debt account can only pay expenses')); return; }
    const wc = loan ? loan.currency : coin ? 'USD' : walletOf(v.wallet).currency, minor = coin ? Math.round(parseFloat(v.amount) * 100) : toMinor(parseFloat(v.amount), wc), existing = f.dataset.id && D().transactions.find((t) => t.id === f.dataset.id);
    if (!(minor > 0)) { toast('Enter an amount above zero'); return; }
    // an expense cannot be more than the account holds. Not checked: a credit card, a loan account, USDT/USDC (they have their own rules) and a future-dated expense (nothing leaves yet).
    // Editing an expense counts its own old amount as available again.
    if (type === 'expense' && !coin && !loan) {
      const w = walletOf(v.wallet);
      if (w && w.type !== 'card' && v.date <= todayIso()) {
        const back = existing && existing.type === 'expense' && existing.wallet_id === w.id && existing.occurred_at <= todayIso() ? existing.amount_minor : 0, avail = walletBalance(w) + back;
        if (minor > avail) { toast(__("{name} doesn't have enough balance ({amount} available)", { name: w.name, amount: money(Math.max(0, avail), w.currency) })); return; }
      }
    }
    const row = existing || { id: uid(), category_source: 'user', ai_confidence: null };
    Object.assign(row, { type, amount_minor: minor, currency: wc, occurred_at: v.date, wallet_id: coin || loan ? null : v.wallet, note: v.note.trim(), category_id: v.category || null });
    if (loan) row.loan_id = loan.id; else delete row.loan_id;
    // a repayment made from this account: the loan's payment follows the expense (amount, date); if it stops being an expense from an account the link is dropped
    { const rp = existing && repaymentOf(row.id); if (rp) { if (type === 'expense' && !coin && !loan) { rp.payment.amount_minor = minor; rp.payment.date = v.date; } else rp.loan.payments = rp.loan.payments.filter((x) => x !== rp.payment); } }
    // paying with a loan raises that loan by the amount (a "charge"); changing or removing the account moves or removes it
    D().loans.forEach((l) => { l.payments = l.payments.filter((p) => !(p.kind === 'charge' && p.txn_id === row.id)); });
    if (loan) loan.payments.push({ id: uid(), date: v.date, amount_minor: minor, kind: 'charge', txn_id: row.id });
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
    if (!coin && !existing && v.repeat) { const rr = addRule('txn', v.repeat, v.date, { type, amount_minor: minor, currency: wc, wallet_id: v.wallet, note: row.note, category_id: row.category_id, occasion_id: row.occasion_id || null }); if (rr.spec.first_made) rr.spec.first_tx = row.id; }
    sortTxns();
    state.ui.month = periodKeyOf(row.occurred_at) <= currentPeriod() ? periodKeyOf(row.occurred_at) : state.ui.month;
    if (!existing) rememberAcct(type, v.wallet);
    Analytics.track(existing ? 'update_transaction' : type + '_recorded', { type, payment_source: coin ? 'stablecoin' : loan ? 'debt' : 'account', has_category: !!row.category_id, has_occasion: !!row.occasion_id, is_recurring: !!v.repeat });
    save(); close(); render(); toast(msg);
  }
  if (kind === 'transfer') {
    const A = xferEnd(v.from), B = xferEnd(v.to), editGid = f.dataset.gid;
    if (!A || !B || A.id === B.id) { toast('Pick two different accounts'); return; }
    if (A.kind === 'h' && B.kind === 'h') { toast('Pick a bank or e-wallet account on one side'); return; }
    const cross = A.ccy !== B.ccy, amount = toMinor(parseFloat(v.amount), A.ccy), fee = v.fee ? toMinor(parseFloat(v.fee), A.ccy) : 0;
    const received = cross ? toMinor(parseFloat(v.received), B.ccy) : amount;
    if (!(amount > 0) || !(received > 0)) { toast(cross && !(received > 0) ? 'Enter the amount received' : 'Enter an amount above zero'); return; }
    if (!(fee >= 0)) { toast('The fee must be zero or more'); return; }
    const r = saveTransfer({ from: v.from, to: v.to, amount, received, fee, date: v.date, note: v.note.trim(), editGid, repeat: v.repeat });
    if (r.error) { toast(r.error); return; }
    Analytics.track(editGid ? 'transfer_edited' : 'transfer_recorded', { has_fee: fee > 0, is_recurring: !!v.repeat, involves_investment_cash: A.kind === 'h' || B.kind === 'h' });
    save(); close(); render(); toast(editGid ? 'Saved' : __('Moved {amount} from {from} to {to}', { amount: money(amount, A.ccy), from: A.name, to: B.name }) + (fee > 0 ? ' ' + __('(fee {fee})', { fee: money(fee, A.ccy) }) : '')); return;
  }
  if (kind === 'cashx') {   // a deposit into / withdrawal from an investment Cash balance (the Portfolio dialog): a transfer with an account
    const h = D().holdings.find((x) => x.id === f.dataset.id), w = walletOf(v.account), dep = v.side === 'buy';
    if (!h || !w) { toast('Pick an account'); return; }
    const hc = cashCcy(h), srcCcy = dep ? w.currency : hc, dstCcy = dep ? hc : w.currency, cross = srcCcy !== dstCcy;
    const amount = toMinor(parseFloat(v.amount), srcCcy), fee = v.fee ? toMinor(parseFloat(v.fee), srcCcy) : 0;
    const received = cross ? toMinor(parseFloat(v.received), dstCcy) : amount;
    if (!(amount > 0) || !(received > 0)) { toast(cross && !(received > 0) ? 'Enter the amount received' : 'Enter an amount above zero'); return; }
    if (!(fee >= 0)) { toast('The fee must be zero or more'); return; }
    const r = saveTransfer({ from: dep ? 'w:' + w.id : 'h:' + h.id, to: dep ? 'h:' + h.id : 'w:' + w.id, amount, received, fee, date: v.date, note: '' });
    if (r.error) { toast(r.error); return; }
    state.ui.pfTab = 'investment'; rememberAcct(dep ? 'cashin' : 'cashout', v.account);
    Analytics.track(dep ? 'cash_deposited' : 'cash_withdrawn', { has_fee: fee > 0, is_cross_currency: cross });
    save(); close(); render(); toast(`${dep ? __('Deposited') : __('Withdrew')} ${money(dep ? received : amount, hc)}`); return;
  }
  if (kind === 'occasion') {
    const picked = !f.dataset.id && v.pick && v.pick !== '__new' ? occasionOf(v.pick) : null, existing = (f.dataset.id && occasionOf(f.dataset.id)) || picked, c = existing ? existing.currency : v.currency;
    const raw = String(v.amount || '').trim(), minor = raw === '' ? null : toMinor(parseFloat(raw), c), name = picked ? picked.name : (v.name || '').trim();
    if (!name) { toast('Enter a name'); return; }
    if (raw !== '' && !(minor > 0)) { toast('The budget must be above zero'); return; }
    if (f.dataset.fromBudget && minor === null) { toast('Enter a budget above zero'); return; }
    if (!picked && v.start && v.end && v.end < v.start) { toast('The end date is before the start date'); return; }
    const fields = picked ? { amount_minor: minor } : { name, amount_minor: minor, start: v.start || '', end: v.end || '' };   // no budget = null: the occasion only groups expenses
    if (existing) Object.assign(existing, fields); else D().occasions.push({ id: uid(), currency: c, archived: false, ...fields });
    Analytics.track(existing ? 'update_occasion' : 'add_occasion', { has_budget: minor !== null, has_dates: !!(v.start && v.end) });
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
    Analytics.track(f.dataset.id ? 'update_budget' : 'add_budget', { scope: v.category ? 'category' : 'overall' });
    save(); close(); render(); toast('Budget saved');
  }
  if (kind === 'cat') {
    const existing = f.dataset.id ? catOf(f.dataset.id) : null, name = v.name.trim();
    const parent = existing && childrenOf(existing.id).length ? null : catOf(v.parent) || null;
    const type = parent ? parent.type : existing ? existing.type : v.type || 'expense';
    const dup = D().categories.some((c) => c.id !== existing?.id && !c.archived && (c.parent_id || null) === (parent?.id || null) && c.type === type && c.name.toLowerCase() === name.toLowerCase());
    if (!name || dup) { toast(dup ? 'That name already exists here' : 'Enter a name'); return; }
    const fields = { name, icon: lastEmoji(v.icon) || '🏷️', color: v.color, parent_id: parent ? parent.id : null, type };
    if (existing) Object.assign(existing, fields);
    else D().categories.push({ id: uid(), archived: false, ...fields });
    if (parent) { state.ui['more_cat-' + parent.type] = true; state.ui.openCats.add(parent.id); }   // show the sub-category you just added
    Analytics.track(existing ? 'update_category' : parent ? 'add_sub_category' : 'add_category', { type, source: 'settings' });
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
    Analytics.track('add_account', { type: v.type });
    save(); close(); render(); toast(__('Account added in {cur}', { cur: v.currency }));
  }
  if (kind === 'loan') {
    const existing = f.dataset.id && D().loans.find((x) => x.id === f.dataset.id), c = existing ? existing.currency : v.currency;
    const amount = toMinor(parseFloat(v.amount), c), monthly = toMinor(parseFloat(v.monthly || 0), c), rep = v.repeat || '', rule = existing ? debtRuleAny(existing) : null;
    if (!(existing ? amount >= 0 : amount > 0) || !v.name.trim()) { toast('Enter a name and an amount above zero'); return; }
    let acct = null;
    if (rep) {
      if (!(monthly > 0)) { toast(rep === 'weekly' ? 'Enter a weekly payment above zero' : 'Enter a monthly payment above zero'); return; }
      if (!v.next || v.next < todayIso()) { toast(__('Pick a date from today on')); return; }
      acct = v.account ? walletOf(v.account) : null; if (v.account && (!acct || acct.currency !== c)) { toast('Pick an account'); return; }
    }
    // editing: the box is what is owed now; the starting amount is whatever makes charges and payments add up to it (at least 1)
    const original = existing ? Math.max(1, amount - chargedOf(existing, todayIso()) + paidOf(existing, todayIso())) : amount;
    // a weekly payment is not a "monthly payment": that old plan is left as it was (the recurring rule is what the card shows), also when a weekly rule is removed; otherwise the box (hidden or not) is the monthly payment
    const fields = { name: v.name.trim(), type: v.type, original_minor: original, monthly_minor: rep === 'weekly' || (!rep && rule && rule.freq === 'weekly') ? (existing ? existing.monthly_minor : 0) : monthly, rate: parseFloat(v.rate) || 0, flat: v.flat === '1' };
    let loan = existing;
    if (existing) Object.assign(existing, fields);
    else { loan = { id: uid(), currency: c, since: monthKey(new Date()), archived: false, payments: [], ...fields }; D().loans.push(loan); }
    // the repeating payment: create or update the recurring rule (listed under Settings > Recurring); Does not repeat removes it (payments already made stay)
    if (rep) {
      const spec = { type: 'expense', debt: loan.id, wallet_id: acct ? acct.id : '', amount_minor: monthly, currency: c, note: loan.name, category_id: loanRepaymentCategory().id };
      if (rule) { const moved = v.next !== rule.next || rule.freq !== rep; Object.assign(rule.spec, spec); rule.freq = rep; if (moved) { rule.start = v.next; rule.next = v.next; } }
      else (D().recurring = D().recurring || []).push({ id: uid(), kind: 'txn', freq: rep, start: v.next, next: v.next, end: '', active: true, spec });
      if (acct) rememberAcct('repay', acct.id);
    } else if (rule) D().recurring = D().recurring.filter((r) => r !== rule);
    Analytics.track(existing ? 'update_debt' : 'add_debt', { has_interest: (parseFloat(v.rate) || 0) > 0, is_recurring: !!rep });
    state.ui.pfTab = 'loan'; save(); close(); render(); toast('Debt saved'); return;
  }
  if (kind === 'lent') {
    const existing = f.dataset.id && D().lent.find((x) => x.id === f.dataset.id), c = existing ? existing.currency : v.currency;
    const amount = toMinor(parseFloat(v.amount), c);
    if (!(amount > 0) || !v.name.trim()) { toast('Enter a name and an amount above zero'); return; }
    const fields = { name: v.name.trim(), original_minor: amount, due: v.due || '', note: v.note.trim() };
    if (existing) Object.assign(existing, fields);
    else D().lent.push({ id: uid(), currency: c, since: monthKey(new Date()), archived: false, payments: [], ...fields });
    Analytics.track(existing ? 'update_lent' : 'add_lent', { has_due_date: !!v.due });
    state.ui.pfTab = 'lent'; save(); close(); render(); toast('Saved'); return;
  }
  if (kind === 'payment') {
    const l = (f.dataset.kind === 'lent' ? D().lent : D().loans).find((x) => x.id === f.dataset.id), amount = toMinor(parseFloat(v.amount), l.currency);
    if (!(amount > 0)) { toast('Enter an amount above zero'); return; }
    const owed = loanBalance(l); const applied = Math.min(amount, owed);
    if (applied <= 0) { toast('Nothing left to pay'); return; }
    const pay = { id: uid(), date: v.date, amount_minor: applied }, acct = v.account ? walletOf(v.account) : null;
    if (acct && f.dataset.kind === 'lent') {
      // the repayment arrives in that account: one transfer-in record there, "<name> Repayment", category Lent Repayment (nothing counts as income)
      const t = { id: uid(), type: 'transfer', flow: 'in', amount_minor: applied, currency: l.currency, occurred_at: v.date, wallet_id: acct.id, note: `${l.name} ${__('Repayment')}`, category_id: lentRepaymentCategory().id, category_source: 'user', ai_confidence: null };
      D().transactions.push(t); pay.txn_id = t.id; rememberAcct('lentrecv', acct.id); sortTxns();
    } else if (acct) {
      // the money comes out of that account: not more than it holds (a credit card may go below zero; a future-dated payment is not checked yet)
      if (acct.type !== 'card' && v.date <= todayIso() && applied > walletBalance(acct)) { toast(__("{name} doesn't have enough balance ({amount} available)", { name: acct.name, amount: money(Math.max(0, walletBalance(acct)), acct.currency) })); return; }
      const t = { id: uid(), type: 'expense', amount_minor: applied, currency: l.currency, occurred_at: v.date, wallet_id: acct.id, note: l.name, category_id: loanRepaymentCategory().id, category_source: 'user', ai_confidence: null };
      D().transactions.push(t); pay.txn_id = t.id; rememberAcct('repay', acct.id); sortTxns();
    } else rememberAcct(f.dataset.kind === 'lent' ? 'lentrecv' : 'repay', '');
    l.payments.push(pay);
    // a repeating payment: a recurring rule (shown in Settings > Recurring). The payment being recorded now is the first one; the next is one period later.
    const rule = v.repeat && f.dataset.kind !== 'lent' ? addRule('txn', v.repeat, v.date, { type: 'expense', debt: l.id, wallet_id: acct ? acct.id : '', amount_minor: amount, currency: l.currency, note: l.name, category_id: loanRepaymentCategory().id }) : null;
    Analytics.track('debt_payment_recorded', { kind: f.dataset.kind, is_recurring: !!rule });
    save(); close(); render(); toast(rule ? __('Recorded. Added to Recurring in Settings.') : applied < amount ? __('Recorded {amount} (the remaining balance)', { amount: money(applied, l.currency) }) : 'Recorded'); return;
  }
  if (kind === 'account') {
    const name = v.name.trim(); if (!name) return;
    if (f.dataset.id) D().investments.find((a) => a.id === f.dataset.id).name = name;
    else D().investments.push({ id: uid(), name, archived: false });
    save(); close(); render(); toast('Account saved');
  }
  if (kind === 'join') { joinSubmit(f, v); return; }
  if (kind === 'invite') { hhInviteSubmit(f, v); return; }
  if (kind === 'member-role') {
    const role = v.role === 'viewer' ? 'viewer' : 'editor';
    try { await Cloud.setRole(f.dataset.id, role); Analytics.track('member_role_changed', { role }); close(); toast(__('Role updated')); loadUserData(); } catch { toast(__("Couldn't do that. Please try again.")); }
    return;
  }
  if (kind === 'support') {
    const msg = (v.message || '').trim(), btn = $('[data-send]', f);
    if (!msg) { toast(__('Write a few words first')); return; }
    if (state.real || !Cloud.configured) { toast(__('Switch back to your own data to send a report')); return; }
    btn.disabled = true; btn.textContent = __('Sending…');
    try {
      await Cloud.submitSupport({ type: v.type === 'feedback' ? 'feedback' : 'bug', message: msg.slice(0, SUPPORT_MAX_CHARS), files: supportShots.map((x) => x.blob),
        context: { language: LANG, theme: THEME, route: location.hash.split('?')[0], viewport: `${innerWidth}x${innerHeight}`, standalone: IS_STANDALONE, currency: cur(), userAgent: navigator.userAgent.slice(0, 200) } });
      supportShots = []; close(); toast(__('Thank you! We received your message.'));
    } catch (err) { btn.disabled = false; btn.textContent = __('Send'); toast(__("Couldn't send: {error}", { error: err.message || 'network error' })); }
    return;
  }
  if (kind === 'recedit') {
    const r = D().recurring.find((x) => x.id === f.dataset.id), sp = r.spec, amount = parseFloat(v.amount);
    if (!(amount > 0)) { toast('Enter an amount above zero'); return; }
    if (v.next < isoDate(new Date())) { toast(__('Pick a date from today on')); return; }
    if (r.kind === 'txn' && sp.debt) {
      const dl = D().loans.find((x) => x.id === sp.debt), dw = v.wallet ? walletOf(v.wallet) : null;
      if (!dl || (v.wallet && (!dw || dw.currency !== dl.currency))) { toast('Pick an account'); return; }
      sp.wallet_id = v.wallet; sp.amount_minor = toMinor(amount, dl.currency);
    } else if (r.kind === 'txn') {
      sp.wallet_id = v.wallet; sp.category_id = v.category || null;
      if (v.wallet.startsWith('h:')) { sp.quantity = amount; sp.currency = 'USD'; sp.amount_minor = Math.max(1, Math.round(amount * 100)); }
      else if (v.wallet.startsWith('l:')) { const l = D().loans.find((x) => 'l:' + x.id === v.wallet); if (!l || sp.type !== 'expense') { toast('Pick an account'); return; } delete sp.quantity; sp.currency = l.currency; sp.amount_minor = toMinor(amount, l.currency); }
      else { const w = walletOf(v.wallet); if (!w) { toast('Pick an account'); return; } delete sp.quantity; sp.currency = w.currency; sp.amount_minor = toMinor(amount, w.currency); }
    } else if (r.kind === 'transfer') {
      const A = walletOf(v.from), B = walletOf(v.to); if (!A || !B || A.id === B.id) { toast('Pick two different accounts'); return; }
      sp.from = A.id; sp.to = B.id; sp.amount_minor = toMinor(amount, A.currency);
      sp.received_minor = A.currency === B.currency ? sp.amount_minor : convert(sp.amount_minor, A.currency, B.currency);
      if (sp.fee_minor && A.currency !== (walletOf(sp.from) || A).currency) sp.fee_minor = 0;
    } else { sp.fund = v.fund; sp.fundamount = String(amount); }
    if (v.next !== r.next) { r.start = v.next; r.next = v.next; }   // later payments keep the new day of the month / week
    // a first payment that is still upcoming (entered by hand when the rule was created) follows the edit; one that already happened is left alone
    const first = firstEntryOf(r);
    if (first) { syncFirstEntry(r, first); sortTxns(); } else if (!sp.debt) delete sp.first_made;
    save(); close(); render(); toast(__('Recurring updated. Entries already made are unchanged.')); return;
  }
  if (kind === 'handoff') { const ok = await claimHandoff(v.code); if (ok) close(); return; }
  if (kind === 'cost') {
    const h = D().holdings.find((x) => x.id === f.dataset.id), price = parseFloat(v.avgprice);
    if (!(price > 0)) { toast('Enter a price above zero'); return; }
    if (!h.ccy) h.ccy = v.pccy || cur();
    h.open_price = price; save(); close(); render(); toast('Average price saved'); return;
  }
  if (kind === 'trade') {
    const h = D().holdings.find((x) => x.id === f.dataset.id), info = assetInfo(h.symbol), src = parseSource(v.source), side = v.side;
    const qty = parseFloat(v.quantity), amount = parseAmount(src, v.amount);
    if (!(qty > 0) || !(amount > 0)) { toast('Enter a quantity and an amount above zero'); return; }
    if (side === 'sell' && qty > heldNow(h) + 1e-12) { toast(__('You only hold {qty} {symbol}', { qty: qtyFmt(heldNow(h), h), symbol: info.symbol })); return; }
    const fee = v.fee ? (src.kind === 'wallet' ? toMinor(parseFloat(v.fee), src.wallet.currency) : side === 'sell' && !info.cash ? parseFloat(v.fee) : 0) : 0; if (!(fee >= 0)) { toast('The fee must be zero or more'); return; }
    const short = payShortfall(src, side, amount + (side === 'buy' ? fee : 0)); if (short) { toast(short); return; }   // a buy needs the fee on top of the amount
    recordTrade(h, { side, quantity: qty, source: src, amount, date: v.date, price: parseFloat(v.price), fee });
    Analytics.track('trade_recorded', { side });
    save(); close(); render(); toast(`${side === 'buy' ? __('Bought') : __('Sold')} ${qtyFmt(qty, h)} ${info.symbol}`); return;
  }
  if (kind === 'holding' && f.dataset.sell) {
    const h = D().holdings.find((x) => x.id === v.sellasset), src = parseSource(v.fund);
    if (!h) { toast(__('Pick an asset you hold')); return; }
    const qty = parseFloat(v.quantity), amount = src ? parseAmount(src, v.fundamount) : 0;
    if (!(qty > 0) || !(amount > 0)) { toast('Enter a quantity and an amount above zero'); return; }
    if (qty > heldNow(h) + 1e-12) { toast(__('You only hold {qty} {symbol}', { qty: qtyFmt(heldNow(h), h), symbol: assetInfo(h.symbol).symbol })); return; }
    const fee = v.fee ? (src.kind === 'wallet' ? toMinor(parseFloat(v.fee), src.wallet.currency) : parseFloat(v.fee)) : 0; if (!(fee >= 0)) { toast('The fee must be zero or more'); return; }
    recordTrade(h, { side: 'sell', quantity: qty, source: src, amount, date: v.date, fee });
    state.ui.pfTab = 'investment'; rememberAcct('investsell', v.fund);
    save(); close(); render(); toast(`${__('Sold')} ${qtyFmt(qty, h)} ${assetInfo(h.symbol).symbol}`); return;
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
      if (meta.cash) D().customAssets[sym] = { symbol: meta.cash, name: meta.name, type: 'cash', cash: meta.cash };
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
    if (src && src.kind === 'holding' && assetInfo(src.holding.symbol).type === 'cash' && src.holding.account_id !== v.account) { toast('That cash balance belongs to another investment account'); return; }
    const fee = src && src.kind === 'wallet' && v.fee ? toMinor(parseFloat(v.fee), src.wallet.currency) : 0; if (!(fee >= 0)) { toast('The fee must be zero or more'); return; }
    if (src) { const short = payShortfall(src, 'buy', paid + fee); if (short) { toast(short); return; } }
    let h = D().holdings.find((x) => x.account_id === v.account && x.symbol === sym);
    if (!h) { h = { id: uid(), account_id: v.account, symbol: sym, quantity: 0, since: monthKey(new Date()), trades: [] }; D().holdings.push(h); }
    if (src) {
      recordTrade(h, { side: 'buy', quantity: qty, source: src, amount: paid, date: v.date || isoDate(new Date()), fee });
      if (v.repeat && f.dataset.invest) addRule('invest', v.repeat, v.date || isoDate(new Date()), { account: v.account, symbol: sym, quantity: qty, fund: v.fund, fundamount: v.fundamount });
    } else addOpening(h, qty, parseFloat(v.avgprice), v.pccy);
    if (f.dataset.invest) { state.ui.pfTab = 'investment'; rememberAcct('invest', v.fund); rememberAcct('investacct', v.account); }
    Analytics.track('add_asset', { funded: !!src });
    save(); close(); render(); toast(`${assetInfo(sym).symbol} ${src ? 'bought' : 'added'}${src ? ` · ${qtyFmt(paid)} ${sourceUnit(src)} paid` : ''}`);
  }
});

/* within a session each page keeps its scroll position: leaving a page remembers where you were, coming back puts you there (a page you have not visited yet opens at the top) */
const scrollPos = {}, pageKey = () => location.hash.split('?')[0] || '#/overview';
let lastKey = pageKey();
const forgetScroll = (key) => { delete scrollPos[key]; };   // used when a button opens a page with a new filter: that view starts at the top
window.addEventListener('hashchange', () => {
  scrollPos[lastKey] = lockY !== null ? lockY : window.scrollY; lastKey = pageKey();
  Analytics.page();
  render(); window.scrollTo(0, scrollPos[lastKey] || 0);
});
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
  if (kind === 'signup' && !a.agree) { toast(__('Please agree to the Privacy Policy and the Terms of Service first.')); return; }   // nothing is cleared: the form stays as typed
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
      else {
        Analytics.track('signed_up', { confirmed: !!data.session });
        // email confirmation is on: wait for the link
        if (!data.session) { a.view = 'sent'; startPolling(a.email, v.password); }
      }
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

/* a new session (sign-in, sign-out) always starts on the current period, never on "All periods" or an old period */
const resetPeriodView = () => { state.ui.allPeriods = false; state.ui.monthSrc = null; };
/* a new login or a logout starts clean: the Overview page, the top of the page, no remembered scroll positions, the current period.
   The hash is replaced (not assigned) so the browser does not run a second render. */
function resetSessionView() {
  resetPeriodView(); state.ui.onbSkipped = undefined; state.ui.onbSeen = false; state.ui.congrats = false; Object.keys(scrollPos).forEach((k) => delete scrollPos[k]);
  if (!joinState) { history.replaceState(null, '', '#/overview'); lastKey = '#/overview'; }   // the Join page keeps its own address
  window.scrollTo(0, 0);
}
async function onAuth(event, session) {
  const a = state.auth;
  if (event === 'PASSWORD_RECOVERY') { Object.assign(a, { status: 'in', view: 'recovery', error: '', notice: '' }); render(); return; }
  if (!session) { hhSeen = false; Analytics.reset(); Analytics.page(); state.data = null; state.real = null; resetSessionView(); Cloud.forget(); Object.assign(a, { status: 'out', uid: null }); if (a.view === 'recovery') a.view = 'signin'; render(); window.scrollTo(0, 0); return; }
  stopPolling(); a.email = session.user.email || a.email;
  Analytics.identify(session.user.id); Analytics.page();
  if (a.uid === session.user.id && state.data) return;   // token refresh or tab refocus: nothing to reload
  if (event === 'SIGNED_IN') { resetSessionView(); Analytics.track('signed_in'); } else resetPeriodView();   // a real login opens Overview at the top; reopening the app with a saved session keeps the page you were on
  Object.assign(a, { status: 'in', uid: session.user.id, loadError: '', view: a.view === 'recovery' ? 'recovery' : 'signin', error: '', notice: '' });
  render(); loadUserData();
}
let loadSeq = 0;
async function loadUserData() {
  const mine = ++loadSeq;   // a reload can start twice (sign-in events arrive in pairs); only the newest one may apply its result
  try {
    state.real = null;   // leave demo mode while reloading; it is switched back on below if you had it on
    const before = hhSeen ? `${Cloud.household.status}:${Cloud.household.role}` : '';
    const loaded = await Cloud.load();
    if (mine !== loadSeq) return;   // a newer load took over
    const nowAcc = `${Cloud.household.status}:${Cloud.household.role}`;
    if (before && before !== nowAcc && loaded) toast(__('Your access changed.'));   // the owner changed your role while the app was open
    hhSeen = true;
    state.auth.noAccess = !loaded;   // removed, never joined, or the household was deleted: the "no longer have access" page
    if (!loaded) { state.data = null; render(); return; }
    state.real = null; state.data = loaded;
    state.data.livePrices = loadPrices();
    const addedCats = ensureDefaultCategories(), addedFee = ensureFeeCategory(), addedSales = backfillSaleRecords(), addedCash = convertCashTrades(); if (addedCats || addedFee || addedSales || addedCash) save();   // every account has the default categories (see above) and Fee; earlier transfer fees get Fee
    if (api.finnhub || api.yahoo) refreshPrices(true);
    Analytics.person(state.data.profile);
    if (state.data.profile.theme && THEMES.includes(state.data.profile.theme)) applyTheme(state.data.profile.theme);
    if (state.data.profile.language && LANGS[state.data.profile.language]) { setLang(state.data.profile.language); render(); }   // your saved choice wins over this device's
    hhStartPolling(); hhLoadInvites();
    if (demoWanted()) await setDemo(true);
    else setTimeout(recurringNow, 300);
  } catch (err) { state.auth.loadError = err.message || 'network error'; }
  render();
}
/* a failed save leaves the screen ahead of the database, so show the server's truth again */
function onSaveError(err) {
  console.error(err);
  toast(householdSaveError(err) || __("Couldn't save your last change ({error}). Showing your saved data.", { error: String(err.message || err).slice(0, 80) }));
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
    d.profile = { ...own.profile, sample: null, period: 25 }; d.livePrices = own.livePrices || {};
    state.real = own; state.data = d;
  } else { state.data = state.real; state.real = null; }
  try { localStorage.setItem(DEMO_KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
  Object.assign(state.ui, { pf: null, pfTab: 'savings', cat: '', wallet: '', occ: '', q: '' });
  render();
}
const demoBar = () => `<div class="demo-bar" role="status"><span class="demo-long">${__("🧪 You're viewing {sample}. Your own data is safe, and changes made here aren't saved.", { sample: '<b>' + __('sample data') + '</b>' })}</span><span class="demo-short">🧪 <b>${__('Sample data')}</b> · ${__("not saved")}</span><button class="btn secondary" data-act="demo-off">${__('Back to my data')}</button></div>`;
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
consumeHandoffFromUrl();
joinBoot();
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
