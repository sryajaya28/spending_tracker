# Task: desktop layout pass (2026-11-13)

**Request (owner's words):** "can review the entire design on the desktop and make it better? adjust when there is empty space, too long component, etc. ... i want you to do the audit for the entire desktop pages" and later "still too many empty space, maybe add some sections from report there just for desktop? like money flow for example"
**Tier:** 2 (path rule gives 1 for CSS; raised: `app/views.js` and `app/activity.js` change, and every desktop page moves)
**Done when:**
- [ ] No desktop page leaves an unused strip on the right at 1920px; no chart wider than about 700px
- [ ] Overview (desktop only) shows Money Flow and By category beside the hero and Today; Today stretches so the left column ends level with By category
- [ ] 1100px and below is unchanged; no clipping at 1101, 1280, 1366, 1400px
- [ ] Owner approved the design (NOT yet: mock shown in chat, awaiting "ok"); dark-mode and phone proof shot
**Files:** `prototype/styles.css` (last block, "desktop layout pass"), `prototype/app/views.js` (`flowCard`, `overviewSide`), `prototype/app/activity.js` (flow chart bound on Overview)
**Branch / PR:** `claude/desktop-layout-audit` / none yet
**Open / next:** WIP mock only. Not run: e2e suite, dark mode, Indonesian. Replace the `:has()` hooks with real classes if tests prefer; add an e2e check (ov-side hidden at 390px, visible at 1280px), change file, `context.md`, `regression_scenario.md`, `docs/FEATURE_TESTS.md`, `learning.md` log, `docs/COSTS.md`. Not done: Report > Transactions summary column, asset page button width, Category trend label size at one-third width.
