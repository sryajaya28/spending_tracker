# Task: Hide balance (2026-11-11)
**Request (owner's words):** "Hide balance on total portfolio and net worth. It connects each other, and always remember last setting when new session starts. It should hide transactions, only total portfolio, networth, and balance in the saving, investment, debt, and lent". Later: remove the (i) icon and underline "Total Balance" (tap opens the tooltip); smaller eye icon like the reference; red/green change pill.
**Tier:** 2 (`prototype/app/*.js`, display only, no database change; floor from `node tools/path_tier.js`). Raise to 3 if the setting must sync across devices (profile column and migration).
**Done when:**
- [x] One eye button on Overview and Portfolio drives one setting; remembered on the device (`stiver.hidebal.v1`).
- [x] Masks both totals, Breakdown amounts, each tab's total, account/debt/lent/holding balances, P&L, history values, chart values; never transactions or budgets.
- [x] Red/green change pill; underlined "Total Balance" opens the tooltip. Figma "Feature - hide-balance" approved by the owner.
- [x] `tests/e2e/hidebal.js` (fails on the old code), `analytics.js` assertion, docs and change file.
- [x] Released as main 3652217 (release 19, PRs 63-66); production smoke 15/15. Owner phone check (light and dark) and real iPhone still open.
**Files:** `prototype/app/{util,charts,views,events-input,invest-dialogs}.js`, `prototype/styles.css`, `prototype/i18n-id.js`, `tests/e2e/{hidebal,analytics}.js`.
**Branch / PR:** `claude/dazzling-wozniak-47lwa6` / PR to `staging` (not opened yet).
**Open / next:** device sync of the setting (needs migration), masking inside dialogs and asset detail pages (only "Total value" is masked there).
