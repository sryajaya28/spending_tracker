const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 664, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => { const m = monthKey(new Date()) + '-01'; const cat = D().categories.find((c) => c.name === 'Dining');
    D().budgets.push({ id: uid(), category_id: null, amount_minor: 55000000, currency: 'IDR', start_month: m }, { id: uid(), category_id: cat.id, amount_minor: 3000000, currency: 'IDR', start_month: m });
    D().occasions.push({ id: uid(), name: 'Bandung Trip', amount_minor: 5000000, currency: 'IDR', start: '2026-11-06', end: '2026-11-08', archived: false });
    location.hash = '#/overview'; render(); });
  const card = async () => p.$('.card:has(h2:text("Budgets"))');
  const rows = async () => (await card()).$$eval('.ov-buds .bar', (bs) => bs.map((b) => ({ label: b.getAttribute('aria-label'), w: b.querySelector('i').style.width, barW: b.getBoundingClientRect().width, cardW: b.closest('.card').getBoundingClientRect().width })));
  // nothing spent yet: empty bars, 0% visible, and the bar spans the card (no space wasted on the right)
  let z = await rows(); console.log(JSON.stringify(z.map((r) => [r.label, r.w])));
  assert.equal(z.length, 1, 'Overview shows only the overall budget'); assert(z.every((r) => r.w === '0%' && r.label.includes('0%')), JSON.stringify(z)); assert(/monthly budget · 0%/.test((await (await card()).innerText()).replace(/\u00a0/g, ' ')), 'the percentage follows "of ... monthly budget" after a dot, like the other rows'); assert(!(await (await card()).innerText()).includes('All spending'), 'no "All spending" label: just the bar under "of ... monthly budget"'); assert(z.every((r) => r.barW > r.cardW * 0.8), 'bars use the card width');
  await (await card()).screenshot({ path: __dirname + '/out/budget_bars_zero.png' });
  // with spending: widths follow the percentage, over-budget turns red
  await p.evaluate(() => { const cat = D().categories.find((c) => c.name === 'Dining'); D().transactions.push({ id: uid(), wallet_id: D().wallets[0].id, category_id: cat.id, type: 'expense', amount_minor: 3300000, currency: 'IDR', occurred_at: isoDate(new Date()), note: 'Dinner', category_source: 'user', ai_confidence: null }); render(); });
  await p.evaluate(() => { D().budgets.find((b) => b.category_id === null).amount_minor = 3000000; render(); });   // 3.3M spent of 3M
  const w = await rows(); const all = w[0]; assert.equal(all.w, '100%'); assert(all.label.includes('110%'), all.label); assert(/monthly budget · 110%/.test((await (await card()).innerText()).replace(/\u00a0/g, ' ')), 'percentage follows the spending');
  assert.equal(await (await card()).$$eval('.ov-buds .bar i.exceeded', (e) => e.length), 1);
  await (await card()).screenshot({ path: __dirname + '/out/budget_bars.png' });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
