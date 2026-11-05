# Learning: UI and browser quirks (iPhone especially)

Part of `learning.md` (index). Add a line here when a mistake in this area happens; add the dated story to the Session log in `learning.md`.

- **iOS Safari and the installed Home Screen app have separate storage.** A session cannot be shared by storage; the address
  fragment is ignored when adding to the Home Screen (the manifest `start_url` wins); `navigator.share` opens a generic sheet
  that has no "Add to Home Screen". What works: the one-time handoff code (typed) and a short-lived cookie. Do not promise more.
- **`overflow: hidden` on the body does not stop the page behind a modal from scrolling on iPhone**: pin the body (`position:
  fixed` + restore scroll position on close).
- **A native `<select>` focused after a tap makes iOS open its picker again**; focusing the search box inside a custom list
  closed it (resize/scroll events); a list appended to `<body>` is inert while a modal `<dialog>` is open (keep it inside the
  dialog); a list taller than the dialog got clipped. See `dropdown.js` comments before touching it.
- Newer iOS `Intl` writes `Rp5.000` (no space) and may give IDR 2 decimals. Decimals are fixed in `expOf`; the space is forced by
  `rpSpace`. Each currency uses its own native locale (`NATIVE_LOCALE`), not the app language.
- A `:hover` background sticks after a tap on touch screens; do not use hover colours on tappable rows.
- Strict CSP: images only from `self` and `data:` (no `blob:`), connect only to Supabase. Use `createImageBitmap` and data URLs.
- `pointer-events: none` is used on enhanced `select` and `date` inputs (taps land on the label): Playwright cannot `click()`
  them; click by coordinates (`page.mouse.click`) or `fill` / `selectOption`.
- The OS calendar, OS pickers and OS share sheet look different from the app: the owner wants the **app's design** (custom
  dropdown, custom calendar), not the OS component.
- Keep text short on phones; long names must wrap or ellipsize, never push buttons off-screen. Check at 390 px wide.

