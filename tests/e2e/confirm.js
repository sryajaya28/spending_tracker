const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  // links go back to the canonical address from the old vercel.app host, and stay local elsewhere
  const urls = await p.evaluate(() => [Cloud.appUrl('spendingtracker-three.vercel.app'), Cloud.appUrl('spendingtracker-suryajaya378-4429s-projects.vercel.app'), Cloud.appUrl('localhost'), Cloud.appUrl('stiver.io')]);
  assert.deepStrictEqual(urls, ['https://stiver.io/', 'https://stiver.io/', 'http://127.0.0.1:5180/', 'http://127.0.0.1:5180/'], JSON.stringify(urls));
  assert.equal(await p.evaluate(() => Cloud.redirect()), 'http://127.0.0.1:5180/');
  // sign up on desktop while the email is not confirmed yet
  await p.evaluate(() => { window.__unconfirmed = true; });
  await p.click('[data-view=signup]'); await p.fill('[name=name]', 'Ari'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'longenough1'); await p.click('button[type=submit]');
  await p.waitForSelector('text=Check your email'); assert((await p.innerText('.onboard')).includes('signs you in on its own'));
  // not confirmed yet: pressing the button says so and stays put
  await p.click('[data-act=auth-check]'); await p.waitForTimeout(150);
  assert((await p.evaluate(() => document.getElementById('toast').textContent)).includes('Not confirmed yet')); assert(await p.$('text=Check your email'));
  // "the phone confirmed it": coming back to the tab signs in by itself
  await p.evaluate(() => { window.__unconfirmed = false; });
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForSelector('.shell', { timeout: 5000 });
  const calls = await p.evaluate(() => window.__signInCalls); console.log('sign-in attempts:', calls);
  // polling stops after success: no more attempts
  await p.waitForTimeout(500); assert.equal(await p.evaluate(() => window.__signInCalls), calls);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
