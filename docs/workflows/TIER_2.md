# Tier 2: Standard, workflow v2

**Typical work:** a new feature on existing data, flow changes, `app.js` logic, integrations that write no data. Budget: under $2 per task.

**Load only:** `CLAUDE.md`, this file, the "Which tier" table and "Escalation triggers" in `docs/workflows/README.md`, `context.md` by section, the `learning.md` rows for the area touched, `docs/FEATURE_TESTS.md`, `docs/ANALYTICS.md` if a button, form or outcome is added.

**Flow (one session on Sonnet 5.5, one branch off `staging`, one PR)**
1. **Requirements:** restate the request as 2 to 5 done-when checks and ask every open question once, with a recommended default, in one message. The owner's answer is the requirements gate. No PRD, no PM session.
2. **Design:** only for a new screen or interaction pattern: Figma first (file "Stiver", `docs/FIGMA.md`), dark mode and phone width, then build after the owner approves ("fast lane": post the link and build at once). No Designer session.
3. **Build:** the same session. Tests ship with the change (new e2e or unit tests, shown failing on the old code for a bug fix). Update `context.md`, `regression_scenario.md`, `docs/FEATURE_TESTS.md`, event tracking (`data-act`, `data-form`, `Analytics.track`, `tests/e2e/analytics.js`, `docs/ANALYTICS.md`) and a change file in the same PR. Run `node tools/affected_tests.js` before every push.
4. **Review:** CI (path-rule label plus the browser suite) and the automated PR reviewer (GitHub Copilot code review, a different vendor and model; decided, install is the owner's step). Fix every valid finding and answer the rest in one reply on the PR. No Tech-Lead or second Claude session. Until the reviewer is installed, say so in the PR and rely on CI plus the owner's staging check.
5. **QA is tests:** the e2e suite in CI. No QA session. After a fix, re-run only the tests for the delta, then the full suite once on the final commit.
6. **Staging:** merge to `staging` when CI is green and review is answered. The owner checks staging by hand and signs off in chat; for a UI change show the phone-width and dark-mode proof (`node tools/staging_shot.js`) and end with the report in `docs/READY_REPORT.md` format.
7. **Release:** batched with other Tier 1 and 2 changes. The owner says "Release" in chat once per batch; follow `docs/DEV_WORKFLOW.md` and `docs/SMOKE_TEST.md` (`node tools/ship.js`).
8. **Close out:** row in `docs/COSTS.md` (cost, turns, send-backs), `learning.md` session-log line, and a `docs/tasks/` file if work is left over.

**Wait with one command** (`node tools/ci_wait.js <pr>`), not with "check CI" turns.

**Escalate to Tier 3** on any trigger in README (a migration, a permission or role effect, financial values): stop, re-label, restart at the Tier 3 first step.
