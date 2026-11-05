# Release contents (exact, newest first)

Every release lists exactly what is in it (owner, 2026-11-05). Generated with `node tools/release_contents.js --merge <main sha>`; the integrator adds the notes the script cannot know (tests, smoke, known gaps) and appends the block here after each release, then posts it to the Workspace (channel releases, to owner).

## Release 11 contents (main 631cb8b)
Range: 6091f7f..548e1cc. 5 commits, 8 files.

**What changed, in plain words** (from the changelog lines this release added)
- 2026-11-04: PM is the owner's only gateway (owner request). `docs/roles/pm.md` (owner gateway: one digest with recommended defaults, verbatim relay of answers, gate checklists, deployment updates, decision log), `docs/WORKFLOW.md` (owner-bound messages go to the PM; releases need the PM's relayed quote), `docs/roles/README.md`, `docs/AGENTS.md` rule 10, `docs/DECISIONS.md`. Docs only; branch `chore/pm-gateway`.
- 2026-11-04: Review standard (owner request). `docs/AGENTS.md` rule 9: evidence for every finding, expected risks written before reading the diff, tests that fail on the old code, a high-risk lane (auth, RLS, migrations, payments, deletion: different-model reviewer, real-system check, owner informed in plain words), independence rules, and an escaped-defect log in `learning.md`; summarised in `docs/WORKFLOW.md`. Docs only; branch `chore/review-standard`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- fb660b0 Log household owner decisions
- c23b796 Fold pm-gateway change file
- f8c57b3 PM is the owner's gateway; owner may still reach any agent directly
- af11fce Fold review-standard change file
- 9abb4b3 Add review standard (AGENTS rule 9)

**Files by area**
- Docs and rules (8): CLAUDE.md, docs/AGENTS.md, docs/CHANGELOG.md, docs/DECISIONS.md, docs/WORKFLOW.md, docs/roles/README.md, docs/roles/pm.md, learning.md

**Database migrations**
None.

**Tests and smoke:** browser suite, regression and production smoke test skipped on purpose (docs and tooling only, tools/gates.js). Production serves stiver-shell-631cb8bbfe (checked after the deploy). PR 16
**Known gaps:** none

---

## Release 10 contents (main 6091f7f)
Range: e58dd4a..fee0f6d. 5 commits, 10 files.

**What changed, in plain words** (from the changelog lines this release added)
- 2026-11-04: Agent workflow document and roles update (owner request). `docs/WORKFLOW.md`: flow diagram (PM -> Designer -> Developer 1 -> review -> QA -> staging -> release -> PostHog), the owner's three gates, the hand-off message formats between agents, rules of the road. Developer 1 is now the main developer; Developer 2 reviews all production changes, integrates, releases and owns the workflow (`docs/AGENTS.md` rules 1 and 8). Docs only; branch `chore/workflow-doc`.
- 2026-11-04: Agent team: Product Manager, Designer, QA (owner request). `docs/roles/` (README with the flow, three owner gates, direct hand-off rule, session registry, lanes; `pm.md`, `designer.md`, `qa.md`), `docs/PRD_TEMPLATE.md`, `docs/AGENTS.md` rule 7. QA writes test cases from the PRD's acceptance checks and runs `tools/regression.js` / smoke; Designer builds Figma from the approved PRD; PM writes the PRD and reads PostHog after release. Docs only; branch `chore/agent-team`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- fee0f6d Fold workflow-doc change file
- d40627d Add agent workflow document; Developer 1 main developer, Developer 2 reviewer and integrator
- a78021d Registry: PM, Designer, QA session ids
- de4132f Fold agent-team change file
- 799fd68 Add PM, Designer and QA agent roles, PRD template and team workflow

**Files by area**
- Docs and rules (10): CLAUDE.md, context.md, docs/AGENTS.md, docs/CHANGELOG.md, docs/PRD_TEMPLATE.md, docs/WORKFLOW.md, docs/roles/README.md, docs/roles/designer.md, docs/roles/pm.md, docs/roles/qa.md

**Database migrations**
None.

**Tests and smoke:** browser suite, regression and production smoke test skipped on purpose (docs and tooling only). Production serves stiver-shell-6091f7f83b (checked). PR 15
**Known gaps:** At release time the QA session had not yet confirmed it started (it did later)

---

## Release 9 contents (main e58dd4a)
Range: 00cacb3..f3cc685. 2 commits, 7 files.

**What changed, in plain words** (from the changelog lines this release added)
- 2026-11-04: Release and regression tools (owner: "do 1 and 2, fast lane"). `tools/regression.js` runs the browser suite, staging smoke and real-database regression and prints the regression summary; `tools/release.js` (dry run by default, `--go` opens and merges the PR, `--verify-only <sha>` waits for the new build and runs the production smoke test); `tools/gates.js` classifies a diff: docs/tooling-only changes (docs/, tools/, .claude/, root *.md) skip regression and the production smoke test. Peer review skipped (docs/tooling only). Branch `chore/release-tools`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- f3cc685 Fold release-tools change file
- e8c1fa4 Add release and regression tools; docs-only changes skip regression and smoke test

**Files by area**
- Tooling (3): tools/gates.js, tools/regression.js, tools/release.js
- Docs and rules (4): CLAUDE.md, context.md, docs/CHANGELOG.md, learning.md

**Database migrations**
None.

**Tests and smoke:** browser suite 0 failures (run before the release), staging smoke 15/15, real-database regression create and cleanup passed; the release itself was docs and tooling only so the production smoke test was skipped. Production serves stiver-shell-e58dd4aefc (checked). PR 14
**Known gaps:** tools/release.js --go (opening and merging the PR) is untested: gh is not signed in in cloud sessions, so the PR was opened with the GitHub tools and release.js --verify-only was used

---

## Release 8 contents (main 00cacb3)
Range: 13eff20..4b431c9. 7 commits, 11 files.

**What changed, in plain words** (from the changelog lines this release added)
- 2026-11-04: Fewer approval prompts (owner request). Added `.claude/settings.json` with `permissions.allow` for all Figma, GitHub, Supabase and Vercel tools and `permissions.ask` for the irreversible or production-affecting ones (merge PR, delete file, apply migration, delete/pause/reset Supabase project or branch, Vercel promote/rollback/alias/domain/DNS/env/firewall/delete). Also asks for Supabase `execute_sql` (can write or delete production data; reads still work through list_tables, get_advisors, query_logs), Vercel `run_session_command` and GitHub `create_repository` (added after Developer 2's review). Only sessions with a single repository read it; connector tool permissions and Auto mode are set by the owner in claude.ai. Workflow approvals (release, regression summary, peer review) are unchanged. Branch `chore/permissions`.
- 2026-11-04: Figma component library (owner approved the plan). The Stiver Figma file has a new Library page: variable collection `Stiver tokens` (29 variables: colours, radii, spacing; Light and Dark modes, scopes and CSS code names), 11 text styles, the card shadow style, and 7 real components (Button x3 kinds, Badge, Corner tab, Close, Field input/select x default/new, Hint, Recurring row) with text properties, plus a Light and a Dark overview frame and an Edit debt example built only from instances. Dark is the same frame with the Dark mode set. `docs/FIGMA.md` (how to design, names, conventions), `tools/figma/helpers.js` (frame/card/phone/instance helpers and `featureSection`, which adds a request note, status line and an `Owner comments` layer), `tools/figma/example_edit_debt.js`, `tools/figma/lint.js` (checks every Feature section for note, status, phone light and dark, Owner comments; the three existing sections only lack the Owner comments layer). `docs/DEV_WORKFLOW.md` section 0 and `CLAUDE.md` rule 6 say to build from the library. Measured: the Edit debt frame in light and dark is about 5.4k characters of script including helpers, against about 9.5k before for one build of the same kind; extra states and dark cost a few lines. Existing flat sections were not converted; Figma comments still cannot be read by agents. Docs and tooling only; branch `chore/figma-library`.
- 2026-11-04: Peer review of production code (owner request). Developer 1 and Developer 2 review each other's non-fast-lane production-code changes before they reach `staging` (`docs/AGENTS.md` rule 5, `CLAUDE.md` rule 6d, `Reviewed by` line in `docs/READY_REPORT.md`): a five-point checklist (correctness and a test that fails on the old code, data safety, privacy and security, house rules, simplicity), one round, reviewer replies `approved <commit>` or numbered blocking/suggestion findings and does not push to the author's branch; Developer 2 merges Developer 1's branch after reviewing it and needs Developer 1's approval before merging its own; exempt: fast lane, docs/tooling only, owner hotfixes (reviewed afterwards); nobody approves their own change. Docs only; branch `chore/peer-review`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- 4b431c9 Fold permissions change file into CHANGELOG
- ea01695 Permissions: also ask before execute_sql, run_session_command and create_repository (Developer 2's review)
- 83460dc Fold change files into docs/CHANGELOG.md
- 1b822db Figma component library: docs and helper snippets
- f277f64 Allow routine Figma/GitHub/Supabase/Vercel tool calls without a prompt; keep asking for destructive and production-affecting ones
- 759e6b5 Fold change files into docs/CHANGELOG.md
- 606f853 Peer review of production code between Developer 1 and Developer 2

**Files by area**
- Tooling (3): tools/figma/example_edit_debt.js, tools/figma/helpers.js, tools/figma/lint.js
- Docs and rules (7): CLAUDE.md, context.md, docs/AGENTS.md, docs/CHANGELOG.md, docs/DEV_WORKFLOW.md, docs/FIGMA.md, docs/READY_REPORT.md
- Assistant settings (1): .claude/settings.json

**Database migrations**
None.

**Tests and smoke:** browser suite 0 failures, staging smoke 15/15, real-database regression create and cleanup passed. Production smoke test 15/15 on stiver.io after the deploy (stiver-shell-00cacb3e0f). PR 13
**Known gaps:** Four write tools stay on the allow list by the owner's choice (push_files, create_or_update_file, create_branch, create_deployment); the permissions file was reviewed by Developer 2 only
