const { chromium } = require('playwright'); const fs = require('fs'); const crypto = require('crypto');
const SB = 'https://cujmgyacxbcmltxfjkxo.supabase.co', ANON = 'sb_publishable_BFRR-eAyMNAJtX52EN0ydQ_Teb0Q71G'; const st = JSON.parse(fs.readFileSync('state.json'));
const EMAIL = st.m1 + '@mailinator.com', PW = fs.readFileSync('m1_pw.txt', 'utf8').trim(); const out = []; let bad = 0; const rec = (ok, n, d) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  ' + String(d).slice(0, 230) : '')); if (!ok) bad++; };
(async () => {
  const b = await chromium.launch(); const api = (await b.newContext()).request;
  const tk = async (e, p) => { const j = await (await api.post(SB + '/auth/v1/token?grant_type=password', { headers: { apikey: ANON }, data: { email: e, password: p } })).json(); return { t: j.access_token, id: j.user.id }; };
  const o = await tk('smoke.staging@stiver.io', process.env.SMOKE_STAGING_PASSWORD), m = await tk(EMAIL, PW); const H = (t) => ({ apikey: ANON, Authorization: 'Bearer ' + t, Prefer: 'return=representation' });
  st.muid = m.id; fs.writeFileSync('state.json', JSON.stringify(st)); const rpc = async (fn, body) => (await api.post(SB + '/rest/v1/rpc/' + fn, { headers: H(o.t), data: body })).status();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })).newPage();
  await p.goto('https://staging.stiver.io/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', EMAIL); await p.fill('[name=password]', PW); await p.click('form[data-form=signin] button[type=submit]'); await p.waitForSelector('.shell', { timeout: 30000 }); await p.waitForTimeout(2500);
  rec((await rpc('set_member_role', { p_member: m.id, p_role: 'editor' })) === 204, 'HH-19 owner promotes the open member to Editor');
  const t0 = Date.now(); let seen = false, role = null; for (let i = 0; i < 55 && !(seen && role === 'editor'); i++) { await p.waitForTimeout(1000); role = await p.evaluate(() => Cloud.household.role); seen = seen || /Your access changed/i.test(await p.evaluate(() => document.body.innerText)); }
  rec(role === 'editor' && seen && Date.now() - t0 <= 45000, 'HH-19 reaches the open app with "Your access changed."', Math.round((Date.now() - t0) / 1000) + 's role=' + role + ' notice=' + seen);
  await p.waitForTimeout(1200);
  const bar = await p.evaluate(() => [...document.querySelector('.bottom-nav').children].filter((e) => getComputedStyle(e).visibility !== 'hidden').map((e) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 12)));
  rec(bar.length === 5 && bar.includes('Add'), 'the Editor bottom bar is back to five slots with the raised Add (without reloading)', bar.join(' / '));
  const TE = crypto.randomUUID(); const r = await api.post(SB + '/rest/v1/transactions', { headers: H(m.t), data: { id: TE, user_id: o.id, wallet_id: st.W, type: 'expense', amount_minor: 1500, note: 'QA-HH r3 editor tx' } }); rec(r.status() === 201, 'HH-18 Editor adds a transaction', r.status());
  await p.reload(); await p.waitForSelector('.shell'); await p.waitForTimeout(2000); await p.evaluate(() => { location.hash = '#/transactions'; }); await p.waitForTimeout(1500); try { await p.click('[data-act=days-all]', { timeout: 3000 }); } catch (e) {} await p.waitForTimeout(700);
  const sub = await p.$$eval('.row[data-id] .sub', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim())); const ownerRow = sub.find((s) => /SMOKE/.test(s)), ownRow = sub.find((s) => /QA Member|· QA/.test(s) && !/SMOKE/.test(s));
  rec(!!ownerRow && /read-only/.test(ownerRow), 'HH-38 "read-only" text marker on the owner row', ownerRow); rec(!!ownRow && !/read-only/.test(ownRow), 'HH-22 own row: first-name label, not read-only', ownRow);
  await p.screenshot({ path: 'shots/r3_editor_txns_dark.png' }); await b.close(); console.log(out.join('\n')); console.log(bad ? 'RESULT: FAIL (' + bad + ')' : 'RESULT: PASS');
})().catch((e) => { console.log(out.join('\n')); console.log('FAIL script: ' + e.message.split('\n')[0]); process.exit(1); });
