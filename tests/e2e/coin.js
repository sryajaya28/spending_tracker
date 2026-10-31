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
  const hid = await p.evaluate(() => { const a = { id: uid(), name: 'Exchange', archived: false }; D().investments.push(a); const h = { id: uid(), account_id: a.id, symbol: 'USDT', quantity: 1000, since: '2026-01', trades: [] }; D().holdings.push(h); save(); render(); return h.id; });
  await settle(); await log();
  const qty = () => p.evaluate((id) => D().holdings.find((h) => h.id === id).quantity, hid);
  const add = async (type, amount, note) => { await p.evaluate(() => txnDialog(null)); await p.click(`#dlg label:has(input[name=type][value=${type}])`); await p.selectOption('select[name=wallet]', 'h:' + hid); await p.fill('input[name=amount]', String(amount)); await p.fill('textarea[name=note]', note); await p.click('#dlg button[type=submit]'); await settle(); };
  // the dialog offers the coin and switches the amount unit
  await p.evaluate(() => txnDialog(null)); assert((await p.innerText('select[name=wallet]')).includes('USDT · Exchange · 1,000')); await p.selectOption('select[name=wallet]', 'h:' + hid); assert((await p.innerText('[data-amt-label]')).includes('USDT')); await p.click('[data-act=close]');
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
  assert.equal(await p.evaluate(() => txnWhere(D().transactions.find((t) => t.note === 'Hosting'))), 'USDT · Exchange');
  // saved and loaded back from the database rows
  const back = await p.evaluate(async () => { const d = await Cloud.load(); const h = d.holdings.find((x) => x.symbol === 'USDT'); return { q: h.quantity, kinds: h.trades.map((t) => t.kind).sort(), txn: d.transactions.filter((t) => !t.wallet_id).length }; });
  assert.deepEqual(back, { q: 1150.5, kinds: ['expense', 'income'], txn: 2 });
  // edit the expense amount, then delete the income (would leave the coins negative only if spent beyond)
  await p.evaluate(() => { location.hash = '#/transactions'; });
  await p.evaluate(() => txnDialog(D().transactions.find((t) => t.note === 'Hosting'))); assert.equal(await p.inputValue('input[name=amount]'), '100');
  await p.fill('input[name=amount]', '60'); await p.click('#dlg button[type=submit]'); await settle(); assert.equal(await qty(), 1190.5);
  await p.evaluate(() => txnDialog(D().transactions.find((t) => t.note === 'Hosting'))); await p.click('[data-act=delete-txn]'); await settle(); assert.equal(await qty(), 1250.5);
  assert.equal(await p.evaluate(() => D().transactions.filter((t) => t.note === 'Hosting').length), 0);
  // recurring in USDT
  const n = await p.evaluate((id) => { const r = addRule('txn', 'weekly', '2026-10-10', { type: 'income', amount_minor: 5000, currency: 'USD', wallet_id: 'h:' + id, quantity: 50, note: 'Retainer', category_id: null }); r.next = '2026-10-17'; return runRecurring(); }, hid);
  assert(n >= 2); assert.equal(await qty(), 1250.5 + 50 * n);
  await p.screenshot({ path: __dirname + '/out/coin.png' });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')); process.exit(1); });
