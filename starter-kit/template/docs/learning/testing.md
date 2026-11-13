# Learning: Testing

Part of `learning.md` (index). Lessons above the line were carried over from earlier projects (starter kit); add this project's own below it, and the dated story to the Session log in `learning.md`.

- **A fake must be as strict as the real thing.** A fake database that accepted unknown columns let a real bug pass every test; a stub that returned plain objects hid a bug the platform's frozen objects exposed. Compare the fake's schema with the real one (`tools/check_fake_schema.js` pattern) and never call something working after testing only against a more forgiving stub.
- **Show a new test failing on the old code** before claiming it covers a bug.
- **Tests must not depend on today's date** (the 1st of the month broke daily tests). Use a past period or relative dates.
- Wait for the visible result, not only for "idle"; asynchronous close events need a short wait before asserting scroll position or open state.
- Rerun a lone red test once before assuming a product bug, say so in the PR, and never push on a red run.
- Do not edit the app folder or the test runner while a run is in progress (the tests serve the live folder).
- Pin the browser and test-runner versions in CI; an unpinned install picked up a newer browser and a test failed with the app unchanged. Bump on purpose, with a local run.
- Generated screenshots and caches are gitignored, or restored before committing.
- A test for a `tools/` script lives in `tools/` (a file under `tests/` raises the PR's tier).
- Headless browsers are dropped by analytics bot filters: override the bot signals for a live check; analytics query tools cache, so change the query text to force a fresh read.
- Elements with `pointer-events: none` cannot be clicked by the test driver: click by coordinates or fill the value.
- After a fix, re-run the tests for the delta, then the full suite once on the final commit; QA never retests whole builds by hand.

---
