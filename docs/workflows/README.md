# Risk-tiered workflow (owner-approved 2026-11-05)

Every change takes the cheapest workflow that is still safe for its risk. This file is the overview; load only the tier file your task needs (`TIER_1.md`, `TIER_2.md`, `TIER_3.md`). It sits on top of `docs/AGENTS.md` and `docs/DEV_WORKFLOW.md`; where they disagree for a Tier 1 or Tier 2 change, this file wins; Tier 3 is today's full process unchanged.

## Principles
1. **Machines check what machines can.** Tests, path rules and preview deploys cost no tokens. Agents are for judgment.
2. **Rules decide the floor, not agents.** The minimum tier comes from the files a change touches. An agent may raise a tier, never lower it. Only the path rule or the owner lowers one. If the rule and an agent disagree, the higher tier wins.
3. **Escalate on discovery.** An agent that finds unexpected scope stops, re-labels the task and restarts at the new tier's first step.
4. **The owner's time is the scarcest resource.** Gates are kept where they change outcomes and batched everywhere else.

## Intake and routing
The owner may talk to the PM or the Tech-Lead (default front door: the Tech-Lead; go to the PM for new features or anything about data, money or sharing). Whoever receives the request writes an **intake note** (at most 5 lines, cheaper model): what the owner asked in their words; provisional tier and why (files, data/money/access); anything technical already known (migration, `cloud.js`).

| Owner talks to | Provisional tier | What happens |
|---|---|---|
| Tech-Lead | 1 | Tech-Lead does it (TIER_1.md). No PM. |
| Tech-Lead | 2 or 3 | Tech-Lead does not build; hands the intake note to the PM for requirements. |
| PM | 1 | PM writes no PRD; passes the note to the Tech-Lead. |
| PM | 2 or 3 | PM writes requirements (may ask the Tech-Lead for a quick risk check). |

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
Production is broken or data is at risk: the owner says "hotfix" (or the Tech-Lead proposes it and the PM relays). The Tech-Lead fixes on a branch off `main`, runs the affected tests plus the production smoke test, names the rollback in the PR (previous merge sha on `main`; migrations get a down script before they run), merges after the owner's word, then backports to `staging`. Review follows within the same day (AGENTS.md rule 9 exemption for owner hotfixes stays).

## Models, context and messages
- Cheaper/faster model for Tier 1 and for Tier 2 implementation and QA; strongest model for Tier 3 implementation; a **different** model for the Tier 3 review (AGENTS.md rule 9).
- **Short task-scoped agents from a handoff file**, not long-lived role sessions: cached re-reads were over 99% of usage and the PM session reached 585k tokens. Start a new session at about 400k.
- Each tier file lists the docs to load. Load nothing else (a Tier 1 pass does not read the household RLS history). Keep `learning.md` split by area (data/RLS, sync, UI, release, iOS) and load only the area the task needs.
- Messages carry a file path or commit, not a summary; one message per event; nothing is re-sent (AGENTS.md rule 16).
- Documentation per change: Tier 1 adds only its change file; Tier 2 and 3 also update `context.md`, `regression_scenario.md`, `docs/ANALYTICS.md` where the rules in CLAUDE.md apply. `learning.md` is appended when a mistake happens.

## Metrics (from the first week)
| Metric | Warning sign |
|---|---|
| AI cost per task, by tier (baseline first: the last 5 tasks) | Tier 1 not clearly cheaper than Tier 2 |
| Send-back rate (owner **or** QA rejects) | Tier 1 above about 1 in 5 |
| Production defects, by tier | any Tier 1 change causing a production bug: tighten Tier 1 first |

## Status: what is in force today and what is still to build
In force now (no tooling needed): intake note and routing, tiers and the path table (the Tech-Lead applies the path rule by hand until CI does), gates, hotfix lane, batching, model and context rules.
To build (tracked in `docs/NEXT_STEPS.md`): (1) a strict test fake that rejects columns not in the migrations; (2) GitHub Actions: e2e on every PR (blocking), the path-rule check that labels each PR with its minimum tier, Vercel preview on every PR; (3) CI job using the Supabase CLI to apply migrations and deploy Edge Functions (staging on merge, production on the owner's "Release"), so no agent pastes SQL or function source; (4) scheduled CI job for the real-account household scripts in `tests/staging/household/`; (5) split `learning.md` by area; (6) baseline cost measurement; (7) run Tier 1 on the next 10 small changes, then review the three metrics and record cost before and after for the case study.
