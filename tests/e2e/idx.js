const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Indonesian stocks and commodities: pick them in the asset picker, price comes from the (stubbed) Yahoo-backed API, saved and reloaded. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }), p = await ctx.newPage();   // the service worker would bypass the stubs below
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  const json = (r, o) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
  await p.route('**/api/status', (r) => json(r, { finnhub: false, yahoo: true }));
  await p.route('**/api/assets**', (r) => { const u = new URL(r.request().url()), t = u.searchParams.get('type'), q = u.searchParams.get('q').toUpperCase();
    if (t === 'idx') return json(r, { results: q.startsWith('BBC') ? [{ key: 'BBCA.JK', symbol: 'BBCA', name: 'Bank Central Asia', type: 'stock', yh: 'BBCA.JK', mult: 1 }] : [] });
    if (t === 'commodity') return json(r, { results: [{ key: 'XAUG', symbol: 'XAUG', name: 'Gold (per gram)', type: 'commodity', yh: 'GC=F', mult: 0.0321507 }] });
    return json(r, { results: [] }); });
  await p.route('**/api/price**', (r) => { const u = new URL(r.request().url()); return json(r, u.searchParams.get('yh') === 'BBCA.JK' ? { price: 0.5, native: 9000, currency: 'IDR' } : { price: 100, native: 100, currency: 'USD' }); });
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle()), log = () => p.evaluate(() => window.__log.splice(0));
  await p.evaluate(() => { D().investments.push({ id: uid(), name: 'Stockbit', archived: false }); D().wallets[0].opening_balance_minor = 100000000; save(); }); await settle(); await log();
  const buy = async (pill, query, qty, paid) => {
    await p.evaluate(() => holdingDialog(null, null, { invest: true })); assert((await p.innerText('#picker select')).includes('Indonesia (IDX)')); await p.selectOption('#picker select[data-pick-type]', pill);
    await p.fill('input[name=assetq]', query); await p.waitForSelector('#asset-results .res'); await p.click('#asset-results .res');
    await p.waitForTimeout(600); await p.waitForFunction(() => /live/.test(document.querySelector('#picked-price').textContent));
    await p.fill('input[name=quantity]', qty); await p.fill('input[name=fundamount]', paid); await p.click('#dlg button[type=submit]'); await settle();
  };
  await buy('idx', 'bbc', '100', '900000');
  let h = await p.evaluate(() => { const x = D().holdings.find((h) => h.symbol === 'BBCA.JK'); return x && { q: x.quantity, a: D().customAssets['BBCA.JK'], live: D().livePrices['BBCA.JK'] }; });
  assert(h && h.q === 100 && h.a.yh === 'BBCA.JK' && h.a.symbol === 'BBCA' && h.a.type === 'stock' && h.live === 0.5, JSON.stringify(h));
  await buy('commodity', 'gold', '10', '1000000');
  let l = await log(); const rows = l.filter((o) => o.table === 'holdings').flatMap((o) => o.rows);
  assert(rows.some((r) => r.symbol === 'BBCA.JK' && r.provider_symbol === 'yh:BBCA.JK|1|stock' && r.asset_type === 'stock' && r.name === 'Bank Central Asia'), JSON.stringify(rows));
  assert(rows.some((r) => r.symbol === 'XAUG' && r.provider_symbol === 'yh:GC=F|0.0321507|commodity' && r.asset_type === 'manual'), JSON.stringify(rows));
  // loaded back from the database rows
  const back = await p.evaluate(async () => { const d = await Cloud.load(); return { a: d.customAssets['BBCA.JK'], g: d.customAssets.XAUG }; });
  assert(back.a.yh === 'BBCA.JK' && back.a.symbol === 'BBCA' && back.a.type === 'stock' && back.g.yh === 'GC=F' && back.g.type === 'commodity' && Math.abs(back.g.mult - 0.0321507) < 1e-9, JSON.stringify(back));
  // shows on the Investment tab with the right unit and value (gold: 10 g x $100 = $1,000)
  await p.evaluate(() => { state.ui.pfTab = 'investment'; location.hash = '#/portfolio'; render(); }); const t = await p.innerText('main');
  assert(t.includes('Gold (per gram)') && t.includes('Commodity') && t.includes('Bank Central Asia'), t.slice(0, 400));
  assert.equal(await p.evaluate(() => Math.round(holdingUSD(D().holdings.find((h) => h.symbol === 'XAUG'), currentPeriod()))), 1000);
  await p.screenshot({ path: __dirname + '/out/idx.png' });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')); process.exit(1); });
