# Learning: mistakes made on this project, and how to avoid them

Every item cost time, broke something, or annoyed the owner. **This file is now an index** (owner-approved workflow, `docs/workflows/README.md`): load only the area files your task needs, so a small change does not pay for the whole history. Anything in the Session log below is read in full when it is short enough; older entries are in `docs/learning-archive.md`.

| Your task | Load these (in `docs/learning/`) |
|---|---|
| Any change, always | `owner.md` (how the owner works) |
| About to push, merge, release or deploy | `release.md` |
| Database, migrations, RLS, Supabase, sync, Edge Functions | `data.md` |
| Editing `prototype/app.js` or other app code, event tracking | `code.md` |
| Layout, styles, iPhone and browser behaviour, dark mode, phone width | `ui.md` |
| Writing or running tests, QA, smoke tests | `testing.md` |
| Tier 1 (presentation only) | `owner.md`, `ui.md` |
| Tier 3 (data, access, money) | `owner.md`, `release.md`, `data.md`, `testing.md` |

**At the end of every coding session** append what you learned to the Session log below (mistakes, owner corrections, surprises, things that only worked after a detour), and add a short lasting rule to the right area file when it applies beyond that session. Keep each item short and say what to do instead.

## Session log (append a dated entry at the end of every coding session)

(Entries before 2026-11-03 are in `docs/learning-archive.md`.)
- 2026-11-04 (release tools): built `tools/gates.js`, `regression.js`, `release.js`; `gh` is not signed in in cloud sessions (PR via the GitHub MCP, then `release.js --verify-only <sha>`), and Node `fetch` bypasses the proxy so scripts use `curl`. Owner waived peer review for these docs/tooling-only tools (already exempt).
- 2026-11-04 (review standard): same-model agents share blind spots; reviews need evidence, risks listed before the diff, a different model for high-risk changes, and an escaped-defect log (AGENTS.md rule 9). Escaped defects so far: none logged.
- 2026-11-05 (Workspace answers failed with invalid_argument): the artifact db hands out FROZEN document bodies, so `x.id = d.id` on `d.data()` silently did nothing and every write went to `decisions/undefined` (update on a missing doc = invalid_argument; also shared pick state and broke reply quotes and backlog buttons). Copy with Object.assign before adding the id, and make test stubs freeze their data like the platform; my stub returned plain objects, so the harness passed while the real page failed. Never call a page working after testing only against a stub that is more forgiving than the platform.
- 2026-11-05 (Workspace decision card unusable on the phone): a long URL in a decision's detail text made the card wider than the screen (title and Recommended tag cut off), and the option cards had no visible selected state, so the owner typed the answer into the note field instead. Wrap long text (overflow-wrap anywhere, min-width 0 on grid children), show a radio check on choice cards, label optional fields, and test at 390px with the REAL document that was reported (my harness had no viewport meta, so it ran at 980px and hid the overflow). Give note fields no stable id: the host restores typed values by id.
- 2026-11-05 (household slice 1, fresh session): PostgREST retries SQLSTATE 40001 and ends in a 504, so stale edits raise PT409; edit `run_all.sh` only while no run is active; Supabase MCP prompts never reach the owner, so the Tech-Lead applies migrations; applied migrations are never edited; test locally (`tools/sql_local_test.sh`) before staging; a detached HEAD at session start needs `git branch -f` before committing; PM is reached with the claude-code-remote send_message (SendMessage cannot see it).
- 2026-11-05 (Tech-Lead session, mistakes): I almost let the Full-stack engineer re-apply migrations I had already applied (tell the other agent in the same message that you applied them); running e2e rewrites tools/__pycache__/*.pyc (restore it before the final commit; the file should be gitignored); a Supabase apply_migration with DROP FUNCTION timed out on an unseen owner prompt, so the owner ran it in the SQL editor and list_migrations did not show it (verify via the function signature); deploy_edge_function needs the shared file pasted into every call.
- 2026-11-05 (usage review, Tech-Lead): over 99% of tokens are cached re-reads, so one 585k-token PM session woken by every message was the main cost; I kept answering "no reply needed" relays at full context. Replace big relay sessions early, and prefer one message per event.
- 2026-11-05 (QA found 2 bugs): the fake Supabase accepted unknown columns, so a `manual_prices.id` bug passed every e2e; make the fake as strict as the real table, and show a new test failing on the old code before claiming it covers the bug. A write guard on click is not a read-only screen: hide the controls too.
- 2026-11-05 (workflow plan, Tech-Lead): the owner asked for a leaner workflow; the biggest token costs I saw were long-lived role sessions, pasting the same shared file into six function deploys, agent-run migrations stalling on a hidden confirmation, and QA retesting whole builds. The plan is in docs/workflows/; do not claim its CI parts are built until they are.
- 2026-11-11 (B1 ci_wait, Sonnet 5.5): no new mistakes. `gh auth status` says "token invalid" in this container yet `gh api` works through the proxy, so test the real call before assuming gh is unusable; the test for a tools/ script lives in `tools/` (a file under `tests/` would raise the PR to Tier 2).
