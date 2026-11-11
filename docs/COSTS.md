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

## How to price a session
- **Best source:** the session's last `result` event carries `total_cost_usd` (API list price, cumulative for the whole session). From a coding session, read it with `list_events` (`kinds: ["result"]`, a small `limit`; it is about 5k tokens per event, so ask for one). The figures below marked "measured" are that number.
- **Rates, Sonnet 5.5 (per million tokens):** input $2.00, output $10.00, cache read $0.10, cache write (1-hour cache, what these sessions use) $4.00. Checked: they reproduce B2's `total_cost_usd` to the cent. Haiku 5.5: $0.10 in, $0.50 out.
- **Computed** = cache-read x $0.10 + cache-write x $4.00 + output x $10.00 (uncached input is under $0.01). A count taken before the session ended understates the cost: B1 and B4 were $1.12 and $1.06 by their first counts and $1.61 and $2.00 measured at the end.
- **Fixed cost per turn:** the first request of every session already carries 117k to 193k cached tokens (system prompt plus 58 to 65 tool schemas). That is about $0.012 to $0.02 per model call before any work, and it is why Tier 1 tasks of 30 calls land near $1. Turning off unused connectors (COST_PLAN B5) is the lever.

## Per task under v2 (one row per task, added when the task ends)
| Date | Task | Tier | Session cost | Turns | Send-backs |
|---|---|---|---|---|---|
| 2026-11-11 | COST_PLAN A4: lean CLAUDE.md, old docs moved to `docs/archive/`, released (PRs 26, 27, 28, 29; includes the `release.js` build-stamp fix) | 1 | $1.12 measured (target $0.30) | not counted | not recorded |
| 2026-11-11 | COST_PLAN B1: tools/ci_wait.js, built and released (PRs 30, 32, 35) | 1 | $1.61 measured (target $0.30); 7.18M cache-read, 0.17M cache-write, 21k output tokens | 33 model calls at the first record | 0 |
| 2026-11-11 | COST_PLAN B2: tools/ship.js and its test, merged to `main` (PR 33); first live run still open | 1 | $1.22 measured (target $0.30); 6.59M cache-read, 0.09M cache-write, 20k output tokens | not counted | not recorded |
| 2026-11-11 | COST_PLAN B4: TIER_1/2/3 rewritten for v2, released (PRs 36, 37, 38, 44) | 1 | $2.00 measured (target $0.30); 10.07M cache-read, 0.17M cache-write, 31k output tokens | 30 model calls at the first record | 0 |
| 2026-11-11 | COST_PLAN B3: Copilot review guidance, built and released (PRs 42, 45, 46) | 2 | at least $1.83 computed (target $2) from the first record's counts (10.2M cache-read, 0.14M cache-write, 25k output); the session total could not be read, and a few more turns followed | 66 model calls | 1 (Copilot finding on the first draft, fixed; PR conflict with staging, merged) |
| 2026-11-11 | COST_PLAN C2: app.js split, PRs 1 to 8 (PRs 48 to 51, 54 to 57), released (PRs 52, 58). Ran as a chain of sessions, one or two PRs each | 2 | not priced yet: about 8 sessions, ids in `docs/tasks/2026-11-11-app-split.md` history; read each one's last `total_cost_usd` and add the sum here | not counted | not recorded |
| 2026-11-11 | D1 task 1: Lent from account, built, ported onto the split files, Copilot review fixed, released (PRs 59, 60, 61, 62); no fresh review session and no owner staging check | 3 | $2.74 measured (target $8); 13.96M cache-read, 0.23M cache-write, 43k output tokens | 34 turns in the main run, about 75 model calls | 1 (Copilot: 4 fixed, 1 answered) |

Priced so far: $10.52 for A4, B1, B2, B3, B4 and D1 task 1 (six tasks; C2 and the two tiny sessions, C1 and a 1-minute B1 restart, are not included). Tier 1 tasks run 4x to 7x over the $0.30 target; the one Tier 3 task is a third of its target.
