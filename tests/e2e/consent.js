const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Sign-up needs the agreement ticked (Google and e-mail sign-up stay disabled until then), the links open the policy and terms,
   and every password box has a show / hide button. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signup]'); await p.waitForSelector('[data-form=signup]');
  // 1. the agreement, unticked: both ways of signing up are disabled
  assert.equal(await p.isChecked('input[name=agree]'), false, 'unticked by default');
  assert.equal(await p.isDisabled('[data-act=auth-google]'), true, 'Google sign-up disabled'); assert.equal(await p.isDisabled('form[data-form=signup] button[type=submit]'), true, 'Create account disabled');
  const links = await p.$$eval('.consent a', (a) => a.map((x) => [x.getAttribute('href'), x.target, x.rel])); assert.deepEqual(links, [['privacy.html', '_blank', 'noopener'], ['terms.html', '_blank', 'noopener']], 'links to the policy and the terms');
  assert.equal(await p.evaluate(() => { window.__g = 0; Cloud.google = () => { window.__g++; return Promise.resolve({}); }; return window.__g; }), 0);
  await p.evaluate(() => document.querySelector('[data-act=auth-google]').click()); assert.equal(await p.evaluate(() => window.__g), 0, 'a disabled Google button does nothing');
  // typed values survive ticking (no re-render), and ticking enables both
  await p.fill('[name=name]', 'Ari'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'longenough1');
  await p.check('input[name=agree]'); assert.equal(await p.isDisabled('[data-act=auth-google]'), false); assert.equal(await p.isDisabled('form[data-form=signup] button[type=submit]'), false);
  assert.equal(await p.inputValue('[name=name]'), 'Ari', 'typing is kept'); assert.equal(await p.inputValue('[name=password]'), 'longenough1');
  await p.uncheck('input[name=agree]'); assert.equal(await p.isDisabled('[data-act=auth-google]'), true); assert.equal(await p.isDisabled('form[data-form=signup] button[type=submit]'), true, 'unticking disables again');
  // the form cannot be sent without the tick (even by pressing Enter)
  await p.evaluate(() => document.querySelector('form[data-form=signup]').requestSubmit()); await p.waitForTimeout(200); assert.equal(await p.evaluate(() => !!window.__signUp), false, 'no sign-up call without the tick');
  // 2. show / hide password on the sign-up box
  assert.equal(await p.$eval('[name=password]', (e) => e.type), 'password'); await p.click('.pw-toggle'); assert.equal(await p.$eval('[name=password]', (e) => e.type), 'text', 'shown');
  assert.equal(await p.$eval('.pw-toggle', (e) => e.getAttribute('aria-pressed') + '|' + e.getAttribute('aria-label')), 'true|Hide password'); assert.equal(await p.inputValue('[name=password]'), 'longenough1', 'the value is kept');
  await p.click('.pw-toggle'); assert.equal(await p.$eval('[name=password]', (e) => e.type), 'password', 'hidden again');
  // 3. sign-in page: Google may create an account, so it says what continuing means; the password box has the button too
  await p.click('form[data-form=signup] [data-act=auth-view][data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  assert.equal(await p.isDisabled('[data-act=auth-google]'), false, 'signing in with Google is not blocked'); assert.equal(await p.$$eval('.consent-note a', (a) => a.length), 2, 'the note links the policy and the terms');
  assert.equal(await p.$$eval('form[data-form=signin] .pw-toggle', (e) => e.length), 1);
  // 4. the reset-password box
  await p.evaluate(() => { state.auth.view = 'recovery'; render(); }); await p.waitForSelector('[data-form=recovery] .pw-toggle'); await p.click('[data-form=recovery] .pw-toggle'); assert.equal(await p.$eval('[data-form=recovery] [name=password]', (e) => e.type), 'text');
  // 5. ticking is remembered while the page stays open, and a ticked sign-up goes through
  await p.evaluate(() => { state.auth.view = 'signup'; render(); }); await p.waitForSelector('form[data-form=signup]'); assert.equal(await p.isChecked('input[name=agree]'), false);
  await p.fill('[name=name]', 'Ari'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'longenough1'); await p.check('input[name=agree]'); await p.click('form[data-form=signup] button[type=submit]'); await p.waitForSelector('text=Check your email');
  assert.equal(await p.evaluate(() => !!window.__signUp), true, 'the sign-up call is made once ticked');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
