// Expands a .dc.html canvas board (sc-for / {{holes}}) into one self-contained static HTML file for html_to_figma.
// usage: node canvas_static.js <board.dc.html> <out.html> [patch.js]   (patch exports {data(vals), dom: string of page JS})
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const [file, out, patchFile] = process.argv.slice(2);
(async () => {
  const patch = patchFile ? require(path.resolve(patchFile)) : {};
  const br = await chromium.launch(), pg = await br.newPage({ viewport: { width: 2720, height: 1200 } });
  await pg.route('**/support.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
  await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const src = fs.readFileSync(file, 'utf8'), js = src.slice(src.indexOf('class Component'), src.lastIndexOf('</script>'));
  const vals = new Function('class DCLogic{constructor(){this.props={}}}\n' + js + '\nreturn new Component().renderVals()')();
  if (patch.data) patch.data(vals);
  await pg.goto('file://' + path.resolve(file));
  await pg.evaluate((vals) => {
    const look = (p, s) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), s);
    const subst = (h, s) => h.replace(/\{\{([\w.]+)\}\}/g, (m, p) => { const v = look(p, s); return v === undefined || typeof v === 'object' ? m : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;'); });
    const expand = (el, scope) => { let f; while ((f = el.querySelector('sc-for'))) {
      const list = look(f.getAttribute('list').slice(2, -2), scope) || [], as = f.getAttribute('as'), tpl = f.innerHTML; let html = '';
      for (const it of list) { const s = { ...scope, [as]: it }, d = document.createElement('div'); d.innerHTML = tpl; expand(d, s); html += subst(d.innerHTML, s); }
      f.outerHTML = html; } };
    expand(document.body, vals); document.body.innerHTML = subst(document.body.innerHTML, vals);
  }, vals);
  if (patch.dom) await pg.evaluate(patch.dom);
  const res = await pg.evaluate(() => {
    document.querySelectorAll('input[placeholder]').forEach((i) => { const s = document.createElement('span'); s.textContent = i.getAttribute('placeholder'); s.style.cssText = 'flex:1 1 0;min-width:0;color:var(--muted)'; i.replaceWith(s); });
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    const root = document.querySelector('x-dc > div');
    const unresolved = (root.innerHTML.match(/\{\{[\w.]+\}\}|<sc-for/g) || []).length;
    return { unresolved, html: '<!doctype html><html lang="en"><head><meta charset="utf-8"><style>' + css + '</style></head><body>' + root.outerHTML + '</body></html>' };
  });
  fs.writeFileSync(out, res.html);
  console.log(JSON.stringify({ out, bytes: res.html.length, unresolved: res.unresolved, patched: !!patchFile }));
  await br.close();
})();
