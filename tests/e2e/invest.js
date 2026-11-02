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
    D().budgets.push({ id: uid(), category_id: null, amount_minor: 100000, currency: 'IDR', start_month: currentPeriod() + '-01' }); out.lossBudget = budgetStatus(currentPeriod()).find((b) => b.category_id === null).spent; out.lossTree = spendTree(currentPeriod()).reduce((a, n) => a + n.value, 0); out.lossRowStillThere = D().transactions.filter((t) => / loss$/.test(t.note)).length;
    // removing the first sale removes its profit record too
    const tr = h.trades.find((x) => x.side === 'sell' && x.quantity === 5); removeTrade(h, tr); out.afterRemove = D().transactions.filter((t) => / profit$/.test(t.note)).length;
    return out;
  });
  assert.deepEqual(r.profit, [['transfer', 'in', 500, null, 'Sold 5 BTC'], ['income', '', 200, 'Capital Gain', 'BTC profit']], JSON.stringify(r.profit)); assert.equal(r.bal1, 700, 'the account receives the whole sale price');
  assert.deepEqual(r.all, [['expense', 100, 'Investment Loss']]); assert.deepEqual(r.lossTransfer, [200], 'a loss: the cost comes back, the loss is separate'); assert.equal(r.bal2, 700 + 100, 'and the account still receives exactly the sale price'); assert.equal(r.bal3, 800 - 150);
  assert(r.rows.length >= 3 && r.rows.every((x) => x.badges === 0 && !/[+−]/.test(x.amt) && x.icon), JSON.stringify(r.rows)); assert(r.rows.some((x) => /^Sell Invest · /.test(x.sub)) && r.rows.some((x) => /^Buy Invest · /.test(x.sub)), JSON.stringify(r.rows));
  // Investment Loss is a category of its own; Investment Profit has Dividends, Interest and Capital Gain
  assert.deepEqual(await p.evaluate(() => { const c = D().categories, l = c.find((x) => x.name === 'Investment Loss'), g = c.find((x) => x.name === 'Investment Profit'); return [l.parent_id, l.type, c.filter((x) => x.parent_id === l.id).length, g.parent_id, g.type, c.filter((x) => x.parent_id === g.id).map((x) => x.name).sort(), c.some((x) => x.name === 'Investment')]; }), [null, 'expense', 0, null, 'income', ['Capital Gain', 'Dividends', 'Interest'], false], 'category layout');
  // earlier layout: Investment(income) > Investment Profit, Investment(expense) > Investment Loss  ->  migrated
  assert.deepEqual(await p.evaluate(() => { const d = D(); const ip = d.categories.find((c) => c.name === 'Investment Profit'), l = d.categories.find((c) => c.name === 'Investment Loss');
    ip.name = 'Investment'; d.categories.find((c) => c.name === 'Capital Gain').name = 'Investment Profit';
    const ex = { id: uid(), parent_id: null, name: 'Investment', type: 'expense', icon: '📊', color: '#DC2626', archived: false }; d.categories.push(ex); l.parent_id = ex.id;
    ensureDefaultCategories(); const c = D().categories; return [c.filter((x) => x.name === 'Investment Loss').length, !!c.find((x) => x.name === 'Investment Loss').parent_id, c.some((x) => x.name === 'Investment'), c.filter((x) => x.name === 'Investment Profit' && !x.parent_id).length, c.filter((x) => x.name === 'Capital Gain').length]; }), [1, false, false, 1, 1], 'legacy layout migrated');
  assert.deepEqual([r.income, r.spent], [200, 100], 'the profit is income; the loss counts as spending'); assert.equal(r.lossBudget, 0, 'but not in the budgets'); assert.equal(r.lossTree, 100, 'it is in the spending breakdown'); assert.equal(r.lossRowStillThere, 1, 'the loss record itself is still listed'); assert.equal(r.afterRemove, 0, 'undoing the sale removes its profit record');
  // Portfolio > Investment: realized profit & loss per month; tapping a month opens it in place, day by day (computed from the sales: -100 and +50 here)
  await p.evaluate(() => { const h = D().holdings.find((x) => x.id === 'h1'); recordTrade(h, { side: 'sell', quantity: 1, source: { kind: 'wallet', wallet: D().wallets[0] }, amount: 150, date: todayIso() }); });   // cost 100, sold for 150: +50, the same day as the loss
  const pn = await p.evaluate(() => { const rp = realizedPnl(); return { n: rp.length, net: rp.reduce((a, e) => a + e.pnl, 0), vals: rp.map((e) => e.pnl).sort((a, b) => a - b), cur: cur() }; });
  assert.equal(pn.n, 2); assert.equal(pn.vals[0], -100); assert(pn.vals[1] > 0 && pn.net === pn.vals[0] + pn.vals[1], JSON.stringify(pn));
  await p.evaluate(() => { state.ui.pfTab = 'investment'; location.hash = '#/portfolio'; render(); }); await p.waitForSelector('[data-act=pnl-month]');
  // the section is the same component as the growth card: chart, month rows (net P&L only, green or red), See more; no chevron
  assert.equal(await p.$$eval('#pnl svg', (e) => e.length), 1, 'chart'); assert.equal(await p.$$eval('#pf svg', (e) => e.length), 1, 'the growth chart is still there');
  const rowsInfo = await p.$$eval('[data-act=pnl-month]', (e) => e.map((r) => ({ name: r.querySelector('.mname').textContent.trim(), val: r.querySelector('.mval').textContent.replace(/\u00a0/g, ' ').trim(), cls: r.querySelector('.mval b').className, extra: r.querySelector('.mval').children.length })));
  assert(rowsInfo.length >= 3 && rowsInfo.every((r) => r.extra === 1 && !/›|⌄/.test(r.val)), JSON.stringify(rowsInfo));
  const cur0 = rowsInfo[0]; assert(cur0.val.startsWith('−Rp ' + Math.abs(pn.net)) && /down/.test(cur0.cls), 'this month: net loss in red: ' + JSON.stringify(cur0)); assert(rowsInfo.slice(1).every((r) => r.val === 'Rp 0'), 'months without sales read Rp 0');
  // tapping a month opens its own page with the days (not a pop-up)
  await p.click('[data-act=pnl-month]'); await p.waitForSelector('.day-group'); assert.equal(await p.evaluate(() => /^#\/portfolio\/pnl-\d{4}-\d{2}$/.test(location.hash)), true, 'a page of its own'); assert.equal(await p.$$eval('#dlg[open]', (e) => e.length), 0, 'no pop-up');
  assert.equal(await p.$$eval('.day-group.open', (e) => e.length), 0, 'days start collapsed'); assert((await p.innerText('.day-row')).includes('2 sales'), 'day row shows the count');
  await p.click('.day-row'); assert.equal(await p.$$eval('.day-group.open', (e) => e.length), 1, 'tap expands the day');
  const dt = (await p.innerText('.main')).replace(/\u00a0/g, ' ');
  assert(/1 BTC sold · Stockbit/.test(dt) && /2 BTC sold/.test(dt) && dt.includes('+Rp ' + pn.vals[1]) && dt.includes('−Rp 100') && dt.includes('−Rp ' + Math.abs(pn.net)) && dt.includes('Back to Portfolio'), dt); assert.equal(await p.$$eval('.day-group', (e) => e.length), 1, 'grouped by day');
  await p.click('.back-link'); await p.waitForSelector('[data-act=pnl-month]'); assert.equal(await p.evaluate(() => location.hash), '#/portfolio');
  // IDR amounts of cash use dots: 85.000.000 IDR, never 85,000,000
  assert.equal(await p.evaluate(() => { D().customAssets['CASH:IDR'] = { symbol: 'IDR', name: 'Cash (IDR)', type: 'cash', cash: 'IDR' }; const h = { symbol: 'CASH:IDR', quantity: 85000000, trades: [], since: '2026-01', id: 'cx', account_id: D().investments[0].id }; D().holdings.push(h); const t = holdingRow(h, 'IDR', 1).replace(/<[^>]+>/g, ' '); D().holdings = D().holdings.filter((x) => x.id !== 'cx'); return /85\.000\.000 IDR/.test(t) && !/85,000,000/.test(t); }), true, 'cash quantity with dots');
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
  // a sale paid into the account's own cash still records its loss (and a profit) on the Transactions page, with no bank account
  const cs = await p.evaluate(() => { const d = D(), h = d.holdings.find((x) => x.id === 'h1'), cash = { id: 'hc', account_id: h.account_id, symbol: 'CASH:' + cur(), quantity: 0, since: '2026-01', trades: [] }; d.holdings.push(cash);
    const base = d.transactions.length; h.open_price = 100; h.trades = []; h.quantity = 5; h.ccy = cur();
    recordTrade(h, { side: 'sell', quantity: 2, source: { kind: 'holding', holding: cash }, amount: 150, date: todayIso(), price: 75 });   // cost 200, sold for 150: loss 50
    const rec = d.transactions.slice(base).filter((t) => t.trade_id); const row = rec[0]; const tr = h.trades[0];
    const out = { n: rec.length, type: row && row.type, wallet: row && row.wallet_id, amt: row && row.amount_minor, cat: row && catOf(row.category_id).name, where: row && txnWhere(row), spent: sumBy(inMonth(currentPeriod()), 'expense'), budget: budgetStatus(currentPeriod()).length };
    out.cashQty = cash.quantity; const rm = removeTrade(h, tr); out.afterUndo = d.transactions.filter((t) => t.trade_id === tr.id).length; out.rm = rm; return out; });
  assert.equal(cs.n, 1, JSON.stringify(cs)); assert.deepEqual([cs.type, cs.wallet, cs.cat], ['expense', null, 'Investment Loss'], JSON.stringify(cs)); assert.equal(cs.amt, await p.evaluate(() => toMinor(50, cur())), 'loss of 50'); assert.equal(cs.where, 'Stockbit'); assert(cs.spent > 0, 'counts as spending'); assert.equal(cs.afterUndo, 0, 'undoing the sale removes it');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
