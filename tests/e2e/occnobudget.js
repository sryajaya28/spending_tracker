const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* A special occasion can exist without a budget (Settings), be tagged to spending, and get a budget later from Budgets.
   An occasion created from Budgets also shows in Settings. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const log = () => p.evaluate(() => window.__log.splice(0)), settle = () => p.evaluate(() => Cloud.idle());
  await p.evaluate(() => { location.hash = '#/settings'; render(); }); await p.waitForSelector('#occasions-card'); await log();
  // 1. Settings: add an occasion with no budget
  await p.click('#occasions-card [data-act=add-occasion]'); await p.fill('#dlg input[name=name]', 'Wedding'); assert(!(await p.$eval('#dlg input[name=amount]', (e) => e.required)), 'budget is optional here');
  await p.click('#dlg button[type=submit]'); await settle();
  let l = await log(); const row = l.find((o) => o.table === 'occasions').rows[0]; assert.equal(row.name, 'Wedding'); assert.equal(row.amount_minor, null, 'no budget is stored as null');
  let t = await p.innerText('#occasions-card'); assert(t.includes('Wedding') && t.includes('No budget'), t);
  // 2. not on Budgets (it has no budget), but it can be tagged to an expense
  await p.evaluate(() => { location.hash = '#/budgets'; render(); }); assert(!(await p.innerText('.main')).includes('Wedding'), 'no budget: not listed on Budgets');
  await p.evaluate(() => txnDialog(null, 'expense')); assert((await p.$$eval('#dlg select[name=occasion] option', (o) => o.map((x) => x.textContent))).some((x) => x.includes('Wedding')), 'can be tagged');
  await p.click('#dlg [data-act=close]');
  // 3. Budgets > + Add: pick the pre-added occasion and give it a budget
  await p.click('[data-act=add-occasion-budget]'); await p.waitForSelector('#dlg select[name=pick]');
  assert.equal(await p.$eval('#dlg select[name=pick]', (s) => s.selectedOptions[0].textContent.includes('Wedding')), true, 'the pre-added occasion is offered');
  assert(!(await p.isVisible('#dlg input[name=name]')), 'name hidden while an existing occasion is picked'); assert(await p.$eval('#dlg input[name=amount]', (e) => e.required), 'a budget is required here');
  await p.fill('#dlg input[name=amount]', '5000000'); await p.click('#dlg button[type=submit]'); await settle();
  l = await log(); assert.equal(l.find((o) => o.table === 'occasions').rows[0].amount_minor, 5000000);
  assert.equal(await p.evaluate(() => D().occasions.filter((o) => o.name === 'Wedding').length), 1, 'no duplicate occasion');
  assert((await p.innerText('.main')).includes('Wedding'), 'now on Budgets');
  // 4. a new occasion from Budgets also shows in Settings
  await p.click('[data-act=add-occasion-budget]'); await p.waitForSelector('#dlg input[name=name]'); await p.fill('#dlg input[name=name]', 'Bali Trip'); await p.fill('#dlg input[name=amount]', '10000000'); await p.click('#dlg button[type=submit]'); await settle();
  await p.evaluate(() => { location.hash = '#/settings'; render(); }); t = await p.innerText('#occasions-card'); assert(t.includes('Bali Trip') && t.includes('Wedding'), t);
  // 5. removing the budget in Edit keeps the occasion in Settings and takes it off Budgets
  await p.click(`#occasions-card [data-act=edit-occasion][data-id="${await p.evaluate(() => D().occasions.find((o) => o.name === 'Wedding').id)}"]`); await p.fill('#dlg input[name=amount]', ''); await p.click('#dlg button[type=submit]'); await settle();
  assert((await p.innerText('#occasions-card')).includes('Wedding'));
  await p.evaluate(() => { location.hash = '#/budgets'; render(); }); assert(!(await p.innerText('.main')).includes('Wedding'), 'budget removed: off Budgets');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
