/* simulate iOS Safari: Intl says IDR/JPY have 2 decimals when not told otherwise */
const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 800 } }); const p = await ctx.newPage();
  await p.addInitScript(() => {
    const Orig = Intl.NumberFormat;
    Intl.NumberFormat = function (loc, o) {
      o = { ...(o || {}) };
      if (o.style === 'currency' && (o.currency === 'IDR' || o.currency === 'JPY') && o.minimumFractionDigits === undefined && o.maximumFractionDigits === undefined) { o.minimumFractionDigits = 2; o.maximumFractionDigits = 2; }
      return new Orig(loc, o);
    };
    Intl.NumberFormat.prototype = Orig.prototype;
  });
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  const r = await p.evaluate(() => ({ exp: expOf('IDR'), m: money(54328869, 'IDR'), minor: toMinor(46600000, 'IDR'), major: toMajor(46600000, 'IDR'), usd: money(270196, 'USD') }));
  console.log(JSON.stringify(r));
  assert.equal(r.exp, 0); assert.equal(r.m.replace(/\u00a0/g, ' '), 'Rp 54.328.869'); assert.equal(r.minor, 46600000); assert.equal(r.major, 46600000); assert.equal(r.usd, '$2,701.96');
  console.log('ok'); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
