const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } }); const p = await ctx.newPage();
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const log = () => p.evaluate(() => window.__log.splice(0)), settle = () => p.evaluate(() => Cloud.idle());
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForSelector('select[data-lang]');
  await p.selectOption('select[data-lang]', 'id'); await settle();
  assert.equal(await p.innerText('.topbar h1'), 'Pengaturan');
  const l = await log(); assert(l.some((o) => o.op === 'update' && o.table === 'profiles' && o.values.language === 'id'), JSON.stringify(l));
  // the saved choice follows the account: another device (no local choice) loads Indonesian after sign-in
  await p.evaluate(() => { localStorage.removeItem('stiver.lang.v1'); setLang('en'); }); await p.evaluate(() => loadUserData()); await p.waitForSelector('.shell');
  assert.equal(await p.evaluate(() => LANG), 'id', 'language restored from the profile');
  // landing page language selector works and is remembered on this device
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.click('button[data-act=signout]'); await p.waitForSelector('.land'); await p.selectOption('.land-nav select[data-lang]', 'en');
  assert.equal(await p.innerText('.land-copy h1'), 'Your money, finally in one place.');
  assert.equal(await p.evaluate(() => localStorage.getItem('stiver.lang.v1')), 'en');
  console.log('ok'); await b.close();
})().catch((e) => { console.error('FAIL', e.stack.split('\n').slice(0,4).join(' | ')); process.exit(1); });
