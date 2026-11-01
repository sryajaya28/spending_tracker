const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const log = () => p.evaluate(() => window.__log.splice(0)), settle = () => p.evaluate(() => Cloud.idle());
  await p.evaluate(() => { location.hash = '#/transactions'; }); await p.click('[data-act=add-txn]');
  await p.fill('input[name=amount]', '45000'); await p.fill('textarea[name=note]', 'Gym snack');
  assert(await p.$eval('.quick-cat', (e) => e.hidden));
  // "Add new category" is the last entry of the Category list; choosing it opens the form but does not focus a field (no keyboard)
  assert(!(await p.$('[data-act=quick-cat]')), 'no separate add-category button');
  await p.evaluate(() => document.activeElement.blur());
  await p.selectOption('select[name=category]', '__new'); assert(!(await p.$eval('.quick-cat', (e) => e.hidden)));
  assert(!(await p.evaluate(() => document.activeElement.matches('input, textarea'))), 'no field focused');
  assert.equal(await p.$eval('select[name=category]', (s) => s.value), '', 'the list keeps its previous choice');
  // picking an existing category hides the form again
  const dn = await p.$eval('select[name=category]', (s) => [...s.options].find((o) => /Dining/.test(o.textContent)).value); await p.selectOption('select[name=category]', dn); assert(await p.$eval('.quick-cat', (e) => e.hidden), 'form hides when a category is chosen');
  await p.selectOption('select[name=category]', '__new'); assert(!(await p.$eval('.quick-cat', (e) => e.hidden)));
  // empty name is refused
  await p.click('[data-act=quick-cat-add]'); assert(!(await p.$eval('.quick-cat', (e) => e.hidden)));
  // a sub-category under Dining, added with Enter
  const dining = await p.$eval('select[name=qc_parent]', (s) => [...s.options].find((o) => /Dining/.test(o.textContent)).value);
  await p.selectOption('select[name=qc_parent]', dining); await p.fill('input[name=qc_name]', 'Snacks'); await p.fill('input[name=qc_icon]', '🍿');
  await p.screenshot({ path: __dirname + '/out/quickcat_open.png' });
  await p.press('input[name=qc_name]', 'Enter'); await settle();
  assert.equal(await p.$eval('#dlg h2', (e) => e.textContent), 'Add transaction', 'dialog still open (Enter did not submit the transaction)');
  assert.equal(await p.inputValue('input[name=amount]'), '45000'); assert.equal(await p.inputValue('textarea[name=note]'), 'Gym snack');
  const sel = await p.$eval('select[name=category]', (s) => s.options[s.selectedIndex].textContent); assert(/Snacks/.test(sel), sel);
  let l = await log(); const cat = l.find((o) => o.table === 'categories').rows[0];
  assert.equal(cat.name, 'Snacks'); assert.equal(cat.parent_id, dining); assert.equal(cat.icon, '🍿'); assert.equal(cat.type, 'expense');
  // duplicate refused; a new top-level category too
  await p.selectOption('select[name=category]', '__new'); await p.fill('input[name=qc_name]', 'snacks'); await p.selectOption('select[name=qc_parent]', dining); await p.click('[data-act=quick-cat-add]');
  assert((await p.evaluate(() => document.getElementById('toast').textContent)).includes('already exists'));
  await p.selectOption('select[name=qc_parent]', ''); await p.fill('input[name=qc_name]', 'Gym'); await p.click('[data-act=quick-cat-add]'); await settle();
  l = await log(); assert(l[0].rows[0].parent_id === null && l[0].rows[0].name === 'Gym');
  // save the transaction with the new category selected
  await p.click('#dlg button[type=submit]'); await settle(); l = await log();
  const tx = l.find((o) => o.table === 'transactions').rows[0]; assert.equal(tx.amount_minor, 45000);
  const gym = await p.evaluate(() => D().categories.find((c) => c.name === 'Gym').id); assert.equal(tx.category_id, gym);
  // income type shows income parents only
  await p.click('[data-act=add-txn]'); await p.click('label:has(input[name=type][value=income])');
  const opts = await p.$$eval('select[name=qc_parent] option', (o) => o.map((x) => x.textContent)); assert(opts.some((x) => /Salary/.test(x)) && !opts.some((x) => /Dining/.test(x)), JSON.stringify(opts));
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
