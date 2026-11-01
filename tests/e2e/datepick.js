const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* App-styled date picker instead of the OS calendar, and the highlight on active filters. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const tap = async (sel) => { const r = await p.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }); await p.mouse.click(r.x, r.y); };
  // 1. tapping the date field opens the app calendar (inside the dialog), not the OS one
  await p.evaluate(() => txnDialog(null, 'expense')); await p.waitForSelector('#dlg[open]');
  await tap('#dlg input[name=date]'); await p.waitForSelector('.dp-pop'); assert.equal(await p.evaluate(() => !!document.querySelector('#dlg .dp-pop')), true, 'inside the dialog');
  const today = await p.evaluate(() => isoDate(new Date())); assert.equal(await p.$eval('.dp-day.today', (e) => e.dataset.d), today, 'today is marked'); assert.equal(await p.$eval('.dp-day.on', (e) => e.dataset.d), today, 'the current value is selected');
  // 2. choose a day: the value changes and the calendar closes (the dialog stays)
  const ym = today.slice(0, 7); await p.click(`.dp-day[data-d="${ym}-15"]`); assert.equal(await p.inputValue('#dlg input[name=date]'), ym + '-15'); assert.equal(await p.$$eval('.dp-pop', (e) => e.length), 0); assert(await p.evaluate(() => document.querySelector('#dlg').open));
  // the field reads "15 Nov 2026" (day month year), not the OS 11/15/2026; a value set from code updates it too
  const shown = await p.$eval('#dlg input[name=date] ~ .dp-text', (e) => e.textContent); assert(new RegExp('^15 [A-Z][a-z]{2} ' + ym.slice(0, 4) + '$').test(shown), shown);
  assert.equal(await p.evaluate(() => { const i = document.querySelector('#dlg input[name=date]'); const v = i.value; i.value = '2026-01-02'; const t = i.parentElement.querySelector('.dp-text').textContent; i.value = v; return t; }), '2 Jan 2026');
  // 3. month navigation and Today
  await tap('#dlg input[name=date]'); await p.waitForSelector('.dp-pop'); await p.click('[data-nav="1"]'); const nm = await p.$eval('.dp-day', (e) => e.dataset.d.slice(0, 7)); assert.notEqual(nm, ym, 'next month'); await p.click('[data-nav="-1"]'); await p.click('[data-nav="-1"]');
  await p.click('[data-today]'); assert.equal(await p.inputValue('#dlg input[name=date]'), today);
  // 4. min / max are respected
  await p.evaluate((t) => { const i = document.querySelector('#dlg input[name=date]'); i.min = t; }, today); await tap('#dlg input[name=date]'); await p.waitForSelector('.dp-pop');
  const dis = await p.$$eval('.dp-day:disabled', (e) => e.map((x) => x.dataset.d)); assert(dis.every((d) => d < today) && dis.length === (+today.slice(8) - 1), 'days before min are disabled: ' + dis.length);
  // 5. a tap outside closes only the calendar; Esc too
  await p.mouse.click(3, 3); await p.waitForTimeout(150); assert.equal(await p.$$eval('.dp-pop', (e) => e.length), 0); assert(await p.evaluate(() => document.querySelector('#dlg').open), 'dialog stays when a calendar was open');
  await tap('#dlg input[name=date]'); await p.waitForSelector('.dp-pop'); await p.keyboard.press('Escape'); await p.waitForTimeout(100); assert.equal(await p.$$eval('.dp-pop', (e) => e.length), 0); assert(await p.evaluate(() => document.querySelector('#dlg').open), 'Esc closes the calendar, not the dialog');
  // typing a date still works (tests, keyboard users) and the form saves it
  await p.fill('#dlg input[name=date]', ym + '-10'); assert.equal(await p.inputValue('#dlg input[name=date]'), ym + '-10'); await p.click('[data-act=close]');
  // 6. active filters are highlighted on Transactions
  await p.evaluate(() => { location.hash = '#/transactions'; render(); }); await p.waitForSelector('select[data-filter=cat]');
  assert.equal(await p.$$eval('.filters .f-on, .txn-top .f-on', (e) => e.length), 0, 'nothing highlighted by default');
  const cat = await p.evaluate(() => D().categories.find((c) => c.type === 'expense' && !c.parent_id).id);
  await p.selectOption('select[data-filter=cat]', cat); assert(await p.$eval('select[data-filter=cat]', (e) => e.classList.contains('f-on')), 'category highlighted'); const bg = await p.$eval('select[data-filter=cat]', (e) => getComputedStyle(e).fontWeight); assert(+bg >= 600, 'bold when active');
  await p.selectOption('select[data-filter=cat]', ''); assert(!(await p.$eval('select[data-filter=cat]', (e) => e.classList.contains('f-on'))), 'cleared');
  await p.fill('input[data-filter=q]', 'abc'); assert(await p.$eval('input[data-filter=q]', (e) => e.classList.contains('f-on')), 'search highlighted'); await p.fill('input[data-filter=q]', '');
  await p.selectOption('select[data-filter=wallet]', await p.evaluate(() => D().wallets[0].id)); assert(await p.$eval('select[data-filter=wallet]', (e) => e.classList.contains('f-on')), 'account highlighted');
  // Reset filters: only while a filter is active; clears search, category, occasion and account (not the period)
  await p.evaluate(() => { location.hash = '#/overview'; location.hash = '#/transactions'; }); await p.waitForTimeout(200);
  await p.selectOption('select[data-filter=wallet]', ''); await p.selectOption('select[data-filter=cat]', ''); await p.fill('input[data-filter=q]', ''); assert.equal(await p.$$eval('[data-act=reset-filters]', (e) => e.length), 0, 'no reset when nothing is filtered');
  const per = await p.evaluate(() => state.ui.month); await p.selectOption('select[data-filter=cat]', cat); await p.fill('input[data-filter=q]', 'zzzz'); assert.equal(await p.$$eval('[data-act=reset-filters]', (e) => e.length), 1, 'reset shows while filtered (also with no results)');
  await p.click('[data-act=reset-filters]'); await p.waitForTimeout(150); assert.equal(await p.$$eval('[data-act=reset-filters]', (e) => e.length), 0); assert.equal(await p.inputValue('input[data-filter=q]'), ''); assert.equal(await p.inputValue('select[data-filter=cat]'), ''); assert.equal(await p.$$eval('.filters .f-on, .txn-top .f-on', (e) => e.length), 0, 'highlights cleared'); assert.equal(await p.evaluate(() => state.ui.month), per, 'period is kept');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message.slice(0, 400), (e.stack || '').split('\n').filter((l) => l.includes('datepick.js')).slice(0, 2).join(' | ')); process.exit(1); });
