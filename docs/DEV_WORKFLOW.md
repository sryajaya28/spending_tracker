# Delivery workflow: local → staging → production

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

## 1. Local first

1. Every piece of work starts on its own branch (`feature/<short-name>`), never directly on `staging` or `main`.
2. The assistant builds it and **tests the feature** (see Feature testing below) before showing it.
3. The assistant shows the result in a way the owner can review: a **preview link of the branch** (every branch push builds its
   own hosted copy; the assistant gets the link from the host and sends it), a few screenshots, and the exact steps to try it.
   Preview links, the staging site and local runs all use the **staging database**; only the live app uses the production one,
   so nothing tried before release can touch real data. Hosted non-production copies show a small "Staging · test data" label.
   The assistant lists what changed, what was *not* verified, and any decision it needs.
4. The owner reviews and leaves comments. The assistant fixes them on the same branch and shows the result again.
   Repeat until the owner approves.
5. **Only after approval** is the branch merged into `staging`. Until then nothing is deployed to staging or production,
   and no database change is applied anywhere except local/throwaway databases.

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

## Standing rules

- Secrets never go into the repository. Test-account credentials live in the hosting/CI secret store.
- Every change updates the project's context file, regression scenarios, README and translations in the same commit.
- Commit messages say *why*; one logical change per commit; no force-pushes to shared branches.
- Be honest about what was verified: say "tested in the test browser only" when that is the case; never present mocked or
  made-up results as real ones.
- Hotfix exception: a production outage or data-loss bug may skip stage 1–2 to restore service, but the owner is told at once,
  and the fix goes through the normal flow afterwards.
- Keep a short **release notes** entry per release (date, features, migrations, regression/smoke result).

## Project setup (fill in per repository)

| Item | Value |
|---|---|
| Local run command | |
| Test command (automated suite) | |
| Feature test list | `docs/FEATURE_TESTS.md` |
| Regression scenarios | |
| Staging URL / branch | |
| Staging database / project | |
| Production URL / branch | |
| Smoke-test account (where the secret lives) | see `docs/SMOKE_TEST.md` (environment secrets, never the repo) |
| Rollback method | |
| Migration folder and how it is applied | |

### This repository (Stiver) — current state

Production is `https://stiver.io` (branch `main`, Vercel auto-deploys every push). Staging and the smoke-test account do not exist yet;
see the "What is pending" list the assistant gave the owner, now recorded in `docs/NEXT_STEPS.md`.
