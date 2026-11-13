# Tier 1: Fast Track (presentation only), workflow v2

**Eligible:** text and copy, spacing and styling (CSS), icons and images, translations (`i18n*.js`), docs, tooling. Nothing that changes data, logic or what any user can access. `app.js` is never Tier 1. Budget: under $0.30 per task.

**Load only:** `CLAUDE.md`, this file, the "Which tier" table and "Escalation triggers" in `docs/workflows/README.md` (ignore its intake, role and model sections: v2 replaced them), `docs/changes/README.md`.

**Flow (one session, one branch off `staging`, one PR)**
1. Restate the request as 2 to 5 done-when checks. Build and self-test locally (`node tools/affected_tests.js`).
2. Open the PR. CI labels it with its tier; the browser suite is skipped for Tier 1 by design (`ci.yml`), so the other required checks are the gate. A red check blocks the merge, no override.
3. Wait with one command (`node tools/ci_wait.js <pr>`); no "check CI" turns.
4. UI-visible change (CSS, copy, translations): take phone-width and dark-mode screenshots (`node tools/staging_shot.js`) and put them in the PR; both languages if text changed.
5. Say in the PR that no logic, data or access path changed. If that is untrue, or the diff passes about 50 changed lines or touches `app.js`, stop: it is Tier 2.
6. Merge to `staging` once CI is green; no per-change owner wait. The owner looks at the batch of screenshots once and says "Release" once per batch.

**Review:** CI only. No bot, no second session.

**Docs in the same PR:** a change file `docs/changes/YYYY-MM-DD-name.md`, a `docs/tasks/` file only if work is left over, a row in `docs/COSTS.md` and a `learning.md` session-log line when the task ends.

**Releasing a Tier 1 batch (a fresh release session, `docs/tasks/RELEASE.md`, after the owner's "Release" in chat):** no regression run and no production smoke test. Merge `staging` into `main`, then check only that the site answers 200 and serves the new build stamp (`node tools/ship.js`).

**How the tools know (`tools/gates.js`):** a release skips regression and the smoke test when its only non-docs changes come from commits listed in `docs/workflows/tier1-approved.txt` (short sha, then the owner's words; add a line only when the owner says so in chat, because the path rule calls every `app.js` change Tier 2) and no changed file is Tier 3. Docs- and tooling-only releases skip them as before. `--force` runs regression anyway. Test: `node tools/gates.test.js`.
