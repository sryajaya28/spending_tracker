const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Debt form: amount owed, monthly payment and installments remaining follow each other (fill in two, the third is worked out). */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 631, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => { state.ui.onbSkipped = true; loanDialog(null); }); await p.waitForSelector('#dlg [name=left]');
  const v = () => p.evaluate(() => ['amount', 'monthly', 'left'].map((n) => document.querySelector('#dlg [name=' + n + ']').value));
  // amount + monthly -> installments
  await p.evaluate(() => { document.querySelector('#dlg [name=currency]').value = 'USD'; });
  await p.fill('#dlg [name=amount]', '1000'); await p.fill('#dlg [name=monthly]', '300'); assert.deepEqual(await v(), ['1000', '300', '4'], 'remaining = owed / monthly, rounded up');
  // the installments typed next replace the oldest of the two: amount follows monthly x installments
  await p.fill('#dlg [name=left]', '10'); assert.deepEqual(await v(), ['3000', '300', '10'], 'owed = monthly x installments');
  // amount typed again: monthly follows
  await p.fill('#dlg [name=amount]', '1000'); assert.deepEqual(await v(), ['1000', '100', '10'], 'monthly = owed / installments');
  // clearing a box does not wipe the others
  await p.fill('#dlg [name=left]', ''); assert.deepEqual(await v(), ['1000', '100', '']);
  // with an interest rate the usual loan formula is used: 1000 at 12% a year over 12 months is 88.85 a month; and back again
  await p.evaluate(() => { document.querySelector('#dlg [name=currency]').value = 'USD'; });
  assert.equal(await p.inputValue('#dlg [name=flat]'), '1', 'a new vehicle loan is flat by default'); await p.selectOption('#dlg [name=flat]', '0');
  await p.fill('#dlg [name=rate]', '12'); await p.fill('#dlg [name=amount]', '1000'); await p.fill('#dlg [name=left]', '12'); assert.deepEqual(await v(), ['1000', '88.85', '12'], 'monthly with interest');
  await p.fill('#dlg [name=monthly]', '88.85'); await p.fill('#dlg [name=amount]', '1000'); assert.equal((await v())[2], '12', 'installments with interest');
  await p.fill('#dlg [name=monthly]', '5'); assert.equal((await v())[2], '', 'a payment that does not cover the interest has no end');
  // flat rate: interest on the original amount, 1000 at 12% a year over 12 months = 1000/12 + 10 = 93.34 a month; and back again
  await p.selectOption('#dlg [name=flat]', '1');
  await p.fill('#dlg [name=left]', '12'); await p.fill('#dlg [name=amount]', '1000'); assert.equal((await v())[1], '93.34');
  await p.fill('#dlg [name=monthly]', '93.34'); await p.fill('#dlg [name=amount]', '1000'); assert.equal((await v())[2], '12', 'flat installments');
  await p.selectOption('#dlg [name=flat]', '0');
  await p.fill('#dlg [name=rate]', ''); await p.fill('#dlg [name=monthly]', '100'); assert.equal((await v())[2], '10');
  // zero-decimal currency: the monthly payment is rounded up to a whole unit
  await p.evaluate(() => { document.querySelector('#dlg [name=currency]').value = 'IDR'; });
  await p.fill('#dlg [name=amount]', '1000000'); await p.fill('#dlg [name=left]', '3'); assert.equal((await v())[1], '333334');
  // saving keeps amount and monthly; the card shows the payments left
  await p.fill('#dlg [name=name]', 'Test debt'); await p.fill('#dlg [name=monthly]', '250000'); assert.deepEqual(await v(), ['750000', '250000', '3']); await p.fill('#dlg [name=amount]', '1000000'); assert.equal((await v())[2], '4');
  await p.click('#dlg button[type=submit]'); await p.waitForTimeout(150);
  assert.deepEqual(await p.evaluate(() => { const l = D().loans.find((x) => x.name === 'Test debt'); return [l.original_minor, l.monthly_minor]; }), [1000000, 250000]);
  await p.evaluate(() => { state.ui.pfTab = 'loan'; location.hash = '#/portfolio'; render(); });
  assert(/4 months left/.test(await p.innerText('.main')) && !/% paid/.test(await p.innerText('.main')), 'the card says how many months are left and has no percentage');
  // editing an existing debt: installments are filled in, and changing them changes the monthly payment (the balance stays)
  await p.evaluate(() => loanDialog(D().loans.find((x) => x.name === 'Test debt'))); await p.waitForSelector('#dlg [name=left]');
  assert.deepEqual(await v(), ['1000000', '250000', '4']); await p.fill('#dlg [name=left]', '5'); assert.deepEqual(await v(), ['1000000', '200000', '5']);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
