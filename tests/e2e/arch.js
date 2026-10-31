const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const log = () => p.evaluate(() => window.__log.splice(0)), settle = () => p.evaluate(() => Cloud.idle()), txt = () => p.evaluate(() => document.body.innerText);
  await p.evaluate(() => { location.hash = '#/portfolio'; }); await p.waitForSelector('.wallet');
  // a second wallet to play with
  await p.click('[data-act=add-wallet]'); await p.fill('input[name=name]', 'Spare'); await p.click('#dlg button[type=submit]'); await settle(); await log();
  assert((await p.$$('.wallet')).length === 2);
  await p.click('.wallet:nth-child(2) .dots'); await p.click('.wallet:nth-child(2) [data-act=archive-wallet]'); await settle(); await log();
  assert((await p.$$('.wallet')).length === 1); assert((await txt()).includes('Archived wallets (1)'));
  await p.click('[data-act=toggle-arch]'); assert((await txt()).includes('Spare'));
  await p.click('[data-act=restore-wallet]'); await settle(); await log(); assert((await p.$$('.wallet')).length === 2);
  await p.click('.wallet:nth-child(2) .dots'); await p.click('.wallet:nth-child(2) [data-act=archive-wallet]'); await settle(); await log();
  await p.click('[data-act=delete-wallet]'); await settle(); let l = await log();
  assert(l.some((o) => o.op === 'delete' && o.table === 'wallets'), JSON.stringify(l)); assert(!(await txt()).includes('Archived wallets'));
  // a wallet with a transaction can't be deleted
  await p.evaluate(() => { const w = { id: uid(), name: 'Old', type: 'bank', currency: 'IDR', opening_balance_minor: 0, since: monthKey(new Date()), archived: true }; D().wallets.push(w);
    D().transactions.push({ id: uid(), wallet_id: w.id, category_id: null, type: 'expense', amount_minor: 1000, currency: 'IDR', occurred_at: isoDate(new Date()), note: '', category_source: 'user', ai_confidence: null }); save(); render(); });
  await settle(); await log(); await p.click('[data-act=delete-wallet]'); await p.waitForTimeout(100);
  assert((await txt()).includes("Can't delete")); await settle(); assert((await log()).length === 0);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
