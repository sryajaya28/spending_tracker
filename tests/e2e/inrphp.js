const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* ₹ and ₱: selectable, live rates requested and applied, Indian digit grouping and lakh/crore short amounts, and the Philippine peso format. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [], fxCalls = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  // (the later route wins, so the rates one comes after the catch-all)
  // the rates service answers like the real one (units per 1 USD, only the codes asked for)
  await p.route('**/api/fx**', (r) => { const q = new URL(r.request().url()).searchParams.get('currencies') || ''; fxCalls.push(q); const live = { IDR: 16000, USD: 1, EUR: 0.9, GBP: 0.78, SGD: 1.33, AUD: 1.52, JPY: 151, HKD: 7.8, CNY: 7.1, INR: 90.5, PHP: 57.25 }; const rates = {}; q.split(',').forEach((c) => { if (c in live) rates[c] = live[c]; }); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ source: 'test', date: '2026-11-02', rates }) }); });
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell'); await p.waitForTimeout(600);
  // live rates: both codes are asked for and the answer replaces the built-in fallback
  assert(fxCalls.some((q) => q.split(',').includes('INR') && q.split(',').includes('PHP')), 'INR and PHP are requested: ' + JSON.stringify(fxCalls));
  assert.deepEqual(await p.evaluate(() => [RATES.INR, RATES.PHP]), [90.5, 57.25], 'live rates applied');
  // setup skipped, so Overview shows the hero (the currency chip) and not the first-run screen
  await p.evaluate(() => { state.ui.onbSkipped = true; D().wallets[0].opening_balance_minor = 100000000; D().budgets.push({ id: uid(), category_id: null, amount_minor: 5000000, currency: 'IDR', start_month: currentPeriod() + '-01' }); render(); });
  // they are in the currency choices
  assert.deepEqual(await p.$$eval('.hero-cur option', (o) => o.map((x) => x.textContent)).then((l) => ['INR', 'PHP'].filter((c) => l.includes(c))), ['INR', 'PHP']);
  // formatting: Indian grouping (lakh/crore), peso sign
  const f = await p.evaluate(() => ({ lakh: money(toMinor(1234567.5, 'INR'), 'INR'), crore: money(toMinor(123456789, 'INR'), 'INR'), small: money(toMinor(950, 'INR'), 'INR'), php: money(toMinor(1234567.5, 'PHP'), 'PHP'),
    c: [4500, 120000, 1550000, 23000000, 250000000, 0].map((v) => compact(toMinor(v, 'INR'), 'INR')), neg: compact(toMinor(-250000, 'INR'), 'INR'), usd: compact(toMinor(1500000, 'USD'), 'USD') }));
  assert.equal(f.lakh, '₹12,34,567.50'); assert.equal(f.crore, '₹12,34,56,789.00'); assert.equal(f.small, '₹950.00'); assert.equal(f.php, '₱1,234,567.50');
  assert.deepEqual(f.c, ['4.5K', '1.2 L', '15.5 L', '2.3 Cr', '25 Cr', '0'], 'short rupee amounts: K, L (lakh), Cr (crore): ' + JSON.stringify(f.c)); assert.equal(f.neg, '−2.5 L'); assert(/^\$?1\.5M$/.test(f.usd), 'other currencies keep the browser style: ' + f.usd);
  // the sample account for each: local names and amounts in lakhs/crores
  for (const [cur, want] of [['INR', /HDFC Bank|SBI/], ['PHP', /BDO|BPI/]]) {
    await p.evaluate(async (c) => { await setDemo(false); D().profile.currency = c; await setDemo(true); location.hash = '#/overview'; render(); }, cur); await p.waitForTimeout(600);
    const t = await p.evaluate(() => ({ wallets: D().wallets.map((w) => w.name).join(), cur: D().profile.currency, hero: document.querySelector('.hero .amount').textContent.trim(), axis: [...document.querySelectorAll('.chart text, svg text')].map((x) => x.textContent).filter((x) => /Cr| L$|K$|M$|jt/.test(x)).slice(0, 3) }));
    assert(want.test(t.wallets), cur + ' wallets ' + t.wallets); assert.equal(t.cur, cur);
    if (cur === 'INR') { assert(/₹\d{1,3}(,\d{2})*,\d{3}/.test(t.hero), 'hero total with Indian grouping: ' + t.hero); assert(t.axis.some((x) => / L$| Cr$|K$/.test(x)), 'chart axis in K / L / Cr: ' + JSON.stringify(t.axis)); }
    else assert(t.hero.startsWith('₱'), 'peso sign: ' + t.hero);
  }
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
