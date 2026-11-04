/* Real-browser screenshot of a hosted copy (staging or a preview), signed in as the smoke-test account.
 * Used for the "proof" in a ready report: shows the changed screen as a user sees it, not a mocked test.
 *
 *   SMOKE_EMAIL=smoke.staging@stiver.io SMOKE_PASSWORD="$SMOKE_STAGING_PASSWORD" \
 *     node tools/staging_shot.js https://staging.stiver.io '#/settings' out.png [--dark] [--wide] [--setup "js to run in the page"] [--click "css selector"]
 *
 * --dark  dark theme; --wide  1280 px wide (default is a 390 px phone); --setup  JavaScript run in the page after sign-in (for example to
 * open a dialog or create throwaway data; clean it up yourself); --click  click a selector before the screenshot. Full-page PNG. */
const { chromium } = require('playwright');
const a = process.argv.slice(2), flag = (n) => a.includes(n), val = (n) => (a.includes(n) ? a[a.indexOf(n) + 1] : '');
const [base, route, out] = a.filter((x, i) => !x.startsWith('--') && !['--setup', '--click'].includes(a[i - 1]));
const email = process.env.SMOKE_EMAIL, password = process.env.SMOKE_PASSWORD;
if (!base || !out || !email || !password) { console.log('usage: SMOKE_EMAIL=.. SMOKE_PASSWORD=.. node tools/staging_shot.js <base url> <#/route> <out.png> [--dark] [--wide] [--setup js] [--click css]'); process.exit(2); }
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: flag('--wide') ? { width: 1280, height: 900 } : { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: flag('--dark') ? 'dark' : 'light' });
  const p = await ctx.newPage();
  await p.goto(base.replace(/\/$/, '') + '/', { waitUntil: 'load', timeout: 45000 });
  await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]');
  await p.fill('[name=email]', email); await p.fill('[name=password]', password); await p.click('button[type=submit]');
  await p.waitForSelector('.shell', { timeout: 30000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { state.ui.onbSkipped = true; });
  if (route) { await p.evaluate((r) => { location.hash = r; }, route); await p.waitForTimeout(1200); }
  if (val('--setup')) { await p.evaluate(val('--setup')); await p.waitForTimeout(800); }
  if (val('--click')) { await p.click(val('--click')); await p.waitForTimeout(800); }
  await p.screenshot({ path: out, fullPage: true });
  console.log('saved ' + out);
  await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
