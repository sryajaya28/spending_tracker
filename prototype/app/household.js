'use strict';
/* Stiver app: household roles and write access, Settings > Household (members, invites), the join page. Part of the former prototype/app.js; see docs/MAP.md. */
/* ---------- household (design 7, 16): who may write, what to say when the database refuses, the page for people without access ---------- */
const canWrite = () => !!state.real || Cloud.canWrite();   // sample data is local only, so anyone may play with it
const WRITE_ACT = /^(add-|edit-|delete-(?!my-login)|archive-|unarchive-|restore-|rec-del$|rec-toggle$|rec-manage$|transfer$|transfer-dialog$|invest$|trade$|set-cost$|manual-asset$|loan-payment$|lent-repayment$|quick-cat-add$|remove-sample$|congrats-add$|pick-asset$|shot-del$)/;
const hhFirst = (id) => { const p = (Cloud.household.people || []).find((x) => x.user_id === id || x.member_id === id); return p ? String(p.display_name || '').trim().split(/\s+/)[0] : ''; };
const viewNoAccess = () => `<div class="onboard"><div class="card"><div class="logo"><img src="icon.svg" alt="">Stiver</div>
  <h1>${__('You no longer have access')}</h1><p class="muted">${__("You no longer have access to this household. Your earlier entries stay in it under your name.")}</p>
  <button class="btn secondary lg" data-act="signout">${__('Sign out')}</button>
  <button class="btn danger lg" data-act="delete-my-login-ask">${__('Delete my login')}</button></div></div>`;
/* the error contract (Cloud.classify): tell the person what happened in words, then show the server's truth again */
let hhLastDel = '';   // name of the item the person last deleted, so a database guard can say which one it refused
function householdSaveError(err) {
  const c = Cloud.classify(err);
  if (c.kind === 'stale') return __('Someone else changed this just now. Please check it and redo your change.');
  if (c.kind === 'gone') return __('Someone else already deleted this. Showing the latest.');
  if (c.kind === 'guard') return hhLastDel ? __("Can't delete '{name}'. '{name}' holds {n} transactions added by others. Ask the owner.", { name: hhLastDel, n: c.n }) : __("Can't delete this: it is used by {n} entries added by others. Ask the owner.", { n: c.n });
  if (c.kind === 'rls') return Cloud.household.role === 'editor' ? __('Only the person who added this, or the owner, can change it.') : __('Your access changed.');
  return '';
}
/* refresh when someone else changed the household: every 30 s while the page is visible, and when you come back to it */
let hhTimer = null, hhSeen = false;   // hhSeen: the first load of this session has happened, so a later difference in role is news
async function hhRefresh() {
  if (!state.data || state.real || document.hidden || !Cloud.household.hasMembers) return;
  try { if (await Cloud.pollChanged()) loadUserData(); } catch { /* offline: try again next time */ }
}
function hhStartPolling() { if (hhTimer) clearInterval(hhTimer); hhTimer = setInterval(hhRefresh, 30000); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) hhRefresh(); });

/* ---------- Settings > Household (Figma frames 1-4, 24): members, pending invites, invite dialog, role/remove/leave ---------- */
const hhState = { invites: [] };
const HH_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, HH_CAP = 5;
const roleLabel = (r) => ({ owner: __('Owner'), editor: __('Editor'), viewer: __('Viewer') }[r] || r);
const hhShort = (iso) => new Date(iso).toLocaleDateString(LANG === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short' });
const hhAvailable = () => !(state.real || !Cloud.configured || !state.auth.uid);   // the Household card and the Settings tile exist only for a signed-in real account
const hhLocked = () => (Cloud.household.status === 'member' ? 'disabled title="' + __('Set by the household owner') + '"' : '');   // currency and period day belong to the owner
const hhPeople = () => (Cloud.household.people || []).filter((p) => !p.former);
const hhFirstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
/* who did it (PRD 22-26, 33-37): labels only show when the household has other people; a removed member's entries keep their name */
const hhMulti = () => !state.real && Cloud.household.hasMembers;
/* in a household a delete names what goes (PRD 27): other people can see and rely on it */
const hhOk = (name) => { hhLastDel = name; return !hhMulti() || confirm(__('Delete "{name}"? This can\'t be undone.', { name })) };
/* names on Transactions rows and the person filter only matter when 2+ people can add entries (owner + Editors); Viewers cannot add, so they do not count */
const hhWriters = () => hhPeople().filter((p) => p.role === 'owner' || p.role === 'editor');
const hhNames = () => hhMulti() && hhWriters().length >= 2;
/* who can be picked in the Transactions filter: the writers, plus a removed member who still has entries */
const hhAuthors = () => [...hhWriters(), ...(Cloud.household.people || []).filter((p) => p.former && D().transactions.some((t) => t.by === p.user_id))];
/* an entry with no recorded creator counts as the owner's */
const txnAuthor = (t) => t.by || (hhWriters().find((p) => p.role === 'owner') || {}).user_id || '';
const byLine = (r) => (hhMulti() && r && r.by ? `<small class="muted hh-by">${whoLine(r).replace('<br>', ' · ')}</small>` : '');
const hhName = (id) => { const x = (Cloud.household.people || []).find((p) => p.user_id === id); return hhFirstName(x && x.display_name) || ''; };
const hhWhen = (iso) => new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/* an Editor changes only what they created; the owner changes everything; a Viewer nothing. A row not yet saved has no creator and is the viewer-of-it's own. */
const canEditRec = (r) => state.real || Cloud.household.status === 'owner' || (Cloud.canWrite() && (!r.by || r.by === state.auth.uid));
const whoLine = (r) => (r.by ? __('Added by {name}, {when}', { name: esc(hhName(r.by) || '?'), when: (r.byAt || r.created_at) ? esc(hhWhen(r.byAt || r.created_at)) : '' }).replace(/, $/, '') : '') + (r.edBy ? '<br>' + __('Edited by {name}, {when}', { name: esc(hhName(r.edBy) || '?'), when: esc(hhWhen(r.edAt)) }) : '');
function txnReadDialog(t) {
  const c = catOf(t.category_id), row = (k, v) => (v ? `<div class="form-row"><div>${k}</div><b>${v}</b></div>` : '');
  open(`<h2>${esc(t.note || c?.name || __('Transaction'))}</h2>
    ${row(__('Amount'), `<span class="num">${t.type === 'income' ? '+' : '−'}${money(t.amount_minor, t.currency)}</span>`)}${row(__('Category'), esc(c ? c.name : __('No category')))}${row(__('Account'), esc(txnWhere(t)))}${row(__('Date'), esc(new Date(t.occurred_at + 'T00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })))}${row(__('Note'), esc(t.note || ''))}
    ${hhMulti() ? `<p class="muted hh-who-line">${whoLine(t)}</p>` : ''}
    <div class="actions"><button type="button" class="btn secondary" data-act="close">${__('Close')}</button></div>`);
}
async function hhLoadInvites() {
  if (Cloud.household.status !== 'owner' || state.real || !Cloud.configured) { hhState.invites = []; return; }
  try { hhState.invites = await Cloud.listInvites(); } catch { hhState.invites = []; }
  if (route() === 'settings') render();
}
function householdCard() {
  if (!hhAvailable()) return '';
  const h = Cloud.household, me = state.auth.uid, isOwner = h.status === 'owner', live = hhPeople();
  const list = live.length ? live : [{ user_id: me, display_name: D().profile.name, role: 'owner', email: state.auth.email }];
  const pending = isOwner ? hhState.invites : [], full = list.length + pending.length >= HH_CAP;
  const ownerP = list.find((x) => x.role === 'owner'), ownerFirst = hhFirstName(ownerP && ownerP.display_name) || __('The owner');
  const initial = (x) => esc((String(x || '?').trim()[0] || '?').toUpperCase());
  const row = (x) => `<div class="form-row hh-row"><div class="hh-who"><span class="avatar" aria-hidden="true">${initial(x.display_name || x.email)}</span><div><span class="hh-line"><span class="hh-name">${esc(x.display_name || (x.email || '').split('@')[0])}${x.user_id === me ? ' ' + __('(you)') : ''}</span><span class="badge">${roleLabel(x.role)}</span></span><small>${esc(x.email || '')}</small></div></div>${isOwner && x.role !== 'owner' ? `<button type="button" class="btn secondary hh-manage" data-act="hh-member" data-id="${x.user_id}">${__('Manage')}</button>` : ''}</div>`;
  const pend = (i) => `<div class="form-row hh-row"><div class="hh-who"><span class="avatar pending" aria-hidden="true">✉</span><div><span class="hh-line pend"><span class="hh-name" title="${esc(i.email)}">${esc(i.email)}</span><span class="badge warning">${__('Pending')}</span></span><small>${__('Invited {date} · as {role}', { date: hhShort(i.created_at), role: roleLabel(i.role) })}</small></div></div>
    <div class="hh-pend-actions"><button type="button" class="btn secondary hh-pa" data-act="hh-resend" data-id="${i.id}" aria-label="${__('Resend invite')}" title="${esc(i.email)}"><span class="pa-txt">${__('Resend')}</span><span class="pa-ico">${icon('redo')}</span></button><button type="button" class="btn danger hh-pa" data-act="hh-revoke" data-id="${i.id}" aria-label="${__('Revoke invite')}" title="${esc(i.email)}"><span class="pa-txt">${__('Revoke')}</span><span class="pa-ico">${icon('x')}</span></button></div></div>`;
  const intro = isOwner ? __('Everyone here sees the same accounts and transactions.') : h.role === 'editor' ? __('{owner} manages this household. You can add and change entries, but not household settings or people.', { owner: ownerFirst }) : __('{owner} manages this household. You can see everything but not change it.', { owner: ownerFirst });
  return `<section class="card hh-card"><div class="card-head"><h2>${__('Household')}</h2><span class="badge">${roleLabel(h.status === 'member' ? h.role : 'owner')}</span></div>
    <p class="muted hh-intro">${intro}</p>${list.map(row).join('')}${pending.map(pend).join('')}
    ${isOwner ? `<button class="btn lg hh-invite" data-act="hh-invite" ${full ? 'disabled' : ''}>${__('Invite someone')}</button>${full ? `<small class="muted">${__('Household is full ({n})', { n: HH_CAP })}</small>` : ''}`
      : `<button class="btn secondary lg hh-invite" data-act="hh-leave">${__('Leave household')}</button><small class="muted hh-foot">${__('Currency and period day are set by the owner, so they are read-only here.')}</small>`}
    <button type="button" class="form-row hh-row tap hh-activity" data-act="goto" data-route="activity"><div><b>${__('Activity')}</b><small class="muted">${__('Who added, edited or deleted what')}</small></div><span aria-hidden="true">›</span></button></section>`;
}
function inviteDialog(prefill = '') {
  open(`<h2>${__('Invite someone')}</h2><form data-form="invite" style="display:contents" novalidate>
    <label class="field">${__('Email')}<input name="email" type="email" inputmode="email" autocomplete="off" autocapitalize="off" maxlength="254" required value="${esc(prefill)}"></label>
    <p class="auth-err" id="inv-msg" role="alert" hidden></p>
    <div class="field">${__('Role')}<div class="seg"><label><input type="radio" name="role" value="editor" checked>${__('Editor')}</label><label><input type="radio" name="role" value="viewer">${__('Viewer')}</label></div></div>
    <small class="muted">${__('Editor: adds and changes everything except household settings. Viewer: sees everything, changes nothing.')}</small>
    <p class="hint">${__('They will see all your data, including notes and the names of other members.')}</p>
    <div class="actions" id="inv-actions"><button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button class="btn" type="submit" data-send>${__('Send invite')}</button></div></form>`);
}
function hhMsg(f, text, resendId) {
  const m = $('#inv-msg', f); m.hidden = !text; m.textContent = text || '';
  const a = $('#inv-actions', f), old = $('[data-act="hh-resend"]', a); if (old) old.remove();
  if (resendId) a.insertAdjacentHTML('afterbegin', `<button type="button" class="btn secondary" data-act="hh-resend" data-id="${resendId}">${__('Resend')}</button>`);
}
async function hhInviteSubmit(f, v) {
  const email = String(v.email || '').trim().toLowerCase(), role = v.role === 'viewer' ? 'viewer' : 'editor', btn = $('[data-send]', f);
  if (!HH_EMAIL.test(email)) { hhMsg(f, __('Enter a valid email address.')); return; }
  btn.disabled = true; btn.textContent = __('Sending…');
  const r = await Cloud.inviteMember(email, role).catch(() => ({ error: 'network' }));
  btn.disabled = false; btn.textContent = __('Send invite');
  if (r && r.result === 'ok') { Analytics.track('invite_sent', { role }); close(); toast(__('Invite sent')); hhLoadInvites(); return; }
  const mine = hhState.invites.find((i) => i.email === email);
  hhMsg(f, r && r.result === 'cannot_invite' ? __("This email can't be invited. If they already use Stiver, they need to use a different email address.")
    : r && r.result === 'already_invited' ? __('Already invited. Resend sends a fresh email and the old link stops working.')
    : r && r.result === 'full' ? __('Household is full ({n}). Revoke a pending invite or remove someone to invite more.', { n: HH_CAP })
    : r && r.result === 'rate_limited' ? __('Too many invites. Please try again later.')
    : r && r.result === 'invalid' ? __('Enter a valid email address.') : __("Couldn't send the invite. Please try again."), r && r.result === 'already_invited' && mine ? mine.id : '');
}
async function hhInviteAction(act, id) {
  const r = await Cloud.manageInvite(act, id).catch(() => ({ error: 'network' }));
  if (r && r.result === 'ok') { Analytics.track(act === 'resend' ? 'invite_resent' : 'invite_revoked'); if (dlg().open) close(); toast(act === 'resend' ? __('Invite sent again') : __('Invite revoked')); hhLoadInvites(); return; }
  toast(r && r.result === 'rate_limited' ? __('Too many invites. Please try again later.') : r && r.result === 'not_found' ? __('This invite no longer exists.') : __("Couldn't do that. Please try again."));
  hhLoadInvites();
}
function memberDialog(id) {
  const x = hhPeople().find((p) => p.user_id === id); if (!x || x.role === 'owner') return;
  open(`<h2>${esc(hhFirstName(x.display_name) || x.email || '')}</h2><p class="muted">${esc(x.email || '')}</p>
    <form data-form="member-role" data-id="${id}" style="display:contents"><div class="field">${__('Role')}<div class="seg"><label><input type="radio" name="role" value="editor" ${x.role === 'editor' ? 'checked' : ''}>${__('Editor')}</label><label><input type="radio" name="role" value="viewer" ${x.role === 'viewer' ? 'checked' : ''}>${__('Viewer')}</label></div></div>
    <div class="actions"><button type="button" class="btn danger" data-act="hh-remove" data-id="${id}">${__('Remove')}</button><button class="btn" type="submit" data-send>${__('Save')}</button></div></form>`);
}
function hhConfirm(act, id, title, body, go) {
  open(`<h2>${title}</h2><p class="muted">${body}</p><div class="actions"><button type="button" class="btn secondary" data-act="close">${__('Cancel')}</button><button type="button" class="btn danger" data-act="${act}" data-id="${id || ''}">${go}</button></div>`);
}
async function hhDo(fn, ev, ok) {
  try { await fn(); Analytics.track(ev); close(); toast(ok); loadUserData(); } catch (e) { toast(__("Couldn't do that. Please try again.")); }
}

/* ---------- Join page (Figma frames 5, 6): /join#t=<token>. The token lives only in memory; the fragment is removed from the address at once ---------- */
let joinState = null;   // { status: 'loading' | 'ready' | 'invalid' | 'busy', token, owner, role, error }
const joinBytesOk = (pw) => pw.length >= 8 && new TextEncoder().encode(pw).length <= 72;
function joinBoot() {
  if (location.pathname.replace(/\/$/, '') !== '/join') return;
  const m = /(?:^#|&)t=([A-Za-z0-9_-]{20,64})/.exec(location.hash);
  history.replaceState(null, '', '/join');   // the secret never stays in the address bar, history or a shared screenshot
  joinState = { status: m ? 'loading' : 'invalid', token: m ? m[1] : '' };
  render();
  if (!m) return;
  Cloud.joinPreview(joinState.token).then((r) => {
    if (!joinState) return;
    if (r && r.owner_name) Object.assign(joinState, { status: 'ready', owner: r.owner_name, role: r.role });
    else joinState.status = 'invalid';
    render();
  }).catch(() => { if (joinState) { joinState.status = 'invalid'; render(); } });
}
function joinExit(to = '/') { joinState = null; history.replaceState(null, '', to); render(); }
function viewJoin() {
  const j = joinState, a = state.auth, who = hhFirstName(j.owner) || __('the owner');
  const head = `<div class="join-head"><span class="logo"><img src="icon.svg" alt="">Stiver</span><span class="join-lang"><button type="button" class="chip${LANG === 'en' ? ' on' : ''}" data-act="join-lang" data-lang="en">EN</button><button type="button" class="chip${LANG === 'id' ? ' on' : ''}" data-act="join-lang" data-lang="id">ID</button></span></div>`;
  const card = (inner) => `<div class="onboard">${head}<div class="card join-card">${inner}</div></div>`;
  if (j.status === 'loading') return viewSplash('Checking your invitation…');
  if (j.joining) return viewSplash('Joining the household…');
  if (j.status === 'invalid') return card(`<h2>${__('This link no longer works')}</h2><p class="muted">${j.owner ? __('This invitation was already used or has expired. Ask {owner} to send a new one.', { owner: esc(who) }) : __('This invitation was already used or has expired. Ask the person who invited you to send a new one.')}</p><button class="btn lg" data-act="join-exit">${__('Go to Stiver')}</button>`);
  if (a.status === 'in') return card(`<h2>${__('Sign out to join')}</h2><p class="muted">${__("You're signed in as {name}. Sign out to join {owner}'s household.", { name: esc(hhFirstName(D() && D().profile.name) || a.email || ''), owner: esc(who) })}</p><button class="btn lg" data-act="join-signout">${__('Sign out')}</button><button class="btn secondary lg" data-act="join-exit">${__('Stay signed in')}</button>`);
  const legal = (href, t) => `<a href="${href}" target="_blank" rel="noopener">${__(t)}</a>`;
  return card(`<form data-form="join" style="display:contents" novalidate><h2>${__("Join {owner}'s household", { owner: esc(who) })}</h2>
    <p class="muted">${__('{owner} invited you to join their household as {role}.', { owner: esc(who), role: roleLabel(j.role) })}</p>
    <label class="field">${__('Display name')}<input name="name" required maxlength="60" autocomplete="name" placeholder="${__('Ari Nolan')}"></label>
    <label class="field">${__('Password')}<span class="pw-wrap"><input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="${__('At least 8 characters')}"><button type="button" class="pw-toggle" data-act="toggle-password" aria-pressed="false" aria-label="${__('Show password')}">${icon('eye')}</button></span></label>
    <label class="consent"><input type="checkbox" name="agree"><span>${__('I agree to the {privacy} and the {terms}', { privacy: legal('privacy.html', 'Privacy Policy'), terms: legal('terms.html', 'Terms of Service') })}</span></label>
    <p class="auth-err" id="join-msg" role="alert" hidden></p>
    <button class="btn lg" type="submit" data-send disabled>${__('Join household')}</button>
    <p class="muted">${__('After joining you are signed in and see the same accounts and transactions as {owner}.', { owner: esc(who) })}</p></form>`);
}
function joinValidate(f) {
  const v = Object.fromEntries(new FormData(f));
  $('[data-send]', f).disabled = !(String(v.name || '').trim() && joinBytesOk(String(v.password || '')) && v.agree);
}
async function joinSubmit(f, v) {
  const btn = $('[data-send]', f), msg = $('#join-msg', f), name = String(v.name || '').trim();
  if (!name || !joinBytesOk(String(v.password || '')) || !v.agree) { joinValidate(f); return; }
  btn.disabled = true; btn.textContent = __('Joining…'); msg.hidden = true;   // disabled after the first tap: one submit per attempt
  joinState.joining = true;
  const r = await Cloud.joinHousehold(joinState.token, String(v.password), name).catch(() => ({ error: 'network' }));
  if (joinState) joinState.joining = false;
  if (r && r.result === 'ok') { Analytics.track('invite_accepted', { role: joinState.role }); joinExit('/#/overview'); return; }
  if (r && r.result === 'joined_sign_in') { joinState = null; history.replaceState(null, '', '/'); Object.assign(state.auth, { status: 'out', view: 'signin', notice: 'You joined the household. Sign in with your new password.', error: '' }); render(); return; }
  const text = r && r.error === 'invalid_input' ? __('Check your name and password (8 to 72 characters).') : r && r.error === 'password_failed' ? __("Couldn't set your password. Please try again.")
    : r && r._status === 409 ? __('This link is being used right now. Try again in a minute.') : r && r.error === 'network' ? __("Couldn't reach Stiver. Check your connection and try again.") : '';
  if (!text) { joinState.status = 'invalid'; render(); return; }   // the link is dead (used, expired, revoked): one generic page
  render(); const f2 = $('[data-form=join]'); if (f2) { const m2 = $('#join-msg', f2); m2.textContent = text; m2.hidden = false; f2.elements.name.value = name; }
}

