const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 664, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  // setup skipped, so Overview is the normal one and not the first-run screen
  await p.evaluate(() => { state.ui.onbSkipped = true; D().wallets[0].opening_balance_minor = 100000000; const m = monthKey(new Date()) + '-01'; const cat = D().categories.find((c) => c.name === 'Dining');
    D().budgets.push({ id: uid(), category_id: null, amount_minor: 55000000, currency: 'IDR', start_month: m }, { id: uid(), category_id: cat.id, amount_minor: 3000000, currency: 'IDR', start_month: m });
    D().occasions.push({ id: uid(), name: 'Bandung Trip', amount_minor: 5000000, currency: 'IDR', start: '2026-11-06', end: '2026-11-08', archived: false });
    location.hash = '#/overview'; render(); });
  // the overall budget is the hero's sub-line and thin bar on Overview (the Budgets card is gone)
  const hero = async () => (await p.innerText('.hero')).replace(/\u00a0/g, ' ');
  const bar = () => p.$eval('.hero-bar', (b) => ({ w: b.querySelector('i').style.width, cls: b.querySelector('i').className, now: b.getAttribute('aria-valuenow'), barW: b.getBoundingClientRect().width, boxW: b.parentElement.getBoundingClientRect().width }));
  // nothing spent yet: empty bar, the whole budget left, and the bar spans the line's width
  let z = await bar(); console.log(JSON.stringify(z));
  assert.equal(z.w, '0%'); assert.equal(z.now, '0'); assert(Math.abs(z.barW - z.boxW) < 2, 'bar spans the block: ' + JSON.stringify(z)); assert(/Rp 55\.000\.000 left this month/.test(await hero()), await hero()); assert(!(await hero()).includes('All spending'));
  await (await p.$('.hero')).screenshot({ path: __dirname + '/out/budget_bars_zero.png' });
  // with spending: width follows the percentage, over budget turns red and says so
  await p.evaluate(() => { const cat = D().categories.find((c) => c.name === 'Dining'); D().transactions.push({ id: uid(), wallet_id: D().wallets[0].id, category_id: cat.id, type: 'expense', amount_minor: 3300000, currency: 'IDR', occurred_at: isoDate(new Date()), note: 'Dinner', category_source: 'user', ai_confidence: null }); render(); });
  const mid = await bar(); assert.equal(mid.w, '6%'); assert(/Rp 51\.700\.000 left this month/.test(await hero()), await hero());
  await p.evaluate(() => { D().budgets.find((b) => b.category_id === null).amount_minor = 3000000; render(); });   // 3.3M spent of 3M
  const all = await bar(); assert.equal(all.w, '100%'); assert.equal(all.now, '100'); assert(all.cls.includes('exceeded'), all.cls); assert(/Rp 300\.000 over budget/.test(await hero()), await hero());
  await (await p.$('.hero')).screenshot({ path: __dirname + '/out/budget_bars.png' });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
