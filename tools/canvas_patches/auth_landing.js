// Sheets board (Phone 390): replaces the Sign in and Landing frames with the app's real screens (landing.js viewLanding / viewAuth)
// and adds Sign up and Reset password. Dark + light. The Add transaction sheet is not touched (the importer selects `.au` only).
// usage: node tools/canvas_static.js Sheets.dc.html out.html tools/canvas_patches/auth_landing.js  -> html_to_figma with cssSelector ".au"
const fs = require('fs'), path = require('path');
const uri = (f, mime) => `data:${mime};base64,${fs.readFileSync(path.join(__dirname, '../../prototype', f)).toString('base64')}`;
const assets = { icon: uri('icon.svg', 'image/svg+xml'), demo: uri('media/demo-poster.jpg', 'image/jpeg'), phone: uri('media/demo-phone-poster.jpg', 'image/jpeg') };
function build(A) {
  const css = `.au{align-self:flex-start;width:390px;min-height:844px;box-sizing:border-box;border-radius:36px;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;gap:16px;padding:20px 16px 24px;font-family:Inter,system-ui,sans-serif;overflow:hidden;position:relative}
.au .inp{display:flex;align-items:center;height:52px;box-sizing:border-box;border-radius:26px;background:var(--card);border:1.5px solid color-mix(in srgb,var(--muted) 55%,transparent);padding:0 20px;font-size:15px;color:var(--muted);width:100%;position:relative}
.au .inp .sp{flex:1 1 0;min-width:0}
.au .eye{position:absolute;right:4px;top:4px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--muted)}
.au .lk{color:var(--accent);font-weight:600}
.au .ctr{text-align:center;font-size:15px;color:var(--muted)}
.au .cl{display:flex;align-items:center;justify-content:center;min-height:44px}
.au .lg{display:flex;gap:10px;align-items:center;min-height:44px;font-size:13px;line-height:1.4;color:var(--muted)}
.au .box{flex:0 0 auto;width:24px;height:24px;box-sizing:border-box;border-radius:7px;border:2px solid var(--muted);background:var(--card)}
.au .dis{opacity:.5}
.au .hero{margin:-20px -16px 0;padding:20px 16px 96px;display:flex;flex-direction:column;gap:16px;color:#fff}
.au .gl{background:rgba(255,255,255,.16);color:#fff}
.au .sec{display:flex;flex-direction:column;gap:12px;align-items:stretch}
.au h2{margin:0;font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-.02em;text-align:center}
.au .feat{background:var(--card);border-radius:24px;padding:16px;display:flex;flex-direction:column;gap:8px}
.au .feat b{font-size:16px;font-weight:600}.au .feat span.t{font-size:15px;color:var(--muted);line-height:1.45}
.au .fic{width:46px;height:46px;border-radius:14px;background:var(--tile);display:flex;align-items:center;justify-content:center;font-size:22px}
.au .stp{background:var(--card);border-radius:20px;padding:16px 20px;display:flex;align-items:center;gap:14px;font-weight:600;font-size:15px;min-height:44px}
.au .stn{flex:0 0 auto;width:34px;height:34px;border-radius:50%;background:#4a44c6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const chev = '<svg class="i s" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const eye = '<span class="eye"><svg class="i" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg></span>';
  const gG = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.3-4 6.8-9.9 6.8-16.9z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.6 2.3-8.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
  const logo = `<div class="row" style="min-height:44px"><span class="row" style="gap:8px"><img src="${A.icon}" width="28" height="28" alt=""><span style="font-size:20px;font-weight:600;letter-spacing:-.02em">Stiver</span></span></div>`;
  const legal = '<div class="m" style="text-align:center;font-size:12px;min-height:44px;display:flex;align-items:center;justify-content:center">Privacy Policy · Terms of Service</div>';
  const head = (t, s) => `<div style="display:flex;flex-direction:column;gap:6px;padding:8px 0"><div class="t1" style="font-size:26px">${t}</div>${s ? `<div class="m" style="font-size:15px">${s}</div>` : ''}</div>`;
  const field = (l, v, extra) => `<div class="lab">${l}<div class="inp">${v}${extra || ''}</div></div>`;
  const google = (d) => `<div class="btn two ${d ? 'dis' : ''}">${gG} Continue with Google</div>`;
  const or = '<div class="row m"><span class="sp" style="height:1px;background:var(--tile)"></span>or<span class="sp" style="height:1px;background:var(--tile)"></span></div>';
  const lnk = (t) => `<span class="lk">${t}</span>`;
  const screens = {
    'Sign in': [logo, head('Welcome back', 'Sign in to see your spending, budgets and net worth.'), google(), or,
      '<div class="m" style="text-align:center;font-size:12px">By continuing you agree to the <u>Privacy Policy</u> and the <u>Terms of Service</u>.</div>',
      field('Email', 'you@example.com'), field('Password', '', eye),
      '<div class="btn">Sign in</div>', `<div class="ctr cl">${lnk('Forgot password?')}</div>`, `<div class="ctr cl">New here?&nbsp;${lnk('Create an account')}</div>`, '<span class="sp"></span>', legal],
    'Sign up': [logo, head('Create your account', 'Your data is private to you and saved to your account.'),
      '<div class="lg"><span class="box"></span><span>I agree to the <u>Privacy Policy</u> and the <u>Terms of Service</u></span></div>',
      google(true), or, field('Name', 'Ari Nolan'), field('Email', 'you@example.com'), field('Password', 'At least 8 characters', eye),
      field('Reporting currency', '<span class="sp" style="color:var(--ink)">IDR</span>' + chev),
      '<div class="btn dis">Create account</div>', `<div class="ctr" style="font-size:13px">We’ll email you a link to confirm your address. Already have an account?<span class="cl">${lnk('Sign in')}</span></div>`, legal],
    'Reset password': [logo, head('Reset your password', 'Enter your email and we’ll send you a reset link.'), field('Email', 'you@example.com'),
      '<div class="btn">Send reset link</div>', `<div class="ctr cl">${lnk('Back to sign in')}</div>`, '<span class="sp"></span>', legal]
  };
  const feats = [['💸', 'Spending that makes sense', 'Log expenses and income in seconds, with categories and sub-categories that roll up into clear monthly totals.'],
    ['🎯', 'Budgets that keep you honest', 'Set an overall limit or one per category, and see at a glance when you’re close. Add special budgets for trips and celebrations.'],
    ['👛', 'Savings across accounts and currencies', 'Cash, bank accounts and e-wallets in any currency, with easy transfers between them.'],
    ['📈', 'Investments with live prices', 'Track stocks, ETFs and crypto with current prices, buys and sells.'],
    ['🤝', 'Debts and money you lent', 'Know what you owe and what you’re owed, and record each payment as it happens.'],
    ['👨‍👩‍👧', 'Shared with your household', 'Invite your family as Editor or Viewer. Everyone sees the same money, and every entry shows who added it.']];
  const steps = ['Create your account with email or Google.', 'Add your accounts and your first transactions.', 'See your full picture on every device.'];
  const landing = (dark) => `<div class="hero" style="background:${dark ? 'linear-gradient(180deg,#4a44c6 0,#2b2780 46%,#12112b 82%,#0e0d1f 100%)' : 'linear-gradient(180deg,#4a44c6 0,#5049c9 86%,#f3f3f9 100%)'}">
    <div class="row" style="gap:8px"><span class="row sp" style="gap:6px"><img src="${A.icon}" width="26" height="26" alt=""><span style="font-size:18px;font-weight:600;letter-spacing:-.02em">Stiver</span></span>
      <span class="gl row" style="height:44px;padding:0 12px;border-radius:22px;font-size:13px;font-weight:600;gap:6px">English ${chev}</span>
      <span class="ic gl" style="font-size:18px">${dark ? '☀️' : '🌙'}</span><span class="gl row" style="height:44px;padding:0 16px;border-radius:22px;font-size:13px;font-weight:600">Get started</span></div>
    <div style="padding:28px 8px 0;text-align:center;font-size:40px;line-height:1.08;font-weight:600;letter-spacing:-.03em">Your money, finally in one place.</div>
    <div style="padding:0 4px;text-align:center;font-size:15px;line-height:1.5;color:rgba(255,255,255,.88)">Track spending, set budgets, and watch your net worth grow across savings, investments and debts. Simple, private and built for how you actually live.</div>
    <div style="display:flex;flex-direction:column;gap:12px;padding-top:8px"><div class="btn" style="background:#fff;color:#1b1a4b">Get started</div><div class="btn" style="box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.55);color:#fff">Sign in</div><div class="btn gl">📲 Use mobile app experience</div></div></div>
    <div class="sec" style="padding-top:12px"><h2>See Stiver in action</h2><div class="ctr" style="font-size:15px">A quick tour: see what you spent today, add an expense, read your report, check budgets, debts and investments, and move money between accounts.</div>
      <img src="${A.demo}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:24px;display:block" alt=""></div>
    <div class="feat" style="align-items:center;text-align:center;padding:24px 20px;gap:16px;border-radius:28px"><div style="width:200px;aspect-ratio:390/844;border-radius:32px;border:6px solid var(--ink);overflow:hidden;box-sizing:border-box"><img src="${A.phone}" style="width:100%;height:100%;object-fit:cover;display:block" alt=""></div>
      <h2 style="font-size:22px">Get a better experience on your phone</h2><span class="t">Add Stiver to your Home Screen: it opens full screen, loads faster and feels like a real app. No app store needed.</span><div class="btn" style="width:100%;box-sizing:border-box">📲 See how to add it to your phone</div></div>
    <div class="sec" style="padding-top:12px"><h2>Everything you need, nothing you don’t</h2>${feats.map(([i, t, x]) => `<div class="feat"><span class="fic">${i}</span><b>${t}</b><span class="t">${x}</span></div>`).join('')}</div>
    <div class="sec" style="padding-top:12px"><h2>How it works</h2>${steps.map((s, i) => `<div class="stp"><span class="stn">${i + 1}</span><span>${s}</span></div>`).join('')}</div>
    <div class="sec" style="padding:24px 0 8px;align-items:center"><h2>Ready to take control of your money?</h2><div class="btn" style="width:100%;box-sizing:border-box">Create your account</div></div>
    <div class="row m" style="border-top:1px solid var(--tile);padding-top:16px;min-height:44px"><span class="sp">© 2026 Stiver</span><span>Privacy Policy · Terms of Service</span></div>`;
  const root = document.querySelector('x-dc > div'); root.style.height = 'auto';
  [...root.children].forEach((th) => {
    const dark = th.classList.contains('dk');
    [...th.children].forEach((c, i) => { if (i > 0) c.remove(); });   // keep the Add transaction sheet (child 0) untouched
    const mk = (name, html) => { const d = document.createElement('div'); d.className = name === 'Landing' ? 'au landing' : 'au'; d.dataset.name = name; d.innerHTML = html; th.appendChild(d); };
    Object.entries(screens).forEach(([n, parts]) => mk(n, parts.map((p) => (p === '<span class="sp"></span>' ? '<span class="sp"></span>' : p)).join('')));
    mk('Landing', landing(dark));
  });
}
module.exports = { dom: `(${build.toString()})(${JSON.stringify(assets)})` };
