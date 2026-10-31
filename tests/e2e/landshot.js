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
    await p.screenshot({ path: __dirname + `/out/landing_${name}.png`, fullPage: true });
  }
  console.log('landing ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
