'use strict';
/* Stiver app: auth and data loading: sign-in and sign-up, email-confirmation polling, onAuth, loadUserData and the save-error handler. Part of the former prototype/app.js; see docs/MAP.md. Top-level names: friendlyAuthError, pending, stopPolling, startPolling, checkConfirmed, submitAuth, resetPeriodView, resetSessionView, onAuth, loadSeq, loadUserData, onSaveError. */
/* ---------- auth + data loading ---------- */
const friendlyAuthError = (e) => (/invalid login/i.test(e.message) ? 'Wrong email or password.' : /already registered/i.test(e.message) ? 'That email already has an account. Try signing in.' : e.message);
/* After sign-up the person confirms their email, often on another device (their phone). This tab can't
   know, so while the 'Check your email' screen is open it quietly retries the sign-in (password kept only in
   memory, never saved) every 15s and when the tab regains focus, and continues as soon as it works. */
let pending = null, pollTimer = null;
function stopPolling() { clearInterval(pollTimer); pollTimer = null; pending = null; }
function startPolling(email, password) {
  stopPolling(); pending = { email, password, until: Date.now() + 20 * 60 * 1000 };
  if (!CAPTCHA_KEY) pollTimer = setInterval(() => checkConfirmed(false), 15000);   // with CAPTCHA on, only the button works
}
async function checkConfirmed(manual) {
  if (!pending || state.auth.status !== 'out' || state.auth.view !== 'sent') return;
  if (Date.now() > pending.until) { stopPolling(); return; }
  if (CAPTCHA_KEY && !captchaToken) { if (manual) { state.auth.error = 'Please complete the verification first.'; render(); } return; }
  const { error } = await Cloud.signIn(pending.email, pending.password, captchaToken || undefined);
  if (!error) { stopPolling(); return; }   // the signed-in event takes it from here
  if (/not confirmed/i.test(error.message)) { if (manual) toast('Not confirmed yet. Open the link in the email, then try again.'); }
  else { stopPolling(); if (manual) { state.auth.error = friendlyAuthError(error); render(); } }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkConfirmed(false); if (state.data && !state.real) recurringNow(); } });
async function submitAuth(kind, v, f) {
  const a = state.auth, btn = $('button[type=submit]', f);
  if (kind === 'signup' && !a.agree) { toast(__('Please agree to the Privacy Policy and the Terms of Service first.')); return; }   // nothing is cleared: the form stays as typed
  if (btn) btn.disabled = true;
  Object.assign(a, { error: '', notice: '' }); if (v.email) a.email = v.email.trim();
  if (CAPTCHA_KEY && kind !== 'recovery' && !captchaToken) { a.error = 'Please complete the verification first.'; render(); return; }
  try {
    if (kind === 'signin') {
      const { error } = await Cloud.signIn(a.email, v.password, captchaToken || undefined);
      if (error) {
        if (/not confirmed/i.test(error.message)) { Object.assign(a, { view: 'sent', notice: 'Your email is not confirmed yet. Open the link we sent you, or resend it below.' }); startPolling(a.email, v.password); }
        else a.error = friendlyAuthError(error);
      }
    } else if (kind === 'signup') {
      const { data, error } = await Cloud.signUp(a.email, v.password, v.name.trim(), v.currency, captchaToken || undefined);
      if (error) a.error = friendlyAuthError(error);
      else {
        Analytics.track('signed_up', { confirmed: !!data.session });
        // email confirmation is on: wait for the link
        if (!data.session) { a.view = 'sent'; startPolling(a.email, v.password); }
      }
    } else if (kind === 'forgot') {
      const { error } = await Cloud.reset(a.email, captchaToken || undefined);
      if (error) a.error = error.message; else a.notice = 'If that email has an account, a reset link is on its way.';
    } else if (kind === 'recovery') {
      const { error } = await Cloud.setPassword(v.password);
      if (error) a.error = error.message; else { a.view = 'signin'; toast('Password updated'); }
    }
  } catch (err) { a.error = err.message || 'Something went wrong. Try again.'; }
  render();
}

/* a new session (sign-in, sign-out) always starts on the current period, never on "All periods" or an old period */
const resetPeriodView = () => { state.ui.allPeriods = false; state.ui.monthSrc = null; };
/* a new login or a logout starts clean: the Overview page, the top of the page, no remembered scroll positions, the current period.
   The hash is replaced (not assigned) so the browser does not run a second render. */
function resetSessionView() {
  resetPeriodView(); state.ui.onbSkipped = undefined; state.ui.onbSeen = false; state.ui.congrats = false; Object.keys(scrollPos).forEach((k) => delete scrollPos[k]);
  if (!joinState) { history.replaceState(null, '', '#/overview'); lastKey = '#/overview'; }   // the Join page keeps its own address
  window.scrollTo(0, 0);
}
async function onAuth(event, session) {
  const a = state.auth;
  if (event === 'PASSWORD_RECOVERY') { Object.assign(a, { status: 'in', view: 'recovery', error: '', notice: '' }); render(); return; }
  if (!session) { hhSeen = false; Analytics.reset(); Analytics.page(); state.data = null; state.real = null; resetSessionView(); Cloud.forget(); Object.assign(a, { status: 'out', uid: null }); if (a.view === 'recovery') a.view = 'signin'; render(); window.scrollTo(0, 0); return; }
  stopPolling(); a.email = session.user.email || a.email;
  Analytics.identify(session.user.id); Analytics.page();
  if (a.uid === session.user.id && state.data) return;   // token refresh or tab refocus: nothing to reload
  if (event === 'SIGNED_IN') { resetSessionView(); Analytics.track('signed_in'); } else resetPeriodView();   // a real login opens Overview at the top; reopening the app with a saved session keeps the page you were on
  Object.assign(a, { status: 'in', uid: session.user.id, loadError: '', view: a.view === 'recovery' ? 'recovery' : 'signin', error: '', notice: '' });
  render(); loadUserData();
}
let loadSeq = 0;
async function loadUserData() {
  const mine = ++loadSeq;   // a reload can start twice (sign-in events arrive in pairs); only the newest one may apply its result
  try {
    state.real = null;   // leave demo mode while reloading; it is switched back on below if you had it on
    const before = hhSeen ? `${Cloud.household.status}:${Cloud.household.role}` : '';
    const loaded = await Cloud.load();
    if (mine !== loadSeq) return;   // a newer load took over
    const nowAcc = `${Cloud.household.status}:${Cloud.household.role}`;
    if (before && before !== nowAcc && loaded) toast(__('Your access changed.'));   // the owner changed your role while the app was open
    hhSeen = true;
    state.auth.noAccess = !loaded;   // removed, never joined, or the household was deleted: the "no longer have access" page
    if (!loaded) { state.data = null; render(); return; }
    state.real = null; state.data = loaded;
    state.data.livePrices = loadPrices();
    const addedCats = ensureDefaultCategories(), addedFee = ensureFeeCategory(), addedSales = backfillSaleRecords(), addedCash = convertCashTrades(); if (addedCats || addedFee || addedSales || addedCash) save();   // every account has the default categories (see above) and Fee; earlier transfer fees get Fee
    if (api.finnhub || api.yahoo) refreshPrices(true);
    Analytics.person(state.data.profile);
    if (state.data.profile.theme && THEMES.includes(state.data.profile.theme)) applyTheme(state.data.profile.theme);
    if (state.data.profile.language && LANGS[state.data.profile.language]) { setLang(state.data.profile.language); render(); }   // your saved choice wins over this device's
    hhStartPolling(); hhLoadInvites();
    if (demoWanted()) await setDemo(true);
    else setTimeout(recurringNow, 300);
  } catch (err) { state.auth.loadError = err.message || 'network error'; }
  render();
}
/* a failed save leaves the screen ahead of the database, so show the server's truth again */
function onSaveError(err) {
  console.error(err);
  toast(householdSaveError(err) || __("Couldn't save your last change ({error}). Showing your saved data.", { error: String(err.message || err).slice(0, 80) }));
  loadUserData();
}
