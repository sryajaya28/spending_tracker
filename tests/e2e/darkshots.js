const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'light');
  await p.click('[data-act=theme-toggle]'); assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await p.screenshot({ path: __dirname + '/out/dark/landing.png' });
  await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]'); await p.screenshot({ path: __dirname + '/out/dark/signin.png' });
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const log = () => p.evaluate(() => window.__log.splice(0)), settle = () => p.evaluate(() => Cloud.idle());
  // pick Dark in Settings: saved to the profile
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForSelector('select[data-theme-select]');
  await p.selectOption('select[data-theme-select]', 'light'); assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'light');
  await p.selectOption('select[data-theme-select]', 'dark'); await settle();
  const l = await log(); assert(l.some((o) => o.op === 'update' && o.table === 'profiles' && o.values.theme === 'dark'), JSON.stringify(l));
  await p.evaluate(() => { D().profile.name = 'Ari'; return setDemo(true); });
  const shot = async (name, hash) => { if (hash) await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(250); await p.screenshot({ path: __dirname + `/out/dark/${name}.png` }); };
  await shot('overview', '#/overview'); await shot('transactions', '#/transactions'); await shot('budgets', '#/budgets');
  for (const t of ['savings', 'investment', 'lent', 'loan']) { await p.evaluate((x) => { location.hash = '#/portfolio'; state.ui.pfTab = x; render(); }, t); await p.waitForTimeout(200); await p.screenshot({ path: __dirname + `/out/dark/portfolio_${t}.png` }); }
  await shot('settings', '#/settings');
  await p.evaluate(() => { location.hash = '#/overview'; }); await p.click('[data-act=add-txn][data-type=expense]'); await p.waitForTimeout(250); await p.screenshot({ path: __dirname + '/out/dark/dialog_txn.png' }); await p.keyboard.press('Escape');
  await p.evaluate(() => { location.hash = '#/portfolio'; state.ui.pfTab = 'savings'; render(); }); await p.click('.wallet .dots'); await p.screenshot({ path: __dirname + '/out/dark/wallet_menu.png' });
  // reload from the saved profile: dark is restored even with no local choice
  await p.evaluate(() => { localStorage.removeItem('stiver.theme.v1'); applyTheme('light'); }); await p.evaluate(() => loadUserData()); await p.waitForSelector('.shell');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark', 'theme restored from the profile');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
