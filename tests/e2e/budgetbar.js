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
  const rows = async () => (await card()).$$eval('.ov-buds .ov-occ', (ts) => ts.map((t) => ({ name: t.querySelector('.meta span').textContent, text: t.querySelector('.meta .num').textContent, w: t.querySelector('.bar i').style.width, barW: t.querySelector('.bar').getBoundingClientRect().width, cardW: t.closest('.card').getBoundingClientRect().width })));
  // nothing spent yet: empty bars, 0% visible, and the bar spans the card (no space wasted on the right)
  let z = await rows(); console.log(JSON.stringify(z.map((r) => [r.name.trim(), r.w, r.text.slice(-4)])));
  assert.equal(z.length, 2); assert(z.every((r) => r.w === '0%' && r.text.includes('0%')), JSON.stringify(z)); assert(z.every((r) => r.barW > r.cardW * 0.8), 'bars use the card width');
  await (await card()).screenshot({ path: __dirname + '/out/budget_bars_zero.png' });
  // with spending: widths follow the percentage, over-budget turns red
  await p.evaluate(() => { const cat = D().categories.find((c) => c.name === 'Dining'); D().transactions.push({ id: uid(), wallet_id: D().wallets[0].id, category_id: cat.id, type: 'expense', amount_minor: 3300000, currency: 'IDR', occurred_at: isoDate(new Date()), note: 'Dinner', category_source: 'user', ai_confidence: null }); render(); });
  const w = await rows(); const dining = w.find((r) => r.name.includes('Dining')); assert.equal(dining.w, '100%'); assert(dining.text.includes('110%'), dining.text);
  assert.equal(await (await card()).$$eval('.ov-buds .bar i.exceeded', (e) => e.length), 1);
  await (await card()).screenshot({ path: __dirname + '/out/budget_bars.png' });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
