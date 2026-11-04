# Delivery workflow: local → staging → production

> The shared source of truth is the repository **`sryajaya28/dev-workflow`** (private), used by all projects. This copy is kept so a session
> without access to that repository still has the rules; when the workflow changes, change it there first, then copy it here.

A project-independent working agreement between the owner and the assistant. Copy this file to any repository (or keep it in one
shared place such as `~/.claude/CLAUDE.md` or a `dev-workflow` repo) and fill in the **Project setup** table at the bottom.

Nothing moves to the next stage without the owner's explicit approval. "Approved" means the owner said so in plain words
(for example "approved", "ship to staging", "release"); silence, a thumbs-up on a screenshot or a question is not approval.

## The three stages

| Stage | Where it runs | Data | Who decides to leave it |
|---|---|---|---|
| 1. Local | the assistant's working copy / a feature branch preview | throwaway or fake data | owner approves the change |
| 2. Staging | a hosted copy of the app on its own database | test accounts only | owner approves the regression summary |
| 3. Production | the live app | real users | assistant smoke-tests right after release |

```
feature branch ──(owner approves)──▶ staging ──(owner asks for regression, then approves summary)──▶ production ──▶ smoke test
```

## 0. Design first (Figma)

Every request that changes a screen, flow or text starts with a design in the project's Figma file, before any code (copy of the shared
rule in `dev-workflow`; the shared repo wins if they differ). Figma file for Stiver: "Stiver",
https://www.figma.com/design/DnfE4wtwMDGQyOW76MkVRW

1. Design the change in the app's real look (reuse components and tokens), including the states that matter (empty, error), **always the
   dark-mode and phone-width versions of every screen** (plus desktop where it exists) and a flow with arrows when several screens are involved.
2. Give the feature its own Figma section `Feature - <short-name>` (same short name as the branch) with a note: the request in the
   owner's words, decisions/open questions, and status (`design` / `approved` / `implemented` / `released`).
3. Send the owner the link, screenshots and open questions, then stop until the owner approves **the design** in plain words
   (this is not approval to merge to `staging`).
4. Then develop (section 1) against the approved design; if the work must deviate, tell the owner and update the design first.
5. When implemented, update the feature section to the as-built screens (status `implemented`); after the smoke test set `released`.
6. If the owner says "skip figma", go straight to development, but update Figma after the release.
7. If Figma cannot be reached, say so at once and let the owner choose; never claim Figma is updated when it is not.

Changes that touch no screen, flow or text (typo, calculation bug, backend only) need no design; say "no design change" and why.

## 1. Build and test (then straight to staging)

1. Every piece of work starts on its own branch (`feature/<short-name>`), never directly on `staging` or `main`, and begins only after the
   design is approved (section 0) or the owner has said "skip figma".
2. The assistant builds it and **tests the feature** (see Feature testing below).
3. **With an approved design** the branch goes straight to `staging` (merged by the integrator when several agents work, see "Working with more than one agent") once the feature tests and the automated suite pass; no separate
   local or preview review. The assistant sends the **staging link**, screenshots and steps, and the owner signs off on staging (a
   branch preview link only if the owner asks). **Without an approved design** ("skip figma" or none needed): send a preview link,
   screenshots and steps and wait for approval before merging. Previews, staging and local runs use the **staging database**; only the
   live app uses the production one. The assistant lists what changed, what was *not* verified, any difference from the approved design,
   and any decision it needs.
4. The owner reviews on staging and comments; the assistant fixes on the same branch, merges again and shows the result. If the comments
   change the design, update Figma first.
5. Nothing goes to production without the regression summary approval (section 3). A migration is applied to production only in the
   release (section 4), never earlier.

## 2. Feature testing (every feature, before the owner sees it)

- A **feature test list** (`docs/FEATURE_TESTS.md`) holds one entry per feature: what it should do, the steps, the expected result,
  and the automated test that covers it (name of the file or "manual").
- The owner can add entries at any time ("also test X"). The assistant adds them to the list and runs them.
- For each feature the assistant writes or updates automated tests, runs them, and reports pass/fail honestly,
  including the things it could not check (real devices, real third-party services, the live site).
- A feature is "ready for review" only when its entries pass, the existing automated suite still passes, and the docs
  (project context file, regression scenarios, user-facing text/translations) are updated in the same change.

## 3. Staging and regression testing

- Approved features accumulate on `staging`. They are **not** released one by one; the owner decides when there are enough.
- Regression testing runs **only when the owner asks for it**, on the staging deployment:
  1. the full automated suite, pointed at staging where the tests allow it;
  2. the manual regression scenarios (`regression_scenario.md` or equivalent) for every area touched, plus the core flows;
  3. a check of every database migration in the batch (applied to the staging database first, in order, none edited after applying).
- When it finishes the assistant writes a **regression summary** and stops:
  - the improvements in the batch (one line each, in plain words);
  - test results (what ran, what passed, what failed, what was skipped and why);
  - bugs found and how each was fixed (or that it is still open);
  - database/config changes and anything irreversible;
  - risks and anything it could not verify;
  - a clear recommendation: release / do not release.
- **The owner must approve the summary before anything goes to production.** Bugs found during regression are fixed on
  staging and the affected tests are repeated before the summary is final.

## 4. Production and smoke testing

1. Release order: database migrations first (they must be backwards compatible with the version still running), then the code
   (merge `staging` → `main`).
2. Immediately after the release finishes, the assistant runs the **smoke test**: a short fixed list of the most critical paths
   against the live app (page loads without console errors, sign-in, the main create/read flows, the money totals add up,
   a migration-dependent screen, the payment/email path if any). Use a dedicated test account, never real users' data.
3. If everything is fine: report "smoke test passed" with what was checked.
4. If something is broken: **fix it immediately** and release the fix, then smoke test again. If the fix is not quick or the
   problem affects data, roll back first (platform "instant rollback"), then fix. Report what happened either way.
5. The assistant never edits or deletes production data without asking, and looks at the data before any destructive step.

## Working with more than one agent

Several assistants (or sessions) can work on one project if they do not edit the same things at the same time (details: `docs/AGENTS.md`).

1. **One integrator: Developer 2** (Developer 1 and other agents build on feature branches). Only the integrator merges into `staging`, folds the changelog (`node tools/fold_changes.js`) and releases.
   Every other agent works on its own `feature/<name>` branch, rebases on the latest `staging`, runs the tests, and tells the owner
   "ready: <branch>, tests pass, design link, steps". Explicit owner instructions (including a hotfix) go before this rule; whoever acts tells the other agent.
2. **No shared edit hotspots:** the service-worker cache name is stamped at deploy (never bumped by hand); each change adds its own changelog
   file `docs/changes/YYYY-MM-DD-name.md`; shared docs are edited only in the section a change affects.
3. **Split by area** and say which area before starting; keep edits to big shared files small and rebase often.
4. **Hand off in writing**: a short "state of my branch" note (done / untested / blocked) in `context.md` when stopping mid-work.
5. **Optional reviewer**: one agent checks another's branch against the Figma design and the request; it comments, it does not push to that branch.

## Standing rules

- Secrets never go into the repository. Test-account credentials live in the hosting/CI secret store.
- Every change updates the project's context file, regression scenarios, README and translations in the same commit.
- Commit messages say *why*; one logical change per commit; no force-pushes to shared branches.
- Be honest about what was verified: say "tested in the test browser only" when that is the case; never present mocked or
  made-up results as real ones.
- Hotfix exception: a production outage or data-loss bug may skip stage 1–2 to restore service, but the owner is told at once,
  and the fix goes through the normal flow afterwards.
- Keep a short **release notes** entry per release (date, features, migrations, regression/smoke result).

## Project setup (Stiver)

| Item | Value |
|---|---|
| Figma file (design source of truth) | https://www.figma.com/design/DnfE4wtwMDGQyOW76MkVRW ("Stiver"); one section `Feature - <short-name>` per feature |
| Agents | **Developer 2** = integrator (merges to `staging`, releases); **Developer 1** = feature branches only (named by the owner; see `docs/AGENTS.md`) |
| Local run command | `python3 tools/dev_server.py 5180` (uses the staging database; the automated tests use a fake database) |
| Test command (automated suite) | `bash tests/e2e/run_all.sh` (49 tests, all must say PASS) |
| Feature test list | `docs/FEATURE_TESTS.md` |
| Regression scenarios | `regression_scenario.md` (manual) + the automated suite |
| Review link | the Vercel preview of the feature branch (`spendingtracker-git-<branch>-suryajaya378-4429s-projects.vercel.app`; the assistant copies the exact link from Vercel) |
| Staging URL / branch | `https://staging.stiver.io` / `staging` (Vercel domain tied to the branch) |
| Staging database / project | Supabase `spending_tracker_staging`, ref `cujmgyacxbcmltxfjkxo` (email auto-confirm on) |
| Production URL / branch | `https://stiver.io` / `main` (protected: changes arrive by pull request only) |
| Smoke-test account (where the secret lives) | `docs/SMOKE_TEST.md`; environment secrets `SMOKE_PROD_PASSWORD`, `SMOKE_STAGING_PASSWORD` |
| Rollback method | Vercel "Instant Rollback" to the previous production deployment (a database migration is not rolled back; migrations must be backwards compatible) |
| Migration folder and how it is applied | `supabase/migrations/`; applied to staging first, then production, with the Supabase `apply_migration` tool; never edit an applied migration |
| Production addresses (must be in `PRODUCTION_HOSTS`, `prototype/config.js`) | `stiver.io`, `www.stiver.io`, the old `*.vercel.app` aliases |
