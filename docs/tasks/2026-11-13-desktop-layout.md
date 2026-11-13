# Task: desktop layout pass (2026-11-13)

**Request (owner's words):** "review the entire design on the desktop and make it better. adjust when there is empty space, too long component, etc. ... audit the entire desktop pages"; then "add some sections from report there just for desktop, like money flow"; then (stretching Today to match By category) "looks weird actually, ok revert to the previous one".
**Tier:** 2 (CSS alone is Tier 1, raised: `views.js`/`activity.js` change and every desktop page moves). Design NOT yet approved by the owner.
**Done when:**
- [ ] 1920px: no unused strip on the right; no chart wider than ~700px; 1100px and below unchanged; no clipping at 1101, 1280, 1366, 1400px
- [ ] Overview (desktop only): hero, Today, missed days left; Money Flow and By category right (`.ov-side`); Today keeps its natural height
- [ ] Dark mode and 390px proof (`node tools/staging_shot.js`), Indonesian check, e2e check (`.ov-side` hidden at 390px, shown at 1280px)
**Files:** `prototype/styles.css` (last block "desktop layout pass"), `prototype/app/views.js` (`flowCard`, `overviewSide`; `viewAnalysis` uses `flowCard`), `prototype/app/activity.js` (chart bound on Overview)
**Branch / PR:** `claude/desktop-layout-audit` (WIP commit pushed) / no PR yet
**Open / next:**
1. Show the owner the Overview and get "ok" (still-open: empty space under Today on quiet days; Spending donut is the swap for By category).
2. Add the repo's required docs: change file, `context.md`, `regression_scenario.md`, `docs/FEATURE_TESTS.md`, `learning.md` log, `docs/COSTS.md`; run `bash tests/e2e/run_all.sh`; then PR into `staging`.
3. Not built: Report > Transactions summary column, asset page button width, small Category trend labels at 1/3 width in Analysis.
4. Rules in the CSS use `:has()`; swap for real classes if tests prefer. Audit shots and the CSS mock are in session scratch only (not saved).
