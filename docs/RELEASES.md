# Release contents (exact, newest first)

Every release starts with the high-level list of its items (Features, Fixes, Docs/process, Tooling, each with its branch), then the exact detail (owner, 2026-11-05). Generated with `node tools/release_contents.js --merge <main sha>`; the Tech-Lead adds tests, smoke and known gaps and appends the block here after each release, then posts it to the Workspace (channel releases, to owner).

## Release 21 contents (main 69b26c9)

**Items in this release**
Features:
- Names and person filter on Transactions only with 2+ writers
- Search in the Occasion and Account lists

**Exact detail.** Range: b19a760..75ec1b8. 2 commits, 15 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-13: Names and person filter on Transactions only with 2+ writers. The first name under a Transactions row is shown only when the owner plus Editors number two or more (Viewers do not count); then a person filter (owner, Editors, a removed member with entries) is added; with 2+ writers all filters (Category, Occasion, Account, Person) move into a sheet opened by a filter button in the search row, and active filters show as chips that clear on a tap. Entries without a creator count as the owner's. e2e `household_labels` extended; branch claude/txn-who-filter. The "read-only" text is removed from Transactions rows (other people's rows still open a read-only detail); "Expand all"/"Hide all" have no background in any state.
- 2026-11-13: Search in the Occasion and Account lists. When there are more than 5 special occasions or more than 5 accounts (Savings, Investment and Debt together), the list opens with a Search box on top, like the Category list: in the Transactions filters (row and filter sheet), in Add/Edit transaction (Account, Special occasion) and in Transfer (From, To). Account search matches the name only. Also fixed: the "not found" note only showed in lists with an add entry, so it never appeared in the Category filter; it now shows at the end of the list (new strings "Occasion not found", "Account not found" with Bahasa Indonesia). No data or sync change. Test `searchlists` (new); `dropdown` unchanged. Branch `claude/wonderful-gates-b8v4o6`.

**What a user can see change**
Yes: 6 app files changed (prototype/app/events-input.js, prototype/app/transfers.js, prototype/app/ui-helpers.js, prototype/app/views.js, prototype/dropdown.js, prototype/i18n-id.js).

**Commits**
- 933b481 Fold change files into the changelog for the release
- 3c99d1d Search box in the Occasion and Account lists above 5 choices

**Files by area**
- App (what users see) (6): prototype/app/events-input.js, prototype/app/transfers.js, prototype/app/ui-helpers.js, prototype/app/views.js, prototype/dropdown.js, prototype/i18n-id.js
- Tests (2): tests/e2e/run_all.sh, tests/e2e/searchlists.js
- Docs and rules (7): context.md, docs/CHANGELOG.md, docs/COSTS.md, docs/FEATURE_TESTS.md, docs/changes/2026-11-13-txn-who-filter.md, learning.md, regression_scenario.md

**Database migrations**
None.

**Tests and smoke:** browser suite 61/61 (local) and CI tier+e2e green; staging smoke, real-database regression create+cleanup passed on 75ec1b8; https://stiver.io answers 200 and serves stiver-shell-69b26c9395. production smoke test passed (SMOKE PASSED: 15/15 steps passed on https://stiver.io)
**Known gaps:** Copilot review did not run (quota); owner has not hand-checked staging

## Release 20 contents (main b7e2ce2)

**Items in this release**
Features:
- Overview hero "Spent today"

**Exact detail.** Range: 3652217..99760e4. 4 commits, 29 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-13: Overview hero "Spent today". The Overview hero card now shows today's expenses under a plain "Spent today" label (no tooltip) (not income, transfers, earlier days or upcoming entries) in the reporting currency, with the currency selector beside it, a `Balance ›` chip (to Portfolio) and, under the amount, the current period's overall budget as "{left} left this month · {n} days to go" (or "{x} over budget", or "{spent} spent · Set a monthly budget ›") with a thin bar that opens Budgets. Total Balance, its % pill and the Budgets card (with `fitOverviewBudgets` and the `.ov-*` CSS) are gone from Overview; the eye now masks the two hero amounts (the bar stays). Display only, no stored value or sync change (Tier 2). New `spenthero` test (replaces `ovbud`); `budgetbar`, `hidebal`, `ovocc`, `trend`, `donut`, `sample`, `analytics` updated; new click actions `hero_budget`, `hero_balance`. Branch `claude/laughing-maxwell-mf9y2z`.

**What a user can see change**
Yes: 6 app files changed (prototype/app/activity.js, prototype/app/charts.js, prototype/app/events-input.js, prototype/app/views.js, prototype/i18n-id.js, prototype/styles.css).

**Commits**
- 0fa568b Fold change files for the Spent today release
- 071bd61 Spent today label is plain text: remove the dotted underline and tooltip
- 25b4af6 Overview hero shows Spent today with budget line, Balance chip and currency selector; Budgets card removed
- 01cf91a Release record 19: hide balance (docs only)

**Files by area**
- App (what users see) (6): prototype/app/activity.js, prototype/app/charts.js, prototype/app/events-input.js, prototype/app/views.js, prototype/i18n-id.js, prototype/styles.css
- Tests (13): tests/e2e/affects.json, tests/e2e/analytics.js, tests/e2e/budgetbar.js, tests/e2e/coin.js, tests/e2e/donut.js, tests/e2e/handoff.js, tests/e2e/hidebal.js, tests/e2e/ovbud.js, tests/e2e/ovocc.js, tests/e2e/run_all.sh, tests/e2e/sample.js, tests/e2e/spenthero.js, tests/e2e/trend.js
- Docs and rules (10): context.md, docs/ANALYTICS.md, docs/CHANGELOG.md, docs/COSTS.md, docs/FEATURE_TESTS.md, docs/RELEASES.md, docs/tasks/2026-11-11-hide-balance.md, docs/tasks/2026-11-13-overview-spent-hero.md, learning.md, regression_scenario.md

**Database migrations**
None.

**Tests and smoke:** e2e 60 of 60 local; CI e2e and tier green on PR 68 and PR 70; staging build checked; https://stiver.io answers 200 and serves stiver-shell-b7e2ce27f8. production smoke test passed (SMOKE PASSED: 15/15 steps passed on https://stiver.io)
**Known gaps:** Copilot review did not run (quota); owner staging check not done

## Release 19 contents (main 3652217)

**Items in this release**
Features:
- Hide balance
- Hide balance follow-up

**Exact detail.** Range: 5673c4d..e61b007. 4 commits, 22 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-11: Hide balance. A small eye button on Overview "Total Balance" and Portfolio "Net worth" is one switch that shows or hides every balance: both totals, the Breakdown amounts, each Portfolio tab's total, account, debt, lent and holding balances, Realized P&L, the history list and chart values (dots instead of numbers; transactions, budgets and spending are never hidden). It is remembered on the device (no database change). The "Total Balance" text is now underlined and opens its tooltip instead of the (i) icon, and the change pill is red when the figure fell and green when it grew. New event `balance_visibility_changed`; test `hidebal`. Branch `claude/dazzling-wozniak-47lwa6`.
- 2026-11-11: Hide balance follow-up. The underline under "Total Balance" is now a thin dotted line (1 px) instead of a solid one. Branch `claude/dazzling-wozniak-47lwa6`.

**What a user can see change**
Yes: 7 app files changed (prototype/app/charts.js, prototype/app/events-input.js, prototype/app/invest-dialogs.js, prototype/app/util.js, prototype/app/views.js, prototype/i18n-id.js, prototype/styles.css).

**Commits**
- 5c691f3 Fold change files for the hide-balance release
- e46e342 Total Balance label: thin dotted underline
- df562c4 Hide balance: eye button on Overview and Portfolio, red/green change pill
- ddb178d Release record for Lent from account; cost row and task file updated

**Files by area**
- App (what users see) (7): prototype/app/charts.js, prototype/app/events-input.js, prototype/app/invest-dialogs.js, prototype/app/util.js, prototype/app/views.js, prototype/i18n-id.js, prototype/styles.css
- Tests (5): tests/e2e/affects.json, tests/e2e/analytics.js, tests/e2e/hidebal.js, tests/e2e/run_all.sh, tests/e2e/sample.js
- Docs and rules (10): context.md, docs/ANALYTICS.md, docs/CHANGELOG.md, docs/COSTS.md, docs/FEATURE_TESTS.md, docs/RELEASES.md, docs/tasks/2026-11-11-hide-balance.md, docs/tasks/2026-11-11-lent-from-account.md, learning.md, regression_scenario.md

**Database migrations**
None.

**Tests and smoke:** staging regression on e61b007 all passed (browser suite 59, staging smoke test, real-database regression); first run failed one flaky lent assertion, passed on rerun; local full e2e before each push; GitHub CI (e2e, tier) never ran: Actions queue stuck, owner merged the release PR with admin bypass; https://stiver.io answers 200 and serves stiver-shell-3652217e4b. production smoke test passed (SMOKE PASSED: 15/15 steps passed on https://stiver.io)
**Known gaps:** GitHub CI checks e2e and tier did not run on PRs 63 to 66 (Actions stuck in Queued); not checked on a real iPhone; staging phone/dark screenshots from the deployed site not taken; Copilot review unavailable (quota)

## Release Lent-from-account contents (main 5673c4d)

**Items in this release**
Features:
- Money lent comes out of an account, with the Copilot review fixes and an Editor guard in the database [claude/lent-from-account, PR 59]
Docs/process:
- Fold the Lent change files into CHANGELOG [claude/release-prep-lent, PR 60]

**What a user can see change**
Yes. Add money lent has a required From account; saving makes one transfer out (category Lent), so the account balance drops and Transactions shows it. Net worth is unchanged and it is not spending. Repayment rows read "Transfer in" with a green +amount.

**Database migrations**
32 `debts.lent_transaction_id` and 33 `lent_link_guard` trigger. Applied to staging, then to production BEFORE the merge (both verified read-only: column is a nullable uuid, trigger enabled). Both additive.

**Tests and smoke**
- Full e2e on the PR branch 58 of 58 (local) and CI green on PRs 59, 60 and 61; SQL tests all ok (`household_lent` 4, `household_lent_guard` 6).
- Production: Vercel deployment dpl_2QBpgLYdwJ3kdbNnD3UrCoUF6TYt is READY and aliased to stiver.io (commit 5673c4d).
- NOT run: the production smoke test (`SMOKE_PROD_PASSWORD` not set here and stiver.io is not reachable from the cloud session) and the build-stamp check of `tools/release.js --verify-only`.

**Known gaps**
- Released at the owner's request in chat without the Tier 3 fresh diff-only review session and without the owner's manual staging check.
- Cloud saves write debts and transactions in separate requests (all transfers and loan payments today); an all-or-nothing save is a separate task.
- Run the smoke test and a hand check of Money lent on stiver.io.

## Release B3 contents (main f7adc9e)

**Items in this release**
Docs/process:
- Copilot review guidance [claude/cost-plan-b3-copilot-review]

**Exact detail.** Range: 590d8ea..ccac479. 3 commits, 4 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-11: Copilot review guidance. Added `.github/copilot-instructions.md`: what GitHub Copilot code review should flag in this repo (secret credentials, money correctness, roles and RLS, migrations, auth, tests, event tracking, keep-current docs) and what to skip (public browser keys in `prototype/config.js`). Guidance text only, no app change; branch `claude/cost-plan-b3-copilot-review`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- afaa9fd Fold change files into CHANGELOG (release prep for the Copilot guidance)
- 7c271ef Exempt public browser keys from the Copilot secrets rule; tick COST_PLAN B3
- 7c97bfb Prepare Copilot code review (COST_PLAN B3, repo side)

**Files by area**
- Docs and rules (3): docs/CHANGELOG.md, docs/tasks/2026-11-11-cost-plan-b3.md, learning.md
- Other (1): .github/copilot-instructions.md

**Database migrations**
None.

**Tests and smoke:** CI green on PRs 42, 45 and 46. Vercel shows the production deployment for f7adc9e as READY (stiver.io itself is not reachable from the cloud session, so the live build stamp and HTTP 200 were NOT checked by script). production smoke test not run: no app code changed (guidance text and docs only) and SMOKE_PROD_PASSWORD is not available in this session
**Known gaps:** tools/gates.js does not treat .github/copilot-instructions.md as docs-only, so ship.js asks for a smoke test on a guidance-only release; stiver.io was not checked live

## Release B4 contents (main a87e1a8)

**Items in this release**
Fixes:
- Release script verify fix
Docs/process:
- Workflow v2: tier files rewritten (COST_PLAN B4)
- Workflow v2: CLAUDE.md rewritten (COST_PLAN A4)
- B1 release record
- CI pins Playwright
Tooling:
- tools/ship.js (COST_PLAN B2)
- tools/ci_wait.js (COST_PLAN B1)

**Exact detail.** Range: 17a4899..b917575. 3 commits, 12 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-11: Workflow v2: tier files rewritten (COST_PLAN B4). TIER_1, TIER_2 and TIER_3 now describe one fresh session per task (no PM, QA, Designer, Tech-Lead or Full-stack sessions), tests in CI, the Copilot PR reviewer for Tier 2 and 3 (install still the owner's step), one small fresh diff-only review session for Tier 3, and the owner's staging check; each lists what to load and the cost target. Docs only; branch docs/v2-tier-files.
- 2026-11-11: Workflow v2: CLAUDE.md rewritten (COST_PLAN A4). CLAUDE.md is now about 40 lines (the ten v2 rules plus the non-negotiables); docs/AGENTS.md, WORKSPACE.md, WORKFLOW.md, roles/ and the handoff notes moved (the release-15 SQL stays in docs/handoff/ so the change stays Tier 1) to docs/archive/ (retired role sessions); added docs/tasks/TEMPLATE.md and docs/COSTS.md; COST_PLAN A4 ticked. Docs only; branch docs/v2-claude-md.
- 2026-11-11: tools/ship.js (COST_PLAN B2). One command after the owner's "Release": waits for the staging to main PR to merge, waits for production to serve the new build stamp, checks the site answers 200, runs the production smoke test only when tools/gates.js says the release needs it (app code, not an approved Tier 1 batch), and writes the exact release record into docs/RELEASES.md. One line per step, ends with SHIP OK or one FAIL line (exit 2 when SMOKE_PROD_PASSWORD is missing). It never merges and never touches the database. Offline test tools/ship.test.js. Tooling and docs only; branch feature/ship-script.
- 2026-11-11: Release script verify fix. tools/release.js sliced the build stamp at 12 characters but `stiver-shell-` is 13, so `--verify-only` reported FAIL on a correct release after waiting 10 minutes (seen on the workflow v2 docs release). Offset corrected to 13. Tooling only; branch fix/release-verify-offset.
- 2026-11-11: tools/ci_wait.js (COST_PLAN B1). `node tools/ci_wait.js <pr>` waits for a PR's checks and prints one line (`GREEN`, `RED ... failed: <test names>`, `TIMEOUT`, `CONFLICT`, `NOCHECKS`, `MERGED`, `CLOSED`; exit 0 green, 1 red, 2 other); a skipped check counts as passing, a newer push restarts the wait on the new head; uses `gh api` like tools/release.js. Replaces every "check CI" turn. Offline test: `node tools/ci_wait.test.js`. Tooling only; branch tools/ci-wait.
- 2026-11-11: B1 release record. Added the B1 release entry to docs/RELEASES.md and the first per-task row (B1) to docs/COSTS.md (tokens and turns measured from the session's usage record; dollars left unpriced because the repo has no Sonnet 5.5 rate). Docs only; branch docs/b1-release-record.
- 2026-11-06: CI pins Playwright. The e2e job now installs playwright@1.63.0 (the version the tests are known to pass with) instead of the latest: an unpinned install fetched a newer Chrome and tests/e2e/occnobudget.js failed on both CI runs of PR #25 while passing locally; the app and the test were unchanged. Bump the version on purpose after a local run. Tooling only; branch staging.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- 086b206 Fold change files into CHANGELOG for the release
- e4f1517 Tier files: ci_wait.js and ship.js now exist
- 8b97e87 Workflow v2: rewrite TIER_1/2/3 for one-session-per-task (COST_PLAN B4)

**Files by area**
- Docs and rules (12): docs/CHANGELOG.md, docs/changes/2026-11-06-ci-pin-playwright.md, docs/changes/2026-11-11-b1-release-record.md, docs/changes/2026-11-11-ci-wait.md, docs/changes/2026-11-11-release-verify-offset.md, docs/changes/2026-11-11-ship-script.md, docs/changes/2026-11-11-v2-claude-md.md, docs/workflows/COST_PLAN.md, docs/workflows/TIER_1.md, docs/workflows/TIER_2.md, docs/workflows/TIER_3.md, learning.md

**Database migrations**
None.

**Tests and smoke:** CI on PRs 36, 37 and 38: 3 checks passed, e2e skipped (Tier 1). Regression and production smoke skipped on purpose (docs only).
**Known gaps:** Tier files name the Copilot reviewer, which is decided but not yet installed. docs/workflows/README.md still carries the old PM/Tech-Lead intake and role sections.

**Production check:** the Vercel deployment status on main a87e1a8 is `success` ("Deployment has completed", read from the GitHub commit status). stiver.io could not be fetched from the cloud session (network policy returns 403), so the live domain, its 200 and its build stamp were not checked directly; `tools/ship.js` stopped at that curl.

## Release B1 contents (main f731200)

**Items in this release**
- Tooling (branch tools/ci-wait, PR 30): `tools/ci_wait.js <pr>` waits for a PR's checks and prints one line (GREEN, RED with the failing test names, TIMEOUT, CONFLICT, NOCHECKS, MERGED, CLOSED); offline test `tools/ci_wait.test.js`. COST_PLAN item B1.
- Docs/process: change file `docs/changes/2026-11-11-ci-wait.md`, COST_PLAN B1 ticked, learning.md entry.

**Exact detail.** Range: 47f625a..dca9764 (release merge PR 32, f731200). 1 commit, 5 files.

**Commits**
- 2e665f7 Add tools/ci_wait.js: wait for a PR's checks, print one line (COST_PLAN B1)

**Files by area**
- Tooling (2): tools/ci_wait.js, tools/ci_wait.test.js
- Docs and rules (3): docs/changes/2026-11-11-ci-wait.md, docs/workflows/COST_PLAN.md, learning.md

**Database migrations**
None.

**Tests and smoke:** `node tools/ci_wait.test.js` passes; CI on PR 30 and PR 32: 3 checks passed, e2e skipped (Tier 1). Regression and production smoke skipped on purpose (docs and tooling only). Vercel production deployment READY and its sw.js serves stiver-shell-f731200a90; stiver.io itself could not be fetched from the cloud session (network policy returns 403), so the live domain was not checked directly.
**Known gaps:** the RED path of ci_wait.js (failing test names) is covered by the offline test only, not yet seen on a real failing PR. Releases between 18 and this one (PRs 27 and 29, docs and tooling) have no entry here.

## Release 18 contents (main b01c36a)

**Items in this release**
- Feature (branch feature/invite-email-copy): friendlier household invite email in English and Indonesian with a plain-text part (new subject, "You're invited" heading, role box, "Join the household" button, three steps). Inviter's email stays first, names sanitised, a look-alike display name is replaced by the email in the subject, link unchanged.
- Tooling/process (branch staging): invite email test in CI; CI pins Playwright 1.63.0; Tech-Lead handoff note.

**Exact detail.** Range: 8f4a1ec..54afecd. 6 commits, 9 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-05: Friendlier invite email. New subject (🏡 <name> saved you a seat in their Stiver household), heading, role box (Viewer or Editor in plain words, plus what the member will see), a "Join the household →" button, three steps and a short footer, in English and Indonesian, with a plain-text part. The email is built by pure functions in supabase/functions/_shared/invite_email.ts (cleanName moved there; util.ts re-exports it); inviter email still first, names sanitised, link unchanged, no images or scripts. tests/invite_email.test.mjs (also in CI). Branch feature/invite-email-copy.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- 54afecd CI: pin Playwright 1.63.0 (a newer Chrome failed occnobudget)
- 2ef7ca0 Tech-Lead handoff: Release 18 (invite email) paused at the production approval
- 28adc0d Fold change files
- 17c1735 Invite email review fixes: subject never shows a look-alike display name, token shape check, bidi stripping, Pelihat
- 8a0a1c1 Invite email: friendlier copy and layout (EN and ID), plain-text part, pure builder with a test
- 94045eb Record Release 17 (main 8f4a1ec)

**Files by area**
- Edge Functions (2): supabase/functions/_shared/invite_email.ts, supabase/functions/_shared/util.ts
- Tests (1): tests/invite_email.test.mjs
- Docs and rules (5): docs/CHANGELOG.md, docs/RELEASES.md, docs/changes/2026-11-06-ci-pin-playwright.md, docs/handoff/techlead.md, regression_scenario.md
- Other (1): .github/workflows/ci.yml

**Database migrations**
None.

**Tests and smoke:** regression on staging 4/4 (browser suite, staging smoke, real-database create and cleanup); CI on PR #25: tier and e2e green with Playwright pinned to 1.63.0; real invite sent on staging and read in a Mailinator inbox. production smoke test waived by the owner (email-only change); production functions deployed by deploy run 10 (owner approved) and curl-checked (400/400/403/401/401/401); stiver.io answers 200 and serves stiver-shell-b01c36a0f5; no migrations
**Known gaps:** no real invite sent from production; Gmail and Apple Mail dark mode not seen; the Indonesian email only tested in code; e2e occnobudget failed twice on CI with an unpinned newer Chrome (cause not proven, Playwright now pinned)

## Release 17 contents (main 8f4a1ec)

**Items in this release**
- Tier 1 change (branch feature/portfolio-wallet-icon): the Portfolio entry in the bottom bar and desktop sidebar uses the wallet icon, drawn 20% larger so it matches the other tabs (owner request and approval).
- Tooling/process (branch staging): the release tools know Tier 1 (tools/gates.js, docs/workflows/tier1-approved.txt, tools/gates.test.js): no regression and no production smoke test for a docs/tooling-only release or an owner-approved Tier 1 batch; `release.js --verify-only` compares 7-, 10- and 40-character shas with the build stamp; Tier 1 release steps and the owner's correction recorded.

**Exact detail.** Range: 2dba369..c7d01cc. 5 commits, 13 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-05: Tier 1 release steps. docs/workflows/TIER_1.md now says a Tier 1 batch release needs no regression run and no production smoke test (CI e2e and the owner's screenshot review replace them); after the owner's Release only the site answer and build stamp are checked. Owner correction recorded in docs/learning/release.md. Docs only; branch staging.
- 2026-11-05: Release tools know Tier 1. tools/gates.js skips regression and the production smoke test for a docs/tooling-only release or a Tier 1 batch (every non-docs change comes from a commit listed in docs/workflows/tier1-approved.txt, never a Tier 3 file); regression.js and release.js print and act on it; release.js --verify-only now compares a 7-, 10- or 40-character sha with the 10-character build stamp (the old length bug). tools/gates.test.js. Tooling and docs only; branch staging.
- 2026-11-05: Portfolio icon. The Portfolio entry in the bottom bar and the desktop sidebar now uses the wallet icon (drawn 20% larger so it matches the other tabs) instead of the trend arrow (owner request, first Tier 1 change; no logic, data or access change). Affected tests pass. Branch feature/portfolio-wallet-icon.
- 2026-11-05: Path rule fix. Documentation under supabase/ (for example supabase/functions/DEPLOY.md) is Tier 1, not Tier 3; CI also runs when a draft PR is marked ready for review. Tooling only; branch staging.
- 2026-11-05: Faster releases. CI skips the browser suite (e2e job) for Tier 1 PRs (docs, CSS, translations, tooling), where the path rule says nothing in app behaviour can change; docs/workflows/README.md gains a Release hygiene order (fold changelog, regression, open the PR, no further commits) and docs/learning/release.md a matching rule. Tooling/docs only; branch staging.

**What a user can see change**
Yes: 1 app files changed (prototype/app.js).

**Commits**
- c7d01cc Release tools know Tier 1: skip regression and production smoke test for owner-approved Tier 1 batches; fold changelog
- c31bb94 Tier 1 release steps: no regression or production smoke test; record the correction
- c745faf Portfolio nav wallet icon 20% larger
- f83d663 Portfolio nav icon: wallet instead of trend arrow
- 77cdbbb Record Release 16 (main 2dba369)

**Files by area**
- App (what users see) (1): prototype/app.js
- Tooling (4): tools/gates.js, tools/gates.test.js, tools/regression.js, tools/release.js
- Docs and rules (8): docs/CHANGELOG.md, docs/NEXT_STEPS.md, docs/RELEASES.md, docs/changes/2026-11-05-faster-releases.md, docs/changes/2026-11-05-path-rule-supabase-docs.md, docs/learning/release.md, docs/workflows/TIER_1.md, docs/workflows/tier1-approved.txt

**Database migrations**
None.

**Tests and smoke:** CI on PR #23 and PR #24: tier and e2e green; regression and production smoke test skipped on purpose (Tier 1 batch, owner: "Release and update the workflows to skip regression and smoke for tier 1 improvement"). no smoke test (Tier 1 batch); production answers 200 and serves stiver-shell-8f4a1ec204 (main 8f4a1ec); no migrations
**Known gaps:** Vercel did not build the main merge for about 17 minutes (it received GitHub events about 30 minutes late today); the deployment was started by hand through the Vercel connection at the owner's request; Indonesian text and a real phone not checked (icon only)

## Release 16 contents (main 2dba369)

**Items in this release**
Fixes:
- CI fix
Docs/process:
- Strict e2e fake
- Risk-tiered workflow
- README rewritten (docs only)
- README: success and performance metrics (docs only)
- Path rule and CI
- 2026-11-05 · docs/AGENTS.md rule 16 (message economy, hand off at 400k tokens, n
- learning.md split by area
- Household: Edge Function code written (not deployed)
- Deploy job
- Contact email set (small change)
- Household: account-delete guard and category rule; design gate 2 approved
- Household slice 1: migration 1 applied to STAGING; migrations 2 and 3 written (not applied)
- Household access, slice 1 started: migration 1 (additive) with SQL tests

**Exact detail.** Range: 35c97ed..3cf39b8. 11 commits, 39 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-05: Strict e2e fake. tests/e2e/fake_supabase.js now carries the real column lists (SCHEMA) and refuses an insert, update or upsert with an unknown column like the database does (the manual_prices.id bug would now fail an e2e); tools/check_fake_schema.js compares SCHEMA with the real database. Tests/tooling only; full e2e passes, a removed column makes cashacct fail (checked). Branch feature/strict-fake.
- 2026-11-05: Risk-tiered workflow. New docs/workflows/ (README, TIER_1-3) and AGENTS.md rule 17: three tiers chosen by a path rule (agents can raise, never lower), intake note and routing, owner gates per tier, hotfix lane, batching, short task-scoped agents, context lists per tier. Documented; CI automation (path-rule label, e2e on PRs, migration/function deploy job, strict test fake) still to build, tracked in NEXT_STEPS. Docs only; branch staging.
- 2026-11-05: README rewritten (docs only). Now opens with the problem and the questions Stiver answers (multi-currency net worth, savings, investments, debt to zero, lent), marks household access as in development, drops stale text (staging 'to do', 13 migrations, design export), points to the workflow docs. Branch docs/readme-rewrite. 2026-11-05: README feedback applied (docs only). New section 'Built by an AI product team' (Claude agents, one human owner, three gates), 'Deliberately not building (yet)' (bank sync not now: Indonesian bank API coverage and security, goal stays fewer manual entries; tax, trading, recommendations, native apps), 'Known limits', and 'Before opening to the public' as an unchecked list tracked on the backlog. Branch docs/readme-rewrite.
- 2026-11-05: README: success and performance metrics (docs only). DAU/WAU (users recording transactions), churn (no transaction for 7 days), paid conversion later (Xendit/Stripe), plus performance metrics: data freshness, app speed and proposed save reliability, price freshness, recurring accuracy. Branch docs/readme-metrics. 2026-11-05: README success metrics revised (docs only). Added activation (two kinds of things beyond spending in 7 days) as the headline, WAU lead and DAU secondary, stickiness, cohort retention, churn from last record (transaction or account) over 30 days, initial targets marked as hypotheses, performance as guardrail metrics with concrete targets, exclusions for team and test traffic. Branch docs/readme-metrics.
- 2026-11-05: Path rule and CI. tools/path_tier.js (+ tests/path_tier.test.js) computes the minimum tier of a change from its files; .github/workflows/ci.yml labels every PR to staging or main with tier-N and runs the e2e suite. Not yet seen running on GitHub (first PR will show); branch protection is the owner's setting. Branch staging.
- 2026-11-05 · docs/AGENTS.md rule 16 (message economy, hand off at 400k tokens, no repeated pastes) from the session usage review; docs only.
- 2026-11-05: learning.md split by area. learning.md is now an index with a load table (which area files each kind of task needs) plus the Session log; the rules moved verbatim into docs/learning/ (release, data, code, ui, testing, owner). Nothing was dropped (checked line by line); CLAUDE.md rule 0 updated. Docs only; branch staging.
- 2026-11-05: Household: Edge Function code written (not deployed). `supabase/functions/`: invite-member, manage-invite (revoke/resend), join-household (unauthenticated, own token, token on every call), signup-gate (one generic answer), delete-my-login, invite-sweep, shared helpers (restrictive CORS, attempt-counted rate limits, our own sender, sanitised names). Migration 28 gains `email_exists()` for signup-gate. For Developer 2 code review before any deploy; owner actions still needed (staging Confirm email, RESEND_API_KEY, MAIL_FROM, SITE_URL secrets). Branch `feature/household`.
- 2026-11-05: Deploy job. tools/migrate.js applies supabase/migrations through psql, each file in one transaction with its row in public._repo_migrations (tested on a local Postgres: baseline, apply, rerun, rollback of a failing file); .github/workflows/deploy.yml runs it plus the six Edge Function deploys and the answer checks: staging on every push to staging that touches supabase/, production by hand behind the owner's approval on the production environment. Needs the owner's secrets (SUPABASE_ACCESS_TOKEN, DB_URL_STAGING, DB_URL_PROD) and first-run baseline; not yet run against a real project. Branch staging.
- 2026-11-05: CI fix. tests/e2e/csp.js read vercel.json from a hardcoded /home/user path, so it failed on the GitHub runner (the other 58 e2e passed there); it now uses a path relative to the test. Test only; branch staging.
- 2026-11-05: Contact email set (small change). prototype/config.js CONTACT_EMAIL = support@stiver.io (forwards to the owner through ImprovMX; verified delivered), so the privacy and terms pages show it; learning.md no longer contains a personal address fragment. Branch docs/contact-email; ships after the household release.
- 2026-11-04: Household: account-delete guard and category rule (owner decisions via PM); design gate 2 approved. PRD check 38 and check 33 subline; technical design 4a gains the database guard on account/category delete (HH001 with count), the list of write paths and the extended SQL tests. Docs only. Branch `docs/household-prd`.
- 2026-11-04: Household slice 1: migration 1 applied to STAGING; migrations 2 and 3 written (not applied). Migration 1 (approved by Developer 2) is applied on the staging database and verified (11 creator columns, no missing creators, 7 new tables, 2 functions; staging smoke 15/15). `20261104000025_household_hardening.sql` (household_state policy via household_owner(), membership guard trigger, recurring_rule_id note), `20261104000026_household_rls.sql` (all policies replaced, Editors change only their own transactions, linked-row rules, profile column grants) with a down script, and `20261104000027_household_triggers.sql` (second backfill, stamps, stale-edit check for households with members, recurring attribution, poll counter, delete guards), with `supabase/tests/household_*.test.sql`. Waiting for Developer 2 to review the text and for a staging dry-run (the SQL tool asks the owner to confirm DROP statements). Branch `feature/household`.
- 2026-11-04: Household access, slice 1 started: migration 1 (additive) with SQL tests. `20261104000024_household_tables.sql` adds profiles.household_status, the household tables, created_by/updated_by/rev on 11 tables (existing rows backfilled to their owner with triggers off), recurring_rule_id, and the `household_owner()`/`is_writer()` functions (members need a live session; fail closed). No policy changes: owners and solo users are unaffected. `supabase/tests/household_tables.test.sql`; dry-run on the staging database inside a transaction rolled back OK. NOT applied to staging yet (waiting for Developer 2's review). Feature test FT-008 added. Branch `feature/household`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- 3cf39b8 CI: skip e2e for Tier 1 PRs; release hygiene order
- 09bf133 Path rule: docs inside supabase/ are Tier 1; CI also runs on ready_for_review
- 5b3c52f Fold change files into the changelog for Release 16
- c0d5674 Split learning.md into area files with an index and load table
- e2443b6 Deploy: confirm function deploys non-interactively (--yes)
- 34e9e12 Deploy: print the shape of the DB_URL secret (no password) to debug login failures
- 81135a6 Deploy job: tools/migrate.js and deploy.yml (migrations and Edge Functions from CI)
- ecedd9f csp test: find vercel.json relative to the test, not a hardcoded path (fails on CI)
- 5351492 Next steps: record what is built; change file for path rule and CI
- 55895a3 Path rule (tools/path_tier.js + test) and CI workflow: tier label and e2e on every PR
- bde9f1c Strict e2e fake: refuse unknown columns like the real database; schema check tool

**Files by area**
- Edge Functions (1): supabase/functions/DEPLOY.md
- Tests (4): tests/e2e/README.md, tests/e2e/csp.js, tests/e2e/fake_supabase.js, tests/path_tier.test.js
- Tooling (4): tools/check_fake_schema.js, tools/db_url_check.js, tools/migrate.js, tools/path_tier.js
- Docs and rules (28): CLAUDE.md, docs/CHANGELOG.md, docs/NEXT_STEPS.md, docs/changes/2026-11-04-household-migration-1.md, docs/changes/2026-11-04-household-migration-2-3.md, docs/changes/2026-11-04-household-prd.md, docs/changes/2026-11-05-contact-email.md, docs/changes/2026-11-05-faster-releases.md, docs/changes/2026-11-05-household-activity.md, docs/changes/2026-11-05-household-card-rework.md, docs/changes/2026-11-05-household-edge-functions.md, docs/changes/2026-11-05-household-local-sql-check.md, docs/changes/2026-11-05-household-people-email.md, docs/changes/2026-11-05-household-slice1-client.md, docs/changes/2026-11-05-household-viewer-controls-manual-prices.md, docs/changes/2026-11-05-message-economy.md, docs/changes/2026-11-05-path-rule-supabase-docs.md, docs/changes/2026-11-05-readme-metrics.md, docs/changes/2026-11-05-readme-rewrite.md, docs/changes/2026-11-05-risk-tiered-workflow.md, docs/learning/code.md, docs/learning/data.md, docs/learning/owner.md, docs/learning/release.md, docs/learning/testing.md, docs/learning/ui.md, docs/workflows/README.md, learning.md
- Other (2): .github/workflows/ci.yml, .github/workflows/deploy.yml

**Database migrations**
None.

**Tests and smoke:** tools/regression.js 4/4 on staging (browser suite, staging smoke, real-database create and cleanup); CI on the PR: tier and e2e (59 tests) green on 3cf39b8. production smoke 15/15 on https://stiver.io (main 2dba369, stiver-shell-2dba369e14); no migrations; staging and production databases tracked in public._repo_migrations through the deploy workflow (runs 7 and 8)
**Known gaps:** the first CI e2e run hung on the Playwright install step (GitHub side); the deploy workflow's push trigger and Tier 1 e2e skip are untested until the next qualifying PR; Supabase CI token expires in the period the owner chose; branch protection requires e2e and tier on main only

## Release 15 contents (main 52b656e)

**Items in this release**
- Feature (branch feature/household): household access. An owner invites people as Editor or Viewer by email; members work on the owner's data (invites, join page, roles, remove, Delete my login with confirmation, Activity feed, Household card, Indonesian text). Database migrations 24-31 and six Edge Functions.
- Fixes (found by QA on staging): a Viewer sees no write controls and never writes; a Viewer's bottom bar has four equal tabs; manual_prices no longer sends a nonexistent `id` column (also hit solo owners changing a hand-typed asset price); a member removed while the app is open reaches the no-access page within one poll.
- Docs/process: README rewrite and metrics, contact email (support@stiver.io), PM and Tech-Lead handoff notes, message-economy rules, the owner SQL file docs/handoff/release15_prod_migrations_25_31.sql.

**Exact detail.** Range: e64e5e9..9e1ca50. 67 commits, 72 files.

**What changed, in plain words** (the changelog lines this release added)
- (no changelog line added)

**What a user can see change**
Yes: 6 app files changed (prototype/app.js, prototype/cloud.js, prototype/config.js, prototype/i18n-id.js, prototype/styles.css, vercel.json).

**Commits**
- 9e1ca50 Release 15: migrations 25-31 as one transaction for the owner to run in the production SQL editor
- fb6cfa3 No-access page: Delete my login asks for confirmation first
- 7836051 HH-20: a member removed while the app is open reaches the no-access page within one poll
- 00acd41 Bottom bar: no empty slot for a Viewer (four equal tabs, no raised Add)
- 1b839b9 QA fixes: Viewer sees no write controls and never writes; manual_prices rows carry no id and use the owner id in the save diff
- 1dc7283 Handoff: new Tech-Lead session id
- cb6269b Registry: fresh Tech-Lead session; learning on usage review
- db8bc49 Handoff note rewritten for the household feature (state at 543b241)
- 51884ab Tech-Lead handoff: Release 15 state and production procedure
- 8d04cda Registry: fresh Product Manager session
- f41c417 PM handoff: state at Release 15 for the PM session replacement
- 0b3358b AGENTS.md rule 16: message economy and hand-off at 400k tokens
- ce24ee5 Set CONTACT_EMAIL to support@stiver.io; remove personal address fragment from learning.md
- 543b241 Household card rework (fast lane): Manage button, badge after name, Pending row icons, remove confirm names the person
- b2812b3 Migration 31 is the single final file (includes the was_* body); staging already has the same end state
- 131fec2 Repo matches staging: migration 31 as applied, migration 32 adds the was_* function body
- 722b82b Household slice 2: Activity page (#/activity), filters, entry row, activity_opened, tests, docs, Indonesian
- 22ed956 Activity: log the old amount and old balance (Figma 'was ...' rows)
- 2c50a68 Household slice 2: migration 31 activity_log (triggers, RLS, 180-day purge) + SQL test
- abd8152 Household: creation time on every record label, ignore __pycache__
- 061f915 Learning: Tech-Lead session notes
- 05cb9c6 Restore tools/__pycache__ (accidental binary change on the feature branch)
- e51027b README: activation target 25% (owner)
- eca7697 Household slice 1 ready report
- c10b29f Join page: language chips stay right of the logo at phone width
- bcb1328 README: activation metric, retention, targets, guardrail metrics
- 7cfffcf README: success and performance metrics
- 6895a03 Household docs: context, regression scenarios, FT-008, change note, learning
- d160363 Household: sign-up goes through signup-gate; sent screen mentions the invite email
- dd4703c Analytics: assert invite_accepted and login_deleted
- b03ecc2 Household: a Viewer's app does not generate recurring entries
- 54c2948 Household: guard messages name the item being deleted (Figma 27/29)
- d0b4e4c Registry: fresh Full-stack engineer session; Figma status suffix convention
- 15c5e77 Handoff note for a fresh Full-stack engineer session
- e35dc4d Household UI slice E: delete confirmations name the item, Added by on accounts/debts/investments/budget dialog, Your access changed notice
- 52d562d Household: Indonesian strings, analytics events (docs + test), error-contract test
- 4f00560 README: AI team, not building, known limits, pre-public checklist
- f92b265 Household: spike 2 round 2 results; error-contract test (PT409 stale)
- d2dd587 Household: migration 30 (stale revision raises PT409, not retried by PostgREST), client classifier, spike 2 report
- 1ae36ac Household: clientIp() uses cf-connecting-ip, then sb-forwarded-for, then the first x-forwarded-for entry (E2 verified on staging); remove throwaway debug-headers
- f0c2104 Household UI slice D: who-submitted labels, read-only rows and detail for Editors/Viewers, Added by/Edited by, fake household support, household_labels e2e
- 61d7a49 Rewrite README: problem-first, household in development, remove stale text
- 4a9289b Household: Join page e2e test (household_join), fake setSession, Join page keeps its own address
- 56ba1f0 Household UI slice C: Join page at /join (token kept in memory, fragment removed), expired/used and signed-in-as-someone-else states, vercel rewrite for /join
- 15bc54c Household: scope tests for household_people(); throwaway debug-headers function for spike 2 (staging only)
- 71d3780 Household: migration 29 adds email to household_people(); migration 28 restored to the applied content; UI slice B e2e 55/55
- 99fa9c9 Record Release 14
- cfbcacd Household UI slice B: Settings Household card, invite dialog and states, pending Resend/Revoke, role/remove/leave dialogs, member lock on currency/period; household_people returns email
- 2f9b895 Household: local SQL check harness; fix three test expectations found by it (125/125 pass on migrations 25-28)
- 78b9e61 PM handoff note
- baba1a9 Household UI slice A: no-access page, Viewer write guard, household error messages, 30s/focus refresh; attribution fields from the database
- a764121 e2e fake: maybeSingle for household load
- 778cf5b Household: cloud.js household layer (strict write path, load by status, poll, error classes, function calls); deploy follow-ups
- 0ee937e Household: IP-independent global backstops, atomic invite claim before the password, notes (Developer 2's E2 condition)
- f99a73c household_functions tests: read-only join check, sessions ended by apply, reason named by the check
- 8b3661d Household review fixes E1-E14: join order (check, bytes, password, apply with session delete), join_household_check, salted bucketed IP limits failing closed, send-based per-email cap, own-timeout mail, stray-login refusal, body guards, sweep split and pruning, stored names, deploy notes
- 36d30a5 Household Edge Functions as code (invite-member, manage-invite, join-household, signup-gate, delete-my-login, invite-sweep) and email_exists(); not deployed
- 866798a Household guard tests: FK cascade/set-null delete guards, linked-row policies, transfer legs, manual_prices, MFA refusal, owner deletion
- 060ad3e Household function tests: member action permissions, removal, household_people/profile, session delete, execute rights
- 9c8ac26 Household SQL tests for migration 4 functions (invite lifecycle, cap, join refusals, guard order)
- 947bd44 Household SQL tests: message patterns, upsert with rev, re-save of generated rows, UTC slack, solo ledger, nothing cascaded after refusal, broader policy loop
- 491123c Household migrations: review fixes S1-S5, M1-M4 and suggestions (no rev reset on insert, recurring checks only for new rows, UTC slack, no kind check, error contract, phone checks, live-invite cap, member name on delete)
- 9df8179 Household migration 4 (functions, sign-up trigger change, member actions, service-only invite/join functions) - NOT applied
- 5791cac Household SQL tests for RLS, stamps, recurring attribution and delete guards; change file; FT-008 status
- 04f8559 Household migrations 2 and 3 (RLS, transaction ownership, profile grants, stamps, stale-edit check, recurring attribution, poll counter, delete guards) and down script - NOT applied
- 0a7ca80 household_hardening test: plan(9)
- 4bfd4fa Household migration 1b (hardening) and tests: household_state via household_owner(), membership guard trigger, recurring_rule_id note

**Files by area**
- App (what users see) (5): prototype/app.js, prototype/cloud.js, prototype/config.js, prototype/i18n-id.js, prototype/styles.css
- Database migrations (8): supabase/migrations/20261104000024_household_tables.sql, supabase/migrations/20261104000025_household_hardening.sql, supabase/migrations/20261104000026_household_rls.sql, supabase/migrations/20261104000027_household_triggers.sql, supabase/migrations/20261104000028_household_functions.sql, supabase/migrations/20261104000029_household_people_email.sql, supabase/migrations/20261104000030_household_stale_409.sql, supabase/migrations/20261105000031_household_activity.sql
- Edge Functions (8): supabase/functions/DEPLOY.md, supabase/functions/_shared/util.ts, supabase/functions/delete-my-login/index.ts, supabase/functions/invite-member/index.ts, supabase/functions/invite-sweep/index.ts, supabase/functions/join-household/index.ts, supabase/functions/manage-invite/index.ts, supabase/functions/signup-gate/index.ts
- API and hosting (1): vercel.json
- Tests (7): tests/e2e/analytics.js, tests/e2e/fake_supabase.js, tests/e2e/household_activity.js, tests/e2e/household_join.js, tests/e2e/household_labels.js, tests/e2e/run.js, tests/e2e/run_all.sh
- Tooling (2): tools/__pycache__/dev_server.cpython-313.pyc, tools/sql_local_test.sh
- Docs and rules (32): README.md, context.md, docs/AGENTS.md, docs/ANALYTICS.md, docs/FEATURE_TESTS.md, docs/FIGMA.md, docs/RELEASES.md, docs/changes/2026-11-04-household-migration-1.md, docs/changes/2026-11-04-household-migration-2-3.md, docs/changes/2026-11-04-household-prd.md, docs/changes/2026-11-05-contact-email.md, docs/changes/2026-11-05-household-activity.md, docs/changes/2026-11-05-household-card-rework.md, docs/changes/2026-11-05-household-edge-functions.md, docs/changes/2026-11-05-household-local-sql-check.md, docs/changes/2026-11-05-household-people-email.md, docs/changes/2026-11-05-household-slice1-client.md, docs/changes/2026-11-05-household-viewer-controls-manual-prices.md, docs/changes/2026-11-05-message-economy.md, docs/changes/2026-11-05-readme-metrics.md, docs/changes/2026-11-05-readme-rewrite.md, docs/handoff/fullstack.md, docs/handoff/pm.md, docs/handoff/release15_prod_migrations_25_31.sql, docs/handoff/techlead.md, docs/prd/household-technical-design.md, docs/prd/household.md, docs/reports/2026-11-05-household-slice1-ready.md, docs/reviews/2026-11-05-household-spike2.md, docs/roles/README.md, learning.md, regression_scenario.md
- Other (9): .gitignore, supabase/migrations_down/20261104000026_household_rls.down.sql, supabase/tests/household_activity.test.sql, supabase/tests/household_functions.test.sql, supabase/tests/household_guards.test.sql, supabase/tests/household_hardening.test.sql, supabase/tests/household_rls.test.sql, supabase/tests/household_tables.test.sql, supabase/tests/local/stubs.sql

**Database migrations**
supabase/migrations/20261104000024_household_tables.sql, supabase/migrations/20261104000025_household_hardening.sql, supabase/migrations/20261104000026_household_rls.sql, supabase/migrations/20261104000027_household_triggers.sql, supabase/migrations/20261104000028_household_functions.sql, supabase/migrations/20261104000029_household_people_email.sql, supabase/migrations/20261104000030_household_stale_409.sql, supabase/migrations/20261105000031_household_activity.sql. Applied to staging: NOT RECORDED. Applied to production: NOT RECORDED.

**Tests and smoke:** tools/regression.js 4/4 on ac59ab6; full e2e 58/58; QA real-account household checks green with accepted gaps (forgot-password, join while signed in as someone else, two-session conflict UI, live transfers/recurring/category merge, Indonesian Join page and owner card, invite-sweep with the real service key). production smoke 15/15 on https://stiver.io (main 52b656e, stiver-shell-52b656e082); migrations 24-31 applied on production (24 via the tool, 25-31 as one transaction by the owner in the SQL editor); 6 Edge Functions deployed and curl-checked
**Known gaps:** release.js --verify-only compares 7-char sha with the 10-char stamp (known bug); production Edge Function secrets RESEND_API_KEY/MAIL_FROM/SITE_URL not visible to agents (owner to confirm); invite-sweep daily schedule is the owner's Action; qa-hh-p1: revoking an invite did not remove the half-created login in a direct sign-up test (look next to invite-sweep)

## Release 14 contents (main e64e5e9)

**Items in this release**
- Docs/process (branch staging): Release 13 recorded; Tech-Lead handoff note and registry; decision log entry (owner approved Releases 12-13 after the fact; docs-only bundling)

**Exact detail.** Range: 6761bfe..68c67bd. 4 commits, 4 files.

**What changed, in plain words** (the changelog lines this release added)
- (no changelog line added)

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- 68c67bd Record owner approval of Releases 12-13 and bundling decision
- 3ad2d20 Registry: fresh Tech-Lead session
- 025d9eb Tech-Lead handoff note
- 2278959 Record Release 13

**Files by area**
- Docs and rules (4): docs/DECISIONS.md, docs/RELEASES.md, docs/handoff/techlead.md, docs/roles/README.md

**Database migrations**
None.

**Tests and smoke:** skipped (docs only). skipped (docs only); shell check: production serves stiver-shell-e64e5e9988 (10-char sha, verify-only expected 7 chars, so it reported FAIL on a length mismatch only)
**Known gaps:** tools/release.js --verify-only compares a 7-char sha with the 10-char stamp

## Release 13 contents (main 6761bfe)

**Items in this release**
Docs/process:
- Opus review needs the owner's approval [chore/opus-approval]
- Opus review only for big features [chore/opus-scope]

**Exact detail.** Range: 8c6e642..8e163d7. 4 commits, 4 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-05: Opus review needs the owner's approval (owner request). `docs/AGENTS.md` rules 9 and 15 and `docs/roles/pm.md`: before any Opus / different-model reviewer session starts, the Tech-Lead hands the PM a short case and cost; the PM posts a Workspace decision; no answer means normal review only. Docs only; branch `chore/opus-approval`.
- 2026-11-05: Opus review only for big features (owner request). `docs/AGENTS.md` rules 9 and 15: the different-model (Opus) review is used only for a big feature or a major authentication/database change; small changes, even in those areas, get normal peer review and QA. Docs only; branch `chore/opus-scope`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- 8e163d7 Fold opus-approval change file
- b768e7d Opus review needs the owner's approval
- babfbe6 Fold opus-scope change file
- ce71ae9 Opus review only for big features; record Release 12

**Files by area**
- Docs and rules (4): docs/AGENTS.md, docs/CHANGELOG.md, docs/RELEASES.md, docs/roles/pm.md

**Database migrations**
None.

**Tests and smoke:** regression and production smoke skipped by rule (docs only). Production serves stiver-shell-6761bfe917 (checked). PR 18
**Known gaps:** none

---

## Release 12 contents (main 8c6e642)

**Items in this release**
Docs/process:
- Release reports start with a high-level item list [chore/release-items]
- Token-use rules [chore/cost-rules]
- Workspace: Approvals tab [chore/approvals-tab]
- No agent asks the owner anything directly [chore/no-direct-asks]
- Developer 1 and 2 renamed [chore/rename-roles]
- Security involvement limited to major authentication and database changes [chore/security-scope]
- Release contents shown exactly [chore/release-contents]
- The owner does not repeat anything [chore/owner-input]
- Workspace: decisions and actions are separate [chore/workspace-needs]
- Workspace: phone layout and PM backlog [chore/workspace-mobile]
- Workspace: chat view and 3D office [chore/workspace-chat]
- Stiver Workspace [chore/workspace]
- Figma Library: Avatar and Chip components (household design) [chore/decisions-figma-lib]

**Exact detail.** Range: 631cb8b..0f44c00. 36 commits, 19 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-05: Release reports start with a high-level item list (owner request). `tools/release_contents.js` now puts "Items in this release" first (Features, Fixes, Docs/process, Tooling; one plain line per changelog entry with its branch, no files or hashes), then the exact detail; `docs/RELEASES.md` rewritten for releases 8 to 11; `docs/WORKSPACE.md` updated. Docs and tooling only; branch `chore/release-items`.
- 2026-11-05: Token-use rules (owner: "it's too expensive now"). Measured from the run logs: cost is context size times number of tool calls (Full-stack engineer about 185k tokens per call over 5 days, Tech-Lead about 658k, PM small), not messages. `docs/AGENTS.md` rule 15: no acknowledgements (`No reply needed.`), long findings in `docs/reviews/`, few big calls and no whole-file/event-log dumps, reviewers read the diff (different model only for auth/database), fresh sessions with a handoff note past about 200k tokens, per-role reading lists (`docs/roles/README.md`), milestone-only Workspace posts and no presence timer (`docs/WORKSPACE.md`), event-driven PM backlog and pointer relays (`docs/roles/pm.md`). Docs only; branch `chore/cost-rules`.
- 2026-11-05: Workspace: Approvals tab (owner request). The Needs-you area has a fourth tab, Approvals (collection `approvals`): formal yes/no sign-offs on finished work (gate 1 PRD, gate 2 design, staging sign-off, release request) with links, what it covers and does not cover, evidence and one recommendation; Approve / Request changes with an optional note; a release approval is recorded as intent and still needs a chat message. Also fixed on the page: action and decision cards map old labels like "Developer 2" to the new role names, and the numbered step badges no longer overlap the checkboxes on the phone. `docs/WORKSPACE.md`, `docs/roles/pm.md`. Docs and page only; branch `chore/approvals-tab`.
- 2026-11-05: No agent asks the owner anything directly (owner feedback). `docs/AGENTS.md` rule 14: asks go to the PM and appear on the Workspace as a decision or action; emergencies use a Workspace message to the owner plus a copy to the PM; an owner contact is reported to the PM at once; no plan mode or question prompts for owner approvals; tool-permission prompts are announced to the PM first. `.claude/settings.json` now denies AskUserQuestion, EnterPlanMode and ExitPlanMode. Ready report and review replies carry `Owner-bound asks: all on the Workspace (yes/no)`; `docs/WORKFLOW.md`, `docs/roles/pm.md` updated. Trigger: the Full-stack engineer's session was in plan mode and the harness showed the owner a plan-approval prompt that was not on the Workspace. Docs and settings only; branch `chore/no-direct-asks`.
- 2026-11-05: Developer 1 and 2 renamed (owner request). Developer 1 is now the Full-stack engineer (builds), Developer 2 the Tech-Lead (reviews, integrates, releases, owns the workflow) in CLAUDE.md, context.md, docs/AGENTS.md, docs/WORKFLOW.md, docs/WORKSPACE.md, docs/DEV_WORKFLOW.md, docs/roles/*, and on the Workspace page (a name map; the keys dev1/dev2, session ids and branches are unchanged; history entries keep the old names). Docs and page only; branch `chore/rename-roles`.
- 2026-11-05: Security involvement limited to major authentication and database changes (owner request, to keep token use low). `docs/AGENTS.md` rule 9 high-risk lane and review item 3, `docs/WORKFLOW.md`, `docs/roles/pm.md`, `docs/roles/README.md`: the different-model security review, real-system check and plain-words risk summary apply only to major changes that update authentication (sign-in, sessions, handoff, invites, tokens, passwords) or the database (migrations, RLS, functions, triggers); every other change gets normal peer review and QA with no security step. The household and handoff-hardening work stay in the lane. Docs only; branch `chore/security-scope`.
- 2026-11-05: Release contents shown exactly (owner request). `tools/release_contents.js` lists a release's commits, files by area, plain-words changelog lines, what a user can see, migrations, tests/smoke and gaps; `tools/release.js` prints it (dry run and after a release); `docs/RELEASES.md` holds it for releases 8 to 11 (new rule: every release, exact contents, never a summary); the PM sees the owner's Workspace messages first and relays them in detail (`docs/AGENTS.md` rule 13, `docs/WORKSPACE.md`, `docs/roles/pm.md`). Docs and tooling only; branch `chore/release-contents`.
- 2026-11-05: The owner does not repeat anything (owner request). Page answers on the Workspace count as the owner's approval for gates 1 and 2 and all decisions and actions (release and production migrations still need a chat message); every agent reads the Workspace for the owner's input; chat statements are mirrored to the Workspace as quoted messages. `docs/WORKSPACE.md`, `docs/AGENTS.md` rule 12, `docs/roles/pm.md`, `docs/DECISIONS.md`. Docs only; branch `chore/owner-input`.
- 2026-11-05: Workspace: decisions and actions are separate (owner request). The Needs-you area has Decisions (each option shows pros, cons, a Recommended tag and a recommendation) and Actions (numbered steps with checkboxes, exact page links, time estimate, what to do afterwards; "I did this" / "Not now"), plus a Log. New `actions` collection; rules in `docs/WORKSPACE.md` and `docs/roles/pm.md`. Docs only; branch `chore/workspace-needs`.
- 2026-11-05: Workspace: phone layout and PM backlog (owner request). The Workspace page now follows a team chat app on the phone: bottom bar Home / DMs / Backlog / Office, decisions as a banner on Home, channels and DM threads full screen. New `backlog` collection the owner adds to and the PM works through continuously (`docs/WORKSPACE.md`, backlog loop in `docs/roles/pm.md`). Docs only; branch `chore/workspace-mobile`.
- 2026-11-04: Workspace: chat view and 3D office (owner request). The Stiver Workspace page now shows agent-to-agent conversation with quoted replies and live "working on" status, plus a 3D office tab (desks, speech bubbles, glowing screens, a ringing bell for decisions). `docs/WORKSPACE.md` adds `replyTo`, the `presence` collection and the rule to mirror every inter-agent message. Docs only; branch `chore/workspace-chat`.
- 2026-11-04: Stiver Workspace (owner request). A Claude artifact with a Slack-like feed of all agent messages and a pinned "Needs you" tray for decisions the owner must make (answers saved on the page, relayed by the PM). `docs/WORKSPACE.md` (URL, message and decision schema, who posts, how answers are used and the limit that release/production migrations still need a chat message), `docs/AGENTS.md` rule 11, `docs/roles/pm.md`. Docs only; branch `chore/workspace`.
- 2026-11-04: Figma Library: Avatar and Chip components (household design). `docs/FIGMA.md` components table now lists Avatar (`Initial`) and Chip (`Text`, `Selected`) added by the Designer for the household feature; decision log merged from the PM's branches. Docs only; branch `chore/decisions-figma-lib`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- 0f44c00 Fold release-items change file
- 4a22a96 Release reports start with a high-level item list; releases 8-11 rewritten
- 291889f Fold cost-rules change file
- 5fcd095 Token-use rules: AGENTS rule 15, reading lists, milestone-only posts, event-driven PM
- 98b1ea0 Fold approvals-tab change file
- 3d80db3 Workspace docs: approvals tab and collection
- 58dc63a Fold no-direct-asks change file
- 274de16 No agent asks the owner directly: rule 14, deny question and plan tools, report check line
- 1ad0845 Log Full-stack engineer plan approval
- 726775a Fold rename-roles change file
- 2a73b18 Rename Developer 1 and 2: Full-stack engineer and Tech-Lead (display names only)
- e720b7a Log handoff message approval and owner process rules
- 1080c33 Fold security-scope change file
- 9087ded Security review only for major authentication and database changes
- 0e35082 learning: Workspace decision card overflow and unclear selection
- 36e1f4e Release contents: no truncation of changelog lines; docs/RELEASES.md regenerated
- ae29a7c Fold release-contents change file
- 8b97551 Exact release contents (tool, docs/RELEASES.md); PM sees owner messages first
- 309322e Fold owner-input change file
- d6789b2 Owner input: page answers count for gates 1 and 2; agents read the Workspace; chat mirrored
- e519b74 Log handoff PRD approval and Workspace approval rule
- e2bbd8a Workspace docs: presence heartbeat; trim learning log to the doc budget
- de20855 Fold workspace-needs change file
- d2b35cc Workspace docs: decisions with pros and cons, actions with steps and links
- 27f51b5 learning: frozen db documents in the Workspace page
- bfd3cb5 Fold workspace-mobile change file
- 53a5e66 Workspace docs: phone layout and PM backlog loop
- d93fc8c Fold workspace-chat change file
- 557bfb3 Workspace docs: chat replies, presence, 3D office
- 7c1978e Fold workspace change file
- 59fb141 Add Stiver Workspace docs (shared feed and needs-you tray)
- 244c6d7 Fold figma avatar/chip change file
- 5d8008b FIGMA.md: Avatar and Chip components
- 1196005 Log remaining household owner decisions
- 6b1c85d Decision log: household design approved (gate 2)
- 57c5de4 Decision log: editor edits only own transactions

**Files by area**
- Tooling (2): tools/release.js, tools/release_contents.js
- Docs and rules (16): CLAUDE.md, context.md, docs/AGENTS.md, docs/CHANGELOG.md, docs/DECISIONS.md, docs/DEV_WORKFLOW.md, docs/FIGMA.md, docs/READY_REPORT.md, docs/RELEASES.md, docs/WORKFLOW.md, docs/WORKSPACE.md, docs/learning-archive.md, docs/reviews/README.md, docs/roles/README.md, docs/roles/pm.md, learning.md
- Assistant settings (1): .claude/settings.json

**Database migrations**
None.

**Tests and smoke:** browser suite, regression and production smoke skipped by rule (docs, tooling and settings only). Production serves stiver-shell-8c6e642191 (checked). PR 17
**Known gaps:** none

---

## Release 11 contents (main 631cb8b)

**Items in this release**
Docs/process:
- PM is the owner's only gateway [chore/pm-gateway]
- Review standard [chore/review-standard]

**Exact detail.** Range: 6091f7f..548e1cc. 5 commits, 8 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-04: PM is the owner's only gateway (owner request). `docs/roles/pm.md` (owner gateway: one digest with recommended defaults, verbatim relay of answers, gate checklists, deployment updates, decision log), `docs/WORKFLOW.md` (owner-bound messages go to the PM; releases need the PM's relayed quote), `docs/roles/README.md`, `docs/AGENTS.md` rule 10, `docs/DECISIONS.md`. Docs only; branch `chore/pm-gateway`.
- 2026-11-04: Review standard (owner request). `docs/AGENTS.md` rule 9: evidence for every finding, expected risks written before reading the diff, tests that fail on the old code, a high-risk lane (auth, RLS, migrations, payments, deletion: different-model reviewer, real-system check, owner informed in plain words), independence rules, and an escaped-defect log in `learning.md`; summarised in `docs/WORKFLOW.md`. Docs only; branch `chore/review-standard`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- fb660b0 Log household owner decisions
- c23b796 Fold pm-gateway change file
- f8c57b3 PM is the owner's gateway; owner may still reach any agent directly
- af11fce Fold review-standard change file
- 9abb4b3 Add review standard (AGENTS rule 9)

**Files by area**
- Docs and rules (8): CLAUDE.md, docs/AGENTS.md, docs/CHANGELOG.md, docs/DECISIONS.md, docs/WORKFLOW.md, docs/roles/README.md, docs/roles/pm.md, learning.md

**Database migrations**
None.

**Tests and smoke:** browser suite, regression and production smoke skipped on purpose (docs and tooling only). Production serves stiver-shell-631cb8bbfe (checked). PR 16
**Known gaps:** none

---

## Release 10 contents (main 6091f7f)

**Items in this release**
Docs/process:
- Agent workflow document and roles update [chore/workflow-doc]
- Agent team: Product Manager, Designer, QA [chore/agent-team]

**Exact detail.** Range: e58dd4a..fee0f6d. 5 commits, 10 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-04: Agent workflow document and roles update (owner request). `docs/WORKFLOW.md`: flow diagram (PM -> Designer -> Developer 1 -> review -> QA -> staging -> release -> PostHog), the owner's three gates, the hand-off message formats between agents, rules of the road. Developer 1 is now the main developer; Developer 2 reviews all production changes, integrates, releases and owns the workflow (`docs/AGENTS.md` rules 1 and 8). Docs only; branch `chore/workflow-doc`.
- 2026-11-04: Agent team: Product Manager, Designer, QA (owner request). `docs/roles/` (README with the flow, three owner gates, direct hand-off rule, session registry, lanes; `pm.md`, `designer.md`, `qa.md`), `docs/PRD_TEMPLATE.md`, `docs/AGENTS.md` rule 7. QA writes test cases from the PRD's acceptance checks and runs `tools/regression.js` / smoke; Designer builds Figma from the approved PRD; PM writes the PRD and reads PostHog after release. Docs only; branch `chore/agent-team`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- fee0f6d Fold workflow-doc change file
- d40627d Add agent workflow document; Developer 1 main developer, Developer 2 reviewer and integrator
- a78021d Registry: PM, Designer, QA session ids
- de4132f Fold agent-team change file
- 799fd68 Add PM, Designer and QA agent roles, PRD template and team workflow

**Files by area**
- Docs and rules (10): CLAUDE.md, context.md, docs/AGENTS.md, docs/CHANGELOG.md, docs/PRD_TEMPLATE.md, docs/WORKFLOW.md, docs/roles/README.md, docs/roles/designer.md, docs/roles/pm.md, docs/roles/qa.md

**Database migrations**
None.

**Tests and smoke:** browser suite, regression and production smoke skipped on purpose (docs and tooling only). Production serves stiver-shell-6091f7f83b (checked). PR 15
**Known gaps:** none

---

## Release 9 contents (main e58dd4a)

**Items in this release**
Tooling:
- Release and regression tools

**Exact detail.** Range: 00cacb3..f3cc685. 2 commits, 7 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-04: Release and regression tools (owner: "do 1 and 2, fast lane"). `tools/regression.js` runs the browser suite, staging smoke and real-database regression and prints the regression summary; `tools/release.js` (dry run by default, `--go` opens and merges the PR, `--verify-only <sha>` waits for the new build and runs the production smoke test); `tools/gates.js` classifies a diff: docs/tooling-only changes (docs/, tools/, .claude/, root *.md) skip regression and the production smoke test. Peer review skipped (docs/tooling only). Branch `chore/release-tools`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- f3cc685 Fold release-tools change file
- e8c1fa4 Add release and regression tools; docs-only changes skip regression and smoke test

**Files by area**
- Tooling (3): tools/gates.js, tools/regression.js, tools/release.js
- Docs and rules (4): CLAUDE.md, context.md, docs/CHANGELOG.md, learning.md

**Database migrations**
None.

**Tests and smoke:** browser suite 0 failures (before release), staging smoke 15/15, real-database regression passed; production smoke skipped (docs and tooling only). Production serves stiver-shell-e58dd4aefc (checked). PR 14
**Known gaps:** tools/release.js --go untested: gh is not signed in in cloud sessions

---

## Release 8 contents (main 00cacb3)

**Items in this release**
Docs/process:
- Fewer approval prompts
- Figma component library [chore/figma-library]
- Peer review of production code [chore/peer-review]

**Exact detail.** Range: 13eff20..4b431c9. 7 commits, 11 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-04: Fewer approval prompts (owner request). Added `.claude/settings.json` with `permissions.allow` for all Figma, GitHub, Supabase and Vercel tools and `permissions.ask` for the irreversible or production-affecting ones (merge PR, delete file, apply migration, delete/pause/reset Supabase project or branch, Vercel promote/rollback/alias/domain/DNS/env/firewall/delete). Also asks for Supabase `execute_sql` (can write or delete production data; reads still work through list_tables, get_advisors, query_logs), Vercel `run_session_command` and GitHub `create_repository` (added after Developer 2's review). Only sessions with a single repository read it; connector tool permissions and Auto mode are set by the owner in claude.ai. Workflow approvals (release, regression summary, peer review) are unchanged. Branch `chore/permissions`.
- 2026-11-04: Figma component library (owner approved the plan). The Stiver Figma file has a new Library page: variable collection `Stiver tokens` (29 variables: colours, radii, spacing; Light and Dark modes, scopes and CSS code names), 11 text styles, the card shadow style, and 7 real components (Button x3 kinds, Badge, Corner tab, Close, Field input/select x default/new, Hint, Recurring row) with text properties, plus a Light and a Dark overview frame and an Edit debt example built only from instances. Dark is the same frame with the Dark mode set. `docs/FIGMA.md` (how to design, names, conventions), `tools/figma/helpers.js` (frame/card/phone/instance helpers and `featureSection`, which adds a request note, status line and an `Owner comments` layer), `tools/figma/example_edit_debt.js`, `tools/figma/lint.js` (checks every Feature section for note, status, phone light and dark, Owner comments; the three existing sections only lack the Owner comments layer). `docs/DEV_WORKFLOW.md` section 0 and `CLAUDE.md` rule 6 say to build from the library. Measured: the Edit debt frame in light and dark is about 5.4k characters of script including helpers, against about 9.5k before for one build of the same kind; extra states and dark cost a few lines. Existing flat sections were not converted; Figma comments still cannot be read by agents. Docs and tooling only; branch `chore/figma-library`.
- 2026-11-04: Peer review of production code (owner request). Developer 1 and Developer 2 review each other's non-fast-lane production-code changes before they reach `staging` (`docs/AGENTS.md` rule 5, `CLAUDE.md` rule 6d, `Reviewed by` line in `docs/READY_REPORT.md`): a five-point checklist (correctness and a test that fails on the old code, data safety, privacy and security, house rules, simplicity), one round, reviewer replies `approved <commit>` or numbered blocking/suggestion findings and does not push to the author's branch; Developer 2 merges Developer 1's branch after reviewing it and needs Developer 1's approval before merging its own; exempt: fast lane, docs/tooling only, owner hotfixes (reviewed afterwards); nobody approves their own change. Docs only; branch `chore/peer-review`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- 4b431c9 Fold permissions change file into CHANGELOG
- ea01695 Permissions: also ask before execute_sql, run_session_command and create_repository (Developer 2's review)
- 83460dc Fold change files into docs/CHANGELOG.md
- 1b822db Figma component library: docs and helper snippets
- f277f64 Allow routine Figma/GitHub/Supabase/Vercel tool calls without a prompt; keep asking for destructive and production-affecting ones
- 759e6b5 Fold change files into docs/CHANGELOG.md
- 606f853 Peer review of production code between Developer 1 and Developer 2

**Files by area**
- Tooling (3): tools/figma/example_edit_debt.js, tools/figma/helpers.js, tools/figma/lint.js
- Docs and rules (7): CLAUDE.md, context.md, docs/AGENTS.md, docs/CHANGELOG.md, docs/DEV_WORKFLOW.md, docs/FIGMA.md, docs/READY_REPORT.md
- Assistant settings (1): .claude/settings.json

**Database migrations**
None.

**Tests and smoke:** browser suite 0 failures, staging smoke 15/15, real-database regression passed. Production smoke 15/15 on stiver.io (stiver-shell-00cacb3e0f). PR 13
**Known gaps:** Four write tools stay on the allow list by the owner's choice; the permissions file was reviewed by one reviewer only
