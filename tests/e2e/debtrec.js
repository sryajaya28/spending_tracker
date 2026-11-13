const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Debt cards are simple (no percentage): the recurring payment and the time left to pay it off. Record payment can repeat a payment;
   it is listed under Recurring in Settings and made automatically on its date (with or without an account). */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle());
  const ids = await p.evaluate(() => { const l = { id: uid(), name: 'Visa card', type: 'card', currency: 'IDR', original_minor: 1000000, monthly_minor: 0, rate: 0, since: monthKey(new Date()), archived: false, payments: [] }; D().loans.push(l); D().wallets[0].opening_balance_minor = 5000000; state.ui.onbSkipped = true; return { loan: l.id, wallet: D().wallets[0].id }; });
  const card = async () => { await p.evaluate(() => { state.ui.pfTab = 'loan'; location.hash = '#/portfolio'; render(); }); return (await p.evaluate(() => [...document.querySelectorAll('#app .stack .card')].find((c) => /Visa card/.test(c.textContent)).textContent)).replace(/ /g, ' ').replace(/\s+/g, ' '); };
  const loan = () => p.evaluate((i) => { const l = D().loans.find((x) => x.id === i); return { bal: loanBalance(l), n: l.payments.length }; }, ids.loan);
  const rule = () => p.evaluate((i) => { const r = (D().recurring || []).find((x) => x.spec && x.spec.debt === i); return r ? { freq: r.freq, wallet: r.spec.wallet_id, amount: r.spec.amount_minor, active: r.active, next: r.next, id: r.id } : null; }, ids.loan);
  // 1. no recurring payment and no monthly payment: nothing but the balance, and never a percentage
  let t = await card(); assert(!/% paid|% repaid/.test(t) && !/left/.test(t) && !/every/.test(t), 'plain card: ' + t);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#app .stack .loan-tab').length), 0, 'no tab without a payoff plan');
  // 2. Record payment with a repeat, paid from an account
  await p.evaluate((i) => paymentDialog(D().loans.find((x) => x.id === i)), ids.loan); await p.waitForSelector('#dlg select[name=repeat]', { state: 'attached' });
  assert.deepEqual(await p.$$eval('#dlg select[name=repeat] option', (o) => o.map((x) => x.value)), ['', 'weekly', 'monthly'], 'repeat choices');
  await p.fill('#dlg [name=amount]', '100000'); await p.selectOption('#dlg select[name=account]', ids.wallet); await p.selectOption('#dlg select[name=repeat]', 'monthly');
  await p.click('#dlg button[type=submit]'); await settle(); await p.waitForTimeout(150);
  let r = await rule(); assert(r && r.freq === 'monthly' && r.wallet === ids.wallet && r.amount === 100000 && r.active !== false, 'rule made: ' + JSON.stringify(r));
  assert.deepEqual(await loan(), { bal: 900000, n: 1 }, 'the payment itself was recorded once');
  assert.equal(await p.evaluate(() => D().transactions.filter((x) => x.note === 'Visa card' && x.type === 'expense').length), 1, 'one Debt Payment expense (the rule did not duplicate the first payment)');
  assert((r.next > (await p.evaluate(() => isoDate(new Date())))), 'the next payment is in the future: ' + r.next);
  // 3. the card: recurring amount, frequency, months left; no percentage, no bar
  t = await card(); assert(/Rp 100\.000 every month/.test(t) && /9 months left/.test(t) && !/%/.test(t), 'card: ' + t); assert.equal(await p.evaluate(() => [...document.querySelectorAll('#app .stack .card')].filter((c) => /Visa card/.test(c.textContent) && c.querySelector('.bar')).length), 0, 'no progress bar on a debt');
  // the time left is a solid tab on the card's top-right corner (not a label in the text)
  const tab = await p.evaluate(() => { const c = [...document.querySelectorAll('#app .stack .card')].find((x) => /Visa card/.test(x.textContent)), t = c.querySelector('.loan-tab'); if (!t) return null; const a = c.getBoundingClientRect(), b = t.getBoundingClientRect(); return { text: t.textContent, dr: Math.round(a.right - b.right), dt: Math.round(b.top - a.top), card: c.classList.contains('has-tab') }; });
  assert(tab && tab.text === '9 months left' && tab.dr === 0 && tab.dt === 0 && tab.card, 'corner tab: ' + JSON.stringify(tab));
  // 4. it shows under Recurring in Settings and can be edited there (account, amount)
  await p.evaluate(() => { location.hash = '#/settings/recurring'; render(); }); await p.waitForSelector('[data-act=rec-manage]');
  const st = (await p.innerText('.main')).replace(/ /g, ' '); assert(/Visa card/.test(st) && /Rp 100\.000/.test(st) && /Every month/.test(st), 'Settings > Recurring lists the debt payment: ' + st.slice(0, 400));
  await p.evaluate((id) => ruleDialog(D().recurring.find((x) => x.id === id)), r.id); await p.waitForSelector('#dlg select[name=wallet]');
  assert(await p.$('#dlg select[name=category]') === null, 'no category box on a debt payment rule'); assert.equal(await p.$eval('#dlg select[name=wallet] option', (o) => o.value), '', 'No account is offered');
  await p.fill('#dlg [name=amount]', '150000'); await p.click('#dlg button[type=submit]'); await settle(); await p.waitForTimeout(150);
  r = await rule(); assert.equal(r.amount, 150000, 'edited amount'); assert.equal(r.wallet, ids.wallet, 'account kept');
  t = await card(); assert(/Rp 150\.000 every month/.test(t) && /6 months left/.test(t), 'card follows the edit: ' + t);
  // 5. when the date comes the payment is made by itself (loan payment + Debt Payment expense), once
  await p.evaluate((id) => { const x = D().recurring.find((q) => q.id === id), d = new Date(); d.setDate(d.getDate() - 20); x.start = isoDate(d); x.next = isoDate(d); }, r.id);
  const made = await p.evaluate(() => runRecurring()); assert.equal(made, 1, 'one payment came due');
  assert.deepEqual(await loan(), { bal: 750000, n: 2 }, 'balance down by the recurring amount');
  assert.equal(await p.evaluate(() => D().transactions.filter((x) => x.note === 'Visa card' && x.type === 'expense').length), 2, 'its expense on the account');
  assert.equal(await p.evaluate(() => { const l = D().loans[0]; const pay = l.payments.find((q) => q.txn_id && q.amount_minor === 150000); return !!(pay && D().transactions.some((x) => x.id === pay.txn_id && x.wallet_id)); }), true, 'the payment is linked to its expense');
  await p.evaluate(() => runRecurring()); await p.evaluate((id) => generateRecurring(D().recurring.find((q) => q.id === id), D().recurring.find((q) => q.id === id).start), r.id);
  assert.deepEqual(await loan(), { bal: 750000, n: 2 }, 'running again does not double-pay');
  // 6. weekly works out weeks left
  await p.evaluate((id) => { D().recurring.find((q) => q.id === id).freq = 'weekly'; }, r.id);
  t = await card(); assert(/Rp 150\.000 every week/.test(t) && /5 weeks left/.test(t), 'weekly card: ' + t);
  // 7. a paused rule falls back to the monthly payment typed on the debt (if any)
  await p.evaluate((id) => { D().recurring.find((q) => q.id === id).active = false; D().loans[0].monthly_minor = 250000; }, r.id);
  t = await card(); assert(/Rp 250\.000 every month/.test(t) && /3 months left/.test(t), 'fallback to the monthly payment: ' + t);
  await p.evaluate((id) => { D().recurring = D().recurring.filter((q) => q.id !== id); D().loans[0].monthly_minor = 0; }, r.id);
  // 8. a repeating payment with no account: only the loan's payment is made
  await p.evaluate((i) => paymentDialog(D().loans.find((x) => x.id === i)), ids.loan); await p.waitForSelector('#dlg select[name=repeat]', { state: 'attached' });
  await p.fill('#dlg [name=amount]', '50000'); await p.selectOption('#dlg select[name=account]', ''); await p.selectOption('#dlg select[name=repeat]', 'weekly');
  await p.click('#dlg button[type=submit]'); await settle(); await p.waitForTimeout(150);
  r = await rule(); assert(r && r.freq === 'weekly' && r.wallet === '' && r.amount === 50000, 'no-account rule: ' + JSON.stringify(r));
  const exp0 = await p.evaluate(() => D().transactions.filter((x) => x.type === 'expense' && x.note === 'Visa card').length), b0 = (await loan()).bal;
  await p.evaluate((id) => { const x = D().recurring.find((q) => q.id === id), d = new Date(); d.setDate(d.getDate() - 3); x.start = isoDate(d); x.next = isoDate(d); }, r.id); await p.evaluate(() => runRecurring());
  assert.equal((await loan()).bal, b0 - 50000, 'the debt went down'); assert.equal(await p.evaluate(() => D().transactions.filter((x) => x.type === 'expense' && x.note === 'Visa card').length), exp0, 'no expense without an account');
  t = await card(); assert(/Rp 50\.000 every week/.test(t) && /weeks left/.test(t), 'no-account weekly card: ' + t);
  assert(/Visa card/.test(await p.evaluate(() => { location.hash = '#/settings/recurring'; render(); return document.querySelector('.main').textContent; })) && /No account/.test(await p.innerText('.main')), 'Settings shows "No account"');
  // 9. a one-off payment (no repeat) makes no rule; a paid-off debt shows no time left
  await p.evaluate((i) => { D().recurring = []; paymentDialog(D().loans.find((x) => x.id === i)); }, ids.loan); await p.waitForSelector('#dlg [name=amount]'); await p.fill('#dlg [name=amount]', '1000'); await p.click('#dlg button[type=submit]'); await settle(); await p.waitForTimeout(150);
  assert.equal(await rule(), null, 'no repeat, no rule');
  await p.evaluate((i) => { const l = D().loans.find((x) => x.id === i); l.monthly_minor = 100000; l.payments.push({ id: uid(), date: isoDate(new Date()), amount_minor: loanBalance(l) }); }, ids.loan);
  t = await card(); assert(!/left/.test(t) && /Paid off/.test(t), 'paid off: ' + t);
  // 9b. Edit debt: the two-column rows line up at the bottom even when a label wraps (Interest rate (% per year, optional) next to Interest type)
  await p.evaluate((i) => loanDialog(D().loans.find((x) => x.id === i)), ids.loan); await p.waitForSelector('#dlg [name=rate]');
  const al = await p.evaluate(() => { const r = (n) => document.querySelector('#dlg [name=' + n + ']').getBoundingClientRect(), a = r('rate'), b = r('flat'), la = document.querySelector('#dlg [name=rate]').parentElement.querySelector('input').previousSibling; return { dBottom: Math.round(a.bottom - b.bottom), dTop: Math.round(a.top - b.top), wraps: document.querySelector('#dlg [name=rate]').closest('label').getBoundingClientRect().height > document.querySelector('#dlg [name=flat]').closest('label').getBoundingClientRect().height - 1 }; });
  assert.equal(al.dBottom, 0, 'Interest rate and Interest type boxes share the same bottom: ' + JSON.stringify(al)); await p.click('#dlg .dlg-x');
  // 10. the lent card keeps its own look (percent repaid)
  await p.evaluate(() => { D().lent.push({ id: uid(), name: 'Friend', currency: 'IDR', original_minor: 100000, due: '', note: '', since: monthKey(new Date()), archived: false, payments: [{ id: uid(), date: isoDate(new Date()), amount_minor: 50000 }] }); state.ui.pfTab = 'lent'; location.hash = '#/portfolio'; render(); });
  assert(/50% repaid/.test(await p.innerText('.main')), 'lent card unchanged');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message.slice(0, 500), (e.stack || '').split('\n').filter((l) => l.includes('debtrec.js')).slice(0, 2).join(' | ')); process.exit(1); });
