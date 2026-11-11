# Workflow v2: same quality, about 90% less AI cost (CTO plan, 2026-11-11, owner decision pending)

Status: PROPOSAL. Nothing here is in force until the owner approves it. Written so a fresh, small session can execute it without the old conversations.

## 1. What the cost actually is (measured)
Tech-Lead session `session_01JJfLhpsAuFysuHmKe5YETw`, 2026-11-05 to 2026-11-11 (from the session's own usage record):

| | tokens | share |
|---|---|---|
| Re-reading the earlier conversation (cache reads) | 165,690,080 | 98.7% |
| Writing the conversation into the cache | 1,918,832 | 1.1% |
| New output (the actual work) | 235,601 | 0.14% |
| API-equivalent cost | $35.76 | one role, six days |

The context of that one session grew to 642,775 tokens. Every tool call and every message re-reads all of it. Cost = (size of the conversation) x (number of calls). The work itself is 0.14% of the bill.

Three multipliers on top:
- **Five role sessions** (PM, Tech-Lead, Full-stack, QA, Designer), each with its own large conversation, and every message between them wakes the receiver for a full re-read.
- **Cold starts.** The cache lives about an hour. The first message to a big idle session re-reads its whole conversation at full price (about 640k tokens here; at Fable 5.2's $8 per million input tokens that is over $5 for one message, before any work). Five big sessions woken after a limit reset is the most likely reason the limit is gone "within minutes".
- **Switching model inside a big session** rewrites the whole cache (caches are per model).

Smaller, real, but secondary: about 25k tokens of process documents read at every session start (context.md 8.2k, AGENTS.md 4.3k, DEV_WORKFLOW 3.3k, handoff 2.8k, WORKSPACE 2.5k, CLAUDE.md 1.9k, workflows 1.8k); eight connectors (about 490 tool names, re-announced on every reconnect); verbose tool output (CI run lists, pasted function source); "check CI" turns that only wait; `prototype/app.js` is one 393 KB file (about 100k tokens) with lines up to 815 characters, so every read and search is expensive.

## 2. The rules of v2
1. **One task = one fresh session = one branch = one PR.** No role sessions, no agent-to-agent messages, no Workspace relay. The owner talks to the one session that does the task.
2. **Context budget: stop at 120k tokens.** A task that does not fit is split. The hand-over is the PR description plus a task file of at most 15 lines (`docs/tasks/<date>-<name>.md`: request in the owner's words, done-when checks, tier, files).
3. **Never go back to an old session; never switch model mid-session.** Follow-up work starts a new session from the task file.
4. **Lean start: at most 5k tokens of instructions.** `CLAUDE.md` becomes about 50 lines (the non-negotiables and a pointer table). Everything else is read only when the task touches it. The multi-agent documents (`docs/AGENTS.md`, `docs/WORKSPACE.md`, `docs/roles/`, `docs/handoff/`) are archived.
5. **Lean tools.** A coding environment with only the GitHub and Supabase connectors. Figma only in a design session. Gmail, Drive, Notion, PostHog and Vercel are off (Vercel deploys from git).
6. **Scripts wait, not the model.** One command per wait, with one line of output: `tools/ci_wait.js <pr>`, `tools/ship.js` (merge, wait for the build, verify, record the release). No "check CI" messages; the owner approves production in GitHub.
7. **Review without a second big session.** Tier 1: CI only. Tier 2: CI plus an automated PR reviewer from another vendor (a different model, as rule 9 wanted, at no Claude cost). Tier 3: the same, plus one fresh diff-only review session on the strongest model (a 30k-token review is cheap; a 600k-token one is not) and the owner's staging check.
8. **QA is tests, not a session.** Every task ships its tests; the real-database staging scripts run in CI; the owner checks staging by hand for Tier 2 and 3.
9. **Model by job.** Sonnet 5.5 for building. Haiku 5.5 (about 20 times cheaper per token) for mechanical work: changelog, release record, renames. Opus 5.5 or Fable 5.2 only for Tier 3 design and review, in small fresh sessions.
10. **Cost is a release metric.** Each task records its session cost in `docs/COSTS.md` (from the session usage record). Targets (API-equivalent): Tier 1 under $0.30, Tier 2 under $2, Tier 3 under $8.

## 3. Code changes that make every future task cheaper and safer
- Split `prototype/app.js` into feature modules (about 15 files, each under 600 lines, lines under 160 characters) with a `docs/MAP.md` (feature -> file -> function). Mechanical, no user-visible change, guarded by the 59 e2e tests. A change then reads 3-5k tokens of code instead of 30k or more.
- Add ESLint and `tsc --checkJs` (JSDoc types, no build step) to CI: the machine finds the class of bug that today costs a review pass.
- Run the 8 SQL test files in CI (today they run only by hand).

## 4. Production readiness for 100k users (found while reading the code; roadmap, not part of the cost work)
- No error monitoring in the app (no Sentry, no global error handler): we would not know production is broken.
- Sign-up, join and invite limits are global and fail closed (300 sign-ups an hour, 300 joins an hour, 200 invites an hour for ALL users together): at scale this blocks real users. Needs per-address limits plus CAPTCHA as the primary control.
- The app downloads every row of every table on each open (`fetchAll`, `select *`) and compares the whole data set on each save: fine at 505 transactions, slow and costly with years of data across 100k users. Needs incremental sync.
- Household members poll every 30 seconds; needs realtime or back-off.
- No lint, no type check, one global-scope script; e2e runs against a fake database only.
- Finnhub free plan is personal use only (already in NEXT_STEPS).
- Never load-tested; backups and point-in-time recovery on the Supabase plan not verified.

## 5. Third parties to add (owner to approve; prices not checked)
- An automated PR reviewer: GitHub Copilot code review or CodeRabbit.
- Sentry (or similar) for production errors.
- k6 for a load test before a public launch; an uptime monitor.

## 6. Rollout (about five working days)
1. Stop all role sessions. New lean environment. `CLAUDE.md` v2, archive the multi-agent docs, `docs/COSTS.md` with the baseline above.
2. `tools/ci_wait.js`, `tools/ship.js`, terse CI helpers; PR reviewer and Sentry connected.
3-4. `app.js` split, `docs/MAP.md`, ESLint and type check and SQL tests in CI.
5. Pilot: finish "Lent from account" and four small changes under v2; compare cost per change with the baseline; adjust the budget numbers.

## 7. Open work carried over
- Lent from account: `feature/lent-from-account` 81bfa38, Tier 3, review found one bug (renaming the Lent category then lending again duplicates the category id and undoes the rename; same pattern in the Lent Repayment helper). Not merged; migration 32 not applied anywhere. Owner question open: Delete button or Archive only.
