const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Every fee is its own expense in the default Fee category (💸): transfer fees (also earlier ones) and the fee of buying or selling an asset. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle()); await settle();
  // 1. the Fee category exists after load (added once for an account that did not have it) with its icon
  assert.deepEqual(await p.evaluate(() => { const c = D().categories.filter((x) => x.name === 'Fee'); return [c.length, c[0].type, c[0].icon, !c[0].parent_id]; }), [1, 'expense', '💸', true]);
  // earlier transfer fees (no category) are given it; running it again changes nothing
  assert.deepEqual(await p.evaluate(() => { const w = D().wallets[0]; D().transactions.push({ id: uid(), wallet_id: w.id, type: 'expense', amount_minor: 6500, currency: w.currency, note: 'Transfer fee (A → B)', occurred_at: todayIso(), transfer_id: uid(), category_id: null, category_source: 'user', ai_confidence: null }); const a = ensureFeeCategory(); const t = D().transactions.find((x) => x.note === 'Transfer fee (A → B)'); return [a, catOf(t.category_id).name, ensureFeeCategory()]; }), [true, 'Fee', false]);
  // 2. buying and selling an asset: the fee is its own expense from the same account, in Fee
  await p.evaluate(() => { const acc = { id: uid(), name: 'Ajaib', archived: false }; D().investments.push(acc); D().holdings.push({ id: 'hold1', account_id: acc.id, symbol: 'BTC', quantity: 0.5, since: monthKey(new Date()), trades: [] }); D().wallets[0].opening_balance_minor = 100000000; save(); render(); });
  await p.evaluate(() => tradeDialog(D().holdings.find((h) => h.id === 'hold1'), 'buy')); await p.waitForSelector('#dlg [name=fee]');
  assert.equal(await p.isVisible('#dlg [data-fee-box]'), true, 'the fee field shows when paying from an account'); assert((await p.innerText('#dlg [data-fee-label]')).includes('IDR'), 'in the account currency');
  await p.fill('#dlg [name=quantity]', '0.01'); await p.fill('#dlg [name=amount]', '10000000'); await p.fill('#dlg [name=fee]', '15000'); await p.click('#dlg button[type=submit]'); await settle();
  const f1 = await p.evaluate(() => { const t = D().transactions.find((x) => /^Investment fee/.test(x.note)); return t && [t.type, t.amount_minor, catOf(t.category_id).name, t.wallet_id === D().wallets[0].id, t.note]; });
  assert.deepEqual(f1.slice(0, 4), ['expense', 15000, 'Fee', true], JSON.stringify(f1)); assert(/Bought .*BTC/.test(f1[4]), f1[4]);
  // a buy needs the fee on top of the amount
  await p.evaluate(() => { D().wallets[0].opening_balance_minor = 0; D().transactions = D().transactions.filter((t) => t.type === 'expense' || t.type === 'transfer' ? false : true); render(); });
  await p.evaluate(() => { const w = D().wallets[0]; w.opening_balance_minor = 10000000 + 5000; render(); }); await p.evaluate(() => tradeDialog(D().holdings.find((h) => h.id === 'hold1'), 'buy')); await p.waitForSelector('#dlg [name=fee]');
  await p.fill('#dlg [name=quantity]', '0.01'); await p.fill('#dlg [name=amount]', '10000000'); await p.fill('#dlg [name=fee]', '15000'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(150);
  assert((await p.evaluate(() => document.getElementById('toast').textContent)).includes('enough balance'), 'amount + fee is more than the balance'); assert.equal(await p.evaluate(() => D().transactions.some((x) => /^Investment fee/.test(x.note))), false, 'nothing recorded'); await p.click('#dlg [data-act=close]');
  // selling: the fee is charged to the account that receives the money
  await p.evaluate(() => { D().wallets[0].opening_balance_minor = 100000000; render(); tradeDialog(D().holdings.find((h) => h.id === 'hold1'), 'sell'); }); await p.waitForSelector('#dlg [name=fee]');
  await p.fill('#dlg [name=quantity]', '0.1'); await p.fill('#dlg [name=amount]', '20000000'); await p.fill('#dlg [name=fee]', '25000'); await p.click('#dlg button[type=submit]'); await settle();
  const f2 = await p.evaluate(() => { const t = D().transactions.find((x) => /^Investment fee \(Sold/.test(x.note)); return t && [t.amount_minor, catOf(t.category_id).name]; }); assert.deepEqual(f2, [25000, 'Fee']);
  // no fee entered: no fee record
  const n = await p.evaluate(() => D().transactions.filter((x) => /^Investment fee/.test(x.note)).length);
  await p.evaluate(() => tradeDialog(D().holdings.find((h) => h.id === 'hold1'), 'sell')); await p.waitForSelector('#dlg [name=fee]'); await p.fill('#dlg [name=quantity]', '0.01'); await p.fill('#dlg [name=amount]', '1000000'); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await p.evaluate(() => D().transactions.filter((x) => /^Investment fee/.test(x.note)).length), n, 'no fee, no record');
  // 3. fee rows show the Fee icon and no tag
  await p.evaluate(() => { location.hash = '#/transactions'; render(); document.querySelector('[data-act=days-all]').click(); });
  const row = await p.evaluate(() => { const r = [...document.querySelectorAll('#txn-list .row')].find((e) => /Investment fee/.test(e.textContent)); return r && { badges: r.querySelectorAll('.badge').length, tile: r.querySelector('.tile').textContent.trim() }; });
  assert.deepEqual(row, { badges: 0, tile: '💸' }, JSON.stringify(row));
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
