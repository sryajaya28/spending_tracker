'use strict';
/* Stiver date picker: every <input type="date"> keeps its native element (value, ISO format, forms, tests) but its calendar opens as
   an app-styled popover instead of the operating system's calendar. The input is made non-interactive by CSS (pointer-events: none),
   so a tap lands on its label; we find the date input there. Add data-native to keep the OS calendar. Respects min / max. */
(() => {
  let pop = null, cur = null, view = null;
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? new Date(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10)) : null);
  const loc = () => (typeof locale === 'function' ? locale() : 'en');
  const L = (s) => (window.__ ? window.__(s) : s);
  const isDate = (el) => !!el && el.tagName === 'INPUT' && el.type === 'date' && !el.hasAttribute('data-native') && !el.disabled && !el.readOnly;

  function close() { if (pop) pop.remove(); pop = null; if (cur) cur.removeAttribute('aria-expanded'); cur = null; view = null; }

  function build() {
    const min = cur.min || '', max = cur.max || '', sel = cur.value || '', today = iso(new Date()), first = loc().startsWith('id') ? 1 : 0;   // weeks start on Monday in Indonesian, Sunday otherwise
    const y = view.getFullYear(), m = view.getMonth(), lead = (new Date(y, m, 1).getDay() - first + 7) % 7, days = new Date(y, m + 1, 0).getDate();
    const wk = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(loc(), { weekday: 'short' }).format(new Date(2023, 0, 1 + ((i + first) % 7))).slice(0, 2));   // 2023-01-01 is a Sunday
    const cells = [...Array(lead).fill('<span></span>'), ...Array.from({ length: days }, (_, i) => {
      const d = iso(new Date(y, m, i + 1)), off = (min && d < min) || (max && d > max);
      return `<button type="button" class="dp-day${d === sel ? ' on' : ''}${d === today ? ' today' : ''}" data-d="${d}" ${off ? 'disabled' : ''} aria-label="${d}" ${d === sel ? 'aria-pressed="true"' : ''}>${i + 1}</button>`;
    })].join('');
    const title = new Intl.DateTimeFormat(loc(), { month: 'long', year: 'numeric' }).format(view);
    const todayOk = !((min && today < min) || (max && today > max));
    pop.innerHTML = `<div class="dp-head"><button type="button" class="dp-nav" data-nav="-1" aria-label="${L('Previous month')}">‹</button><b class="dp-title">${title}</b><button type="button" class="dp-nav" data-nav="1" aria-label="${L('Next month')}">›</button></div>
      <div class="dp-wk">${wk.map((w) => `<span>${w}</span>`).join('')}</div><div class="dp-grid">${cells}</div>
      <div class="dp-foot"><button type="button" class="dp-today" data-today ${todayOk ? '' : 'disabled'}>${L('Today')}</button></div>`;
  }

  function place() {
    const vvp = window.visualViewport, r = cur.getBoundingClientRect(), vw = innerWidth, vh = vvp ? vvp.offsetTop + vvp.height : innerHeight, w = Math.min(320, vw - 16);
    pop.style.width = w + 'px'; pop.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + 'px'; pop.style.top = ''; pop.style.bottom = '';
    const h = pop.offsetHeight, below = vh - r.bottom - 12, above = r.top - 12;
    if (below >= h || below >= above) pop.style.top = Math.max(8, Math.min(r.bottom + 6, vh - h - 8)) + 'px'; else pop.style.bottom = (vh - r.top + 6) + 'px';
  }

  function open(inp) {
    close(); cur = inp; inp.setAttribute('aria-expanded', 'true');
    const d = parse(inp.value) || new Date(); view = new Date(d.getFullYear(), d.getMonth(), 1);
    pop = document.createElement('div'); pop.className = 'dp-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', L('Choose a date'));
    build();
    (inp.closest('dialog') || document.body).appendChild(pop);   // must stay inside the modal dialog (everything outside it is inert)
    if (pop.showPopover) { pop.popover = 'manual'; try { pop.showPopover(); } catch { /* stays a plain fixed element */ } }
    place();
  }

  function pick(d) {
    cur.value = d; cur.dispatchEvent(new Event('input', { bubbles: true })); cur.dispatchEvent(new Event('change', { bubbles: true }));
    const inp = cur; close(); if (document.activeElement === inp) inp.blur();
  }

  const find = (target) => { if (isDate(target)) return target; const lab = target && target.closest && target.closest('label'); const i = lab && lab.querySelector('input[type=date]'); return isDate(i) ? i : null; };

  document.addEventListener('click', (e) => {
    if (pop && pop.contains(e.target)) {
      const nav = e.target.closest('[data-nav]'), day = e.target.closest('.dp-day'), today = e.target.closest('[data-today]');
      if (nav) { view = new Date(view.getFullYear(), view.getMonth() + +nav.dataset.nav, 1); build(); place(); }
      else if (day && !day.disabled) pick(day.dataset.d);
      else if (today && !today.disabled) pick(iso(new Date()));
      e.preventDefault(); e.stopPropagation(); return;
    }
    const inp = find(e.target); if (!inp) return;
    e.preventDefault(); e.stopPropagation();   // no OS calendar, and the label must not focus the field
    if (cur === inp) close(); else open(inp);
  }, true);
  document.addEventListener('pointerdown', (e) => { if (pop && !pop.contains(e.target) && find(e.target) !== cur) close(); }, true);
  document.addEventListener('keydown', (e) => {
    if (pop) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } return; }
    if (isDate(e.target) && [' ', 'Enter', 'ArrowDown'].includes(e.key) && (e.key !== 'ArrowDown' || e.altKey)) { e.preventDefault(); open(e.target); }
  }, true);
  document.addEventListener('cancel', (e) => { if (pop) e.preventDefault(); }, true);   // Esc closes the calendar, not the dialog
  addEventListener('resize', () => close());
  addEventListener('scroll', (e) => { if (pop && !pop.contains(e.target)) close(); }, true);
  new MutationObserver(() => { if (cur && !cur.isConnected) close(); }).observe(document.body, { childList: true, subtree: true });
})();
