const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Join page (/join#t=...): the token is read once and removed from the address, the preview names the owner and role, the button stays off until
   name + password + tick are valid, a good join signs the invitee in and shows the app, a dead link shows one generic page, a busy link says
   "try again in a minute", and someone signed in as another person is asked to sign out first. */
const INDEX = fs.readFileSync(__dirname + '/../../prototype/index.html', 'utf8');
const TOKEN = 'abcdefghijklmnopqrstuvwx';
async function open(join) {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [], calls = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.route('http://127.0.0.1:5180/join', (r) => r.fulfill({ contentType: 'text/html', body: INDEX }));
  await p.route('**/functions/v1/join-household', (r) => { const body = JSON.parse(r.request().postData()); calls.push(body); const out = join(body); r.fulfill({ status: out.status || 200, contentType: 'application/json', body: JSON.stringify(out.body) }); });
  return { b, p, errs, calls };
}
(async () => {
  // 1. preview, token removed from the address, validation, a good join
  let { b, p, errs, calls } = await open((x) => (x.action === 'preview' ? { body: { owner_name: 'Sari Dewi', role: 'editor' } } : { body: { result: 'ok', session: { access_token: 'a', refresh_token: 'r' } } }));
  await p.goto('http://127.0.0.1:5180/join#t=' + TOKEN); await p.waitForSelector('[data-form=join]');
  const addr = await p.evaluate(() => location.pathname + location.hash); assert.equal(addr, '/join', 'the secret is not left in the address: ' + addr);
  assert.equal(calls[0].action, 'preview'); assert.equal(calls[0].token, TOKEN, 'the token is sent with the preview call');
  assert.match(await p.textContent('.join-card h2'), /Join Sari's household/); assert.match(await p.textContent('.join-card'), /as Editor/);
  assert.equal(await p.isDisabled('[data-send]'), true, 'off at first');
  await p.fill('[name=name]', 'Budi'); await p.fill('[name=password]', 'short'); await p.check('[name=agree]'); assert.equal(await p.isDisabled('[data-send]'), true, 'password under 8 characters');
  await p.fill('[name=password]', 'longenough1'); assert.equal(await p.isDisabled('[data-send]'), false, 'valid and ticked');
  await p.uncheck('[name=agree]'); assert.equal(await p.isDisabled('[data-send]'), true, 'untick turns it off'); await p.check('[name=agree]');
  await p.fill('[name=password]', 'x'.repeat(80)); assert.equal(await p.isDisabled('[data-send]'), true, '80 bytes is over the 72-byte limit');
  await p.fill('[name=password]', 'é'.repeat(40)); assert.equal(await p.isDisabled('[data-send]'), true, '40 two-byte characters = 80 bytes is over the 72-byte limit');
  await p.fill('[name=password]', 'longenough1'); await p.click('[data-send]');
  await p.waitForSelector('.shell'); const join = calls.find((c) => c.action === 'join');
  assert.deepEqual([join.token, join.password, join.display_name], [TOKEN, 'longenough1', 'Budi'], 'join sends the token, password and name');
  assert.equal(await p.evaluate(() => !!window.__setSession), true, 'the returned session is set'); assert.equal(await p.evaluate(() => document.querySelector('[data-form=join]') === null), true, 'the join page is gone');
  await b.close(); assert.deepEqual(errs, []);

  // 2. a dead link: one generic page, nothing else
  ({ b, p, errs, calls } = await open(() => ({ status: 400, body: { error: 'invalid_link' } })));
  await p.goto('http://127.0.0.1:5180/join#t=' + TOKEN); await p.waitForSelector('.join-card');
  assert.match(await p.textContent('.join-card h2'), /This link no longer works/); assert.equal(await p.$('[data-form=join]'), null, 'no form on a dead link');
  await p.goto('http://127.0.0.1:5180/join'); await p.waitForSelector('.join-card'); assert.match(await p.textContent('.join-card h2'), /This link no longer works/, 'no token at all is the same page');
  await b.close();

  // 3. a busy link (second simultaneous submit) tells the person to wait a minute and keeps the name
  ({ b, p, errs, calls } = await open((x) => (x.action === 'preview' ? { body: { owner_name: 'Sari', role: 'viewer' } } : { status: 409, body: { error: 'invalid_link' } })));
  await p.goto('http://127.0.0.1:5180/join#t=' + TOKEN); await p.waitForSelector('[data-form=join]');
  await p.fill('[name=name]', 'Budi'); await p.fill('[name=password]', 'longenough1'); await p.check('[name=agree]'); await p.click('[data-send]');
  await p.waitForSelector('#join-msg:not([hidden])'); assert.match(await p.textContent('#join-msg'), /Try again in a minute/); assert.equal(await p.inputValue('[name=name]'), 'Budi', 'the name is kept');
  await b.close();

  // 4. someone signed in as another person is asked to sign out first
  ({ b, p, errs, calls } = await open((x) => ({ body: { owner_name: 'Sari', role: 'editor' } })));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'rina@test.dev'); await p.fill('[name=password]', 'longenough1'); await p.click('form[data-form=signin] button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate((t) => { history.pushState(null, '', '/join#t=' + t); joinBoot(); }, TOKEN); await p.waitForSelector('.join-card');
  assert.match(await p.textContent('.join-card h2'), /Sign out to join/); assert.equal(await p.$('[data-form=join]'), null);
  await p.click('[data-act=join-signout]'); await p.waitForSelector('[data-form=join]', { timeout: 5000 });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
