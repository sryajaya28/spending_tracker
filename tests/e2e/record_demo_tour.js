const { chromium } = require('playwright'); const fs = require('fs');
const OUT = __dirname + '/video';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const t0 = Date.now();
  await p.addInitScript(() => {
    // a visible cursor + click ripple for the recording
    window.addEventListener('DOMContentLoaded', () => {
      const c = document.createElement('div'); c.id = 'fakecursor';
      c.style.cssText = 'position:fixed;left:-50px;top:-50px;width:22px;height:22px;border-radius:50%;background:rgba(74,68,198,.35);border:2px solid #4a44c6;box-shadow:0 2px 10px rgba(0,0,0,.25);z-index:99999;pointer-events:none;transform:translate(-50%,-50%);transition:transform .12s, background .12s';
      document.body.appendChild(c);
      document.addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
      document.addEventListener('mousedown', () => { c.style.transform = 'translate(-50%,-50%) scale(.7)'; c.style.background = 'rgba(74,68,198,.7)'; }, true);
      document.addEventListener('mouseup', () => { c.style.transform = 'translate(-50%,-50%) scale(1)'; c.style.background = 'rgba(74,68,198,.35)'; }, true);
    });
  });
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.evaluate(() => { D().profile.name = 'Ari'; return setDemo(true); });
  await p.addStyleTag({ content: '.demo-bar { display: none !important; }' });   // keep the tour clean
  await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForTimeout(600);
  await p.mouse.move(640, 360);
  const START = Date.now() - t0;   // the tour proper starts here; everything before is trimmed
  const pause = (ms) => p.waitForTimeout(ms);
  const go = async (sel, opts = {}) => { const el = await p.waitForSelector(sel); await el.scrollIntoViewIfNeeded(); const bx = await el.boundingBox(); await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2, { steps: 28 }); await pause(opts.beforeClick ?? 350); await p.mouse.down(); await pause(80); await p.mouse.up(); };
  // 1. overview: balance, money flow and the spending donut (hover to read a category)
  await pause(1600);
  const chart = await p.$('#flow-tip, .chart-wrap svg'); if (chart) { const bx = await chart.boundingBox(); for (const f of [0.15, 0.4, 0.65, 0.9]) { await p.mouse.move(bx.x + bx.width * f, bx.y + bx.height * 0.5, { steps: 14 }); await pause(450); } }
  const ring = await p.$eval('.donut svg', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, k: b.width / 260 }; });
  await p.evaluate(() => document.querySelector('.donut').scrollIntoView({ block: 'center' })); const ring2 = await p.$eval('.donut svg', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, k: b.width / 260 }; });
  for (const f of [0.12, 0.45, 0.7, 0.9]) { const a = f * 2 * Math.PI; await p.mouse.move(ring2.x + (130 + 100 * Math.sin(a)) * ring2.k, ring2.y + (130 - 100 * Math.cos(a)) * ring2.k, { steps: 18 }); await pause(900); }
  await p.evaluate(() => window.scrollTo(0, 0)); await pause(400);
  // 2. add an expense: account first, then the category list with search
  await go('[data-act=add-txn][data-type=expense]'); await p.waitForSelector('#dlg[open]'); await pause(700);
  await p.type('input[name=amount]', '85000', { delay: 140 }); await pause(500);
  await go('select[name=category]', { beforeClick: 250 }); await p.waitForSelector('.cs-pop'); await pause(700);
  await go('.cs-search'); await p.type('.cs-search', 'cof', { delay: 160 }); await pause(700);
  await go('.cs-opt:has-text("Coffee")'); await pause(600);
  await go('textarea[name=note]'); await p.type('textarea[name=note]', 'Coffee with the team', { delay: 70 }); await pause(700);
  await go('#dlg button[type=submit]'); await pause(2000);
  // 3. activity: one row per day, tap a day for its transactions
  await go('.sidebar a[href="#/transactions"]'); await pause(1600);
  await go('#txn-list .day-row'); await pause(2000);
  await go('.back-link'); await pause(900);
  // 4. budgets
  await go('.sidebar a[href="#/budgets"]'); await pause(2200);
  await p.mouse.wheel(0, 380); await pause(1500);
  // 5. portfolio: net worth, accounts, history with a time frame
  await go('.sidebar a[href="#/portfolio"]'); await pause(2000);
  await p.mouse.wheel(0, 700); await pause(1500);
  await go('select[data-bind=pfRange]', { beforeClick: 300 }); await p.waitForSelector('.cs-pop'); await pause(700); await go('.cs-opt:has-text("1 year")'); await pause(1700);
  await p.evaluate(() => window.scrollTo(0, 0)); await go('[data-act=pf-tab][data-tab=investment]'); await pause(1800);
  await go('[data-act=pf-tab][data-tab=savings]'); await pause(1200);
  // 6. move money between accounts, with a fee
  await go('[data-act=transfer]'); await p.waitForSelector('form[data-form=transfer]'); await pause(900);
  await p.type('input[name=amount]', '1500000', { delay: 120 }); await pause(500);
  await go('input[name=fee]'); await p.type('input[name=fee]', '6500', { delay: 130 }); await pause(900);
  await go('#dlg button[type=submit]'); await pause(2200);
  // 7. back to the overview
  await go('.sidebar a[href="#/overview"]'); await pause(2600);
  const END = Date.now() - t0;
  await ctx.close(); await b.close();
  const vids = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm')).map((f) => ({ f, t: fs.statSync(OUT + '/' + f).mtimeMs })).sort((a, b) => b.t - a.t);
  fs.writeFileSync(OUT + '/meta.json', JSON.stringify({ file: vids[0].f, start: START / 1000, end: END / 1000 }));
  console.log('recorded', vids[0].f, 'tour', (START / 1000).toFixed(1), '->', (END / 1000).toFixed(1));
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
