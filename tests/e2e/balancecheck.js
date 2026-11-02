const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* An expense cannot be more than the account holds (normal accounts); not checked for income, credit cards, loan accounts and future-dated expenses. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell'); await p.waitForTimeout(400);
  const settle = () => p.evaluate(() => Cloud.idle()), toast = () => p.evaluate(() => document.getElementById('toast').textContent);
  const count = (note) => p.evaluate((n) => D().transactions.filter((t) => t.note === n).length, note);
  await p.evaluate(() => { state.ui.onbSkipped = true; D().wallets[0].opening_balance_minor = 100000; render(); });   // Rp 100.000 in the account
  const add = async (amount, note, type = 'expense', date) => { await p.evaluate((t) => txnDialog(null, t), type); await p.waitForSelector('#dlg [name=amount]'); await p.fill('#dlg [name=amount]', String(amount)); await p.fill('#dlg [name=note]', note); if (date) await p.fill('#dlg [name=date]', date); await p.click('#dlg button[type=submit]'); await settle(); await p.waitForTimeout(120); };
  // more than the balance: refused, nothing saved, the pop-up stays open, the message says what is available
  await add(150000, 'Too much'); assert.equal(await count('Too much'), 0, 'not saved'); assert(await p.evaluate(() => document.getElementById('dlg').open), 'pop-up stays open');
  const msg = (await toast()).replace(/ /g, ' '); assert(/enough balance/.test(msg) && /100\.000/.test(msg), msg);
  await p.fill('#dlg [name=amount]', '100000'); await p.click('#dlg button[type=submit]'); await settle(); assert.equal(await count('Too much'), 1, 'exactly the balance is allowed');   // the note field is still filled
  assert.equal(await p.evaluate(() => walletBalance(D().wallets[0])), 0);
  // empty account: any expense is refused, income is not
  await add(1, 'Nothing left'); assert.equal(await count('Nothing left'), 0); await p.click('#dlg .dlg-x');
  await add(50000, 'Salary', 'income'); assert.equal(await count('Salary'), 1, 'income is never checked');
  // a future-dated expense is not checked (nothing leaves yet)
  const fut = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 10); return isoDate(d); });
  await add(900000, 'Later', 'expense', fut); assert.equal(await count('Later'), 1, 'upcoming expense allowed');
  // editing: its own old amount counts as available again (balance 50.000 after the salary; this expense is 30.000 -> 20.000 left)
  await add(30000, 'Editable'); const id = await p.evaluate(() => D().transactions.find((t) => t.note === 'Editable').id);
  const edit = async (amount) => { await p.evaluate((i) => txnDialog(D().transactions.find((t) => t.id === i)), id); await p.waitForSelector('#dlg [name=amount]'); await p.fill('#dlg [name=amount]', String(amount)); await p.click('#dlg button[type=submit]'); await settle(); await p.waitForTimeout(120); };
  await edit(50000); assert.equal(await p.evaluate((i) => D().transactions.find((t) => t.id === i).amount_minor, id), 50000, 'up to old amount + balance is allowed');
  await edit(50001); assert.equal(await p.evaluate((i) => D().transactions.find((t) => t.id === i).amount_minor, id), 50000, 'one more is refused'); assert(/enough balance/.test(await toast())); await p.click('#dlg .dlg-x');
  // a credit card account can go below zero
  await p.evaluate(() => { const w = D().wallets[0]; D().wallets.push({ ...JSON.parse(JSON.stringify(w)), id: uid(), name: 'Visa', type: 'card', opening_balance_minor: 0 }); render(); });
  await p.evaluate(() => txnDialog(null, 'expense')); await p.waitForSelector('#dlg [name=amount]'); await p.selectOption('#dlg select[name=wallet]', await p.evaluate(() => D().wallets.find((w) => w.name === 'Visa').id));
  await p.fill('#dlg [name=amount]', '700000'); await p.fill('#dlg [name=note]', 'On the card'); await p.click('#dlg button[type=submit]'); await settle(); await p.waitForTimeout(120); assert.equal(await count('On the card'), 1, 'cards are not checked');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
