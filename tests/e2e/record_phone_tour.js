const { chromium } = require('playwright'); const fs = require('fs');
/* records the PHONE-size tour for the landing page phone card (390x844); encode with encode_phone_demo.sh */
const OUT = __dirname + '/video-phone';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: OUT, size: { width: 390, height: 844 } }, deviceScaleFactor: 1 });
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
  await p.addStyleTag({ content: '.demo-bar { display: none !important; }' });
  await p.evaluate(() => { location.hash = '#/overview'; }); await p.waitForTimeout(600);
  await p.mouse.move(195, 420);
  const START = Date.now() - t0;
  const pause = (ms) => p.waitForTimeout(ms);
  const go = async (sel, opts = {}) => { const el = await p.waitForSelector(sel); await el.scrollIntoViewIfNeeded(); const bx = await el.boundingBox(); await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2, { steps: 16 }); await pause(opts.beforeClick || 200); await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); };
  // 1. overview, then hide and show the balance
  await pause(1500);
  await go('[data-act=toggle-hide-balance]'); await pause(1500); await go('[data-act=toggle-hide-balance]'); await pause(800);
  await p.mouse.wheel(0, 500); await pause(1500); await p.evaluate(() => window.scrollTo(0, 0)); await pause(500);
  // 2. add an expense
  await go('.nav-add'); await p.waitForSelector('#dlg[open]'); await pause(700);
  await p.type('input[name=amount]', '85000', { delay: 140 }); await pause(500);
  await go('select[name=category]', { beforeClick: 250 }); await p.waitForSelector('.cs-pop'); await pause(700);
  await go('.cs-search'); await p.type('.cs-search', 'cof', { delay: 160 }); await pause(700);
  await go('.cs-opt:has-text("Coffee")'); await pause(600);
  await go('#dlg button[type=submit]'); await pause(1800);
  // 3. activity, budgets, portfolio
  await go('.bottom-nav a[href="#/transactions"]'); await pause(1800);
  await go('.bottom-nav a[href="#/budgets"]'); await pause(1800); await p.mouse.wheel(0, 380); await pause(1300);
  await go('.bottom-nav a[href="#/portfolio"]'); await pause(1800); await p.mouse.wheel(0, 500); await pause(1300);
  await p.evaluate(() => window.scrollTo(0, 0)); await go('[data-act=pf-tab][data-tab=loan]'); await pause(1500);
  await go('[data-act=pf-tab][data-tab=investment]'); await pause(1500);
  await go('.bottom-nav a[href="#/overview"]'); await pause(1800);
  const END = Date.now() - t0;
  await ctx.close(); await b.close();
  const vids = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm')).map((f) => ({ f, t: fs.statSync(OUT + '/' + f).mtimeMs })).sort((a, b) => b.t - a.t);
  fs.writeFileSync(OUT + '/meta.json', JSON.stringify({ file: vids[0].f, start: START / 1000, end: END / 1000 }));
  console.log('recorded', vids[0].f, 'tour', (START / 1000).toFixed(1), '->', (END / 1000).toFixed(1));
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
