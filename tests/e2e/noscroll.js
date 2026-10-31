const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* No page may be wider than the phone screen (a wider page makes phones zoom out and pan), and zoom stays locked. */
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const width of [360, 390]) {
    const p = await b.newPage({ viewport: { width, height: 800 } }); p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
    await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land');
    assert(/maximum-scale=1/.test(await p.$eval('meta[name=viewport]', (m) => m.content)), 'zoom locked');
    const wide = () => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert((await wide()) <= 0, 'landing is wider than the screen at ' + width);
    await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]'); assert((await wide()) <= 0, 'sign-in wider at ' + width);
    await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
    for (const h of ['overview', 'transactions', 'budgets', 'portfolio', 'settings']) { await p.evaluate((h) => { location.hash = '#/' + h; }, h); await p.waitForTimeout(200); assert((await wide()) <= 0, h + ' is wider than the screen at ' + width); }
    for (const tab of ['investment', 'lent', 'loan']) { await p.evaluate(() => { location.hash = '#/portfolio'; }); await p.click(`[data-act=pf-tab][data-tab=${tab}]`); await p.waitForTimeout(150); assert((await wide()) <= 0, tab + ' tab wider at ' + width); }
    await p.click('.nav-add'); assert((await wide()) <= 0, 'add dialog wider at ' + width);
    await p.close();
  }
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
