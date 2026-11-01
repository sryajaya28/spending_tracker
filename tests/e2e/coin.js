const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Income received into, and expenses paid from, USDT held in an investment account. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle()), log = () => p.evaluate(() => window.__log.splice(0));
  let hid = await p.evaluate(() => { const a = { id: uid(), name: 'Exchange', archived: false }; D().investments.push(a); const h = { id: uid(), account_id: a.id, symbol: 'USDT', quantity: 1000, since: '2026-01', trades: [] }; D().holdings.push(h); save(); render(); return h.id; });
  await settle(); await log();
  const qty = () => p.evaluate((id) => D().holdings.find((h) => h.id === id).quantity, hid);
  const add = async (type, amount, note) => { await p.evaluate(() => txnDialog(null)); await p.click(`#dlg label:has(input[name=type][value=${type}])`); await p.selectOption('select[name=wallet]', 'h:' + hid); await p.fill('input[name=amount]', String(amount)); await p.fill('textarea[name=note]', note); await p.click('#dlg button[type=submit]'); await settle(); };
  // the dialog offers the coin and switches the amount unit
  await p.evaluate(() => txnDialog(null)); assert((await p.innerText('select[name=wallet]')).includes('Exchange') && !(await p.innerText('select[name=wallet]')).includes('(USDT)')); await p.selectOption('select[name=wallet]', 'h:' + hid); assert((await p.innerText('[data-amt-label]')).includes('USDT')); await p.click('[data-act=close]');
  await add('income', 250.5, 'Salary USDT'); assert.equal(await qty(), 1250.5);
  let l = await log(); const ev = l.find((o) => o.table === 'holding_events'), tx = l.find((o) => o.table === 'transactions');
  assert(ev && ev.rows.some((r) => r.note === 'income' && +r.quantity_delta === 250.5), JSON.stringify(ev)); assert(tx.rows[0].wallet_id === null && tx.rows[0].holding_event_id && tx.rows[0].currency === 'USD' && tx.rows[0].amount_minor === 25050 && tx.rows[0].type === 'income');
  await add('expense', 100, 'Hosting'); assert.equal(await qty(), 1150.5);
  // not enough coins
  await p.evaluate(() => txnDialog(null)); await p.selectOption('select[name=wallet]', 'h:' + hid); await p.fill('input[name=amount]', '99999'); await p.click('#dlg button[type=submit]');
  assert.equal(await qty(), 1150.5, 'overspend refused'); await p.click('[data-act=close]');
  // counts as income/spending, not wallet money; shows the coin as its place
  const totals = await p.evaluate(() => ({ inc: sumBy(inMonth(state.ui.month), 'income'), exp: sumBy(inMonth(state.ui.month), 'expense'), cash: walletBalance(D().wallets[0]) }));
  assert(totals.inc > 0 && totals.exp > 0 && totals.cash === 0, JSON.stringify(totals));
  assert.equal(await p.evaluate(() => txnWhere(D().transactions.find((t) => t.note === 'Hosting'))), 'Exchange');
  // saved and loaded back from the database rows
  const back = await p.evaluate(async () => { const d = await Cloud.load(); const h = d.holdings.find((x) => x.symbol === 'USDT'); return { q: h.quantity, kinds: h.trades.map((t) => t.kind).sort(), txn: d.transactions.filter((t) => !t.wallet_id).length }; });
  assert.deepEqual(back, { q: 1150.5, kinds: ['expense', 'income'], txn: 2 });
  // edit the expense amount, then delete the income (would leave the coins negative only if spent beyond)
  await p.evaluate(() => { location.hash = '#/transactions'; });
  await p.evaluate(() => txnDialog(D().transactions.find((t) => t.note === 'Hosting'))); assert.equal(await p.inputValue('input[name=amount]'), '100');
  await p.fill('input[name=amount]', '60'); await p.click('#dlg button[type=submit]'); await settle(); assert.equal(await qty(), 1190.5);
  await p.evaluate(() => txnDialog(D().transactions.find((t) => t.note === 'Hosting'))); await p.click('[data-act=delete-txn]'); await settle(); assert.equal(await qty(), 1250.5);
  assert.equal(await p.evaluate(() => D().transactions.filter((t) => t.note === 'Hosting').length), 0);
  // income into USDT without holding any yet: the holding is created on save
  await p.evaluate(() => { D().holdings = []; D().transactions = D().transactions.filter((x) => !x.trade_id); render(); });
  await p.evaluate(() => txnDialog(null)); assert(!(await p.innerHTML('select[name=wallet]')).includes('n:USDT'), 'no new-coin choice for expenses');
  await p.click('#dlg label:has(input[name=type][value=income])'); const optv = await p.$$eval('select[name=wallet] option', (o) => o.map((x) => x.value)); assert(optv.some((v) => v.startsWith('n:USDT:')), JSON.stringify(optv));
  await p.selectOption('select[name=wallet]', optv.find((v) => v.startsWith('n:USDT:'))); assert((await p.innerText('[data-amt-label]')).includes('USDT'));
  await p.fill('input[name=amount]', '300'); await p.click('#dlg button[type=submit]'); await settle();
  const made = await p.evaluate(() => { const h = D().holdings.find((x) => x.symbol === 'USDT'); return h && { q: h.quantity, acct: D().investments.some((a) => a.id === h.account_id), n: D().transactions.filter((t) => t.trade_id).length }; });
  assert.deepEqual(made, { q: 300, acct: true, n: 1 });
  await p.evaluate(() => txnDialog(null)); assert((await p.innerHTML('select[name=wallet]')).includes('h:'), 'now offered as a held coin');
  await p.click('#dlg label:has(input[name=type][value=expense])'); await p.selectOption('select[name=wallet]', { index: 0 }); assert(!(await p.innerHTML('select[name=wallet]')).includes('n:USDT'), 'expense list drops the new-coin choices'); await p.click('[data-act=close]');
  // income dated in the future waits: no change to what you hold, to net worth, or to a wallet balance until its day
  const fut = await p.evaluate(() => { const h = D().holdings.find((x) => x.symbol === 'USDT'), d = new Date(); d.setDate(d.getDate() + 5); const date = isoDate(d), w = D().wallets[0];
    const before = { held: heldNow(h), nw: portfolioUSD(monthKey(new Date())), cash: walletBalance(w) };
    recordCoinTxn(h, { type: 'income', quantity: 500, date, note: 'Later' }); D().transactions.push({ id: uid(), type: 'income', amount_minor: 777000, currency: 'IDR', occurred_at: date, wallet_id: w.id, note: 'Later cash', category_id: null, category_source: 'user' });
    const lst = inMonth(date.slice(0, 7)); if (lst.some((x) => x.note === 'Later' || x.note === 'Later cash')) throw new Error('future entries must not count in month totals');
    return { before, after: { held: heldNow(h), nw: portfolioUSD(monthKey(new Date())), cash: walletBalance(w) }, total: h.quantity, h: h.id }; });
  assert.deepEqual(fut.after, fut.before, JSON.stringify(fut)); assert(fut.total >= fut.before.held + 500);
  await p.evaluate((id) => { const h = D().holdings.find((x) => x.id === id); h.trades.filter((t) => t.date > isoDate(new Date())).forEach((t) => removeTrade(h, t)); D().transactions = D().transactions.filter((t) => t.note !== 'Later cash'); }, fut.h);
  // Overview's Total Balance = savings + investments (lent money and loans are not included)
  const tb = await p.evaluate(() => { const k = currentPeriod(), inv = usdToMinor(portfolioUSD(k), cur()); return { total: totalBalance(), sum: savingsTotal() + inv, inv }; });
  assert(tb.inv > 0 && tb.total === tb.sum, JSON.stringify(tb));
  // recurring in USDT
  hid = await p.evaluate(() => D().holdings.find((x) => x.symbol === 'USDT').id); const base = await qty();
  const n = await p.evaluate((id) => { const r = addRule('txn', 'weekly', '2026-10-10', { type: 'income', amount_minor: 5000, currency: 'USD', wallet_id: 'h:' + id, quantity: 50, note: 'Retainer', category_id: null }); r.next = '2026-10-17'; return runRecurring(); }, hid);
  assert(n >= 2); assert.equal(await qty(), base + 50 * n);
  await p.screenshot({ path: __dirname + '/out/coin.png' });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')); process.exit(1); });
