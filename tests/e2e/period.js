const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Period customization: a start day of 25 turns "month" into 25th to 24th, across totals, budgets and the month picker. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle()), log = () => p.evaluate(() => window.__log.splice(0));
  // pure date maths
  const m = await p.evaluate(() => { D().profile.period = 25; const r = { s: periodStart('2026-10'), e: periodEnd('2026-10'), dec: periodEnd('2026-12'), a: periodKeyOf('2026-10-24'), b: periodKeyOf('2026-10-25'), c: periodKeyOf('2027-01-03'), lbl: monthLabel('2026-10') }; D().profile.period = 1; r.s1 = periodStart('2026-10'); r.e1 = periodEnd('2026-10'); r.k1 = periodKeyOf('2026-10-24'); r.feb = periodEnd('2026-02'); return r; });
  assert.deepEqual([m.s, m.e, m.dec, m.a, m.b, m.c], ['2026-10-25', '2026-11-24', '2027-01-24', '2026-09', '2026-10', '2026-12']); assert(/Oct 25.*Nov 24/.test(m.lbl), m.lbl);
  assert.deepEqual([m.s1, m.e1, m.k1, m.feb], ['2026-10-01', '2026-10-31', '2026-10', '2026-02-28']);
  // totals follow the period
  await p.evaluate(() => { const w = D().wallets[0], base = { currency: 'IDR', wallet_id: w.id, category_id: null, category_source: 'user' };
    [['2026-10-24', 100000], ['2026-10-25', 200000], ['2026-10-31', 300000], ['2026-09-26', 50000]].forEach(([d, a]) => D().transactions.push({ id: uid(), type: 'expense', amount_minor: a, occurred_at: d, note: 'x', ...base })); save(); });
  const spent = (k) => p.evaluate((k) => sumBy(inMonth(k), 'expense'), k);
  assert.equal(await spent('2026-10'), 100000 + 200000 + 300000, 'calendar month by default');
  // change the start day in Settings: saved on the profile, periods move
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForSelector('select[data-setting=period]'); await log();
  await p.selectOption('select[data-setting=period]', '25'); await settle();
  const l = await log(); assert(l.some((o) => o.op === 'update' && o.table === 'profiles' && o.values.period_day === 25), JSON.stringify(l));
  assert.equal(await spent('2026-10'), 200000 + 300000, '25 Oct onward');
  assert.equal(await spent('2026-09'), 100000 + 50000, '26 Sep to 24 Oct');
  assert.equal(await p.evaluate(() => periodKeyOf(isoDate(new Date())) === state.ui.month), true, 'current period selected');
  // the month picker shows ranges
  await p.evaluate(() => { location.hash = '#/overview'; render(); }); assert(/\w+ \d+ – \w+ \d+/.test(await p.innerText('select[data-bind=month]')), 'range labels');
  const [periodStartNow, periodEndNow] = await p.evaluate(() => [periodStart(state.ui.month), periodEnd(state.ui.month)]);
  await p.evaluate(() => { location.hash = '#/transactions'; render(); }); assert(/\w+ \d+–\w+ \d+/.test(await p.innerText('.txn-top select[data-bind=month]')), 'Transactions filter shows the period');
  const rows = await p.$$eval('#txn-list .day-row', (e) => e.map((x) => x.dataset.id)); assert(rows.every((d) => d >= periodStartNow && d <= periodEndNow) && rows.length, JSON.stringify(rows));
  // a wallet created in the calendar month the period ends in still counts (Total Balance and Savings must agree)
  const agree = await p.evaluate(() => { const nm = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)), k = currentPeriod();
    D().wallets.push({ id: uid(), name: 'Late', type: 'cash', currency: 'IDR', opening_balance_minor: 777000, archived: false, since: periodEnd(k).slice(0, 7) });
    const total = savingsTotal();
    return { total, savings: Math.round(savingsUSD(k) * RATES.IDR) }; });
  assert(Math.abs(agree.total - agree.savings) < 2, JSON.stringify(agree));
  // reload from the saved profile row
  assert.equal(await p.evaluate(async () => (await Cloud.load()).profile.period), 25);
  await p.screenshot({ path: __dirname + '/out/period.png' });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
