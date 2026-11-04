# Instructions for assistants working on Stiver

0. **Read `learning.md` before every coding session:** it lists the mistakes made on this project and how to avoid them. Add a line to it whenever you make a mistake or the owner corrects you, and **at the end of every coding session append your learnings to its Session log** (even if it is "no new mistakes").
1. **Read `context.md` before doing anything.** It is the source of truth for the project's architecture, services,
   decisions and open items. If it disagrees with the code, trust the code and fix the file.
2. **After doing anything, update `context.md` in the same commit** (change the affected sections and add a dated line to
   its Changelog). Also update `README.md` when the change affects what it describes, and `docs/NEXT_STEPS.md` when
   priorities or known gaps change.
3. Never commit secrets. `context.md` and the README say where secrets live, never what they are.
4. **Keep `regression_scenario.md` current:** when a feature is added or changed, add or edit the matching manual test
   scenarios (and the automated-coverage map) in the same commit.
5. Run `bash tests/e2e/run_all.sh` before pushing UI or data-layer changes. Pushing to `main` deploys to production, so **do not push to `main` or `staging` yourself unless rule 6 says the owner approved**.
5b. **Event tracking is part of every feature:** each new page, button, feature or interaction ships with its PostHog tracking (a `data-act` on every button, a `data-form` on every form, a named `Analytics.track(...)` event for each new outcome, snake_case, no private data), a matching assertion in `tests/e2e/analytics.js`, and an update to the catalog in `docs/ANALYTICS.md`. Follow its checklist; do not call a feature done without it.
6. **Follow `docs/DEV_WORKFLOW.md` (local -> staging -> production; the shared source of truth is the repo `sryajaya28/dev-workflow`):**
   - **Design first, in Figma** (file: https://www.figma.com/design/DnfE4wtwMDGQyOW76MkVRW/Stiver): every request starts with a design update in a dedicated `Feature - <short-name>` section, reviewed by the owner and approved before any code, unless the owner says "skip figma" (then update Figma after the production release). Update the feature folder when it is implemented and when it is released. Figma is the only home of the design: do not maintain `design/` or run `tools/design/export.js` any more (see `docs/DEV_WORKFLOW.md` section 0).
   - Work on a feature branch and push only that branch; send the owner its **preview link** (Vercel builds every branch; previews and staging use the staging database), screenshots and the steps to try it. Wait for explicit approval.
   - Test every feature (`docs/FEATURE_TESTS.md`; the owner may add entries). Only after approval merge the branch into `staging`.
   - Run regression on staging **only when the owner asks**, then write the summary and **stop until the owner approves** it. Never release on your own.
   - To release: apply migrations first (staging database before production), merge `staging` into `main`, then run the production smoke test (`docs/SMOKE_TEST.md`, `tests/smoke/smoke.js`, credentials in the environment secrets `SMOKE_PROD_PASSWORD` / `SMOKE_STAGING_PASSWORD`). If anything fails, fix it at once and release the fix (roll back first if data is affected), then smoke test again.
   - A new production address must be added to `PRODUCTION_HOSTS` in `prototype/config.js`, or it will use the staging database.
