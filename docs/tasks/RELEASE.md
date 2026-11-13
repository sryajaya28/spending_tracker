# Release task (reusable prompt)
Not a hand-over file: this is the standing prompt for a release. Start a **new session on Sonnet 5.5** and say: `Run the release task in docs/tasks/RELEASE.md`.
Tier 1 and 2 changes release as one batch; a Tier 3 change releases alone. Needs `SMOKE_STAGING_PASSWORD` and `SMOKE_PROD_PASSWORD` in the environment.

Build nothing. Follow `CLAUDE.md`, `docs/DEV_WORKFLOW.md` and `docs/SMOKE_TEST.md`.
1. `node tools/release.js` (dry run: show the owner the exact contents).
2. `node tools/regression.js` (regression of staging; it skips itself for a docs-only or approved Tier 1 batch).
3. List the migrations in this release and whether each is applied to staging.
4. List the PRs in this release that got no Copilot review, and do a diff-only review of those.
5. Post the regression summary with a release or do-not-release recommendation, then STOP and wait for the owner's "Release".

After the owner's "Release":
6. Apply the migrations to production (if any), then open the `staging` to `main` PR and give the owner the link (the owner merges it).
7. `node tools/ship.js` (waits for the merge, verifies the build, runs the smoke test, writes `docs/RELEASES.md`). Without `gh`: `node tools/ship.js --sha <merge sha>` once the owner has merged.
8. Add the row to `docs/COSTS.md` and report in `docs/READY_REPORT.md` format.
