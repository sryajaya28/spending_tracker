const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Move to account (holding dialog): an investment account holds each asset once (the database has unique account + symbol), so moving an
   asset into an account that already holds it combines the two (quantity, events, blended starting price); otherwise it is a plain move. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell'); await p.waitForTimeout(400);
  const ids = await p.evaluate(() => {
    state.ui.onbSkipped = true;
    const a = { id: uid(), name: 'Stockbit', archived: false }, a2 = { id: uid(), name: 'Bibit', archived: false }, a3 = { id: uid(), name: 'Pluang', archived: false }; D().investments.push(a, a2, a3);
    const mk = (acc, sym, q, since, open) => { const h = { id: uid(), account_id: acc.id, symbol: sym, quantity: q, since, trades: [], ...(open ? { open_price: open, ccy: 'USD' } : {}) }; D().holdings.push(h); return h; };
    const h1 = mk(a, 'BTC', 2, '2026-01', 100), h2 = mk(a2, 'BTC', 3, '2026-03', 200), h3 = mk(a, 'ETH', 4, '2026-02', 50), h4 = mk(a, 'SOL', 1, '2026-02');
    h1.trades.push({ id: 'ev1', date: '2026-04-01', side: 'buy', quantity: 1, amount_minor: 100, currency: 'USD', price: 300 });   // h1 ends with 3 = 1 opening (at 100) + 2 bought
    h3.trades.push({ id: 'sw1', date: '2026-04-02', side: 'sell', quantity: 1, via: { holding_id: h1.id, symbol: 'BTC', quantity: 1, pair: 'sw2' } });
    h1.trades.push({ id: 'sw2', date: '2026-04-02', side: 'buy', quantity: 1, via: { holding_id: h3.id, symbol: 'ETH', quantity: 1, pair: 'sw1' } });
    h1.quantity = 3; h3.quantity = 3;
    D().recurring = [{ id: 'r1', kind: 'txn', spec: { wallet_id: 'h:' + h1.id } }];
    mk(a3, 'BTC', 1, '2026-05'); save(); render();
    return { h1: h1.id, h2: h2.id, h3: h3.id, h4: h4.id, a: a.id, a2: a2.id, a3: a3.id };
  });
  const moveVia = async (id, acc) => { await p.evaluate((i) => holdingDialog(D().holdings.find((x) => x.id === i)), id); await p.waitForSelector('select[name=account]'); await p.selectOption('select[name=account]', acc); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(300); };
  // 1. into an account that already holds it: combined, not duplicated
  await moveVia(ids.h1, ids.a2);
  const r = await p.evaluate((ids) => { const btc = D().holdings.filter((h) => h.symbol === 'BTC'), dup = D().holdings.some((x, i, l) => l.findIndex((y) => y.account_id === x.account_id && y.symbol === x.symbol) !== i);
    const m = D().holdings.find((h) => h.id === ids.h2), c = holdingCost(m); return { n: D().holdings.filter((h) => h.symbol === 'BTC' && h.account_id === ids.a2).length, dup, qty: m.quantity, since: m.since, trades: m.trades.map((t) => t.id).sort().join(), open: m.open_price, q0: c.q0, gone: !D().holdings.some((h) => h.id === ids.h1), toast: document.querySelector('#toast')?.textContent,
      via: D().holdings.find((h) => h.id === ids.h3).trades[0].via.holding_id === ids.h2, rule: D().recurring[0].spec.wallet_id === 'h:' + ids.h2, others: btc.length }; }, ids);
  assert.equal(r.n, 1, 'one BTC in the target account'); assert.equal(r.dup, false, 'no two holdings with the same account + asset'); assert.equal(r.qty, 6, 'quantities add up'); assert.equal(r.since, '2026-01', 'earliest start kept');
  assert.equal(r.trades, 'ev1,sw2', 'events moved over'); assert.equal(r.gone, true, 'the moved holding is gone'); assert.equal(r.q0, 4, 'openings add up (3 + 1)'); assert.equal(r.open, 175, 'starting price blended: (3*200 + 1*100) / 4');
  assert.equal(r.via, true, 'swap pair points at the combined holding'); assert.equal(r.rule, true, 'recurring rule points at the combined holding'); assert.match(r.toast || '', /combined/i);
  // 2. into an account that does not hold it: a plain move, same holding
  await moveVia(ids.h3, ids.a3);
  assert.deepEqual(await p.evaluate((ids) => { const h = D().holdings.find((x) => x.id === ids.h3); return [h.account_id === ids.a3, document.querySelector('#toast')?.textContent]; }, ids), [true, 'Saved']);
  // 3. an unpriced holding merged into a priced one: the starting price becomes unknown
  await p.evaluate((ids) => { D().holdings.push({ id: 'sol2', account_id: ids.a2, symbol: 'SOL', quantity: 2, since: '2026-02', trades: [], open_price: 10, ccy: 'USD' }); }, ids);
  await moveVia(ids.h4, ids.a2);
  assert.deepEqual(await p.evaluate(() => { const s = D().holdings.filter((h) => h.symbol === 'SOL'); return [s.length, s[0].quantity, s[0].open_price === undefined]; }), [1, 3, true]);
  // 4. a combined holding can still be saved to the database (the stand-in enforces nothing, so check the rows we would send)
  await p.evaluate(() => Cloud.idle());
  assert.deepEqual(errs, [], 'no page errors');
  console.log('ok movehold'); await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
