const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* A special occasion can exist without a budget (Settings), be tagged to spending, and get a budget later from Budgets.
   An occasion created from Budgets also shows in Settings. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const log = () => p.evaluate(() => window.__log.splice(0)), settle = () => p.evaluate(() => Cloud.idle());
  await p.evaluate(() => { location.hash = '#/settings'; render(); }); await p.waitForSelector('#occasions-card'); await log();
  // History is always on Budgets (left of + Add), also when nothing is past yet: it then says so
  await p.evaluate(() => { location.hash = '#/budgets'; render(); }); assert.equal(await p.$$eval('.card-head:has(h2:text-is("Special occasions")) .tools > *', (e) => e.map((x) => x.textContent.trim()).join('|')), 'History|+ Add');
  await p.click('[data-act=occasion-history]'); await p.waitForSelector('#dlg .empty'); assert((await p.innerText('#dlg')).includes('No past special occasions yet.')); await p.click('#dlg [data-act=close]');
  await p.evaluate(() => { location.hash = '#/settings'; render(); }); await p.waitForSelector('#occasions-card');
  // 1. Settings: add an occasion with no budget
  await p.click('#occasions-card [data-act=add-occasion]'); await p.fill('#dlg input[name=name]', 'Wedding'); assert(!(await p.$eval('#dlg input[name=amount]', (e) => e.required)), 'budget is optional here');
  await p.click('#dlg button[type=submit]'); await settle();
  let l = await log(); const row = l.find((o) => o.table === 'occasions').rows[0]; assert.equal(row.name, 'Wedding'); assert.equal(row.amount_minor, null, 'no budget is stored as null');
  let t = await p.innerText('#occasions-card'); assert(t.includes('Wedding') && t.includes('No budget'), t);
  // 2. not on Budgets (it has no budget), but it can be tagged to an expense
  await p.evaluate(() => { location.hash = '#/budgets'; render(); }); assert(!(await p.innerText('.main')).includes('Wedding'), 'no budget: not listed on Budgets');
  await p.evaluate(() => txnDialog(null, 'expense')); assert((await p.$$eval('#dlg select[name=occasion] option', (o) => o.map((x) => x.textContent))).some((x) => x.includes('Wedding')), 'can be tagged');
  await p.click('#dlg [data-act=close]');
  // 3. Budgets > + Add: pick the pre-added occasion and give it a budget
  await p.click('[data-act=add-occasion-budget]'); await p.waitForSelector('#dlg select[name=pick]');
  assert.equal(await p.$eval('#dlg select[name=pick]', (s) => s.selectedOptions[0].textContent.includes('Wedding')), true, 'the pre-added occasion is offered');
  assert(!(await p.isVisible('#dlg input[name=name]')), 'name hidden while an existing occasion is picked'); assert(await p.$eval('#dlg input[name=amount]', (e) => e.required), 'a budget is required here');
  await p.fill('#dlg input[name=amount]', '5000000'); await p.click('#dlg button[type=submit]'); await settle();
  l = await log(); assert.equal(l.find((o) => o.table === 'occasions').rows[0].amount_minor, 5000000);
  assert.equal(await p.evaluate(() => D().occasions.filter((o) => o.name === 'Wedding').length), 1, 'no duplicate occasion');
  assert((await p.innerText('.main')).includes('Wedding'), 'now on Budgets');
  // 4. a new occasion from Budgets also shows in Settings
  await p.click('[data-act=add-occasion-budget]'); await p.waitForSelector('#dlg input[name=name]'); await p.fill('#dlg input[name=name]', 'Bali Trip'); await p.fill('#dlg input[name=amount]', '10000000'); await p.click('#dlg button[type=submit]'); await settle();
  await p.evaluate(() => { location.hash = '#/settings'; render(); }); t = await p.innerText('#occasions-card'); assert(t.includes('Bali Trip') && t.includes('Wedding'), t);
  // 4b. occasions that already have a budget stay in the picker, greyed out and tagged "Budget Added" (not selectable)
  await p.evaluate(() => { D().occasions.push({ id: uid(), name: 'Pending Party', amount_minor: null, currency: 'IDR', start: '', end: '', archived: false }); render(); });
  await p.evaluate(() => { location.hash = '#/budgets'; render(); });
  await p.click('[data-act=add-occasion-budget]'); await p.waitForSelector('#dlg select[name=pick]');
  const popts = await p.$$eval('#dlg select[name=pick] option', (o) => o.map((x) => ({ t: x.textContent.trim(), d: x.disabled, tag: x.dataset.tag || '' })));
  assert(popts.find((x) => x.t.includes('Wedding')).d && popts.find((x) => x.t.includes('Wedding')).tag === 'Budget Added' && popts.find((x) => x.t.includes('Bali Trip')).d, JSON.stringify(popts));
  assert(!popts.find((x) => x.t.includes('Pending Party')).d, 'one without a budget is selectable'); assert.equal(await p.$eval('#dlg select[name=pick]', (e) => e.selectedOptions[0].textContent.includes('Pending Party')), true, 'starts on the first one without a budget');
  await p.mouse.click(...(await p.$eval('#dlg select[name=pick]', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }))); await p.waitForSelector('.cs-pop');
  assert.equal(await p.$$eval('.cs-pop .cs-opt.dis .cs-tag', (e) => e.map((x) => x.textContent).join()), 'Budget Added,Budget Added', 'greyed rows carry the tag');
  await p.keyboard.press('Escape'); await p.click('#dlg [data-act=close]'); await p.evaluate(() => { D().occasions = D().occasions.filter((o) => o.name !== 'Pending Party'); render(); });
  await p.evaluate(() => { location.hash = '#/settings'; render(); });
  // 5. removing the budget in Edit keeps the occasion in Settings and takes it off Budgets
  await p.click(`#occasions-card [data-act=edit-occasion][data-id="${await p.evaluate(() => D().occasions.find((o) => o.name === 'Wedding').id)}"]`); await p.fill('#dlg input[name=amount]', ''); await p.click('#dlg button[type=submit]'); await settle();
  assert((await p.innerText('#occasions-card')).includes('Wedding'));
  await p.evaluate(() => { location.hash = '#/budgets'; render(); }); assert(!(await p.innerText('.main')).includes('Wedding'), 'budget removed: off Budgets');
  // 6. History: ended and archived occasions are listed in a pop-up on Budgets; Details opens Transactions on that occasion's period with the occasion filter set
  await p.evaluate(() => { const w = D().wallets[0]; D().occasions.length = 0; const o = { id: uid(), name: 'Lombok Trip', amount_minor: 4000000, currency: 'IDR', start: '2026-03-10', end: '2026-03-12', archived: false }; D().occasions.push(o, { id: uid(), name: 'Next Trip', amount_minor: 1000000, currency: 'IDR', start: '2099-01-01', end: '2099-01-03', archived: false });
    D().transactions.push({ id: uid(), wallet_id: w.id, category_id: null, type: 'expense', amount_minor: 900000, currency: 'IDR', occurred_at: '2026-03-11', note: 'Hotel', category_source: 'user', ai_confidence: null, occasion_id: o.id }); location.hash = '#/budgets'; render(); });
  assert(!(await p.innerText('.main')).includes('Lombok Trip'), 'an ended occasion is not in the live list'); assert((await p.innerText('.main')).includes('Next Trip'));
  await p.click('[data-act=occasion-history]'); await p.waitForSelector('#dlg .occ-hist'); const ht = await p.innerText('#dlg'); assert(ht.includes('Lombok Trip') && !ht.includes('Next Trip'), ht);
  assert(/Mar 10 – Mar 12, 2026/.test(ht) && /23%/.test(ht) && !/transaction/.test(ht), 'dates with the year once, spent and its percentage, nothing else: ' + ht);
  await p.click('#dlg [data-act=view-occasion]'); await p.waitForFunction(() => location.hash === '#/transactions'); await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => state.ui.occ === D().occasions[0].id), true, 'occasion selected in state')
  assert.equal(await p.evaluate(() => state.ui.month), '2026-03', 'period set to the occasion period'); assert.equal(await p.$eval('select[data-filter=occ]', (e) => e.value), await p.evaluate(() => D().occasions[0].id), 'occasion filter pre-selected');
  assert.equal(await p.$eval('select[data-bind=month]', (e) => e.value), '2026-03', 'the period picker shows that period'); assert(!(await p.$eval('#dlg', (d) => d.open)), 'the pop-up closed');
  // 6b. Details on an occasion whose expenses span several periods opens All periods
  await p.evaluate(() => { const o = D().occasions[0]; D().transactions.push({ id: uid(), wallet_id: D().wallets[0].id, category_id: null, type: 'expense', amount_minor: 100000, currency: 'IDR', occurred_at: '2026-01-05', note: 'Deposit', category_source: 'user', ai_confidence: null, occasion_id: o.id }); location.hash = '#/budgets'; render(); });
  await p.click('[data-act=occasion-history]'); await p.waitForSelector('#dlg .occ-hist'); await p.click('#dlg [data-act=view-occasion]'); await p.waitForFunction(() => location.hash === '#/transactions'); await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => state.ui.allPeriods), true, 'several periods: All periods'); assert.equal(await p.$eval('select[data-bind=month]', (e) => e.value), 'all');
  await p.evaluate(() => { D().transactions = D().transactions.filter((t) => t.note !== 'Deposit'); state.ui.allPeriods = false; state.ui.month = '2026-03'; render(); });
  // 7. the period picker goes back to the first transaction (not only 6 periods)
  const opts = await p.$$eval('select[data-bind=month] option', (o) => o.map((x) => x.value)); assert(opts.includes('2026-03') && opts.length > 6, JSON.stringify(opts));
  assert.equal(opts[0], 'all', 'All periods is the first entry'); assert(opts[1] > opts[opts.length - 1], 'newest period first: ' + JSON.stringify(opts));
  // 8. All periods (Transactions only): every past transaction is listed, the period of the other pages is kept
  await p.evaluate(() => { Object.assign(state.ui, { occ: '', cat: '', wallet: '', q: '' }); render(); }); const before = await p.evaluate(() => state.ui.month);
  await p.selectOption('select[data-bind=month]', 'all'); assert.equal(await p.evaluate(() => state.ui.allPeriods), true); assert.equal(await p.evaluate(() => state.ui.month), before, 'the period itself is unchanged');
  assert.equal(await p.$eval('select[data-bind=month]', (e) => e.value), 'all');
  assert.equal(await p.evaluate(() => filteredTxns().length === D().transactions.filter((t) => t.occurred_at <= todayIso()).length), true, 'all past transactions are listed');
  // the list spans several periods: each one has its own heading, in order, and a single period has none
  await p.evaluate(() => { D().transactions.push({ id: uid(), wallet_id: D().wallets[0].id, category_id: null, type: 'expense', amount_minor: 50000, currency: 'IDR', occurred_at: '2026-01-05', note: 'Earlier', category_source: 'user', ai_confidence: null }); state.ui.allPeriods = true; render(); });
  const heads = await p.$$eval('#txn-list .period-head', (e) => e.map((x) => x.textContent.trim())); assert(heads.length >= 2 && new Set(heads).size === heads.length, JSON.stringify(heads));
  assert.equal(await p.$$eval('#txn-list .day-tools', (e) => getComputedStyle(e[0]).justifyContent), 'flex-end', 'Expand all / Hide all stay on the right'); assert.equal(await p.$eval('#txn-list .day-tools .legend-btn', (e) => { const c = getComputedStyle(e); return c.paddingLeft === c.paddingRight && c.justifyContent === 'center'; }), true, 'the text is centred inside its pressed pill');
  assert.equal(await p.evaluate(() => { const r = [...document.querySelectorAll('#txn-list > *')].map((e) => e.className.split(' ')[0]); return r.indexOf('period-head') < r.indexOf('day-group'); }), true, 'a heading comes before its days');
  await p.selectOption('select[data-bind=month]', before); assert.equal(await p.evaluate(() => state.ui.allPeriods), false, 'choosing a period leaves All periods');
  await p.evaluate(() => { D().transactions = D().transactions.filter((t) => t.note !== 'Earlier'); render(); });
  assert.equal(await p.$$eval('#txn-list .period-head', (e) => e.length), 0, 'one period: no headings');
  // 9. a new session starts on the current period, not on All periods
  await p.selectOption('select[data-bind=month]', 'all'); assert.equal(await p.evaluate(() => state.ui.allPeriods), true);
  await p.evaluate(() => { resetPeriodView(); render(); }); assert.equal(await p.evaluate(() => [state.ui.allPeriods, state.ui.month === currentPeriod()]).then((x) => x.join()), 'false,true', 'back on the current period');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
