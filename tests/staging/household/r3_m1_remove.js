const { chromium } = require('playwright'); const fs = require('fs');
const SB = 'https://cujmgyacxbcmltxfjkxo.supabase.co', ANON = 'sb_publishable_BFRR-eAyMNAJtX52EN0ydQ_Teb0Q71G'; const st = JSON.parse(fs.readFileSync('state.json'));
const EMAIL = st.m1 + '@mailinator.com', PW = fs.readFileSync('m1_pw.txt', 'utf8').trim(); const out = []; let cleanup = async () => {};
const stop = async (ok, n, d) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  ' + String(d).slice(0, 260) : '')); if (!ok) { console.log(out.join('\n')); console.log('STOPPED AT FIRST FAILURE'); process.exit(1); } };
(async () => {
  const b = await chromium.launch(); const api = (await b.newContext()).request;
  const tk = async (e, p) => { const r = await api.post(SB + '/auth/v1/token?grant_type=password', { headers: { apikey: ANON }, data: { email: e, password: p } }); return { s: r.status(), j: await r.json() }; };
  const o = (await tk('smoke.staging@stiver.io', process.env.SMOKE_STAGING_PASSWORD)).j; const H = (t) => ({ apikey: ANON, Authorization: 'Bearer ' + t, Prefer: 'return=representation' });
  const rpc = async (fn, body) => (await api.post(SB + '/rest/v1/rpc/' + fn, { headers: H(o.access_token), data: body })).status();
  const inv = async (email) => { const r = await api.post(SB + '/functions/v1/invite-member', { headers: H(o.access_token), data: { email, role: 'viewer' } }); return await r.json(); };
  const dctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' }); const p = await dctx.newPage();
  await p.goto('https://staging.stiver.io/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', EMAIL); await p.fill('[name=password]', PW); await p.click('form[data-form=signin] button[type=submit]'); await p.waitForSelector('.shell', { timeout: 30000 }); await p.waitForTimeout(2500);
  await stop((await p.evaluate(() => Cloud.household.role)) === 'editor', 'start: the open app is an Editor session');
  await stop((await rpc('remove_member', { p_member: st.muid })) === 204, 'HH-20 owner removes the member while their app is open');
  const t0 = Date.now(); let na = false; for (let i = 0; i < 70 && !na; i++) { await p.waitForTimeout(1000); na = await p.evaluate(() => /You no longer have access/i.test(document.body.innerText)); }
  await stop(na, 'BUG 4: the open app reaches the no-access page by itself (no reload, no tap)', 'after ' + Math.round((Date.now() - t0) / 1000) + ' s'); await stop(Date.now() - t0 <= 45000, 'HH-20 within about 30 s (one poll)', Math.round((Date.now() - t0) / 1000) + ' s');
  const btns = await p.$$eval('.onboard .card button', (bs) => bs.map((x) => x.textContent.trim())); await stop(JSON.stringify(btns) === JSON.stringify(['Sign out', 'Delete my login']), 'HH-20 only Sign out and Delete my login are offered', JSON.stringify(btns));
  out.push('   no-access text: ' + (await p.innerText('.onboard .card')).replace(/\s+/g, ' ')); await p.screenshot({ path: 'shots/r3_noaccess_dark.png' });
  // HH-36 first half: the departed member's email still has a login, so it cannot be invited
  const a = await inv(EMAIL); await stop(a.result === 'cannot_invite', 'HH-36 before Delete my login: the departed email is refused with the generic answer', JSON.stringify(a));
  // confirmation: Cancel then confirm
  await p.click('[data-act=delete-my-login-ask]'); await p.waitForTimeout(800);
  const d1 = await p.evaluate(() => { const d = document.querySelector('dialog[open]'); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 200) : null; }); await stop(!!d1 && /Delete your login\?/.test(d1), 'HH-35 Delete my login asks first, naming what is deleted', d1); await p.screenshot({ path: 'shots/r3_confirm_dark.png' });
  await p.click('dialog[open] button:has-text("Cancel")'); await p.waitForTimeout(1000); const still = await tk(EMAIL, PW);
  await stop(still.s === 200 && /You no longer have access/.test(await p.innerText('body')), 'HH-35 Cancel deletes nothing (login still signs in, page unchanged)', 'sign-in status ' + still.s);
  await p.click('[data-act=delete-my-login-ask]'); await p.waitForTimeout(800); await p.click('dialog[open] button:has-text("Delete my login")'); await p.waitForTimeout(5000);
  const gone = await tk(EMAIL, PW); await stop(gone.s !== 200, 'HH-35 confirming deletes the login (it no longer signs in)', 'sign-in status ' + gone.s);
  out.push('   page after deleting: ' + (await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 110)))); await p.screenshot({ path: 'shots/r3_after_delete_dark.png' });
  // HH-26: the past entry keeps the member's name; HH-36 second half: the email can now be invited
  const r = await api.get(SB + '/rest/v1/transactions?note=eq.QA-HH%20r3%20editor%20tx&select=id,created_by', { headers: H(o.access_token) }); const tx = await r.json();
  const pp = await (await api.post(SB + '/rest/v1/rpc/household_people', { headers: H(o.access_token), data: {} })).json(); const former = pp.find((x) => x.display_name === 'QA Member');
  await stop(tx.length === 1, 'HH-26 the member\'s transaction is still there after the login is gone', JSON.stringify(tx).slice(0, 80)); out.push('   household_people entry for the member: ' + JSON.stringify(former ? { name: former.display_name, role: former.role, former: former.former } : null));
  const a2 = await inv(EMAIL); await stop(a2.result === 'ok', 'HH-36 after Delete my login the same email can be invited again', JSON.stringify(a2)); st.reinvite = a2.invite_id; fs.writeFileSync('state.json', JSON.stringify(st));
  await b.close(); console.log(out.join('\n')); console.log('RESULT: PASS');
})().catch((e) => { console.log(out.join('\n')); console.log('FAIL script: ' + e.message.split('\n')[0]); process.exit(1); });
