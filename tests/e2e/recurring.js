const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Recurring: a Repeat choice on expense/income/transfer creates a rule; due entries are added when the app opens. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle()), log = () => p.evaluate(() => window.__log.splice(0));
  // date maths
  const m = await p.evaluate(() => [nthDate('2026-01-31', 'monthly', 1), nthDate('2026-01-31', 'monthly', 2), nthDate('2026-10-28', 'weekly', 1), nthDate('2026-12-15', 'monthly', 1), nextAfter({ start: '2026-10-05', freq: 'weekly' }, '2026-10-31')]);
  assert.deepEqual(m, ['2026-02-28', '2026-03-31', '2026-11-04', '2027-01-15', '2026-11-02']);
  await p.evaluate(() => { D().wallets[0].opening_balance_minor = 90000000; save(); }); await settle(); await log();
  // weekly expense that started 3 weeks + 1 day ago
  const start = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 22); return isoDate(d); });
  await p.click('.nav-add'); await p.fill('input[name=amount]', '50000'); await p.fill('input[name=date]', start); await p.fill('textarea[name=note]', 'Gym');
  await p.selectOption('select[name=repeat]', 'weekly'); await p.click('#dlg button[type=submit]'); await settle();
  let l = await log(); const rule = l.find((o) => o.table === 'recurring_rules'); assert(rule, 'rule saved'); assert.equal(rule.rows[0].frequency, 'weekly'); assert.equal(rule.rows[0].spec.amount_minor, 50000);
  // the first entry, plus the three catch-up entries created straight away on the next open
  const before = await p.evaluate(() => D().transactions.filter((t) => t.note === 'Gym').length); assert(before >= 1 && before <= 4, 'first entry saved: ' + before);
  // the app may already have caught up on its own (a scheduled run, more likely on a loaded machine): either way four entries, none twice
  const n = await p.evaluate(() => runRecurring()); assert.equal(n, 4 - before, 'the missing weeks caught up');
  assert.equal(await p.evaluate(() => D().transactions.filter((t) => t.note === 'Gym').length), 4);
  assert.equal(await p.evaluate(() => runRecurring()), 0, 'nothing more due, no duplicates');
  const ids = await p.evaluate(() => D().transactions.filter((t) => t.note === 'Gym').map((t) => t.id)); assert.equal(new Set(ids).size, 4);
  const next = await p.evaluate(() => D().recurring[0].next); assert(next > (await p.evaluate(() => isoDate(new Date()))));
  await settle();
  // transfer, monthly
  await p.evaluate(() => { D().wallets.push({ id: uid(), name: 'Bank', type: 'bank', currency: 'IDR', opening_balance_minor: 0, archived: false, since: '2026-01' }); save(); render(); });
  const ws = await p.evaluate(() => D().wallets.map((w) => w.id));
  await p.evaluate(() => transferDialog()); await p.selectOption('select[name=from]', 'w:' + ws[0]); await p.selectOption('select[name=to]', 'w:' + ws[1]);
  await p.fill('input[name=amount]', '100000'); await p.fill('input[name=fee]', '2500'); await p.selectOption('select[name=repeat]', 'monthly'); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await p.evaluate(() => D().recurring.length), 2);
  await p.evaluate(() => { const r = D().recurring[1]; r.next = '2026-09-10'; r.start = '2026-07-10'; runRecurring(); });
  const tr = await p.evaluate(() => D().transactions.filter((t) => t.type === 'transfer' && t.flow === 'out').length); assert(tr >= 3, 'monthly transfers caught up: ' + tr);
  // investment buy (DCA): replayed through the same trade code, paying from a wallet
  const inv = await p.evaluate(() => { const acc = D().investments[0] || (D().investments.push({ id: uid(), name: 'Broker', archived: false }), D().investments[0]);
    const r = addRule('invest', 'monthly', '2026-08-15', { account: acc.id, symbol: 'BTC', quantity: 0.001, fund: 'w:' + D().wallets[0].id, fundamount: '150000' }); r.next = '2026-09-15'; runRecurring();
    const h = D().holdings.find((x) => x.symbol === 'BTC'); return { q: h && h.quantity, trades: h && h.trades.length }; });
  assert(inv.trades >= 2 && Math.abs(inv.q - 0.001 * inv.trades) < 1e-9, 'recurring buys recorded: ' + JSON.stringify(inv));
  // manage list
  await p.evaluate(() => { location.hash = '#/settings/recurring'; render(); }); assert((await p.innerText('main')).includes('Recurring'));
  await p.click('[data-act=rec-manage] >> nth=0'); await p.click('#dlg [data-act=rec-toggle]'); assert.equal(await p.evaluate(() => D().recurring[0].active), false);
  await p.screenshot({ path: __dirname + '/out/recurring_settings.png' });
  await p.click('[data-act=rec-manage] >> nth=0'); await p.click('#dlg [data-act=rec-del]'); assert.equal(await p.evaluate(() => D().recurring.length), 2);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
