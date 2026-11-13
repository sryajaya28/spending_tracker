/* Desktop layout pass: the Overview shows Money Flow and By category in a side column on wide screens only
 * (.ov-side), the content column is centred, and nothing overflows sideways at common desktop widths. */
const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  // an expense today (so Today is a list) and an overall plus a category budget (so By category has a row)
  await p.evaluate(() => {
    D().transactions.push({ id: uid(), wallet_id: D().wallets[0].id, category_id: D().categories[0].id, type: 'expense', amount_minor: 1250000, currency: 'IDR', occurred_at: isoDate(new Date()), note: 'Lunch', category_source: 'user', ai_confidence: null, occasion_id: null });
    D().budgets.push({ id: uid(), category_id: null, amount_minor: 55000000, currency: 'IDR', start_month: '2026-01-01' }, { id: uid(), category_id: D().categories[0].id, amount_minor: 1000000, currency: 'IDR', start_month: '2026-01-01' });
    state.ui.onbSeen = false; state.ui.congrats = false; state.ui.onbSkipped = true;   // no first-run or congratulations screen
    location.hash = '#/overview'; render();
  });
  const side = async () => p.evaluate(() => { const s = document.querySelector('.ov-side'); return !!s && getComputedStyle(s).display !== 'none' && s.getBoundingClientRect().width > 0; });
  const overflow = async () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  // phone and tablet: the side column is hidden and the Overview is unchanged
  for (const w of [390, 768, 1100]) { await p.setViewportSize({ width: w, height: 900 }); assert.equal(await side(), false, '.ov-side hidden at ' + w); assert.equal(await overflow(), 0, 'no sideways scroll at ' + w); }
  // desktop: shown, right of the hero, with Money Flow (and its chart) and By category
  for (const w of [1101, 1280, 1366, 1400, 1920]) {
    await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(150);
    assert.equal(await side(), true, '.ov-side shown at ' + w); assert.equal(await overflow(), 0, 'no sideways scroll at ' + w);
    const g = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const h = r('.hero'), s = r('.ov-side'), m = r('.main'); return { heroRight: h.right, sideLeft: s.left, sideRight: s.right, mainRight: m.right, vw: innerWidth, side: document.querySelector('.ov-side').innerText, flow: !!document.querySelector('.ov-side #flow'), chartW: document.querySelector('.ov-side #flow') ? r('.ov-side #flow').width : 0 }; });
    assert(g.sideLeft >= g.heroRight - 1, 'side column sits beside the hero at ' + w + ': ' + JSON.stringify(g));
    assert(g.sideRight <= g.vw, 'side column inside the window at ' + w);
    assert(g.side.includes('Money Flow') && g.side.includes('By category'), 'Money Flow and By category in the side column: ' + g.side);
    assert(g.flow && g.chartW > 0 && g.chartW <= 700, 'Money Flow chart drawn and not blown up at ' + w + ': ' + g.chartW);
  }
  // 1920: the content column is centred, not hugging the sidebar (free space on both sides of it, no unused strip on the right only)
  await p.setViewportSize({ width: 1920, height: 1000 });
  const c = await p.evaluate(() => { const m = document.querySelector('.main').getBoundingClientRect(); return { l: m.left, r: innerWidth - m.right }; });
  assert(c.r > 0 && c.l > 0, 'content column has space on both sides: ' + JSON.stringify(c));
  // Report > Analysis still has its own Money Flow, and the other pages open at desktop width without errors or sideways scroll
  for (const h of ['#/transactions', '#/budgets', '#/portfolio', '#/settings']) { await p.evaluate((h) => { location.hash = h; }, h); await p.waitForTimeout(250); assert.equal(await overflow(), 0, 'no sideways scroll on ' + h + ' at 1920'); }
  await p.evaluate(() => { location.hash = '#/analysis'; render(); }); await p.waitForTimeout(250);
  assert((await p.innerText('main')).includes('Money Flow'), 'Report > Analysis keeps Money Flow');
  await p.evaluate(() => { location.hash = '#/overview'; render(); }); await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(250);
  await p.screenshot({ path: __dirname + '/out/desklayout.png', fullPage: true });
  console.log('ok', JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
