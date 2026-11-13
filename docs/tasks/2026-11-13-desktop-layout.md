# Task: desktop layout pass (2026-11-13)

**Request (owner's words):** "review the entire design on the desktop and make it better. adjust when there is empty space, too long component, etc. ... audit the entire desktop pages"; then "add some sections from report there just for desktop, like money flow"; then (stretching Today to match By category) "looks weird actually, ok revert to the previous one".
**Tier:** 2 (CSS alone is Tier 1, raised: `views.js`/`activity.js` change and every desktop page moves). Design approved by the owner ("ok", 2026-11-13).
**Done when:**
- [x] 1920px: no unused strip on the right; no chart wider than ~700px; 1100px and below unchanged; no clipping at 1101, 1280, 1366, 1400px
- [x] Overview (desktop only): hero, Today, missed days left; Money Flow and By category right (`.ov-side`); Today keeps its natural height
- [x] Dark mode and 390px proof (`node tools/staging_shot.js`), Indonesian check, e2e check (`.ov-side` hidden at 390px, shown at 1280px)
**Files:** `prototype/styles.css` (last block "desktop layout pass"), `prototype/app/views.js` (`flowCard`, `overviewSide`; `viewAnalysis` uses `flowCard`), `prototype/app/activity.js` (chart bound on Overview)
**Branch / PR:** `claude/desktop-layout-audit` / https://github.com/sryajaya28/spending_tracker/pull/98
**Open / next:**
1. Built and tested (`desklayout` new, `report` fixed, full suite run; docs, change file, COSTS, learning done). Proof was local Playwright shots (staging_shot needs the smoke login): re-run `node tools/staging_shot.js` on the staging preview after the PR.
2. PR open into `staging`: wait for CI and the reviewer; owner checks staging by hand (Tier 2).
3. Not built: Report > Transactions summary column, asset page button width, small Category trend labels at 1/3 width in Analysis.
4. CSS uses `:has()`; swap for real classes if a test prefers.
