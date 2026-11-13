const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Move to account for stablecoin / crypto: Quantity, Network fee, Date. The fee is deducted from the amount moved (send 100, fee 1: 99 arrive),
   one transfer row on Transactions that opens a details dialog with Delete, the fee is its own Fee expense, the average price is kept, delete reverses it. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell'); await p.waitForTimeout(400);
  const ids = await p.evaluate(() => {
    state.ui.onbSkipped = true;
    const a = { id: uid(), name: 'Binance', archived: false }, a2 = { id: uid(), name: 'Ledger', archived: false }, a3 = { id: uid(), name: 'Kraken', archived: false }; D().investments.push(a, a2, a3);
    const mk = (acc, sym, q, open) => { const h = { id: uid(), account_id: acc.id, symbol: sym, quantity: q, since: '2026-01', trades: [], ...(open ? { open_price: open, ccy: 'USD' } : {}) }; D().holdings.push(h); return h; };
    const u = mk(a, 'USDT', 500), btc = mk(a, 'BTC', 2, 100), btc2 = mk(a3, 'BTC', 1, 200), st = mk(a, 'AAPL', 3, 50);
    save(); render(); return { a: a.id, a2: a2.id, a3: a3.id, u: u.id, btc: btc.id, btc2: btc2.id, st: st.id };
  });
  const openMove = async (id, acc) => { await p.evaluate((i) => holdingDialog(D().holdings.find((x) => x.id === i)), id); await p.waitForSelector('select[name=account]'); await p.selectOption('select[name=account]', acc); };
  // 1. the move fields appear only for stablecoin / crypto and only once another account is chosen; stocks keep the plain move
  await p.evaluate((i) => holdingDialog(D().holdings.find((x) => x.id === i)), ids.st); await p.waitForSelector('select[name=account]');
  assert.equal(await p.locator('[data-move-box]').count(), 0, 'no quantity / fee fields for a stock'); await p.keyboard.press('Escape'); await p.evaluate(() => close());
  await p.evaluate((i) => holdingDialog(D().holdings.find((x) => x.id === i)), ids.u); await p.waitForSelector('[data-move-box]', { state: 'attached' });
  assert.equal(await p.locator('[data-move-box]').isHidden(), true, 'hidden while the account is unchanged');
  assert.equal(await p.inputValue('[name=mvqty]'), '500', 'quantity defaults to everything held');
  await p.evaluate(() => close());
  // 2. stablecoin: send 100, fee 1 -> the new account gets 99; the fee is a Fee expense; net worth drops by the fee only
  const before = await p.evaluate(() => ({ nw: portfolioUSD(currentPeriod()), spent: D().transactions.filter((t) => t.type === 'expense').length }));
  await openMove(ids.u, ids.a2); assert.equal(await p.locator('[data-move-box]').isVisible(), true, 'fields shown for another account');
  await p.fill('[name=mvqty]', '100'); await p.fill('[name=mvfee]', '1'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(300);
  const r = await p.evaluate((ids) => { const src = D().holdings.find((h) => h.id === ids.u), dst = D().holdings.find((h) => h.account_id === ids.a2 && h.symbol === 'USDT'), legs = D().transactions.filter((t) => t.transfer_id), fee = D().transactions.find((t) => /Network fee/.test(t.note || ''));
    return { src: src.quantity, dst: dst && dst.quantity, legs: legs.map((t) => t.flow).sort().join(), wallets: legs.map((t) => t.wallet_id), fee: fee && [fee.amount_minor, catOf(fee.category_id).name, fee.type], nw: portfolioUSD(currentPeriod()), kinds: src.trades.map((t) => t.kind + ':' + t.quantity).join() + ' | ' + dst.trades.map((t) => t.kind + ':' + t.quantity).join(), toast: document.querySelector('#toast')?.textContent }; }, ids);
  assert.equal(r.src, 400); assert.equal(r.dst, 99, 'destination gets quantity minus fee'); assert.equal(r.legs, 'in,out'); assert.deepEqual(r.wallets, [null, null]); assert.deepEqual(r.fee, [100, 'Fee', 'expense'], 'fee: USD 1.00 in Fee');
  assert.equal(r.kinds, 'transfer:99,expense:1 | transfer:99'); assert.ok(Math.abs(before.nw - r.nw - 1) < 1e-6, 'net worth drops by the fee only: ' + (before.nw - r.nw)); assert.match(r.toast || '', /99/);
  // 3. Transactions: one transfer row "Binance -> Ledger" with USDT 99.00, plus the separate fee row
  await p.evaluate(() => { location.hash = '#/transactions'; }); await p.waitForSelector('[data-act=days-all]'); await p.click('[data-act=days-all]'); await p.waitForSelector('.row[data-act=view-transfer]');
  const row = await p.locator('.row[data-act=view-transfer]').allInnerTexts(); assert.equal(row.length, 1, 'one transfer row, not two'); assert.match(row[0], /Binance → Ledger/); assert.match(row[0], /USDT 99\.00/);
  assert.equal(await p.locator('.row', { hasText: 'Network fee' }).count(), 1, 'the fee is its own row');
  // 4. the row opens the details dialog (not the wallet transfer dialog); the fee row opens the same one
  await p.click('.row[data-act=view-transfer]'); await p.waitForSelector('[data-act=delete-coin-transfer]');
  const dtxt = await p.innerText('#dlg'); assert.match(dtxt, /Binance → Ledger/); assert.match(dtxt, /Sent\s*100 USDT/); assert.match(dtxt, /Network fee\s*1 USDT/); assert.match(dtxt, /Received\s*99 USDT/);
  await p.evaluate(() => close()); await p.click('.row:has-text("Network fee")'); await p.waitForSelector('[data-act=delete-coin-transfer]'); await p.evaluate(() => close());
  // 5. delete refused while the destination no longer holds the received quantity
  const gid = await p.evaluate(() => D().transactions.find((t) => t.transfer_id).transfer_id);
  await p.evaluate((ids) => { D().holdings.find((h) => h.account_id === ids.a2 && h.symbol === 'USDT').quantity = 50; }, ids);
  await p.evaluate((g) => coinTransferDialog(g), gid); await p.click('[data-act=delete-coin-transfer]'); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => D().transactions.filter((t) => t.transfer_id).length), 2, 'still there after a refused delete'); assert.match(await p.evaluate(() => document.querySelector('#toast')?.textContent), /no longer holds/);
  await p.evaluate((ids) => { D().holdings.find((h) => h.account_id === ids.a2 && h.symbol === 'USDT').quantity = 99; }, ids);
  // 6. delete reverses everything; the destination created by the move goes away
  await p.evaluate((g) => coinTransferDialog(g), gid); await p.click('[data-act=delete-coin-transfer]'); await p.waitForTimeout(300);
  const d = await p.evaluate((ids) => ({ src: D().holdings.find((h) => h.id === ids.u).quantity, tr: D().holdings.find((h) => h.id === ids.u).trades.length, dst: D().holdings.some((h) => h.account_id === ids.a2), txns: D().transactions.filter((t) => t.transfer_id || /Network fee/.test(t.note || '')).length, nw: portfolioUSD(currentPeriod()) }), ids);
  assert.deepEqual([d.src, d.tr, d.dst, d.txns], [500, 0, false, 0]); assert.ok(Math.abs(d.nw - before.nw) < 1e-6, 'net worth back');
  // 7. crypto: partial move with a fee into an account that already holds it; the average price is kept (source 100, destination blends 200 and 100)
  await openMove(ids.btc, ids.a3); await p.fill('[name=mvqty]', '1'); await p.fill('[name=mvfee]', '0.1'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(300);
  const c = await p.evaluate((ids) => { const s = D().holdings.find((h) => h.id === ids.btc), t = D().holdings.find((h) => h.id === ids.btc2), sc = holdingCost(s), tc = holdingCost(t);
    return { sq: s.quantity, tq: t.quantity, savg: sc.avg, sreal: sc.realized, tavg: tc.avg, tqty: tc.qty, known: tc.known, one: D().holdings.filter((h) => h.account_id === ids.a3 && h.symbol === 'BTC').length }; }, ids);
  assert.equal(c.sq, 1); assert.equal(c.tq, 1.9); assert.equal(c.one, 1, 'merged into the existing account holding'); assert.ok(Math.abs(c.savg - 100) < 1e-9, 'source average unchanged'); assert.ok(Math.abs(c.sreal) < 1e-9, 'no profit or loss from a move: ' + c.sreal);
  assert.ok(Math.abs(c.tavg - (200 + 0.9 * 100) / 1.9) < 1e-9, 'destination blends the source average: ' + c.tavg); assert.ok(c.known && Math.abs(c.tqty - 1.9) < 1e-9);
  // 8. refusals: more than held, a fee not below the quantity
  await openMove(ids.btc, ids.a2); await p.fill('[name=mvqty]', '5'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(200); assert.match(await p.evaluate(() => document.querySelector('#toast')?.textContent), /only hold/);
  await p.fill('[name=mvqty]', '1'); await p.fill('[name=mvfee]', '1'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(200); assert.match(await p.evaluate(() => document.querySelector('#toast')?.textContent), /less than/);
  assert.equal(await p.evaluate((ids) => D().holdings.find((h) => h.id === ids.btc).quantity, ids), 1, 'nothing moved after a refusal');
  await p.evaluate(() => Cloud.idle());
  assert.deepEqual(errs, [], 'no page errors');
  console.log('ok cointransfer'); await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
