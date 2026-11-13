# Learning: UI and browser quirks (phones especially)

Part of `learning.md` (index). Lessons above the line were carried over from earlier projects (starter kit); add this project's own below it, and the dated story to the Session log in `learning.md`.

- **Check every screen at 390 px wide and in dark mode before showing it**, with the real content that was reported. A test page without a viewport meta tag runs at 980 px and hides overflow.
- Long text (names, URLs) must wrap or ellipsize, never push buttons off-screen: `overflow-wrap: anywhere`, `min-width: 0` on grid and flex children.
- Choice cards need a visible selected state; optional fields are labelled optional.
- **iOS Safari and the installed Home Screen app have separate storage**; the address fragment is ignored when adding to the Home Screen (the manifest `start_url` wins). A sign-in cannot be handed over by storage: use a one-time typed code or a short-lived cookie. Do not promise more.
- `overflow: hidden` on the body does not stop the page behind a modal from scrolling on iPhone: pin the body (`position: fixed`) and restore the scroll position on close.
- A list appended to `<body>` is inert while a modal `<dialog>` is open: keep popovers inside the dialog. A native `<select>` focused after a tap reopens its picker on iOS.
- A `:hover` background sticks after a tap on touch screens: no hover colours on tappable rows.
- Newer iOS `Intl` formats some currencies differently (no space, extra decimals): fix decimals and spacing yourself, and format each currency in its own locale, not the app language.
- With a strict CSP, images come only from `self` and `data:`; use data URLs, not `blob:`.
- The owner wants the app's own design (custom dropdown, custom calendar), not OS pickers and share sheets.
- Dark mode as a design-variable mode costs almost nothing when every colour is a variable from the first screen.

---
