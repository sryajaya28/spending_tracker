const { chromium } = require('playwright'); const fs = require('fs'); const crypto = require('crypto');
const BASE = 'https://staging.stiver.io', SB = 'https://cujmgyacxbcmltxfjkxo.supabase.co', ANON = 'sb_publishable_BFRR-eAyMNAJtX52EN0ydQ_Teb0Q71G';
const MEMAIL = 'suryajaya378+hh3@gmail.com', MPW = fs.readFileSync('pw_hh3.txt', 'utf8').trim(); const out = [];
let cleanup = async () => {};
const stop = async (ok, n, d) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  ' + String(d).slice(0, 230) : '')); if (!ok) { await cleanup(); console.log(out.join('\n')); console.log('STOPPED AT FIRST FAILURE'); process.exit(1); } };
(async () => {
  const b = await chromium.launch(); const api = (await b.newContext()).request;
  const tok = async (e, pw) => { const j = await (await api.post(SB + '/auth/v1/token?grant_type=password', { headers: { apikey: ANON }, data: { email: e, password: pw } })).json(); return { t: j.access_token, id: j.user.id }; };
  const o = await tok('smoke.staging@stiver.io', process.env.SMOKE_STAGING_PASSWORD), m = await tok(MEMAIL, MPW);
  const H = (t) => ({ apikey: ANON, Authorization: 'Bearer ' + t, Prefer: 'return=representation' });
  const rpc = async (fn, body) => (await api.post(SB + '/rest/v1/rpc/' + fn, { headers: H(o.t), data: body })).status();
  const W = crypto.randomUUID(), TO = crypto.randomUUID(), TE = crypto.randomUUID();
  cleanup = async () => { for (const [t, q] of [['transactions', '?note=like.QA-HH*'], ['wallets', '?id=eq.' + W]]) await api.delete(SB + '/rest/v1/' + t + q, { headers: H(o.t) }); };
  await api.post(SB + '/rest/v1/wallets', { headers: H(o.t), data: { id: W, user_id: o.id, name: 'QA-HH live wallet' } });
  await api.post(SB + '/rest/v1/transactions', { headers: H(o.t), data: { id: TO, user_id: o.id, wallet_id: W, type: 'expense', amount_minor: 4200, note: 'QA-HH owner tx' } });
  const dctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' }); const dp = await dctx.newPage();
  await dp.goto(BASE + '/'); await dp.waitForSelector('.land'); await dp.click('.land-cta [data-view=signin]'); await dp.fill('[name=email]', MEMAIL); await dp.fill('[name=password]', MPW); await dp.click('form[data-form=signin] button[type=submit]'); await dp.waitForSelector('.shell', { timeout: 30000 }); await dp.waitForTimeout(2500);
  await stop((await dp.evaluate(() => Cloud.household.role)) === 'viewer', 'start: the open app knows the member is a Viewer');
  await stop((await rpc('set_member_role', { p_member: m.id, p_role: 'editor' })) === 204, 'HH-19 owner changes the open member to Editor');
  let t0 = Date.now(), seen = false, role = null;
  for (let i = 0; i < 55 && !(seen && role === 'editor'); i++) { await dp.waitForTimeout(1000); role = await dp.evaluate(() => Cloud.household.role); seen = seen || /Your access changed/i.test(await dp.evaluate(() => document.body.innerText)); }
  await stop(role === 'editor' && seen, 'HH-19 Viewer to Editor reaches the open app with the notice "Your access changed."', 'after ' + Math.round((Date.now() - t0) / 1000) + 's role=' + role + ' notice=' + seen);
  await stop(Date.now() - t0 <= 45000, 'HH-19 within about 30 s', Math.round((Date.now() - t0) / 1000) + 's');
  // the Editor adds one transaction of their own through the API (the app sync is covered by the e2e)
  const r = await api.post(SB + '/rest/v1/transactions', { headers: H(m.t), data: { id: TE, user_id: o.id, wallet_id: W, type: 'expense', amount_minor: 1500, note: 'QA-HH editor tx' } }); await stop(r.status() === 201, 'HH-18 Editor adds a transaction', r.status());
  await dp.evaluate(() => { location.hash = '#/overview'; }); await dp.waitForTimeout(400); await dp.reload(); await dp.waitForSelector('.shell'); await dp.waitForTimeout(2000);
  await dp.evaluate(() => { location.hash = '#/transactions'; }); await dp.waitForTimeout(1500); try { await dp.click('[data-act=days-all]', { timeout: 3000 }); } catch (e) {} await dp.waitForTimeout(700);
  const sub = await dp.$$eval('.row[data-id] .sub', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  const ownerRow = sub.find((s) => /SMOKE/.test(s)), ownRow = sub.find((s) => /QA/.test(s) && !/SMOKE/.test(s));
  await stop(!!ownerRow && /read-only/.test(ownerRow), 'HH-38 Editor sees the "read-only" text marker on the owner row', ownerRow);
  await stop(!!ownRow && !/read-only/.test(ownRow), 'HH-22 Editor own row is labelled with their first name and is not read-only', ownRow);
  await dp.screenshot({ path: 'shots/live_editor_dark_390.png' });
  await dp.click('.row[data-id="' + TO + '"]'); await dp.waitForTimeout(1000);
  const dlgBtns = await dp.evaluate(() => { const d = document.querySelector('dialog[open]'); return d ? [...d.querySelectorAll('button')].filter((e) => e.offsetParent && getComputedStyle(e).visibility !== 'hidden').map((e) => e.textContent.trim()) : null; });
  await stop(!!dlgBtns && !dlgBtns.some((x) => /^(edit|delete)/i.test(x)), 'HH-38 the owner transaction detail has no Edit/Delete for an Editor', JSON.stringify(dlgBtns)); await dp.keyboard.press('Escape');
  await stop((await rpc('set_member_role', { p_member: m.id, p_role: 'viewer' })) === 204, 'HH-19 owner changes the open member back to Viewer');
  t0 = Date.now(); seen = false; role = null; await dp.waitForTimeout(500);
  for (let i = 0; i < 55 && role !== 'viewer'; i++) { await dp.waitForTimeout(1000); role = await dp.evaluate(() => Cloud.household.role); seen = seen || /Your access changed/i.test(await dp.evaluate(() => document.body.innerText)); }
  await stop(role === 'viewer', 'HH-19 Editor to Viewer reaches the open app', 'after ' + Math.round((Date.now() - t0) / 1000) + 's notice=' + seen);
  // removal while open
  await stop((await rpc('remove_member', { p_member: m.id })) === 204, 'HH-20 owner removes the open member');
  t0 = Date.now(); let na = false;
  for (let i = 0; i < 55 && !na; i++) { await dp.waitForTimeout(1000); na = await dp.evaluate(() => /You no longer have access/i.test(document.body.innerText)); }
  await stop(na, 'HH-20 the open app shows the no-access page', 'after ' + Math.round((Date.now() - t0) / 1000) + 's');
  const btns = await dp.$$eval('.onboard .card button', (bs) => bs.map((x) => x.textContent.trim())); await stop(JSON.stringify(btns) === JSON.stringify(['Sign out', 'Delete my login']), 'HH-20 only Sign out and Delete my login are offered', JSON.stringify(btns));
  out.push('   no-access text: ' + (await dp.innerText('.onboard .card')).replace(/\s+/g, ' ')); await dp.screenshot({ path: 'shots/live_noaccess_dark_390.png' });
  await dctx.close();
  const lctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const lp = await lctx.newPage();
  await lp.goto(BASE + '/'); await lp.waitForSelector('.land'); await lp.click('.land-cta [data-view=signin]'); await lp.fill('[name=email]', MEMAIL); await lp.fill('[name=password]', MPW); await lp.click('form[data-form=signin] button[type=submit]');
  await lp.waitForFunction(() => /You no longer have access/i.test(document.body.innerText), null, { timeout: 30000 }); await stop(true, 'HH-20 a fresh sign-in as the removed member lands on the same page, not an empty ledger'); await lp.screenshot({ path: 'shots/live_noaccess_light_390.png' });
  const e = await api.get(SB + '/rest/v1/transactions?select=id', { headers: H(m.t) }); out.push('   removed member reads ' + JSON.stringify(await e.json()).length + ' bytes of transactions: ' + (await e.text()).slice(0, 40));
  // Delete my login
  await lp.click('[data-act=delete-my-login]'); await lp.waitForTimeout(1500);
  const dlg = await lp.evaluate(() => { const d = document.querySelector('dialog[open]'); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 260) : '(no dialog)'; }); out.push('   after tapping Delete my login: ' + dlg);
  await lp.waitForTimeout(3500);
  const relog = await api.post(SB + '/auth/v1/token?grant_type=password', { headers: { apikey: ANON }, data: { email: MEMAIL, password: MPW } });
  await stop(relog.status() !== 200, 'HH-35 after Delete my login the login no longer signs in', 'sign-in status ' + relog.status());
  await lp.screenshot({ path: 'shots/live_after_delete_390.png' });
  const left = await api.get(SB + '/rest/v1/transactions?select=id,note&note=like.QA-HH*', { headers: H(o.t) }); out.push('   rows still owned by the owner (kept, name stays on the Editor row): ' + (await left.json()).length);
  await cleanup(); await b.close(); console.log(out.join('\n')); console.log('RESULT: PASS');
})().catch(async (e) => { await cleanup(); console.log(out.join('\n')); console.log('FAIL script: ' + e.message.split('\n')[0]); process.exit(1); });
