// Renders a .dc.html board in Chromium without the canvas runtime (sc-for / {{holes}} expanded here) and checks it.
// usage: node render.js <file> <frameSelector> <outPrefix> [onlyFrameIndexes e.g. 0,2]
const { chromium } = require('playwright'), fs = require('fs');
const [file, sel, out, only] = process.argv.slice(2);
(async () => {
  const br = await chromium.launch(), pg = await br.newPage({ viewport: { width: 2720, height: 1200 }, deviceScaleFactor: 1 });
  await pg.route('**/support.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
  let fontOk = true; pg.on('requestfailed', (r) => { if (/fonts\./.test(r.url())) fontOk = false; });
  const src = fs.readFileSync(file, 'utf8'), js = src.slice(src.indexOf('class Component'), src.lastIndexOf('</script>'));
  const vals = new Function('class DCLogic{constructor(){this.props={}}}\n' + js + '\nreturn new Component().renderVals()')();
  await pg.goto('file://' + file);
  await pg.evaluate((vals) => {
    const look = (p, s) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), s);
    const subst = (h, s) => h.replace(/\{\{([\w.]+)\}\}/g, (m, p) => { const v = look(p, s); return v === undefined || typeof v === 'object' ? m : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;'); });
    const expand = (el, scope) => { let f; while ((f = el.querySelector('sc-for'))) {
      const list = look(f.getAttribute('list').slice(2, -2), scope) || [], as = f.getAttribute('as'), tpl = f.innerHTML; let html = '';
      for (const it of list) { const s = { ...scope, [as]: it }, d = document.createElement('div'); d.innerHTML = tpl; expand(d, s); html += subst(d.innerHTML, s); }
      f.outerHTML = html; } };
    expand(document.body, vals); document.body.innerHTML = subst(document.body.innerHTML, vals);
  }, vals);
  await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(400);
  const rep = await pg.evaluate((sel) => {
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
    const rgb = (s) => { const m = s.match(/[\d.]+/g).map(Number); return m.length > 3 && m[3] < 1 ? null : m.slice(0, 3); };
    const bgOf = (e) => { for (; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; const c = cs.backgroundColor; if (c !== 'rgba(0, 0, 0, 0)') return rgb(c); } return [255, 255, 255]; };
    const frames = [...document.querySelectorAll(sel)], root = document.body.querySelector('x-dc > div');
    const r = { fontInter: document.fonts.check('600 16px Inter'), unresolved: (document.body.innerHTML.match(/\{\{[\w.]+\}\}|<sc-for/g) || []).length, board: [root.scrollWidth, root.offsetHeight], frames: [] };
    frames.forEach((f) => {
      const fb = f.getBoundingClientRect(), o = { size: [Math.round(fb.width), Math.round(fb.height)], overflow: [], small: [], clipped: [], lowContrast: [], controls: [] };
      f.querySelectorAll('*').forEach((e) => {
        const b = e.getBoundingClientRect(); if (!b.width || !b.height) return; const name = (e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.textContent).trim().replace(/\s+/g, ' ').slice(0, 40);
        if (b.right > fb.right + .5 || b.left < fb.left - .5) o.overflow.push(name);
        if (e.matches('button,a,input,select')) { o.controls.push(name); const t = e.matches('input') ? e.closest('label') || e : e, tb = t.getBoundingClientRect(); if (tb.height < 43.5 || tb.width < 43.5) o.small.push(name + ' ' + Math.round(tb.width) + 'x' + Math.round(tb.height)); }
        if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible') o.clipped.push(name);
        if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) { const fg = rgb(getComputedStyle(e).color), bg = bgOf(e); if (fg && bg) { const a = lum(fg), c = lum(bg), k = (Math.max(a, c) + .05) / (Math.min(a, c) + .05), big = parseFloat(getComputedStyle(e).fontSize) >= 24; if (k < (big ? 3 : 4.5)) o.lowContrast.push(name + ' ' + k.toFixed(2)); } }
      });
      r.frames.push(o);
    });
    return r;
  }, sel);
  rep.fontRequestOk = fontOk;
  const hs = await pg.$$(sel), idx = only ? only.split(',').map(Number) : hs.map((_, i) => i);
  for (const i of idx) await hs[i].screenshot({ path: `${out}-${i}.png` });
  console.log(JSON.stringify(rep, null, 0).replace(/\{"size"/g, '\n{"size"'));
  await br.close();
})();
