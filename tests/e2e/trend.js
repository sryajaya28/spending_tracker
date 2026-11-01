const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Category trend on Overview: stacked bars per period; one category breaks into its sub-categories; tap a bar for the breakdown. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => setDemo(true)); await p.waitForTimeout(700);
  // placed between Spending and Budgets
  const titles = await p.$$eval('.grid > section h2', (h) => h.map((x) => x.textContent.trim())); const iS = titles.indexOf('Spending'), iT = titles.indexOf('Category trend'), iB = titles.indexOf('Budgets'); assert(iS >= 0 && iT === iS + 1 && iB === iT + 1, JSON.stringify(titles));
  assert.equal(await p.$$eval('.tbar', (e) => e.length), 6, 'six months by default');
  // all categories: segments are top-level categories
  const names = () => p.$$eval('#trend-chart svg.trend rect title', (t) => [...new Set(t.map((x) => x.textContent.split(':')[0].trim()))]); assert.equal(await p.$$eval('#trend-chart .legend-row', (e) => e.length), 0, 'no legend under the chart'); let legend = await names(); assert(legend.length >= 3 && legend.some((x) => /Groceries|Bills|Dining|Shopping/.test(x)), JSON.stringify(legend));
  // the time frame
  await p.selectOption('[data-trend=n]', '3'); assert.equal(await p.$$eval('.tbar', (e) => e.length), 3); await p.selectOption('[data-trend=n]', '1'); assert.equal(await p.$$eval('.tbar', (e) => e.length), 1); await p.selectOption('[data-trend=n]', '12'); assert.equal(await p.$$eval('.tbar', (e) => e.length), 12); await p.selectOption('[data-trend=n]', '6');
  // a category with sub-categories breaks into them
  const ent = await p.evaluate(() => { const c = D().categories.find((x) => x.name === 'Entertainment' && !x.parent_id); return { id: c.id, subs: childrenOf(c.id).map((s) => s.name) }; }); assert(ent.subs.length > 0);
  await p.selectOption('[data-trend=cat]', ent.id); legend = await names();
  assert(legend.some((x) => ent.subs.some((sn) => x.includes(sn))), 'sub-categories in the legend: ' + JSON.stringify(legend) + JSON.stringify(ent.subs));
  // a single sub-category: one colour only
  const sub = await p.evaluate((id) => childrenOf(id)[0].id, ent.id); await p.selectOption('[data-trend=cat]', sub); legend = (await names()).length; assert.equal(legend, 1, 'a sub-category is one segment');
  // tap a bar: the breakdown dialog; View transactions opens the matching filter
  await p.selectOption('[data-trend=cat]', ''); await p.evaluate(() => { const g = [...document.querySelectorAll('.tbar')].pop(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await p.waitForSelector('#dlg .bk-item'); const dt = await p.innerText('#dlg'); assert(/Spent/.test(dt) && /%/.test(dt) && dt.includes('View transactions'), dt.slice(0, 200));
  const first = await p.$('#dlg [data-act=trend-go]'); const cat = await first.getAttribute('data-cat'); await first.click(); await p.waitForTimeout(300);
  assert(/#\/transactions/.test(await p.evaluate(() => location.hash))); assert.equal(await p.evaluate(() => state.ui.cat), cat, 'filter set to that category');
  await p.screenshot({ path: __dirname + '/out/trend.png' });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').filter((l) => l.includes('trend.js')).slice(0, 2).join(' | ')); process.exit(1); });
