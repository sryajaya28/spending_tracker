const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* "Use mobile app experience": shown only in a mobile browser; the signed-in session moves to the installed app with a single-use code. */
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (opts, standalone) => {
    const ctx = opts.ctx || await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', ...(opts.mobile ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' } : {}) });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    if (standalone) await p.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true }); });
    await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
    await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    return { ctx, p };
  };
  const signIn = async (p) => { await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell'); };
  // desktop browser: no button anywhere
  { const { ctx, p } = await mk({}); await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); assert.equal(await p.$$eval('.install-cta', (e) => e.length), 0, 'no button on desktop'); await signIn(p); assert.equal(await p.$$eval('.install-cta', (e) => e.length), 0); await ctx.close(); }
  // mobile browser: the button is on the landing page (below Sign in) and on Overview (below Total Balance)
  const { ctx, p } = await mk({ mobile: true });
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land');
  assert.equal(await p.$$eval('.install-cta', (e) => e.length), 1, 'button on the landing page'); assert((await p.innerText('.install-cta')).includes('Use mobile app experience'));
  const order = await p.evaluate(() => { const c = document.querySelector('.land-cta').getBoundingClientRect(), i = document.querySelector('.install-cta').getBoundingClientRect(); return i.top >= c.bottom; }); assert(order, 'below Sign in');
  await p.click('.install-cta'); await p.waitForSelector('.install-steps'); assert(!(await p.innerText('#dlg')).includes('Transfer from browser'), 'signed out: no code yet'); await p.click('#dlg [data-act=close]');
  await signIn(p); await p.waitForSelector('.ov-install');
  const below = await p.evaluate(() => { const h = document.querySelector('.hero').getBoundingClientRect(), i = document.querySelector('.ov-install').getBoundingClientRect(); return i.top >= h.bottom - 1; }); assert(below, 'below Total Balance');
  await p.click('.ov-install'); await p.waitForSelector('.handoff-code'); const shown = (await p.innerText('.handoff-code')).trim(); assert(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(shown), shown);
  const url = await p.evaluate(() => location.href); assert(/#\/overview\?handoff=[A-Z0-9]{10}$/.test(url), url);
  // the installed app (a separate session, standalone) opens that address and is signed in without a password
  { const { p: app } = await mk({ ctx }, true); await app.goto(url); await app.waitForSelector('.shell', { timeout: 8000 });
    assert(!/handoff/.test(await app.evaluate(() => location.hash)), 'the code is removed from the address'); assert.equal(await app.$$eval('.install-cta', (e) => e.length), 0, 'no button inside the installed app');
    // the code worked once only
    const again = await mk({ ctx }, true); await again.p.goto(url); await again.p.waitForSelector('.land'); await again.p.waitForTimeout(500); assert.equal(await again.p.$$eval('.shell', (e) => e.length), 0, 'single use'); }
  // typing the code by hand in the installed app
  await p.click('#dlg [data-act=close]'); await p.click('.ov-install'); await p.waitForSelector('.handoff-code'); const code2 = (await p.innerText('.handoff-code')).trim();
  { const { p: app } = await mk({ ctx }, true); await app.goto('http://127.0.0.1:5180/'); await app.waitForSelector('.land'); await app.click('.land-cta [data-view=signin]'); await app.waitForSelector('[data-act=transfer-dialog]');
    await app.click('[data-act=transfer-dialog]'); await app.fill('input[name=code]', 'WRONG-CODE1'); await app.click('#dlg button[type=submit]'); await app.waitForTimeout(400); console.log('DLG', await app.evaluate(() => [document.querySelector('#dlg').open, document.querySelector('#dlg').innerText.slice(0,80), document.body.innerText.slice(0,100)])); assert.equal(await app.$$eval('.shell', (e) => e.length), 0, 'a wrong code is refused');
    await app.fill('input[name=code]', code2.toLowerCase()); await app.click('#dlg button[type=submit]'); await app.waitForSelector('.shell', { timeout: 8000 }); }
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').filter((l) => l.includes('handoff.js')).slice(0, 2).join(' | ')); process.exit(1); });
