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
  await p.evaluate(() => { const o = { id: uid(), name: 'Bandung Trip', amount_minor: 5000000, currency: 'IDR', start: '2026-11-06', end: '2026-11-08', archived: false }; D().occasions.push(o);
    D().transactions.push({ id: uid(), wallet_id: D().wallets[0].id, category_id: null, type: 'expense', amount_minor: 1250000, currency: 'IDR', occurred_at: isoDate(new Date()), note: 'Hotel', category_source: 'user', ai_confidence: null, occasion_id: o.id }); render(); });
  const card = await p.$('.card:has(h2:text("Budgets"))'); assert((await card.innerText()).includes('Bandung Trip')); assert((await card.innerText()).replace(/\u00a0/g, ' ').includes('1,250,000 / IDR 5,000,000'));
  await card.screenshot({ path: __dirname + '/out/ov_occ.png' });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
