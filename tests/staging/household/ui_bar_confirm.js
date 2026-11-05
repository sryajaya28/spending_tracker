const { chromium } = require('playwright'); const out = [];
const rec = (ok, n, d) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  ' + String(d).slice(0, 260) : ''));
(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('https://staging.stiver.io/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'smoke.staging@stiver.io'); await p.fill('[name=password]', process.env.SMOKE_STAGING_PASSWORD); await p.click('form[data-form=signin] button[type=submit]'); await p.waitForSelector('.shell', { timeout: 30000 }); await p.waitForTimeout(2500);
    if (scheme === 'light') out.push('   language helpers: ' + JSON.stringify(await p.evaluate(() => Object.keys(window).filter((k) => /lang/i.test(k) && typeof window[k] === 'function').slice(0, 8))));
    // Viewer layout
    await p.evaluate(() => { Cloud.household.role = 'viewer'; Cloud.household.status = 'member'; render(); }); await p.waitForTimeout(800);
    const bar = await p.evaluate(() => { const nav = document.querySelector('.bottom-nav'); return [...nav.children].map((e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { t: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 14), w: Math.round(r.width), vis: c.visibility, disp: c.display }; }); });
    const shown = bar.filter((i) => i.vis !== 'hidden' && i.disp !== 'none' && i.w > 0), ws = shown.map((i) => i.w);
    rec(shown.length === 4 && bar.length === 4 && Math.max(...ws) - Math.min(...ws) <= 2 && !shown.some((i) => /Add/.test(i.t)), 'Viewer bottom bar: four equal tabs, no raised Add, no empty slot (' + scheme + ', layout only)', shown.map((i) => i.t + ':' + i.w).join(' '));
    await p.screenshot({ path: 'shots/ac59_viewerbar_' + scheme + '.png', clip: { x: 0, y: 744, width: 390, height: 100 } });
    // owner/editor bar unchanged
    await p.evaluate(() => { Cloud.household.role = 'owner'; Cloud.household.status = 'owner'; render(); }); await p.waitForTimeout(800);
    const bar2 = await p.evaluate(() => [...document.querySelector('.bottom-nav').children].filter((e) => getComputedStyle(e).visibility !== 'hidden').map((e) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 12)));
    rec(bar2.length === 5 && bar2.includes('Add'), 'owner/editor bottom bar unchanged: five slots with the raised Add (' + scheme + ')', bar2.join(' / '));
    // confirmation dialog, opened with the app's own helper and strings; the confirm button is never pressed
    const open = () => p.evaluate(() => hhConfirm('delete-my-login', '', __('Delete your login?'), __('This permanently deletes your Stiver login. What you entered stays in the household under your name.'), __('Delete my login')));
    await open(); await p.waitForTimeout(800);
    const dlg = await p.evaluate(() => { const d = document.querySelector('dialog[open]'); return d ? { text: d.innerText.replace(/\s+/g, ' ').slice(0, 240), btns: [...d.querySelectorAll('button')].filter((e) => e.offsetParent).map((e) => e.textContent.trim()) } : null; });
    rec(!!dlg && /Delete your login\?/.test(dlg.text) && /permanently/i.test(dlg.text) && /stays in the household/.test(dlg.text), 'Delete my login confirmation names what is deleted (' + scheme + ')', JSON.stringify(dlg));
    await p.screenshot({ path: 'shots/ac59_confirm_' + scheme + '.png' });
    const cancel = dlg && dlg.btns.find((x) => /cancel/i.test(x)); rec(!!cancel, 'the confirmation has a Cancel button (' + scheme + ')', dlg && JSON.stringify(dlg.btns));
    if (cancel) { await p.click('dialog[open] button:has-text("' + cancel + '")'); await p.waitForTimeout(800); rec(!(await p.$('dialog[open]')), 'Cancel closes the dialog (' + scheme + ')'); }
    if (scheme === 'dark') {
      await p.evaluate(() => setLang('id')); await p.waitForTimeout(800); await open(); await p.waitForTimeout(800);
      const d2 = await p.evaluate(() => { const d = document.querySelector('dialog[open]'); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 260) : null; }); out.push('   confirmation in Indonesian: ' + d2);
      rec(!!d2 && !/Delete your login\?|permanently deletes/i.test(d2), 'the confirmation is translated to Indonesian', d2); await p.screenshot({ path: 'shots/ac59_confirm_id_dark.png' });
    }
    rec(errs.length === 0, 'no script errors (' + scheme + ')', JSON.stringify(errs).slice(0, 120));
    await p.context().close();
  }
  await b.close(); console.log(out.join('\n'));
})().catch((e) => { console.log(out.join('\n')); console.log('FAIL script: ' + e.message.split('\n')[0]); process.exit(1); });
