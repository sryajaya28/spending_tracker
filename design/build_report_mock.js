/* Builds design/report-split-mock.html from the REAL app, so the mock cannot drift from the actual design.
   It runs prototype/ in headless Chromium at 390px with sample data (same fake backend as tests/e2e), takes the app's own HTML for
   Overview, Transactions, Budgets and the chart cards, applies only the new changes on top (see "NEW" below), and inlines the real
   prototype/styles.css (its max-width media queries become container queries so each 390px frame lays out like a phone).
   Run: NODE_PATH=$(npm root -g) node design/build_report_mock.js */
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), PORT = 5181;

(async () => {
  const server = spawn('python3', ['tools/dev_server.py', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  await p.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, 'tests/e2e/fake_supabase.js'), 'utf8') }));
  await p.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await p.route('**/fonts.g*/**', (r) => r.abort());
  await p.goto(`http://127.0.0.1:${PORT}/`); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.waitForSelector('[data-form=signin]');
  await p.fill('[name=email]', 'a@b.co'); await p.fill('[name=password]', 'goodpass1'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.click('[data-act=demo-on]'); await p.waitForSelector('.hero');

  const frames = await p.evaluate(() => {
    const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const off = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
    const iso = (n) => isoDate(off(n));
    // ---- data: today has a few items; Wed, Tue and Sun (3 of the last 7 days) are empty, the other four are filled
    const gapOffs = [-2, -3, -5];
    const exp = D().transactions.filter((t) => t.type === 'expense' && !t.transfer_id);
    D().transactions = D().transactions.filter((t) => !(t.occurred_at >= iso(-7) && t.occurred_at <= iso(0)));
    let k = 0; const clone = (t, at) => D().transactions.unshift({ ...t, id: 'mock' + (k++), occurred_at: at, flow: undefined });
    exp.slice(0, 4).forEach((t) => clone(t, iso(0)));
    const inc = D().transactions.find((t) => t.type === 'income') || exp[0]; if (inc.type === 'income') clone(inc, iso(0));
    [-1, -4, -6, -7].forEach((o, i) => clone(exp[(i + 5) % exp.length], iso(o)));
    D().transactions.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    state.ui.month = currentPeriod();
    const go = (h) => { location.hash = h; render(); return document.querySelector('.main'); };
    const strip = (m) => { m.querySelectorAll('.demo-bar, .setup-strip, .sample-promo').forEach((e) => e.remove()); return m; };
    const cardBy = (m, t) => [...m.querySelectorAll('section.card')].find((c) => ((c.querySelector('h2') || {}).textContent || '').trim() === t);

    // ---- real pieces
    const ov = strip(go('#/overview'));
    const piece = { flow: cardBy(ov, 'Money Flow').outerHTML, spend: cardBy(ov, 'Spending').outerHTML, trend: cardBy(ov, 'Category trend').outerHTML };
    const heroHtml = ov.querySelector('.hero').outerHTML;
    const bud = strip(go('#/budgets'));
    ['[data-act=add-budget]', '[data-act=edit-budget]', '[data-act=add-occasion-budget]'].forEach((s) => bud.querySelectorAll(s).forEach((e) => e.remove()));
    const overall = cardBy(bud, 'Overall budget').outerHTML, bycat = cardBy(bud, 'By category').outerHTML;
    const navHtml = document.querySelector('.bottom-nav').outerHTML;
    const tx = strip(go('#/transactions'));
    const txTopbar = tx.querySelector('.topbar'), txCard = tx.querySelector('section.card').outerHTML;
    go('#/overview');

    // ---- NEW: Report header (title only, no subtitle line), the two-page switch, the bottom bar
    const topbarReport = () => { const t = txTopbar.cloneNode(true); t.querySelector('h1').textContent = 'Report'; t.querySelectorAll('p').forEach((e) => e.remove()); return t.outerHTML; };
    const tabs = (on) => `<div class="tabs report-tabs" role="tablist" aria-label="Report pages"><button type="button" class="tab ${on === 't' ? 'on' : ''}" role="tab" aria-selected="${on === 't'}">Transactions</button><button type="button" class="tab ${on === 'a' ? 'on' : ''}" role="tab" aria-selected="${on === 'a'}">Analysis</button></div>`;
    const nav = (act) => { const d = document.createElement('div'); d.innerHTML = navHtml; const n = d.firstElementChild;
      n.querySelectorAll('a').forEach((a) => { a.classList.remove('active'); a.setAttribute('href', '#'); });
      const tr = n.querySelector('a[href="#"]:nth-of-type(2)'); tr.lastChild.textContent = 'Report'; tr.querySelector('svg').outerHTML = icon('trend');
      n.querySelectorAll('a')[act].classList.add('active'); return n.outerHTML; };
    const day = (n) => { const d = off(n); return { wd: WD[d.getDay()], mon: MO[d.getMonth()], n: d.getDate(), has: D().transactions.some((t) => t.occurred_at === isoDate(d) && !hiddenLeg(t, '')) }; };
    const days = [-7, -6, -5, -4, -3, -2, -1].map((o) => ({ o, ...day(o) }));
    const missing = days.filter((x) => !x.has).reverse();   // newest first

    // ---- NEW: missing-days card (built from the app's card, chip, btn and legend-btn)
    const gapRows = missing.map((x) => `<div class="gap-row" data-day="${x.n}"><div class="gap-dt"><span>${x.wd.slice(0, 3)}</span><b>${x.n}</b></div><div><div class="gap-t">${x.wd}, ${x.n} ${x.mon}</div><button type="button" class="legend-btn gap-skip" data-skip="${x.n}">Nothing to add</button></div><button type="button" class="btn gap-add" data-add="${x.n}">Add</button></div>`).join('');
    const stripHtml = days.map((x) => x.has
      ? `<div class="gap-d ok"><span class="gap-c">${icon('plus').replace('<path d="M12 5v14M5 12h14"/>', '<path d="M5 12l5 5 9-10"/>')}</span><small>${x.wd.slice(0, 3)} ${x.n}</small></div>`
      : `<button type="button" class="gap-d miss" data-day="${x.n}" aria-label="${x.wd} ${x.n} ${x.mon}, nothing recorded. Add transaction"><span class="gap-c">${icon('plus')}</span><small>${x.wd.slice(0, 3)} ${x.n}</small></button>`).join('');
    const gapCard = `<section class="card gap-card" id="gapcard"><div class="card-head"><div class="gap-head"><span class="gap-ico">${icon('calendar')}</span><div><h2 id="gaptitle">${missing.length} days with nothing recorded</h2><p class="muted">Last 7 days. Add what you spent, or mark the day.</p></div></div></div><div class="gap-strip" id="strip">${stripHtml}</div><div id="gaplist">${gapRows}</div></section>`;

    // ---- NEW: Overview = hero without the budget line, today's list (all of today), missing days
    const todayRows = D().transactions.filter((t) => t.occurred_at === todayIso() && !hiddenLeg(t, ''));
    const todayCard = (rows) => rows.length
      ? `<section class="card"><div class="card-head"><div><h2>Today</h2><p class="muted">${WD[new Date().getDay()].slice(0, 3)} ${new Date().getDate()} ${MO[new Date().getMonth()]} · ${countLabel(rows.length)}</p></div><a class="chip" href="#">View all</a></div><div class="list">${rows.map((t) => txnRow(t)).join('')}</div></section>`
      : `<section class="card gap-prompt"><span class="gap-ico">${icon('plus')}</span><h2>Nothing recorded today yet</h2><p class="muted">Add what you spend as you go, and it shows up here.</p><button type="button" class="btn" data-act="add-txn">Add transaction</button></section>`;
    const overview = (empty) => { const m = ov.cloneNode(true); const g = m.querySelector('.grid'); const h = (() => { const d = document.createElement('div'); d.innerHTML = heroHtml; const e = d.firstElementChild; e.querySelectorAll('.hero-bud').forEach((x) => x.remove());
        if (empty) e.querySelector('.hero .amount, .amount').innerHTML = moneyHtmlP(0, cur()); return e.outerHTML; })();
      g.innerHTML = h + todayCard(empty ? [] : todayRows) + (empty ? '' : gapCard);
      return m.outerHTML + nav(0); };
    const report = (a) => `<div class="main">${topbarReport()}${tabs(a ? 'a' : 't')}${a ? `<div class="grid">${overall}${bycat}${piece.spend}${piece.trend}${piece.flow}</div>` : `<div class="stack">${txCard}</div>`}</div>${nav(1)}`;
    const fix = (h) => h.replace(/ id="(?!gapcard|gaptitle|strip|gaplist)[^"]*"/g, '');
    return { f1: fix(overview(false)), f2: fix(report(false)), f3: fix(report(true)), f4: fix(overview(true)) };
  });

  let css = fs.readFileSync(path.join(ROOT, 'prototype/styles.css'), 'utf8')
    .replace(/@media \((max|min)-width: (\d+)px\)/g, '@container phone ($1-width: $2px)');
  const tpl = fs.readFileSync(path.join(__dirname, 'report-split-template.html'), 'utf8');
  const out = tpl.replace('/*REAL_CSS*/', () => css).replace('<!--F1-->', () => frames.f1).replace('<!--F2-->', () => frames.f2).replace('<!--F3-->', () => frames.f3).replace('<!--F4-->', () => frames.f4);
  fs.writeFileSync(path.join(__dirname, 'report-split-mock.html'), out);
  console.log('wrote design/report-split-mock.html', out.length, 'bytes');
  await b.close(); server.kill();
})().catch((e) => { console.error(e); process.exit(1); });
