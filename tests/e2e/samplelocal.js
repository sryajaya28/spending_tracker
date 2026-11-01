const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Sample data is local to the reporting currency: bank, e-wallet and investment platform names, merchants, stocks, cash in that currency. */
const EXPECT = {
  IDR: { banks: ['BCA', 'Mandiri'], inv: ['Stockbit', 'Ajaib'], merchant: /Indomaret|Gojek|Kopi Kenangan|Tokopedia|Pasar tradisional/, stock: 'BBCA' },
  SGD: { banks: ['DBS', 'OCBC'], inv: ['Tiger Brokers', 'moomoo'], merchant: /FairPrice|Kopitiam|Grab|Shopee|Sheng Siong/, stock: 'D05' },
  HKD: { banks: ['HSBC', 'Hang Seng Bank'], inv: ['Futu (moomoo)', 'Interactive Brokers'], merchant: /ParknShop|Cha chaan teng|MTR|HKTVmall/, stock: '0700' },
  JPY: { banks: ['MUFG Bank', 'Mizuho Bank'], inv: ['SBI Securities', 'Rakuten Securities'], merchant: /Seiyu|Sukiya|Suica|Amazon.co.jp|Life/, stock: '7203' },
  USD: { banks: ['Chase', 'Bank of America'], inv: ['Fidelity', 'Coinbase'], merchant: /Walmart|Chipotle|Uber|Amazon|Starbucks/, stock: 'VOO' },
  EUR: { banks: ['ING', 'Deutsche Bank'], inv: ['Trade Republic', 'Interactive Brokers'], merchant: /Lidl|REWE|Deutsche Bahn|Amazon|Café/, stock: 'ASML' },
  GBP: { banks: ['Barclays', 'Lloyds Bank'], inv: ['Hargreaves Lansdown', 'Trading 212'], merchant: /Tesco|Pret A Manger|TfL|Amazon UK|Greggs/, stock: 'HSBA' },
  AUD: { banks: ['CommBank', 'ANZ'], inv: ['CommSec', 'Stake'], merchant: /Woolworths|Coles|Flat white|Opal|Kmart/, stock: 'CBA' },
  CNY: { banks: ['ICBC', 'China Merchants Bank'], inv: ['Futu Niuniu', 'Tiger Brokers'], merchant: /Hema Fresh|Luckin Coffee|DiDi|Taobao|Meituan Waimai/, stock: '600519' },
};
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  for (const [cur, E] of Object.entries(EXPECT).concat([['XYZ', EXPECT.USD]])) {
    await p.evaluate((c) => { if (!(c in RATES)) RATES[c] = 2; return setDemo(false).then(() => { D().profile.currency = c; return setDemo(true); }); }, cur); await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const d = state.data, names = d.wallets.map((w) => w.name), inv = d.investments.map((i) => i.name), notes = new Set(d.transactions.map((t) => t.note));
      const bal = d.wallets.map((w) => walletBalance(w)), holdSyms = d.holdings.map((h) => assetInfo(h.symbol).symbol);
      return { cur: d.profile.currency, names, inv, notes: [...notes], uncategorized: d.transactions.filter((t) => t.type !== 'transfer' && !t.category_id).length, minBal: Math.min(...bal), total: Math.round(totalBalance()), curr: d.wallets.every((w) => w.currency === d.profile.currency), holdSyms,
        noCost: d.holdings.filter((h) => trackCost(h) && h.open_price == null).map((h) => h.symbol), cashOk: d.holdings.some((h) => h.symbol === 'CASH:' + d.profile.currency), loans: d.loans.length, recurring: d.recurring.length, budgets: d.budgets.length };
    });
    assert(E.banks.every((n) => r.names.includes(n)), cur + ' banks ' + r.names); assert(E.inv.every((n) => r.inv.includes(n)), cur + ' platforms ' + r.inv);
    assert(r.notes.some((n) => E.merchant.test(n)), cur + ' merchants ' + r.notes.slice(0, 8)); assert(r.holdSyms.includes(E.stock), cur + ' stock ' + r.holdSyms);
    assert.equal(r.uncategorized, 0, cur + ' every transaction is categorized'); assert(r.minBal >= 0, cur + ' no negative account'); assert(r.total > 0 && r.curr && r.cashOk, cur + ' ' + JSON.stringify([r.total, r.curr, r.cashOk]));
    assert.equal(r.noCost.length, 0, cur + ' sample holdings carry an average price: ' + r.noCost); assert(r.loans === 3 && r.recurring === 5 && r.budgets === 7, cur);
    // the pages render with this data
    for (const h of ['#/overview', '#/portfolio', '#/transactions', '#/budgets']) { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(120); }
    await p.evaluate(() => { state.ui.pfTab = 'investment'; location.hash = '#/portfolio'; render(); }); await p.waitForTimeout(150);
    assert((await p.innerText('.holding-row .amt')).trim().length > 0, cur + ' investments render');
    if (cur === 'SGD' || cur === 'JPY' || cur === 'CNY') { await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForTimeout(150); await p.screenshot({ path: __dirname + `/out/sample_${cur}.png` }); }
  }
  // changing the currency in Settings (or the Overview selector) while sample data is on rebuilds the sample for that country
  await p.evaluate(() => setDemo(false).then(() => { D().profile.currency = 'IDR'; return setDemo(true); })); await p.waitForTimeout(400);
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForSelector('select[data-setting=currency]'); await p.selectOption('select[data-setting=currency]', 'JPY'); await p.waitForTimeout(400);
  let n = await p.evaluate(() => ({ cur: D().profile.currency, banks: D().wallets.map((w) => w.name), demo: !!state.real, ownCur: state.real.profile.currency })); assert.equal(n.cur, 'JPY'); assert(n.banks.includes('MUFG Bank') && n.banks.includes('PayPay'), JSON.stringify(n.banks)); assert(n.demo, 'still in sample mode'); assert.equal(n.ownCur, 'IDR', 'your own currency setting is untouched');
  await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForSelector('.hero-cur select'); await p.selectOption('.hero-cur select', 'GBP'); await p.waitForTimeout(400);
  n = await p.evaluate(() => ({ cur: D().profile.currency, banks: D().wallets.map((w) => w.name) })); assert.equal(n.cur, 'GBP'); assert(n.banks.includes('Monzo'), JSON.stringify(n.banks));
  assert.deepEqual(errs, [], JSON.stringify(errs));
  console.log('ok'); await b.close();
})().catch((e) => { console.log('FAIL', e.message.slice(0, 400)); process.exit(1); });
