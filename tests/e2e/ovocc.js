const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 664, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => { location.hash = '#/overview'; render(); });
  assert(!(await p.innerText('body')).includes('Special occasions'), 'hidden when there are none');
  await p.evaluate(() => { const f = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); }; const o = { id: uid(), name: 'Bandung Trip', amount_minor: 5000000, currency: 'IDR', start: f(4), end: f(6), archived: false }; D().occasions.push(o);
    D().transactions.push({ id: uid(), wallet_id: D().wallets[0].id, category_id: null, type: 'expense', amount_minor: 1250000, currency: 'IDR', occurred_at: isoDate(new Date()), note: 'Hotel', category_source: 'user', ai_confidence: null, occasion_id: o.id }); render(); });
  // Overview's Budgets card shows only the overall budget ("All spending"): no categories, no occasions
  await p.evaluate(() => { D().budgets.push({ id: uid(), category_id: null, amount_minor: 55000000, currency: 'IDR', start_month: '2026-01-01' }, { id: uid(), category_id: D().categories[0].id, amount_minor: 1000000, currency: 'IDR', start_month: '2026-01-01' }); render(); });
  const card = await p.$('.card:has(h2:text("Budgets"))'); const ct = await card.innerText();
  assert(ct.includes('All spending') && !ct.includes('Bandung Trip') && !ct.includes('Special occasions') , 'only the overall budget: ' + ct);
  assert((await card.innerText()).includes('Details') && !(await card.innerText()).includes('Manage'), 'button says Details');
  await card.screenshot({ path: __dirname + '/out/ov_occ.png' });
  // tapping the card (not the month picker) opens the Budgets page
  await card.click({ position: { x: 20, y: 120 } }); await p.waitForFunction(() => location.hash === '#/budgets');
  // the occasion shows on the Budgets page, only in the months it spans (or that have its expenses)
  const rowOn = async (m) => { await p.evaluate((m) => { state.ui.month = m; render(); }, m); return (await p.innerText('main')).includes('Bandung Trip'); };
  assert.equal(await rowOn(await p.evaluate(() => currentPeriod())), true, 'an upcoming trip is on Budgets');
  // an occasion that has not ended yet shows in every period (a trip next month is on Budgets already); one that ended shows only in its own periods
  await p.evaluate(() => { D().occasions.length = 0; const f = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); }; D().occasions.push({ id: uid(), name: 'Next Trip', amount_minor: 9000000, currency: 'IDR', start: f(45), end: f(49), archived: false }, { id: uid(), name: 'Old Trip', amount_minor: 3000000, currency: 'IDR', start: '2026-03-10', end: '2026-03-12', archived: false }); });
  const named = async (m, n) => { await p.evaluate((m) => { state.ui.month = m; render(); }, m); return (await p.innerText('main')).includes(n); };
  assert.equal(await named(await p.evaluate(() => currentPeriod()), 'Next Trip'), true, 'upcoming trip shows now'); assert.equal(await named(await p.evaluate(() => currentPeriod()), 'Old Trip'), false, 'an ended trip leaves the Budgets list (it is in History)');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
