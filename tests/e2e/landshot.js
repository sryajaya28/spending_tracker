const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [name, w] of [['desktop', 1280], ['phone', 390]]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
    await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land');
    if (name === 'desktop') {
      await p.click('.land-hero [data-view=signup]'); await p.waitForSelector('[data-form=signup]');
      await p.click('.logo-btn'); await p.waitForSelector('.land');   // logo goes back home
      await p.click('.land-nav [data-view=signin]'); await p.waitForSelector('[data-form=signin]'); await p.click('.logo-btn'); await p.waitForSelector('.land');
    }
    // "Get a better experience on your phone": sits between the video and the feature grid; its button opens the tutorial (iPhone Safari / Chrome and Android tabs) on any device
    const order = await p.evaluate(() => { const y = (q) => document.querySelector(q).getBoundingClientRect().top; return y('.land-demo') < y('.land-phone') && y('.land-phone') < y('.feats'); }); assert(order, name + ': phone section is after the video and before the features');
    assert.equal(await p.$$eval('.land-phone .phone-mock video source', (e) => e.length), 2, name + ': phone video has mp4 + webm');
    { const feats = await p.innerText('.feats'); assert(feats.includes('Shared with your household') && !feats.includes('Net worth over time'), name + ': key items show Household, not Net worth over time'); assert.equal(await p.$$eval('.feat', (e) => e.length), 6, name + ': six key items'); }
    assert((await p.innerText('.land-phone h2')).includes('better experience on your phone'), name + ': headline');
    await p.click('.land-phone [data-act=phone-tutorial]'); await p.waitForSelector('#dlg .install-guide');
    assert.equal(await p.$$eval('#dlg .g-tabs button', (e) => e.length), 3, name + ': three tabs'); assert.equal(await p.$$eval('#dlg .g-scene', (e) => e.length), 5, name + ': Safari animation first');
    await p.click('#dlg [data-k=chrome]'); assert.equal(await p.$$eval('#dlg .g-scene', (e) => e.length), 4, name + ': Chrome animation');
    await p.click('#dlg [data-k=android]'); assert.equal(await p.$$eval('#dlg .install-steps li', (e) => e.length), 3, name + ': Android steps'); assert((await p.innerText('#dlg')).includes('⋮'), name + ': Android menu step'); assert.equal(await p.$$eval('#dlg .g-tabs button', (e) => e.length), 3, name + ': tabs stay after switching');
    for (const w of name === 'phone' ? [390, 360] : []) { await p.setViewportSize({ width: w, height: 900 }); const fits = await p.evaluate(() => [...document.querySelectorAll('.land-nav > *, .land-nav-r > *')].every((e) => !e.getClientRects().length || e.getBoundingClientRect().right <= innerWidth)); assert(fits, 'landing nav fits at ' + w + 'px'); }
    const noScroll = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth); assert(noScroll, name + ': no sideways scroll');
    await p.click('#dlg [data-act=close]');
    await p.screenshot({ path: __dirname + `/out/landing_${name}.png`, fullPage: true });
  }
  // motion: sections reveal as they scroll in, videos play only while on screen, and reduced motion switches all of it off
  const mk = async (opts) => { const c = await b.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, opts)); const m = await c.newPage(); m.on('pageerror', (e) => errs.push(e.message));
    await m.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') })); await m.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await m.goto('http://127.0.0.1:5180/'); await m.waitForSelector('.land'); return { c, m }; };
  { const { c, m } = await mk({});
    assert(await m.$eval('.land', (e) => e.classList.contains('rv-on') && e.classList.contains('fx')), 'motion on: reveal + fx classes');
    assert.equal(await m.$$eval('.aurora i', (e) => e.length), 3, 'aurora blobs');
    assert.equal(await m.$eval('.feat', (e) => getComputedStyle(e).opacity), '0', 'a card below the fold starts hidden');
    await m.$eval('.feats', (e) => e.scrollIntoView({ block: 'center' })); await m.waitForFunction(() => [...document.querySelectorAll('.feat')].every((e) => e.classList.contains('in') && getComputedStyle(e).opacity === '1'), null, { timeout: 5000 });
    await m.$eval('.land-demo .demo-frame', (e) => e.scrollIntoView({ block: 'center' })); await m.waitForFunction(() => { const v = document.querySelector('.land-demo video'); return v && !v.paused; }, null, { timeout: 8000 }); assert(await m.$eval('.land-demo video', (v) => v.loop && v.muted), 'demo video loops, muted');
    await m.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await m.waitForFunction(() => document.querySelector('.land-demo video').paused, null, { timeout: 5000 });
    await m.click('.land-nav [data-act=theme-toggle]'); await m.waitForSelector('.land'); assert.equal(await m.$eval('.feat', (e) => getComputedStyle(e).opacity), '1', 'a re-render (theme) shows everything at once');
    await c.close(); }
  { const { c, m } = await mk({ reducedMotion: 'reduce' });
    assert(await m.$eval('.land', (e) => !e.classList.contains('rv-on') && !e.classList.contains('fx')), 'reduced motion: no reveal or fx classes');
    assert.equal(await m.$eval('.feat', (e) => getComputedStyle(e).opacity), '1', 'reduced motion: content visible at once'); assert.equal(await m.$eval('.aurora i', (e) => getComputedStyle(e).animationName), 'none', 'reduced motion: no aurora animation');
    await m.$eval('.land-demo .demo-frame', (e) => e.scrollIntoView({ block: 'center' })); await m.waitForTimeout(700); assert(await m.$eval('.land-demo video', (v) => v.paused), 'reduced motion: video does not autoplay');
    await c.close(); }
  console.log('landing ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
