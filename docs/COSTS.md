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
| 2026-11-11 | D1 task 1: Lent from account, built and ported onto the split files, awaiting owner staging check, review session and release (Tier 3, not yet released) | 3 | not priced: no Sonnet 5.5 rate in the repo; token counts are not visible inside the session | about 25 model calls so far | 0 so far |
