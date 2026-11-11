# Cost plan: 90% lower AI cost, same quality (tracker)

Owner's priority 1 (2026-11-11). Close the items in order; tick the box and add the date when one is done. Background and reasoning: `docs/workflows/V2_PLAN.md`. Production readiness is priority 2 and is not in this list.

## Baseline (measured from the sessions' own usage records, 2026-11-11, API-equivalent dollars)
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

New output in all nine sessions together: 5.0M tokens, 0.19% of the total. The eight role sessions since 4 Nov cost $193.74 and shipped Releases 15 to 18: **about $48 per release**. Target: **under $5 per release on average** (Tier 1 under $0.30, Tier 2 under $2, Tier 3 under $8 per task), with no more send-backs or production defects than before.

## Step A: stop the leak (expected: 70 to 80% of the saving)
- [x] **A1 (done 2026-11-11, owner: "Let's do it"). Owner decides:** retire the role sessions (PM, Tech-Lead, Full-stack, QA, Designer) and work as one fresh session per task. Reply "A1 yes".
- [x] **A2 (done 2026-11-11: eight role sessions archived; this Tech-Lead session is the last one and is closed after A3). Tech-Lead session (this one), after A1:** archive the nine old role sessions so they cannot be woken by accident. The Lent work is safe on `origin/feature/lent-from-account`.
- [ ] **A3. Owner:** open ONE new session on Sonnet 5.5, repo `spending_tracker`, branch `staging`, and send exactly: `Read docs/workflows/COST_PLAN.md and do item A4.` From then on never write in an old session again.
- [ ] **A4. New session:** rewrite `CLAUDE.md` to about 50 lines (v2 rules 1 to 10 in `V2_PLAN.md` section 2, the non-negotiables: no secrets, tests before push, owner's word before production, tier table pointer). Move `docs/AGENTS.md`, `docs/WORKSPACE.md`, `docs/roles/`, `docs/handoff/`, `docs/WORKFLOW.md` to `docs/archive/`. Add `docs/tasks/TEMPLATE.md` (15 lines) and `docs/COSTS.md` (the baseline above plus one row per task). Done when a fresh session needs under 5k tokens of instructions to start. Docs only.
- [ ] **A5. Owner approves A4** by reading the new `CLAUDE.md` (one page) and saying "A5 ok". It is then released like any docs change.

## Step B: remove turns that only wait or repeat (expected: a further 5 to 10%)
- [ ] **B1. New session (one task):** `tools/ci_wait.js <pr>`: waits for the PR's checks and prints one line (green, or the failing test names). Replaces every "check CI" turn.
- [ ] **B2. New session (same task):** `tools/ship.js`: after the owner's "Release", one command waits for the production build, checks the site and build stamp, runs the smoke test when the tier needs it, and writes the release record. A release becomes about 4 model turns.
- [ ] **B3 (decided 2026-11-11: GitHub Copilot code review; needs a paid Copilot plan, Pro is about $10 a month per third-party sources, check github.com/features/copilot/plans; install still open). Owner decides and installs:** an automated PR reviewer from another vendor, GitHub Copilot code review or CodeRabbit (replaces the second-agent review for Tier 2; Tier 3 keeps one small fresh review session). Reply "B3 Copilot" or "B3 CodeRabbit"; installing the GitHub app is the owner's click (link given at that step).
- [ ] **B4. New session:** update `docs/workflows/TIER_1.md`, `TIER_2.md`, `TIER_3.md` to v2 (no PM, QA or Designer sessions; tests in CI; reviewer bot; owner checks staging).
- [ ] **B5. Owner, optional:** at https://claude.ai/customize/connectors turn off connectors a coding session never needs (Gmail, Google Drive, Notion). Small saving; skip if you use them elsewhere.

## Step C: make the code cheap to read (expected: a further 3 to 5%, and fewer mistakes)
- [x] **C1 (done 2026-11-11, owner: "Sure"). Owner decides:** split `prototype/app.js` (393 KB, one file) into feature modules. No user-visible change; guarded by the 59 e2e tests; done as three or four PRs, each released separately. Reply "C1 yes" or "C1 later".
- [ ] **C2. New sessions (one per PR), after C1:** the split, plus `docs/MAP.md` (feature, file, function). Done when no source file is over 600 lines and a typical change reads under 5k tokens of code.

## Step D: prove it
- [ ] **D1. Pilot (five tasks under v2):** finish "Lent from account" (Tier 3, the open review bug first), then four small changes the owner picks. Each task writes its session cost into `docs/COSTS.md`.
- [ ] **D2. Compare:** cost per release against $48; send-backs and production defects against the last four releases. If the saving is under 90%, the biggest cost line in `docs/COSTS.md` gets the next fix.
- [ ] **D3. Owner:** accept v2 as the standing workflow, or name what to change.

## Who does what, in short
- **Owner decides:** A1, B3, C1, D3. **Owner does:** A3 (open one session), A5 (read one page), B3 install, B5 (optional), the production approval click on each release, the staging check on Tier 2 and 3.
- **The session does:** A2, A4, B1, B2, B4, C2, D1, D2.
