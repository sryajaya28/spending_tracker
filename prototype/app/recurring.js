'use strict';
/* Stiver app: recurring rules: a rule repeats an expense, income, transfer or investment buy every week or month, and the catch-up that creates the due entries. Part of the former prototype/app.js; see docs/MAP.md. Top-level names: REPEATS, repeatField, dateOf, nthDate, nextAfter, detId, addRule, debtPaymentDue, generateRecurring, plainAccount, firstEntryOf, syncFirstEntry, linkFirstEntries, relinked, runRecurring, recurringNow, ruleTitle, ruleAmount, syncRuleUnit, ruleDialog, recurringCard. */
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

