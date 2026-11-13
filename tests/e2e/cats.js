const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => { location.hash = '#/settings/categories'; });
  await p.waitForSelector('.cat-sec');
  // expense and income are separate groups; on a phone each shows its first 5 with See more
  assert.deepEqual(await p.$$eval('.cat-sec-h b', (e) => e.map((x) => x.textContent)), ['Expense', 'Income']);
  const vis = () => p.$$eval('.cat-sec-expense .cat-row:not(.indent)', (e) => e.filter((x) => x.offsetParent).length);
  await p.setViewportSize({ width: 390, height: 800 }); assert.equal(await vis(), 5, 'five shown by default on a phone');
  assert((await p.innerText('.cat-sec-expense .see-more')).includes('See more (')); await p.click('.cat-sec-expense .see-more'); assert((await vis()) > 5, 'expanded'); assert((await p.innerText('.cat-sec-expense .see-more')).includes('Show less')); await p.click('.cat-sec-expense .see-more'); assert.equal(await vis(), 5, 'collapsed again');
  await p.setViewportSize({ width: 1280, height: 800 }); assert((await vis()) > 5, 'desktop shows every category'); assert.equal(await p.$$eval('.see-more', (e) => e.filter((x) => x.offsetParent).length), 0, 'no See more on desktop');
  const txt = () => p.evaluate(() => document.body.innerText);
  assert(!(await txt()).includes('12 categories · 11 sub-categories'), 'no summary line');
  await p.screenshot({ path: __dirname + '/settings_collapsed.png' });
  assert((await p.$$('.brow.indent')).length === 0, 'subs hidden until expanded');
  assert.equal((await p.$$('[data-act=toggle-cat]')).length, await p.evaluate(() => D().categories.filter((c) => !c.parent_id && !c.archived && D().categories.some((k) => k.parent_id === c.id)).length), 'every parent with sub-categories has a toggle');
  await p.click('[data-act=toggle-cat]');
  assert((await p.$$('.brow.indent')).length === 3);
  await p.screenshot({ path: __dirname + '/settings_expanded.png' });
  // adding a sub opens its parent
  await p.click('[data-act=add-cat][data-parent]'); await p.fill('input[name=name]', 'Snacks'); await p.click('#dlg button[type=submit]');
  await p.waitForTimeout(200); assert((await txt()).includes('Snacks'));
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
