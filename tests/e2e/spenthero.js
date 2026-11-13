const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Overview hero "Spent today": today's expenses only (not income, transfers, past or upcoming entries), in the reporting currency with its selector; under it the
   current period's overall budget as "{left} left this month · {n} days to go" and a thin bar (over budget: "{x} over budget"; no budget: "{spent} spent this month · Set a monthly budget"),
   which opens Budgets; no Balance chip (Portfolio is in the bottom bar); the eye masks the two amounts and not the bar. No Total Balance, no % pill, no Budgets card. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const txt = async (sel = '.hero') => (await p.innerText(sel)).replace(/ /g, ' ');
  const amountOf = () => p.$eval('.hero .amount', (e) => e.textContent.replace(/ /g, ' ').trim());
  const day = (n) => p.evaluate((n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); }, n);
  const today = await day(0), yesterday = await day(-1), tomorrow = await day(1);

  // a day with several kinds of entries: only today's expenses count (1.000.000 + 250.000)
  await p.evaluate(({ today, yesterday, tomorrow }) => {
    state.ui.onbSkipped = true; const w = D().wallets[0]; w.opening_balance_minor = 100000000; w.since = '2020-01';
    const t = (id, type, amount, at, extra = {}) => D().transactions.unshift({ id, type, amount_minor: amount, currency: 'IDR', wallet_id: w.id, category_id: null, note: id, occurred_at: at, ...extra });
    t('lunch', 'expense', 1000000, today); t('coffee', 'expense', 250000, today); t('salary', 'income', 9000000, today); t('xfer', 'transfer', 5000000, today, { flow: 'out' });
    t('late', 'expense', 7000000, yesterday); t('plan', 'expense', 3000000, tomorrow);
    location.hash = '#/overview'; render(); }, { today, yesterday, tomorrow });
  const rp = (n) => p.evaluate((n) => money(n, 'IDR').replace(/ /g, ' '), n);
  assert.equal(await amountOf(), await rp(1250000), 'today expenses only: ' + await amountOf());
  const all = await txt();
  assert(all.includes('Spent today') && !all.includes('Total Balance') && !/%/.test(all), all);
  assert.equal(await p.$$eval('.hero .delta', (e) => e.length), 0, 'no % pill'); assert.equal(await p.$$eval('.hero-actions .ghost', (e) => e.length), 4, 'the 4 action buttons stay');
  assert.equal(await p.$$eval('.ov-bud-card, .ov-more, .ov-buds', (e) => e.length), 0, 'the Budgets card is gone from Overview');
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('.grid h2')].some((h) => h.textContent.trim() === 'Budgets')), false);
  assert.equal(await p.$$eval('.hero-chip', (e) => e.length), 0, 'no Balance chip any more');


  // no overall budget yet: what was spent this period and a nudge, no bar
  let line = await txt('.hero-bud-line'); const period = await p.evaluate(() => currentPeriod());
  const spentPeriod = await p.evaluate(() => money(sumBy(inMonth(currentPeriod()), 'expense'), 'IDR').replace(/ /g, ' '));
  assert.equal(line, `${spentPeriod} spent this month · Set a monthly budget ›`, line); assert.equal(await p.$$eval('.hero-bar', (e) => e.length), 0, 'no bar without a budget');
  await p.click('.hero-bud'); await p.waitForFunction(() => location.hash === '#/budgets'); await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForSelector('.hero-bud');

  // with an overall budget: left, days to the end of the period (the last day counts), bar = share used by the whole period
  await p.evaluate(() => { D().budgets.push({ id: uid(), category_id: null, amount_minor: 20000000, currency: 'IDR', start_month: '2020-01-01' }); render(); });
  const info = await p.evaluate(() => { const k = currentPeriod(), g = budgetStatus(k).find((x) => x.category_id === null), days = Math.round((new Date(periodEnd(k) + 'T00:00') - new Date(todayIso() + 'T00:00')) / 86400000) + 1; return { left: money(g.remaining, 'IDR').replace(/ /g, ' '), days, pct: Math.min(100, Math.round(g.pct)) }; });
  line = await txt('.hero-bud-line'); assert.equal(line, `${info.left} left this month · ${info.days === 1 ? '1 day' : info.days + ' days'} to go`, line + ' vs ' + JSON.stringify(info));
  const bar = await p.$eval('.hero-bar', (e) => ({ w: e.querySelector('i').style.width, now: e.getAttribute('aria-valuenow'), cls: e.querySelector('i').className })); assert.equal(bar.w, info.pct + '%'); assert.equal(bar.now, String(info.pct)); assert.equal(bar.cls, 'ok');
  assert(info.days >= 1, 'days to go counts today');
  // the last day of the period: "1 day to go"
  // (period start day = tomorrow's date, so today is the period's last day; skipped on the 28th or later, where no such start day exists)
  if (+today.slice(8) <= 27) {
    await p.evaluate((d) => { D().profile.period = d; render(); }, +today.slice(8) + 1);
    assert.equal(await txt('.hero-bud-line'), `${await p.evaluate(() => money(budgetStatus(currentPeriod()).find((x) => x.category_id === null).remaining, 'IDR').replace(/\u00a0/g, ' '))} left this month · 1 day to go`);
    await p.evaluate(() => { D().profile.period = 1; render(); });
  }
  // over budget
  await p.evaluate(() => { D().budgets.find((x) => x.category_id === null).amount_minor = 1000000; render(); });
  line = await txt('.hero-bud-line'); assert(/^Rp [\d.]+ over budget · \d+ days? to go$/.test(line), line);
  assert.equal(await p.$eval('.hero-bar i', (e) => e.style.width), '100%'); assert(await p.$eval('.hero-bar i', (e) => e.classList.contains('exceeded')), 'over budget is red');
  await p.evaluate(() => { D().budgets.find((x) => x.category_id === null).amount_minor = 20000000; render(); });

  // taps: the line and the bar open Budgets (tracked)
  await p.click('.hero-bar'); await p.waitForFunction(() => location.hash === '#/budgets'); await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForSelector('.hero-bud');
  await p.focus('.hero-bud'); await p.keyboard.press('Enter'); await p.waitForFunction(() => location.hash === '#/budgets'); await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForSelector('.hero-bud');
  await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForSelector('.hero-bud');
  assert.equal(await p.getAttribute('.hero-bud', 'data-act'), 'hero-budget');

  // the eye masks both amounts, not the bar or the days; the actions stay
  await p.click('.hero .eye-btn');
  assert(/^Rp\s•{8}$/.test(await amountOf()), await amountOf()); line = await txt('.hero-bud-line'); assert(/^Rp •{8} left this month · \d+ days? to go$/.test(line), line);
  assert.equal(await p.$eval('.hero-bar i', (e) => e.style.width), info.pct + '%', 'the bar stays');
  assert(!/\d/.test(await txt('.hero .amount-line .amount')), 'no digits in the hero amount');
  await p.click('.hero .eye-btn'); assert.equal(await amountOf(), await rp(1250000), 'shown again');

  // the currency selector sits next to the amount and converts it (IDR -> USD)
  assert.equal(await p.$$eval('.hero .amount-line .hero-cur select', (e) => e.length), 1);
  await p.selectOption('.hero-cur select', 'USD');
  const usd = await p.evaluate(() => money(convert(1250000, 'IDR', 'USD'), 'USD').replace(/ /g, ' ')); assert.equal(await amountOf(), usd, 'converted: ' + await amountOf()); assert((await amountOf()).includes('$'));
  line = await txt('.hero-bud-line'); assert(line.includes('$') && !line.includes('Rp'), 'the budget line follows the currency: ' + line);
  await p.selectOption('.hero-cur select', 'IDR');

  // a new day with no spending: Rp 0, the budget line still tells what is left
  await p.evaluate(() => { D().transactions = D().transactions.filter((t) => t.occurred_at !== todayIso()); render(); }); assert.equal(await amountOf(), await rp(0));

  // dark mode and phone width: nothing overflows the card
  await p.evaluate(() => { applyTheme('dark'); render(); });
  assert(await p.$eval('.hero', (h) => [...h.querySelectorAll('*')].every((e) => e.getBoundingClientRect().right <= h.getBoundingClientRect().right + 1)), 'nothing sticks out of the hero');
  await (await p.$('.hero')).screenshot({ path: __dirname + '/out/spenthero_dark.png' });

  // tracking: the new buttons are button_clicked events (checked in analytics.js too)
  assert.deepEqual(errs, []); console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')); process.exit(1); });
