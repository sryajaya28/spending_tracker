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
  const tx = all.find((e) => e.event === 'transaction_saved'); assert(tx, 'transaction_saved'); assert.equal(tx.properties.type, 'expense'); assert.equal(tx.properties.edit, false);
  const pages = all.filter((e) => e.event === '$pageview').map((e) => e.properties.page); assert(pages.includes('landing') && pages.includes('transactions') && pages.includes('budgets'), 'page names: ' + pages);
  assert(!pages.some((x) => /\d{4}-\d\d-\d\d|SECRET/.test(x)), 'no dates or tokens in page names');
  const blob = JSON.stringify(all);
  for (const bad of ['Secret coffee', '12345', 'a@b.co', 'SECRET', 'access_token', 'code=ABC']) assert(!blob.includes(bad), 'leaked: ' + bad);
  assert(all.every((e) => !e.properties.$current_url || !/[?#]/.test(e.properties.$current_url)), 'addresses are cut at ? and #');
  assert(all.every((e) => e.properties.env === 'staging' || e.properties.env === 'production'), 'env property');
  const idn = await p.evaluate(() => posthog.get_distinct_id()); assert.equal(idn, await p.evaluate(() => window.__uidNow || state.auth.uid), 'identified by the account id only');
  // sent through our own address
  await p.evaluate(() => posthog.capture('probe')); await p.waitForTimeout(1500);
  assert(sent.length > 0 && sent.every((u) => u.includes('/ingest/')), 'requests go to /ingest: ' + JSON.stringify(sent));
  // the demo sends nothing (turning it on or off is counted)
  const before = (await evs()).length;
  await p.evaluate(() => setDemo(true)); await p.waitForTimeout(200);
  await p.evaluate(() => { location.hash = '#/portfolio'; }); await p.waitForTimeout(300);
  await p.evaluate(() => Analytics.track('should_not_send')); assert.equal((await evs()).length, before, 'nothing is recorded while the demo is on');
  await p.evaluate(() => setDemo(false));
  // sign-out resets the person
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForSelector('[data-act=signout]');
  await p.click('[data-act=signout]'); await p.waitForSelector('.land'); await p.waitForTimeout(400);
  assert.notEqual(await p.evaluate(() => posthog.get_distinct_id()), idn, 'sign-out starts a new anonymous id');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
