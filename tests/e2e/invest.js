const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Buy / sell of an asset: investment rows say "Buy Invest" / "Sell Invest" with no tag and no +/-; a sale's profit or loss is its own record
   (income in Capital gains, expense in Investment Loss) on the account that received the sale. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell'); await p.waitForTimeout(400);
  const settle = () => p.evaluate(() => Cloud.idle());
  const r = await p.evaluate(() => {
    state.ui.onbSkipped = true; const w = D().wallets[0]; w.opening_balance_minor = 100000; const acc = { id: uid(), name: 'Stockbit', archived: false }; D().investments.push(acc);
    const h = { id: 'h1', account_id: acc.id, symbol: 'BTC', quantity: 10, since: '2026-01', trades: [], open_price: 100, ccy: w.currency }; D().holdings.push(h);
    const src = { kind: 'wallet', wallet: w }, out = {}, bal0 = walletBalance(w);
    recordTrade(h, { side: 'sell', quantity: 5, source: src, amount: 700, date: todayIso() });      // cost 500, sold for 700: profit 200
    const sale = D().transactions.filter((t) => /^(Sold|Bought)/.test(t.note) || / profit$| loss$/.test(t.note));
    out.profit = sale.map((t) => [t.type, t.flow || '', t.amount_minor, t.category_id && catOf(t.category_id).name, t.note]);
    out.bal1 = walletBalance(w) - bal0;
    recordTrade(h, { side: 'sell', quantity: 2, source: src, amount: 100, date: todayIso() });     // cost 200, sold for 100: loss 100
    out.all = D().transactions.filter((t) => / loss$/.test(t.note)).map((t) => [t.type, t.amount_minor, catOf(t.category_id).name]);
    out.bal2 = walletBalance(w) - bal0; out.lossTransfer = D().transactions.filter((t) => t.type === 'transfer' && /^Sold 2/.test(t.note)).map((t) => t.amount_minor);
    recordTrade(h, { side: 'buy', quantity: 1, source: src, amount: 150, date: todayIso() }); out.bal3 = walletBalance(w) - bal0;
    out.rows = D().transactions.filter((t) => t.type === 'transfer' && !t.transfer_id).map((t) => { const d = document.createElement('div'); d.innerHTML = txnRow(t); const row = d.firstElementChild; return { note: t.note, badges: row.querySelectorAll('.badge').length, sub: row.querySelector('.sub').textContent.trim(), amt: row.querySelector('.amt').textContent.replace(/ /g, ' ').trim(), icon: !!row.querySelector('.amt .xfer-ico svg') }; });
    out.spent = sumBy(inMonth(currentPeriod()), 'expense'); out.income = sumBy(inMonth(currentPeriod()), 'income');
    // removing the first sale removes its profit record too
    const tr = h.trades.find((x) => x.side === 'sell' && x.quantity === 5); removeTrade(h, tr); out.afterRemove = D().transactions.filter((t) => / profit$/.test(t.note)).length;
    return out;
  });
  assert.deepEqual(r.profit, [['transfer', 'in', 500, null, 'Sold 5 BTC'], ['income', '', 200, 'Capital gains', 'BTC profit']], JSON.stringify(r.profit)); assert.equal(r.bal1, 700, 'the account receives the whole sale price');
  assert.deepEqual(r.all, [['expense', 100, 'Investment Loss']]); assert.deepEqual(r.lossTransfer, [200], 'a loss: the cost comes back, the loss is separate'); assert.equal(r.bal2, 700 + 100, 'and the account still receives exactly the sale price'); assert.equal(r.bal3, 800 - 150);
  assert(r.rows.length >= 3 && r.rows.every((x) => x.badges === 0 && !/[+−]/.test(x.amt) && x.icon), JSON.stringify(r.rows)); assert(r.rows.some((x) => /^Sell Invest · /.test(x.sub)) && r.rows.some((x) => /^Buy Invest · /.test(x.sub)), JSON.stringify(r.rows));
  assert.deepEqual([r.income, r.spent], [200, 100], 'only the profit is income and only the loss is spending'); assert.equal(r.afterRemove, 0, 'undoing the sale removes its profit record');
  // the Invest tab: Buy / Sell choice; the picked ticker stays in the search box
  await p.evaluate(() => { D().transactions = []; D().wallets[0].opening_balance_minor = 100000; render(); holdingDialog(null, D().investments[0].id, { invest: true }); }); await p.waitForSelector('#dlg input[name=side]', { state: 'attached' });
  assert.deepEqual(await p.$$eval('#dlg input[name=side]', (e) => e.map((x) => [x.value, x.checked])), [['buy', true], ['sell', false]], 'Buy is the default');
  await p.evaluate(() => pickAsset({ key: 'BTC', symbol: 'BTC', name: 'Bitcoin', type: 'crypto' }, document.querySelector('#dlg form')));
  assert.equal(await p.inputValue('#dlg input[name=assetq]'), 'BTC', 'the ticker is in the box'); const chip = await p.innerText('#picked'); assert(/Bitcoin/.test(chip) && !/^BTC/.test(chip.trim()), 'the details below no longer repeat it: ' + chip);
  await p.evaluate(() => { document.querySelector('#dlg input[name=side][value=sell]').click(); }); await p.waitForSelector('#dlg select[name=sellasset]');
  assert((await p.$$eval('#dlg select[name=sellasset] option', (o) => o.map((x) => x.textContent))).some((x) => /^BTC/.test(x)), 'the held asset is offered');
  const before = await p.evaluate(() => [walletBalance(D().wallets[0]), D().holdings.find((h) => h.id === 'h1').quantity]);
  await p.selectOption('#dlg select[name=sellasset]', 'h1'); await p.fill('#dlg [name=quantity]', '3'); await p.fill('#dlg [name=fundamount]', '450'); await p.click('#dlg button[type=submit]'); await settle();
  const s2 = await p.evaluate(() => ({ bal: walletBalance(D().wallets[0]), qty: D().holdings.find((h) => h.id === 'h1').quantity, rows: D().transactions.filter((t) => /^Sold 3|BTC profit|BTC loss/.test(t.note)).map((t) => [t.type, t.amount_minor, t.note]), open: document.getElementById('dlg').open }));
  assert.equal(s2.bal - before[0], 450, 'the account receives the sale price'); assert(s2.qty < before[1], 'quantity went down'); assert(s2.rows.some((r) => r[0] === 'transfer' && /^Sold 3/.test(r[2])) && s2.rows.some((r) => /BTC (profit|loss)$/.test(r[2])), JSON.stringify(s2.rows)); assert.equal(s2.open, false);
  // more than you hold is refused
  await p.evaluate(() => { holdingDialog(null, D().investments[0].id, { invest: true }); }); await p.waitForSelector('#dlg input[name=side]', { state: 'attached' }); await p.evaluate(() => { document.querySelector('#dlg input[name=side][value=sell]').click(); }); await p.waitForSelector('#dlg select[name=sellasset]');
  await p.fill('#dlg [name=quantity]', '9999'); await p.fill('#dlg [name=fundamount]', '10'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(150); assert((await p.evaluate(() => document.getElementById('toast').textContent)).includes('only hold'), 'refused'); await p.click('#dlg .dlg-x');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
