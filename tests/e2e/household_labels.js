const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* A household member's view: who submitted each transaction (first name in the subline), "read-only" on other people's rows for an Editor,
   a read-only detail with "Added by", currency/period locked, Leave instead of Invite, and a Viewer who can open details but not add. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]');
  await p.fill('[name=email]', 'budi@test.dev'); await p.fill('[name=password]', 'longenough1'); await p.click('form[data-form=signin] button[type=submit]'); await p.waitForSelector('.shell');
  const ME = 'user-0000-0000-0000-000000000001', OWNER = 'owner-0000-0000-0000-000000000009';
  await p.evaluate(({ ME, OWNER }) => {
    const today = new Date().toISOString().slice(0, 10), w = __T.wallets[0].id, now = new Date().toISOString();
    __T.profiles[0].household_status = 'member';
    __T.household_members = [{ owner_id: OWNER, member_id: ME, role: 'editor' }]; __T.household_state = [{ owner_id: OWNER, rev: 3, has_members: true }];
    __hhPeople = [{ user_id: OWNER, display_name: 'Sari Dewi', role: 'owner', former: false, email: 'sari@test.dev' }, { user_id: ME, display_name: 'Budi Santoso', role: 'editor', former: false, email: 'budi@test.dev' }, { user_id: 'gone', display_name: 'Maria Lim', role: 'former', former: true, email: null }];
    const tx = (id, note, by) => ({ id, wallet_id: w, category_id: null, type: 'expense', amount_minor: 5000, currency: 'IDR', occurred_at: today, note, category_source: 'user', created_at: now, updated_at: now, created_by: by, updated_by: by });
    __T.transactions = [tx('t1', 'Owner groceries', OWNER), tx('t2', 'My coffee', ME), tx('t3', 'Maria lunch', 'gone')];
    return loadUserData();
  }, { ME, OWNER });
  await p.waitForFunction(() => Cloud.household.status === 'member'); await p.evaluate(() => { location.hash = '#/transactions'; }); await p.waitForSelector('[data-act=days-all]'); await p.click('[data-act=days-all]'); await p.waitForSelector('.row[data-id=t1]', { state: 'visible' });
  const sub = (id) => p.$eval(`.row[data-id=${id}] .sub`, (e) => e.textContent);
  assert.match(await sub('t1'), /Sari/); assert.match(await sub('t1'), /read-only/, "an Editor sees read-only on the owner's row");
  assert.match(await sub('t2'), /Budi/); assert.doesNotMatch(await sub('t2'), /read-only/, 'their own row is editable');
  assert.match(await sub('t3'), /Maria/, "a removed member's entry keeps their name"); assert.match(await sub('t3'), /read-only/);
  // read-only detail for the owner's row; the edit form for their own
  await p.click('.row[data-id=t1]'); await p.waitForSelector('#dlg[open] .hh-who-line'); assert.equal(await p.$('#dlg form[data-form=txn]'), null, 'no edit form on another person\'s entry'); assert.match(await p.textContent('#dlg .hh-who-line'), /Added by Sari/); await p.click('#dlg [data-act=close]');
  await p.click('.row[data-id=t2]'); await p.waitForSelector('#dlg form[data-form=txn]'); await p.click('#dlg [data-act=close]');
  // settings: Leave instead of Invite, currency and period locked
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForSelector('.hh-card');
  assert.equal(await p.$('[data-act=hh-invite]'), null, 'no Invite for a member'); assert.equal(await p.$$eval('[data-act=hh-leave]', (e) => e.length), 1);
  assert.equal(await p.$eval('select[data-setting=currency]', (e) => e.disabled), true); assert.equal(await p.$eval('select[data-setting=period]', (e) => e.disabled), true);
  assert.match(await p.textContent('.hh-card'), /Sari/); assert.match(await p.textContent('.hh-card'), /sari@test\.dev/, 'members see names and emails');
  assert.doesNotMatch(await p.textContent('.hh-card'), /Maria/, 'a removed member is not listed as a member');
  // leaving asks first, then calls the server function
  await p.click('[data-act=hh-leave]'); await p.waitForSelector('[data-act=hh-leave-go]'); await p.click('[data-act=hh-leave-go]'); await p.waitForFunction(() => (window.__hhCalls || []).length > 0);
  assert.equal(await p.evaluate(() => window.__hhCalls[0][0]), 'leave_household');
  // a Viewer: details open, nothing can be added
  await p.evaluate((ME) => { __T.household_members[0].role = 'viewer'; __T.profiles[0].household_status = 'member'; return loadUserData(); }, ME); await p.waitForFunction(() => Cloud.household.role === 'viewer');
  await p.evaluate(() => { location.hash = '#/transactions'; }); await p.waitForSelector('[data-act=days-all]'); await p.click('[data-act=days-all]'); await p.waitForSelector('.row[data-id=t2]', { state: 'visible' });
  await p.click('.row[data-id=t2]'); await p.waitForSelector('#dlg[open] .hh-who-line'); assert.equal(await p.$('#dlg form[data-form=txn]'), null, 'a Viewer never gets the edit form'); await p.click('#dlg [data-act=close]');
  await p.evaluate(() => document.querySelector('[data-act=add-txn]') && document.querySelector('[data-act=add-txn]').click());
  assert.equal(await p.evaluate(() => document.querySelector('#dlg').open), false, 'add is blocked for a Viewer');
  // the error contract: HTTP 409 PT409 'household_stale' is the stale-edit case, a guard carries kind and count, plain RLS has no prefix
  const kinds = await p.evaluate(() => [Cloud.classify({ code: 'PT409', message: 'household_stale' }), Cloud.classify({ code: '42501', message: 'household_guard:debt:3' }), Cloud.classify({ code: '42501', message: 'new row violates row-level security policy' }), Cloud.classify({ code: 'HH_GONE' })]);
  assert.deepEqual(kinds, [{ kind: 'stale' }, { kind: 'guard', what: 'debt', n: 3 }, { kind: 'rls' }, { kind: 'gone' }]);
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
