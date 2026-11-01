const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* An investment account can hold a fiat (IDR) balance: deposit from a wallet, buy an asset with it, withdraw back; saved and reloaded. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle()), log = () => p.evaluate(() => window.__log.splice(0));
  const acc = await p.evaluate(() => { const a = { id: uid(), name: 'Ajaib', archived: false }; D().investments.push(a); D().wallets[0].opening_balance_minor = 100000000; save(); render(); return a.id; }); await settle(); await log();
  const cashQ = () => p.evaluate(() => { const h = D().holdings.find((x) => x.symbol === 'CASH:IDR'); return h ? h.quantity : null; });
  const bank = () => p.evaluate(() => walletBalance(D().wallets[0]));
  // 1. add a cash balance, paid from the bank account
  await p.evaluate((id) => holdingDialog(null, id, { invest: true }), acc);
  await p.selectOption('#picker select[data-pick-type]', 'cash'); await p.fill('input[name=assetq]', 'idr'); await p.waitForSelector('#asset-results .res'); await p.click('#asset-results .res');
  await p.fill('input[name=quantity]', '20000000'); await p.fill('input[name=fundamount]', '20000000'); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await cashQ(), 20000000); assert.equal(await bank(), 80000000, 'the bank account paid for the deposit');
  const i0 = await p.evaluate(() => ({ type: assetInfo('CASH:IDR').type, usd: Math.round(holdingUSD(D().holdings.find((x) => x.symbol === 'CASH:IDR'), currentPeriod()) * RATES.IDR) })); assert.deepEqual(i0, { type: 'cash', usd: 20000000 }, 'cash counts at face value in investments');
  // 2. deposit more with the Deposit button
  await p.evaluate(() => { state.ui.pfTab = 'investment'; location.hash = '#/portfolio'; render(); }); await p.waitForSelector('.holding-row'); await p.click('.holding-row'); await p.waitForSelector('#dlg .hold-sum');
  const dt = await p.innerText('#dlg'); assert(dt.includes('Deposit') && dt.includes('Withdraw') && dt.includes('Balance') && !dt.includes('Current price'), dt.slice(0, 200));
  await p.click('#dlg [data-act=trade][data-side=buy]'); await p.waitForSelector('form[data-form=trade]'); await p.fill('input[name=quantity]', '5000000'); await p.fill('input[name=amount]', '5000000'); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await cashQ(), 25000000); assert.equal(await bank(), 75000000);
  // 3. buy an asset with the cash balance (cash is offered as a payment source for that account only)
  await p.evaluate((id) => holdingDialog(null, id, { invest: true }), acc);
  await p.fill('input[name=assetq]', 'voo'); await p.waitForSelector('#asset-results .res'); await p.click('#asset-results .res'); await p.fill('input[name=quantity]', '2');
  const opts = await p.$$eval('select[name=fund] option', (o) => o.map((x) => x.textContent)); assert(opts.some((x) => /Ajaib \(IDR\)/.test(x)), JSON.stringify(opts));
  await p.selectOption('select[name=fund]', { label: opts.find((x) => /Ajaib \(IDR\)/.test(x)) }); await p.fill('input[name=fundamount]', '6000000'); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await cashQ(), 19000000, 'the cash balance paid'); assert.equal(await p.evaluate(() => D().holdings.find((x) => x.symbol === 'VOO').quantity), 2); assert.equal(await bank(), 75000000, 'the bank account was not touched');
  // 4. withdraw part of it back to the bank
  await p.evaluate(() => { const h = D().holdings.find((x) => x.symbol === 'CASH:IDR'); tradeDialog(h, 'sell'); });
  await p.fill('input[name=quantity]', '4000000'); await p.fill('input[name=amount]', '4000000'); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await cashQ(), 15000000); assert.equal(await bank(), 79000000);
  // not enough cash is refused
  await p.evaluate(() => { const h = D().holdings.find((x) => x.symbol === 'CASH:IDR'); tradeDialog(h, 'sell'); }); await p.fill('input[name=quantity]', '99000000'); await p.fill('input[name=amount]', '99000000'); await p.click('#dlg button[type=submit]'); assert.equal(await cashQ(), 15000000, 'overdraw refused'); await p.click('[data-act=close]');
  // saved and loaded back
  const l = await log(); const rows = l.filter((o) => o.table === 'holdings').flatMap((o) => o.rows); assert(rows.some((r) => r.symbol === 'CASH:IDR' && r.provider_symbol === 'cash:IDR' && r.asset_type === 'manual' && r.name === 'Cash (IDR)'), JSON.stringify(rows.slice(0, 2)));
  const back = await p.evaluate(async () => { const d = await Cloud.load(); const h = d.holdings.find((x) => x.symbol === 'CASH:IDR'); return { q: h.quantity, a: d.customAssets['CASH:IDR'] }; });
  assert.equal(back.q, 15000000); assert(back.a.cash === 'IDR' && back.a.type === 'cash' && back.a.symbol === 'IDR', JSON.stringify(back));
  await p.screenshot({ path: __dirname + '/out/cash.png' });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').filter((l) => l.includes('cashacct.js')).slice(0, 2).join(' | ')); process.exit(1); });
