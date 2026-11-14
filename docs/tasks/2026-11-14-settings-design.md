# Task: Settings hub + sub-pages design (2026-11-14)
Hand-over from the Portfolio session. Docs/Figma only, branch `claude/relaxed-tesla-nim74n`, no PR, no subagents.

**Request (owner's words):** "Continue the Stiver redesign, design phase, in Figma ... (e) Settings hub and sub-pages (133/135 phone, 148/149 desktop)". Day page is PARKED (frames 215-*, `[PARKED]`): leave alone.
**Tier:** none (Figma + docs only).
**Done when:**
- [ ] Controls of `settingsHub` + every sub-page in `SETTINGS_PAGES` (`prototype/app/views.js` ~474-520, plus the files each page function lives in) listed from the code with the `data-act` that opens each one; hub 133/135 + 148/149 fixed both ways, every sub-page drawn (language, reporting currency, household, categories incl. archived, accounts incl. archived, occasions, recurring, data / sample data, support, sign out / delete login, profile); Household page only when the code shows it
- [ ] Phone + desktop, dark + light; measured (overflow, text in parent, 4.5:1, 44px, nav, no TEMP) and LOOKED at in both themes; real screenshots sent before asking for approval
- [ ] Redesign task file NEXT line, hand-over section 3 tick with frame ids, learning.md Session log, commit, push
**Files:** `prototype/app/views.js`, `events-input.js`, `household.js`; docs `2026-11-14-design-handover.md`, `2026-11-13-redesign.md`.
**Done already:** (a) Day PARKED, (b) Analysis, (c) Budgets, (d) Portfolio phone + desktop incl. Debt / Investment / Lent tabs, P&L month, Asset page: all owner approved. Owner rules added in (d): phone Asset detail page has NO bottom nav (build slice hides it on `#/portfolio/<holding id>`); desktop cards must end at the same right edge as the Breakdown card (1008 wide in the 1280 frame).
**Open / next:** (f) dialogs and (g) states (Portfolio conditional states are listed in the hand-over (d) line), then `docs/design-handover/` (not before).
