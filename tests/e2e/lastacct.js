const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* The account selected when adding follows the one used last, separately for expense, income and investment. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const ids = await p.evaluate(() => { const w1 = D().wallets[0], w2 = { ...w1, id: uid(), name: 'Second', opening_balance_minor: 5000000 }, w3 = { ...w1, id: uid(), name: 'Third', opening_balance_minor: 5000000 }; w1.opening_balance_minor = 5000000; D().wallets.push(w2, w3); D().investments.push({ id: uid(), name: 'Broker A', archived: false }, { id: uid(), name: 'Broker B', archived: false }); save(); render(); return { w1: w1.id, w2: w2.id, w3: w3.id, a: D().investments[D().investments.length - 2].id, b: D().investments[D().investments.length - 1].id }; });
  const settle = () => p.evaluate(() => Cloud.idle());
  const sel = () => p.inputValue('select[name=wallet]');
  const add = async (type, wallet, amount) => { await p.evaluate((t) => txnDialog(null, t), type); await p.selectOption('select[name=wallet]', wallet); await p.fill('input[name=amount]', amount); await p.click('#dlg button[type=submit]'); await settle(); };
  // before anything is used: the first account in the reporting currency
  await p.evaluate(() => txnDialog(null, 'expense')); assert.equal(await sel(), ids.w1, 'default before any use'); await p.click('[data-act=close]');
  // nothing remembered on this device: the account of the latest expense/income on record is used
  await p.evaluate((id) => { D().transactions.unshift({ id: 'old1', type: 'expense', amount_minor: 100, currency: D().wallets[0].currency, wallet_id: id, category_id: null, note: 'old', occurred_at: isoDate(new Date()) }); localStorage.removeItem('stiver.lastacct.v1'); }, ids.w3);
  await p.evaluate(() => txnDialog(null, 'expense')); assert.equal(await sel(), ids.w3, 'falls back to the latest expense on record'); await p.click('[data-act=close]');
  await p.evaluate(() => { D().transactions = D().transactions.filter((t) => t.id !== 'old1'); localStorage.removeItem('stiver.lastacct.v1'); });
  // an expense from the second account: the next expense starts on it, income still on its own default
  await add('expense', ids.w2, '10');
  await p.evaluate(() => txnDialog(null, 'expense')); assert.equal(await sel(), ids.w2, 'expense follows the last one used'); await p.click('[data-act=close]');
  await p.evaluate(() => txnDialog(null, 'income')); assert.equal(await sel(), ids.w1, 'income is separate'); await p.click('[data-act=close]');
  await add('income', ids.w3, '20');
  await p.evaluate(() => txnDialog(null, 'income')); assert.equal(await sel(), ids.w3, 'income follows its own last'); await p.click('[data-act=close]');
  await p.evaluate(() => txnDialog(null, 'expense')); assert.equal(await sel(), ids.w2, 'expense unchanged by income'); 
  // switching the type inside the dialog picks that type's last account
  await p.click('#dlg .seg label:has(input[value=income])'); assert.equal(await sel(), ids.w3, 'switching to income uses its last'); await p.click('#dlg .seg label:has(input[value=expense])'); assert.equal(await sel(), ids.w2, 'and back to expense'); await p.click('[data-act=close]');
  // editing a transaction does not change it
  // investment: Pay with and the investment account
  await p.evaluate(() => holdingDialog(null, null, { invest: true })); await p.fill('input[name=assetq]', 'voo'); await p.waitForSelector('#asset-results .res'); await p.click('#asset-results .res');
  await p.selectOption('select[name=account]', ids.b); await p.selectOption('select[name=fund]', 'w:' + ids.w3); await p.fill('input[name=quantity]', '1'); await p.fill('input[name=fundamount]', '300'); await p.click('#dlg button[type=submit]'); await settle();
  await p.evaluate(() => holdingDialog(null, null, { invest: true })); assert.equal(await p.inputValue('select[name=fund]'), 'w:' + ids.w3, 'Pay with follows the last investment'); assert.equal(await p.inputValue('select[name=account]'), ids.b, 'investment account follows too');
  // a remembered account that is archived is not offered
  await p.click('[data-act=close]'); await p.evaluate((id) => { D().wallets.find((w) => w.id === id).archived = true; save(); }, ids.w2);
  await p.evaluate(() => txnDialog(null, 'expense')); assert.notEqual(await sel(), ids.w2, 'archived account is not preselected'); await p.click('[data-act=close]');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').filter((l) => l.includes('lastacct.js')).slice(0, 2).join(' | ')); process.exit(1); });
