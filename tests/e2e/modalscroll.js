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
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').filter((l) => l.includes('modalscroll.js')).slice(0, 2).join(' | ')); process.exit(1); });
