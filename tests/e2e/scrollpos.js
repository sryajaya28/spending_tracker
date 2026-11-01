const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Each page keeps its scroll position within the session; a page not visited yet opens at the top. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 700 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const y = () => p.evaluate(() => Math.round(scrollY)), go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(150); };
  await p.evaluate(() => { document.body.style.minHeight = '4000px'; });
  await p.evaluate(() => window.scrollTo(0, 500)); assert.equal(await y(), 500);
  await go('#/budgets'); assert.equal(await y(), 0, 'a page not visited yet opens at the top');
  await p.evaluate(() => window.scrollTo(0, 300)); await go('#/transactions'); assert.equal(await y(), 0);
  await go('#/overview'); assert.equal(await y(), 500, 'back on Overview: the same position'); await go('#/budgets'); assert.equal(await y(), 300, 'and on Budgets');
  // browser back / forward restore it too
  await p.evaluate(() => history.back()); await p.waitForTimeout(200); assert.equal(await y(), 500, 'history back'); 
  // a button that opens Transactions with a new filter starts that page at the top
  await go('#/transactions'); await p.evaluate(() => window.scrollTo(0, 250)); await go('#/overview');
  await p.evaluate(() => { const c = D().categories.find((x) => x.type === 'expense' && !x.parent_id); const h = document.createElement('button'); h.dataset.act = 'trend-go'; h.dataset.k = currentPeriod(); h.dataset.cat = c.id; h.id = 'tg'; document.body.appendChild(h); });
  await p.click('#tg'); await p.waitForTimeout(200); assert.equal(await y(), 0, 'a filtered view opens at the top');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message.slice(0, 300), (e.stack || '').split('\n').filter((l) => l.includes('scrollpos.js')).slice(0, 2).join(' | ')); process.exit(1); });
