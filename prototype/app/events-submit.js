'use strict';
/* Stiver app: the delegated listeners, part 2: the submit handler for every data-form, scroll position memory, the hash-change handler and the unsaved-changes warning. Part of the former prototype/app.js; see docs/MAP.md. Top-level names: scrollPos, lastKey, forgetScroll. */
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
    const existing = f.dataset.id && D().lent.find((x) => x.id === f.dataset.id), tx = existing && existing.txn_id && D().transactions.find((x) => x.id === existing.txn_id);
    if (tx && !canEditRec(tx)) { Object.assign(existing, { due: v.due || '', note: (v.note || '').trim() }); Analytics.track('update_lent', { has_due_date: !!v.due, has_account: true }); save(); close(); render(); toast('Saved'); return; }   // someone else's: only the due date and note
    const acct = v.account ? walletOf(v.account) : null, older = !!existing && !tx;
    if (!older && !acct) { toast('Choose the account the money comes from'); return; }
    const c = older ? existing.currency : acct.currency, amount = toMinor(parseFloat(v.amount), c), name = (v.name || '').trim(), date = older ? '' : (v.date || todayIso());
    if (!(amount > 0) || !name) { toast('Enter a name and an amount above zero'); return; }
    const repaid = existing ? existing.payments.reduce((s, p) => s + p.amount_minor, 0) : 0;   // repayments recorded or scheduled: the principal cannot drop below them (the transfer would refund more than is owed)
    if (repaid > amount) { toast(__("The amount can't be less than what has been repaid ({amount})", { amount: money(repaid, c) })); return; }
    if (!older && date > todayIso()) { toast("The date can't be in the future"); return; }
    if (!older && date <= todayIso()) { const back = tx && tx.wallet_id === acct.id && tx.occurred_at <= todayIso() ? tx.amount_minor : 0, avail = walletBalance(acct) + back; if (amount > avail) { toast(__("{name} doesn't have enough balance ({amount} available)", { name: acct.name, amount: money(Math.max(0, avail), acct.currency) })); return; } }
    const fields = { name, original_minor: amount, due: v.due || '', note: (v.note || '').trim() };
    if (older) Object.assign(existing, fields);
    else if (tx) { Object.assign(tx, { amount_minor: amount, currency: c, occurred_at: date, wallet_id: acct.id, note: name }); Object.assign(existing, fields, { currency: c, since: monthKey(new Date(date + 'T00:00')) }); sortTxns(); }
    else {
      const t = { id: uid(), type: 'transfer', flow: 'out', amount_minor: amount, currency: c, occurred_at: date, wallet_id: acct.id, note: name, category_id: lentCategory().id, category_source: 'user', ai_confidence: null };
      D().transactions.push(t); sortTxns(); rememberAcct('lentfrom', acct.id);
      D().lent.push({ id: uid(), currency: c, since: monthKey(new Date(date + 'T00:00')), archived: false, payments: [], txn_id: t.id, ...fields });
    }
    Analytics.track(existing ? 'update_lent' : 'add_lent', { has_due_date: !!v.due, has_account: !older });
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

