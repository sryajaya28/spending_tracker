const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* A loan account can pay for an expense: the expense counts as spending and the loan balance goes up by the same amount. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle()), log = () => p.evaluate(() => window.__log.splice(0));
  const ids = await p.evaluate(() => { const l = { id: uid(), name: 'Visa card', type: 'card', currency: 'IDR', original_minor: 1000000, monthly_minor: 100000, rate: 0, since: monthKey(new Date()), archived: false, payments: [] }; D().loans.push(l); D().wallets[0].opening_balance_minor = 5000000; save(); render(); return { loan: l.id, wallet: D().wallets[0].id }; }); await settle(); await log();
  const bal = () => p.evaluate(() => loanBalance(D().loans[0])), wbal = () => p.evaluate(() => walletBalance(D().wallets[0])), spent = () => p.evaluate(() => sumBy(inMonth(currentPeriod()), 'expense'));
  // the loan is offered for expenses only
  await p.evaluate(() => txnDialog(null, 'expense')); let groups = await p.$$eval('select[name=wallet] optgroup', (g) => g.map((x) => x.label)); assert(groups.includes('Loan Account'), JSON.stringify(groups)); await p.click('[data-act=close]');
  await p.evaluate(() => txnDialog(null, 'income')); groups = await p.$$eval('select[name=wallet] optgroup', (g) => g.map((x) => x.label)); assert(!groups.includes('Loan Account'), 'income cannot go to a loan'); await p.click('[data-act=close]');
  // 1. pay an expense with the loan: spending counts, the loan goes up, the bank is untouched
  const w0 = await wbal(), s0 = await spent();
  await p.evaluate(() => txnDialog(null, 'expense')); await p.selectOption('select[name=wallet]', 'l:' + ids.loan); assert((await p.innerText('[data-amt-label]')).includes('IDR')); await p.fill('input[name=amount]', '150000'); await p.fill('textarea[name=note], input[name=note]', 'Laptop bag'); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await bal(), 1150000, 'balance went up by the amount'); assert.equal(await wbal(), w0, 'bank unchanged'); assert.equal(await spent(), s0 + 150000, 'counts as spending');
  const t1 = await p.evaluate(() => { const t = D().transactions.find((x) => x.note === 'Laptop bag'); return { wallet_id: t.wallet_id, loan_id: t.loan_id, where: txnWhere(t) }; }); assert.equal(t1.wallet_id, null); assert.equal(t1.loan_id, ids.loan); assert.equal(t1.where, 'Visa card');
  // saved: the expense points at the loan, the charge points at the expense
  const l = await log(); const trow = l.filter((o) => o.table === 'transactions').flatMap((o) => o.rows).find((r) => r.note === 'Laptop bag'), prow = l.filter((o) => o.table === 'debt_payments').flatMap((o) => o.rows).find((r) => r.kind === 'charge');
  assert(trow && trow.debt_id === ids.loan && trow.wallet_id === null, JSON.stringify(trow)); assert(prow && prow.transaction_id === trow.id && prow.amount_minor === 150000, JSON.stringify(prow));
  const back = await p.evaluate(async () => { const d = await Cloud.load(); const t = d.transactions.find((x) => x.note === 'Laptop bag'), l0 = d.loans[0]; return { loan_id: t.loan_id, wallet_id: t.wallet_id, charges: l0.payments.filter((x) => x.kind === 'charge').map((x) => [x.amount_minor, x.txn_id === t.id]) }; });
  assert.equal(back.loan_id, ids.loan, 'loads back with its loan'); assert.deepEqual(back.charges, [[150000, true]], 'the charge loads back linked to the expense');
  // 2. the loan card shows it
  await p.evaluate(() => { state.ui.pfTab = 'loan'; location.hash = '#/portfolio'; render(); }); await p.waitForSelector('[data-act=history-loan]'); const card = await p.innerText('.main'); assert(card.includes('charged to this account'), card.slice(0, 400)); assert.equal(await p.$$eval('.main .pay-row', (e) => e.length), 0, 'the card does not list the history itself');
  await p.click('[data-act=history-loan]'); await p.waitForSelector('#dlg .pay-row'); const hd = await p.innerText('#dlg'); assert(hd.includes('charged') && hd.includes('Balance') && hd.includes('Original amount'), hd.slice(0, 300)); await p.click('#dlg [data-act=close]');
  // 3. a payment still lowers it; editing the amount, then moving it to the bank, then deleting
  await p.evaluate(() => { const l0 = D().loans[0]; l0.payments.push({ id: uid(), date: isoDate(new Date()), amount_minor: 100000 }); }); assert.equal(await bal(), 1050000);
  await p.evaluate(() => { location.hash = '#/transactions'; render(); }); await p.evaluate(() => txnDialog(D().transactions.find((x) => x.note === 'Laptop bag'))); assert.equal(await p.inputValue('select[name=wallet]'), 'l:' + ids.loan, 'edit shows the loan account');
  await p.fill('input[name=amount]', '200000'); await p.click('#dlg button[type=submit]'); await settle(); assert.equal(await bal(), 1100000, 'edit raised the charge');
  await p.evaluate(() => txnDialog(D().transactions.find((x) => x.note === 'Laptop bag'))); await p.selectOption('select[name=wallet]', ids.wallet); await p.click('#dlg button[type=submit]'); await settle(); assert.equal(await bal(), 900000, 'moved to the bank: charge removed'); assert.equal(await p.evaluate(() => D().transactions.find((x) => x.note === 'Laptop bag').loan_id), undefined);
  await p.evaluate(() => txnDialog(D().transactions.find((x) => x.note === 'Laptop bag'))); await p.selectOption('select[name=wallet]', 'l:' + ids.loan); await p.click('#dlg button[type=submit]'); await settle(); assert.equal(await bal(), 1100000);
  await p.evaluate(() => txnDialog(D().transactions.find((x) => x.note === 'Laptop bag'))); await p.click('[data-act=delete-txn]'); await settle(); assert.equal(await bal(), 900000, 'deleting the expense removes the charge'); assert.equal(await p.evaluate(() => D().loans[0].payments.filter((x) => x.kind === 'charge').length), 0);
  // 4. recurring from a loan account makes the expense and the charge once per date
  const r = await p.evaluate((id) => { const rule = addRule('txn', 'monthly', '2026-01-10', { type: 'expense', amount_minor: 50000, currency: 'IDR', wallet_id: 'l:' + id, note: 'Streaming', category_id: null }); generateRecurring(rule, '2026-01-10'); generateRecurring(rule, '2026-01-10'); generateRecurring(rule, '2026-02-10'); return { txns: D().transactions.filter((t) => t.note === 'Streaming').length, charges: D().loans[0].payments.filter((x) => x.kind === 'charge').length }; }, ids.loan);
  assert.deepEqual(r, { txns: 2, charges: 2 }, JSON.stringify(r));
  // the pages render with a loan-paid expense in the data
  for (const h of ['#/overview', '#/transactions', '#/portfolio', '#/settings']) { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(150); }
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message.slice(0, 400), (e.stack || '').split('\n').filter((l) => l.includes('loanpay.js')).slice(0, 2).join(' | ')); process.exit(1); });
