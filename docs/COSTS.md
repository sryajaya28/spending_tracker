# Costs (API-equivalent dollars; targets in `docs/workflows/V2_PLAN.md` rule 10)

## Baseline before v2 (measured 2026-11-11 from the sessions' usage records)
| Session | Cost | Tokens re-read |
|---|---|---|
| Full-stack engineer, 31 Oct to 5 Nov (one session, five days) | $274.55 | 1,717.7M |
| Tech Lead, 4 to 5 Nov | $55.34 | 347.9M |
| Tech-Lead, 5 to 11 Nov | $35.76 | 165.7M |
| Product Manager, 4 to 5 Nov | $22.10 | 140.5M |
| Full-stack engineer, 5 to 11 Nov | $21.69 | 63.9M |
| QA | $18.79 | 79.9M |
| Designer | $17.38 | 52.4M |
| Product Manager, 5 to 11 Nov | $12.70 | 30.8M |
| Tech-Lead, 5 Nov (six hours) | $9.98 | 59.0M |
| **Total (9 sessions)** | **$468.29** | **2,657.8M** |

The eight role sessions since 4 Nov shipped Releases 15 to 18 for $193.74: about $48 per release. Targets: Tier 1 under $0.30, Tier 2 under $2, Tier 3 under $8 per task; under $5 per release on average.

## Per task under v2 (one row per task, added when the task ends)
| Date | Task | Tier | Session cost | Turns | Send-backs |
|---|---|---|---|---|---|
| 2026-11-11 | COST_PLAN B1: tools/ci_wait.js, built and released (PRs 30, 32) | 1 | not priced: no Sonnet 5.5 rate in the repo; 4.03M cache-read, 0.14M cache-write, 16k output tokens | 33 model calls | 0 |
| 2026-11-11 | COST_PLAN B4: TIER_1/2/3 rewritten for v2, released (PRs 36, 37, 38) | 1 | not priced: no Sonnet 5.5 rate in the repo; 3.60M cache-read, 0.14M cache-write, 14k output tokens | 30 model calls | 0 |
| 2026-11-11 | COST_PLAN B3: Copilot review guidance, built and released (PRs 42, 45, 46) | 2 | not priced: no Sonnet 5.5 rate in the repo; 10.2M cache-read, 0.14M cache-write, 25k output tokens (measured when the record was written; a few more turns followed) | 66 model calls | 1 (Copilot finding on the first draft, fixed; PR conflict with staging, merged) |
| 2026-11-11 | D1 task 1: Lent from account, built, ported onto the split files, Copilot review fixed, released (PRs 59, 60, 61); no fresh review session and no owner staging check | 3 | not priced: no Sonnet 5.5 rate in the repo; token counts are not visible inside the session | about 75 model calls | 1 (Copilot: 4 fixed, 1 answered) |
| 2026-11-13 | Overview hero "Spent today": built from the approved design, tests and docs, released (PRs 68, 69, 70); Copilot review did not run (quota) | 2 | not priced: no Sonnet 5.5 rate in the repo; token counts are not visible inside the session | about 55 model calls | 0 so far |
| 2026-11-13 | Search box in the Occasion and Account lists (filters, Add transaction, Transfer), plus the "not found" note fix; built, tests and docs, released as release 21 (PRs 75, 76, 78); Copilot review did not run (quota) | 2 | $2.33 at the end of the release (session usage record: 12.4M cache-read, 0.16M cache-write, 44k output tokens; over the Tier 2 target of $2); context reached about 228k tokens, over the 120k budget | not counted | 0 |
| 2026-11-13 | Search box in the Occasion and Account lists (filters, Add transaction, Transfer), plus the "not found" note fix; built, tests and docs, not yet merged | 2 | not priced: no Sonnet 5.5 rate in the repo; token counts are not visible inside the session | about 45 turns | 0 |
| 2026-11-13 | Reusable release prompt `docs/tasks/RELEASE.md` (docs only, with a workflow discussion in the same session) | 1 | not priced: token counts are not visible inside the session | about 12 model calls | 0 |
| 2026-11-13 | Review fallback (Copilot out of quota) and "release is its own session" written into the tier files, V2_PLAN and DEV_WORKFLOW (docs only) | 1 | not priced: token counts are not visible inside the session | about 10 model calls | 0 |
| 2026-11-13 | Fix: moving an asset to an investment account that already holds it errors (duplicate account + asset); diagnosed, fixed, test, docs, released as release 22 (PRs 77, 80, 82, 85); Copilot review did not run (quota) | 2 | $3.53 at the end of the release (session usage record via `get_session`: 22.0M cache-read, 0.21M cache-write, 50k output tokens; over the Tier 2 target of $2; much of it is the release: the PR was blocked by CI restarts three times while other sessions merged into staging); context reached about 269k tokens, over the 120k budget | turns not counted | 0 |
| 2026-11-13 | Release 23 (Settings hub, PRs 84, 85, 86; release PR 88): dry run, regression, diff-only review of PR 86, merge on the owner's word, ship, smoke 15/15 | release | $0.58 at the end of the release (session usage record via `get_session`: 2.03M cache-read, 72k cache-write, 9k output tokens) | about 35 model calls | 0 |
| 2026-11-13 | Overview is today, Report is the rest: design mock fixes (budget bar kept, no-budget state, no Balance chip) then the build (today list, missing-days card, Report with Transactions and Analysis), tests and docs | 2 | $1.20 at the end of the build (session usage record via `get_session`: 4.37M cache-read, 139k cache-write, 20k output tokens) | about 75 model calls | 1 |
| 2026-11-13 | Starter kit for new repositories (`starter-kit/`: installer, template, stack pack, guides) | 2 by the path rule (new top-level folder; no app code) | not recorded: no usage record visible in the session; ran on Fable 5.2, past the 120k budget | about 25 model calls | 0 |
| 2026-11-13 | Desktop layout pass: built on the WIP branch (Overview side column, desktop CSS), new `desklayout` test, `report` test fix, docs; local dark, phone, Indonesian and 1920px proof | 2 (CSS alone is Tier 1; `views.js` and `activity.js` changed) | not recorded: `get_session` showed no usage record this time (only `context_usage`, 0 tokens) | about 40 model calls | 0 |
