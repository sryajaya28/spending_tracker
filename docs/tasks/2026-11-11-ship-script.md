# Task: ship script, COST_PLAN B2 (2026-11-11)
**Request (owner's words):** Read docs/workflows/COST_PLAN.md and do item B2.
**Tier:** 1 (floor from `node tools/path_tier.js`: only tools/ and docs/ change)
**Done when:**
- [x] `tools/ship.js` waits for the merge and the build stamp, checks 200, runs smoke when needed, writes the release record
- [x] offline test `node tools/ship.test.js` passes; record generation tried on a real past merge
- [ ] first live run on a real release (needs `gh` signed in or `--sha`, stiver.io reachable, SMOKE_PROD_PASSWORD)
**Files:** tools/ship.js, tools/ship.test.js, docs/workflows/COST_PLAN.md, context.md
**Branch / PR:** feature/ship-script / PR not opened yet
**Open / next:** B1 (`tools/ci_wait.js`) is not built yet; B4 tier files still describe v1.
