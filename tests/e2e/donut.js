const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Overview spending donut: hover shows category, amount and % in the centre; tap pins it; tapping elsewhere clears it. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const m = await p.evaluate(() => state.ui.month);
  await p.evaluate((m) => { const w = D().wallets[0]; w.opening_balance_minor = 10000000; const cs = D().categories.filter((c) => c.type === 'expense' && !c.parent_id);
    [[0, 300000], [1, 100000], [2, 100000]].forEach(([i, a]) => D().transactions.push({ id: uid(), type: 'expense', amount_minor: a, currency: w.currency, wallet_id: w.id, category_id: cs[i].id, note: 'x', occurred_at: m + '-01' }));
    save(); location.hash = '#/overview'; render(); }, m);
  const at = async (f) => { await p.$eval('.donut svg', (e) => e.scrollIntoView({ block: 'center' })); const r = await p.$eval('.donut svg', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, k: b.width / 260 }; }), a = f * 2 * Math.PI; return [r.x + (130 + 100 * Math.sin(a)) * r.k, r.y + (130 - 100 * Math.cos(a)) * r.k]; };
  // the hero's % is the period's change of the balance, with the same sign as the amount beside it (-500,000 of 10,500,000)
  const hero = (await p.innerText('.hero .delta')).replace(/\u00a0/g, ' '); assert(/^−\d+\.\d%/.test(hero) && hero.includes('−Rp 500.000'), hero);
  const segs = await p.$$('.dseg'); assert.equal(segs.length, 3);
  const def = await p.innerText('.donut .center'); assert(def.includes('Spent in'));
  await p.mouse.move(...(await at(0.3))); const t = await p.innerText('.donut .center');
  assert(t.includes('60%') && t.includes('of total spending'), t);
  await p.screenshot({ path: __dirname + '/out/donut_hover.png' });
  await p.mouse.move(5, 5); assert((await p.innerText('.donut .center')).includes('Spent in'), 'reset on leave');
  await p.mouse.click(...(await at(0.7))); assert((await p.innerText('.donut .center')).includes('20%'), 'tap pins');
  await p.mouse.move(5, 5); assert((await p.innerText('.donut .center')).includes('20%'), 'stays pinned');
  await p.click('.topbar h1'); assert((await p.innerText('.donut .center')).includes('Spent in'), 'cleared');
  // a legend under the donut lists the same categories, in the same order and colours as the arcs
  const lg = await p.evaluate(() => ({ names: [...document.querySelectorAll('.donut-legend span')].map((e) => e.textContent.trim()), colors: [...document.querySelectorAll('.donut-legend i')].map((e) => e.style.background), arcs: [...document.querySelectorAll('.donut .dseg')].map((e) => e.getAttribute('data-name')) }));
  assert(lg.names.length >= 2 && lg.names.length === lg.arcs.length, JSON.stringify(lg)); lg.arcs.forEach((n, i) => assert(lg.names[i].includes(n), n + ' / ' + lg.names[i]));
  // the Spending breakdown pop-up lists categories (and their sub-categories when expanded) with no "Add sub-category" buttons
  await p.evaluate(() => breakdownDialog()); await p.waitForSelector('#dlg .bk-item'); assert((await p.$$('#dlg .bk-item')).length >= 1, 'rows are listed');
  await p.evaluate(() => document.querySelectorAll('#dlg details').forEach((d) => { d.open = true; }));
  assert.equal(await p.$$eval('#dlg [data-act=add-cat]', (e) => e.length), 0, 'no add sub-category button'); assert(!(await p.innerText('#dlg')).includes('Add sub-category')); await p.click('#dlg .dlg-x'); await p.waitForTimeout(150);
  // the Budgets card on Overview has its own month picker
  const prev = await p.$eval('.card:has(a[href="#/budgets"]) select[data-bind=month] option:nth-child(2)', (o) => o.value);
  await p.selectOption('.card:has(a[href="#/budgets"]) select[data-bind=month]', prev); assert.equal(await p.evaluate(() => state.ui.month), prev);
  assert.equal(await p.$eval('.card:has(a[href="#/budgets"]) select[data-bind=month]', (e) => e.value), prev);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
