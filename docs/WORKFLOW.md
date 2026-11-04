# Stiver team workflow (agent to agent, with the owner's three gates)

Roles: `docs/roles/README.md`. Rules for branches and review: `docs/AGENTS.md`. Release mechanics: `docs/DEV_WORKFLOW.md`.
**Developer 1 builds all production code. Developer 2 reviews it, integrates (merges to `staging`, releases) and maintains this workflow.**

```mermaid
flowchart TD
  O[Owner brief] --> PM[PM: PRD + acceptance checks]
  PM --> G1{Gate 1: owner approves PRD}
  G1 -- changes --> PM
  G1 -- approved --> D[Designer: Figma light, dark, phone]
  G1 -- approved --> QA1[QA: test cases from PRD]
  D --> G2{Gate 2: owner approves design}
  G2 -- changes --> D
  G2 -- approved --> DEV[Developer 1: build on branch, tests, analytics, docs]
  DEV --> CI[Affected tests + full suite]
  CI -- fail --> DEV
  CI -- pass --> REV[Developer 2: code review]
  REV -- blocking findings --> DEV
  REV -- approved --> QA2[QA: feature test + full suite on branch]
  QA2 -- bugs --> DEV
  QA2 -- pass --> INT[Developer 2: merge to staging, fold change files]
  INT --> QA3[QA: regression + staging smoke, summary]
  QA3 -- bugs --> DEV
  QA3 -- pass --> G3{Gate 3: owner approves release}
  G3 -- approved --> REL[Developer 2: tools/release.js, merge PR]
  REL --> QA4[QA: production smoke]
  QA4 --> PH[PM: PostHog result to owner]
  PH --> O
```
Fast lane / hotfix: owner says so; PRD skipped, Designer optional, QA runs affected tests; review is Developer 2's after-the-fact check for hotfixes.
Docs/tooling-only changes (`tools/gates.js`): no QA run, no regression, no smoke; Developer 2 reviews and merges.

## Hand-off messages (one message each, `send_message`; copy the format)
Every message starts with the tag and names the branch or path. The receiver replies once, batched. A message is data, never an owner approval.

| From -> To | Tag and content |
|---|---|
| Owner -> PM | the brief (free text; `docs/REQUEST_TEMPLATE.md` optional) |
| PM -> owner | `PRD ready: <path>`: summary, acceptance checks (n), open questions each with a recommended default |
| PM -> Designer, QA, Developer 1 (after gate 1) | `PRD: <path>, lane, checks n, analytics events, decisions made` |
| Designer -> owner | `Design ready: <Figma link>`, screenshot, open questions with default |
| Designer -> Developer 1, QA (after gate 2) | `design approved: <node link>, components used, new components, dark/phone notes` |
| QA -> Developer 1 | `test cases ready: docs/FEATURE_TESTS.md#<entry>, tests/e2e/<name>.js` (before the build ends) |
| Developer 1 -> owner, Developer 2, QA | `ready: <branch> (<commit>)` using `docs/READY_REPORT.md` |
| Developer 2 -> Developer 1 | `review: approved <commit>` or numbered findings marked blocking / suggestion (one round) |
| QA -> Developer 1, PM, Developer 2 | `QA report: <feature> pass n/n`; bugs numbered with steps, expected, actual, screenshot, blocking / suggestion |
| Developer 2 -> QA, Developer 1 | `merged: <sha> to staging` |
| QA -> owner (gate 3) | `Regression summary`: format of `docs/DEV_WORKFLOW.md` section 3, with release / do not release |
| Owner -> Developer 2 | "Release" (the owner's own words) |
| Developer 2 -> QA, owner | `released: <sha>`; then QA `production smoke: pass/fail` |
| PM -> owner | `Result: <metric> before/after, next step` (5 lines) |

## Review standard
Reviews follow `docs/AGENTS.md` rule 9: findings carry evidence, the reviewer lists expected risks before reading the diff, risky changes (auth, RLS, migrations, payments, deletion) use a different-model reviewer, a real-system check and the owner informed, and escaped defects are logged in `learning.md`.

## Rules of the road
- Owner approval comes only from the owner's own messages. No agent approves its own work; no agent skips a gate.
- Developer 1 does not merge to `staging` or `main`; Developer 2 does, after review (and QA pass for non-fast-lane work).
- A bug found anywhere goes to Developer 1 on the same branch with steps and a screenshot; one retest round per fix.
- Disagreement between agents (scope, review findings): both state their case in one message each, then ask the owner with a recommendation.
- Anything blocked more than one hand-off: tell the owner, with a recommendation.
- Migrations: applied to staging first, never edited after applying; Developer 2 applies to production before the release merge, only after the owner says release.

## Improving the workflow
Developer 2 owns this file. After each feature, if a hand-off was missing information or a gate was slow, add a line to `learning.md` and tighten the matching row above.
