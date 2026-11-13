# Task: overview-report (2026-11-13)
Hand-over from the design session to the next fresh session (build, after the owner approves).

**Request (owner's words):** "Overview will only show today's total spending and transaction list of today only (still with 'view all'). Transaction menu at the bottom will be reword to 'Report' with 2 sub pages: Transaction, and Analysis where budget, spending, and category will be. Highlight missing days in the past where no transaction is recorded and nudge users to fill." Later: keep the Budgets tab in the bar. Then: "The budget bar is missing from your prototype" (screenshot of the current hero with "left this month · days to go" and the thin bar).
**Tier:** 2 with design (new screen and pattern in `app/views.js`; no schema, sync or role change; `tools/path_tier.js` could not run in the design sandbox, so run it first).
**Done when:**
- [ ] Overview = hero KEEPING its budget sub-line and thin bar (as in the app today, tap goes to Budgets; the owner asked for it back) + all of today's items + missing-days card (last 7 days, today excluded, any entry counts; "Nothing to add" kept per device in localStorage, no migration). Nothing today = one "Add transaction" prompt; no missing days = no card.
- [ ] Bottom tab "Transactions" is "Report" (bar: Overview, Report, Add, Budgets, Portfolio) with Transactions | Analysis tabs; `#/transactions` keeps working; no subtitle or summary line; household filter sheet unchanged.
- [ ] Analysis = budget progress (read-only, "Budgets ›" link), Spending, Category trend, Money Flow. Open question for the owner: read-only budgets in Analysis, or none?
- [ ] Tests, analytics events (`docs/ANALYTICS.md`, `tests/e2e/analytics.js`), `context.md`, change file, `regression_scenario.md`, `docs/FEATURE_TESTS.md`.
**Files:** `prototype/app/views.js` (`viewOverview`, `viewTransactions`, `bottomNav`, `sidebar`), `prototype/styles.css`, `prototype/i18n*.js`; design: `design/report-split-mock.html` (built from the real app by `design/build_report_mock.js`).
**Branch / PR:** `claude/overview-redesign-today-fa8yzm` / none yet. Figma was not connected, so the HTML mock is the interim design; redraw in Figma (`Feature - report-split`) if the owner wants it there.
**Open / next:** mock now keeps the hero budget line and bar (builder no longer strips `.hero-bud`; rebuilt, checked light and dark). Owner approval of the mock (6 frames: 1 Overview, 2 Report Transactions, 3 Analysis, 4 Overview empty, 5 filters applied, 6 filter sheet).
