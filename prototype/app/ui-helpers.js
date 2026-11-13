'use strict';
/* Stiver app: toast, month picker, hash routing. Part of the former prototype/app.js; see docs/MAP.md. */
/* ---------- ui helpers ---------- */
function toast(msg) {
  const el = $('#toast');
  el.textContent = __(msg); el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}
/* a dropdown with more than SEARCH_OVER real choices (the blank "All ..." / "None" entry does not count) gets the search box on top: add searchAttr(optionsHtml, msg) to the <select> tag, or syncSearch(select, msg) after its options were replaced. The search matches the option's data-s (the name) when it has one. */
const SEARCH_OVER = 5;
const searchAttr = (optionsHtml, msg) => ((optionsHtml.match(/<option value="[^"]/g) || []).length > SEARCH_OVER ? ` data-search data-empty="${__(msg)}"` : '');
const syncSearch = (sel, msg) => { sel.toggleAttribute('data-search', [...sel.options].filter((o) => o.value).length > SEARCH_OVER); sel.dataset.empty = __(msg); };
const tile = (c, sm) => `<span class="tile ${sm ? 'sm' : ''}" style="--c:${c ? c.color : '#94A3B8'}">${c ? c.icon : '❔'}</span>`;
/* the periods the pickers offer: from the one holding the first transaction up to the current one (at least the last 6) */
function periodChoices() {
  const first = (D().transactions || []).reduce((m, t) => (t.occurred_at < m ? t.occurred_at : m), '9999-12-31'), cur = currentPeriod();
  const from = first === '9999-12-31' ? cur : periodKeyOf(first), months = (+cur.slice(0, 4) - +from.slice(0, 4)) * 12 + (+cur.slice(5, 7) - +from.slice(5, 7)) + 1;
  return lastMonths(Math.min(240, Math.max(6, months)));
}
const monthSelect = (short, withAll) => `<select class="pill-select" data-bind="month" aria-label="${__('Month')}">${withAll ? `<option value="all" ${state.ui.allPeriods ? 'selected' : ''}>${__('All periods')}</option>` : ''}${[...new Set([...periodChoices(), state.ui.month])].sort().reverse().map((k) => `<option value="${k}" ${k === state.ui.month && !(withAll && state.ui.allPeriods) ? 'selected' : ''}>${short ? periodShort(k) : monthLabel(k)}</option>`).join('')}</select>`;
const routeParts = () => (location.hash.replace('#/', '') || 'overview').split('?')[0].split('/');
const route = () => { const r = routeParts()[0]; return r === 'wallets' ? 'portfolio' : r; };
const routeArg = () => routeParts()[1] || '';

