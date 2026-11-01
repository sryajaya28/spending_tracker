const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Opening a modal pins the page behind it; closing restores the scroll position. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 700 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => { document.body.style.minHeight = '3000px'; window.scrollTo(0, 400); }); assert.equal(Math.round(await p.evaluate(() => scrollY)), 400);
  await p.evaluate(() => txnDialog(null, 'expense')); await p.waitForSelector('#dlg[open]');
  assert(await p.evaluate(() => document.body.classList.contains('scroll-locked')), 'body is locked'); assert.equal(await p.evaluate(() => getComputedStyle(document.body).position), 'fixed');
  // trying to scroll the page does nothing while the modal is open
  await p.mouse.move(5, 5); await p.mouse.wheel(0, 600); await p.waitForTimeout(200); assert.equal(await p.evaluate(() => Math.round(document.body.getBoundingClientRect().top)), -400, 'the page behind did not move');
  await p.click('[data-act=close]'); await p.waitForTimeout(100);
  assert(!(await p.evaluate(() => document.body.classList.contains('scroll-locked'))), 'unlocked'); assert.equal(Math.round(await p.evaluate(() => scrollY)), 400, 'scroll position restored');
  // Esc closes it the same way
  await p.evaluate(() => txnDialog(null, 'expense')); await p.keyboard.press('Escape'); await p.waitForTimeout(100); assert(!(await p.evaluate(() => document.body.classList.contains('scroll-locked')))); assert.equal(Math.round(await p.evaluate(() => scrollY)), 400);
  // a dialog switching to another keeps one lock and still restores
  await p.evaluate(() => { txnDialog(null, 'expense'); holdingDialog(null, null, { invest: true }); }); await p.click('[data-act=close]'); await p.waitForTimeout(100); assert.equal(Math.round(await p.evaluate(() => scrollY)), 400);
  // tapping the dimmed area closes any modal; tapping inside, or dragging from inside to outside, does not
  await p.evaluate(() => txnDialog(null, 'expense')); await p.waitForSelector('#dlg[open]');
  await p.click('#dlg h2'); assert(await p.evaluate(() => document.querySelector('#dlg').open), 'a tap inside keeps it open');
  const box = await p.$eval('#dlg h2', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y }; });
  await p.mouse.move(box.x + 10, box.y + 5); await p.mouse.down(); await p.mouse.move(3, 3); await p.mouse.up(); await p.waitForTimeout(150); assert(await p.evaluate(() => document.querySelector('#dlg').open), 'dragging out does not close it');
  await p.mouse.click(3, 3); await p.waitForTimeout(150); assert.equal(await p.evaluate(() => document.querySelector('#dlg').open), false, 'a tap outside closes it');
  // with a dropdown list open, the tap outside only closes the list
  await p.evaluate(() => txnDialog(null, 'expense')); await p.waitForSelector('#dlg[open]'); await p.evaluate(() => document.querySelector('#dlg select[name=wallet]').scrollIntoView({ block: 'center' })); { const r = await p.$eval('#dlg select[name=wallet]', (e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }); await p.mouse.click(r.x, r.y); } await p.waitForSelector('.cs-pop'); await p.mouse.click(3, 3); await p.waitForTimeout(200);
  assert(await p.evaluate(() => document.querySelector('#dlg').open), 'the dialog stays when a list was open'); assert.equal(await p.$$eval('.cs-pop', (e) => e.length), 0, 'the list closed'); await p.mouse.click(3, 3); await p.waitForTimeout(150); assert.equal(await p.evaluate(() => document.querySelector('#dlg').open), false);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').filter((l) => l.includes('modalscroll.js')).slice(0, 2).join(' | ')); process.exit(1); });
