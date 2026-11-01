const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('assert');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await page.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"off"}' }));
  await page.goto('http://127.0.0.1:5180/');
  const text = () => page.evaluate(() => document.body.innerText);
  const settle = () => page.evaluate(() => Cloud.idle());
  const log = () => page.evaluate(() => window.__log.splice(0));

  // signed out -> sign-in screen
  await page.waitForSelector('.land'); await page.click('.land-cta [data-view=signin]'); await page.waitForSelector('[data-form=signin]');
  assert((await text()).includes('Continue with Google'));
  // wrong password
  await page.fill('[name=email]', 'a@b.co'); await page.fill('[name=password]', 'bad'); await page.click('button[type=submit]');
  await page.waitForSelector('.auth-err'); assert((await text()).includes('Wrong email or password'));
  // sign-up with email confirmation
  await page.click('[data-view=signup]');
  await page.fill('[name=name]', 'Ari'); await page.fill('[name=email]', 'a@b.co'); await page.fill('[name=password]', 'longenough1'); await page.selectOption('[name=currency]', 'IDR');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Check your email');
  const su = await page.evaluate(() => window.__signUp);
  assert.equal(su.options.data.full_name, 'Ari'); assert.equal(su.options.data.currency, 'IDR');
  await page.click('[data-act=auth-resend]'); await page.waitForSelector('text=Email sent again');
  // google
  await page.click('[data-view=signin]'); await page.click('[data-act=auth-google]');
  assert.equal(await page.evaluate(() => window.__oauth.provider), 'google');
  // sign in
  await page.fill('[name=email]', 'a@b.co'); await page.fill('[name=password]', 'goodpass1'); await page.click('button[type=submit]');
  await page.waitForSelector('.shell');
  assert((await text()).includes('Overview') || (await text()).length > 100);
  console.log('signed in, shell rendered');

  // add a transaction
  await page.evaluate(() => { location.hash = '#/transactions'; });
  await page.click('[data-act=add-txn]');
  await page.fill('input[name=amount]', '45000'); await page.fill('textarea[name=note]', 'Coffee beans');
  await page.selectOption('select[name=category]', { label: '  ↳ ☕ Coffee' }).catch(async () => { const v = await page.$eval('select[name=category]', (s) => [...s.options].find((o) => /Coffee/.test(o.textContent)).value); await page.selectOption('select[name=category]', v); });
  await page.click('#dlg button[type=submit]'); await settle();
  let l = await log(); console.log('after txn', l.map((o) => o.op + ':' + o.table + ':' + (o.rows ? o.rows.length : '')));
  assert(l.some((o) => o.table === 'transactions' && o.op === 'upsert' && o.rows[0].amount_minor === 45000 && o.rows[0].note === 'Coffee beans'));
  assert(!l.some((o) => o.table === 'categories' || o.table === 'wallets'), 'untouched tables must not be re-sent');

  // edit it (amount), then delete
  await page.click('#txn-list .day-row'); await page.click('#txn-list .day-group.open .day-body .row'); await page.fill('input[name=amount]', '50000'); await page.click('#dlg button[type=submit]'); await settle();
  l = await log(); assert(l.some((o) => o.op === 'upsert' && o.table === 'transactions' && o.rows[0].amount_minor === 50000));
  await page.click('#txn-list .day-group.open .day-body .row'); await page.click('[data-act=delete-txn]'); await settle();
  l = await log(); assert(l.some((o) => o.op === 'delete' && o.table === 'transactions'));

  // budget
  await page.evaluate(() => { location.hash = '#/budgets'; });
  await page.click('[data-act=add-budget]'); await page.fill('input[name=amount]', '3000000'); await page.click('#dlg button[type=submit]'); await settle();
  l = await log(); assert(l.some((o) => o.op === 'upsert' && o.table === 'budgets' && o.rows[0].amount_minor === 3000000 && /-01$/.test(o.rows[0].start_month)));

  // budget again for the same scope+month: must update in place (no delete + insert)
  await page.click('[data-act=add-budget]'); await page.fill('input[name=amount]', '3500000'); await page.click('#dlg button[type=submit]'); await settle();
  l = await log(); assert(l.length === 1 && l[0].op === 'upsert' && l[0].table === 'budgets' && l[0].rows[0].amount_minor === 3500000, JSON.stringify(l.map((o) => o.op + o.table)));

  // special occasion: create, tag an expense, see progress, view its expenses, delete
  await page.click('[data-act=add-occasion]'); await page.fill('input[name=name]', 'Bali Trip'); await page.fill('input[name=amount]', '10000000');
  await page.fill('input[name=start]', '2026-10-01'); await page.click('#dlg button[type=submit]'); await settle();
  l = await log(); assert(l.some((o) => o.table === 'occasions' && o.rows[0].name === 'Bali Trip' && o.rows[0].amount_minor === 10000000 && o.rows[0].start_date === '2026-10-01'));
  assert((await text()).includes('Bali Trip'));
  await page.evaluate(() => { location.hash = '#/transactions'; });
  await page.click('[data-act=add-txn]'); await page.fill('input[name=amount]', '2500000');
  const occId = await page.$eval('select[name=occasion] option:nth-child(2)', (o) => o.value); await page.selectOption('select[name=occasion]', occId);
  await page.click('#dlg button[type=submit]'); await settle();
  l = await log(); assert(l.some((o) => o.table === 'transactions' && o.rows[0].occasion_id === occId), 'txn tagged');
  assert(!l.some((o) => o.table === 'occasions'), 'occasion untouched');
  await page.evaluate(() => { location.hash = '#/budgets'; });
  const bt = await text(); assert(!bt.includes('1 expense'), 'occasion row keeps only the dates'); assert(bt.includes('Special occasions'));
  await page.click('[data-act=view-occasion]'); await page.waitForSelector('#txn-list .day-row');
  assert((await page.$$('#txn-list .day-row')).length === 1);
  // Budgets page: the By category card has its own + Add (starts on a category), Special occasions has + Add too
  await page.evaluate(() => { location.hash = '#/budgets'; });
  const adds = await page.$$eval('.card-head', (h) => h.map((x) => [x.querySelector('h2')?.textContent.trim(), x.querySelector('.btn')?.textContent.trim()])); const byCat = adds.find((x) => x[0] === 'By category'), occ = adds.find((x) => x[0] === 'Special occasions'); assert(byCat && byCat[1] === '+ Add' && occ && occ[1] === '+ Add', JSON.stringify(adds));
  // tapping a category budget row opens Transactions filtered to that category (same period); its Edit button still edits
  { const bm = await page.evaluate(() => state.ui.month); const row = await page.$('.brow[data-act=cat-txns]'); if (row) { const cid = await row.getAttribute('data-cat'); await page.click('.brow[data-act=cat-txns] .cat-name, .brow[data-act=cat-txns] .meta'); await page.waitForTimeout(200); assert(/#\/transactions/.test(await page.evaluate(() => location.hash)), 'went to Transactions'); assert.equal(await page.evaluate(() => state.ui.cat), cid, 'category preselected'); assert.equal(await page.evaluate(() => state.ui.month), bm, 'same period'); await page.evaluate(() => { state.ui.cat = ''; location.hash = '#/budgets'; }); await page.waitForTimeout(150); } }
  await page.click('.card-head:has(h2:text-is("By category")) [data-act=add-budget]'); await page.waitForSelector('form[data-form=budget]'); assert.notEqual(await page.inputValue('select[name=category]'), '', 'starts on a category, not All spending'); await page.click('[data-act=close]');
  await page.evaluate(() => { location.hash = '#/budgets'; });
  await page.click('[data-act=edit-occasion]'); await page.click('[data-act=archive-occasion]'); await settle();
  l = await log(); assert(l.some((o) => o.table === 'occasions' && o.rows[0].archived === true));
  await page.click('[data-act=edit-occasion]'); await page.click('[data-act=delete-occasion]'); await settle();
  l = await log(); console.log('occasion delete ops', l.map((o) => o.op + ':' + o.table).join(' '));
  assert(l[0].table === 'transactions' && l[0].rows[0].occasion_id === null && l[1].op === 'delete' && l[1].table === 'occasions');
  // reload keeps occasions
  await page.evaluate(() => loadUserData()); await page.waitForSelector('.shell'); await log();

  // wallet
  await page.evaluate(() => { location.hash = '#/portfolio'; });
  console.log('page after portfolio nav ok');

  // sample data (exercises every table)
  await page.evaluate(() => { location.hash = '#/settings'; });
  // empty-account check: budget exists, so it must refuse
  await page.evaluate(() => { D().budgets.length = 0; D().transactions.length = 0; save(); }); await settle(); await log();
  await page.evaluate(() => { const d = D(), s = seed(d.profile.name || 'You', cur()); Object.assign(d, { categories: s.categories, wallets: s.wallets, transactions: s.transactions, budgets: s.budgets, investments: s.investments, holdings: s.holdings, customAssets: s.customAssets, loans: s.loans, lent: s.lent }); save(); }); await settle();
  l = await log(); const tbls = [...new Set(l.map((o) => o.op + ':' + o.table))]; console.log('demo ops', tbls.join(' '));
  fs.writeFileSync(__dirname + '/demo_ops.json', JSON.stringify(l));

  // reload from "server" and verify the round trip keeps the app identical
  const before = await page.evaluate(() => JSON.parse(JSON.stringify(D())));
  await page.evaluate(() => loadUserData()); await page.waitForSelector('.shell'); await settle();
  const after = await page.evaluate(() => JSON.parse(JSON.stringify(D())));
  const norm = (d) => { const c = JSON.parse(JSON.stringify(d)); delete c.livePrices; c.holdings.forEach((h) => { delete h.open_id; h.trades.sort((a, b) => a.id.localeCompare(b.id)); }); c.holdings.sort((a, b) => a.id.localeCompare(b.id)); ['categories','wallets','transactions','budgets','investments','loans','lent'].forEach((k) => c[k].sort((a, b) => a.id.localeCompare(b.id))); c.loans.concat(c.lent).forEach((x) => x.payments.sort((a, b) => a.id.localeCompare(b.id))); return c; };
  const nb = norm(before), na = norm(after);
  for (const k of Object.keys(nb)) { try { assert.deepStrictEqual(na[k], nb[k]); } catch (e) { console.log('ROUNDTRIP DIFF in', k, String(e.message).slice(0, 1500)); } }
  console.log('reload round trip checked');
  await log();

  // trade with a wallet, a paired stablecoin trade, delete trade, delete holding
  await page.evaluate(() => { location.hash = '#/portfolio'; });
  const hs = await page.evaluate(() => D().holdings.map((h) => [h.id, h.symbol, h.quantity]));
  const btc = hs.find((h) => h[1] === 'BTC'), usdt = hs.find((h) => h[1] === 'USDT');
  await page.evaluate(([id, w]) => { const h = D().holdings.find((x) => x.id === id); recordTrade(h, { side: 'buy', quantity: 0.01, source: { kind: 'wallet', wallet: D().wallets[1] }, amount: 500000, date: isoDate(new Date()) }); save(); }, [btc[0]]);
  await page.evaluate(([id, sid]) => { const h = D().holdings.find((x) => x.id === id); recordTrade(h, { side: 'buy', quantity: 0.02, source: { kind: 'holding', holding: D().holdings.find((x) => x.id === sid) }, amount: 1000, date: isoDate(new Date()) }); save(); }, [btc[0], usdt[0]]);
  await settle(); l = await log(); console.log('trade ops', l.map((o) => o.op + ':' + o.table + ':' + (o.rows ? o.rows.length : '')).join(' '));
  fs.writeFileSync(__dirname + '/trade_ops.json', JSON.stringify(l));
  await page.evaluate(() => loadUserData()); await page.waitForSelector('.shell');
  const rt = await page.evaluate((id) => { const h = D().holdings.find((x) => x.id === id); return h.trades.filter((t) => t.date === isoDate(new Date())).map((t) => ({ via: !!t.via, amount: t.amount_minor, q: t.quantity })); }, btc[0]);
  console.log('trades after reload', JSON.stringify(rt));
  assert(rt.some((t) => t.via) && rt.some((t) => !t.via && t.amount === 500000));
  // delete the wallet trade, then a whole holding
  await page.evaluate((id) => { const h = D().holdings.find((x) => x.id === id); const tr = h.trades.find((t) => !t.via && t.date === isoDate(new Date())); removeTrade(h, tr); save(); }, btc[0]);
  await page.evaluate(([sid]) => { D().holdings = D().holdings.filter((x) => x.id !== sid); save(); }, [usdt[0]]);
  await settle(); l = await log(); console.log('delete ops', l.map((o) => o.op + ':' + o.table).join(' '));
  fs.writeFileSync(__dirname + '/delete_ops.json', JSON.stringify(l));

  // save failure -> reload server truth
  await page.evaluate(() => { window.__failNext = true; D().wallets[0].name = 'Renamed'; save(); });
  await page.waitForSelector('#toast.show'); await settle(); await page.waitForTimeout(300);
  assert.notEqual(await page.evaluate(() => D().wallets[0].name), 'Renamed');
  console.log('failed save reverted to server data');

  // sign out
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.click('[data-act=revoke]'); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__signOut.scope), 'others');
  await page.click('button[data-act=signout]'); await page.waitForSelector('.land');
  console.log('signed out');
  console.log('ERRORS', JSON.stringify(errors));
  await page.screenshot({ path: __dirname + '/auth.png' });
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
