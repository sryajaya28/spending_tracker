const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Recurring: a first payment dated later shows as the next payment (and is not made twice); amount and next date can be edited without touching past entries. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const settle = () => p.evaluate(() => Cloud.idle());
  await p.evaluate(() => { D().wallets[0].opening_balance_minor = 100000000; save(); render(); }); await settle();
  // 1. a monthly expense whose first payment is on a later date: next payment = that date, one upcoming entry
  const fut = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 9); return isoDate(d); });
  await p.evaluate(() => txnDialog(null, 'expense')); await p.fill('input[name=amount]', '120000'); await p.fill('input[name=date]', fut); await p.selectOption('select[name=repeat]', 'monthly'); await p.fill('textarea[name=note], input[name=note]', 'Gym'); await p.click('#dlg button[type=submit]'); await settle();
  let r = await p.evaluate(() => ({ n: D().recurring.length, next: D().recurring[0].next, start: D().recurring[0].start, first: D().recurring[0].spec.first_made, txns: D().transactions.filter((t) => t.note === 'Gym').length }));
  assert.equal(r.n, 1); assert.equal(r.next, fut, 'next payment is the entered date, not a month later'); assert.equal(r.txns, 1, 'one upcoming entry'); assert.equal(r.first, fut);
  // when that day arrives the rule does not make it again
  const dup = await p.evaluate(() => { const rule = D().recurring[0], t = D().transactions.find((x) => x.note === 'Gym'); const d = new Date(); d.setDate(d.getDate() - 2); const past = isoDate(d); t.occurred_at = past; rule.start = past; rule.next = past; rule.spec.first_made = past; runRecurring(); return { gym: D().transactions.filter((x) => x.note === 'Gym').length, next: rule.next, first: rule.spec.first_made }; });
  assert.equal(dup.gym, 1, 'not duplicated'); assert(dup.next > (await p.evaluate(() => isoDate(new Date()))), 'moved on'); assert.equal(dup.first, undefined);
  // an upcoming first entry follows an edit of the rule (it has not happened yet), so no stale copy is left behind
  const fut2 = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 12); return isoDate(d); });
  await p.evaluate(() => txnDialog(null, 'expense')); await p.fill('input[name=amount]', '49000'); await p.fill('input[name=date]', fut); await p.selectOption('select[name=repeat]', 'monthly'); await p.fill('textarea[name=note], input[name=note]', 'Music'); await p.click('#dlg button[type=submit]'); await settle();
  await p.evaluate(() => { location.hash = '#/settings'; render(); }); const idx = await p.evaluate(() => D().recurring.findIndex((r) => r.spec.note === 'Music'));
  await p.click(`[data-act=rec-manage][data-id="${await p.evaluate((i) => D().recurring[i].id, idx)}"]`); await p.fill('input[name=amount]', '59000'); await p.fill('input[name=next]', fut2); await p.click('#dlg button[type=submit]'); await settle();
  const mus = await p.evaluate(() => D().transactions.filter((t) => t.note === 'Music').map((t) => [t.occurred_at, t.amount_minor])); assert.deepEqual(mus, [[fut2, 59000]], 'the upcoming first entry moved with the rule: ' + JSON.stringify(mus));
  await p.evaluate(() => { const r = D().recurring.find((x) => x.spec.note === 'Music'); D().transactions.filter((t) => t.note === 'Music').forEach((t) => { t.occurred_at = isoDate(new Date()); }); r.start = isoDate(new Date()); r.next = isoDate(new Date()); r.spec.first_made = isoDate(new Date()); runRecurring(); }); assert.equal(await p.evaluate(() => D().transactions.filter((t) => t.note === 'Music').length), 1, 'still one entry once the date arrives');
  await p.evaluate(() => { D().recurring = D().recurring.filter((r) => r.spec.note !== 'Music'); D().transactions = D().transactions.filter((t) => t.note !== 'Music'); });
  // 2. edit amount and date; past entries stay as they are
  await p.evaluate(() => { const r0 = D().recurring[0]; r0.start = '2026-06-10'; r0.next = '2026-09-10'; runRecurring(); });   // creates catch-up entries from June
  const before = await p.evaluate(() => D().transactions.filter((t) => t.note === 'Gym').map((t) => t.id + ':' + t.amount_minor + ':' + t.occurred_at).sort());
  assert(before.length >= 2, 'past entries exist: ' + before.length);
  await p.evaluate(() => { location.hash = '#/settings'; render(); }); await p.waitForSelector('[data-act=rec-manage]'); assert.equal(await p.$$eval('.cat-row [data-act=rec-toggle], .cat-row [data-act=rec-del], .cat-row .dots', (e) => e.length), 0, 'one Manage button per rule'); assert.equal((await p.innerText('[data-act=rec-manage]')).trim(), 'Manage'); await p.click('[data-act=rec-manage]'); assert.deepEqual(await p.$$eval('#dlg [data-act]', (e) => e.map((x) => x.dataset.act)), ['rec-toggle', 'rec-del', 'close']); await p.waitForSelector('form[data-form=recedit]');
  const newDate = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 20); return isoDate(d); });
  await p.fill('input[name=amount]', '150000'); await p.fill('input[name=next]', newDate); await p.click('#dlg button[type=submit]'); await settle();
  r = await p.evaluate(() => ({ amount: D().recurring[0].spec.amount_minor, next: D().recurring[0].next, start: D().recurring[0].start }));
  assert.equal(r.amount, 150000); assert.equal(r.next, newDate); assert.equal(r.start, newDate);
  const after = await p.evaluate(() => D().transactions.filter((t) => t.note === 'Gym').map((t) => t.id + ':' + t.amount_minor + ':' + t.occurred_at).sort());
  assert.deepEqual(after, before, 'past entries untouched');
  assert((await p.innerText('.main')).includes('150.000') || (await p.innerText('.main')).includes('150,000'), 'the new amount shows');
  // the payment account can be changed too (history stays)
  await p.evaluate(() => { const w = { ...D().wallets[0], id: uid(), name: 'Other bank', currency: D().wallets[0].currency }; D().wallets.push(w); window.__w2 = w.id; save(); render(); });
  const wid = await p.evaluate(() => window.__w2);
  await p.click('[data-act=rec-manage]'); await p.selectOption('select[name=wallet]', wid); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await p.evaluate(() => D().recurring[0].spec.wallet_id), wid, 'the rule pays from the new account');
  assert.deepEqual(await p.evaluate(() => D().transactions.filter((t) => t.note === 'Gym').map((t) => t.id + ':' + t.amount_minor + ':' + t.occurred_at).sort()), before, 'past entries still on their old account and amounts');
  assert.equal(await p.evaluate(() => D().transactions.filter((t) => t.note === 'Gym').every((t) => t.wallet_id !== window.__w2)), true);
  // the category can be changed too
  const catId = await p.evaluate(() => D().categories.find((c) => c.type === 'expense' && !c.parent_id).id);
  await p.click('[data-act=rec-manage]'); await p.selectOption('select[name=category]', catId); await p.click('#dlg button[type=submit]'); await settle();
  assert.equal(await p.evaluate(() => D().recurring[0].spec.category_id), catId, 'category saved on the rule');
  // expenses show red, income green in the list
  assert(await p.$('.cat-row .pl.down'), 'expense amount is red'); assert(!/[−+]{2}/.test(await p.innerText('.cat-row .pl.down')), 'one sign only');
  // a date in the past is refused
  await p.click('[data-act=rec-manage]'); await p.evaluate(() => { document.querySelector('input[name=next]').removeAttribute('min'); }); await p.fill('input[name=next]', '2026-01-01'); await p.click('#dlg button[type=submit]'); assert.equal(await p.evaluate(() => D().recurring[0].next), newDate, 'a past date is not accepted'); await p.click('[data-act=close]');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').filter((l) => l.includes('recedit.js')).slice(0, 2).join(' | ')); process.exit(1); });
