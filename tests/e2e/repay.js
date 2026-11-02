const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Paying a loan from an account: the account goes down, it counts as an expense in the Loan Payment category, the loan goes down,
   and the lists show one record (the account's). */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell'); await p.waitForTimeout(400);
  const settle = () => p.evaluate(() => Cloud.idle()), log = () => p.evaluate(() => window.__log.splice(0));
  await p.evaluate(() => { state.ui.onbSkipped = true; const w = D().wallets[0]; w.name = 'BCA'; w.opening_balance_minor = 5000000; D().loans.push({ id: 'loan1', name: 'Car loan', type: 'car', currency: w.currency, original_minor: 3000000, monthly_minor: 400000, rate: 5, since: '2026-01', archived: false, payments: [] }); location.hash = '#/portfolio'; save(); render(); });
  await settle(); await log();
  const open = () => p.evaluate(() => paymentDialog(D().loans[0], 'loan'));
  const st = () => p.evaluate(() => { const l = D().loans[0], w = D().wallets[0]; return { wallet: walletBalance(w), loan: loanBalance(l), pays: l.payments.length, tx: D().transactions.filter((t) => catOf(t.category_id) && catOf(t.category_id).name === 'Loan Payment').map((t) => ({ type: t.type, cat: catOf(t.category_id).name, amt: t.amount_minor, w: t.wallet_id === w.id, id: t.id })), linked: l.payments.every((x) => !x.txn_id || D().transactions.some((t) => t.id === x.txn_id)) }; });
  // 1. the field is there, defaulting to an account; paying from it (the button says Submit Payment)
  await open(); await p.waitForSelector('#dlg select[name=account]'); assert.equal((await p.innerText('#dlg button[type=submit]')).trim(), 'Submit Payment'); await p.click('#dlg .dlg-x');
  await open(); await p.waitForSelector('#dlg select[name=account]'); assert.equal(await p.$eval('#dlg select[name=account]', (s) => s.options[s.selectedIndex].textContent.startsWith('BCA')), true, 'an account is preselected');
  assert((await p.$$eval('#dlg select[name=account] option', (o) => o.map((x) => x.textContent))).some((x) => /No account/.test(x)), 'and you can record without an account');
  await p.fill('#dlg [name=amount]', '400000'); await p.click('#dlg button[type=submit]'); await settle();
  let r = await st(); assert.deepEqual([r.wallet, r.loan, r.pays], [4600000, 2600000, 1], 'account and loan both go down: ' + JSON.stringify(r));
  assert.equal(r.tx.length, 1); assert.deepEqual([r.tx[0].type, r.tx[0].cat, r.tx[0].amt, r.tx[0].w], ['expense', 'Loan Payment', 400000, true]); assert(r.linked);
  const spent = await p.evaluate(() => sumBy(inMonth(currentPeriod()), 'expense')); assert.equal(spent, 400000, 'it counts as spending');
  // the database rows: the payment points at its expense
  const dp = (await log()).filter((o) => o.table === 'debt_payments').flatMap((o) => o.rows || []); assert(dp.some((x) => x.kind === 'payment' && x.transaction_id), JSON.stringify(dp));
  // 2. one record in the lists: the loan's Transactions view shows only the account's expense (with a minus), and the normal list shows it once
  await p.evaluate(() => { Object.assign(state.ui, { wallet: 'l:loan1', q: '', cat: '', occ: '', month: currentPeriod(), allPeriods: false }); location.hash = '#/transactions'; render(); }); await p.waitForSelector('#txn-list .day-row'); await p.click('[data-act=days-all]');
  let rows = await p.$$eval('#txn-list .day-body .row', (e) => e.map((x) => ({ t: x.querySelector('.title').textContent.trim(), a: x.querySelector('.amt').textContent.trim(), s: x.querySelector('.sub').textContent.trim() })));
  assert.equal(rows.length, 1, 'one record in the loan view: ' + JSON.stringify(rows)); assert(rows[0].t === 'Car loan' && rows[0].a.startsWith('−') && /Loan Payment/.test(rows[0].s) && /BCA/.test(rows[0].s), JSON.stringify(rows));
  await p.evaluate(() => { state.ui.wallet = ''; render(); }); assert.equal(await p.$$eval('#txn-list .row[data-id]', (e) => e.length) >= 0, true);
  assert.equal(await p.evaluate(() => filteredTxns().filter((t) => t.note === 'Car loan').length), 1, 'once in the normal list');
  // 3. editing the expense moves the loan's payment with it; deleting it takes the payment away and restores both balances
  const tid = r.tx[0].id;
  await p.evaluate((i) => txnDialog(D().transactions.find((t) => t.id === i)), tid); await p.waitForSelector('#dlg [name=amount]'); await p.fill('#dlg [name=amount]', '300000'); await p.click('#dlg button[type=submit]'); await settle();
  r = await st(); assert.deepEqual([r.wallet, r.loan, r.pays], [4700000, 2700000, 1], 'edit follows: ' + JSON.stringify(r));
  await p.evaluate((i) => { document.body.insertAdjacentHTML('beforeend', `<button id="deltx" data-act="delete-txn" data-id="${i}" hidden></button>`); document.getElementById('deltx').click(); }, tid); await settle();
  r = await st(); assert.deepEqual([r.wallet, r.loan, r.pays, r.tx.length], [5000000, 3000000, 0, 0], 'delete restores everything: ' + JSON.stringify(r));
  // 4. not more than the account holds; a payment without an account only lowers the loan (and shows as the loan's own payment row)
  await open(); await p.waitForSelector('#dlg select[name=account]'); await p.fill('#dlg [name=amount]', '600000'); await p.evaluate(() => { D().wallets[0].opening_balance_minor = 100000; });
  await p.click('#dlg button[type=submit]'); await p.waitForTimeout(150); assert((await p.evaluate(() => document.getElementById('toast').textContent)).includes('enough balance'), 'refused'); assert.equal((await st()).pays, 0, 'nothing saved');
  await p.selectOption('#dlg select[name=account]', ''); await p.click('#dlg button[type=submit]'); await settle();
  r = await st(); assert.deepEqual([r.pays, r.tx.length, r.loan], [1, 0, 2400000], 'no account: payment only: ' + JSON.stringify(r));
  await p.evaluate(() => { Object.assign(state.ui, { wallet: 'l:loan1', month: currentPeriod() }); render(); location.hash = '#/transactions'; render(); }); await p.waitForSelector('#txn-list .day-row'); await p.click('[data-act=days-all]');
  assert.equal(await p.$$eval('#txn-list .day-body .row', (e) => e.filter((x) => /Loan payment/.test(x.textContent)).length), 1, 'the unlinked payment still shows as the loan\'s own row');
  // 5. Edit loan shows what is owed now (not the starting amount) and typing a new balance sets exactly that balance
  await p.evaluate(() => { const l = D().loans[0]; l.payments = [{ id: uid(), date: todayIso(), amount_minor: 259085 }, { id: uid(), date: todayIso(), amount_minor: 73800, kind: 'charge', txn_id: null }]; l.original_minor = 623960; render(); });
  const owed = await p.evaluate(() => loanBalance(D().loans[0])); assert.equal(owed, 623960 + 73800 - 259085);
  await p.evaluate(() => loanDialog(D().loans[0])); await p.waitForSelector('#dlg [name=amount]');
  assert.equal(await p.inputValue('#dlg [name=amount]'), String(owed), 'the box shows the current balance'); assert.equal((await p.innerText('#dlg label:has([name=amount])')).trim().startsWith('Amount owed now'), true);
  await p.fill('#dlg [name=amount]', '500000'); await p.click('#dlg button[type=submit]'); await settle();
  assert.deepEqual(await p.evaluate(() => { const l = D().loans[0]; return [loanBalance(l), l.payments.length, l.original_minor]; }), [500000, 2, 500000 - 73800 + 259085], 'balance is what was typed, payments and charges kept');
  // the category is reused: still exactly one top-level "Loan Payment" after payments were made from an account
  assert.equal(await p.evaluate(() => D().categories.filter((c) => !c.parent_id && c.name === 'Loan Payment').length), 1, 'one Loan Payment category');
  // 5b. a payment recorded without an account can be deleted from the app: open its row in the loan's Transactions view, Delete payment
  await p.evaluate(() => { const l = D().loans[0]; l.payments = [{ id: 'pay1', date: todayIso(), amount_minor: 259085 }]; l.original_minor = 986745; Object.assign(state.ui, { wallet: 'l:loan1', q: '', cat: '', occ: '', month: currentPeriod(), allPeriods: false }); location.hash = '#/transactions'; render(); });
  await p.waitForSelector('#txn-list .day-row'); await p.click('[data-act=days-all]'); await p.click('#txn-list .day-body .row[data-act=loan-payment]'); await p.waitForSelector('#dlg [data-act=delete-payment]');
  assert((await p.innerText('#dlg')).replace(/\u00a0/g, ' ').includes('259.085'), 'the pop-up shows the payment'); assert.equal(await p.evaluate(() => loanBalance(D().loans[0])), 986745 - 259085);
  await p.click('#dlg [data-act=delete-payment]'); await settle();
  assert.deepEqual(await p.evaluate(() => [D().loans[0].payments.length, loanBalance(D().loans[0]), document.getElementById('dlg').open]), [0, 986745, false], 'deleted, balance back up, pop-up closed');
  // 6. an archived loan is listed under Archived on the Loan tab and Reopen brings it back with its payments
  await p.evaluate(() => { D().loans[0].archived = true; state.ui.pfTab = 'loan'; location.hash = '#/portfolio'; render(); });
  assert.equal(await p.evaluate(() => D().loans.filter((l) => !l.archived).length), 0); await p.click('[data-act=loans-archived]'); await p.waitForSelector('#dlg [data-act=unarchive-loan]'); assert((await p.innerText('#dlg')).includes('Car loan'));
  await p.click('#dlg [data-act=unarchive-loan]'); await settle(); assert.deepEqual(await p.evaluate(() => [D().loans[0].archived, D().loans[0].payments.length, document.getElementById('dlg').open]), [false, 0, false], 'reopened (nothing lost), pop-up closed');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
