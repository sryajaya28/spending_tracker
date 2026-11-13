const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Hide balance: one eye button on Overview (Spent today hero) and Portfolio (Net worth) drives one setting that masks the two hero amounts on Overview and the balances on the four Portfolio tabs.
   Transactions, the other Overview cards and spending lists stay visible; the budget bar stays too. The setting is remembered on the device (a new session opens the way it was left), and the change pill is red / green. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const route = async (pg) => { await pg.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') })); await pg.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })); };
  const signIn = async (pg) => { await pg.goto('http://127.0.0.1:5180/'); await pg.waitForSelector('.land'); await pg.click('.land-cta [data-view=signin]'); await pg.waitForSelector('[data-form=signin]'); await pg.fill('[name=email]', 'a@b.co'); await pg.fill('[name=password]', 'goodpass1'); await pg.click('button[type=submit]'); await pg.waitForSelector('.shell'); };
  await route(p); await signIn(p);
  const today = await p.evaluate(() => isoDate(new Date()));
  await p.evaluate((t) => {
    state.ui.onbSkipped = true; const w = D().wallets[0]; w.opening_balance_minor = 90000000; w.since = '2024-03';
    D().loans.push({ id: uid(), name: 'Car loan', currency: 'IDR', original_minor: 12345000, since: '2026-01', archived: false, payments: [], type: 'car', monthly_minor: 0, rate: 0 });
    D().lent.push({ id: uid(), name: 'Friend', currency: 'IDR', original_minor: 2742000, since: '2026-01', archived: false, payments: [], note: '' });
    D().transactions.unshift({ id: 'e1', type: 'expense', amount_minor: 7777700, currency: 'IDR', wallet_id: w.id, category_id: null, note: 'Coffee beans', occurred_at: t });
    save(); location.hash = '#/overview'; render(); }, today);
  const digits = (sel) => p.$$eval(sel, (els) => els.filter((e) => e.offsetParent).map((e) => e.textContent.trim()));
  const noDigits = async (sel, what) => { const t = await digits(sel); assert(t.length, 'found ' + what); t.forEach((x) => assert(!/\d/.test(x), what + ' is masked: ' + x)); };
  const hasDigits = async (sel, what) => { const t = await digits(sel); assert(t.length && t.every((x) => /\d/.test(x)), what + ' is visible: ' + JSON.stringify(t)); };

  // shown by default for someone who never used the button; the label is underlined text that opens the tooltip (no (i) icon), the eye sits after it
  assert.equal(await p.evaluate(() => localStorage.getItem('stiver.hidebal.v1')), null);
  await hasDigits('.hero .amount', 'Spent today'); assert.equal(await p.$$eval('.hero .info-btn', (e) => e.length), 0, 'no (i) icon any more');
  assert.equal(await p.getAttribute('.hero .eye-btn', 'aria-label'), 'Hide balance');
  const tipOpen = () => p.$eval('.hero .info-wrap', (e) => e.classList.contains('open'));   // the class, not visibility: a hover also shows the tip on desktop
  await p.click('.hero .lbl-link'); assert(await tipOpen(), 'tapping the label text opens the tooltip'); assert((await p.textContent('.hero .info-pop')).includes('Everything you spent today'));
  await p.click('.hero .lbl-link'); assert(!(await tipOpen()), 'tapping again closes it');
  assert.equal(await p.$$eval('.hero .delta', (e) => e.length), 0, 'no change pill on the Spent today hero');

  // hide on Overview: both hero amounts masked (today's spending and what is left), the bar and days stay, lists below untouched
  await p.evaluate(() => { D().budgets.push({ id: uid(), category_id: null, amount_minor: 90000000, currency: 'IDR', start_month: currentPeriod() + '-01' }); render(); });
  await hasDigits('.hero-bud-line', 'budget line');
  await p.click('.hero .eye-btn');
  assert.equal(await p.innerText('.hero .amount'), await p.evaluate(() => maskMoney('IDR')), 'the amount shows dots in the amount format'); assert(/^Rp\s•{8}$/.test(await p.innerText('.hero .amount')));
  const line = (await p.innerText('.hero-bud-line')).replace(/\u00a0/g, ' '); assert(/^Rp •{8} left this month · \d+ days? to go$/.test(line), 'the left amount is masked, the days are not: ' + line);
  assert.equal(await p.$$eval('.hero-bar', (e) => e.length), 1, 'the bar stays'); assert.equal(await p.$eval('.hero-bar i', (e) => e.style.width), '9%', 'and still shows the real share');
  assert.equal(await p.getAttribute('.hero .eye-btn', 'aria-label'), 'Show balance'); assert.equal(await p.getAttribute('.hero .eye-btn', 'aria-pressed'), 'true');
  assert.equal(await p.evaluate(() => localStorage.getItem('stiver.hidebal.v1')), '1', 'remembered on the device');
  assert((await p.innerText('.shell')).includes('7.777.700'), 'spending stays visible: ' + (await p.innerText('.shell')).slice(0, 300));
  assert((await p.innerText('.shell')).includes('Coffee beans'), 'recent transactions stay visible');
  await p.screenshot({ path: __dirname + '/out/hidebal_overview.png' });

  // Portfolio: Net worth, Breakdown and every tab are masked by the same setting
  await p.evaluate(() => { location.hash = '#/portfolio'; }); await p.waitForSelector('.hero .eye-btn');
  assert.equal(await p.getAttribute('.hero .eye-btn', 'aria-pressed'), 'true', 'the same setting on the other screen');
  await noDigits('.hero .amount', 'Net worth'); assert.equal(await p.$$eval('.hero .delta', (e) => e.length), 0);
  await noDigits('.alloc-legend b', 'Breakdown amounts'); assert((await digits('.alloc-legend .muted')).some((x) => /%/.test(x)), 'percentages stay');
  await noDigits('.card-head .big', 'Savings total'); await noDigits('.wallet .bal', 'account balances'); await noDigits('.mval b', 'history values');
  assert((await p.innerHTML('.chart')).includes('•••'), 'chart axis values masked');
  await p.screenshot({ path: __dirname + '/out/hidebal_portfolio.png' });
  for (const tab of ['loan', 'investment', 'lent']) { await p.click(`[data-act=pf-tab][data-tab=${tab}]`); await noDigits('.card-head .big', tab + ' total'); }
  await p.click('[data-act=pf-tab][data-tab=loan]'); await noDigits('.stack .big', 'debt balances'); await p.click('[data-act=pf-tab][data-tab=lent]'); await noDigits('.stack .big', 'lent balances');
  // transactions page is untouched
  await p.evaluate(() => { location.hash = '#/transactions'; }); await p.waitForSelector('.shell'); assert((await p.innerText('.shell')).includes('7.777.700'), 'transaction amounts are never masked');

  // a new session (new page, same device storage) opens hidden; showing again flips both screens
  const p2 = await ctx.newPage(); p2.on('pageerror', (e) => errs.push(e.message)); await route(p2); await signIn(p2);
  await p2.evaluate(() => { state.ui.onbSkipped = true; location.hash = '#/overview'; render(); });
  assert.equal(await p2.getAttribute('.hero .eye-btn', 'aria-pressed'), 'true', 'remembered in the next session');
  assert(!/\d/.test(await p2.innerText('.hero .amount')), 'opens hidden'); assert.equal(await p2.getAttribute('.hero .eye-btn', 'aria-label'), 'Show balance');
  await p2.click('.hero .eye-btn'); assert(/\d/.test(await p2.innerText('.hero .amount')), 'shown again');
  assert.equal(await p2.evaluate(() => localStorage.getItem('stiver.hidebal.v1')), '0');
  await p2.evaluate(() => { location.hash = '#/portfolio'; }); await p2.waitForSelector('.hero .eye-btn'); assert(/\d/.test(await p2.innerText('.hero .amount')), 'Portfolio follows');
  // dark mode: the masked hero is still readable, and Portfolio's change pill keeps its red / green
  await p2.evaluate(() => { applyTheme('dark'); location.hash = '#/overview'; render(); }); await p2.waitForSelector('.hero .amount');
  await p2.screenshot({ path: __dirname + '/out/hidebal_dark.png' });
  await p.bringToFront(); await p.evaluate(() => { setHideBal(false); applyTheme('dark'); location.hash = '#/portfolio'; render(); }); await p.waitForSelector('.hero .delta b');
  assert.equal(await p.$eval('.hero .delta b', (e) => getComputedStyle(e).color) === 'rgb(30, 27, 75)' || await p.$eval('.hero .delta b', (e) => getComputedStyle(e).color) === 'rgb(255, 255, 255)', true, 'pill text readable in dark');
  await (await p.$('.hero')).screenshot({ path: __dirname + '/out/hidebal_dark_portfolio.png' });
  assert.deepEqual(errs, []);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack||'').split('\n').slice(1,3).join(' | ')); process.exit(1); });
