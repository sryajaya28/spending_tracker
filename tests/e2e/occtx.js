const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const log = () => p.evaluate(() => window.__log.splice(0)), settle = () => p.evaluate(() => Cloud.idle());
  // an occasion in the future (like "Bandung Trip", Nov 6-8)
  await p.evaluate(() => { D().occasions.push({ id: uid(), name: 'Bandung Trip', amount_minor: 5000000, currency: 'IDR', start: '2026-11-06', end: '2026-11-08', archived: false }); save(); state.ui.month = '2026-11'; location.hash = '#/budgets'; render(); });
  await settle(); await log();
  // + Expense on the occasion: occasion preselected, date moved to the trip start
  await p.click('[data-act=add-occasion-txn]');
  assert.equal(await p.$eval('select[name=occasion]', (s) => s.options[s.selectedIndex].textContent), 'Bandung Trip');
  assert.equal(await p.inputValue('input[name=date]'), '2026-11-06');
  await p.screenshot({ path: __dirname + '/out/occ_txn.png' });
  await p.fill('input[name=amount]', '350000'); await p.click('#dlg button[type=submit]'); await settle();
  let l = await log(); const occ = await p.evaluate(() => D().occasions[0].id);
  assert(l.some((o) => o.table === 'transactions' && o.rows[0].occasion_id === occ && o.rows[0].amount_minor === 350000), JSON.stringify(l));
  // normal Add: no occasion by default today; picking a date inside the trip selects it
  await p.evaluate(() => { location.hash = '#/transactions'; }); await p.click('[data-act=add-txn]');
  assert.equal(await p.inputValue('select[name=occasion]'), '');
  await p.fill('input[name=date]', '2026-11-07'); await p.dispatchEvent('input[name=date]', 'change');
  assert.equal(await p.$eval('select[name=occasion]', (s) => s.options[s.selectedIndex].textContent), 'Bandung Trip');
  await p.fill('input[name=date]', '2026-11-20'); await p.dispatchEvent('input[name=date]', 'change'); // out of range: leaves the choice alone
  // progress on the budgets page
  await p.click('[data-act=close]'); await p.evaluate(() => { location.hash = '#/budgets'; });
  assert((await p.innerText('.brow.wrap')).includes('1 expense'));
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
