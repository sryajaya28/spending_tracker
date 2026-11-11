# Tier 3: Full, workflow v2

**Typical work:** migrations, RLS, auth, sharing/household, financial calculations, imports, security configuration, anything role-dependent. Release 15 is the model (reviews and real-account QA caught real access bugs there). It keeps the most checks of any tier and ships alone. Budget: under $8 per task, split across the small sessions below.

**Load:** `CLAUDE.md`, this file, the "Which tier" table and "Escalation triggers" in `docs/workflows/README.md`, `docs/DEV_WORKFLOW.md`, `docs/SMOKE_TEST.md`, `context.md` by section, the `learning.md` rows for data/RLS and release, and the task file. `docs/archive/` is history: do not follow it.

**Flow: every step is a small fresh session, handed over by the task file and the PR description. Never go back to an old session; never switch model mid-session.**
1. **Requirements:** the build session restates the request as done-when checks, with edge cases and who can read or write per role, and asks every open question once. The owner's answer is the requirements gate.
2. **Design:** Figma first for any UI (dark mode and phone width); the owner approves before the build. A short written technical design (tables, RLS, functions, migration order, rollback) goes in the PR description or the task file, on Opus 5.5 or Fable 5.2 when the design is hard.
3. **Build:** Sonnet 5.5, one branch off `staging`, one PR. Tests ship with the change: e2e, the SQL test files (`tools/sql_local_test.sh`) and a failing-then-passing test for each bug. Update `context.md`, `regression_scenario.md`, `docs/FEATURE_TESTS.md`, event tracking and a change file in the same PR. Applied migrations are never edited.
4. **Review:** CI plus the automated PR reviewer (GitHub Copilot code review), then ONE fresh diff-only review session on a different, stronger model (Opus 5.5 or Fable 5.2). It gets the diff, the task file and this checklist only, about 30k tokens: RLS on every table, who can read and write per role, definer functions, secrets, rate limits, fail-closed behaviour, money and rounding. Every finding is fixed or answered in the PR. No Tech-Lead, QA or Security session.
5. **QA is tests plus the owner:** full e2e in CI on the final commit, the SQL tests, and the manual scenarios in `regression_scenario.md` with real accounts for anything role-dependent (a second login per role; the owner does the role logins on staging). After a fix, retest the delta, always on the final build.
6. **Staging:** apply migrations to staging first (never to production first); the owner checks staging and signs off in chat, with phone-width and dark-mode proof for UI (`node tools/staging_shot.js`).
7. **Release:** its own release, never batched, only after the owner says "Release" in chat. Migrations with `DROP POLICY` or other destructive SQL cannot go through the agent database tool (the confirmation prompt times out): use the CI migration job when built, otherwise a single `begin/commit` file the owner runs in the dashboard SQL editor, verified read-only afterwards. Then the production smoke test (`docs/SMOKE_TEST.md`); the exact release contents go in `docs/RELEASES.md`.
8. **Close out:** row in `docs/COSTS.md`, `learning.md` session-log line, a `docs/tasks/` file for anything left.

**Stop rule:** near 120k tokens in any one session, stop, write the task file and report; the rest runs in a new session.
