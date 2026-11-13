const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Settings is a hub (#/settings) with pages opened from it (#/settings/<page>): identity card, tiles, rows, sample data and sign out on the hub. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const go = async (h, sel) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForSelector(sel); };
  const wide = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await p.evaluate(() => { state.ui.onbSkipped = true; D().profile.name = 'Sam Rivera'; render(); });
  // 1. the hub: identity card, tiles, two rows, sample data, sign out; none of the old cards or form fields
  await go('#/settings', '.set-hub');
  assert.match(await p.innerText('.set-id'), /Sam Rivera/); assert.match(await p.innerText('.set-id'), /a@b\.co/);
  assert.deepEqual(await p.$$eval('.set-tile', (e) => e.map((x) => x.dataset.route)), ['categories', 'occasions', 'recurring', 'household'], 'four tiles for a signed-in account');
  assert.deepEqual(await p.$$eval('.set-list .set-row', (e) => e.map((x) => x.dataset.route)), ['preferences', 'legal']);
  for (const s of ['[data-demo]', '[data-act=signout]']) assert(await p.$('.set-hub ' + s), 'on the hub: ' + s);
  for (const s of ['.cat-row', 'select[data-setting]', 'select[data-lang]', '[data-act=revoke]', 'input[data-setting=name]', '#occasions-card', '.hh-card']) assert.equal(await p.$('.set-hub ' + s), null, 'not on the hub: ' + s);
  assert.equal(await p.$('.set-hub [data-act=revoke]'), null);
  assert((await wide()) <= 0, 'no sideways scroll on the hub at 390px');
  assert(await p.evaluate(() => document.querySelector('.set-hub').getBoundingClientRect().height) < 900, 'the hub fits about one screen');
  assert.equal(await p.$('.bottom-nav'), null, 'no bottom bar on the Settings hub'); assert.equal(await p.$$eval('.nav-add', (e) => e.length), 0, 'no raised Add button either');
  assert.equal(await p.getAttribute('.topbar .back', 'href'), '#/overview', 'the hub has its own back arrow'); await p.click('.topbar .back'); await p.waitForSelector('.bottom-nav'); assert.equal(await p.evaluate(() => location.hash), '#/overview', 'the hub back arrow leads to Overview'); await go('#/settings', '.set-hub');
  assert.match(await p.innerText('.set-tile[data-route=recurring]'), /None yet/); assert.match(await p.innerText('.set-tile[data-route=occasions]'), /None yet/);
  assert.match(await p.innerText('.set-tile[data-route=household]'), /Just you/);
  // 2. each tile opens its page, with a back link to the hub
  const pages = { categories: '.cat-sec', occasions: '#occasions-card', recurring: '.empty', household: '.hh-card', preferences: 'select[data-setting=currency]', profile: 'input[data-setting=name]', legal: 'a[href="privacy.html"]' };
  for (const [pg, sel] of Object.entries(pages)) {
    await go('#/settings', '.set-hub');
    await p.click(pg === 'preferences' || pg === 'legal' ? `.set-row[data-route=${pg}]` : pg === 'profile' ? '.set-id' : `.set-tile[data-route=${pg}]`);
    await p.waitForSelector(sel); assert.equal(await p.evaluate(() => location.hash), '#/settings/' + pg);
    assert.equal(await p.$('.set-hub'), null, pg + ' is a page, not the hub'); assert.equal(await p.$('.bottom-nav'), null, 'no bottom bar on ' + pg); assert((await wide()) <= 0, 'no sideways scroll on ' + pg);
    await p.click('.topbar .back'); await p.waitForSelector('.set-hub'); assert.equal(await p.evaluate(() => location.hash), '#/settings');
  }
  assert.match(await p.evaluate(() => { location.hash = '#/settings/recurring'; render(); return document.querySelector('main').textContent; }), /Nothing repeats yet/);
  assert.equal(await p.$$eval('a[href="terms.html"]', (e) => e.length), 0); await go('#/settings/legal', 'a[href="terms.html"]'); assert.equal(await p.$$eval('.set-list a.set-row', (e) => e.length), 2);
  // 3. the profile page changes the display name; the hub shows it
  await go('#/settings/profile', 'input[data-setting=name]'); assert.match(await p.innerText('main'), /a@b\.co/); assert(await p.$('[data-act=revoke]'));
  await p.fill('input[data-setting=name]', 'Sammy R'); await p.press('input[data-setting=name]', 'Tab'); await p.waitForFunction(() => D().profile.name === 'Sammy R');
  await go('#/settings', '.set-hub'); assert.match(await p.innerText('.set-id'), /Sammy R/);
  // 4. counts follow the data
  await p.evaluate(() => { D().recurring.push({ id: uid(), kind: 'txn', freq: 'monthly', start: '2026-11-01', next: '2026-12-01', end: '', active: true, spec: { type: 'expense', amount_minor: 1000, currency: D().profile.currency, wallet_id: D().wallets[0].id, category_id: null, note: 'Zzz' } }); D().occasions.push({ id: uid(), name: 'Trip', amount_minor: 0, currency: 'IDR', start: '2026-11-06', end: '2026-11-08', archived: false }); render(); });
  assert.match(await p.innerText('.set-tile[data-route=recurring]'), /1 rule/); assert.match(await p.innerText('.set-tile[data-route=occasions]'), /1 active/);
  const nCat = await p.evaluate(() => D().categories.filter((c) => !c.archived).length); assert.match(await p.innerText('.set-tile[data-route=categories]'), new RegExp(nCat + ' categor'));
  // 5. sample data and sign out are on the hub; sample mode hides the Household tile
  await p.check('.set-hub [data-demo]'); await p.waitForSelector('.demo-bar'); await go('#/settings', '.set-hub');
  assert.deepEqual(await p.$$eval('.set-tile', (e) => e.map((x) => x.dataset.route)), ['categories', 'occasions', 'recurring'], 'no Household tile in sample mode');
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.set-tiles > :last-child')).gridColumnStart), '1', 'the lone third tile spans the row');
  await go('#/settings/household', '.set-hub'); assert.equal(await p.evaluate(() => location.hash), '#/settings/household'); // no household in sample mode: shows the hub
  await go('#/settings', '.set-hub'); await p.uncheck('.set-hub [data-demo]'); await p.waitForFunction(() => !document.querySelector('.demo-bar'));
  await go('#/settings/nope', '.set-hub');
  // 6. dark mode keeps the hub readable (text and card colours come from the theme)
  await p.evaluate(() => applyTheme('dark')); await go('#/settings', '.set-hub');
  const col = await p.evaluate(() => { const t = document.querySelector('.set-tile'), c = (e) => getComputedStyle(e).backgroundColor; return { tile: c(t), page: c(document.body), ink: getComputedStyle(t.querySelector('b')).color }; });
  assert.notEqual(col.tile, col.page, 'tiles stand out from the page in dark mode'); assert.notEqual(col.ink, col.tile);
  await p.screenshot({ path: __dirname + '/out/settings_hub_dark.png' }); await p.evaluate(() => applyTheme('light')); await p.screenshot({ path: __dirname + '/out/settings_hub.png' });
  // 7. sign out from the hub
  await p.click('.set-hub [data-act=signout]'); await p.waitForSelector('.land');
  assert.deepEqual(errs, []); console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
