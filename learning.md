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
- 2026-11-11 (D1 task 1, Lent from account, Sonnet 5.5): no new mistakes. A branch cut before the app.js split cannot be rebased: `app.js` is now 17 lines. Method that worked: cherry-pick, take staging's `app.js`, then apply the old `app.js` diff hunk by hunk to the `prototype/app/*.js` file that holds the old text (a short script that needs each hunk's old text to match exactly one file). Applied the additive migration to the staging database only.
- 2026-11-11 (hide balance, Sonnet 5.5): I redrew the Overview hero in Figma from memory and left out the (i) tip and the change pill; the owner had to point both out. Before drawing an existing card, read its markup and list every element. The tracker writes `data-act` names with underscores (`toggle_hide_balance`). Cost not recorded in docs/COSTS.md (no usage record in the session).
- 2026-11-11 (hide balance release, Sonnet 5.5): `tools/ci_wait.js` said GREEN on PRs 63-65 while the real `ci` run (checks e2e, tier) was stuck Queued: it counted only the Vercel checks, so confirm the `ci` workflow run itself finished before saying CI is green. GitHub Actions stayed Queued for 6+ hours and could not be cancelled or re-run; the owner merged the release PR with the admin bypass after the staging regression passed.
- 2026-11-13 (Move asset between investment accounts error, Sonnet 5.5): no new mistakes. I first suspected the Transfer dialog, which already blocks two Cash balances; the real cause was Move to account creating a duplicate (account, symbol) that only the real database rejects (the fake has no unique keys). For a database error, read the table's unique keys in `supabase/migrations` first.
