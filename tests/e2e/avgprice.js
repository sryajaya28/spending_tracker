const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Average price and P&L: weighted average cost from a starting price, buys re-average it, sells realize profit, saved and reloaded. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle());
  const acc = await p.evaluate(() => { const a = { id: uid(), name: 'Ajaib', archived: false }; D().investments.push(a); D().wallets[0].opening_balance_minor = 5000000000; D().wallets[0].currency = 'USD'; save(); render(); return a.id; }); await settle();
  const near = (a, b, m) => assert(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${m}: ${a} vs ${b}`);
  // 1. add VOO you already own with an average price
  await p.evaluate((id) => holdingDialog(null, id), acc);
  await p.fill('input[name=assetq]', 'voo'); await p.waitForSelector('#asset-results .res'); await p.click('#asset-results .res');
  assert(await p.isVisible('[data-own-price]'), 'average price fields shown for an owned asset');
  await p.fill('input[name=quantity]', '10'); await p.fill('input[name=avgprice]', '400'); await p.selectOption('select[name=pccy]', 'USD');
  const get = () => p.evaluate(() => { const h = D().holdings.find((x) => x.symbol === 'VOO'); const c = holdingCost(h); return { q: h.quantity, open: h.open_price, ccy: h.ccy, known: c.known, avg: c.avg, cost: c.cost, realized: c.realized, per: c.per, id: h.id }; });
  await p.click('#dlg button[type=submit]'); await settle();
  let g = await get(); assert.equal(g.open, 400); assert.equal(g.ccy, 'USD'); assert(g.known); near(g.avg, 400, 'avg'); near(g.cost, 4000, 'cost');
  // 2. buy 10 more at 500 with the trade form: average becomes 450
  await p.evaluate((id) => tradeDialog(D().holdings.find((h) => h.id === id), 'buy'), g.id);
  await p.fill('input[name=quantity]', '10'); await p.fill('input[name=price]', '500');
  assert.equal(await p.inputValue('input[name=amount]'), '5000.00', 'amount follows quantity x price');
  await p.fill('input[name=amount]', '5000'); assert.equal(await p.inputValue('input[name=price]'), '500', 'price follows amount');
  await p.click('#dlg button[type=submit]'); await settle();
  g = await get(); assert.equal(g.q, 20); near(g.avg, 450, 'blended average'); near(g.cost, 9000, 'cost after buy');
  await p.evaluate((id) => { D().customAssets['CASH:USD'] = { symbol: 'USD', name: 'Cash (USD)', type: 'cash', cash: 'USD' }; D().holdings.push({ id: 'cashx', account_id: D().holdings.find((h) => h.id === id).account_id, symbol: 'CASH:USD', quantity: 0, since: '2026-01', trades: [] }); }, g.id);
  // 3. sell 5 at 600: realized 5 x (600 - 450) = 750, average stays 450
  await p.evaluate((id) => tradeDialog(D().holdings.find((h) => h.id === id), 'sell'), g.id);
  await p.fill('input[name=quantity]', '5'); await p.fill('input[name=price]', '600'); await p.click('#dlg button[type=submit]'); await settle();
  g = await get(); assert.equal(g.q, 15); near(g.avg, 450, 'average unchanged by a sell'); near(g.realized, 750, 'realized'); near(g.cost, 6750, 'cost after sell');
  // the amount of the sell credited the account
  const w = await p.evaluate(() => [walletBalance(D().wallets[0]), D().holdings.find((h) => h.id === 'cashx').quantity]); assert.deepEqual(w, [5000000000 - 500000, 3000], 'bank paid 5000.00 for the buy; the 3000.00 sale went into the investment account cash');
  // 3b. paid from an account in another currency (IDR): the price follows that account and is converted into the holding's currency (USD)
  const idw = await p.evaluate(() => { const w = { ...D().wallets[0], id: uid(), name: 'BCA', currency: 'IDR', opening_balance_minor: 100000000 }; D().wallets.push(w); save(); return w.id; });
  await p.evaluate((id) => tradeDialog(D().holdings.find((h) => h.id === id), 'buy'), g.id);
  await p.selectOption('select[name=source]', 'w:' + idw); assert((await p.innerText('[data-price-unit]')).includes('IDR'), 'price unit follows the paying account');
  await p.fill('input[name=quantity]', '2'); await p.fill('input[name=amount]', '1550000'); assert.equal(await p.inputValue('input[name=price]'), '775000', 'price in IDR');
  await p.click('#dlg button[type=submit]'); await settle();
  await p.waitForTimeout(500); await settle();
  g = await get(); assert.equal(g.q, 17); near(g.cost, 6850, 'cost: 2 units at IDR 775,000 = USD 50 each'); assert.equal(g.ccy, 'USD');
  // 4. the row, summary and history show it
  await p.evaluate(() => { state.ui.pfTab = 'investment'; location.hash = '#/portfolio'; render(); }); await p.waitForSelector('.holding-row');
  assert(/[+−]\d/.test(await p.innerText('.holding-row .amt')), 'row shows profit or loss %');
  await p.click('.holding-row'); await p.waitForSelector('#dlg .hold-sum'); const sum = await p.innerText('#dlg .hold-sum');
  assert(sum.includes('Average price') && sum.includes('$4') && sum.includes('Profit / loss') && sum.includes('Realized P&L') && sum.includes('Starting price'), sum);
  await p.click('#dlg [data-act=view-history]'); await p.waitForSelector('.back-link'); const hist = await p.innerText('.main');
  assert(hist.includes('@ $600') && hist.includes('@ $500') && hist.includes('P&L'), hist.slice(0, 600));
  // 5. an asset added without a price has an unknown cost: P&L is "—" until a price is set
  await p.evaluate((id) => { const h = { id: uid(), account_id: id, symbol: 'AAPL', quantity: 4, since: monthKey(new Date()), trades: [] }; D().holdings.push(h); save(); render(); holdingDialog(h); }, acc);
  const s2 = await p.innerText('#dlg .hold-sum'); assert(s2.includes('Set average price') && s2.includes('—'), s2);
  await p.click('#dlg [data-act=set-cost]'); await p.waitForSelector('form[data-form=cost]'); await p.fill('input[name=avgprice]', '150'); await p.click('#dlg button[type=submit]'); await settle();
  const a2 = await p.evaluate(() => { const h = D().holdings.find((x) => x.symbol === 'AAPL'); const c = holdingCost(h); return { known: c.known, avg: c.avg, ccy: h.ccy }; }); assert(a2.known && a2.avg === 150 && a2.ccy, JSON.stringify(a2));
  // 6. blending more owned quantity: 4 @150 + 6 @200 = 10 @ 180
  await p.evaluate((id) => holdingDialog(null, id), acc); await p.fill('input[name=assetq]', 'aapl'); await p.waitForSelector('#asset-results .res'); await p.click('#asset-results .res');
  await p.fill('input[name=quantity]', '6'); await p.fill('input[name=avgprice]', '200'); await p.click('#dlg button[type=submit]'); await settle();
  near(await p.evaluate(() => holdingCost(D().holdings.find((x) => x.symbol === 'AAPL')).avg), 180, 'blended starting price');
  // 7. cash and stablecoins have no cost basis
  assert.equal(await p.evaluate(() => (D().customAssets['CASH:IDR'] = { symbol: 'IDR', name: 'Cash (IDR)', type: 'cash', cash: 'IDR' }, [trackCost({ symbol: 'USDT' }), trackCost({ symbol: 'CASH:IDR' }), trackCost({ symbol: 'BTC' })].join())), 'false,false,true');
  // 8. saved and loaded back
  const back = await p.evaluate(async () => { const d = await Cloud.load(); const h = d.holdings.find((x) => x.symbol === 'VOO'); return { open: h.open_price, ccy: h.ccy, prices: h.trades.map((t) => t.price).sort((a, b) => a - b) }; });
  assert.equal(back.open, 400); assert.equal(back.ccy, 'USD'); assert.deepEqual(back.prices, [50, 500, 600], JSON.stringify(back));
  await p.screenshot({ path: __dirname + '/out/avgprice.png' });
  // Invest / Add asset: with an account to pay from, the average price fills in by itself (amount paid / quantity) once both are entered
  await p.evaluate(() => { D().wallets[0].opening_balance_minor = 900000000; render(); holdingDialog(null, D().investments[0].id, {}); }); await p.waitForSelector('#dlg select[name=fund]');   // Add asset: has both "Already owned" and payment sources (Invest has only the sources)
  await p.evaluate(() => { const f = document.querySelector('#dlg form'); f.asset.value = 'BTC'; f.assetmeta.value = JSON.stringify({ symbol: 'BTC', name: 'Bitcoin', type: 'crypto' }); });
  const src = await p.$eval('#dlg select[name=fund]', (s) => [...s.options].find((o) => /^w:/.test(o.value))?.value); await p.selectOption('#dlg select[name=fund]', src);
  assert.equal(await p.$eval('#dlg input[name=avgprice]', (e) => e.value), '', 'empty until both are entered'); assert.equal(await p.$eval('#dlg input[name=avgprice]', (e) => e.readOnly), true, 'automatic, not typed');
  await p.fill('#dlg input[name=fundamount]', '1000000'); assert.equal(await p.$eval('#dlg input[name=avgprice]', (e) => e.value), '', 'one of two is not enough');
  await p.fill('#dlg input[name=quantity]', '5'); assert.equal(await p.$eval('#dlg input[name=avgprice]', (e) => e.value), '200000', 'amount / quantity'); { const pv = await p.$eval('#dlg select[name=pccy]', (e) => e.value + ':' + e.disabled + ':' + [...e.options].map((o) => o.value + '|' + o.text).join(',').slice(0, 80)); const wc = await p.evaluate((s) => walletOf(s.slice(2)).currency, src); assert(pv.startsWith(wc + ':true'), wc + ' / ' + pv); }
  await p.fill('#dlg input[name=quantity]', '4'); assert.equal(await p.$eval('#dlg input[name=avgprice]', (e) => e.value), '250000', 'follows the quantity');
  // already owned: cleared and typed by hand again
  await p.selectOption('#dlg select[name=fund]', ''); assert.deepEqual(await p.$eval('#dlg input[name=avgprice]', (e) => [e.value, e.readOnly]), ['', false], 'already owned: typed by hand'); assert.equal(await p.$eval('#dlg select[name=pccy]', (e) => e.disabled), false);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').slice(0, 8).join(' | ')); process.exit(1); });
