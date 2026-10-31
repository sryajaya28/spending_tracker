const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const log = () => p.evaluate(() => window.__log.splice(0)), settle = () => p.evaluate(() => Cloud.idle());
  await p.evaluate(() => { location.hash = '#/portfolio'; }); await p.waitForSelector('.wallet');
  await p.click('.wallet .dots'); await p.click('[data-act=edit-wallet]'); await p.fill('input[name=name]', 'Main cash'); await p.fill('input[name=balance]', '5000000'); await p.selectOption('select[name=type]', 'bank');
  await p.click('#dlg button[type=submit]'); await settle();
  let l = await log(); const w = l.find((o) => o.table === 'wallets').rows[0];
  assert.equal(w.name, 'Main cash'); assert.equal(w.type, 'bank'); assert.equal(w.opening_balance_minor, 5000000);
  assert((await p.innerText('.wallet')).includes('5,000,000'));
  // with a transaction in the wallet: set the balance to 4,000,000 -> opening must become 3,900,000
  await p.evaluate(() => { D().transactions.push({ id: uid(), wallet_id: D().wallets[0].id, category_id: null, type: 'income', amount_minor: 100000, currency: D().wallets[0].currency, occurred_at: isoDate(new Date()), note: '', category_source: 'user', ai_confidence: null }); save(); render(); });
  assert((await p.innerText('.wallet')).includes('5,100,000')); await settle(); await log();
  await p.click('.wallet .dots'); await p.click('[data-act=edit-wallet]'); assert.equal(await p.inputValue('input[name=balance]'), '5100000');
  await p.fill('input[name=balance]', '4000000'); await p.click('#dlg button[type=submit]'); await settle();
  l = await log(); assert.equal(l.find((o) => o.table === 'wallets').rows[0].opening_balance_minor, 3900000);
  assert((await p.innerText('.wallet')).includes('4,000,000'));
  assert(!l.some((o) => o.table === 'transactions'), 'transactions untouched');
  // history: the wallet starts this month, so earlier months must not include it
  const hist = await p.evaluate(() => lastMonths(6).map((k) => balanceAtEnd(k)));
  assert.deepStrictEqual(hist.slice(0, 5), [0, 0, 0, 0, 0], JSON.stringify(hist)); assert(hist[5] > 0);
  await p.evaluate(() => loadUserData()); await p.waitForSelector('.wallet');
  assert.equal(await p.evaluate(() => D().wallets[0].since), new Date().toISOString().slice(0, 7), 'since survives reload');
  await p.screenshot({ path: __dirname + '/wallet.png' });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
