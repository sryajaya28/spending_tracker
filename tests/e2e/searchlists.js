const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Occasion and Account lists get a search box above 5 choices (5 or fewer: none): the Transactions filters (row and sheet), the Add transaction form
   (account + special occasion, also after switching the type) and the Transfer form. The search matches the name only. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const tap = async (sel) => { const r = await p.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }); await p.mouse.click(r.x, r.y); await p.waitForSelector('.cs-pop'); };
  const shut = async () => { await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('.cs-pop')); };
  const has = (sel) => p.$eval(sel, (s) => s.hasAttribute('data-search'));
  const shown = () => p.$$eval('.cs-opt', (e) => e.filter((x) => x.style.display !== 'none').map((x) => x.textContent));
  const closeDlg = () => p.evaluate(() => document.querySelector('#dlg').close());
  // n accounts (all IDR) and n occasions, named so that the search can tell them apart
  const setN = (n) => p.evaluate((n) => {
    const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf'].slice(0, n);
    D().wallets = names.map((x) => ({ id: uid(), name: x + ' Bank', type: 'bank', currency: 'IDR', opening_balance_minor: 100000, archived: false, since: '2020-01' }));
    D().occasions = names.map((x) => ({ id: uid(), name: x + ' Trip', amount_minor: null, currency: 'IDR', start: '2026-01-01', end: '2026-01-05', archived: false }));
    D().loans = []; D().holdings = []; D().investments = [];
    state.ui.cat = state.ui.occ = state.ui.wallet = ''; location.hash = '#/transactions'; render();
  }, n);

  // ---- 5 choices: no search anywhere
  await setN(5); await p.waitForSelector('select[data-filter=wallet]');
  assert(!(await has('select[data-filter=occ]')) && !(await has('select[data-filter=wallet]')), 'no search at 5');
  await tap('select[data-filter=occ]'); assert.equal(await p.$$('.cs-search').then((a) => a.length), 0); await shut();
  await p.click('.nav-add'); await p.waitForSelector('#dlg[open]');
  assert(!(await has('#dlg select[name=wallet]')) && !(await has('#dlg select[name=occasion]')), 'no search in the form at 5'); await closeDlg();
  // ---- 6 choices: both filters get it
  await setN(6); await p.waitForSelector('select[data-filter=wallet]');
  assert((await has('select[data-filter=occ]')) && (await has('select[data-filter=wallet]')), 'search at 6');
  await tap('select[data-filter=occ]'); await p.waitForSelector('.cs-search');
  assert.equal((await shown()).length, 7, 'All occasions + 6');
  await p.fill('.cs-search', 'fox'); assert.deepEqual(await shown(), ['🎉 Foxtrot Trip']);
  await p.fill('.cs-search', 'nope'); assert((await p.innerText('.cs-empty')).includes('Occasion not found') && await p.$eval('.cs-empty', (e) => e.style.display !== 'none'), 'empty note');
  await p.fill('.cs-search', 'echo'); await p.keyboard.press('Enter'); await p.waitForFunction(() => !document.querySelector('.cs-pop'));
  assert.equal(await p.$eval('select[data-filter=occ]', (s) => s.selectedOptions[0].textContent), '🎉 Echo Trip', 'choosing a match sets the filter');
  await tap('select[data-filter=wallet]'); await p.waitForSelector('.cs-search');
  await p.fill('.cs-search', 'idr'); assert.equal((await shown()).length, 0, 'only the name is searched, not the currency');
  await p.fill('.cs-search', 'foxtrot'); assert.deepEqual(await shown(), ['Foxtrot Bank']);
  await p.fill('.cs-search', 'zzz'); assert((await p.innerText('.cs-empty')).includes('Account not found')); await shut();
  await p.screenshot({ path: __dirname + '/out/searchlists.png' });
  // ---- the filter sheet uses the same selects
  await p.evaluate(() => filtersDialog()); await p.waitForSelector('#dlg[open]');
  assert((await has('#dlg select[data-filter=occ]')) && (await has('#dlg select[data-filter=wallet]')), 'sheet has the search'); await closeDlg();
  // ---- Add transaction: account and special occasion
  await p.click('.nav-add'); await p.waitForSelector('#dlg[open]');
  assert((await has('#dlg select[name=wallet]')) && (await has('#dlg select[name=occasion]')), 'form has the search at 6');
  await tap('#dlg select[name=wallet]'); await p.fill('.cs-search', 'bravo'); assert.deepEqual(await shown(), ['Bravo Bank (IDR)']); await p.keyboard.press('Enter');
  assert.equal(await p.$eval('#dlg select[name=wallet]', (s) => s.selectedOptions[0].textContent), 'Bravo Bank (IDR)');
  await closeDlg();
  // switching the type rebuilds the account list and the search follows the new count: 4 accounts + 1 debt account = 5 for an expense, 4 + the 2 new-coin entries = 6 for income
  await setN(4); await p.evaluate(() => { D().loans.push({ id: uid(), name: 'Car loan', currency: 'IDR', principal_minor: 1000000, archived: false, rate: 0, term_months: 12, start: '2026-01-01', payments: [] }); });
  await p.click('.nav-add'); await p.waitForSelector('#dlg[open]');
  assert(await p.$$eval('#dlg select[name=wallet] option', (o) => o.some((x) => x.value.startsWith('l:'))), 'the debt account is offered for an expense');
  assert(!(await has('#dlg select[name=wallet]')), 'expense: 5 choices, no search');
  await p.click('#dlg label:has(input[name=type][value=income])'); await p.waitForFunction(() => !document.querySelector('#dlg select[name=wallet] option[value^="l:"]'));
  assert(await has('#dlg select[name=wallet]'), 'income: 6 choices, search appears');
  await p.click('#dlg label:has(input[name=type][value=expense])'); await p.waitForFunction(() => !!document.querySelector('#dlg select[name=wallet] option[value^="l:"]'));
  assert(!(await has('#dlg select[name=wallet]')), 'back to expense: no search again');
  await closeDlg();
  // ---- Transfer: From / To
  await setN(6); await p.evaluate(() => transferDialog()); await p.waitForSelector('#dlg[open]');
  assert((await has('#dlg select[name=from]')) && (await has('#dlg select[name=to]')), 'transfer lists have the search at 6');
  await tap('#dlg select[name=to]'); await p.fill('.cs-search', 'delta'); assert.deepEqual((await shown()).map((x) => x.split(' · ')[0]), ['Delta Bank (IDR)']);
  await p.fill('.cs-search', '000'); assert.equal((await shown()).length, 0, 'the balance in the row is not searched'); await shut();
  assert.deepEqual(errs, []); console.log('ok searchlists'); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
