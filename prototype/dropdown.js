'use strict';
/* Stiver dropdown: every <select> keeps its native element (value, change events, forms, tests) but its list opens as an
   app-styled popover instead of the operating system's picker. The select itself stays visible and is only made
   non-interactive by CSS (pointer-events: none), so a tap lands on its parent: we find the select under the pointer here.
   Add data-native to a select to keep the OS picker. */
(() => {
  let pop = null, cur = null, openedAt = 0, lastClosed = { sel: null, at: 0 }, rows = [], act = -1, typed = '', typedAt = 0;
  const isEnh = (s) => !!s && s.tagName === 'SELECT' && !s.hasAttribute('data-native') && !s.multiple;

  function close(byOutside) {
    if (pop) pop.remove();
    if (cur) { cur.removeAttribute('aria-expanded'); if (byOutside) lastClosed = { sel: cur, at: Date.now() }; }
    pop = null; cur = null; rows = []; act = -1;
  }

  function setActive(i, scroll = true) {
    if (!rows.length) return;
    act = Math.max(0, Math.min(rows.length - 1, i));
    rows.forEach((r, k) => r.el.classList.toggle('act', k === act));
    if (scroll) rows[act].el.scrollIntoView({ block: 'nearest' });
  }
  function step(dir) { let i = act; do { i += dir; } while (rows[i] && rows[i].opt.disabled); if (rows[i]) setActive(i); }

  function choose(i) {
    const r = rows[i]; if (!r || r.opt.disabled) return;
    const sel = cur, changed = sel.value !== r.opt.value;
    close();
    if (changed) { sel.value = r.opt.value; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    sel.focus({ preventScroll: true });
  }

  function open(sel, byKey) {
    if (!byKey && cur === sel && Date.now() - openedAt < 350) return;           // the label can forward a second click
    close();
    cur = sel; openedAt = Date.now(); sel.setAttribute('aria-expanded', 'true');
    pop = document.createElement('div'); pop.className = 'cs-pop'; pop.setAttribute('role', 'listbox');
    const add = (opt, parent) => {
      const el = document.createElement('div'); el.className = 'cs-opt' + (opt.selected ? ' on' : '') + (opt.disabled ? ' dis' : ''); el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', String(opt.selected)); const t = document.createElement('span'); t.textContent = opt.textContent; el.appendChild(t);
      const i = rows.length; rows.push({ opt, el });
      el.addEventListener('click', (e) => { e.stopPropagation(); choose(i); });
      el.addEventListener('pointermove', () => { if (act !== i) setActive(i, false); });
      parent.appendChild(el);
    };
    [...sel.children].forEach((n) => {
      if (n.tagName === 'OPTGROUP') { const g = document.createElement('div'); g.className = 'cs-group'; g.textContent = n.label; pop.appendChild(g); [...n.children].forEach((o) => add(o, pop)); }
      else if (n.tagName === 'OPTION') add(n, pop);
    });
    (sel.closest('dialog') || document.body).appendChild(pop);   // inside the open <dialog> so it shows above it
    const r = sel.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, w = Math.min(Math.max(r.width, 200), vw - 16);
    const below = vh - r.bottom - 12, above = r.top - 12, want = Math.min(pop.scrollHeight + 2, 320);
    const up = below < Math.min(want, 200) && above > below, room = Math.max(120, up ? above : below);
    pop.style.width = w + 'px'; pop.style.maxHeight = Math.min(320, room) + 'px';
    pop.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + 'px';
    if (up) pop.style.bottom = (vh - r.top + 6) + 'px'; else pop.style.top = (r.bottom + 6) + 'px';
    const on = rows.findIndex((x) => x.opt.selected); setActive(on >= 0 ? on : rows.findIndex((x) => !x.opt.disabled));
  }

  // a tap/click on a select: it is pointer-events:none, so the event lands on its parent. Find the select under the pointer.
  document.addEventListener('click', (e) => {
    const justClosed = lastClosed; lastClosed = { sel: null, at: 0 };   // only the click right after an outside tap can be that same tap
    if (pop && pop.contains(e.target)) return;
    let sel = isEnh(e.target) ? e.target : null;
    if (!sel) {
      const root = document.querySelector('dialog[open]') || document;
      for (const s of root.querySelectorAll('select')) {
        if (!isEnh(s) || s.disabled || !s.getClientRects().length) continue;
        const r = s.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { sel = s; break; }
      }
    }
    if (!sel || sel.disabled) return;
    e.preventDefault(); e.stopPropagation();
    if (justClosed.sel === sel && Date.now() - justClosed.at < 400) return;   // the tap that just closed the list
    if (cur === sel && Date.now() - openedAt > 350) close(); else open(sel);
  }, true);

  document.addEventListener('pointerdown', (e) => { if (pop && !pop.contains(e.target) && e.target !== cur) close(true); }, true);
  document.addEventListener('keydown', (e) => {
    if (pop) {
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (k === 'ArrowDown') { e.preventDefault(); step(1); } else if (k === 'ArrowUp') { e.preventDefault(); step(-1); }
      else if (k === 'Home') { e.preventDefault(); setActive(0); } else if (k === 'End') { e.preventDefault(); setActive(rows.length - 1); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(act); }
      else if (k === 'Tab') close();
      else if (k.length === 1) {   // type to jump to an option
        typed = (Date.now() - typedAt > 600 ? '' : typed) + k.toLowerCase(); typedAt = Date.now();
        const i = rows.findIndex((r) => !r.opt.disabled && r.opt.textContent.trim().toLowerCase().startsWith(typed)); if (i >= 0) setActive(i);
      }
      return;
    }
    if (isEnh(e.target) && [' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); open(e.target, true); }
  }, true);
  document.addEventListener('cancel', (e) => { if (pop) e.preventDefault(); }, true);   // Esc closes the list, not the dialog
  addEventListener('resize', () => close());
  addEventListener('scroll', (e) => { if (pop && !pop.contains(e.target)) close(); }, true);
  new MutationObserver(() => { if (cur && !cur.isConnected) close(); }).observe(document.body, { childList: true, subtree: true });
})();
