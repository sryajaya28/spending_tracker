const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Edit debt: a "Repeat payment" choice. Does not repeat hides the payment amount and the installments; Every month / Every week show
   "Monthly payment" / "Weekly payment", Next payment, Paid from and "Installments remaining (Monthly / Weekly)". Saving creates, edits or removes the
   recurring rule that Settings > Recurring lists. A debt that already had a monthly payment (no rule) opens as Does not repeat and keeps it. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle());
  const ids = await p.evaluate(() => { const l = { id: uid(), name: 'Visa card', type: 'card', currency: 'IDR', original_minor: 1000000, monthly_minor: 250000, rate: 0, since: monthKey(new Date()), archived: false, payments: [] }; D().loans.push(l); D().wallets[0].opening_balance_minor = 5000000; state.ui.onbSkipped = true; return { loan: l.id, wallet: D().wallets[0].id }; });
  const open = async () => { await p.evaluate((i) => loanDialog(D().loans.find((x) => x.id === i)), ids.loan); await p.waitForSelector('#dlg [name=repeat]'); };
  const save = async () => { await p.click('#dlg button[type=submit]'); await settle(); await p.waitForTimeout(150); };
  const rule = () => p.evaluate((i) => { const r = (D().recurring || []).find((x) => x.spec && x.spec.debt === i); return r ? { freq: r.freq, amount: r.spec.amount_minor, wallet: r.spec.wallet_id, next: r.next, active: r.active } : null; }, ids.loan);
  const loan = () => p.evaluate((i) => { const l = D().loans.find((x) => x.id === i); return { monthly: l.monthly_minor, name: l.name }; }, ids.loan);
  const card = async () => { await p.evaluate(() => { state.ui.pfTab = 'loan'; location.hash = '#/portfolio'; render(); }); return (await p.evaluate(() => [...document.querySelectorAll('#app .stack .card')].find((c) => /Visa card/.test(c.textContent)).textContent)).replace(/ /g, ' ').replace(/\s+/g, ' '); };
  const today = await p.evaluate(() => isoDate(new Date()));
  // 1. a debt with a monthly payment typed earlier and no rule: opens as Does not repeat, payment fields hidden, nothing changes on Save
  await open(); assert.equal(await p.inputValue('#dlg select[name=repeat]'), '', 'opens as Does not repeat');
  assert.equal(await p.isVisible('#dlg [name=monthly]'), false, 'payment amount hidden'); assert.equal(await p.isVisible('#dlg [name=left]'), false, 'installments hidden'); assert.equal(await p.isVisible('#dlg [name=account]'), false, 'paid from hidden');
  assert.equal(await p.inputValue('#dlg [name=monthly]'), '250000', 'the old monthly payment is kept behind the scenes');
  await save(); assert.deepEqual(await loan(), { monthly: 250000, name: 'Visa card' }, 'saving unchanged keeps the monthly payment'); assert.equal(await rule(), null, 'no rule from just saving');
  // 2. Every month: fields appear, labelled Monthly, installments worked out
  await open(); await p.selectOption('#dlg select[name=repeat]', 'monthly'); await p.waitForSelector('#dlg [name=left]');
  assert.equal((await p.innerText('#dlg [data-lbl-pay]')).trim(), 'Monthly payment'); assert.equal((await p.innerText('#dlg [data-lbl-left]')).trim(), 'Installments remaining (Monthly)'); assert(!/optional/i.test(await p.innerText('#dlg [data-lbl-left]')), 'no (optional) on installments');
  assert.equal(await p.inputValue('#dlg [name=monthly]'), '250000'); assert.equal(await p.inputValue('#dlg [name=left]'), '4', 'installments = owed / payment');
  const nxt = await p.inputValue('#dlg [name=next]'); assert(nxt > today, 'next payment defaults to one month from today: ' + nxt);
  await p.selectOption('#dlg select[name=account]', ids.wallet); await save();
  assert.deepEqual((({ freq, amount, wallet }) => ({ freq, amount, wallet }))(await rule()), { freq: 'monthly', amount: 250000, wallet: ids.wallet }, 'rule created');
  let t = await card(); assert(/Rp 250\.000 every month/.test(t) && /4 months left/.test(t), 'card: ' + t);
  await p.evaluate(() => { location.hash = '#/settings/recurring'; render(); }); await p.waitForSelector('[data-act=rec-manage]'); const st = (await p.innerText('.main')).replace(/ /g, ' '); assert(/Visa card/.test(st) && /Every month/.test(st) && /Rp 250\.000/.test(st), 'Settings > Recurring lists it');
  // 3. open again: Every month preselected; switch to Every week: labels and installments follow, the rule is edited
  await open(); assert.equal(await p.inputValue('#dlg select[name=repeat]'), 'monthly'); assert.equal(await p.isVisible('#dlg [name=monthly]'), true);
  await p.selectOption('#dlg select[name=repeat]', 'weekly');
  assert.equal((await p.innerText('#dlg [data-lbl-pay]')).trim(), 'Weekly payment', 'label says Weekly payment'); assert.equal((await p.innerText('#dlg [data-lbl-left]')).trim(), 'Installments remaining (Weekly)');
  await p.fill('#dlg [name=monthly]', '200000'); assert.equal(await p.inputValue('#dlg [name=left]'), '5', 'weeks left = owed / weekly payment');
  const wnext = await p.inputValue('#dlg [name=next]'); assert(wnext > today && wnext <= (await p.evaluate(() => nthDate(isoDate(new Date()), 'weekly', 1))), 'next payment defaults to one week from today: ' + wnext);
  await save(); const r3 = await rule(); assert(r3.freq === 'weekly' && r3.amount === 200000 && r3.wallet === ids.wallet, JSON.stringify(r3)); assert.equal((await loan()).monthly, 250000, 'a weekly payment leaves the old monthly payment alone');
  t = await card(); assert(/Rp 200\.000 every week/.test(t) && /5 weeks left/.test(t), 'weekly card: ' + t);
  // 4. validation: a repeat needs an amount, and a date from today on
  await open(); await p.fill('#dlg [name=monthly]', ''); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(200); assert(await p.evaluate(() => document.getElementById('dlg').open), 'stays open without an amount'); assert(/weekly payment above zero/i.test(await p.evaluate(() => document.getElementById('toast').textContent)));
  await p.fill('#dlg [name=monthly]', '200000'); await p.fill('#dlg [name=next]', '2020-01-01'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(200); assert(await p.evaluate(() => document.getElementById('dlg').open), 'stays open with a past date'); await p.click('#dlg .dlg-x');
  assert.equal((await rule()).amount, 200000, 'nothing changed by the refused saves');
  // 5. Does not repeat removes the rule; payments stay; the card falls back to the monthly payment
  await open(); await p.selectOption('#dlg select[name=repeat]', ''); assert.equal(await p.isVisible('#dlg [name=monthly]'), false); await save();
  assert.equal(await rule(), null, 'rule removed'); t = await card(); assert(/Rp 250\.000 every month/.test(t), 'fallback to the monthly payment: ' + t);
  // 6. a new debt: Does not repeat by default; with a weekly repeat it creates the rule
  await p.evaluate(() => loanDialog(null)); await p.waitForSelector('#dlg [name=name]'); assert.equal(await p.inputValue('#dlg select[name=repeat]'), ''); assert.equal(await p.isVisible('#dlg [name=monthly]'), false);
  await p.fill('#dlg [name=name]', 'New paylater'); await p.fill('#dlg [name=amount]', '900000'); await save();
  assert.deepEqual(await p.evaluate(() => { const l = D().loans.find((x) => x.name === 'New paylater'); return [l.monthly_minor, (D().recurring || []).filter((r) => r.spec && r.spec.debt === l.id).length]; }), [0, 0], 'no payment, no rule');
  await p.evaluate(() => loanDialog(null)); await p.waitForSelector('#dlg [name=name]'); await p.fill('#dlg [name=name]', 'Weekly debt'); await p.fill('#dlg [name=amount]', '900000'); await p.selectOption('#dlg select[name=repeat]', 'weekly'); await p.fill('#dlg [name=monthly]', '100000'); await p.selectOption('#dlg select[name=account]', ''); await save();
  const nd = await p.evaluate(() => { const l = D().loans.find((x) => x.name === 'Weekly debt'), r = (D().recurring || []).find((x) => x.spec && x.spec.debt === l.id); return r ? { freq: r.freq, amount: r.spec.amount_minor, wallet: r.spec.wallet_id } : null; }); assert.deepEqual(nd, { freq: 'weekly', amount: 100000, wallet: '' }, 'new debt with a weekly payment and no account');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message.slice(0, 500), (e.stack || '').split('\n').filter((l) => l.includes('debtedit.js')).slice(0, 2).join(' | ')); process.exit(1); });
