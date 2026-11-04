const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* PostHog analytics: events are sent through our own /ingest address; named events carry no amounts, notes, emails or record ids;
   the person is identified by the account id only; web addresses lose "?" and "#"; the sample-data demo sends nothing; sign-out resets. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const sent = [];
  await p.addInitScript(() => { window.__ANALYTICS_TEST = true; });
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.route('**/ingest/**', (r) => { sent.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' }); });
  const evs = () => p.evaluate(() => (window.__phEvents || []).map((e) => e.event));
  const settle = () => p.evaluate(() => Cloud.idle());
  await p.goto('http://127.0.0.1:5180/#access_token=SECRET&code=ABC'); await p.waitForSelector('.land'); await p.waitForTimeout(300);
  assert(await p.evaluate(() => Analytics.enabled), 'analytics is on (forced for the test)');
  assert((await evs()).includes('$pageview'), 'landing page view');
  await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell'); await p.waitForTimeout(500);
  assert((await evs()).includes('signed_in'), 'signed_in event');
  // a transaction: type only, no amount or note
  await p.evaluate(() => { state.ui.onbSkipped = true; D().wallets[0].opening_balance_minor = 900000; render(); });
  await p.evaluate(() => txnDialog(null, 'expense')); await p.waitForSelector('#dlg [name=amount]'); await p.fill('#dlg [name=amount]', '12345'); await p.fill('#dlg [name=note]', 'Secret coffee note'); await p.click('#dlg button[type=submit]'); await settle(); await p.waitForTimeout(200);
  await p.evaluate(() => { location.hash = '#/transactions/2026-01-05'; }); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/budgets'; }); await p.waitForTimeout(300);
  const all = await p.evaluate(() => window.__phEvents);
  const tx = all.find((e) => e.event === 'expense_recorded'); assert(tx, 'expense_recorded'); assert.equal(tx.properties.type, 'expense'); assert.equal(tx.properties.payment_source, 'account'); assert.equal(tx.properties.is_recurring, false);
  assert(!all.some((e) => e.event === 'transaction_saved'), 'old event name is gone');
  const pages = all.filter((e) => e.event === '$pageview').map((e) => e.properties.page); assert(pages.includes('landing') && pages.includes('transactions') && pages.includes('budgets'), 'page names: ' + pages);
  assert(!pages.some((x) => /\d{4}-\d\d-\d\d|SECRET/.test(x)), 'no dates or tokens in page names');
  const blob = JSON.stringify(all);
  for (const bad of ['Secret coffee', '12345', 'a@b.co', 'SECRET', 'access_token', 'code=ABC']) assert(!blob.includes(bad), 'leaked: ' + bad);
  assert(all.every((e) => !e.properties.$current_url || !/[?#]/.test(e.properties.$current_url)), 'addresses are cut at ? and #');
  assert(all.every((e) => e.properties.env === 'staging' || e.properties.env === 'production'), 'env property');
  const idn = await p.evaluate(() => posthog.get_distinct_id()); assert.equal(idn, await p.evaluate(() => window.__uidNow || state.auth.uid), 'identified by the account id only');
  // domain events: category and sub-category
  await p.evaluate(() => catDialog(null)); await p.waitForSelector('#dlg [name=name]'); await p.fill('#dlg [name=name]', 'Zzz Hobby'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(300);
  const par = await p.evaluate(() => D().categories.find((c) => c.name === 'Zzz Hobby').id);
  await p.evaluate((i) => catDialog(null, i), par); await p.waitForSelector('#dlg [name=name]'); await p.fill('#dlg [name=name]', 'Zzz Sub'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(300);
  const dom = await p.evaluate(() => window.__phEvents);
  assert(dom.some((e) => e.event === 'add_category' && e.properties.type === 'expense'), 'add_category');
  assert(dom.some((e) => e.event === 'add_sub_category' && e.properties.type === 'expense'), 'add_sub_category');
  assert(!JSON.stringify(dom).includes('Zzz'), 'category names are not sent');
  await p.evaluate((i) => catDialog(D().categories.find((c) => c.id === i)), par); await p.waitForSelector('[data-act=archive-cat]'); await p.click('[data-act=archive-cat]'); await p.waitForTimeout(250);
  await p.evaluate(() => archivedCatsDialog()); await p.waitForSelector('#dlg [data-act=restore-cat]'); await p.click('#dlg [data-act=restore-cat]'); await p.waitForTimeout(250); await p.evaluate(() => document.querySelector('#dlg [data-act=close]')?.click());
  const rs = (await p.evaluate(() => window.__phEvents)).find((e) => e.event === 'restore_category'); assert(rs && rs.properties.type === 'expense' && rs.properties.level === 'category', 'restore_category'); assert(!JSON.stringify(rs).includes('Zzz'), 'the restored category name is not sent');
  // generic interaction events: button clicks, pop-ups, forms, filters, settings, links
  await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForTimeout(300);
  await p.click('.hero-actions [data-act=add-txn][data-type=income]'); await p.waitForSelector('#dlg[open]'); await p.waitForTimeout(150);
  await p.click('#dlg .dlg-x'); await p.waitForTimeout(150);
  await p.evaluate(() => { location.hash = '#/transactions'; }); await p.waitForSelector('select[data-filter=cat]', { state: 'attached' });
  await p.evaluate(() => { const s = document.querySelector('select[data-filter=cat]'); s.value = [...s.options].find((o) => o.value).value; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(200);
  const all2 = await p.evaluate(() => window.__phEvents);
  const clicks = all2.filter((e) => e.event === 'button_clicked');
  assert(clicks.some((e) => e.properties.action === 'add_txn' && e.properties.type === 'income' && e.properties.page === 'overview'), 'add-txn click with type and page');
  assert(clicks.some((e) => e.properties.action === 'close' && e.properties.in_dialog === true), 'close click inside a pop-up');
  assert(all2.some((e) => e.event === 'dialog_opened' && e.properties.form === 'txn'), 'dialog_opened txn');
  const flt = all2.find((e) => e.event === 'filter_changed'); assert(flt && flt.properties.filter === 'cat' && flt.properties.active === true && Object.keys(flt.properties).every((k) => k.startsWith('$') || ['filter', 'active', 'page', 'lang', 'theme', 'viewport', 'env', 'app', 'distinct_id', 'token'].includes(k)), 'filter_changed has the category flag only: ' + JSON.stringify(flt));
  assert(all2.every((e) => e.properties.page && e.properties.viewport && e.properties.lang), 'every event carries page, viewport and lang');
  const snakeRe = /^[a-z][a-z0-9_]*$/;
  all2.filter((e) => !e.event.startsWith('$')).forEach((e) => { assert(snakeRe.test(e.event), 'event name not snake_case: ' + e.event); Object.keys(e.properties).filter((k) => !k.startsWith('$')).forEach((k) => assert(snakeRe.test(k), 'property not snake_case: ' + k)); });
  assert(!clicks.some((e) => /-/.test(e.properties.action)), 'action values use underscores');
  const ok = new Set(['action', 'element', 'in_dialog', 'view', 'tab', 'side', 'type', 'kind', 'route', 'preset', 'page', 'lang', 'theme', 'viewport', 'env', 'app', 'distinct_id', 'token']);
  clicks.forEach((e) => Object.keys(e.properties).filter((k) => !k.startsWith('$')).forEach((k) => assert(ok.has(k), 'unexpected click property ' + k)));
  const mine = all2.map((e) => Object.entries(e.properties).filter(([k]) => !k.startsWith('$') && !['distinct_id', 'token'].includes(k)));
  assert(!JSON.stringify(mine).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/), 'no record ids in any of our own event properties');
  // a repeating debt payment is tracked with is_recurring (flags only)
  const lid = await p.evaluate(() => { const l = { id: uid(), name: 'Zzz Debt', type: 'card', currency: 'IDR', original_minor: 500000, monthly_minor: 0, rate: 0, since: monthKey(new Date()), archived: false, payments: [] }; D().loans.push(l); return l.id; });
  await p.evaluate((i) => paymentDialog(D().loans.find((x) => x.id === i)), lid); await p.waitForSelector('#dlg select[name=repeat]', { state: 'attached' }); await p.fill('#dlg [name=amount]', '10000'); await p.selectOption('#dlg select[name=account]', ''); await p.selectOption('#dlg select[name=repeat]', 'monthly'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(300);
  const dp = (await p.evaluate(() => window.__phEvents)).find((e) => e.event === 'debt_payment_recorded'); assert(dp && dp.properties.kind === 'loan' && dp.properties.is_recurring === true, 'debt_payment_recorded with is_recurring: ' + JSON.stringify(dp && dp.properties));
  assert(!JSON.stringify(await p.evaluate(() => window.__phEvents)).includes('Zzz Debt'), 'the debt name is not sent');
  // add_debt carries is_recurring (flags only)
  await p.evaluate(() => loanDialog(null)); await p.waitForSelector('#dlg [name=name]'); await p.fill('#dlg [name=name]', 'Zzz New Debt'); await p.fill('#dlg [name=amount]', '700000'); await p.selectOption('#dlg select[name=repeat]', 'weekly'); await p.fill('#dlg [name=monthly]', '100000'); await p.selectOption('#dlg select[name=account]', ''); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(300);
  const ad = (await p.evaluate(() => window.__phEvents)).find((e) => e.event === 'add_debt'); assert(ad && ad.properties.is_recurring === true && ad.properties.has_interest === false, 'add_debt with is_recurring: ' + JSON.stringify(ad && ad.properties));
  assert(!JSON.stringify(await p.evaluate(() => window.__phEvents)).includes('Zzz New Debt'), 'the new debt name is not sent');
  // the hosting rewrite must match the exact paths the SDK posts to, including the trailing slash (a miss = Vercel 404 = every event lost)
  const rewrites = JSON.parse(fs.readFileSync(__dirname + '/../../vercel.json', 'utf8')).rewrites.filter((r) => r.destination.includes('eu.i.posthog.com'));
  assert(rewrites.length > 0, 'a rewrite to eu.i.posthog.com exists');
  rewrites.forEach((r) => assert(/^\/ingest\/\(\.\*\)$/.test(r.source), 'unsupported rewrite form (update this test): ' + r.source));
  for (const path of ['/ingest/e/', '/ingest/e', '/ingest/i/v0/e/', '/ingest/flags/']) assert(rewrites.some((r) => new RegExp('^' + r.source + '$').test(path)), 'rewrite matches ' + path);
  // sent through our own address
  await p.evaluate(() => posthog.capture('probe')); await p.waitForTimeout(1500);
  assert(sent.length > 0 && sent.every((u) => u.includes('/ingest/')), 'requests go to /ingest: ' + JSON.stringify(sent));
  // the demo sends nothing (turning it on or off is counted)
  const before = (await evs()).length;
  await p.evaluate(() => setDemo(true)); await p.waitForTimeout(200);
  await p.evaluate(() => { location.hash = '#/portfolio'; }); await p.waitForTimeout(300);
  await p.evaluate(() => Analytics.track('should_not_send')); assert.equal((await evs()).length, before, 'nothing is recorded while the demo is on');
  await p.evaluate(() => setDemo(false));
  // transfers and investment Cash balances: named events with flags only
  await p.evaluate(() => { state.ui.onbSkipped = true; const w = D().wallets[0]; w.opening_balance_minor = 900000000; D().customAssets['CASH:' + w.currency] = { symbol: w.currency, name: 'Cash', type: 'cash', cash: w.currency }; const a = { id: uid(), name: 'Zzz Broker', archived: false }; D().investments.push(a); D().holdings.push({ id: 'zc1', account_id: a.id, symbol: 'CASH:' + w.currency, quantity: 0, since: '2026-01', trades: [] }); D().wallets.push({ id: uid(), name: 'Zzz Bank', type: 'bank', currency: w.currency, opening_balance_minor: 0, archived: false, since: '2026-01' }); save(); render(); });
  await p.evaluate(() => cashDialog(D().holdings.find((h) => h.id === 'zc1'), 'buy')); await p.waitForSelector('form[data-form=cashx]'); await p.fill('#dlg [name=amount]', '777777'); await p.fill('#dlg [name=fee]', '1234'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(300);
  await p.evaluate(() => cashDialog(D().holdings.find((h) => h.id === 'zc1'), 'sell')); await p.waitForSelector('form[data-form=cashx]'); await p.fill('#dlg [name=amount]', '100000'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(300);
  await p.evaluate(() => transferDialog({ from: 'w:' + D().wallets[0].id, to: 'w:' + D().wallets[1].id })); await p.waitForSelector('form[data-form=transfer]'); await p.fill('#dlg [name=amount]', '55555'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(300);
  const gx = await p.evaluate(() => D().transactions.find((t) => t.transfer_id && /Zzz Bank/.test(t.note)).transfer_id); await p.evaluate((g) => transferDialog(null, g), gx); await p.waitForSelector('[data-act=delete-transfer]'); await p.fill('#dlg [name=amount]', '66666'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(300);
  await p.evaluate((g) => transferDialog(null, g), gx); await p.waitForSelector('[data-act=delete-transfer]'); await p.click('[data-act=delete-transfer]'); await p.waitForTimeout(300);
  const tr = await p.evaluate(() => window.__phEvents);
  assert(tr.some((e) => e.event === 'cash_deposited' && e.properties.has_fee === true && e.properties.is_cross_currency === false), 'cash_deposited with has_fee');
  assert(tr.some((e) => e.event === 'cash_withdrawn' && e.properties.has_fee === false), 'cash_withdrawn');
  assert(tr.some((e) => e.event === 'transfer_recorded' && e.properties.involves_investment_cash === false), 'transfer_recorded'); assert(tr.some((e) => e.event === 'transfer_edited'), 'transfer_edited'); assert(tr.some((e) => e.event === 'delete_transfer'), 'delete_transfer');
  assert(tr.some((e) => e.event === 'dialog_opened' && e.properties.form === 'cashx'), 'the Cash pop-up is tracked as a dialog');
  assert(!JSON.stringify(tr).match(/777777|1234\b|55555|66666|Zzz Broker|Zzz Bank/), 'no amounts or names from transfers leaked');
  // sign-out resets the person
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForSelector('[data-act=signout]');
  await p.click('[data-act=signout]'); await p.waitForSelector('.land'); await p.waitForTimeout(400);
  assert.notEqual(await p.evaluate(() => posthog.get_distinct_id()), idn, 'sign-out starts a new anonymous id');
  // sign-up page: the agreement tick and the show / hide password button are tracked as clicks (action names only)
  await p.click('.land-cta [data-view=signup]'); await p.waitForSelector('form[data-form=signup]'); await p.check('input[name=agree]'); await p.click('.pw-toggle'); await p.waitForTimeout(250);
  const su = (await p.evaluate(() => window.__phEvents)).filter((e) => e.event === 'button_clicked').map((e) => e.properties.action);
  assert(su.includes('agree_terms') && su.includes('toggle_password'), 'agree_terms and toggle_password clicks: ' + su.join());
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
