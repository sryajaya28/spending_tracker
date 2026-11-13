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
- 2026-11-13 (release 21, owner: "why couldn't you see session costs?"): the session's cost and token usage ARE readable with `get_session` (no session_id: `external_metadata.usage` and `context_usage`); I copied "not visible inside the session" from older COSTS rows without checking, and wrote a turn count I had not counted. Read the usage record when closing a task, and check `context_usage` during the task: this one reached about 228k tokens against the 120k budget because the release steps were added to the build session; for a task this size, hand the release to a fresh session.
- 2026-11-13 (release prompt, Fable 5.2 then Sonnet 5.5): no new mistakes. Two PRs appending a row to the end of `docs/COSTS.md` always conflict; after a rebase keep both rows. The release session is its own fresh session (`docs/tasks/RELEASE.md`), not the last build session.
- 2026-11-13 (Settings hub, Sonnet 5.5): moving cards onto sub-pages broke 18 e2e tests that opened `#/settings` and expected a card, so grep `tests/` for the route before moving anything and fix them in the same PR (a test that waited for the sign-out button on a long page needed a shorter viewport once the page got short). The owner sent design changes in small messages while I drew (sign out, sample data, profile, "theme"), and added the hidden bottom bar and the hub back arrow only after approval: ask in the first design message where the page is entered from and left to (tab bar, back button). `curl` to figma.com is blocked by the proxy, so Figma screenshots come inline (`enableBase64Response`). Cost not recorded in docs/COSTS.md (no usage record available inside the session).
- 2026-11-13 (coin transfer fee build, Sonnet 5.5): no owner corrections. The system prompt named a different branch than the owner's message; I built on the owner's branch (it held the task file). An existing test (`movehold`) moved crypto and silently started going through the new path: when a rule narrows by asset type, grep tests for that type first. Transactions days are collapsed: click `[data-act=days-all]` before waiting for a row. Event kinds without their own price (`tr.kind`) were skipped by `holdingCost`; a loaded event gets an `amount_minor` from its transaction, so `tradePrice` would silently price it at market: keep the `kind` skip unless `price` is set.
- 2026-11-13 (release 23, Sonnet 5.5): no new mistakes. `gh` is not signed in here, so the release PR was opened and merged with the GitHub tools and `ci_wait.js` could not be used; check the `e2e` run before merging (it was still running when the PR opened). `ship.js` leaves "no changelog entry" placeholders in the record: fill items, tests and gaps by hand.
