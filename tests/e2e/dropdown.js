const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* App-styled dropdown lists replace the OS picker: open by tap, choose, keyboard, Esc, outside tap, optgroups, inside dialogs. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => { D().wallets.push({ id: uid(), name: 'US Dollar', type: 'bank', currency: 'USD', opening_balance_minor: 100000, archived: false, since: '2026-01' }); D().investments.push({ id: uid(), name: 'Binance', archived: false }); render(); });
  const tap = async (sel) => { const r = await p.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }); await p.mouse.click(r.x, r.y); };
  assert.equal(await p.$eval('select', (s) => getComputedStyle(s).pointerEvents).catch(() => 'none'), 'none');
  // inside a dialog: opens above the dialog, lists every option and group, shows the current one
  await p.click('.nav-add'); await p.waitForSelector('#dlg[open]');
  await tap('#dlg select[name=wallet]'); await p.waitForTimeout(300);   await p.waitForSelector('.cs-pop');
  const n = await p.$$eval('select[name=wallet] option', (o) => o.length); assert.equal(await p.$$eval('.cs-opt', (e) => e.length), n);
  assert.equal(await p.$$eval('.cs-opt.on', (e) => e.length), 1, 'current option is marked');
  const box = await p.$eval('.cs-pop', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }); assert(box.l >= 0 && box.r <= 390 && box.t >= 0 && box.b <= 900, JSON.stringify(box));
  // choosing fires the app's change handling: the amount unit follows the account
  await p.click('.cs-opt:has-text("US Dollar")'); assert.equal(await p.$$('.cs-pop').then((a) => a.length), 0, 'closes after choosing');
  assert((await p.innerText('#dlg [data-amt-label]')).includes('USD')); assert.equal(await p.$eval('#dlg select[name=wallet]', (s) => s.selectedOptions[0].textContent), 'US Dollar (USD)');
  assert.notEqual(await p.evaluate(() => document.activeElement && document.activeElement.tagName), 'SELECT', 'after a tap-choice the select is not focused (iOS would reopen its own picker)');
  // Esc closes the list but not the dialog; tapping elsewhere closes it; tapping the field again toggles
  await tap('#dlg select[name=wallet]'); await p.waitForSelector('.cs-pop'); await p.keyboard.press('Escape'); assert.equal(await p.$$('.cs-pop').then((a) => a.length), 0); assert.equal(await p.evaluate(() => document.querySelector('#dlg').open), true, 'dialog stays open');
  await tap('#dlg select[name=wallet]'); await p.waitForSelector('.cs-pop'); await p.mouse.click(20, 20); assert.equal(await p.$$('.cs-pop').then((a) => a.length), 0, 'outside tap closes');
  // keyboard: arrow down opens, arrows move, Enter picks
  await p.focus('#dlg select[name=wallet]'); await p.keyboard.press('ArrowDown'); await p.waitForSelector('.cs-pop'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('Enter');
  assert.equal(await p.$$('.cs-pop').then((a) => a.length), 0); assert.equal(await p.$eval('#dlg select[name=wallet]', (s) => s.selectedIndex), 0);
  // the Category list: searchable, with "Add new category" as the last entry
  await tap('#dlg select[name=category]'); await p.waitForSelector('.cs-search');
  assert((await p.innerText('.cs-cta')).includes('Add new category')); assert.equal(await p.$$eval('.cs-opt', (e) => e[e.length - 1].classList.contains('cs-cta')), true, 'the add entry is last');
  { // not pinned: it is the last item of the scrolling list; scrolling to the end brings it fully into view inside the popup (not clipped by the dialog)
    await p.$eval('.cs-scroll', (e) => { e.scrollTop = e.scrollHeight; }); await p.waitForTimeout(80);
    const m = await p.evaluate(() => { const c = document.querySelector('.cs-cta').getBoundingClientRect(), pp = document.querySelector('.cs-pop').getBoundingClientRect(), d = document.querySelector('#dlg').getBoundingClientRect(); return { cb: c.bottom, pb: pp.bottom, ct: c.top, pt: pp.top, inTop: !!document.querySelector('.cs-pop').matches(':popover-open') }; });
    assert(m.cb <= m.pb + 1 && m.ct >= m.pt, 'Add new category is fully inside the popup at the end of the list: ' + JSON.stringify(m)); assert(m.inTop, 'popup is in the top layer (not clipped by the dialog)');
    await p.$eval('.cs-scroll', (e) => { e.scrollTop = 0; }); }
  assert(!(await p.evaluate(() => document.activeElement.matches('input'))), 'the search box does not grab focus by itself');
  // tapping the search box (phone keyboard => resize/scroll events) keeps the list open
  await tap('.cs-search'); assert(await p.evaluate(() => document.activeElement.matches('.cs-search')), 'search focused');
  await p.evaluate(() => { window.dispatchEvent(new Event('resize')); document.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('scroll')); document.querySelector('#dlg').dispatchEvent(new Event('scroll')); }); await p.waitForTimeout(100);
  assert.equal(await p.$$('.cs-pop').then((a) => a.length), 1, 'the list stays open while typing');
  const total = await p.$$eval('.cs-opt', (e) => e.filter((x) => x.style.display !== 'none').length);
  await p.fill('.cs-search', 'coffee'); const some = await p.$$eval('.cs-opt', (e) => e.filter((x) => x.style.display !== 'none').map((x) => x.textContent)); assert(some.length < total && some.some((x) => /Coffee/.test(x)) && some.some((x) => /Add new category/.test(x)), JSON.stringify(some));
  await p.fill('.cs-search', 'dining'); const dn = await p.$$eval('.cs-opt', (e) => e.filter((x) => x.style.display !== 'none').map((x) => x.textContent)); assert(dn.some((x) => /Dining/.test(x)) && dn.some((x) => /Coffee/.test(x)), 'searching a parent also lists its sub-categories: ' + JSON.stringify(dn));
  await p.fill('.cs-search', 'zzzz'); assert((await p.innerText('.cs-empty')).includes('Category not found'), 'not-found note shows'); assert.equal(await p.$$eval('.cs-opt', (e) => e.filter((x) => x.style.display !== 'none').map((x) => x.textContent).join('|')), '＋ Add new category'.replace('＋', '＋'), 'only the add button remains');
  assert.equal(await p.$eval('.cs-empty', (e) => e.nextElementSibling.classList.contains('cs-cta')), true, 'the note sits right above the add button');
  await p.fill('.cs-search', 'coffee'); assert.equal(await p.$eval('.cs-empty', (e) => getComputedStyle(e).display), 'none', 'note hides when something matches'); await p.click('.cs-opt:has-text("Coffee")'); assert.equal(await p.$eval('#dlg select[name=category]', (s) => s.selectedOptions[0].textContent.includes('Coffee')), true);
  // income shows the USDT choices in their own group heading
  await p.click('#dlg label:has(input[name=type][value=income])'); await tap('#dlg select[name=wallet]'); await p.waitForSelector('.cs-group');
  assert((await p.innerText('.cs-group')).toLowerCase().includes('investment account')); await p.keyboard.press('Escape'); await p.click('[data-act=close]');
  // outside a dialog: the month picker changes the period
  await p.evaluate(() => { location.hash = '#/budgets'; render(); }); await p.waitForSelector('select[data-bind=month]');
  await tap('select[data-bind=month]'); await p.waitForSelector('.cs-pop'); const before = await p.evaluate(() => state.ui.month);
  await p.click('.cs-opt:not(.on) >> nth=0'); assert.notEqual(await p.evaluate(() => state.ui.month), before, 'month changed through the custom list');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').filter((l) => l.includes('dropdown.js')).slice(0, 2).join(' | ')); process.exit(1); });
