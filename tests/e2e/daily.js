const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Transactions groups by day; clicking a day opens a detail page with that day's transactions. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle());
  const m = await p.evaluate(() => { const k = lastMonths(2)[0]; state.ui.month = k; return k; });   // a past period, so the test does not depend on today's date
  await p.evaluate((m) => { const w = D().wallets[0]; const c = D().categories[0];
    [[m + '-05', 'expense', 10000, 'Lunch'], [m + '-05', 'expense', 25000, 'Taxi'], [m + '-05', 'income', 500000, 'Gift'], [m + '-09', 'expense', 7000, 'Coffee']].forEach(([d, type, a, note]) =>
      D().transactions.push({ id: uid(), type, amount_minor: a, currency: w.currency, wallet_id: w.id, category_id: c ? c.id : null, note, occurred_at: d }));
    save(); location.hash = '#/transactions'; render(); }, m);
  await settle();
  const days = await p.$$('#txn-list .day-row'); assert.equal(days.length, 2, 'two days');
  assert((await p.innerText('#txn-list')).includes('3 transactions')); assert(!/Spent|Income/.test(await p.innerText('#txn-list .day-row .sub')), 'the day row shows only the count');
  assert(!(await p.innerText('#txn-list')).includes('Lunch'), 'days start collapsed: no notes visible');
  await p.screenshot({ path: __dirname + '/out/daily_list.png' });
  // tap a day: it opens in place (no new page) and shows only that day's transactions
  await p.click('#txn-list .day-row[data-id="' + m + '-05"]'); assert((await p.evaluate(() => location.hash)).endsWith('/transactions'), 'stays on the list');
  let t = await p.innerText('#txn-list'); assert(t.includes('Lunch') && t.includes('Taxi') && t.includes('Gift') && !t.includes('Coffee'), t);
  assert.equal(await p.getAttribute('#txn-list .day-row[data-id="' + m + '-05"]', 'aria-expanded'), 'true');
  await p.click('#txn-list .day-row[data-id="' + m + '-05"]'); assert(!(await p.innerText('#txn-list')).includes('Lunch'), 'tap again hides it');
  // Expand all / Hide all
  await p.click('[data-act=days-all]'); t = await p.innerText('#txn-list'); assert(t.includes('Lunch') && t.includes('Coffee'), 'expand all'); assert.equal(await p.$$eval('#txn-list .day-group.open', (e) => e.length), 2);
  await p.screenshot({ path: __dirname + '/out/daily_expanded.png' });
  await p.click('[data-act=days-none]'); assert(!/Lunch|Coffee/.test(await p.innerText('#txn-list')), 'hide all'); assert.equal(await p.$$eval('#txn-list .day-group.open', (e) => e.length), 0);
  // a search opens the matching days
  await p.fill('input[data-filter=q]', 'coffee'); assert((await p.innerText('#txn-list')).includes('Coffee'), 'search shows its matches open'); await p.fill('input[data-filter=q]', '');
  assert(!/Lunch|Coffee/.test(await p.innerText('#txn-list')), 'collapsed again after clearing the search');
  // a transaction inside an open day opens for editing
  await p.click('#txn-list .day-row[data-id="' + m + '-05"]'); await p.click('#txn-list .day-group.open .day-body .row'); assert((await p.$$('#dlg')).length >= 1); await p.click('[data-act=close]');
  assert((await p.innerText('.sidebar a.active')).includes('Transactions'));
  // upcoming (future-dated) entries are not in the history
  await p.evaluate(() => { const w = D().wallets[0], d = new Date(); d.setDate(d.getDate() + 1); D().transactions.push({ id: uid(), type: 'expense', amount_minor: 4000, currency: w.currency, wallet_id: w.id, category_id: null, note: 'Future thing', occurred_at: isoDate(d) }); state.ui.month = periodKeyOf(isoDate(d)); location.hash = '#/transactions'; render(); });
  await p.waitForTimeout(150); assert(!(await p.innerText('#txn-list')).includes('Future thing') && !(await p.innerText('.main')).includes('Future thing'), 'an upcoming entry is hidden from the history');
  // ... but "See upcoming transactions" under the list opens them in a pop-up
  assert((await p.innerText('#txn-list .see-upcoming')).includes('(1)'), 'upcoming button with count');
  await p.click('#txn-list .see-upcoming'); await p.waitForSelector('#dlg[open] .up-list');
  assert((await p.innerText('#dlg .up-list')).includes('Future thing'), 'upcoming pop-up lists it'); await p.click('#dlg [data-act=close]'); await p.waitForTimeout(100);
  // Overview > Recent transactions: expenses keep their − sign (every row, not just the first) and upcoming entries are not listed
  await p.evaluate(() => { const w = D().wallets[0], d = new Date(); d.setDate(d.getDate() - 1); for (let i = 0; i < 3; i++) D().transactions.push({ id: uid(), type: 'expense', amount_minor: 1000 + i, currency: w.currency, wallet_id: w.id, category_id: null, note: 'Recent ' + i, occurred_at: isoDate(d) }); D().transactions.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)); location.hash = '#/overview'; render(); });
  const signs = await p.$$eval('.main .card:has(h2) .list .row .amt', (e) => e.map((x) => x.textContent.trim()[0])); assert(signs.length >= 3 && signs.every((c) => c === '−' || c === '+'), JSON.stringify(signs)); assert.equal(await p.$$eval('.main .list .row .amt.expense, .main .list .row .amt', (e) => e.filter((x) => /Recent/.test(x.closest('.row').textContent) && !x.textContent.trim().startsWith('−')).length), 0, 'expenses show a minus on every row');
  assert(!(await p.innerText('.main')).includes('Future thing'), 'upcoming not in Recent transactions');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
