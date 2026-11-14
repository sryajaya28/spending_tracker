# Task: Portfolio + asset page design (2026-11-14)
Hand-over from the Analysis + Budgets session. Docs/Figma only, branch `claude/relaxed-tesla-nim74n`, no PR, no subagents.

**Request (owner's words):** "Continue the Stiver redesign, design phase, in Figma ... (d) Portfolio + asset page (140-147), then the tabs Debt, Investment, Lent and the P&L month view (not drawn at all)." Day page is PARKED: leave frames 215-* and [PARKED] alone.
**Tier:** none (Figma + docs only); the build slices get their tier in `docs/design-handover/`.
**Done when:**
- [ ] Controls of `viewPortfolio` (+ asset page, tabs, P&L view, helpers, how each is reached via its `data-act`) listed from the code; frames 140/142, 144/145 (Portfolio) and 141/143, 146/147 (Asset) fixed both ways (nothing invented, nothing missing); missing tabs/P&L drawn, charts as labelled grey boxes
- [ ] Phone + desktop, dark + light; measured (overflow, text in parent, 4.5:1, 44px, nav, no TEMP) and LOOKED at in both themes before reporting
- [ ] Redesign task file NEXT line, hand-over section 3 tick with frame ids, learning.md Session log, commit, push
**Files:** `prototype/app/charts.js` (holds `viewPortfolio`), `invest-dialogs.js`, `views.js`, `events-input.js`; docs `2026-11-14-design-handover.md`, `2026-11-13-redesign.md`.
**Done already:** (b) Analysis 120/122/138/139 and (c) Budgets 132/134/136/137 fixed, measured, pushed (b56742b), awaiting owner approval; owner answered "Default" to all open questions (kept: phone Budgets month pill `Nov`, letter tiles).
**Open / next:** after (d): (e) Settings hub + sub-pages (133/135, 148/149), (f) dialogs, (g) states, then `docs/design-handover/` (not before). Open owner points: desktop Analysis layout (Figma 2 columns vs code row grid / 3-up from 1400px), keep as CSS-only note.
