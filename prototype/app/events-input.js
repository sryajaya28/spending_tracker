'use strict';
/* Stiver app: the delegated listeners, part 1: click (data-act), keydown, input and change handlers, the asset search and pick, and the Settings controls. Part of the former prototype/app.js; see docs/MAP.md. Top-level names: searchTimer, runAssetSearch, pickAsset, applySetting. */
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
  else if (act === 'reset-filters') { Object.assign(state.ui, { q: '', cat: '', occ: '', wallet: '', who: '' }); render(); }
  else if (act === 'open-filters') filtersDialog();  // the filter button (2+ writers)
  else if (act === 'clear-filter') { state.ui[id] = ''; Analytics.track('filter_changed', { filter: id, active: false }); refreshFilterUi(); }
  else if (act === 'filters-reset') { Object.assign(state.ui, { cat: '', occ: '', wallet: '', who: '' }); filtersDialog(); refreshFilterUi(); }
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
  else if (act === 'lent-origin') { const l = find(D().lent), t = D().transactions.find((x) => x.id === el.dataset.tid); if (l && t) lentOriginDialog(l, t); }
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
  else if (act === 'hero-balance') location.hash = '#/portfolio';   // Overview hero chip: Balance lives on Portfolio (Net worth)
  else if (act === 'hero-budget') location.hash = '#/budgets';   // Overview hero sub-line / bar
  else if (act === 'demo-on') { Analytics.track('demo_on', {}, true); setDemo(true); }
  else if (act === 'onb-skip') skipOnboarding();
  else if (act === 'congrats-add') { endCongrats(); txnDialog(null, 'expense'); }   // on to the normal Overview, with the Add transaction pop-up open
  else if (act === 'toggle-info') { state.ui.infoOpen = state.ui.infoOpen === id ? null : id; render(); }
  else if (act === 'toggle-hide-balance') { setHideBal(!hideBal()); Analytics.track('balance_visibility_changed', { hidden: hideBal() }); render(); }
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
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.row[data-act], .hero-bud[data-act]')) e.target.click(); if (e.key === 'Escape' && state.ui.walletMenu) { state.ui.walletMenu = null; render(); } });

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
  else if (t.matches('select[data-filter]')) { state.ui[t.dataset.filter] = t.value; t.classList.toggle('f-on', !!t.value); refreshFilterUi(); }
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
      if (!t.form.dataset.id) { const w = t.form.wallet, keep = recallAcct(t.value, acctOptions(t.value, '')) || w.value; w.innerHTML = acctOptions(t.value, keep); syncSearch(w, 'Account not found'); if (![...w.options].some((o) => o.value === keep)) w.selectedIndex = 0; syncTxnUnit(t.form); }   // "new" coin options exist for income only
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
