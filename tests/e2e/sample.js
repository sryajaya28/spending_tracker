const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const log = () => p.evaluate(() => window.__log.splice(0)), settle = () => p.evaluate(() => Cloud.idle());
  const snap = () => p.evaluate(() => ({ txns: D().transactions.length, wallets: D().wallets.map((w) => w.name), demo: !!state.real }));
  // the user already has real data
  await p.evaluate(() => { D().transactions.push({ id: uid(), wallet_id: D().wallets[0].id, category_id: null, type: 'expense', amount_minor: 12345, currency: D().wallets[0].currency, occurred_at: isoDate(new Date()), note: 'MY REAL ONE', category_source: 'user', ai_confidence: null }); save(); });
  await settle(); await log();
  const own = await snap(); assert.equal(own.txns, 1);
  // the label of the hero (Spent today) opens a tooltip
  await p.evaluate(() => { location.hash = '#/overview'; render(); }); await p.click('.hero .lbl-link'); assert((await p.innerText('.hero .info-pop')).includes('Everything you spent today'), 'spent today tooltip');
  // an empty account (balance under 1 USD) gets a one-tap sample-data switch on Overview
  await p.evaluate(() => { location.hash = '#/overview'; render(); }); await p.waitForSelector('.sample-promo [data-act=demo-on]');
  await p.click('.sample-promo [data-act=demo-on]'); await p.waitForSelector('.demo-bar'); assert.equal(await p.$$('.sample-promo').then((a) => a.length), 0, 'promo disappears in sample mode'); assert.equal(await p.$$('.demo-bar').then((a) => a.length), 1); assert((await snap()).demo);
  await p.click('[data-act=demo-off]'); await p.waitForFunction(() => !state.real); await p.waitForSelector('.sample-promo [data-act=demo-on]');
  await p.evaluate(() => { D().wallets[0].opening_balance_minor = 50000000; render(); }); assert.equal(await p.$$('.sample-promo').then((a) => a.length), 0, 'no promo once there is a real balance'); await p.evaluate(() => { D().wallets[0].opening_balance_minor = 0; });
  // sample mode survives a reload even when the data load starts twice (two sign-in events arrive together): never banner + own data
  await p.evaluate(() => { localStorage.setItem('stiver.demo.v1', '1'); const orig = Cloud.load.bind(Cloud); let n = 0; Cloud.load = async () => { const my = ++n, d = await orig(); if (my === 1) await new Promise((r) => setTimeout(r, 400)); return d; }; const both = Promise.all([loadUserData(), (async () => { await new Promise((r) => setTimeout(r, 150)); return loadUserData(); })()]); return both.then(() => { Cloud.load = orig; }); }); await p.waitForFunction(() => state.real && D().transactions.length > 50, null, { timeout: 8000 });
  assert.equal(await p.evaluate(() => !!document.querySelector('.demo-bar') && D().wallets.length > 3), true, 'banner and sample data go together');
  await p.evaluate(() => setDemo(false)); await p.waitForFunction(() => !state.real); await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForSelector('[data-demo]');
  assert(!(await p.$('.demo-bar')));
  // toggle ON: demo data shows, banner appears, own data untouched
  await p.check('[data-demo]'); await p.waitForSelector('.demo-bar');
  // not pinned: it scrolls away with the page
  await p.evaluate(() => { location.hash = '#/overview'; render(); }); await p.waitForTimeout(200); await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(200);
  assert((await p.$eval('.demo-bar', (e) => e.getBoundingClientRect().top)) < 0, 'banner is not sticky'); await p.evaluate(() => { window.scrollTo(0, 0); location.hash = '#/settings'; render(); });
  const on = await snap(); assert(on.demo && on.txns > 50 && on.wallets.includes('BCA'), JSON.stringify(on));
  assert((await p.$eval('.demo-bar', (e) => e.textContent)).includes('sample data'));
  assert(await p.isChecked('[data-demo]'));
  // changes in demo are not saved or synced
  await p.evaluate(() => { D().transactions.push({ id: uid(), wallet_id: D().wallets[0].id, category_id: null, type: 'expense', amount_minor: 1, currency: 'IDR', occurred_at: isoDate(new Date()), note: 'DEMO ONLY', category_source: 'user', ai_confidence: null }); save(); D().wallets[0].name = 'Renamed in demo'; save(); D().profile.currency = 'USD'; save(); render(); });
  await settle(); assert.equal((await log()).length, 0, 'nothing was sent to the server in demo mode');
  // remembered on this device: a reload comes back in demo mode
  await p.evaluate(() => loadUserData()); await p.waitForSelector('.demo-bar'); assert((await snap()).demo);
  // toggle OFF: own data back exactly as it was
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.uncheck('[data-demo]'); await p.waitForFunction(() => !document.querySelector('.demo-bar'));
  const off = await snap(); assert.deepStrictEqual(off, { txns: 1, wallets: own.wallets, demo: false });
  assert.equal(await p.evaluate(() => D().transactions[0].note), 'MY REAL ONE'); assert.equal(await p.evaluate(() => D().profile.currency), 'IDR');
  await settle(); assert.equal((await log()).length, 0, 'turning it on and off wrote nothing');
  // banner button also turns it off
  await p.check('[data-demo]'); await p.waitForSelector('.demo-bar'); await p.click('[data-act=demo-off]'); await p.waitForFunction(() => !document.querySelector('.demo-bar')); assert(!(await snap()).demo);
  // after a reload (not remembered as on) it stays off
  await p.evaluate(() => loadUserData()); await p.waitForSelector('.shell'); assert(!(await snap()).demo);
  // the server never got demo rows
  assert.equal(await p.evaluate(() => window.__T.transactions.length), 1);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
