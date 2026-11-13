# Playbook: how the work runs, and why

## The idea in six lines
1. **Machines check what machines can.** Tests, path rules and preview deploys cost no tokens. A session is for judgment.
2. **Risk decides the process.** The files a change touches set its minimum tier. A session may raise a tier, never lower it; only the rule or you can.
3. **One task = one fresh session = one branch = one PR.** Hand-over is the PR description and a 15-line task file, never a long conversation.
4. **Your time is the scarcest resource.** Questions come once, batched, each with a recommended default. Gates exist only where they change outcomes.
5. **Honesty over polish.** Every report says what was checked and what was not. Nothing is "passed" that was not run.
6. **Every mistake becomes a rule,** in the lesson file for its area, and the rules travel to the next project through this kit.

## What you say, and what happens
| You say | The session does |
|---|---|
| a request in your own words (the optional form: `docs/REQUEST_TEMPLATE.md`) | restates it as 2 to 5 done-when checks, names the tier, asks every open question once |
| answers / "go with your defaults" | builds on a branch with tests, opens the PR, waits with one command |
| "fast lane" | posts the design link and builds at once; your one reply covers design and staging |
| "skip figma" | builds without a design, brings the design file up to date after release |
| "approved" (after looking at staging) | marks the change ready for the next release |
| "Release" | merges `staging` into `main` behind a PR, verifies production, writes the release record and the cost row |
| "hotfix" | fixes on a branch off `main`, names the rollback, releases on your word, backports to `staging` |
| "also test X" | adds an entry to `docs/FEATURE_TESTS.md` and a test |
| "add that to the starter kit" | sends the lesson back here |

## The three tiers
| | Tier 1: presentation | Tier 2: standard | Tier 3: data, access, money |
|---|---|---|---|
| Examples | copy, CSS, images, translations, docs, tooling | features on existing data, flows, app logic | migrations, access rules, sign-in, sync, calculations, security config, anything role-dependent |
| Your gates | none per change; screenshots once per batch | requirements answer; staging check | requirements, design, staging check, release |
| Review | CI | CI + reviewer bot (another vendor) | that + one fresh diff-only session on the strongest model |
| Tests | tool tests | full suite in CI | full suite, SQL tests, real accounts per role on staging |
| Release | batched; no regression, no smoke test | batched; regression + smoke test | alone, so it can be traced and rolled back |
| Cost target | under $0.30 | under $2 | under $8 |

Escalate on discovery: a migration, a permission effect or a change to stored values makes it Tier 3; a new screen makes it Tier 2 with design; a Tier 1 diff past about 50 lines or into app logic is Tier 2. Stop, re-label, restart at the new tier's first step.

## The path to production
`design (Figma, when a screen changes) -> branch off staging -> PR (CI labels the tier, runs tests, bot reviews) -> staging (you look) -> "Release" -> PR staging to main -> production -> smoke test -> release record`

Release hygiene: merge everything into `staging`, fold the change files into the changelog in the same push, run regression on that exact commit, open the release PR, then **commit nothing more** until it is merged (every push restarts the checks). Migrations reach production before the code that needs them, and are backwards compatible with the code still running.

## Why sessions are short (the measurement that changed everything)
One six-day session grew to 642,775 tokens. Every message re-read all of it: 98.7% of its tokens were re-reads, 0.14% was new work. Nine role sessions (PM, Tech Lead, Full-stack, QA, Designer) cost $468.29 and shipped four releases: about $48 a release. The cost of a session is (size of the conversation) x (number of calls), so:
- fresh session per task, stop near 120k tokens, split what does not fit;
- never wake an old session (a cold cache re-reads everything at full price) or switch model inside one (caches are per model);
- instructions under 5k tokens at start; everything else is loaded when the task touches it;
- few connectors; scripts wait instead of "check CI" turns; terse tool output;
- small source files with a map, so a change reads 3 to 5k tokens of code instead of 30k;
- model by job: mid-size builds, small does mechanical work, the strongest only reviews and designs Tier 3, in small sessions.
Model names change; the rule is the size class, not the name.

## Tried and dropped (do not rebuild)
- **A team of role sessions messaging each other.** Most expensive thing tried; added relays, not quality. Replaced by tests, a reviewer bot and one small fresh review.
- **A shared "workspace" page for decisions.** Another relay to keep in step. You talk to the one session doing the task; decisions are logged in `docs/DECISIONS.md`.
- **One long-lived session per project.** See the numbers above.
- **One giant source file.** About 100k tokens per read; every change was Tier 2. Split into files under 600 lines with `docs/MAP.md`.
- **Hand-bumped version strings and one shared changelog.** Constant merge conflicts. Replaced by a build stamp and one change file per change.
- **Agents applying risky SQL through a tool that needs a hidden approval.** It timed out. CI applies migrations; destructive SQL is one file you run yourself.
- **A forgiving fake database in tests.** It passed a real bug. The fake is as strict as the real schema.
- **Security review on every change.** Only for authentication, access rules and the database.

## Where each thing lives in a project
`CLAUDE.md` rules (one page) · `context.md` current truth · `learning.md` + `docs/learning/` lessons by area · `docs/workflows/` tiers · `docs/tasks/` hand-overs · `docs/changes/` -> `docs/CHANGELOG.md` · `docs/RELEASES.md` exact release contents · `docs/COSTS.md` cost per task · `docs/FEATURE_TESTS.md`, `regression_scenario.md` what must work · `docs/NEXT_STEPS.md` open work · `tools/` the scripts that replace waiting and judgment.
