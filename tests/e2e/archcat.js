const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Settings > Categories has an Archived button left of + Category: it lists archived categories and restores them
   (a parent comes back with the sub-categories archived with it; a sub-category archived alone comes back alone). */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle());
  const ids = await p.evaluate(() => { state.ui.onbSkipped = true; const par = { id: uid(), parent_id: null, name: 'Zzz Hobby', type: 'expense', icon: '🎨', color: '#EC4899', archived: false }; const k1 = { id: uid(), parent_id: par.id, name: 'Zzz Paint', type: 'expense', icon: '🖌️', color: '#EC4899', archived: false }, k2 = { id: uid(), parent_id: par.id, name: 'Zzz Clay', type: 'expense', icon: '🏺', color: '#EC4899', archived: false }; D().categories.push(par, k1, k2); save(); location.hash = '#/settings'; render(); return { par: par.id, k1: k1.id, k2: k2.id }; });
  await p.waitForSelector('[data-act=add-cat]'); await settle();
  // the button sits left of + Category, always there
  const order = await p.$$eval('.card-head .tools [data-act]', (b) => b.map((x) => x.dataset.act)); assert(order.indexOf('archived-cats') >= 0 && order.indexOf('archived-cats') === order.indexOf('add-cat') - 1, 'Archived is left of + Category: ' + order);
  await p.click('[data-act=archived-cats]'); await p.waitForSelector('#dlg[open] .empty'); assert(/No archived categories/.test(await p.innerText('#dlg')), 'empty state'); await p.click('#dlg [data-act=close]');
  // archive the parent (its sub-categories go with it) from its edit pop-up
  await p.evaluate((i) => catDialog(D().categories.find((c) => c.id === i)), ids.par); await p.waitForSelector('[data-act=archive-cat]'); await p.click('[data-act=archive-cat]'); await settle();
  assert.equal(await p.evaluate(() => !!D().categories.find((c) => c.name === 'Zzz Hobby').archived), true); assert.equal(await p.$$eval('.cat-name', (e) => e.filter((x) => /Zzz Hobby/.test(x.textContent)).length), 0, 'gone from the list');
  await p.click('[data-act=archived-cats]'); await p.waitForSelector('#dlg[open] [data-act=restore-cat]');
  const t = await p.innerText('#dlg'); assert(/Zzz Hobby/.test(t) && /Expense/.test(t) && /2 sub-categories/.test(t) && !/Zzz Paint/.test(t), 'the parent is listed with a count, its sub-categories are not listed on their own: ' + t.slice(0, 200));
  await p.click('#dlg [data-act=restore-cat]'); await settle(); await p.waitForSelector('#dlg .empty');
  assert.deepEqual(await p.evaluate(() => D().categories.filter((c) => /^Zzz/.test(c.name)).map((c) => c.archived)), [false, false, false], 'restored with its sub-categories'); await p.click('#dlg [data-act=close]');
  assert.equal(await p.$$eval('.cat-name', (e) => e.filter((x) => /Zzz Hobby/.test(x.textContent)).length), 1, 'back in the list');
  // a sub-category archived alone is listed under its parent's name and comes back alone
  await p.evaluate((i) => catDialog(D().categories.find((c) => c.id === i)), ids.k1); await p.waitForSelector('[data-act=archive-cat]'); await p.click('[data-act=archive-cat]'); await settle();
  assert.deepEqual(await p.evaluate(() => D().categories.filter((c) => /^Zzz/.test(c.name)).map((c) => c.archived)), [false, true, false]);
  await p.click('[data-act=archived-cats]'); await p.waitForSelector('#dlg [data-act=restore-cat]'); const t2 = await p.innerText('#dlg'); assert(/Zzz Paint/.test(t2) && /in Zzz Hobby/.test(t2), 'the sub-category names its parent: ' + t2.slice(0, 200));
  await p.click('#dlg [data-act=restore-cat]'); await settle(); assert.deepEqual(await p.evaluate(() => D().categories.filter((c) => /^Zzz/.test(c.name)).map((c) => c.archived)), [false, false, false]); await p.click('#dlg [data-act=close]');
  // saved
  const l = await p.evaluate(() => window.__log.splice(0)); assert(l.some((o) => o.table === 'categories'), 'categories were saved');
  assert.deepEqual(errs, []);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
