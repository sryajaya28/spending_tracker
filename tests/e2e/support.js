const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Support: the top-bar button opens a bug / feedback form (250 characters, up to 5 images of at most 1 MB); the report is inserted with its type. */
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  // the entry point sits just left of the profile icon
  const pos = await p.evaluate(() => { const s = document.querySelector('.support-btn').getBoundingClientRect(), pr = document.querySelector('.profile').getBoundingClientRect(); return { left: s.right <= pr.left + 1, sameRow: Math.abs((s.top + s.height / 2) - (pr.top + pr.height / 2)) < 12 }; }); assert(pos.left && pos.sameRow, JSON.stringify(pos));
  await p.click('.support-btn'); await p.waitForSelector('form[data-form=support]');
  assert.equal(await p.inputValue('input[name=type]:checked').catch(() => 'bug'), 'bug');
  // 250 characters at most, with a counter
  await p.fill('textarea[name=message]', 'x'.repeat(300)); assert.equal((await p.inputValue('textarea[name=message]')).length, 250); assert.equal((await p.innerText('#support-count')).trim(), '250/250');
  await p.fill('textarea[name=message]', 'The chart shows the wrong month'); assert.equal((await p.innerText('#support-count')).trim(), '31/250');
  await p.click('#dlg .seg label:has(input[value=feedback])');
  // images: small ones are kept, a big one is shrunk to 1 MB, and no more than 5
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await p.setInputFiles('input[name=shots]', [{ name: 'a.png', mimeType: 'image/png', buffer: png }, { name: 'b.png', mimeType: 'image/png', buffer: png }]); await p.waitForFunction(() => document.querySelectorAll('#shots .shot img').length === 2);
  await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1600; const x = c.getContext('2d'), im = x.createImageData(1600, 1600); for (let i = 0; i < im.data.length; i++) im.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256); x.putImageData(im, 0, 0); const blob = await new Promise((r) => c.toBlob(r, 'image/png')); window.__bigSize = blob.size; const dt = new DataTransfer(); dt.items.add(new File([blob], 'big.png', { type: 'image/png' })); const input = document.querySelector('input[name=shots]'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForFunction(() => document.querySelectorAll('#shots .shot img').length === 3, null, { timeout: 15000 }); assert((await p.evaluate(() => window.__bigSize)) > 1048576, 'the test image really is bigger than 1 MB');
  await p.setInputFiles('input[name=shots]', [1, 2, 3, 4].map((i) => ({ name: `c${i}.png`, mimeType: 'image/png', buffer: png }))); await p.waitForTimeout(600);
  assert.equal(await p.$$eval('#shots .shot img', (e) => e.length), 5, 'five images at most'); assert.equal(await p.$$eval('#shots .shot.add', (e) => e.length), 0, 'no add button at five');
  await p.click('#shots .shot:nth-child(5) .icon-x'); assert.equal(await p.$$eval('#shots .shot img', (e) => e.length), 4); assert.equal(await p.$$eval('#shots .shot.add', (e) => e.length), 1, 'add button is back');
  // a failed upload keeps the form so nothing is lost
  await p.evaluate(() => { window.__failUpload = true; }); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(500); assert(await p.$('form[data-form=support]'), 'form stays open on failure'); assert(!(await p.evaluate(() => document.querySelector('[data-send]').disabled)), 'can retry');
  await p.evaluate(() => { window.__failUpload = false; window.__uploads = []; });
  await p.click('#dlg button[type=submit]'); await p.waitForTimeout(1500); await p.waitForFunction(() => !document.querySelector('#dlg[open]'), null, { timeout: 8000 });
  const sent = await p.evaluate(() => ({ ups: window.__uploads, row: window.__log.filter((o) => o.op === 'insert' && o.table === 'support_reports').map((o) => o.row) }));
  assert.equal(sent.row.length, 1); const row = sent.row[0];
  assert.equal(row.type, 'feedback'); assert.equal(row.message, 'The chart shows the wrong month'); assert.equal(row.attachments.length, 4); assert.equal(row.email, 'a@b.co', 'email is recorded'); assert(row.user_id, 'user id is recorded');
  assert(row.attachments.every((x) => x.startsWith(row.user_id + '/' + row.id + '/')), JSON.stringify(row.attachments)); assert(sent.ups.length === 4 && sent.ups.every((u) => u.bucket === 'support-attachments' && u.size <= 1048576), 'every file is at most 1 MB: ' + JSON.stringify(sent.ups.map((u) => u.size)));
  assert(row.context.language && row.context.viewport, 'context recorded');
  // bug type, no images; in sample mode it is not sent
  await p.click('.support-btn'); await p.fill('textarea[name=message]', 'It crashed'); await p.click('#dlg button[type=submit]'); await p.waitForFunction(() => !document.querySelector('#dlg[open]')); assert.equal(await p.evaluate(() => window.__log.filter((o) => o.op === 'insert').pop().row.type), 'bug');
  await p.evaluate(() => setDemo(true)); await p.waitForTimeout(400); await p.click('.support-btn'); await p.fill('textarea[name=message]', 'in sample mode'); await p.click('#dlg button[type=submit]'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.__log.filter((o) => o.op === 'insert').length), 2, 'nothing is sent from sample mode'); await p.click('[data-act=close]');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message.slice(0, 400), (e.stack || '').split('\n').filter((l) => l.includes('support.js')).slice(0, 2).join(' | ')); process.exit(1); });
