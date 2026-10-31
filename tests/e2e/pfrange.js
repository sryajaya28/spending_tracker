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
  // every Portfolio list is sorted from the highest amount
  await p.evaluate(() => { D().wallets.push({ id: uid(), name: 'Big', type: 'bank', currency: 'IDR', opening_balance_minor: 99000000, archived: false, since: '2026-01' }, { id: uid(), name: 'Tiny', type: 'cash', currency: 'IDR', opening_balance_minor: 1000, archived: false, since: '2026-01' }, { id: uid(), name: 'Mid', type: 'bank', currency: 'IDR', opening_balance_minor: 500000, archived: false, since: '2026-01' }, { id: uid(), name: 'Mid2', type: 'bank', currency: 'IDR', opening_balance_minor: 400000, archived: false, since: '2026-01' });
    D().loans.push({ id: uid(), name: 'Small loan', currency: 'IDR', original_minor: 100000, since: '2026-01', archived: false, payments: [], type: 'other', monthly_minor: 0, rate: 0 }, { id: uid(), name: 'Large loan', currency: 'IDR', original_minor: 9000000, since: '2026-01', archived: false, payments: [], type: 'other', monthly_minor: 0, rate: 0 }); render(); });
  const names = await p.$$eval('.wallet .wname', (e) => e.map((x) => x.textContent)); assert.equal(names.length, 3, 'only the top 3 accounts show first'); assert.equal(names[0], 'Big');
  assert((await p.innerText('.see-more')).includes('See more (')); await p.click('.see-more'); const every = await p.$$eval('.wallet .wname', (e) => e.map((x) => x.textContent)); assert(every.length > 3 && every[every.length - 1] === 'Tiny', JSON.stringify(every));
  assert((await p.innerText('.see-more')).includes('Show less')); await p.click('.see-more'); assert.equal((await p.$$('.wallet')).length, 3, 'collapses again');
  await p.click('[data-act=pf-tab][data-tab=loan]'); const ln = await p.$$eval('.stack h2', (e) => e.map((x) => x.textContent)); const at = (n) => ln.findIndex((x) => x.startsWith(n)); assert(at('Large loan') >= 0 && at('Large loan') < at('Small loan'), JSON.stringify(ln)); await p.click('[data-act=pf-tab][data-tab=savings]');
  assert.equal(await rows(), 3, 'history shows the latest 3 months first'); assert((await p.innerText('.mlist .see-more')).includes('See more (3)')); await p.click('.mlist .see-more'); assert.equal(await rows(), 6, 'default 6 months after See more'); assert((await p.innerText('.mlist .see-more')).includes('Show less')); await p.click('.mlist .see-more'); assert.equal(await rows(), 3); await p.click('.mlist .see-more'); const h0 = await hero();
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
})().catch((e) => { console.log('FAIL', e.message, (e.stack||'').split('\n').slice(1,3).join(' | ')); process.exit(1); });
