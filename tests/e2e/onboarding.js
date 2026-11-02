const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* A new account: a getting-started Overview (sample data first, then the setup steps) instead of empty charts; the full default category list;
   a category can be added from the Add budget pop-up. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell'); await p.waitForTimeout(500);
  const settle = () => p.evaluate(() => Cloud.idle());
  // 1. first-run Overview: sample data card first and prominent, then the steps; no empty charts
  assert(await p.isVisible('.onb'), 'first-run screen'); let t = await p.innerText('.main');
  assert(t.includes('Try sample data') && t.includes('Add your accounts') && t.includes('Set a monthly budget') && t.includes('Add your first transaction') && t.includes('0 of 3'), t);
  assert(!t.includes('Money Flow') && !t.includes('Spending') && !t.includes('Recent transactions'), 'no empty charts');
  assert.equal(await p.evaluate(() => { const a = document.querySelector('.onb-sample'), s = document.querySelector('.onb-steps'); return !!(a.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING); }), true, 'sample data card comes first');
  assert(!(await p.isVisible('.sample-promo')), 'the small banner is not needed here');
  // the sample card: sample mode, then back to the first-run screen
  await p.click('.onb-try'); await p.waitForSelector('.hero'); assert(await p.isVisible('.demo-bar'), 'sample data is on'); await p.click('[data-act=demo-off]'); await p.waitForSelector('.onb');
  // 2. default categories: the full list on a new account, once each, with their sub-categories
  const cats = await p.evaluate(() => { const c = D().categories, top = (n) => c.find((x) => !x.parent_id && x.name === n), subs = (n) => c.filter((x) => top(n) && x.parent_id === top(n).id).map((x) => x.name);
    return { names: ['Housing', 'Loan Repayment', 'Pet', 'Education', 'Insurance', 'Personal Care', 'Family & Kids', 'Gifts & Donations', 'Taxes', 'Fee', 'Bonus', 'Investment income', 'Rental income', 'Refunds & cashback'].filter((n) => !top(n)),
      dup: c.filter((x) => !x.parent_id).map((x) => x.name.toLowerCase()).filter((n, i, a) => a.indexOf(n) !== i), housing: subs('Housing'), loan: subs('Loan Repayment'), pet: subs('Pet'), div: subs('Investment income'), again: ensureDefaultCategories() }; });
  assert.deepEqual(cats.names, [], 'missing: ' + cats.names); assert.deepEqual(cats.dup, [], 'no duplicates'); assert.equal(cats.again, false, 'running it again adds nothing');
  assert(cats.housing.includes('Rent') && cats.loan.includes('Mortgage') && cats.loan.includes('Car loan') && cats.pet.includes('Vet & medicine') && cats.div.includes('Dividends'), JSON.stringify(cats));
  // an account that already has data only gets Housing, Loan Repayment and Pet (its own categories are not multiplied), and a parent it already has is left alone
  const old = await p.evaluate(() => { const d = D(); d.transactions.push({ id: uid(), wallet_id: d.wallets[0].id, category_id: null, type: 'expense', amount_minor: 1000, currency: d.wallets[0].currency, note: 'x', occurred_at: todayIso(), category_source: 'user', ai_confidence: null });
    d.categories = d.categories.filter((c) => !['Housing', 'Loan Repayment', 'Pet', 'Education'].includes(c.name) && !['Rent', 'Mortgage', 'Pet food', 'Tuition'].includes(c.name)); d.categories.push({ id: uid(), parent_id: null, name: 'Pet', type: 'expense', icon: '🐕', color: '#111111', archived: false });
    const added = ensureDefaultCategories(), has = (n) => d.categories.some((c) => !c.parent_id && c.name === n); return { added, housing: has('Housing'), loan: has('Loan Repayment'), edu: has('Education'), petN: d.categories.filter((c) => c.name === 'Pet').length, petSubs: d.categories.filter((c) => c.name === 'Pet food').length }; });
  assert.deepEqual(old, { added: true, housing: true, loan: true, edu: false, petN: 1, petSubs: 0 }, JSON.stringify(old));
  await p.evaluate(() => { D().transactions.length = 0; render(); });
  // 3. steps: an account with money ticks step 1 and the screen stays until there is a budget too
  await p.evaluate(() => { D().wallets[0].opening_balance_minor = 500000000; render(); }); t = await p.innerText('.main'); assert(await p.isVisible('.onb') && t.includes('1 of 3') && t.includes('Done'), 'step 1 done: ' + t);
  // however the account was set up it counts, so the screen does not linger once there is an account and a budget (renamed Cash, a tiny balance, Cash archived + one new account, a loan)
  const ways = await p.evaluate(() => { const d = D(), orig = d.wallets[0].opening_balance_minor, base = JSON.stringify([d.wallets, d.loans, d.investments]), out = {}; const reset = () => { [d.wallets, d.loans, d.investments] = JSON.parse(base); };
    d.wallets[0].opening_balance_minor = 0; out.untouched = setupState().hasAccount;
    d.wallets[0].name = 'BCA'; out.renamed = setupState().hasAccount; reset();
    d.wallets[0].opening_balance_minor = 1; out.tinyBalance = setupState().hasAccount; reset();
    d.wallets[0].archived = true; d.wallets.push({ ...JSON.parse(JSON.stringify(d.wallets[0])), id: uid(), name: 'Cash', archived: false }); d.wallets[1].opening_balance_minor = 0; out.archivedPlusOne = setupState().hasAccount; reset();
    d.loans.push({ id: uid(), name: 'Car loan', type: 'car', currency: d.wallets[0].currency, original_minor: 1000, monthly_minor: 100, rate: 1, since: '2026-01', archived: false, payments: [] }); out.loan = setupState().hasAccount; reset();
    d.wallets[0].opening_balance_minor = orig; render(); return out; });
  assert.deepEqual(ways, { untouched: false, renamed: true, tinyBalance: true, archivedPlusOne: true, loan: true }, JSON.stringify(ways));
  // 4. Set budget -> the Applies-to list has "Add new category"; adding one selects it
  await p.click('.onb-step [data-act=add-budget]'); await p.waitForSelector('#dlg select[name=category]');
  assert((await p.$$eval('#dlg select[name=category] option', (o) => o.map((x) => x.value))).includes('__new'), 'Add new category entry'); assert(!(await p.isVisible('#dlg .quick-cat')));
  await p.selectOption('#dlg select[name=category]', '__new'); await p.waitForSelector('#dlg .quick-cat:not([hidden])'); assert.equal(await p.$$eval('#dlg [name=qc_parent]', (e) => e.length), 0, 'only top-level categories in a budget');
  await p.fill('#dlg [name=qc_name]', 'Gardening'); await p.click('#dlg [data-act=quick-cat-add]');
  const sel = await p.evaluate(() => { const s = document.querySelector('#dlg select[name=category]'), c = D().categories.find((x) => x.name === 'Gardening'); return { picked: !!c && s.value === c.id, parent: c && c.parent_id, type: c && c.type, hidden: document.querySelector('#dlg .quick-cat').hidden }; });
  assert.deepEqual(sel, { picked: true, parent: null, type: 'expense', hidden: true }, JSON.stringify(sel));
  await p.fill('#dlg [name=amount]', '300000'); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await p.evaluate(() => { const c = D().categories.find((x) => x.name === 'Gardening'); return D().budgets.some((x) => x.category_id === c.id && x.amount_minor === toMinor(300000, cur())); }), true, 'budget saved for the new category');
  // account + budget are done but the first transaction is not: the setup stays (2 of 3) with step 3 to do, and a way to skip
  await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForSelector('.onb'); t = await p.innerText('.main'); assert(t.includes('2 of 3') && t.includes('Add your first transaction') && t.includes('Skip for now'), 'stays until step 3: ' + t);
  // step 3: the first transaction -> "Now you're set!" then the normal Overview
  await p.click('.onb-step [data-act=add-txn]'); await p.waitForSelector('#dlg [name=amount]'); await p.fill('#dlg [name=amount]', '45000'); await p.click('#dlg button[type=submit]'); await settle();
  await p.waitForSelector('.congrats'); assert((await p.innerText('.congrats')).includes("Now you're set!") && !(await p.isVisible('.onb')), 'celebration, not the stepper');
  assert.equal(await p.$$eval('.congrats .confetti i', (e) => e.length) > 10, true, 'confetti'); assert(!(await p.isVisible('.hero')), 'the normal Overview comes after');
  await p.click('[data-act=congrats-done]'); await p.waitForSelector('.hero'); assert(!(await p.isVisible('.congrats')) && !(await p.isVisible('.onb')), 'normal Overview'); assert(await p.isVisible('.main .card:has(h2)'));
  // it is shown once: leaving and coming back does not repeat it; it also moves on by itself
  await p.evaluate(() => { location.hash = '#/budgets'; }); await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForSelector('.hero'); assert(!(await p.isVisible('.congrats')), 'shown once');
  await p.evaluate(() => { state.ui.congrats = true; render(); setTimeout(endCongrats, 300); }); await p.waitForSelector('.congrats'); await p.waitForSelector('.hero', { timeout: 3000 });
  // skipping: no transaction yet, the user chooses to go straight to the Overview (remembered for this account on this device)
  await p.evaluate(() => { D().transactions.length = 0; state.ui.onbSkipped = undefined; try { localStorage.removeItem('stiver.onb.skip.' + (state.auth.uid || '')); } catch (e) { /* */ } render(); });
  await p.waitForSelector('.onb'); await p.click('[data-act=onb-skip]'); await p.waitForSelector('.hero'); assert(!(await p.isVisible('.onb')), 'skipped');
  assert.equal(await p.evaluate(() => localStorage.getItem('stiver.onb.skip.' + (state.auth.uid || ''))), '1', 'the choice is remembered');
  // 5. with data but no budget a slim strip points at what is missing
  await p.evaluate(() => { D().budgets.length = 0; D().transactions.push({ id: uid(), wallet_id: D().wallets[0].id, category_id: null, type: 'expense', amount_minor: 1000, currency: D().wallets[0].currency, note: 'x', occurred_at: todayIso(), category_source: 'user', ai_confidence: null }); render(); });
  assert(!(await p.isVisible('.onb'))); t = await p.innerText('.setup-strip'); assert(t.includes('Finish setting up') && t.includes('Set budget') && !t.includes('Add account'), t);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
