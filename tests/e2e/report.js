const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Overview = hero (budget line and bar kept, no Balance chip) + all of today's entries + a card for the days of the last week with nothing recorded.
   Report (bottom tab, was Transactions) has two pages: Transactions and Analysis (read-only budget progress, Spending, Category trend, Money Flow). */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const day = (n) => p.evaluate((n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); }, n);
  const h2s = (sel = '.main') => p.$$eval(sel + ' section h2', (h) => h.map((x) => x.textContent.trim()));
  const seed = (map) => p.evaluate((map) => {   // map: { offset: count of expenses that day }; the first entry is the oldest offset
    state.ui.onbSkipped = true; try { localStorage.removeItem(nogapKey()); } catch (e) { /* ignore */ } state.ui.nogap = null; const w = D().wallets[0]; w.since = '2020-01'; w.opening_balance_minor = 100000000; D().transactions = [];
    Object.entries(map).forEach(([o, n]) => { const d = new Date(); d.setDate(d.getDate() + Number(o)); for (let i = 0; i < n; i++) D().transactions.push({ id: 'e' + o + i, type: 'expense', amount_minor: 100000 + i, currency: 'IDR', wallet_id: w.id, category_id: null, note: 'e' + o + i, occurred_at: isoDate(d) }); });
    location.hash = '#/overview'; render(); }, map);

  // ---- Overview: today's entries, then the missing days. Oldest entry 10 days ago; filled: today (2), -1, -4, -6, -7 ; empty: -2, -3, -5
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await seed({ '-10': 1, '-7': 1, '-6': 1, '-4': 1, '-1': 1, 0: 2 });
  assert.deepEqual(await h2s(), ['Today', '3 days with nothing recorded'], 'Overview is the hero, today, missing days: ' + await h2s());
  assert.equal(await p.$$eval('.hero-chip', (e) => e.length), 0, 'no Balance chip'); assert.equal(await p.$$eval('.hero-bud', (e) => e.length), 1, 'the budget line stays');
  assert.equal(await p.$$eval('.grid > section:nth-of-type(2) .list .row, .grid > section:nth-of-type(1) .list .row', (r) => r.length), 2, 'both of today\'s entries are listed');
  assert((await p.innerText('.main')).includes('2 transactions'));
  assert.equal(await p.$$eval('.gap-d', (e) => e.length), 7, 'the strip has 7 days'); assert.equal(await p.$$eval('.gap-d.miss', (e) => e.length), 3); assert.equal(await p.$$eval('.gap-d.ok', (e) => e.length), 4);
  assert.deepEqual(await p.$$eval('.gap-row .gap-add', (b) => b.map((x) => x.dataset.date)), [await day(-2), await day(-3), await day(-5)], 'missing days, newest first; today is not one');
  await p.click('.card:has(h2:text-is("Today")) .chip'); await p.waitForFunction(() => location.hash === '#/transactions'); await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForSelector('.hero');

  // Add opens the dialog dated that day; saving it fills the day
  await p.click('.gap-row .gap-add'); await p.waitForSelector('#dlg [name=date]');
  assert.equal(await p.inputValue('#dlg [name=date]'), await day(-2), 'the dialog is dated the missing day');
  await p.fill('#dlg [name=amount]', '5000'); await p.click('#dlg button[type=submit]'); await p.waitForSelector('#dlg', { state: 'hidden' });
  assert.equal(await p.$$eval('.gap-row', (e) => e.length), 2, 'the saved day left the list'); assert((await p.innerText('.gap-card h2')).startsWith('2 days'));
  // the dot in the strip does the same
  await p.click('.gap-d.miss'); await p.waitForSelector('#dlg [name=date]'); assert.equal(await p.inputValue('#dlg [name=date]'), await day(-5)); await p.evaluate(() => close()); await p.waitForSelector('#dlg', { state: 'hidden' });

  // Nothing to add: the day leaves the list, shows as a dash, and is remembered on this device (survives a reload), not in the data
  await p.click('.gap-row .gap-skip'); assert.equal(await p.$$eval('.gap-row', (e) => e.length), 1); assert.equal(await p.$$eval('.gap-d.skip', (e) => e.length), 1);
  assert((await p.innerText('.gap-card h2')).startsWith('1 day with'), 'singular title');
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem(nogapKey())).length), 1, 'stored in localStorage');
  await p.evaluate(() => { state.ui.nogap = null; render(); }); assert.equal(await p.$$eval('.gap-row', (e) => e.length), 1, 'still marked after the memory is reloaded from storage');
  assert.equal(await p.evaluate(() => D().transactions.length), 8, 'no entry was created by marking a day');
  await p.click('.gap-row .gap-skip'); assert.equal(await p.$$eval('.gap-card', (e) => e.length), 0, 'no card once every day is accounted for');

  // nothing today: one prompt; a new account (first entry today) is not nagged about the days before it
  await seed({ '-10': 1, '-7': 1, '-6': 1, '-5': 1, '-4': 1, '-3': 1, '-2': 1, '-1': 1 });
  assert.deepEqual(await h2s(), ['Nothing recorded today yet'], 'one prompt, no missing days: ' + await h2s()); assert.equal(await p.$$eval('.gap-prompt [data-act=add-txn]', (e) => e.length), 1);
  await seed({ 0: 1 }); assert.deepEqual(await h2s(), ['Today'], 'first entry is today: no missing-days card');
  await seed({ '-3': 1, 0: 1 }); assert.deepEqual(await h2s(), ['Today', '2 days with nothing recorded'], 'days after the first entry are missed: ' + await h2s());
  await seed({ '-5': 1 }); assert.equal((await h2s())[1], '4 days with nothing recorded', 'only days from the first entry on count: ' + await h2s());

  // ---- Report: bottom bar, two pages, the old route still works
  await p.evaluate(() => { location.hash = '#/overview'; render(); });
  assert.deepEqual(await p.$$eval('.bottom-nav a, .bottom-nav button', (e) => e.map((x) => x.textContent.trim())), ['Overview', 'Report', 'Add', 'Budgets', 'Portfolio']);
  assert.deepEqual(await p.$$eval('.sidebar .nav:first-of-type a', (e) => e.map((x) => x.textContent.trim())), ['Overview', 'Report', 'Budgets', 'Portfolio']);
  await p.click('.bottom-nav a:nth-of-type(2)'); await p.waitForFunction(() => location.hash === '#/transactions'); await p.waitForSelector('.report-tabs');
  assert.equal(await p.innerText('.topbar h1'), 'Report'); assert.equal(await p.$$eval('.topbar p, .main > p', (e) => e.length), 0, 'no subtitle or summary line');
  assert.deepEqual(await p.$$eval('.report-tabs .tab', (t) => t.map((x) => x.textContent.trim() + (x.classList.contains('on') ? '*' : ''))), ['Transactions*', 'Analysis']);
  assert.equal(await p.$$eval('.bottom-nav a.active', (e) => e.map((x) => x.textContent.trim()).join()), 'Report'); assert.equal(await p.$$eval('#txn-list', (e) => e.length), 1, 'the transaction list');
  await p.click('.report-tabs .tab:nth-child(2)'); await p.waitForFunction(() => location.hash === '#/analysis'); await p.waitForSelector('#flow, .chart-wrap');
  assert.deepEqual(await h2s(), ['Overall budget', 'By category', 'Spending', 'Category trend', 'Money Flow'], 'Analysis: ' + await h2s());
  assert.equal(await p.$$eval('.bottom-nav a.active', (e) => e.map((x) => x.textContent.trim()).join()), 'Report', 'Report stays active on Analysis');
  assert.equal(await p.$$eval('.main [data-act=add-budget], .main [data-act=edit-budget]', (e) => e.length), 0, 'budget progress is read-only here');
  assert((await p.innerText('.main')).includes('No overall budget yet'), 'the no-budget state');
  await p.click('.report-tabs .tab:nth-child(1)'); await p.waitForFunction(() => location.hash === '#/transactions');
  await p.evaluate(() => { location.hash = '#/budgets'; }); await p.waitForSelector('[data-act=add-budget]'); assert.equal(await p.$$eval('.bottom-nav a.active', (e) => e.map((x) => x.textContent.trim()).join()), 'Budgets', 'Budgets keeps its own tab and its edit buttons');

  assert.deepEqual(errs, [], 'page errors: ' + errs.join('; ')); console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
