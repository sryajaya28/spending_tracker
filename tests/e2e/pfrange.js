const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Portfolio time frame: 1 month .. all time changes the chart and the history list, not the net-worth card. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => { const w = D().wallets[0]; w.opening_balance_minor = 5000000; w.since = '2024-03'; save(); location.hash = '#/portfolio'; render(); });
  const rows = async () => (await p.$$('.mrow')).length, hero = () => p.innerText('.hero .amount');
  assert.equal(await rows(), 6, 'default 6 months'); const h0 = await hero();
  const pick = async (v) => { await p.selectOption('select[data-bind=pfRange]', v); await p.waitForSelector('.mrow'); };
  await pick('1m'); assert.equal(await rows(), 2, '1 month = this and last month');
  await pick('3m'); assert.equal(await rows(), 3);
  await pick('9m'); assert.equal(await rows(), 9);
  await pick('1y'); assert.equal(await rows(), 12);
  await pick('3y'); assert.equal(await rows(), 36);
  await pick('5y'); assert.equal(await rows(), 60);
  await pick('all'); const all = await rows(); assert.equal(all, 32, 'all time starts at the first wallet month (Mar 2024)');
  assert.equal(await p.innerText('select[data-bind=pfRange] option:checked'), 'All time');
  assert.equal(await hero(), h0, 'net worth card unchanged by the time frame');
  await p.screenshot({ path: __dirname + '/out/pf_range.png' });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
