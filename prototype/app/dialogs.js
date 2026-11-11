'use strict';
/* Stiver app: the shared dialog helpers (open, close, scroll lock), category and icon pickers, the kind switch. Part of the former prototype/app.js; see docs/MAP.md. */
/* ---------- dialogs ---------- */
const dlg = () => $('#dlg');
// no field is focused on open, so the phone keyboard stays down until the user taps an input
/* while a modal is open the page behind must not scroll (on iPhone the background still moves with overflow:hidden alone): the body is pinned in place and the scroll position restored on close */
let lockY = null;
const lockScroll = () => { if (lockY !== null) return; lockY = window.scrollY; document.body.style.setProperty('--lock-top', `-${lockY}px`); document.body.classList.add('scroll-locked'); };
const unlockScroll = () => { if (lockY === null) return; const y = lockY; lockY = null; document.body.classList.remove('scroll-locked'); document.body.style.removeProperty('--lock-top'); window.scrollTo(0, y); };
dlg().addEventListener('close', unlockScroll);
// every pop-up has a ✕ in its top-right corner (Esc and a tap outside close it too)
function open(html) { Analytics.dialogOpened(html, dlg().open); dlg().innerHTML = `<div class="dlg" tabindex="-1"><button type="button" class="dlg-x" data-act="close" aria-label="${__('Close')}">${icon('x')}</button>${html}</div>`; if (!dlg().open) { lockScroll(); dlg().showModal(); } $('.dlg', dlg()).focus({ preventScroll: true }); }
const close = () => dlg().open && dlg().close();
/* a tap or click on the dimmed area outside a modal closes it (web and phone). A press that starts inside and is released outside (selecting text), or a tap that only closes an open dropdown list, does not. */
let downOnBackdrop = false, listOpenAtDown = false;
window.addEventListener('pointerdown', () => { listOpenAtDown = !!document.querySelector('.cs-pop, .dp-pop'); }, true);   // before the dropdown closes its own list
dlg().addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === dlg() && !listOpenAtDown; });
dlg().addEventListener('click', (e) => { if (e.target === dlg() && downOnBackdrop) close(); downOnBackdrop = false; });
const catOptions = (type, sel, withNew) => `<option value="">${__('— None (AI may suggest) —')}</option>${catTree(type).map((c) => `<option value="${c.id}" data-s="${esc((c.parent_id ? (catOf(c.parent_id)?.name || '') + ' ' : '') + c.name)}" ${c.id === sel ? 'selected' : ''}>${c.parent_id ? '  ↳ ' : ''}${c.icon} ${esc(c.name)}</option>`).join('')}${withNew ? `<option value="__new" data-cta>＋ ${__('Add new category')}</option>` : ''}`;

/* parents a new category can live in: none (a new top-level category) or an existing top-level one of this type */
const quickParentOptions = (type) => `<option value="">${__('Nothing: a new top-level category')}</option>${D().categories.filter((c) => !c.parent_id && !c.archived && c.type === type).map((c) => `<option value="${c.id}">${c.icon} ${esc(c.name)} ${__('(as a sub-category)')}</option>`).join('')}`;
/* category icon: the field holds the current emoji (not a placeholder, so it can be deleted), its text is selected on focus so
   typing or picking an emoji replaces it, only the last emoji typed is kept, and a row of common icons can be tapped instead */
const ICON_PICKS = ['🏷️', '🍔', '☕', '🛒', '🚕', '⛽', '🏠', '💡', '📱', '🎬', '🎮', '👕', '💊', '🏋️', '✈️', '🎁', '🐶', '📚', '💼', '💰'];
const lastEmoji = (v) => { const s = (v || '').trim(); if (!s) return ''; const g = window.Intl?.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment) : Array.from(s); return g[g.length - 1]; };
const iconField = (name, label, value) => `<label class="field">${label}<input name="${name}" class="icon-input" value="${esc(value)}" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="${__('Icon (emoji)')}"></label>`;
const iconPicks = (name, cur = '') => `<div class="icon-picks" data-for="${name}" role="group" aria-label="${__('Choose an icon')}">${ICON_PICKS.map((e) => `<button type="button" class="icon-pick${e === cur ? ' on' : ''}" data-act="pick-icon" data-for="${name}" data-e="${e}" aria-label="${e}">${e}</button>`).join('')}</div>`;
/* add a category without leaving the transaction form, then select it */
function quickAddCategory(form) {
  const type = form.type && form.type.value === 'income' ? 'income' : 'expense', name = form.qc_name.value.trim(), parent = form.qc_parent && form.qc_parent.value ? catOf(form.qc_parent.value) : null;   // the budget form has no type switch and only top-level categories
  if (!name) { toast('Enter a name for the category'); form.qc_name.focus(); return; }
  if (D().categories.some((c) => !c.archived && (c.parent_id || null) === (parent?.id || null) && c.type === type && c.name.toLowerCase() === name.toLowerCase())) { toast('That name already exists here'); return; }
  const c = { id: uid(), parent_id: parent ? parent.id : null, name, type, icon: lastEmoji(form.qc_icon.value) || '🏷️', color: parent ? parent.color : SWATCHES[D().categories.length % SWATCHES.length], archived: false };
  D().categories.push(c);
  Analytics.track(parent ? 'add_sub_category' : 'add_category', { type, source: 'quick_add' });
  save();
  $('select[name=category]', form).innerHTML = form.dataset.form === 'budget' ? budgetCatOptions(c.id, new Set(D().budgets.map((x) => x.category_id))) : catOptions(type, c.id, true); $('select[name=category]', form).dataset.prev = c.id;
  form.qc_name.value = ''; form.qc_icon.value = '🏷️'; $('.quick-cat', form).hidden = true;
  toast(parent ? __('Added {name} under {parent}', { name, parent: parent.name }) : __('Added {name}', { name }));
}
/* active occasions whose dates include this day (an occasion without dates never matches by date) */
const occasionOn = (date) => D().occasions.filter((o) => !o.archived && o.start && date >= o.start && date <= (o.end || o.start));
/* the four ways to add money movement; the active one is highlighted and the others switch dialogs */
const kindSeg = (active) => `<div class="seg seg4">${[['expense', 'Expense'], ['income', 'Income'], ['invest', 'Invest'], ['transfer', 'Transfer']].map(([k, n]) => `<label><input type="radio" name="txkind" value="${k}" ${k === active ? 'checked' : ''}>${__(n)}</label>`).join('')}</div>`;

