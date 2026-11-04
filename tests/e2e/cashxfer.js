const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* An investment Cash balance is one end of a transfer: deposit and withdraw are transfers (amount only, optional fee), they show as transfers
   in the list, can be edited and deleted, older cash trades become transfers, and two Cash balances cannot be transferred to each other. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle());
  const ids = await p.evaluate(() => {
    state.ui.onbSkipped = true; const w = D().wallets[0]; w.opening_balance_minor = 100000000; w.currency = 'IDR';
    D().customAssets['CASH:IDR'] = { symbol: 'IDR', name: 'Cash (IDR)', type: 'cash', cash: 'IDR' };
    const a = { id: uid(), name: 'Ajaib', archived: false }, a2 = { id: uid(), name: 'Bibit', archived: false }; D().investments.push(a, a2);
    const cash = { id: uid(), account_id: a.id, symbol: 'CASH:IDR', quantity: 0, since: '2026-01', trades: [] }, cash2 = { id: uid(), account_id: a2.id, symbol: 'CASH:IDR', quantity: 0, since: '2026-01', trades: [] };
    D().holdings.push(cash, cash2); save(); render(); return { w: w.id, c: cash.id, c2: cash2.id };
  }); await settle();
  const bank = () => p.evaluate(() => walletBalance(D().wallets[0])), cashQ = (id) => p.evaluate((i) => D().holdings.find((h) => h.id === i).quantity, id);
  const open = async (preset, gid) => { await p.evaluate(([pr, g]) => transferDialog(pr, g), [preset, gid || null]); await p.waitForSelector('form[data-form=transfer]'); };
  // 1. deposit: bank account -> Cash balance, amount only, with a fee on top taken from the bank account
  await open({ from: 'w:' + ids.w, to: 'h:' + ids.c });
  assert.equal(await p.$$eval('input[name=quantity]', (e) => e.length), 0, 'no quantity box'); assert.equal(await p.$$eval('select[name=to] optgroup', (g) => g.map((x) => x.label).join()), 'Accounts,Investment cash');
  await p.fill('input[name=amount]', '5000000'); await p.fill('input[name=fee]', '2500'); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await cashQ(ids.c), 5000000, 'cash received the amount'); assert.equal(await bank(), 100000000 - 5000000 - 2500, 'the bank paid amount + fee');
  let rows = await p.evaluate(() => D().transactions.filter((t) => t.transfer_id).map((t) => [t.type, t.flow || '', t.wallet_id ? 'wallet' : 'none', t.amount_minor, !!t.trade_id]));
  assert.deepEqual(rows.sort(), [['expense', '', 'wallet', 2500, false], ['transfer', 'out', 'wallet', 5000000, true]].sort(), JSON.stringify(rows));
  // it is listed as a transfer (not "Buy Invest"), and opens as an editable form
  await p.evaluate(() => { location.hash = '#/transactions'; state.ui.q = ''; render(); }); await p.waitForSelector('#txn-list .day-row'); await p.evaluate(() => document.querySelector('[data-act=days-all]').click());
  const t1 = await p.innerText('#txn-list'); assert(/Transfer to Ajaib \(Cash\)/.test(t1) && !/Buy Invest/.test(t1), t1.slice(0, 400));
  await p.click('#txn-list .day-body .row:has-text("Transfer to Ajaib")'); await p.waitForSelector('[data-act=delete-transfer]'); assert.equal(await p.inputValue('input[name=amount]'), '5000000'); assert.equal(await p.inputValue('input[name=fee]'), '2500');
  // 2. edit it: amount and fee change, the Cash balance and the bank follow
  await p.fill('input[name=amount]', '6000000'); await p.fill('input[name=fee]', '3000'); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await cashQ(ids.c), 6000000); assert.equal(await bank(), 100000000 - 6000000 - 3000); assert.equal(await p.evaluate(() => D().transactions.filter((t) => t.transfer_id).length), 2, 'still one transfer and its fee');
  // 3. withdraw: Cash balance -> bank account, fee comes out of the Cash balance (own record, no account)
  await open({ from: 'h:' + ids.c, to: 'w:' + ids.w });
  await p.fill('input[name=amount]', '1000000'); await p.fill('input[name=fee]', '1500'); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await cashQ(ids.c), 6000000 - 1000000 - 1500, 'the Cash balance gave the amount and the fee'); assert.equal(await bank(), 100000000 - 6000000 - 3000 + 1000000);
  const wd = await p.evaluate(() => D().transactions.filter((t) => t.transfer_id && t.flow !== 'out' && !(t.type === 'expense' && t.wallet_id)).map((t) => [t.type, t.flow || '', t.wallet_id ? 'wallet' : 'none', t.amount_minor, catOf(t.category_id)?.name || null, txnWhere(t)]));
  assert(wd.some((r) => r[0] === 'transfer' && r[1] === 'in' && r[3] === 1000000) && wd.some((r) => r[0] === 'expense' && r[2] === 'none' && r[3] === 1500 && r[4] === 'Fee'), JSON.stringify(wd));
  // the withdrawal's only leg is shown in the list (the 'in' leg stays hidden only when an 'out' leg exists)
  await p.evaluate(() => { location.hash = '#/transactions'; render(); }); await p.waitForSelector('#txn-list .day-row'); await p.evaluate(() => document.querySelector('[data-act=days-all]').click());
  assert(/Transfer from Ajaib \(Cash\)/.test(await p.innerText('#txn-list')), 'the withdrawal is listed');
  // edit the withdrawal; deleting it restores the Cash balance and removes its fee
  await p.click('#txn-list .day-body .row:has-text("Transfer from Ajaib")'); await p.waitForSelector('[data-act=delete-transfer]'); await p.fill('input[name=amount]', '2000000'); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await cashQ(ids.c), 6000000 - 2000000 - 1500); assert.equal(await bank(), 100000000 - 6000000 - 3000 + 2000000);
  await p.click('#txn-list .day-body .row:has-text("Transfer from Ajaib")'); await p.waitForSelector('[data-act=delete-transfer]'); await p.click('[data-act=delete-transfer]'); await settle();
  assert.equal(await cashQ(ids.c), 6000000); assert.equal(await bank(), 100000000 - 6000000 - 3000); assert.equal(await p.evaluate(() => D().transactions.filter((t) => t.transfer_id).length), 2);
  // 4. checks: not more than the Cash balance holds, never two Cash balances, an edit that fails changes nothing
  await open({ from: 'h:' + ids.c, to: 'w:' + ids.w }); await p.fill('input[name=amount]', '99000000'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(150);
  assert((await p.evaluate(() => document.getElementById('toast').textContent)).includes("doesn't have enough balance")); assert.equal(await cashQ(ids.c), 6000000); await p.click('#dlg [data-act=close]');
  await open({ from: 'h:' + ids.c, to: 'w:' + ids.w }); await p.selectOption('select[name=to]', 'h:' + ids.c2); assert.equal(await p.$eval('select[name=from]', (s) => s.value.startsWith('w:')), true, 'two Cash balances are never chosen together: the other end switches to an account'); await p.click('#dlg [data-act=close]');
  const gid = await p.evaluate(() => D().transactions.find((t) => t.transfer_id).transfer_id); await open(null, gid); await p.fill('input[name=amount]', '999000000'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(150);
  assert.equal(await cashQ(ids.c), 6000000, 'a refused edit leaves the transfer as it was'); assert.equal(await p.evaluate(() => D().transactions.filter((t) => t.transfer_id).length), 2); await p.click('#dlg [data-act=close]');
  // spending the Cash balance blocks deleting its deposit
  await p.evaluate((id) => { const h = D().holdings.find((x) => x.id === id); h.quantity = 100; h.trades.push({ id: uid(), date: '2026-01-02', side: 'sell', quantity: 5999900, amount_minor: 1, currency: 'IDR', wallet_id: null, kind: 'expense' }); }, ids.c);
  await p.evaluate((g) => { window.__r = removeTransferGroup(g); }, gid); assert.equal(await p.evaluate(() => window.__r), false, 'cannot take back a deposit that was already spent');
  await p.evaluate((id) => { const h = D().holdings.find((x) => x.id === id); h.trades = h.trades.filter((t) => t.amount_minor !== 1 || t.wallet_id !== null); h.quantity = 6000000; }, ids.c);   // undo the pretend spending
  // 5. the Portfolio buttons of a Cash balance keep the old pop-up: Deposit / Withdraw with an account, amount, fee and date, no quantity; it saves as a transfer
  await p.evaluate((id) => { holdingDialog(D().holdings.find((x) => x.id === id)); }, ids.c); await p.waitForSelector('#dlg [data-act=trade][data-side=sell]'); await p.click('#dlg [data-act=trade][data-side=sell]'); await p.waitForSelector('form[data-form=cashx]');
  assert.equal(await p.$$eval('input[name=quantity]', (e) => e.length), 0, 'no quantity box'); assert(await p.isVisible('input[name=fee]')); assert.equal(await p.$eval('input[name=side][value=sell]', (e) => e.checked), true); { const t = await p.innerText('#dlg'); assert(/You hold/.test(t) && !/\d[.,]\d{3,}\s*IDR/.test(t.replace(/\d{1,3}([.,]\d{3})+/g, 'N')), 'a tidy balance line: ' + t.slice(0, 120)); }
  const before5 = [await cashQ(ids.c), await bank()];
  await p.selectOption('select[name=account]', ids.w); await p.fill('input[name=amount]', '1000000'); await p.fill('input[name=fee]', '2000'); await p.click('#dlg button[type=submit]'); await settle();
  assert.deepEqual([await cashQ(ids.c), await bank()], [before5[0] - 1000000 - 2000, before5[1] + 1000000], 'withdrawal: the Cash balance gave amount + fee, the bank received the amount');
  const t5 = await p.evaluate(() => D().transactions.filter((t) => t.transfer_id && /Transfer from Ajaib/.test(t.note)).length + D().transactions.filter((t) => t.transfer_id && t.type === 'expense' && !t.wallet_id).length); assert.equal(t5, 2, 'saved as a transfer with its fee');
  await p.evaluate((id) => { holdingDialog(D().holdings.find((x) => x.id === id)); }, ids.c); await p.waitForSelector('#dlg [data-act=trade][data-side=buy]'); await p.click('#dlg [data-act=trade][data-side=buy]'); await p.waitForSelector('form[data-form=cashx]');
  await p.selectOption('select[name=account]', ids.w); await p.fill('input[name=amount]', '500000'); await p.fill('input[name=fee]', '1000'); await p.click('#dlg button[type=submit]'); await settle();
  assert.deepEqual([await cashQ(ids.c), await bank()], [before5[0] - 1000000 - 2000 + 500000, before5[1] + 1000000 - 500000 - 1000], 'deposit: the bank paid amount + fee, the Cash balance received the amount');
  // the Deposit / Withdraw switch inside the pop-up changes the side
  await p.evaluate((id) => cashDialog(D().holdings.find((x) => x.id === id), 'buy'), ids.c); await p.waitForSelector('form[data-form=cashx]'); await p.click('input[name=side][value=sell] + *, label:has(input[name=side][value=sell])'); await p.waitForFunction(() => document.querySelector('input[name=side][value=sell]').checked); await p.click('#dlg [data-act=close]');
  // such a transfer opens in the Transactions list as an editable transfer
  await p.evaluate(() => { location.hash = '#/transactions'; render(); }); await p.waitForSelector('#txn-list .day-row'); await p.evaluate(() => document.querySelector('[data-act=days-all]').click());
  await p.click('#txn-list .day-body .row:has-text("Transfer from Ajaib")'); await p.waitForSelector('[data-act=delete-transfer]'); assert.equal(await p.inputValue('input[name=fee]'), '2000'); await p.click('#dlg [data-act=close]');
  // 6. cash trades made before transfers existed become transfers on load
  await p.evaluate((x) => { const h = D().holdings.find((q) => q.id === x.c2); const tr = { id: uid(), date: '2026-01-05', side: 'buy', quantity: 1000, amount_minor: 1000, currency: 'IDR', wallet_id: x.w }; h.trades.push(tr); h.quantity = 1000;
    D().transactions.push({ id: uid(), trade_id: tr.id, wallet_id: x.w, type: 'transfer', flow: 'out', amount_minor: 1000, currency: 'IDR', occurred_at: '2026-01-05', note: 'Bought 1,000 IDR', category_id: null, category_source: 'user', ai_confidence: null }); }, ids);
  const conv = await p.evaluate(() => { const r = convertCashTrades(); const t = D().transactions.find((x) => x.note.startsWith('Transfer to Bibit')); return [r, !!t, t && !!t.transfer_id, convertCashTrades()]; });
  assert.deepEqual(conv, [true, true, true, false], 'converted once, then nothing left to convert');
  // saved: the wallet-less fee row reaches the database tied to its cash event
  const l = await p.evaluate(() => window.__log.splice(0)); const txr = l.filter((o) => o.table === 'transactions').flatMap((o) => o.rows || []); assert(txr.some((r) => r.transfer_group_id && r.holding_event_id), 'a transfer leg tied to a Cash balance event was saved');
  assert.deepEqual(errs, []);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
