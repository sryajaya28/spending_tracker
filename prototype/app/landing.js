'use strict';
/* Stiver app: landing page, sign-in page and splash for signed-out visitors, install-as-an-app prompt and hand-off. Part of the former prototype/app.js; see docs/MAP.md. */
/* ---------- landing page (what signed-out visitors see first) ---------- */
const langSelect = () => `<select class="lang-select" data-lang aria-label="${__('Language')}">${Object.entries(LANGS).map(([k, n]) => `<option value="${k}" ${k === LANG ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
/* ---------- install as an app (mobile browsers only) ---------- */
const IS_STANDALONE = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const MOBILE_BROWSER = !IS_STANDALONE && (IS_IOS || /Android/i.test(navigator.userAgent));
let installPrompt = null;   // Android Chrome offers a real install prompt
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
const installBtn = (cls) => (MOBILE_BROWSER ? `<button type="button" class="btn lg install-cta ${cls || ''}" data-act="install-app">📲 ${__('Use mobile app experience')}</button>` : '');
const fmtHandoff = (c) => c.slice(0, 5) + '-' + c.slice(5);
const handoffInUrl = () => { const q = location.hash.split('?')[1] || ''; return new URLSearchParams(q).get('handoff') || ''; };
/* a looping, silent how-to animation of adding to the Home Screen on iPhone, one version for Safari and one for Chrome (drawn in CSS: no video file, no personal screen contents) */
const GUIDE_SHARE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
const androidSteps = () => [__('Tap the browser menu (⋮, top right)'), __('Tap "Install app" or "Add to Home screen"'), __('Tap Install, then open Stiver from your Home screen')];
const stepsList = (list) => `<ol class="install-steps">${list.map((t, i) => `<li><span class="step-n">${i + 1}</span><span>${t}</span></li>`).join('')}</ol>`;
function installGuide(kind, all = state.ui.guideAll) {   // all = the landing-page tutorial: also an Android tab (a phone visitor only gets its own platform)
  const tabs = (on) => `<div class="g-tabs${all ? ' g-tabs-3' : ''}">${(all ? [['safari', 'iPhone Safari'], ['chrome', 'iPhone Chrome'], ['android', 'Android']] : [['safari', 'Safari'], ['chrome', 'Chrome']]).map(([k, l]) => `<button type="button" class="${k === on ? 'on' : ''}" data-act="guide-tab" data-k="${k}">${l}</button>`).join('')}</div>`;
  if (kind === 'android') return `<div class="install-guide android-guide">${tabs(kind)}${stepsList(androidSteps())}</div>`;
  const chrome = kind === 'chrome', ring = '<i class="g-ring"></i>';
  const page = '<div class="g-page"><i></i><i></i><i></i></div>';
  const rowsOf = (list) => list.map((t) => `<div class="g-row">${t}</div>`).join('');
  const sheet = (rows, scroll) => `<div class="g-sheet"><div class="g-sheet-h"><img src="icon.svg" alt=""><span>Stiver<small>stiver.io</small></span></div><div class="g-clip"><div class="g-list ${scroll ? 'g-scroll' : ''}">${rows}</div></div></div>`;
  const hot = `<div class="g-row g-hot">Add to Home Screen ${ring}</div>`;
  const add = `<div class="g-add"><div class="g-add-h"><span>✕</span><b>Add to Home Screen</b><em class="g-hot">Add${ring}</em></div><div class="g-add-app"><img src="icon.svg" alt=""><span>Stiver<small>stiver.io</small></span></div><div class="g-tog"><span>Open as Web App</span><u class="g-hot"><i></i>${ring}</u></div></div>`;
  const dummy = (n) => Array.from({ length: n }, () => '<i class="g-app"></i>').join('');
  const home = `<div class="g-home">${dummy(4)}<span class="g-mine"><img src="icon.svg" alt=""><small>Stiver</small>${ring}</span>${dummy(3)}</div>`;
  let scenes, caps;
  if (chrome) {   // Chrome: the Share icon sits in the address bar; Add to Home Screen is further down the list
    scenes = [`<div class="g-url"><span>stiver.io</span><b class="g-ic">${GUIDE_SHARE}${ring}</b></div>${page}`, sheet(rowsOf(['Add to Bookmarks', 'Create a QR code', 'Find in Page', 'Print']) + hot + rowsOf(['Add to Quick Note']), true), add, home];
    caps = ['Tap the Share icon', 'Scroll down, tap Add to Home Screen', 'Keep Open as Web App on, tap Add', 'Open Stiver from your Home Screen'];
  } else {        // Safari (iOS 26): the ≡ button in the address bar opens a menu with Share, whose sheet lists Add to Home Screen
    scenes = [`${page}<div class="g-bar2"><b>‹</b><div class="g-pill"><span class="g-ic">≡${ring}</span><em>stiver.io</em><span>⟳</span></div><b>⧉</b></div>`,
      `${page}<div class="g-menu"><div class="g-row g-hot">${GUIDE_SHARE} Share ${ring}</div>${rowsOf(['Add to Bookmarks', 'Find on Page', 'Page Zoom'])}</div>`,
      sheet(rowsOf(['Add Bookmark to…', 'Add to Favourites', 'Add to Quick Note', 'Find on Page']) + hot + rowsOf(['Markup']), false), add, home];
    caps = ['Tap ≡ in the address bar', 'Tap Share', 'Tap Add to Home Screen', 'Keep Open as Web App on, tap Add', 'Open Stiver from your Home Screen'];
  }
  const n = scenes.length;
  return `<div class="install-guide g-n${n}" role="img" aria-label="${__('How to add Stiver to your Home Screen')}">
    ${tabs(kind)}
    <div class="g-phone">${scenes.map((h, i) => `<div class="g-scene" style="animation-delay:${i * 3}s">${h}</div>`).join('')}</div>
    <div class="g-caps">${caps.map((c, i) => `<span style="animation-delay:${i * 3}s"><b>${i + 1}</b> ${__(c)}</span>`).join('')}</div></div>`;
}
async function installDialog() {
  if (installPrompt) { try { installPrompt.prompt(); await installPrompt.userChoice; } catch { /* the steps below still apply */ } installPrompt = null; return; }
  let code = '';
  if (IS_IOS && state.auth.status === 'in' && Cloud.configured) {   // Android Chrome shares its sign-in with the installed app; only iPhone needs the transfer code
    try {
      code = (await Cloud.createHandoff()) || '';
      // adding to the Home Screen saves this address, so the app can pick the session up by itself
      if (code) { history.replaceState(null, '', location.pathname + location.search + '#/overview?handoff=' + code); setHandoffCookie(code); }
    } catch { code = ''; }
  }
  const steps = IS_IOS
    ? [/CriOS/.test(navigator.userAgent) ? __('Tap the Share icon in the address bar (the square with an arrow, top right of the page)') : __('Tap the Share button in Safari (in the toolbar, or under the ⋯ button)'), __('Scroll down the list and tap "Add to Home Screen"'), __('Keep "Open as Web App" switched on, then tap Add'), __('Open Stiver from your Home Screen')]
    : androidSteps();
  state.ui.guideAll = false;
  state.ui.guide = /CriOS/.test(navigator.userAgent) ? 'chrome' : 'safari';
  open(`<h2>${__('Use mobile app experience')}</h2><p class="muted" style="margin-top:-10px">${__('Full screen, faster to open, no browser bars.')}</p>
    ${IS_IOS ? `<div id="install-guide">${installGuide(state.ui.guide)}</div>` : ''}
    ${IS_IOS ? '' : stepsList(steps)}
    ${code ? `<div class="hint">${__("You're signed in here, so the app should open already signed in. If it asks you to sign in, tap \"Transfer from browser\" and enter this code:")}<div class="handoff-code num">${fmtHandoff(code)}</div><small>${__('Works once, for 15 minutes. The browser signs out after the app takes over.')}</small></div>` : ''}
    <div class="actions"><button type="button" class="btn" data-act="close">${__('Close')}</button></div><span data-close-outside hidden></span>`);
}
/* the landing-page button: a phone browser gets its own install dialog (with the real Android prompt); anyone else sees the tutorial for iPhone Safari, iPhone Chrome and Android */
function phoneTutorialDialog() {
  if (MOBILE_BROWSER) { installDialog(); return; }
  state.ui.guideAll = true; state.ui.guide = state.ui.guide === 'chrome' || state.ui.guide === 'android' ? state.ui.guide : 'safari';
  open(`<h2>${__('Add Stiver to your phone')}</h2><p class="muted" style="margin-top:-10px">${__('Full screen, faster to open, no browser bars. Open Stiver on your phone, then follow the steps.')}</p>
    <div id="install-guide">${installGuide(state.ui.guide)}</div>
    <div class="actions"><button type="button" class="btn" data-act="close">${__('Close')}</button></div><span data-close-outside hidden></span>`);
}
function handoffDialog() {
  open(`<h2>${__('Transfer from browser')}</h2><p class="muted" style="margin-top:-10px">${__('Signed in on your phone browser? Open "Use mobile app experience" there and enter the code it shows.')}</p>
    <form data-form="handoff" style="display:contents"><label class="field">${__('Transfer code')}<input name="code" required autocomplete="off" autocapitalize="characters" maxlength="12" placeholder="ABCDE-FGHJK"></label>
    <div class="actions"><button class="btn" type="submit">${__('Transfer')}</button></div></form>`);
}
/* the app was opened with a code in its address (or one was typed): claim it once and sign in */
async function claimHandoff(code, quiet) {
  try { if (await Cloud.claimHandoff(code)) { toast(__('Signed in from your browser')); return true; } } catch { /* falls through */ }
  if (!quiet) toast(__('That transfer code is wrong or expired'));
  return false;
}
/* iPhone ignores the address when adding to the Home Screen (it uses the manifest start page) but may copy the browser's cookies into the new app, so the code also rides in a short-lived cookie */
const HANDOFF_COOKIE = 'stiver_handoff';
const setHandoffCookie = (code) => { document.cookie = `${HANDOFF_COOKIE}=${code}; path=/; max-age=900; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; };
const clearHandoffCookie = () => { document.cookie = `${HANDOFF_COOKIE}=; path=/; max-age=0; SameSite=Lax`; };
const handoffInCookie = () => (document.cookie.split('; ').find((c) => c.startsWith(HANDOFF_COOKIE + '=')) || '').slice(HANDOFF_COOKIE.length + 1);
function consumeHandoffFromUrl() {
  const fromUrl = handoffInUrl(), code = fromUrl || (IS_STANDALONE ? handoffInCookie() : '');   // only the installed app takes the cookie, the browser keeps its own session
  if (!code) return;
  if (fromUrl) history.replaceState(null, '', location.pathname + location.search + '#/overview');   // never leave the code in the address
  if (!Cloud.configured) return;
  Cloud.getSession().then((s) => { if (!s) claimHandoff(code, true).then(clearHandoffCookie); else clearHandoffCookie(); }).catch(() => {});
}
function viewLanding() {
  const feat = (ic, title, text) => `<div class="feat"><span class="feat-ic" aria-hidden="true">${ic}</span><h3>${__(title)}</h3><p>${__(text)}</p></div>`;
  const step = (n, text) => `<li><span class="step-n">${n}</span><span>${__(text)}</span></li>`;
  return `<div class="land">
  <header class="land-nav"><a class="logo" href="#"><img src="icon.svg" alt="">Stiver</a>
    <div class="land-nav-r">${langSelect()}<button type="button" class="theme-btn" data-act="theme-toggle" aria-label="${__('Switch between light and dark')}">${effectiveTheme() === 'dark' ? '☀️' : '🌙'}</button><button class="btn secondary" data-act="auth-view" data-view="signin">${__('Sign in')}</button><button class="btn" data-act="auth-view" data-view="signup">${__('Get started')}</button></div></header>
  <section class="land-hero">
    <div class="land-copy">
      <h1>${__('Your money, finally in one place.')}</h1>
      <p class="land-sub">${__('Track spending, set budgets, and watch your net worth grow across savings, investments and debts. Simple, private and built for how you actually live.')}</p>
      <div class="land-cta-wrap"><div class="land-cta"><button class="btn lg" data-act="auth-view" data-view="signup">${__('Get started')}</button><button class="btn secondary lg" data-act="auth-view" data-view="signin">${__('Sign in')}</button></div>
      ${installBtn('land-install')}${IS_STANDALONE ? `<button type="button" class="legend-btn land-transfer" data-act="transfer-dialog">${__('Signed in on your browser? Transfer from browser')}</button>` : ''}</div>
    </div>
  </section>
  <section class="land-sec land-demo"><h2>${__('See Stiver in action')}</h2><p class="land-demo-sub">${__('A quick tour: add an expense, browse your days, hide your balance, check budgets, debts and investments, and move money between accounts.')}</p>
    <div class="demo-frame"><video controls playsinline preload="metadata" poster="media/demo-poster.jpg" aria-label="${__('Stiver demo video')}"><source src="media/demo.mp4" type="video/mp4"><source src="media/demo.webm" type="video/webm"></video></div></section>
  ${IS_STANDALONE ? '' : `<section class="land-sec land-phone"><div class="phone-card">
    <div class="phone-art"><div class="phone-mock"><video autoplay muted loop playsinline preload="metadata" poster="media/demo-phone-poster.jpg" aria-label="${__('Stiver on a phone')}"><source src="media/demo-phone.mp4" type="video/mp4"><source src="media/demo-phone.webm" type="video/webm"></video></div></div>
    <div class="phone-copy"><h2>${__('Get a better experience on your phone')}</h2><p>${__('Add Stiver to your Home Screen: it opens full screen, loads faster and feels like a real app. No app store needed.')}</p>
      <button type="button" class="btn lg" data-act="phone-tutorial">📲 ${__('See how to add it to your phone')}</button></div></div></section>`}
  <section class="land-sec"><h2>${__('Everything you need, nothing you don’t')}</h2>
    <div class="feats">
      ${feat('💸', 'Spending that makes sense', 'Log expenses and income in seconds, with categories and sub-categories that roll up into clear monthly totals.')}
      ${feat('🎯', 'Budgets that keep you honest', "Set an overall limit or one per category, and see at a glance when you're close. Add special budgets for trips and celebrations.")}
      ${feat('👛', 'Savings across accounts and currencies', 'Cash, bank accounts and e-wallets in any currency, with easy transfers between them.')}
      ${feat('📈', 'Investments with live prices', 'Track stocks, ETFs and crypto with current prices, buys and sells.')}
      ${feat('🤝', 'Debts and money you lent', "Know what you owe and what you're owed, and record each payment as it happens.")}
      ${feat('🌱', 'Net worth over time', 'See everything together and how it changes month by month.')}
    </div></section>
  <section class="land-sec"><h2>${__('How it works')}</h2>
    <ol class="steps">${step(1, 'Create your account with email or Google.')}${step(2, 'Add your accounts and your first transactions.')}${step(3, 'See your full picture on every device.')}</ol></section>
  <section class="land-final"><h2>${__('Ready to take control of your money?')}</h2><button class="btn lg" data-act="auth-view" data-view="signup">${__('Create your account')}</button></section>
  <footer class="land-foot"><span>© ${new Date().getFullYear()} Stiver</span><span><a href="privacy.html">${__('Privacy Policy')}</a> · <a href="terms.html">${__('Terms of Service')}</a></span></footer>
</div>`;
}

const authLink = (view, text) => `<button type="button" class="legend-btn" data-act="auth-view" data-view="${view}">${__(text)}</button>`;
function viewAuth() {
  const a = state.auth, v = a.view, logo = `<button type="button" class="logo logo-btn" data-act="auth-view" data-view="landing" aria-label="${__('Back to home')}"><img src="icon.svg" alt="">Stiver</button>`;
  const emailField = `<label class="field">${__('Email')}<input name="email" type="email" required autocomplete="email" placeholder="${__('you@example.com')}" value="${esc(a.email)}"></label>`;
  const google = `<button type="button" class="btn secondary lg google" data-act="auth-google">${GOOGLE_LOGO} ${__('Continue with Google')}</button><div class="or"><span>${__('or')}</span></div>`;
  // a password box with a show / hide button
  const pwField = (label, attrs) => `<label class="field">${label}<span class="pw-wrap"><input name="password" type="password" ${attrs}><button type="button" class="pw-toggle" data-act="toggle-password" aria-pressed="false" aria-label="${__('Show password')}">${icon('eye')}</button></span></label>`;
  const legalLink = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${__(text)}</a>`;
  // signing up (with Google or by email) needs a ticked agreement; signing in with Google on the sign-in page may also create an account, so that page says what continuing means
  const consent = `<label class="consent"><input type="checkbox" name="agree" data-act="agree-terms" ${a.agree ? 'checked' : ''}><span>${__('I agree to the {privacy} and the {terms}', { privacy: legalLink('privacy.html', 'Privacy Policy'), terms: legalLink('terms.html', 'Terms of Service') })}</span></label>`;
  const googleSignup = google.replace('class="btn secondary lg google"', `class="btn secondary lg google"${a.agree ? '' : ' disabled'}`);
  const googleNote = `<p class="muted consent-note">${__('By continuing you agree to the {privacy} and the {terms}.', { privacy: legalLink('privacy.html', 'Privacy Policy'), terms: legalLink('terms.html', 'Terms of Service') })}</p>`;
  let body;
  if (v === 'signup') body = `<form class="card" data-form="signup">${logo}
    <div><h2 style="font-size:24px">${__('Create your account')}</h2><p class="muted">${__('Your data is private to you and saved to your account.')}</p></div>
    ${consent}${googleSignup}${authMsg(a)}
    <label class="field">${__('Name')}<input name="name" required placeholder="${__('Ari Nolan')}" autocomplete="name"></label>
    ${emailField}
    ${pwField(__('Password'), `required minlength="8" autocomplete="new-password" placeholder="${__('At least 8 characters')}"`)}
    <label class="field">${__('Reporting currency')}<select name="currency">${Object.keys(RATES).map((c) => `<option data-list="${flagLabel(c)}">${c}</option>`).join('')}</select></label>
    ${captchaBox()}<button class="btn lg" type="submit" ${a.agree ? '' : 'disabled'}>${__('Create account')}</button>
    <p class="muted" style="text-align:center">${__("We'll email you a link to confirm your address. Already have an account?")} ${authLink('signin', 'Sign in')}</p></form>`;
  else if (v === 'forgot') body = `<form class="card" data-form="forgot">${logo}
    <div><h2 style="font-size:24px">${__('Reset your password')}</h2><p class="muted">${__('Enter your email and we\'ll send you a reset link.')}</p></div>
    ${authMsg(a)}${emailField}${captchaBox()}<button class="btn lg" type="submit">${__('Send reset link')}</button>
    <p class="muted" style="text-align:center">${authLink('signin', 'Back to sign in')}</p></form>`;
  else if (v === 'recovery') body = `<form class="card" data-form="recovery">${logo}
    <div><h2 style="font-size:24px">${__('Choose a new password')}</h2></div>${authMsg(a)}
    ${pwField(__('New password'), `required minlength="8" autocomplete="new-password" placeholder="${__('At least 8 characters')}"`)}
    <button class="btn lg" type="submit">${__('Save password')}</button></form>`;
  else if (v === 'sent') body = `<div class="card">${logo}
    <div><h2 style="font-size:24px">${__('Check your email')}</h2><p class="muted">${__('We sent a link to {email}. Open it to confirm your address, then sign in. If you already have an account, just sign in.', { email: '<b>' + esc(a.email) + '</b>' })}</p><p class="muted" data-invite-hint>${__('If you were invited to a household, use the link in your invite email.')}</p></div>
    ${authMsg(a)}<p class="hint" role="status">${__('Waiting for you to confirm. Open the link on any device, and this page signs you in on its own.')}</p>
    ${captchaBox()}<button class="btn lg" data-act="auth-check">${__('I\'ve confirmed my email')}</button><button class="btn secondary lg" data-act="auth-resend">${__('Resend the email')}</button>
    <p class="muted" style="text-align:center">${authLink('signin', 'Back to sign in')}</p></div>`;
  else body = `<form class="card" data-form="signin">${logo}
    <div><h2 style="font-size:24px">${__('Welcome back')}</h2><p class="muted">${__('Sign in to see your spending, budgets and net worth.')}</p></div>
    ${google}${googleNote}${authMsg(a)}${emailField}
    ${pwField(__('Password'), 'required autocomplete="current-password"')}
    ${captchaBox()}<button class="btn lg" type="submit">${__('Sign in')}</button>
    <p class="muted" style="text-align:center">${authLink('forgot', 'Forgot password?')}</p>
    <p class="muted" style="text-align:center">${__('New here?')} ${authLink('signup', 'Create an account')}</p>
    ${IS_STANDALONE ? `<p class="muted" style="text-align:center"><button type="button" class="legend-btn" data-act="transfer-dialog">${__('Transfer from browser')}</button></p>` : ''}</form>`;
  return `<div class="onboard">${body}<p class="legal-links"><a href="privacy.html">${__('Privacy Policy')}</a> · <a href="terms.html">${__('Terms of Service')}</a></p></div>`;
}
/* loading screen: the logo with an orbiting coin, a soft pulse and a running bar; the line under it changes every few seconds (pure CSS, no timers) */
/* a new account (balance under 1 USD) gets a one-tap way to try the app with sample data, without hunting for the Settings switch */
const samplePromo = () => (!state.real && toUSD(totalBalance(), cur()) < 1
  ? `<div class="demo-bar sample-promo" role="status"><span><b>${__('Just looking around?')}</b> · ${__('Test Stiver now with sample data')}</span><button class="btn secondary" data-act="demo-on">${__('Try')}</button></div>` : '');
const viewSplash = (msg) => `<div class="onboard"><div class="splash" role="status" aria-live="polite" aria-label="${esc(__(msg))}">
  <div class="splash-mark"><span class="ring"></span><span class="ring r2"></span><img src="icon.svg" alt=""><i class="orbit"><b></b></i></div>
  <div class="splash-name">Stiver</div>
  <div class="splash-msg"><span>${esc(__(msg))}</span><span>${__('Counting your coins…')}</span><span>${__('Lining up your budgets…')}</span><span>${__('Almost there…')}</span></div>
  <div class="splash-bar"><i></i></div></div></div>`;

