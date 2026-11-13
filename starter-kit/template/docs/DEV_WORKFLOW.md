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
Figma design ──(owner approves)──▶ feature branch ──(owner approves)──▶ staging ──(owner asks for regression, then approves summary)──▶ production ──▶ smoke test ──▶ Figma/feature folder final sync
```

## 0. Design first (Figma)

Every request that changes a screen, flow or text starts with a design in the project's Figma file, before any code (Figma file for __PROJECT__: "__PROJECT__",
__FIGMA_URL__

**Figma is the only home of the design**: no design files, exports or feature folders are kept in the repository.

1. Design the change in the app's real look: **build it from the Figma Library components and variables** (`docs/FIGMA.md`; dark mode is a variable mode, so dark costs almost nothing) and add a component when a design needs a new element. Include the states that matter (empty, error), **always the
   dark-mode and phone-width versions of every screen** (plus desktop where it exists) and a flow with arrows when several screens are involved.
2. Give the feature its own Figma section `Feature - <short-name>` (same short name as the branch) with a note: the request in the
   owner's words, decisions/open questions, and status (`design` / `approved` / `implemented` / `released`).
3. Send the owner the link, screenshots and open questions, then stop until the owner approves **the design** in plain words
   (this is not approval to merge to `staging`).
4. Then develop (section 1) against the approved design; if the work must deviate, tell the owner and update the design first.
5. When implemented, update the feature section to the as-built screens (status `implemented`); after the smoke test set `released`.
6. If the owner says "skip figma", go straight to development, but update Figma after the release.
7. If Figma cannot be reached, say so at once and let the owner choose; never claim Figma is updated when it is not.
8. **Fast lane.** When the owner says "fast lane" on a request (meant for small changes: a field, a label, spacing, a one-screen tweak), post the Figma link and start building at once instead of waiting; tests and the merge into `staging` follow as usual, and the owner's one reply covers the design and the staging sign-off together. If the owner rejects the design, the work is redone. Without those words the order above applies.

Changes that touch no screen, flow or text (typo, calculation bug, backend only) need no design; say "no design change" and why.

## 1. Build and test (then straight to staging)

1. Every piece of work starts on its own branch (`feature/<short-name>`), never directly on `staging` or `main`, and begins only after the
   design is approved (section 0) or the owner has said "skip figma".
2. The assistant builds it and **tests the feature** (see Feature testing below).
3. **With an approved design** the branch goes straight to `staging` once the feature tests and the automated suite pass; no separate
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
  (project context file, regression scenarios, user-facing text/translations and, unless the owner skipped it, the feature folder in Figma) are updated in the same change.

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
6. Once the smoke test has passed, set the feature's status to `released` in its Figma folder. For a request where the owner said "skip figma", this is when the Figma file is brought up to date (section 0, point 6).

## Standing rules

- Secrets never go into the repository. Test-account credentials live in the hosting/CI secret store.
- Every change updates the project's context file, regression scenarios, README and translations in the same commit, and keeps the Figma file in step with the code (section 0).
- Commit messages say *why*; one logical change per commit; no force-pushes to shared branches.
- Be honest about what was verified: say "tested in the test browser only" when that is the case; never present mocked or
  made-up results as real ones.
- Hotfix exception: a production outage or data-loss bug may skip stage 1–2 to restore service, but the owner is told at once,
  and the fix goes through the normal flow afterwards.
- Keep a short **release notes** entry per release (date, features, migrations, regression/smoke result).

## Project setup (__PROJECT__)

| Item | Value |
|---|---|
| Figma file (design source of truth) | __FIGMA_URL__; one section `Feature - <short-name>` per feature |
| Local run command | fill in |
| Test command (automated suite) | `bash tests/run_all.sh` (every line must say PASS) |
| Feature test list | `docs/FEATURE_TESTS.md` |
| Regression scenarios | `regression_scenario.md` (manual) + the automated suite |
| Staging URL / branch | `__STAGING_URL__` / `staging` |
| Staging database | fill in (its own project, test accounts only) |
| Production URL / branch | `__PROD_URL__` / `main` (protected: changes arrive by pull request only) |
| Smoke-test account (where the secret lives) | `docs/SMOKE_TEST.md`; environment secrets `SMOKE_PROD_PASSWORD`, `SMOKE_STAGING_PASSWORD` |
| Rollback method | the host's instant rollback to the previous production deployment (a migration is not rolled back; migrations must be backwards compatible) |
| Migrations | folder and how they are applied: staging first, then production; never edit an applied migration |

## Release report
The release message to the owner shows the **exact contents**, never a summary: commits, files by area, plain-words changelog lines, what a user can see, migrations (applied to staging / production), tests and smoke results, known gaps and the main commit. It is appended to `docs/RELEASES.md`.
