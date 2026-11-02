const { chromium } = require('playwright'); const fs = require('fs'); const assert = require('assert');
/* Overview > Budgets: on wide screens (two-column layout) the other budgets fill the card as far as they fit; never on phones/tablets. */
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/fake_supabase.js', 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:5180/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  // setup skipped, so Overview is the normal one and not the first-run screen
  await p.evaluate(() => { state.ui.onbSkipped = true; D().wallets[0].opening_balance_minor = 100000000; const f = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); }; const m = currentPeriod() + '-01';
    D().budgets.push({ id: uid(), category_id: null, amount_minor: 55000000, currency: 'IDR', start_month: m }); D().categories.filter((c) => c.type === 'expense' && !c.parent_id).slice(0, 8).forEach((c, i) => D().budgets.push({ id: uid(), category_id: c.id, amount_minor: (i + 2) * 1000000, currency: 'IDR', start_month: m }));
    D().occasions.push({ id: uid(), name: 'Bali Trip', amount_minor: 9000000, currency: 'IDR', start: f(10), end: f(14), archived: false }); location.hash = '#/overview'; render(); });
  await p.waitForTimeout(500);
  // in a real account the card beside it (Category trend) is tall; the bare test account's is short, so make it tall
  const tall = (px) => p.evaluate((px) => { document.querySelector('.ov-bud-card').previousElementSibling.style.minHeight = px + 'px'; window.dispatchEvent(new Event('resize')); }, px);
  await tall(560); await p.waitForTimeout(250);
  const info = () => p.evaluate(() => { const box = document.querySelector('.ov-more-in'), rows = box ? [...box.children] : []; const vis = rows.filter((r) => !r.hidden), br = box ? box.getBoundingClientRect() : null;
    return { total: rows.length, shown: vis.length, inside: vis.every((r) => { const x = r.getBoundingClientRect(); return x.bottom <= br.bottom + 1.5; }), shownIsPrefix: vis.length === 0 || rows.slice(0, vis.length).every((r) => !r.hidden), boxDisplay: box ? getComputedStyle(box.parentElement).display : 'none', overall: !!document.querySelector('.ov-bud-card .ov-buds > .bar'), card: document.querySelector('.ov-bud-card').getBoundingClientRect().height }; });
  let w = await info(); assert(w.total === 9 && w.shown >= 1 && w.inside && w.shownIsPrefix && w.overall && w.boxDisplay === 'block', 'wide: ' + JSON.stringify(w));
  // the card keeps its neighbour's height: the budgets do not make the row taller
  const nb = await p.evaluate(() => { const c = document.querySelector('.ov-bud-card'); const o = [...c.parentElement.children].find((x) => x !== c && x.getBoundingClientRect().top === c.getBoundingClientRect().top); return o ? [Math.round(o.getBoundingClientRect().height), Math.round(c.getBoundingClientRect().height)] : null; });
  assert(nb && nb[0] === nb[1], 'same height as the card beside it ' + JSON.stringify(nb));
  await p.screenshot({ path: __dirname + '/out/ov_budgets_wide.png' });
  // a shorter neighbour leaves less room: fewer rows, still whole ones
  await tall(300); await p.waitForTimeout(250); const w2 = await info(); assert(w2.inside && w2.shownIsPrefix && w2.shown <= w.shown, 'short: ' + JSON.stringify(w2));
  // tablet / phone widths: not shown at all
  await p.setViewportSize({ width: 1000, height: 900 }); await p.waitForTimeout(250); assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.ov-more')).display), 'none', 'one-column layout: hidden');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(250); assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.ov-more')).display), 'none', 'phone: hidden'); assert(!(await p.innerText('.ov-bud-card')).includes('Bali Trip'), 'phone shows only the overall budget');
  console.log('ok', JSON.stringify(errs), JSON.stringify(w), JSON.stringify(w2)); await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
