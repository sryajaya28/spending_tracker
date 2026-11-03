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
5. Run `bash tests/e2e/run_all.sh` before pushing UI or data-layer changes. After UI changes also regenerate the Figma design files: `node tools/design/export.js` (see `design/README.md`). Pushing to `main` deploys to production, so **do not push to `main` or `staging` yourself unless rule 6 says the owner approved**.
6. **Follow `docs/DEV_WORKFLOW.md` (local -> staging -> production; the shared source of truth is the repo `sryajaya28/dev-workflow`):**
   - Work on a feature branch and push only that branch; send the owner its **preview link** (Vercel builds every branch; previews and staging use the staging database), screenshots and the steps to try it. Wait for explicit approval.
   - Test every feature (`docs/FEATURE_TESTS.md`; the owner may add entries). Only after approval merge the branch into `staging`.
   - Run regression on staging **only when the owner asks**, then write the summary and **stop until the owner approves** it. Never release on your own.
   - To release: apply migrations first (staging database before production), merge `staging` into `main`, then run the production smoke test (`docs/SMOKE_TEST.md`, `tests/smoke/smoke.js`, credentials in the environment secrets `SMOKE_PROD_PASSWORD` / `SMOKE_STAGING_PASSWORD`). If anything fails, fix it at once and release the fix (roll back first if data is affected), then smoke test again.
   - A new production address must be added to `PRODUCTION_HOSTS` in `prototype/config.js`, or it will use the staging database.

## AI team workflow (added; rules 0 to 6 above stay in force)

This repo also uses the AI dev team: roles, state machine and the two CEO gates are in `docs/team-protocol.md`; how the
orchestrator runs them is in `docs/orchestrator-procedure.md`; agents live in `.claude/agents/`; enforcement is in
`.claude/hooks/` and `.claude/settings.json`.

- The AI team adds to the rules above and does not replace them. Where two rules differ, the stricter one wins, except the
  written exceptions in `docs/team-exceptions.md`.
- Every role reads `context.md` and `learning.md` first and follows `docs/DEV_WORKFLOW.md` (local, staging, production).
- The CEO is the owner. Gate 1 (before development) and Gate 2 (before release) need the owner's own words in the Claude
  session. The Desk page is for requests and notes only and can never approve anything.
- Agents never merge their own PRs and never trigger a production deploy. Production happens only after the owner approves
  the regression summary, as `docs/DEV_WORKFLOW.md` describes.
- Active roles: product-manager, head-of-product, backend-engineer, qa. The others are in `.claude/agents-parked/`.
- Write scopes here: backend `api/` and `supabase/migrations/` (agents write migration files, they never apply them), qa
  `tests/`, product documents under `docs/features/<slug>/`.
- Feature records live in `docs/features/<slug>/`. Update `context.md`, `regression_scenario.md` and `learning.md` as rules
  1 to 4 above require.
