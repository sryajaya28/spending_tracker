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
  // mobile browser: the button is on the landing page (below Sign in) and on Overview (below the Spent today hero)
  const { ctx, p } = await mk({ mobile: true });
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land');
  assert.equal(await p.$$eval('.install-cta', (e) => e.length), 1, 'button on the landing page'); assert((await p.innerText('.install-cta')).includes('Use mobile app experience'));
  const order = await p.evaluate(() => { const c = document.querySelector('.land-cta').getBoundingClientRect(), i = document.querySelector('.install-cta').getBoundingClientRect(); return i.top >= c.bottom; }); assert(order, 'below Sign in');
  await p.click('.install-cta'); await p.waitForSelector('.install-guide'); assert(!(await p.innerText('#dlg')).includes('Transfer from browser'), 'signed out: no code yet'); await p.click('#dlg [data-act=close]');
  await signIn(p); await p.waitForSelector('.ov-install');
  const below = await p.evaluate(() => { const h = document.querySelector('.hero, .onb-sample').getBoundingClientRect(), i = document.querySelector('.ov-install').getBoundingClientRect(); return i.top >= h.bottom - 1; }); assert(below, 'below Total Balance (or the sample card on the first-run screen)');
  await p.click('.ov-install'); await p.waitForSelector('.handoff-code'); const shown = (await p.innerText('.handoff-code')).trim(); assert(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(shown), shown);
  const url = await p.evaluate(() => location.href); assert(/#\/overview\?handoff=[A-Z0-9]{10}$/.test(url), url);
  // the installed app (a separate session, standalone) opens that address and is signed in without a password
  { const { p: app } = await mk({ ctx }, true); await app.goto(url); await app.waitForSelector('.shell', { timeout: 8000 });
    assert(!/handoff/.test(await app.evaluate(() => location.hash)), 'the code is removed from the address'); assert.equal(await app.$$eval('.install-cta', (e) => e.length), 0, 'no button inside the installed app');
    // the code worked once only
    const again = await mk({ ctx }, true); await again.p.goto(url); await again.p.waitForSelector('.land'); await again.p.waitForTimeout(500); assert.equal(await again.p.$$eval('.shell', (e) => e.length), 0, 'single use'); }
  // iPhone ignores the address when adding to the Home Screen, so the code also rides in a short-lived cookie that the installed app picks up
  await p.click('#dlg [data-act=close]'); await p.click('.ov-install'); await p.waitForSelector('.handoff-code'); assert(/stiver_handoff=/.test(await p.evaluate(() => document.cookie)), 'cookie set');
  { const { p: app } = await mk({ ctx }, true); await app.goto('http://127.0.0.1:5180/'); await app.waitForSelector('.shell', { timeout: 8000 }); assert(!/stiver_handoff/.test(await app.evaluate(() => document.cookie)), 'cookie cleared after use'); }
  // the browser itself never takes the cookie
  await p.click('#dlg [data-act=close]'); await p.click('.ov-install'); await p.waitForSelector('.handoff-code'); { const again = await mk({ ctx }); await again.p.goto('http://127.0.0.1:5180/'); await again.p.waitForSelector('.land'); await again.p.waitForTimeout(500); assert.equal(await again.p.$$eval('.shell', (e) => e.length), 0, 'a browser (not the installed app) does not take the cookie'); }
  // typing the code by hand in the installed app (cookie removed so the app cannot pick it up by itself)
  await p.click('#dlg [data-act=close]'); await p.click('.ov-install'); await p.waitForSelector('.handoff-code'); const code2 = (await p.innerText('.handoff-code')).trim(); await ctx.clearCookies();
  { const { p: app } = await mk({ ctx }, true); await app.goto('http://127.0.0.1:5180/'); await app.waitForSelector('.land'); await app.waitForSelector('.land-transfer');
    await app.click('[data-act=transfer-dialog]'); await app.fill('input[name=code]', 'WRONG-CODE1'); await app.click('#dlg button[type=submit]'); await app.waitForTimeout(400); assert.equal(await app.$$eval('.shell', (e) => e.length), 0, 'a wrong code is refused');
    await app.fill('input[name=code]', code2.toLowerCase()); await app.click('#dlg button[type=submit]'); await app.waitForSelector('.shell', { timeout: 8000 }); }
  // tapping outside the dialog closes it (no Done needed)
  await p.click('#dlg [data-act=close]'); await p.click('.ov-install'); await p.waitForSelector('.install-guide'); await p.mouse.click(3, 3); await p.waitForTimeout(300); assert.equal(await p.evaluate(() => document.querySelector('#dlg').open), false, 'tapping outside closes it');
  // the iPhone modal has the how-to animation (Safari/Chrome tabs); the Android modal has plain menu steps and no transfer code
  await p.click('.ov-install'); await p.waitForSelector('.install-guide'); assert.equal(await p.$$eval('.g-scene', (e) => e.length), 5, 'Safari: five scenes'); assert.equal(await p.$$eval('.install-steps', (e) => e.length), 0, 'no text steps next to the animation');
  assert.equal(await p.innerText('#dlg .actions'), 'Close'); assert.equal(await p.$$eval('.g-bar2 .g-pill', (e) => e.length), 1, 'Safari version shows the address bar with the menu button'); assert((await p.innerText('.g-menu')).includes('Share')); await p.click('[data-k=chrome]'); assert.equal(await p.$$eval('.g-url', (e) => e.length), 1, 'Chrome version shows the address-bar share icon'); assert.equal(await p.$$eval('.g-scene', (e) => e.length), 4, 'Chrome: four scenes');
  { const actx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36' }); const ap = await actx.newPage();
    await ap.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') })); await ap.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await ap.goto('http://127.0.0.1:5180/'); await ap.waitForSelector('.install-cta'); await ap.click('.install-cta'); await ap.waitForSelector('.install-steps'); assert.equal(await ap.$$eval('.install-guide', (e) => e.length), 0, 'no iPhone animation on Android'); assert((await ap.innerText('#dlg')).includes('⋮'), 'Android menu steps'); assert.equal(await ap.innerText('#dlg .actions'), 'Close'); await actx.close(); }
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message, (e.stack || '').split('\n').filter((l) => l.includes('handoff.js')).slice(0, 2).join(' | ')); process.exit(1); });
