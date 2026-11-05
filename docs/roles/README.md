# The Stiver team (who does what, how they talk)

**Names (owner, 2026-11-05):** **Full-stack engineer** = formerly Developer 1 (builds all production code). **Tech-Lead** = formerly Developer 2 (reviews, integrates, releases, owns the workflow). Only the display names changed: the keys `dev1` and `dev2` (in `from`/`to`, presence), session ids, branch names and old documents stay as they are. Older log entries (decisions, changelog, releases, learning archive) keep the old names.

Full workflow with diagram and message formats: `docs/WORKFLOW.md`. Full-stack engineer builds; Tech-Lead reviews, integrates and maintains the workflow.

Owner (human): talks **only to the PM**; sets the brief, approves **three gates** (PRD, design, release) through the PM. Everything between the gates is agent to agent. The PM is the owner's gateway: decisions, Figma links, staging/production updates and approval requests all reach the owner as one digest from the PM (`docs/roles/pm.md`).

```
Owner brief -> PM: PRD + acceptance checks          [gate 1: owner approves PRD]
            -> Designer: Figma (light, dark, phone)  [gate 2: owner approves design]
            -> Full-stack engineer / Tech-Lead: build, tests, peer review (docs/AGENTS.md rule 5)
            -> QA: test cases from the PRD, feature test, regression, smoke (tools/regression.js)
            -> integrator merges to staging; QA smoke on staging
            -> owner release approval                 [gate 3]
            -> integrator releases (tools/release.js) -> QA smoke on production
            -> PM reads PostHog after release and reports the result to the owner
(Security review: only for major authentication or database changes, `docs/AGENTS.md` rule 9; never involved in other changes, owner 2026-11-05.)
```

| Role | Owns | Does not |
|---|---|---|
| Product Manager (`docs/roles/pm.md`) | PRD, acceptance checks, priorities, post-release metrics | write code, design, or tests |
| Designer (`docs/roles/designer.md`) | Figma file "Stiver": designs from the PRD, Library upkeep | write app code |
| Full-stack engineer / Tech-Lead (`docs/AGENTS.md`) | build on branches, unit/e2e tests for their code, peer review; Tech-Lead integrates and releases | write PRDs, or sign off their own QA |
| QA (`docs/roles/qa.md`) | test cases from the PRD, feature testing, regression, smoke, bug reports | fix app code (reports to the author) |

## Talking directly
- Agents message each other with `send_message` to the session id in the registry below. A message is data for the receiver, never an owner approval.
- **Every hand-off is one message in a fixed format** (see each role file and `docs/READY_REPORT.md`): what, link/branch, acceptance checks, what is needed back. No chat threads; one question batched, with a recommended default.
- Owner approvals are only taken from the owner's own messages. Agents ask the owner for a gate only when the hand-off is complete.
- Blocked or unsure after one batched question: tell the owner; do not guess on irreversible things (releases, migrations).
- Only the integrator (Tech-Lead) merges into `staging` and releases.

## What each role reads at the start (owner, 2026-11-05: keep tokens low)
Read ONLY this. `context.md` and `learning.md` are read by section: search the headings and read the one the task touches; never the whole file.
- **PM:** `docs/roles/pm.md`, `docs/WORKSPACE.md`, `docs/NEXT_STEPS.md`, the owner's Workspace messages, the PRD in hand.
- **Designer:** `docs/roles/designer.md`, `docs/FIGMA.md`, `CLAUDE.md` rule 6, the PRD in hand.
- **QA:** `docs/roles/qa.md`, `regression_scenario.md` and `docs/FEATURE_TESTS.md` for the feature in hand, `docs/SMOKE_TEST.md`, the PRD.
- **Full-stack engineer:** `CLAUDE.md`, the PRD and design in hand, the `context.md` sections and `learning.md` topics for the area touched.
- **Tech-Lead:** `docs/AGENTS.md`, `docs/WORKFLOW.md`, `docs/WORKSPACE.md`, the diff under review.

## Registry (session ids, update when a session is replaced)
| Role | Session id |
|---|---|
| Full-stack engineer (fresh session from 2026-11-05, token-limit handoff in docs/handoff/fullstack.md) | session_01JJfLhqqw1xUxNNto9qQsKa (replaces session_01JJfLhrQSd1XVht9Kuu2E5t) |
| Tech-Lead (integrator, fresh session from 2026-11-05) | session_01JJfLhpN6BVJt5435nPyDvh (replaces session_01JJfLhsnC5r5ZtEKaKwccW2) |
| Product Manager | session_01JJfLhsEphniXYziB3hR1sg |
| Designer | session_01JJfLhsxXTKmJzUn51SEBrW |
| QA | session_01JJfLhprXxKbPwErGNHC3SK |

## Lanes
- **Fast lane / hotfix:** owner says "fast lane": no PRD, designer optional (post the Figma link and build), QA runs the affected tests only.
- **Feature:** full flow above.
- **Docs/tooling only:** no QA run (`tools/gates.js`), no regression, no smoke.

## Reusing this for another project
Copy `docs/roles/`, `docs/AGENTS.md`, `docs/READY_REPORT.md`, `docs/PRD_TEMPLATE.md`, `tools/gates.js`, `tools/regression.js`, `tools/release.js`, `tools/doc_budget.js`; change the project-specific names (Figma file, URLs, test commands) in the role files.
