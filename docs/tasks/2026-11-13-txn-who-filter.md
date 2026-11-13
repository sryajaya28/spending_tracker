# Task: Transactions names and person filter (2026-11-13)

**Request (owner's words):** When edit access is only owned by the owner, no need to show user name under transaction page. Only show name when there are at least 2 editors. also when there're at least 2 editors, on transaction page should have a filter based on name
**Tier:** 3 (path floor says 1, but it changes what roles see; owner confirmed fast lane, writers = owner + Editors)
**Done when:**
- [x] one writer: no names under rows, no person filter
- [x] 2+ writers: names shown and a person filter (owner, Editors, removed member with entries)
- [x] e2e `household_labels` covers both; Bahasa strings, ANALYTICS, context.md, FEATURE_TESTS updated
**Files:** prototype/app/household.js, views.js, state.js, events-input.js, i18n-id.js, tests/e2e/household_labels.js
**Branch / PR:** claude/txn-who-filter / not pushed yet
**Figma:** https://www.figma.com/design/DnfE4wtwMDGQyOW76MkVRW?node-id=100-1006 (built after the code, fast lane)
**Open / next:** push the branch + PR, CI, one fresh diff-only review (Tier 3), owner staging check; cost row in docs/COSTS.md
