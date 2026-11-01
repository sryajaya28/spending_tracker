/* iPhone launch images for the Home Screen app: iOS shows a black screen while it starts the app unless the page lists an
   apple-touch-startup-image for the exact screen size. This renders the app's splash (gradient, logo, name; no animation) for
   each iPhone size into prototype/splash/ and writes the <link> tags into prototype/index.html (between <!--startup--> marks).

   Usage (dev server on port 5180):  node tools/design/startup_images.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), DIR = path.join(ROOT, 'prototype/splash');
// [css width, css height, device pixel ratio]: every iPhone screen size in use (portrait)
const SIZES = [[440, 956, 3], [430, 932, 3], [428, 926, 3], [420, 912, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [402, 874, 3], [393, 852, 3], [390, 844, 3], [375, 812, 3], [375, 667, 2], [320, 568, 2]];
(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const b = await chromium.launch(), links = [];
  for (const [w, h, r] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: r });
    await p.route('**/*.js', (r) => r.abort()); await p.goto('http://127.0.0.1:5180/');   // same origin (scripts blocked), so styles.css and icon.svg load
    await p.setContent(`<!doctype html><html><head><base href="http://127.0.0.1:5180/"><link rel="stylesheet" href="styles.css">
      <style>*{animation:none!important} body{margin:0} .onboard{min-height:100vh}</style></head><body><div class="onboard"><div class="splash">
      <div class="splash-mark"><img src="icon.svg" alt=""></div><div class="splash-name">Stiver</div></div></div></body></html>`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    const name = `iphone-${w * r}x${h * r}.png`;
    await p.screenshot({ path: path.join(DIR, name) }); await p.close();
    links.push(`  <link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="splash/${name}">`);
    console.log(name);
  }
  await b.close();
  const idx = path.join(ROOT, 'prototype/index.html'), s = fs.readFileSync(idx, 'utf8');
  const out = s.replace(/<!--startup-->[\s\S]*?(<!--\/startup-->|$(?![\s\S]))/m, (m) => m).replace(/<!--startup-->(?:[\s\S]*?<!--\/startup-->)?/, `<!--startup-->\n${links.join('\n')}\n  <!--/startup-->`);
  fs.writeFileSync(idx, out);
})();
