const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const log = () => p.evaluate(() => window.__log.splice(0)), settle = () => p.evaluate(() => Cloud.idle()), txt = () => p.evaluate(() => document.body.innerText);
  const bal = (name) => p.evaluate((n) => { const w = D().wallets.find((x) => x.name === n); return walletBalance(w); }, name);
  // only one wallet: refused with a message
  await p.evaluate(() => transferDialog()); await p.waitForTimeout(100); assert((await txt()).includes('Add a second account'));
  await p.evaluate(() => { const m = monthKey(new Date()); D().wallets[0].name = 'Cash'; D().wallets[0].opening_balance_minor = 50000;
    D().wallets.push({ id: uid(), name: 'Bank', type: 'bank', currency: 'IDR', opening_balance_minor: 1000000, since: m, archived: false }, { id: uid(), name: 'USD Savings', type: 'bank', currency: 'USD', opening_balance_minor: 100000, since: m, archived: false }); save(); render(); });
  await settle(); await log();
  // same-currency transfer with a fee
  await p.evaluate(() => transferDialog()); await p.waitForSelector('form[data-form=transfer]');
  assert((await p.$$('.seg input[name=txkind]')).length === 4);
  await p.selectOption('select[name=from]', { label: await p.$eval('select[name=from]', (s) => [...s.options].find((o) => /^Bank/.test(o.textContent)).textContent) });
  await p.selectOption('select[name=to]', { label: await p.$eval('select[name=to]', (s) => [...s.options].find((o) => /^Cash/.test(o.textContent)).textContent) });
  assert(await p.$eval('[data-recv]', (e) => e.hidden), 'no received field for same currency');
  await p.fill('input[name=amount]', '200000'); await p.fill('input[name=fee]', '6500'); await p.fill('input[name=note]', 'Top up');
  await p.screenshot({ path: __dirname + '/out/transfer_dialog.png' });
  await p.click('#dlg button[type=submit]'); await settle();
  let l = await log(); const rows = l.filter((o) => o.table === 'transactions').flatMap((o) => o.rows); assert.equal(rows.length, 3, JSON.stringify(rows));
  const gid = rows[0].transfer_group_id; assert(gid && rows.every((r) => r.transfer_group_id === gid));
  assert.equal(rows.find((r) => r.transfer_direction === 'out').amount_minor, 200000); assert.equal(rows.find((r) => r.transfer_direction === 'in').amount_minor, 200000);
  const fee = rows.find((r) => r.type === 'expense'); assert.equal(fee.amount_minor, 6500); assert.equal(fee.transfer_direction, null);
  assert.equal(await bal('Bank'), 1000000 - 200000 - 6500); assert.equal(await bal('Cash'), 50000 + 200000);
  const spend = await p.evaluate(() => sumBy(inMonth(monthKey(new Date())), 'expense')); assert.equal(spend, 6500, 'only the fee counts as spending'); 
  // refused: more than the balance
  await p.evaluate(() => transferDialog()); await p.selectOption('select[name=from]', { index: 0 }); await p.fill('input[name=amount]', '99999999'); await p.click('#dlg button[type=submit]');
  assert((await p.evaluate(() => document.getElementById('toast').textContent)).includes("doesn't have enough")); await p.click('[data-act=close]');
  // cross-currency: Bank -> USD Savings, received estimated then edited
  await p.evaluate(() => transferDialog());
  await p.selectOption('select[name=from]', await p.$eval('select[name=from]', (s) => [...s.options].find((o) => /^Bank/.test(o.textContent)).value));
  await p.selectOption('select[name=to]', await p.$eval('select[name=to]', (s) => [...s.options].find((o) => /^USD Savings/.test(o.textContent)).value));
  assert(!(await p.$eval('[data-recv]', (e) => e.hidden)), 'received field shown');
  await p.fill('input[name=amount]', '155000'); await p.dispatchEvent('input[name=amount]', 'input');
  assert.equal(await p.inputValue('input[name=received]'), '10.00', 'estimated at the demo rate');
  await p.fill('input[name=received]', '9.5'); await p.dispatchEvent('input[name=received]', 'input'); await p.fill('input[name=amount]', '155000'); await p.dispatchEvent('input[name=amount]', 'input');
  assert.equal(await p.inputValue('input[name=received]'), '9.5', 'manual value is kept');
  await p.screenshot({ path: __dirname + '/out/transfer_cross.png' });
  await p.click('#dlg button[type=submit]'); await settle(); l = await log();
  const x = l.filter((o) => o.table === 'transactions').flatMap((o) => o.rows); assert.equal(x.length, 2);
  const inn = x.find((r) => r.transfer_direction === 'in'); assert.equal(inn.amount_minor, 950); assert.equal(inn.currency, 'USD');
  // list + detail + delete restores the balances
  await p.evaluate(() => { location.hash = '#/transactions'; }); await p.waitForSelector('#txn-list .row');
  const dayRows = await p.$$('#txn-list .day-row'); assert(dayRows.length >= 1); await dayRows[0].click(); await p.waitForSelector('#txn-list .day-group.open .day-body .row');
  assert((await txt()).includes('Transfer to Cash')); const before = await bal('Bank');
  // a transfer is only fund movement: no Transfer tag and no +/- sign on its rows; the fee is spending and keeps its − sign and its tag
  const tr = await p.$$eval('#txn-list .day-group.open .day-body .row', (rs) => rs.map((r) => ({ t: r.querySelector('.title').textContent, amt: r.querySelector('.amt').textContent.trim(), badges: [...r.querySelectorAll('.badge')].map((b) => b.textContent.trim()) })));
  const moves = tr.filter((r) => /^Transfer (to|from) /.test(r.t)), feeRow = tr.find((r) => /^Transfer fee/.test(r.t));
  // one record per transfer (the sender's), only the amount (no tag, no sign), and the note typed with it is not repeated in the list
  assert(moves.length >= 1 && moves.every((r) => /^Transfer to /.test(r.t)), JSON.stringify(tr));
  assert(moves.every((r) => r.badges.length === 0 && !/^[+−-]/.test(r.amt) && !/Top up/i.test(r.t)), JSON.stringify(tr));
  // transfer rows carry the circular-arrows icon (an inline SVG), the fee row its 💸 category icon
  assert.equal(await p.$$eval('#txn-list .day-group.open .day-body .row', (rs) => { const m = rs.filter((r) => /^Transfer to /.test(r.querySelector('.title').textContent)); return m.length > 0 && m.every((r) => !!r.querySelector('.amt .xfer-ico svg') && !/[+−]/.test(r.querySelector('.amt').textContent)); }), true, 'a transfer amount starts with the circular arrows, not + or −');
  // its fee is a separate expense: − sign, no tag, the Fee category with its icon
  assert(feeRow && feeRow.amt.startsWith('−') && feeRow.badges.length === 0, JSON.stringify(tr));
  assert.deepEqual(await p.evaluate(() => { const f = D().transactions.find((t) => t.transfer_id && t.type === 'expense'), c = catOf(f.category_id); return [c && c.name, c && c.icon]; }), ['Fee', '💸'], 'the fee is in the Fee category');
  // the receiving leg is kept out of the lists, except when that account is the one being filtered
  assert.deepEqual(await p.evaluate(() => { const inn = D().transactions.find((t) => t.transfer_id && t.flow === 'in'); const a = filteredTxns().some((t) => t.id === inn.id); state.ui.wallet = inn.wallet_id; const b = filteredTxns().some((t) => t.id === inn.id); state.ui.wallet = ''; return [a, b]; }), [false, true], 'receiving leg only under its own account filter');
  await p.click('#txn-list .day-group.open .day-body .row:has-text("Transfer to Cash")'); assert((await p.innerText('#dlg')).includes('Edit transfer') && !!(await p.$('[data-act=delete-transfer]')), 'the transfer opens as an editable form with a Delete button'); assert.equal(await p.inputValue('input[name=fee]'), '6500', 'the fee is in the form'); assert((await p.inputValue('input[name=note]')).includes('Top up'), 'the note is in the form');
  await p.click('[data-act=delete-transfer]'); await settle(); l = await log();
  assert(l.some((o) => o.op === 'delete' && o.table === 'transactions' && o.where[0][1].length === 3), JSON.stringify(l.map((o) => o.op + o.table)));
  assert.equal(await bal('Bank'), before + 200000 + 6500); assert.equal(await bal('Cash'), 50000);
  // reload keeps the remaining transfer linked
  await p.evaluate(() => loadUserData()); await p.waitForSelector('.shell');
  const kept = await p.evaluate(() => D().transactions.filter((t) => t.transfer_id).map((t) => [t.type, t.flow || null]));
  assert.deepStrictEqual(kept.sort(), [['transfer', 'in'], ['transfer', 'out']].sort());
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
