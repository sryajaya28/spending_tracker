const { chromium } = require('playwright'); const out = []; const rec = (ok, n, d) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  ' + String(d).slice(0, 300) : ''));
(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme })).newPage();
    await p.goto('https://staging.stiver.io/'); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', 'smoke.staging@stiver.io'); await p.fill('[name=password]', process.env.SMOKE_STAGING_PASSWORD); await p.click('form[data-form=signin] button[type=submit]'); await p.waitForSelector('.shell', { timeout: 30000 }); await p.waitForTimeout(2500);
    await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForTimeout(2000);
    const card = await p.evaluate(() => { const els = [...document.querySelectorAll('.card, section, .settings-card')].filter((e) => /Household/.test(e.innerText) && /(Pending|Invite)/.test(e.innerText)); const e = els.sort((a, c) => a.innerText.length - c.innerText.length)[0]; if (!e) return null; e.setAttribute('data-qa-card', '1'); return { text: e.innerText.replace(/\s+/g, ' ').slice(0, 520), btns: [...e.querySelectorAll('button')].filter((x) => x.offsetParent).map((x) => (x.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20) + (x.disabled ? '(disabled)' : '')) }; });
    if (scheme === 'light') { out.push('   card text: ' + (card && card.text)); out.push('   card buttons: ' + JSON.stringify(card && card.btns)); }
    rec(!!card && /full/i.test(card.text), 'HH-05 the Household card says the household is full (' + scheme + ')');
    rec(!!card && /Pending/.test(card.text) && /(Resend)/.test(card.btns.join(' ') + card.text) && /Revoke/.test(card.btns.join(' ') + card.text), 'pending rows offer Resend and Revoke (' + scheme + ')');
    const el = await p.$('[data-qa-card]'); if (el) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: 'shots/r3_owner_card_' + scheme + '.png' }); }
    await p.context().close();
  }
  await b.close(); console.log(out.join('\n'));
})().catch((e) => { console.log(out.join('\n')); console.log('FAIL script: ' + e.message.split('\n')[0]); process.exit(1); });
