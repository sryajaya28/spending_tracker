# Release contents (exact, newest first)

Every release starts with the high-level list of its items (Features, Fixes, Docs/process, Tooling, each with its branch), then the exact detail (owner, 2026-11-05). Generated with `node tools/release_contents.js --merge <main sha>`; the Tech-Lead adds tests, smoke and known gaps and appends the block here after each release, then posts it to the Workspace (channel releases, to owner).

## Release 14 contents (main e64e5e9)

**Items in this release**
- Docs/process (branch staging): Release 13 recorded; Tech-Lead handoff note and registry; decision log entry (owner approved Releases 12-13 after the fact; docs-only bundling)

**Exact detail.** Range: 6761bfe..68c67bd. 4 commits, 4 files.

**What changed, in plain words** (the changelog lines this release added)
- (no changelog line added)

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- 68c67bd Record owner approval of Releases 12-13 and bundling decision
- 3ad2d20 Registry: fresh Tech-Lead session
- 025d9eb Tech-Lead handoff note
- 2278959 Record Release 13

**Files by area**
- Docs and rules (4): docs/DECISIONS.md, docs/RELEASES.md, docs/handoff/techlead.md, docs/roles/README.md

**Database migrations**
None.

**Tests and smoke:** skipped (docs only). skipped (docs only); shell check: production serves stiver-shell-e64e5e9988 (10-char sha, verify-only expected 7 chars, so it reported FAIL on a length mismatch only)
**Known gaps:** tools/release.js --verify-only compares a 7-char sha with the 10-char stamp

## Release 13 contents (main 6761bfe)

**Items in this release**
Docs/process:
- Opus review needs the owner's approval [chore/opus-approval]
- Opus review only for big features [chore/opus-scope]

**Exact detail.** Range: 8c6e642..8e163d7. 4 commits, 4 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-05: Opus review needs the owner's approval (owner request). `docs/AGENTS.md` rules 9 and 15 and `docs/roles/pm.md`: before any Opus / different-model reviewer session starts, the Tech-Lead hands the PM a short case and cost; the PM posts a Workspace decision; no answer means normal review only. Docs only; branch `chore/opus-approval`.
- 2026-11-05: Opus review only for big features (owner request). `docs/AGENTS.md` rules 9 and 15: the different-model (Opus) review is used only for a big feature or a major authentication/database change; small changes, even in those areas, get normal peer review and QA. Docs only; branch `chore/opus-scope`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- 8e163d7 Fold opus-approval change file
- b768e7d Opus review needs the owner's approval
- babfbe6 Fold opus-scope change file
- ce71ae9 Opus review only for big features; record Release 12

**Files by area**
- Docs and rules (4): docs/AGENTS.md, docs/CHANGELOG.md, docs/RELEASES.md, docs/roles/pm.md

**Database migrations**
None.

**Tests and smoke:** regression and production smoke skipped by rule (docs only). Production serves stiver-shell-6761bfe917 (checked). PR 18
**Known gaps:** none

---

## Release 12 contents (main 8c6e642)

**Items in this release**
Docs/process:
- Release reports start with a high-level item list [chore/release-items]
- Token-use rules [chore/cost-rules]
- Workspace: Approvals tab [chore/approvals-tab]
- No agent asks the owner anything directly [chore/no-direct-asks]
- Developer 1 and 2 renamed [chore/rename-roles]
- Security involvement limited to major authentication and database changes [chore/security-scope]
- Release contents shown exactly [chore/release-contents]
- The owner does not repeat anything [chore/owner-input]
- Workspace: decisions and actions are separate [chore/workspace-needs]
- Workspace: phone layout and PM backlog [chore/workspace-mobile]
- Workspace: chat view and 3D office [chore/workspace-chat]
- Stiver Workspace [chore/workspace]
- Figma Library: Avatar and Chip components (household design) [chore/decisions-figma-lib]

**Exact detail.** Range: 631cb8b..0f44c00. 36 commits, 19 files.

**What changed, in plain words** (the changelog lines this release added)
- 2026-11-05: Release reports start with a high-level item list (owner request). `tools/release_contents.js` now puts "Items in this release" first (Features, Fixes, Docs/process, Tooling; one plain line per changelog entry with its branch, no files or hashes), then the exact detail; `docs/RELEASES.md` rewritten for releases 8 to 11; `docs/WORKSPACE.md` updated. Docs and tooling only; branch `chore/release-items`.
- 2026-11-05: Token-use rules (owner: "it's too expensive now"). Measured from the run logs: cost is context size times number of tool calls (Full-stack engineer about 185k tokens per call over 5 days, Tech-Lead about 658k, PM small), not messages. `docs/AGENTS.md` rule 15: no acknowledgements (`No reply needed.`), long findings in `docs/reviews/`, few big calls and no whole-file/event-log dumps, reviewers read the diff (different model only for auth/database), fresh sessions with a handoff note past about 200k tokens, per-role reading lists (`docs/roles/README.md`), milestone-only Workspace posts and no presence timer (`docs/WORKSPACE.md`), event-driven PM backlog and pointer relays (`docs/roles/pm.md`). Docs only; branch `chore/cost-rules`.
- 2026-11-05: Workspace: Approvals tab (owner request). The Needs-you area has a fourth tab, Approvals (collection `approvals`): formal yes/no sign-offs on finished work (gate 1 PRD, gate 2 design, staging sign-off, release request) with links, what it covers and does not cover, evidence and one recommendation; Approve / Request changes with an optional note; a release approval is recorded as intent and still needs a chat message. Also fixed on the page: action and decision cards map old labels like "Developer 2" to the new role names, and the numbered step badges no longer overlap the checkboxes on the phone. `docs/WORKSPACE.md`, `docs/roles/pm.md`. Docs and page only; branch `chore/approvals-tab`.
- 2026-11-05: No agent asks the owner anything directly (owner feedback). `docs/AGENTS.md` rule 14: asks go to the PM and appear on the Workspace as a decision or action; emergencies use a Workspace message to the owner plus a copy to the PM; an owner contact is reported to the PM at once; no plan mode or question prompts for owner approvals; tool-permission prompts are announced to the PM first. `.claude/settings.json` now denies AskUserQuestion, EnterPlanMode and ExitPlanMode. Ready report and review replies carry `Owner-bound asks: all on the Workspace (yes/no)`; `docs/WORKFLOW.md`, `docs/roles/pm.md` updated. Trigger: the Full-stack engineer's session was in plan mode and the harness showed the owner a plan-approval prompt that was not on the Workspace. Docs and settings only; branch `chore/no-direct-asks`.
- 2026-11-05: Developer 1 and 2 renamed (owner request). Developer 1 is now the Full-stack engineer (builds), Developer 2 the Tech-Lead (reviews, integrates, releases, owns the workflow) in CLAUDE.md, context.md, docs/AGENTS.md, docs/WORKFLOW.md, docs/WORKSPACE.md, docs/DEV_WORKFLOW.md, docs/roles/*, and on the Workspace page (a name map; the keys dev1/dev2, session ids and branches are unchanged; history entries keep the old names). Docs and page only; branch `chore/rename-roles`.
- 2026-11-05: Security involvement limited to major authentication and database changes (owner request, to keep token use low). `docs/AGENTS.md` rule 9 high-risk lane and review item 3, `docs/WORKFLOW.md`, `docs/roles/pm.md`, `docs/roles/README.md`: the different-model security review, real-system check and plain-words risk summary apply only to major changes that update authentication (sign-in, sessions, handoff, invites, tokens, passwords) or the database (migrations, RLS, functions, triggers); every other change gets normal peer review and QA with no security step. The household and handoff-hardening work stay in the lane. Docs only; branch `chore/security-scope`.
- 2026-11-05: Release contents shown exactly (owner request). `tools/release_contents.js` lists a release's commits, files by area, plain-words changelog lines, what a user can see, migrations, tests/smoke and gaps; `tools/release.js` prints it (dry run and after a release); `docs/RELEASES.md` holds it for releases 8 to 11 (new rule: every release, exact contents, never a summary); the PM sees the owner's Workspace messages first and relays them in detail (`docs/AGENTS.md` rule 13, `docs/WORKSPACE.md`, `docs/roles/pm.md`). Docs and tooling only; branch `chore/release-contents`.
- 2026-11-05: The owner does not repeat anything (owner request). Page answers on the Workspace count as the owner's approval for gates 1 and 2 and all decisions and actions (release and production migrations still need a chat message); every agent reads the Workspace for the owner's input; chat statements are mirrored to the Workspace as quoted messages. `docs/WORKSPACE.md`, `docs/AGENTS.md` rule 12, `docs/roles/pm.md`, `docs/DECISIONS.md`. Docs only; branch `chore/owner-input`.
- 2026-11-05: Workspace: decisions and actions are separate (owner request). The Needs-you area has Decisions (each option shows pros, cons, a Recommended tag and a recommendation) and Actions (numbered steps with checkboxes, exact page links, time estimate, what to do afterwards; "I did this" / "Not now"), plus a Log. New `actions` collection; rules in `docs/WORKSPACE.md` and `docs/roles/pm.md`. Docs only; branch `chore/workspace-needs`.
- 2026-11-05: Workspace: phone layout and PM backlog (owner request). The Workspace page now follows a team chat app on the phone: bottom bar Home / DMs / Backlog / Office, decisions as a banner on Home, channels and DM threads full screen. New `backlog` collection the owner adds to and the PM works through continuously (`docs/WORKSPACE.md`, backlog loop in `docs/roles/pm.md`). Docs only; branch `chore/workspace-mobile`.
- 2026-11-04: Workspace: chat view and 3D office (owner request). The Stiver Workspace page now shows agent-to-agent conversation with quoted replies and live "working on" status, plus a 3D office tab (desks, speech bubbles, glowing screens, a ringing bell for decisions). `docs/WORKSPACE.md` adds `replyTo`, the `presence` collection and the rule to mirror every inter-agent message. Docs only; branch `chore/workspace-chat`.
- 2026-11-04: Stiver Workspace (owner request). A Claude artifact with a Slack-like feed of all agent messages and a pinned "Needs you" tray for decisions the owner must make (answers saved on the page, relayed by the PM). `docs/WORKSPACE.md` (URL, message and decision schema, who posts, how answers are used and the limit that release/production migrations still need a chat message), `docs/AGENTS.md` rule 11, `docs/roles/pm.md`. Docs only; branch `chore/workspace`.
- 2026-11-04: Figma Library: Avatar and Chip components (household design). `docs/FIGMA.md` components table now lists Avatar (`Initial`) and Chip (`Text`, `Selected`) added by the Designer for the household feature; decision log merged from the PM's branches. Docs only; branch `chore/decisions-figma-lib`.

**What a user can see change**
Nothing: docs, tooling and settings only. The app and its data are untouched.

**Commits**
- 0f44c00 Fold release-items change file
- 4a22a96 Release reports start with a high-level item list; releases 8-11 rewritten
- 291889f Fold cost-rules change file
- 5fcd095 Token-use rules: AGENTS rule 15, reading lists, milestone-only posts, event-driven PM
- 98b1ea0 Fold approvals-tab change file
- 3d80db3 Workspace docs: approvals tab and collection
- 58dc63a Fold no-direct-asks change file
- 274de16 No agent asks the owner directly: rule 14, deny question and plan tools, report check line
- 1ad0845 Log Full-stack engineer plan approval
- 726775a Fold rename-roles change file
- 2a73b18 Rename Developer 1 and 2: Full-stack engineer and Tech-Lead (display names only)
- e720b7a Log handoff message approval and owner process rules
- 1080c33 Fold security-scope change file
- 9087ded Security review only for major authentication and database changes
- 0e35082 learning: Workspace decision card overflow and unclear selection
- 36e1f4e Release contents: no truncation of changelog lines; docs/RELEASES.md regenerated
- ae29a7c Fold release-contents change file
- 8b97551 Exact release contents (tool, docs/RELEASES.md); PM sees owner messages first
- 309322e Fold owner-input change file
- d6789b2 Owner input: page answers count for gates 1 and 2; agents read the Workspace; chat mirrored
- e519b74 Log handoff PRD approval and Workspace approval rule
- e2bbd8a Workspace docs: presence heartbeat; trim learning log to the doc budget
- de20855 Fold workspace-needs change file
- d2b35cc Workspace docs: decisions with pros and cons, actions with steps and links
- 27f51b5 learning: frozen db documents in the Workspace page
- bfd3cb5 Fold workspace-mobile change file
- 53a5e66 Workspace docs: phone layout and PM backlog loop
- d93fc8c Fold workspace-chat change file
- 557bfb3 Workspace docs: chat replies, presence, 3D office
- 7c1978e Fold workspace change file
- 59fb141 Add Stiver Workspace docs (shared feed and needs-you tray)
- 244c6d7 Fold figma avatar/chip change file
- 5d8008b FIGMA.md: Avatar and Chip components
- 1196005 Log remaining household owner decisions
- 6b1c85d Decision log: household design approved (gate 2)
- 57c5de4 Decision log: editor edits only own transactions

**Files by area**
- Tooling (2): tools/release.js, tools/release_contents.js
- Docs and rules (16): CLAUDE.md, context.md, docs/AGENTS.md, docs/CHANGELOG.md, docs/DECISIONS.md, docs/DEV_WORKFLOW.md, docs/FIGMA.md, docs/READY_REPORT.md, docs/RELEASES.md, docs/WORKFLOW.md, docs/WORKSPACE.md, docs/learning-archive.md, docs/reviews/README.md, docs/roles/README.md, docs/roles/pm.md, learning.md
- Assistant settings (1): .claude/settings.json

**Database migrations**
None.

**Tests and smoke:** browser suite, regression and production smoke skipped by rule (docs, tooling and settings only). Production serves stiver-shell-8c6e642191 (checked). PR 17
**Known gaps:** none

---

## Release 11 contents (main 631cb8b)

**Items in this release**
Docs/process:
- PM is the owner's only gateway [chore/pm-gateway]
- Review standard [chore/review-standard]

**Exact detail.** Range: 6091f7f..548e1cc. 5 commits, 8 files.

**What changed, in plain words** (the changelog lines this release added)
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

**Tests and smoke:** browser suite, regression and production smoke skipped on purpose (docs and tooling only). Production serves stiver-shell-631cb8bbfe (checked). PR 16
**Known gaps:** none

---

## Release 10 contents (main 6091f7f)

**Items in this release**
Docs/process:
- Agent workflow document and roles update [chore/workflow-doc]
- Agent team: Product Manager, Designer, QA [chore/agent-team]

**Exact detail.** Range: e58dd4a..fee0f6d. 5 commits, 10 files.

**What changed, in plain words** (the changelog lines this release added)
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

**Tests and smoke:** browser suite, regression and production smoke skipped on purpose (docs and tooling only). Production serves stiver-shell-6091f7f83b (checked). PR 15
**Known gaps:** none

---

## Release 9 contents (main e58dd4a)

**Items in this release**
Tooling:
- Release and regression tools

**Exact detail.** Range: 00cacb3..f3cc685. 2 commits, 7 files.

**What changed, in plain words** (the changelog lines this release added)
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

**Tests and smoke:** browser suite 0 failures (before release), staging smoke 15/15, real-database regression passed; production smoke skipped (docs and tooling only). Production serves stiver-shell-e58dd4aefc (checked). PR 14
**Known gaps:** tools/release.js --go untested: gh is not signed in in cloud sessions

---

## Release 8 contents (main 00cacb3)

**Items in this release**
Docs/process:
- Fewer approval prompts
- Figma component library [chore/figma-library]
- Peer review of production code [chore/peer-review]

**Exact detail.** Range: 13eff20..4b431c9. 7 commits, 11 files.

**What changed, in plain words** (the changelog lines this release added)
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

**Tests and smoke:** browser suite 0 failures, staging smoke 15/15, real-database regression passed. Production smoke 15/15 on stiver.io (stiver-shell-00cacb3e0f). PR 13
**Known gaps:** Four write tools stay on the allow list by the owner's choice; the permissions file was reviewed by one reviewer only
