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
    assert((await p.innerText('.land-phone h2')).includes('better experience on your phone'), name + ': headline');
    await p.click('.land-phone [data-act=phone-tutorial]'); await p.waitForSelector('#dlg .install-guide');
    assert.equal(await p.$$eval('#dlg .g-tabs button', (e) => e.length), 3, name + ': three tabs'); assert.equal(await p.$$eval('#dlg .g-scene', (e) => e.length), 5, name + ': Safari animation first');
    await p.click('#dlg [data-k=chrome]'); assert.equal(await p.$$eval('#dlg .g-scene', (e) => e.length), 4, name + ': Chrome animation');
    await p.click('#dlg [data-k=android]'); assert.equal(await p.$$eval('#dlg .install-steps li', (e) => e.length), 3, name + ': Android steps'); assert((await p.innerText('#dlg')).includes('⋮'), name + ': Android menu step'); assert.equal(await p.$$eval('#dlg .g-tabs button', (e) => e.length), 3, name + ': tabs stay after switching');
    const noScroll = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth); assert(noScroll, name + ': no sideways scroll');
    await p.click('#dlg [data-act=close]');
    await p.screenshot({ path: __dirname + `/out/landing_${name}.png`, fullPage: true });
  }
  console.log('landing ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
