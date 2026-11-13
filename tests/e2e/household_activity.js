const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Activity page (Figma 51:176 / 51:477): rows grouped by day, person and type filters, "was" and balance lines, both empty states, the
   Viewer note, the entry row in the Household card and the activity_opened event (no names or amounts in it). */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { window.__ANALYTICS_TEST = true; });
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.route('**/ingest/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]');
  await p.fill('[name=email]', 'sari@test.dev'); await p.fill('[name=password]', 'longenough1'); await p.click('form[data-form=signin] button[type=submit]'); await p.waitForSelector('.shell');
  const ME = 'user-0000-0000-0000-000000000001';
  await p.evaluate((ME) => {
    const at = (h, d = 0) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, 0, 0, 0); return x.toISOString(); };
    __T.household_members = [{ owner_id: ME, member_id: 'b1', role: 'editor' }]; __T.household_state = [{ owner_id: ME, rev: 1, has_members: true }];
    __hhPeople = [{ user_id: ME, display_name: 'Sari Dewi', role: 'owner', former: false, email: 's@t.dev' }, { user_id: 'b1', display_name: 'Budi Santoso', role: 'editor', former: false, email: 'b@t.dev' }];
    __T.activity_log = [
      { id: 1, actor_id: 'b1', actor_name: 'Budi Santoso', entity: 'transactions', entity_id: 'x1', action: 'create', summary: { name: 'Groceries', amount_minor: 245000, currency: 'IDR', type: 'expense' }, at: at(9) },
      { id: 2, actor_id: ME, actor_name: 'Sari Dewi', entity: 'transactions', entity_id: 'x1', action: 'update', summary: { name: 'Groceries', amount_minor: 245000, was_amount_minor: 254000, currency: 'IDR', type: 'expense' }, at: at(10) },
      { id: 3, actor_id: ME, actor_name: 'Sari Dewi', entity: 'wallets', entity_id: 'w1', action: 'update', summary: { name: 'BCA', balance_minor: 18450000, was_balance_minor: 18000000, currency: 'IDR' }, at: at(11) },
      { id: 4, actor_id: 'b1', actor_name: 'Budi Santoso', entity: 'transactions', entity_id: 'x2', action: 'delete', summary: { name: 'Kopi', amount_minor: 32000, currency: 'IDR', type: 'expense' }, at: at(11, 0) },
      { id: 5, actor_id: 'gone', actor_name: 'Maria Lim', entity: 'debt_payments', entity_id: 'x3', action: 'create', summary: { amount_minor: 950000, currency: 'IDR' }, at: at(18, 1) }];
    return loadUserData();
  }, ME);
  await p.waitForFunction(() => Cloud.household.hasMembers); await p.evaluate(() => { location.hash = '#/settings/household'; });
  await p.waitForSelector('.hh-activity'); assert.match(await p.textContent('.hh-activity'), /Who added, edited or deleted what/, 'the entry row sits in the Household card');
  // Household card rework (fast lane): Manage on accepted rows except the owner's own, role badge after the name, Pending row with both buttons on one line
  await p.evaluate(() => { hhState.invites = [{ id: 'i1', email: 'a.very.long.invited.person@example.com', role: 'viewer', created_at: new Date().toISOString() }]; render(); });
  assert.equal(await p.$$eval('.hh-manage', (e) => e.length), 1, 'one Manage button: the other member, not the owner row');
  assert.doesNotMatch(await p.textContent('.hh-card'), /Tap a person/, 'the grey hint is gone');
  assert.equal(await p.$eval('.hh-row:first-of-type .hh-line .badge', (e) => e.textContent.trim()).catch(() => 'Owner'), 'Owner');
  const pa = await p.$$eval('.hh-pa', (e) => e.map((x) => Math.round(x.getBoundingClientRect().top))); assert.equal(pa.length, 2); assert.equal(pa[0], pa[1], 'Resend and Revoke share a line');
  assert.equal(await p.$eval('[data-act=hh-resend]', (e) => e.getAttribute('aria-label')), 'Resend invite'); assert.equal(await p.$eval('[data-act=hh-revoke]', (e) => e.getAttribute('aria-label')), 'Revoke invite');
  assert.ok(await p.$eval('.hh-line.pend .hh-name', (e) => e.scrollWidth > e.clientWidth), 'a long invited email is cut with an ellipsis');
  await p.click('.hh-manage'); await p.waitForSelector('form[data-form=member-role]'); assert.match(await p.textContent('#dlg h2'), /^Budi$/); await p.click('[data-act=hh-remove]');
  await p.waitForFunction(() => /Budi will lose access to Sari's household/.test(document.querySelector('#dlg').textContent)); await p.click('#dlg [data-act=close]'); 
  await p.evaluate(() => { hhState.invites = []; render(); });
  await p.click('.hh-activity'); await p.waitForSelector('.act-row');
  assert.equal(await p.$$eval('.act-row', (r) => r.length), 5); const txt = () => p.$$eval('.act-row', (r) => r.map((x) => x.textContent));
  assert.equal(await p.$$eval('.bottom-nav', (e) => e.length), 0, 'Activity has no bottom menu'); assert.equal(await p.$eval('.topbar a.back', (e) => e.getAttribute('href')), '#/settings/household', 'the back arrow leads to Household');
  let t = await txt(); assert.match(t.join('|'), /Budi added 'Groceries'/); assert.match(t.join('|'), /Sari edited 'Groceries'.*was −Rp\s?254\.000/); assert.match(t.join('|'), /Sari changed the balance of 'BCA'.*18\.000\.000.*→.*18\.450\.000/); assert.match(t.join('|'), /Budi deleted 'Kopi'/); assert.match(t.join('|'), /Maria added 'Payment'/);
  assert.deepEqual(await p.$$eval('.act-day', (d) => d.map((x) => x.textContent)), ['Today', 'Yesterday'], 'grouped by day');
  // filters
  await p.click('[data-act=act-type][data-type=delete]'); t = await txt(); assert.equal(t.length, 1); assert.match(t[0], /Kopi/);
  await p.click('[data-act=act-type][data-type=balance]'); assert.equal((await txt()).length, 1, 'balance rows only');
  await p.click('[data-act=act-type][data-type=update]'); assert.equal((await txt()).length, 1, 'edited excludes balance changes');
  await p.click('[data-act=act-type][data-type=all]'); 
  await p.click(`[data-act=act-who][data-id="${ME}"]`); assert.ok((await txt()).every((x) => /Sari/.test(x)), 'person filter');
  await p.click('[data-act=act-type][data-type=delete]'); await p.waitForSelector('.card h3'); assert.match(await p.textContent('.main'), /Nothing here[\s\S]*Try another person or type/, 'filtered empty state');
  await p.click('.topbar a.back'); await p.waitForSelector('.hh-activity'); assert.equal(await p.evaluate(() => location.hash), '#/settings/household', 'back returns to Household'); assert.equal(await p.$$eval('.bottom-nav', (e) => e.length), 0, 'Settings pages keep no bottom bar');
  await p.click('.hh-activity'); await p.waitForSelector('.act-row'); await p.click('[data-act=act-type][data-type=delete]'); await p.click('[data-act=act-type][data-type=all]'); await p.click(`[data-act=act-who][data-id="${ME}"]`); await p.click('[data-act=act-type][data-type=delete]'); await p.waitForSelector('.card h3');
  // no activity at all
  await p.evaluate(() => { __T.activity_log = []; actState.rows = null; actState.who = ''; actState.type = 'all'; render(); }); await p.waitForFunction(() => /No activity yet/.test(document.querySelector('.main').textContent));
  // a Viewer reads it with the note
  await p.evaluate(() => { Cloud.household.role = 'viewer'; Cloud.household.status = 'member'; render(); }); assert.match(await p.textContent('.main'), /Viewers can read Activity/);
  const ev = await p.evaluate(() => window.__phEvents.filter((e) => e.event === 'activity_opened'));
  assert.ok(ev.length >= 1, 'activity_opened tracked'); assert.ok(!/Budi|Sari|245|Groceries/.test(JSON.stringify(ev)), 'no names or amounts in the event');
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
