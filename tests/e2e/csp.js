const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
const vj = JSON.parse(fs.readFileSync('/home/user/spending_tracker/vercel.json', 'utf8'));
const headers = Object.fromEntries(vj.headers[0].headers.map((h) => [h.key.toLowerCase(), h.value]));
async function session(withCaptcha) {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const bad = []; p.on('pageerror', (e) => bad.push('pageerror ' + e.message)); p.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) bad.push(m.text()); });
  // serve every same-origin response with the production headers (so the CSP is really enforced)
  await p.route('http://127.0.0.1:5180/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith('/vendor/supabase.js')) return route.fulfill({ contentType: 'text/javascript', headers, body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') });
    if (url.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', headers, body: '{}' });
    const r = await route.fetch(); let body = await r.text();
    if (withCaptcha && url.endsWith('/config.js')) body = body.replace("TURNSTILE_SITE_KEY: ''", "TURNSTILE_SITE_KEY: '1x00000000000000000000AA'");
    route.fulfill({ response: r, body, headers: { ...r.headers(), ...headers } });
  });
  // stand-in for Cloudflare's script (the real one is allowed by the CSP: challenges.cloudflare.com)
  await p.route('https://challenges.cloudflare.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.turnstile = { n: 0, render(el, o) { el.innerHTML = '<button type="button" id="fake-solve">solve</button>'; el.querySelector('button').onclick = () => o.callback('TOKEN-' + (++this.n)); return this.n; }, remove() {}, reset() {} };` }));
  return { b, p, bad };
}
(async () => {
  // 1) CSP enforced, no captcha: the whole app still works
  let { b, p, bad } = await session(false);
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  assert((await p.$('#captcha')) === null, 'no captcha widget while the key is empty');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  assert.equal(await p.evaluate(() => window.__signInOpts.captchaToken), undefined);
  for (const r of ['transactions', 'budgets', 'portfolio', 'settings', 'overview']) { await p.evaluate((x) => { location.hash = '#/' + x; }, r); await p.waitForTimeout(150); }
  await p.click('[data-act=add-txn]'); await p.waitForSelector('#dlg[open]'); await p.click('[data-act=close]');
  await p.evaluate(() => { location.hash = '#/portfolio'; }); await p.click('[data-act=add-wallet]'); await p.click('[data-act=close]');
  console.log('CSP violations (no captcha):', JSON.stringify(bad)); assert.equal(bad.length, 0); await b.close();
  // 2) captcha on: sign-in blocked until solved, token forwarded
  ({ b, p, bad } = await session(true));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('#captcha #fake-solve');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]');
  await p.waitForSelector('.auth-err'); assert((await p.innerText('.auth-err')).includes('verification'));
  assert.equal(await p.evaluate(() => window.__signInOpts), undefined, 'no request without a token');
  await p.waitForSelector('#captcha #fake-solve'); await p.click('#fake-solve');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  assert((await p.evaluate(() => window.__signInOpts.captchaToken)).startsWith('TOKEN-'));
  console.log('CSP violations (captcha):', JSON.stringify(bad)); assert.equal(bad.length, 0);
  console.log('ok'); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
