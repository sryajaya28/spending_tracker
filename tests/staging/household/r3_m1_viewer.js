const { chromium } = require('playwright'); const fs = require('fs'); const crypto = require('crypto');
const SB = 'https://cujmgyacxbcmltxfjkxo.supabase.co', ANON = 'sb_publishable_BFRR-eAyMNAJtX52EN0ydQ_Teb0Q71G'; const st = JSON.parse(fs.readFileSync('state.json'));
const TOK = fs.readFileSync('m1_tok.txt', 'utf8').trim(), EMAIL = st.m1 + '@mailinator.com'; const pw = 'Qa' + crypto.randomBytes(8).toString('hex') + '!'; fs.writeFileSync('m1_pw.txt', pw, { mode: 0o600 });
const out = []; let bad = 0; const rec = (ok, n, d) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  ' + String(d).slice(0, 230) : '')); if (!ok) bad++; };
const WRITE = '(^|\\s)(\\+|add|edit|delete|new|remove|archive|restore|transfer|buy|sell|invest|repay|pay)(\\s|$)';
(async () => {
  const b = await chromium.launch(); const api = (await b.newContext()).request;
  const o = await (await api.post(SB + '/auth/v1/token?grant_type=password', { headers: { apikey: ANON }, data: { email: 'smoke.staging@stiver.io', password: process.env.SMOKE_STAGING_PASSWORD } })).json();
  const H = { apikey: ANON, Authorization: 'Bearer ' + o.access_token, Prefer: 'return=representation' }; const W = crypto.randomUUID(), TO = crypto.randomUUID();
  const seed = [await api.post(SB + '/rest/v1/wallets', { headers: H, data: { id: W, user_id: o.user.id, name: 'QA-HH r3 wallet' } }), await api.post(SB + '/rest/v1/transactions', { headers: H, data: { id: TO, user_id: o.user.id, wallet_id: W, type: 'expense', amount_minor: 4200, note: 'QA-HH r3 owner tx' } }), await api.post(SB + '/rest/v1/manual_prices', { headers: H, data: { user_id: o.user.id, symbol: 'QAHHR3', price_usd: 1 } })];
  rec(seed.every((r) => r.status() === 201), 'seed owner wallet, transaction and a manual price', seed.map((r) => r.status()).join('/')); st.W = W; st.TO = TO; fs.writeFileSync('state.json', JSON.stringify(st));
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const writes = []; const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('request', (r) => { if (/rest\/v1/.test(r.url()) && ['POST', 'PATCH', 'DELETE', 'PUT'].includes(r.method()) && !/rpc\//.test(r.url())) writes.push(r.method() + ' ' + r.url().replace(/^.*rest\/v1\//, '').slice(0, 50)); });
  await p.goto('https://staging.stiver.io/join#t=' + TOK); await p.waitForSelector('[data-form=join]', { timeout: 20000 });
  rec(/Viewer/.test(await p.textContent('.join-card')), 'HH-11 join page shows the role Viewer');
  await p.fill('[name=name]', 'QA Member'); await p.fill('[name=password]', pw); await p.check('[name=agree]'); await p.click('[data-send]'); await p.waitForSelector('.shell', { timeout: 40000 }); rec(true, 'HH-12 join through the real page signs the invitee in');
  let toast = false; for (let i = 0; i < 24; i++) { await p.waitForTimeout(500); toast = toast || await p.evaluate(() => /Couldn.t save/.test(document.body.innerText)); }
  rec(!toast && writes.length === 0, 'bug 2: a household with a manual price: no save-error toast, no write from the Viewer app', 'toast=' + toast + ' writes=' + JSON.stringify(writes));
  rec((await p.evaluate(() => Cloud.household.role)) === 'viewer', 'the app knows the member is a Viewer');
  for (const v of ['overview', 'transactions', 'budgets', 'portfolio']) {
    await p.evaluate((x) => { location.hash = '#/' + x; }, v); await p.waitForTimeout(1400);
    const hits = await p.evaluate((src) => { const re = new RegExp(src, 'i'); return [...document.querySelectorAll('button,a,[role=button],[data-act]')].filter((e) => e.offsetParent && getComputedStyle(e).visibility !== 'hidden' && re.test(((e.getAttribute('aria-label') || '') + ' ' + (e.textContent || '') + ' ' + (e.getAttribute('data-act') || '')).trim().replace(/\s+/g, ' '))).map((e) => (e.getAttribute('data-act') || '-') + '|' + (e.textContent || '').trim().slice(0, 24)); }, WRITE);
    rec(hits.length === 0, 'bug 1: Viewer sees no visible write control on ' + v, JSON.stringify(hits)); if (v === 'budgets' || v === 'transactions') await p.screenshot({ path: 'shots/r3_viewer_' + v + '_light.png' });
  }
  const bar = await p.evaluate(() => [...document.querySelector('.bottom-nav').children].map((e) => ({ t: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 12), w: Math.round(e.getBoundingClientRect().width), v: getComputedStyle(e).visibility })));
  const ws = bar.filter((x) => x.v !== 'hidden').map((x) => x.w); rec(bar.length === 4 && Math.max(...ws) - Math.min(...ws) <= 2, 'bottom bar of a real Viewer: four equal tabs, no empty slot', bar.map((x) => x.t + ':' + x.w).join(' '));
  await p.screenshot({ path: 'shots/r3_viewer_bar_light.png', clip: { x: 0, y: 744, width: 390, height: 100 } });
  await p.evaluate(() => { location.hash = '#/transactions'; }); await p.waitForTimeout(1400); try { await p.click('[data-act=days-all]', { timeout: 3000 }); } catch (e) {} await p.waitForTimeout(600);
  await p.click('.row[data-id="' + TO + '"]'); await p.waitForTimeout(1000);
  const dlg = await p.evaluate(() => { const d = document.querySelector('dialog[open]'); return d ? { t: d.innerText.replace(/\s+/g, ' ').slice(0, 200), b: [...d.querySelectorAll('button')].filter((e) => e.offsetParent && getComputedStyle(e).visibility !== 'hidden').map((e) => e.textContent.trim()) } : null; });
  rec(!!dlg && !dlg.b.some((x) => /^(edit|delete)/i.test(x)) && /Added by/.test(dlg.t), 'HH-17/23 detail: no Edit/Delete, shows Added by', JSON.stringify(dlg)); await p.keyboard.press('Escape');
  rec(errs.length === 0, 'no script errors', JSON.stringify(errs).slice(0, 120));
  // dark
  await ctx.close(); const dctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' }); const dp = await dctx.newPage();
  await dp.goto('https://staging.stiver.io/'); await dp.waitForSelector('.land'); await dp.click('.land-cta [data-view=signin]'); await dp.fill('[name=email]', EMAIL); await dp.fill('[name=password]', pw); await dp.click('form[data-form=signin] button[type=submit]'); await dp.waitForSelector('.shell', { timeout: 30000 }); await dp.waitForTimeout(2500);
  await dp.evaluate(() => { location.hash = '#/budgets'; }); await dp.waitForTimeout(1400); await dp.screenshot({ path: 'shots/r3_viewer_budgets_dark.png' });
  rec((await dp.evaluate(() => [...document.querySelector('.bottom-nav').children].length)) === 4, 'HH-13 sign-in again with email and password lands in the household (dark), 4-tab bar');
  await b.close(); console.log(out.join('\n')); console.log(bad ? 'RESULT: FAIL (' + bad + ')' : 'RESULT: PASS');
})().catch((e) => { console.log(out.join('\n')); console.log('FAIL script: ' + e.message.split('\n')[0]); process.exit(1); });
