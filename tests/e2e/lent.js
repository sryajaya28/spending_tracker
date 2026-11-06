const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Money lent comes out of an account (PRD 2026-11-06): a required From account (savings accounts only, currency follows it), one transfer out with
   category Lent that is not spending, the same low-balance message as a loan payment, edits keep the transaction in step, an older record without an
   account can still be edited, the link survives a reload, and add_lent carries has_account. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { window.__ANALYTICS_TEST = true; });
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.route('**/ingest/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('form[data-form=signin] button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle());
  await p.evaluate(() => { state.ui.onbSkipped = true; const w = D().wallets[0]; w.name = 'BCA'; w.opening_balance_minor = 1000000;
    D().wallets.push({ id: 'wcard', name: 'Visa', type: 'card', currency: w.currency, opening_balance_minor: 0, archived: false }, { id: 'wusd', name: 'Dollar', type: 'bank', currency: w.currency === 'USD' ? 'EUR' : 'USD', opening_balance_minor: 900000, archived: false }); render(); });
  const tot = () => p.evaluate(() => D().wallets.filter((w) => w.id !== 'wusd').reduce((a, w) => a + walletBalance(w), 0) + D().lent.reduce((a, l) => a + loanBalance(l), 0));
  const before = await tot(), spendBefore = await p.evaluate(() => D().transactions.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount_minor, 0));
  // 1. the form: a required From account listing savings accounts, not cards; the currency follows the account
  await p.evaluate(() => lentDialog()); await p.waitForSelector('form[data-form=lent] select[name=account]');
  assert.equal(await p.$eval('select[name=account]', (e) => e.required), true, 'From account is required');
  const names = await p.$$eval('select[name=account] option', (o) => o.map((x) => x.textContent)); assert.ok(names.some((n) => /^BCA/.test(n)) && !names.some((n) => /^Visa/.test(n)), 'savings accounts only: ' + names);
  const wc = await p.evaluate(() => walletOf('wusd').currency); await p.selectOption('select[name=account]', 'wusd'); assert.equal(await p.$eval('select[name=currency]', (e) => e.value), wc, 'currency follows the account');
  assert.equal(await p.$eval('select[name=currency]', (e) => e.disabled), true);
  // 2. not enough balance: the same message as a loan payment, Save is off
  await p.selectOption('select[name=account]', await p.evaluate(() => D().wallets[0].id)); await p.fill('[name=name]', 'Budi'); await p.fill('[name=amount]', '1500000');
  assert.match(await p.textContent('#lent-err'), /BCA doesn't have enough balance/); assert.equal(await p.$eval('[data-send]', (e) => e.disabled), true);
  // 3. a good loan: balance drops, one transfer out with category Lent, owed to me, net worth unchanged, not spending
  await p.fill('[name=amount]', '500000'); assert.equal(await p.$eval('[data-send]', (e) => e.disabled), false); await p.click('[data-send]'); await settle();
  const r = await p.evaluate(() => { const l = D().lent[0], t = D().transactions.find((x) => x.id === l.txn_id); return { bal: walletBalance(D().wallets[0]), owed: loanBalance(l), t: t && [t.type, t.flow, t.note, catOf(t.category_id).name, t.wallet_id === D().wallets[0].id, t.amount_minor, t.occurred_at], n: D().transactions.filter((x) => x.note === 'Budi').length }; });
  assert.equal(r.bal, 500000); assert.equal(r.owed, 500000); assert.deepEqual(r.t.slice(0, 6), ['transfer', 'out', 'Budi', 'Lent', true, 500000]); assert.equal(r.n, 1, 'exactly one transaction');
  assert.equal(await tot(), before, 'net worth unchanged'); assert.equal(await p.evaluate(() => D().transactions.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount_minor, 0)), spendBefore, 'not counted as spending');
  const ev = await p.evaluate(() => window.__phEvents.find((e) => e.event === 'add_lent')); assert.equal(ev.properties.has_account, true); assert.ok(!/Budi|500000/.test(JSON.stringify(ev)), 'no name or amount in the event');
  // 4. Transactions shows it as a transfer out with the Lent chip; it opens read-only "managed from Money lent"
  await p.evaluate(() => { location.hash = '#/transactions'; }); await p.waitForSelector('[data-act=days-all]'); await p.click('[data-act=days-all]'); await p.waitForSelector('.row[data-act=lent-origin]');
  const row = await p.$eval('.row[data-act=lent-origin]', (e) => ({ s: e.querySelector('.sub').textContent, c: e.querySelector('.badge').textContent, a: e.querySelector('.amt').textContent })); assert.match(row.s, /^Transfer out · BCA/); assert.equal(row.c, 'Lent'); assert.match(row.a, /^−/);
  await p.click('.row[data-act=lent-origin]'); await p.waitForSelector('#dlg[open] [data-act=edit-lent]'); assert.match(await p.textContent('#dlg'), /Managed from Money lent/); assert.equal(await p.$('#dlg form'), null, 'no edit form on the transaction');
  // 5. edit through Money lent: the transaction follows (amount, date), the balance too
  await p.click('#dlg [data-act=edit-lent]'); await p.waitForSelector('form[data-form=lent]'); await p.fill('[name=amount]', '300000'); await p.fill('[name=name]', 'Budi S'); await p.click('[data-send]'); await settle();
  assert.deepEqual(await p.evaluate(() => { const l = D().lent[0], t = D().transactions.find((x) => x.id === l.txn_id); return [t.amount_minor, t.note, walletBalance(D().wallets[0]), loanBalance(l), D().transactions.filter((x) => x.type === 'transfer').length]; }), [300000, 'Budi S', 700000, 300000, 1], 'edit keeps the linked transaction in step');
  // 6. the link survives a reload from the database
  await p.evaluate(() => loadUserData()); await p.waitForFunction(() => D() && D().lent.length === 1); assert.equal(await p.evaluate(() => !!D().transactions.find((x) => x.id === D().lent[0].txn_id)), true, 'txn_id persisted');
  // 7. an older record (no account, no transaction) shows as before and can be edited without picking an account
  await p.evaluate(() => { D().lent.push({ id: 'old1', name: 'Ibu', currency: D().wallets[0].currency, original_minor: 100000, note: '', due: '', since: '2026-01', archived: false, payments: [] }); lentDialog(D().lent[1]); });
  await p.waitForSelector('form[data-form=lent]'); assert.equal(await p.$eval('select[name=account]', (e) => e.disabled), true); assert.match(await p.textContent('select[name=account]'), /Not set \(older record\)/);
  await p.fill('[name=name]', 'Ibu K'); await p.click('[data-send]'); await settle();
  assert.deepEqual(await p.evaluate(() => [D().lent[1].name, D().lent[1].txn_id || null, D().transactions.filter((x) => x.type === 'transfer').length, walletBalance(D().wallets[0])]), ['Ibu K', null, 1, 700000], 'older record edited, no transaction made');
  assert.equal(await p.evaluate(() => window.__phEvents.filter((e) => e.event === 'update_lent').pop().properties.has_account), false);
  // 8. a lent date in the future is not allowed
  assert.equal(await p.evaluate(() => { lentDialog(); return $('form[data-form=lent] input[name=date]').max === isoDate(new Date()); }), true, 'future dates are blocked by the field');
  // 9. household: someone else's lent transaction cannot be changed by an Editor through the lent screen (only due date and note)
  await p.evaluate(() => { Cloud.household.hasMembers = true; Cloud.household.status = 'member'; Cloud.household.role = 'editor'; D().transactions.find((x) => x.id === D().lent[0].txn_id).by = 'someone-else'; close(); lentDialog(D().lent[0]); });
  await p.waitForSelector('form[data-form=lent]'); assert.deepEqual(await p.$$eval('form[data-form=lent] [name=name], [name=amount], [name=account], [name=date]', (e) => e.map((x) => x.disabled)), [true, true, true, true], 'locked fields'); assert.equal(await p.$eval('[name=due]', (e) => e.disabled), false);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
