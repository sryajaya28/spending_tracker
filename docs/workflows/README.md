# Risk-tiered workflow (owner-approved 2026-11-05)

Every change takes the cheapest workflow that is still safe for its risk. This file is the overview; load only the tier file your task needs (`TIER_1.md`, `TIER_2.md`, `TIER_3.md`). It is part of workflow v2 (`CLAUDE.md`, `docs/workflows/V2_PLAN.md`): one fresh session per task, talking to the owner directly.

## Principles
1. **Machines check what machines can.** Tests, path rules and preview deploys cost no tokens. Agents are for judgment.
2. **Rules decide the floor, not agents.** The minimum tier comes from the files a change touches. An agent may raise a tier, never lower it. Only the path rule or the owner lowers one. If the rule and an agent disagree, the higher tier wins.
3. **Escalate on discovery.** An agent that finds unexpected scope stops, re-labels the task and restarts at the new tier's first step.
4. **The owner's time is the scarcest resource.** Gates are kept where they change outcomes and batched everywhere else.

## Intake
The owner talks to the one session that does the task. It restates the request as 2 to 5 done-when checks, picks the tier (`node tools/path_tier.js` gives the floor; it may raise a tier, never lower it), and asks every open question once, with a recommended default, in one message. No intake note, no PM or Tech-Lead hand-off.

## Which tier (minimum; several rows = the highest)
| Changed files | Min tier | Why |
|---|---|---|
| `supabase/migrations/`, `supabase/templates/`, `supabase/functions/`, any SQL | 3 | data integrity, RLS, auth emails |
| `prototype/cloud.js`, auth or sign-in code, `api/` | 3 | sign-in, sync, money between client and server |
| net worth, balance, currency conversion, recurring or import logic | 3 | financial correctness |
| `vercel.json`, security headers, `prototype/config.js` | 3 | security posture |
| anything that changes what a given role (owner, Editor, Viewer, former member) can see or do, including UI | 3 | Release 15: a Viewer saw write buttons; the bug lived in `app.js` |
| **every other change to `prototype/app.js`** | 2 | huge shared file: markup and logic cannot be told apart reliably, so all of it is Tier 2 until the file is split |
| CSS, `i18n*.js`, images, docs | 1 | presentation only |

**Escalation triggers** (stop, re-label, restart): a migration or schema change is needed, or permissions/sharing/who-sees-what is touched → 3; existing financial records could change value → 3 and stop any release in progress; a new screen or interaction pattern → 2 with design; a Tier 1 diff grows past about 50 changed lines or touches `app.js` → 2.

## Owner gates
| Gate | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Requirements | no | yes | yes (full PRD) |
| Design | screenshots in the PR | only if design was involved | yes (Figma first) |
| Release | once per batch | once per batch | every release, alone |

Tier 1 screenshots are reviewed **as a batch**, once, not per change; a green change merges to `staging` without waiting. Tier 1 and 2 share one staging run, one regression run and one release approval per batch. Tier 3 always ships alone so a problem can be traced and rolled back.

## Hotfix lane
Production is broken or data is at risk: the owner says "hotfix" (or the session proposes it). The session fixes on a branch off `main`, runs the affected tests plus the production smoke test, names the rollback in the PR (previous merge sha on `main`; migrations get a down script before they run), merges after the owner's word, then backports to `staging`. Review follows within the same day.

## Models, context and docs
- Sonnet 5.5 builds; Haiku 5.5 for mechanical work; Opus 5.5 or Fable 5.2 only for Tier 3 design and the one fresh diff-only review session (`V2_PLAN.md` rule 9). Never switch model mid-session.
- One task, one fresh session, a 120k-token budget; the hand-over is the PR description plus `docs/tasks/<date>-<name>.md`.
- Each tier file lists the docs to load. Load nothing else. Load only the `learning.md` rows for the area touched.
- Documentation per change: Tier 1 adds its change file; Tier 2 and 3 also update `context.md`, `regression_scenario.md`, `docs/ANALYTICS.md` where the rules in `CLAUDE.md` apply. `learning.md` is appended when a mistake happens.

## Release hygiene (fewer round trips)
Every push to a PR restarts its checks (about 2 minutes for the browser suite), so a release is prepared in this order and then left alone:
1. Merge everything for the release into `staging`; run `node tools/fold_changes.js` and commit the folded changelog **in the same push**.
2. Run regression (`node tools/regression.js`) on that exact staging commit.
3. Open the PR to `main` (ready, not draft) and wait for its checks. **No further commits** to `staging` until it is merged. A late fix is a new change for the next release unless it is a hotfix.
4. Tier 1 PRs skip the browser suite in CI (`.github/workflows/ci.yml`: the `e2e` job runs only when the path rule says Tier 2 or 3), so docs, CSS, translations and tooling merge in about a minute.

## Metrics (from the first week)
| Metric | Warning sign |
|---|---|
| AI cost per task, by tier (baseline first: the last 5 tasks) | Tier 1 not clearly cheaper than Tier 2 |
| Send-back rate (owner or CI/reviewer rejects) | Tier 1 above about 1 in 5 |
| Production defects, by tier | any Tier 1 change causing a production bug: tighten Tier 1 first |

## Status
In force now: the path rule and tier label (CI), tiers and the path table, gates, hotfix lane, batching, and the v2 session, model and context rules. `tools/ci_wait.js` and `tools/ship.js` replace the waiting turns. The Copilot PR reviewer is installed (a ruleset requests it automatically on PRs into `staging` and `main`; advisory only). Open build items are tracked in `docs/NEXT_STEPS.md` and `docs/workflows/COST_PLAN.md`.
