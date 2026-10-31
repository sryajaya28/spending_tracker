const { chromium } = require('playwright'); const fs = require('fs');
const LANGTEST = process.argv[2] || 'id';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land');
  await p.evaluate((l) => { setLang(l); render(); }, LANGTEST);
  const texts = [];
  const grab = async (label) => { const t = await p.evaluate(() => { const d = document.querySelector('#dlg[open]'); const roots = d ? [d] : [document.getElementById('app')]; const out = []; roots.forEach((r) => { const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); while (w.nextNode()) { const s = w.currentNode.textContent.trim(); if (s) out.push(s); } r.querySelectorAll('[placeholder],[aria-label],[title]').forEach((e) => ['placeholder', 'aria-label', 'title'].forEach((a) => { const v = e.getAttribute(a); if (v) out.push(v); })); r.querySelectorAll('option').forEach((o) => out.push(o.textContent.trim())); }); return out; }); texts.push(...t.map((x) => [label, x])); };
  await grab('landing');
  await p.click('.land-cta [data-view=signup]'); await p.waitForSelector('[data-form=signup]'); await grab('signup');
  await p.click('[data-view=signin]'); await p.waitForSelector('[data-form=signin]'); await grab('signin');
  await p.click('[data-view=forgot]'); await grab('forgot');
  await p.click('[data-view=signin]'); await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => { D().profile.name = 'Ari'; return setDemo(true); });
  await p.evaluate(() => { D().occasions.push({ id: uid(), name: 'Trip', amount_minor: 5000000, currency: 'IDR', start: '2026-11-06', end: '2026-11-08', archived: false }); D().wallets.push({ id: uid(), name: 'Old', type: 'bank', currency: 'IDR', opening_balance_minor: 0, since: '2026-10', archived: true }); state.ui.archOpen = true; state.ui.catsOpen = true; render(); });
  for (const r of ['overview', 'transactions', 'budgets', 'settings']) { await p.evaluate((x) => { location.hash = '#/' + x; }, r); await p.waitForTimeout(100); await grab(r); }
  for (const t of ['savings', 'investment', 'lent', 'loan']) { await p.evaluate((x) => { location.hash = '#/portfolio'; state.ui.pfTab = x; render(); }, t); await grab('portfolio/' + t); }
  const dialogs = [['add-txn', null], ['add-budget', null], ['add-occasion', null], ['add-cat', null], ['add-wallet', null], ['transfer', null], ['invest', null], ['add-loan', null], ['add-lent', null], ['add-account', null], ['breakdown', null]];
  await p.evaluate(() => { location.hash = '#/overview'; state.ui.pfTab = 'savings'; render(); });
  for (const [act] of dialogs) {
    let sel = `[data-act=${act}]`; if (!(await p.$(sel))) { await p.evaluate((x) => { location.hash = x; }, act === 'add-budget' || act === 'add-occasion' ? '#/budgets' : act === 'add-cat' ? '#/settings' : '#/portfolio'); await p.waitForTimeout(100); await p.evaluate((a) => { if (a === 'add-loan') state.ui.pfTab = 'loan'; if (a === 'add-lent') state.ui.pfTab = 'lent'; if (a === 'add-account') state.ui.pfTab = 'investment'; render(); }, act); }
    const el = await p.$(sel); if (!el) { console.log('no button for', act); continue; }
    await el.scrollIntoViewIfNeeded(); await el.click({ force: true }); await p.waitForTimeout(150); await grab('dialog:' + act); await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  }
  // transaction dialog extras: quick category form open; wallet menu; trade dialog
  await p.evaluate(() => { location.hash = '#/overview'; }); await p.click('[data-act=add-txn][data-type=expense]'); await p.click('[data-act=quick-cat]'); await grab('dialog:quick-cat'); await p.keyboard.press('Escape');
  fs.writeFileSync(__dirname + '/idcrawl.json', JSON.stringify(texts));
  await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
