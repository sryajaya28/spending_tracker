const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* A new login opens Overview (not the page you left); logging out goes to the top; reopening with a saved session keeps your page. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 450 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  const signIn = async () => { await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell'); await p.waitForTimeout(300); };
  await p.goto('http://127.0.0.1:5180/'); await signIn();
  // go deep into Settings and scroll to the bottom
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForTimeout(300); await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(150);
  assert((await p.evaluate(() => window.scrollY)) > 100, 'scrolled down');
  // reopening the app with a saved session keeps the page you were on
  // (the stand-in backend forgets its session on reload, so send the event the real one sends then)
  await p.evaluate(() => { state.auth.uid = null; state.data = null; onAuth('INITIAL_SESSION', { user: { id: window.__uidNow || 'u1', email: 'a@b.co' } }); }); await p.waitForSelector('.shell'); await p.waitForTimeout(300); assert.equal(await p.evaluate(() => location.hash), '#/settings', 'reopening with a saved session keeps the page');
  // logout: back at the top
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(150); assert((await p.evaluate(() => window.scrollY)) > 100);
  await p.click('[data-act=signout]'); await p.waitForSelector('.land'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.scrollY), 0, 'logout shows the top of the page');
  // a new login opens Overview, at the top
  await signIn(); assert.equal(await p.evaluate(() => location.hash), '#/overview', 'a new login starts on Overview'); assert.equal(await p.evaluate(() => window.scrollY), 0);
  assert(!(await p.evaluate(() => document.querySelector('.sidebar a.active, .bottom-nav a.active')?.textContent || '')).includes('Settings'), 'Settings is not the active page');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
