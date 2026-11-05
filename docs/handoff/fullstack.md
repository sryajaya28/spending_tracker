# Handoff: Full-stack engineer, household feature (rewritten 2026-11-05 ~11:25 UTC)
Branch `feature/household`, head = the commit that adds this note (code state 543b241). Rules: CLAUDE.md, docs/AGENTS.md (rule 16: report to the Tech-Lead only, one message per event, no status copies to the PM; hand off at 400k tokens). Tech-Lead = session_01JJfLhpN6BVJt5435nPyDvh (reviews, applies migrations/deploys on staging, merges, releases). PM is now session_01JJfLhrfmrRhBbeoGxi2Jp6 (only for owner-bound items). Message other sessions with the claude-code-remote `send_message` (SendMessage cannot reach them). Never merge to staging/main, never touch production, never ask the owner directly.

## State
- Slice 1 (invite, join, roles, labels, guards, signup-gate sign-up, analytics) reviewed and merged to staging by the Tech-Lead (05cb9c6).
- Slice 2 Activity (migration 31, `#/activity`) reviewed and merged (7ef3a7c). Migration 31 in the repo is the single FINAL file (includes the was_* body); staging got the same end state as 31 + a follow-up function replace. There is NO migration 32.
- Fast-lane Household card rework (Manage button, badge after name, Pending row icons, remove confirm naming the person, Activity row below Invite) built at 543b241 and reported ready to the Tech-Lead; waiting for his merge to staging so QA can run the regression.
- Verified: full e2e 58/58, local SQL all pass (`bash tools/sql_local_test.sh`, household_activity 13), staging smoke 15/15 (slice 1 client), real two-person edit on staging (stale 409 PT409, "gone" empty result, Activity rows, member read-only on Activity, client insert 403).
- Staging cleanup done by the Tech-Lead (test login +hh4 and 3 test activity rows deleted). Two mailinator accounts on staging belong to other sessions: leave them. Test-email budget: 4 of ~6 used; keep the last 2 for the owner's sign-off.

## Not checked / open
- The new card and Activity on the real staging site after the Tech-Lead's merge (run `node tools/staging_shot.js` per its header, phone 390 + dark, when asked); real phone.
- invite-sweep purge with the real service key (owner at production setup); the Tech-Lead redeploys it when he sets the daily schedule.
- `tests/e2e/idcrawl.js` fails (quick-cat selector) with and without the household changes and is not in the default suite: pre-existing.
- Known behaviour (design list): deleting rows in strict mode is not atomic (a failed step leaves a partial save, then reload); weak 8-char GoTrue passwords; refresh token after removal.
- RELEASE NOTE for the Tech-Lead: the client signs up through `signup-gate` for everyone, so production needs migrations 24-31 and the 6 Edge Functions (+ invite-sweep schedule) BEFORE the client ships.

## Useful
- Node scripts against staging: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`; smoke: `SMOKE_EMAIL=smoke.staging@stiver.io SMOKE_PASSWORD="$SMOKE_STAGING_PASSWORD" node tests/smoke/smoke.js https://staging.stiver.io --env staging`. Gmail connector reads the +alias inbox (invite mails group into one thread; use get_thread PLAIN_TEXT).
- Session starts on a detached HEAD: `git branch -f feature/household HEAD && git switch feature/household` before committing. Never commit `__pycache__` (now ignored).
- Screenshots: local dev server (`python3 tools/dev_server.py 5180`) + fake Supabase (see the scripts pattern in tests/e2e/household_*.js); Figma frames: file DnfE4wtwMDGQyOW76MkVRW, Activity 51:176/51:477/51:638, card 48:5/48:272/51:563, manage+remove 73:745.
