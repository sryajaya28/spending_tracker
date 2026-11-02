'use strict';
/* Stiver dropdown: every <select> keeps its native element (value, change events, forms, tests) but its list opens as an
   app-styled popover instead of the operating system's picker. The select itself stays visible and is only made
   non-interactive by CSS (pointer-events: none), so a tap lands on its parent: we find the select under the pointer here.
   Add data-native to a select to keep the OS picker. */
(() => {
  let pop = null, empty = null, cur = null, openedByKey = false, openedAt = 0, lastClosed = { sel: null, at: 0 }, lastDown = { sel: null, x: 0, y: 0, at: 0 }, rows = [], act = -1, typed = '', typedAt = 0;
  const isEnh = (s) => !!s && s.tagName === 'SELECT' && !s.hasAttribute('data-native') && !s.multiple;

  function close(byOutside) {
    empty = null;
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
  function step(dir) { let i = act; do { i += dir; } while (rows[i] && (rows[i].opt.disabled || rows[i].hidden)); if (rows[i]) setActive(i); }

  function choose(i) {
    const r = rows[i]; if (!r || r.opt.disabled) return;
    const sel = cur, changed = sel.value !== r.opt.value, keyboard = openedByKey;
    close();
    if (changed) { sel.value = r.opt.value; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    // focus goes back to the field only when it was opened from the keyboard: focusing a <select> after a tap makes iOS open its own picker again
    if (keyboard) sel.focus({ preventScroll: true }); else if (document.activeElement === sel) sel.blur();
  }

  function open(sel, byKey) {
    if (!byKey && cur === sel && Date.now() - openedAt < 350) return;           // the label can forward a second click
    close();
    cur = sel; openedByKey = !!byKey; openedAt = Date.now(); sel.setAttribute('aria-expanded', 'true');
    pop = document.createElement('div'); pop.className = 'cs-pop'; pop.setAttribute('role', 'listbox');
    const list = document.createElement('div'); list.className = 'cs-scroll';   // only this part scrolls: the search box stays on top and the add entry at the bottom
    const add = (opt, parent) => {   // data-list: a short label in the field can have a fuller one in the list
      const cta = opt.hasAttribute('data-cta');
      if (cta && empty) parent.appendChild(empty);   // the "not found" note sits just above the add entry (the last item of the scrolling list)
      const el = document.createElement('div'); el.className = 'cs-opt' + (opt.selected && !cta ? ' on' : '') + (opt.disabled ? ' dis' : '') + (cta ? ' cs-cta' : ''); el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', String(opt.selected)); const t = document.createElement('span'); t.textContent = opt.dataset.list || opt.textContent; el.appendChild(t);
      if (opt.dataset.tag) { const g = document.createElement('span'); g.className = 'cs-tag'; g.textContent = opt.dataset.tag; el.appendChild(g); }   // data-tag: a small label at the end of the row (e.g. "Budget Added")
      const i = rows.length; rows.push({ opt, el, cta, hidden: false, key: (opt.dataset.s || opt.textContent).toLowerCase() });
      el.addEventListener('click', (e) => { e.stopPropagation(); choose(i); });
      el.addEventListener('pointermove', () => { if (act !== i) setActive(i, false); });
      parent.appendChild(el);
    };
    if (sel.hasAttribute('data-search')) {   // a search box on top of long lists (tap it to type; the keyboard is not opened for you)
      const q = document.createElement('input'); q.className = 'cs-search'; q.type = 'search'; q.autocomplete = 'off'; q.placeholder = (window.__ ? window.__('Search') : 'Search');
      q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); rows.forEach((r) => { r.hidden = !r.cta && !!v && !r.key.includes(v); r.el.style.display = r.hidden ? 'none' : ''; }); if (empty) empty.style.display = v && !rows.some((r) => !r.cta && !r.hidden) ? '' : 'none'; const first = rows.findIndex((r) => !r.hidden && !r.opt.disabled && !r.cta); if (first >= 0) setActive(first); });
      pop.appendChild(q);
      if (sel.dataset.empty) { empty = document.createElement('div'); empty.className = 'cs-empty'; empty.textContent = sel.dataset.empty; empty.style.display = 'none'; }
    }
    [...sel.children].forEach((n) => {
      if (n.tagName === 'OPTGROUP') { const g = document.createElement('div'); g.className = 'cs-group'; g.textContent = n.label; list.appendChild(g); [...n.children].forEach((o) => add(o, list)); }
      else if (n.tagName === 'OPTION') add(n, list);
    });
    pop.appendChild(list);
    // top layer: a popover sits above the open <dialog> and is not clipped by it (inside the dialog the end of a long list was cut off by the dialog edge)
    (sel.closest('dialog') || document.body).appendChild(pop);   // it must stay inside the modal dialog (everything outside it is inert)
    if (pop.showPopover) { pop.popover = 'manual'; try { pop.showPopover(); } catch { /* stays a plain fixed element */ } }
    const vvp = window.visualViewport, r = sel.getBoundingClientRect(), vw = innerWidth, vh = vvp ? vvp.offsetTop + vvp.height : innerHeight, w = Math.min(Math.max(r.width, 200), vw - 16);
    const below = vh - r.bottom - 28, above = r.top - 12, want = Math.min(pop.scrollHeight + 2, 300);
    const up = below < Math.min(want, 200) && above > below, room = Math.max(120, up ? above : below);
    pop.style.width = w + 'px'; pop.style.maxHeight = Math.min(300, room) + 'px';
    pop.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + 'px';
    if (up) pop.style.bottom = (vh - r.top + 6) + 'px'; else pop.style.top = (r.bottom + 6) + 'px';
    const on = rows.findIndex((x) => x.opt.selected); setActive(on >= 0 ? on : rows.findIndex((x) => !x.opt.disabled));
  }

  // a tap/click on a select: it is pointer-events:none, so the event lands on its parent. Find the select under the pointer.
  document.addEventListener('click', (e) => {
    const justClosed = lastClosed; lastClosed = { sel: null, at: 0 };   // only the click right after an outside tap can be that same tap
    if (pop && pop.contains(e.target)) return;
    let sel = isEnh(e.target) ? e.target : hit(e.clientX, e.clientY);
    if (!sel && lastDown.sel && lastDown.sel.isConnected && Date.now() - lastDown.at < 800 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 24) sel = lastDown.sel;
    if (!sel || sel.disabled) return;
    e.preventDefault(); e.stopPropagation();
    if (justClosed.sel === sel && Date.now() - justClosed.at < 400) return;   // the tap that just closed the list
    if (cur === sel && Date.now() - openedAt > 350) close(); else open(sel);
  }, true);

  const hit = (x, y) => { const root = document.querySelector('dialog[open]') || document; for (const s of root.querySelectorAll('select')) { if (!isEnh(s) || s.disabled || !s.getClientRects().length) continue; const r = s.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return s; } return null; };
  document.addEventListener('pointerdown', (e) => {
    if (pop && !pop.contains(e.target) && e.target !== cur) close(true);
    lastDown = { sel: pop && pop.contains(e.target) ? null : hit(e.clientX, e.clientY), x: e.clientX, y: e.clientY, at: Date.now() };   // remember what was under the finger: the layout can shift before the click (keyboard closing)
  }, true);
  document.addEventListener('keydown', (e) => {
    if (pop) {
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (k === 'ArrowDown') { e.preventDefault(); step(1); } else if (k === 'ArrowUp') { e.preventDefault(); step(-1); }
      else if (k === 'Home') { e.preventDefault(); setActive(0); } else if (k === 'End') { e.preventDefault(); setActive(rows.length - 1); }
      else if (k === 'Enter' || (k === ' ' && !(e.target && e.target.classList && e.target.classList.contains('cs-search')))) { e.preventDefault(); choose(act); }
      else if (k === 'Tab') close();
      else if (k.length === 1 && !(e.target && e.target.classList && e.target.classList.contains('cs-search'))) {   // type to jump to an option
        typed = (Date.now() - typedAt > 600 ? '' : typed) + k.toLowerCase(); typedAt = Date.now();
        const i = rows.findIndex((r) => !r.opt.disabled && r.opt.textContent.trim().toLowerCase().startsWith(typed)); if (i >= 0) setActive(i);
      }
      return;
    }
    if (isEnh(e.target) && [' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); open(e.target, true); }
  }, true);
  document.addEventListener('cancel', (e) => { if (pop) e.preventDefault(); }, true);   // Esc closes the list, not the dialog
  // typing in the list's search box opens the phone keyboard, which resizes/scrolls the page: keep the list open then and fit it above the keyboard
  const typing = () => pop && pop.contains(document.activeElement);
  const fit = () => { const vv = window.visualViewport; if (!pop || !vv || !pop.style.top) return; const r = pop.getBoundingClientRect(); pop.style.maxHeight = Math.max(140, Math.min(320, vv.offsetTop + vv.height - r.top - 8)) + 'px'; };
  addEventListener('resize', () => { if (typing()) fit(); else close(); });
  addEventListener('scroll', (e) => { if (pop && !typing() && !pop.contains(e.target)) close(); }, true);
  if (window.visualViewport) { visualViewport.addEventListener('resize', () => { if (typing()) fit(); }); visualViewport.addEventListener('scroll', () => { if (typing()) fit(); }); }
  new MutationObserver(() => { if (cur && !cur.isConnected) close(); }).observe(document.body, { childList: true, subtree: true });
})();
