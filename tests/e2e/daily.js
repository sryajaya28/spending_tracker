const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Transactions groups by day; clicking a day opens a detail page with that day's transactions. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle());
  const m = await p.evaluate(() => state.ui.month);
  await p.evaluate((m) => { const w = D().wallets[0]; const c = D().categories[0];
    [[m + '-05', 'expense', 10000, 'Lunch'], [m + '-05', 'expense', 25000, 'Taxi'], [m + '-05', 'income', 500000, 'Gift'], [m + '-09', 'expense', 7000, 'Coffee']].forEach(([d, type, a, note]) =>
      D().transactions.push({ id: uid(), type, amount_minor: a, currency: w.currency, wallet_id: w.id, category_id: c ? c.id : null, note, occurred_at: d }));
    save(); location.hash = '#/transactions'; render(); }, m);
  await settle();
  const days = await p.$$('#txn-list .day-row'); assert.equal(days.length, 2, 'two days');
  assert((await p.innerText('#txn-list')).includes('3 transactions'));
  assert(!(await p.innerText('#txn-list')).includes('Lunch'), 'notes only on the day page');
  await p.screenshot({ path: __dirname + '/out/daily_list.png' });
  await p.click('#txn-list .day-row[data-id="' + m + '-05"]'); await p.waitForSelector('#day-list .row');
  assert.equal((await p.$$('#day-list .row')).length, 3);
  assert((await p.evaluate(() => location.hash)).endsWith('/transactions/' + m + '-05'));
  assert((await p.innerText('.sidebar a.active')).includes('Transactions'));
  await p.screenshot({ path: __dirname + '/out/daily_detail.png' });
  await p.click('#day-list .row'); assert((await p.$$('#dlg')).length >= 1); await p.click('[data-act=close]');
  await p.click('[data-act=add-txn]'); assert.equal(await p.inputValue('input[name=date]'), m + '-05'); await p.click('[data-act=close]');
  await p.click('.back-link'); await p.waitForSelector('#txn-list .day-row');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
