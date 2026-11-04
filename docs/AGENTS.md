# Working with more than one agent

Rules so two agents (or sessions) on Stiver do not collide. The owner can override any of them in plain words.

1. **Roles (owner, 2026-11-04): Developer 2 is the integrator; Developer 1 builds on feature branches.** An agent that is not sure whether it is Developer 2 asks the owner
   before merging to `staging`. Only the integrator merges into `staging`, runs `node tools/fold_changes.js`, `node tools/trim_learnings.js` and `node tools/doc_budget.js` (keep the always-read files small), releases to `main` and runs the
   smoke test. Other agents work on `feature/<name>` branches only, rebase on the latest `staging`
   (`git fetch origin staging && git merge origin/staging`), run the affected tests plus `bash tests/e2e/run_all.sh`, then tell the
   owner "ready: <branch>, tests pass, design link, steps". Explicit owner instructions such as "push to staging directly" or a
   hotfix go before this rule; whoever does it tells the other agent.
2. **No shared edit hotspots.**
   - The service worker cache name is stamped at deploy (`tools/stamp_sw.js`, run as the Vercel build command): never edit it.
   - The changelog entry is its own file in `docs/changes/` (see its README); the integrator folds them into `docs/CHANGELOG.md`.
   - `context.md` is edited in the section a change affects, not appended to; keep edits small.
3. **Split by area.** Say which part of the app you are working on before you start; avoid editing the same large file
   (`prototype/app.js`) region at the same time as another agent. If you must, keep the change small and rebase often.
4. **Hand off in writing.** When you stop with work in progress, add a short "state of my branch" note under
   `context.md` section 16 (done / untested / blocked), so the next agent does not re-read the transcript.
5. **Peer review of production code (owner, 2026-11-04).** Developer 1 and Developer 2 review each other's work before it reaches `staging`.
   - **Applies to** changes under `prototype/`, `api/`, `supabase/` or `vercel.json` (and the tests that gate them) that are **not** in the fast lane.
     **Exempt:** fast lane, docs- or tooling-only changes, and an owner-ordered hotfix (the other developer reviews it afterwards, in the next session).
   - **Author:** when the tests pass, send the ready report to the owner and a short message to the other developer
     ("review: <branch> <commit>, request in one line, design link, tests run"). Fix findings on the same branch.
   - **Reviewer:** read `git diff origin/staging...origin/<branch>`, run the affected tests (`node tools/affected_tests.js`) and the new test, and check:
     1. correctness (logic, edge cases, render order, state) and that the new test fails on the old code;
     2. data safety (save/sync mapping, migrations backwards compatible, nothing lost on reload, RLS untouched);
     3. privacy and security (no secrets, no private data in analytics events, CSP);
     4. house rules (`CLAUDE.md`, `learning.md`): i18n strings, `data-act` / `data-form` + analytics event, design match incl. dark and phone, change file;
     5. simplicity (no duplicate helpers, unique global names, no dead code).
     The `code-review` skill (medium) can do the first pass. Reply with `approved <commit>` or numbered findings marked **blocking** or **suggestion**.
     One round; the reviewer does not push to the author's branch.
   - **Merging:** the integrator (Developer 2) merges Developer 1's branch after reviewing it (that is the review). Developer 2's own production-code branches need Developer 1's
     `approved <commit>` before Developer 2 merges them into `staging`. Put `Reviewed by: <developer> approved <commit>` in the ready report.
   - **Nobody answers?** Say so to the owner and ask whether to wait or waive; never approve your own change.
6. **Tool prompts vs workflow approvals.** `.claude/settings.json` allows routine Figma, GitHub, Supabase and Vercel tool calls without a prompt and still asks for irreversible or production-affecting ones. This only removes tool prompts; the owner's approval for a release, the regression summary and peer review still apply, and an agent never uses an allowed tool to get around them.
7. **The wider team (owner, 2026-11-04).** Product Manager, Designer and QA agents work beside the two developers; roles, hand-off formats, the owner's three gates and the session registry are in `docs/roles/README.md`. Developers receive an approved PRD and an approved Figma link, build, then hand to QA; QA, not the developer, runs regression and smoke. Peer review (rule 5) stays.
