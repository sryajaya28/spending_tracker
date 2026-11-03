/* Smoke test of a REAL hosted copy of the app (production or staging). Nothing is mocked.
 *
 *   SMOKE_EMAIL=... SMOKE_PASSWORD=... node tests/smoke/smoke.js https://stiver.io [--env production|staging]
 *
 * The credentials belong to a dedicated smoke-test account (never a real user); they come from the environment, never the repo.
 * The test adds two records (an income and an expense marked "SMOKE"), checks they survive a reload (so they reached the database),
 * then deletes them again so the account stays clean. Exit code 0 = all steps passed.
 * Needs the host in the assistant's allowed network domains. */
const { chromium } = require('playwright');
const base = (process.argv[2] || '').replace(/\/$/, '');
const wantEnv = (process.argv.indexOf('--env') > 0 ? process.argv[process.argv.indexOf('--env') + 1] : '') || '';
const email = process.env.SMOKE_EMAIL, password = process.env.SMOKE_PASSWORD;
if (!base || !email || !password) { console.log('usage: SMOKE_EMAIL=.. SMOKE_PASSWORD=.. node tests/smoke/smoke.js <base url> [--env production|staging]'); process.exit(2); }
const tag = 'SMOKE ' + Date.now();
const results = [];
const step = async (name, fn) => { const t = Date.now(); try { await fn(); results.push([true, name, Date.now() - t]); console.log('PASS  ' + name); } catch (e) { results.push([false, name, Date.now() - t, e.message.split('\n')[0]]); console.log('FAIL  ' + name + '  ' + e.message.split('\n')[0]); throw e; } };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 430, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource.*(404|401)/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  // a save may be queued a moment after the click (the app first tries to tag the record), so: wait, let the queue drain, wait again, let the network go quiet
  const idle = () => p.evaluate(() => (window.Cloud && Cloud.idle ? Cloud.idle() : null));
  const settle = async () => { await p.waitForTimeout(900); await idle(); await p.waitForTimeout(700); await idle(); await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); };
  const noJunk = async (where) => { const t = await p.innerText('body'); if (/\bNaN\b|undefined|\[object/.test(t)) throw new Error('"NaN/undefined" visible on ' + where); };
  const openRow = async (text) => { await p.evaluate(() => { location.hash = '#/transactions'; }); await p.waitForSelector('#txn-list'); await p.evaluate(() => document.querySelector('[data-act=days-all]')?.click()); const row = p.locator('#txn-list .day-body .row', { hasText: text }).first(); await row.waitFor({ timeout: 8000 }); return row; };
  let ok = false;
  try {
    await step('landing page loads', async () => { await p.goto(base + '/', { waitUntil: 'load', timeout: 45000 }); await p.waitForSelector('.land', { timeout: 20000 }); });
    // older builds have no ENV label, so fall back to the address
    await step('environment is the expected one', async () => { const e = await p.evaluate(() => (window.STIVER && window.STIVER.ENV) || (/^(www\.)?stiver\.io$/.test(location.hostname) ? 'production' : 'staging')); if (wantEnv && e !== wantEnv) throw new Error('expected ' + wantEnv + ' but the page says ' + e); });
    await step('price/FX service answers', async () => { const s = await p.evaluate(() => fetch('/api/status').then((r) => r.json())); if (!s || s.yahoo === undefined) throw new Error('bad /api/status'); const fx = await p.evaluate(() => fetch('/api/fx').then((r) => r.status)); if (fx !== 200) throw new Error('/api/fx ' + fx); });
    await step('sign in', async () => { await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]'); await p.fill('[name=email]', email); await p.fill('[name=password]', password); await p.click('button[type=submit]'); await p.waitForSelector('.shell', { timeout: 30000 }); await p.waitForTimeout(1200); });
    await step('overview shows without junk values', async () => { await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForTimeout(600); await noJunk('overview'); });
    await step('add an income', async () => { await p.click('[data-act=add-txn]'); await p.waitForSelector('#dlg input[name=amount]'); await p.evaluate(() => document.querySelector('#dlg input[name=type][value=income]').click()); await p.fill('#dlg input[name=amount]', '100000'); await p.fill('#dlg textarea[name=note]', tag + ' income'); await p.click('#dlg button[type=submit]'); await settle(); });
    await step('add an expense', async () => { await p.click('[data-act=add-txn]'); await p.waitForSelector('#dlg input[name=amount]'); await p.fill('#dlg input[name=amount]', '1234'); await p.fill('#dlg textarea[name=note]', tag + ' expense'); await p.click('#dlg button[type=submit]'); await settle(); });
    await step('both records are listed', async () => { await openRow(tag + ' income'); await openRow(tag + ' expense'); });
    await step('records survive a reload (reached the database)', async () => { await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.shell', { timeout: 30000 }); await p.waitForTimeout(1500); await openRow(tag + ' income'); await openRow(tag + ' expense'); });
    await step('main pages open without junk values', async () => { for (const h of ['#/budgets', '#/portfolio', '#/transactions']) { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(700); await noJunk(h); } for (const t of ['savings', 'loan', 'investment', 'lent']) { await p.evaluate((x) => { location.hash = '#/portfolio'; state.ui.pfTab = x; render(); }, t); await p.waitForTimeout(500); await noJunk('portfolio ' + t); } });
    await step('delete the test records (clean up)', async () => { for (const t of [' expense', ' income']) { const row = await openRow(tag + t); await row.click(); await p.waitForSelector('[data-act=delete-txn]'); await p.click('[data-act=delete-txn]'); await settle(); } });
    await step('records are gone after a reload', async () => { await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.shell', { timeout: 30000 }); await p.waitForTimeout(1500); await p.evaluate(() => { location.hash = '#/transactions'; }); await p.waitForTimeout(800); const t = await p.innerText('body'); if (t.includes(tag)) throw new Error('test record still there'); });
    await step('no script errors during the run', async () => { if (errs.length) throw new Error(errs.slice(0, 3).join(' | ')); });
    await step('sign out', async () => { await p.evaluate(() => document.querySelector('[data-act=signout]') ? null : null); await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForSelector('[data-act=signout]'); await p.click('[data-act=signout]'); await p.waitForSelector('.land', { timeout: 15000 }); });
    ok = true;
  } catch (e) { try { await p.screenshot({ path: '/tmp/smoke-fail.png' }); } catch (_) {} }
  await b.close();
  const failed = results.filter((r) => !r[0]).length;
  console.log(`\nSMOKE ${ok && !failed ? 'PASSED' : 'FAILED'}: ${results.filter((r) => r[0]).length}/${results.length} steps passed on ${base}`);
  process.exit(ok && !failed ? 0 : 1);
})();
