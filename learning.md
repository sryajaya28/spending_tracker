# Learning: mistakes made on this project, and how to avoid them

**Read this file before every new coding session** (together with `context.md`). Every item below cost time, broke
something, or annoyed the owner. **At the end of every coding session, add what you learned** to the "Session log" at the
bottom (and to the right section above when it is a lasting rule): mistakes made, owner corrections, surprises, things that
only worked after a detour. Keep each item short and say what to do instead.

## Before you push (release discipline)

- **Never push with a failing test.** Twice a push went out while a test was red (dropdown group test, sample banner test)
  because the command chain used `;` instead of `&&`, or the output was not read. Run `bash tests/e2e/run_all.sh`, read
  the whole output, push only when every line is `PASS`. If a test fails because the test is outdated, fix the test first.
- **A regression shipped to production**: `.map(txnRow)` passed the array index as the function's second argument
  (`txnRow(t, loanView)`), so every expense after the first row showed `+`. Never pass a function with optional
  parameters straight to `.map` / `.forEach`; write `.map((t) => fn(t))`. Add a test that checks every row, not only the first.
- **Code that needs a database change must not reach `main` before the migration is applied.** `cloud.js` writes new columns
  on every save, so an unapplied migration breaks saving for everyone. Commit to the session branch only, hand the SQL to the
  owner, verify with a read query, then push to `main`.
- **Pushing to `main` deploys to production.** Say what you could not verify (live site, real iPhone, real Yahoo/Finnhub
  prices, real Supabase email) instead of implying it works there.
- The first manual Vercel deploy failed (made-up commit sha, then a free-plan limit). Use the real commit sha; check the plan.
- **Look at every screenshot before sending it.** Several previews were sent unseen and had layout bugs (overlapping amounts,
  chevron wrapping, transparent popover mid-animation). Wait for animations to finish before capturing.
- **Hosting config (rewrites, headers, CSP) is only proven on a real deployed URL.** A stubbed network route passed while the `/ingest/:path*` rewrite missed `/ingest/e/` (trailing slash) and no analytics event ever arrived. After such a change, curl the exact path and method the client uses on staging and confirm the data shows up at its destination.

## Database and Supabase

- **Supabase write tools (`apply_migration`, `execute_sql` for writes) wait for the owner's approval and time out after ~230 s**
  when nobody answers. Never retry in the same turn. Give the owner the SQL and the SQL Editor URL
  (`https://supabase.com/dashboard/project/ukoxkwxmkwtlihbutryc/sql/new`), then verify with a read-only query afterwards.
- Reads (`select`) work without approval; deletes and DDL do not. Before any destructive statement: look at the rows first,
  delete by exact id with extra guards (`user_id`, `note`), and confirm identity when an email differs from the signed-in
  user's (the owner once mistyped their own address by one character; check close variants with `ilike` before acting).
- **Upsert order must follow foreign keys.** `debts` before `transactions` (an expense can point at a loan) and `debt_payments`
  after `transactions` (a charge points at its expense). Deletes run in reverse. Update `STAGES` in `cloud.js` when adding links.
- Server-side defaults and triggers, not the client, must set identity columns (`user_id`, `email`) for anything the user submits.
- Apply a migration file AND commit it (`supabase/migrations/…`), keep numbering sequential, document it in `context.md` §6.
- `recurring_rules.kind` has a check constraint (txn/transfer/invest). Store a new variant inside the existing kind's `spec` jsonb (`spec.debt`) to avoid a migration, then teach every place that handles `txn` rules (grep `r.kind === 'txn'` and `sp.wallet_id`).

## Editing code safely

- **Everything lives in one global scope** (`app.js`). Name collisions are silent: a new `transferDialog()` replaced the real
  one, and a new form kind `'transfer'` hijacked the money-transfer submit handler (the same bug twice). `grep` for the name
  (function, `data-act`, `data-form`, element id) before using it.
- **Script edits**: use Python `str.replace` with an `assert s.count(old) == 1`, not `sed` with line numbers (lines shift after
  earlier edits) and never insert a `// comment` in the middle of a line (it swallowed the rest of the line and broke the file).
  Run `node --check` on every edited JS file straight away.
- Bulk rename scripts are dangerous: renaming "Wallet" to "Account" broke internal identifiers. Rename user-visible text only,
  keep internal names, and review the diff.
- When a helper already returns a signed/formatted string, do not add another sign (`−−Rp49.000`, `++$5,584`). Read what the
  helper returns first.
- Re-rendering replaces DOM: a focused input that is removed fires a `change` event with its old value and can restore old
  state (old search text came back). Handle text inputs on `input`, selects on `change`.
- A modal's `close()` does not empty it: the form is still in the DOM. Check `#dlg[open]`, not the form's existence.
- Do not call `render()` and then rely on state that an event can still overwrite; set state first, render last.
- Deleting/editing something that other rows point at (loan charge ↔ expense, recurring first entry ↔ rule) must update both.
  A first payment entered by hand and then moved by editing the rule left a stale duplicate (`spec.first_tx`, `first_made`).
- Sample data: keep every transaction categorized, no negative account, every investment holding with an average price; the
  e2e `samplelocal` test checks it. Currency profiles must work for unknown currencies (fallback to USD).
- A filtered view must not invent its own sign or total convention: the loan view showed `+` for charges and summed differently, and a test had even asserted it. Change the test that encoded the old rule and add a sum check (day total = signed rows).
- Hidden form fields still submit, and `display:none` fields cannot be `fill`ed by tests: decide what a hidden value means before saving (a hidden weekly amount became the monthly payment). `addRule` with a future start marks the first payment as already booked (`first_made`): push the rule directly when it is not.
- `const state` in a classic script is not on `window`: other files must test `typeof state !== 'undefined'`.

## UI and browser quirks (iPhone especially)

- **iOS Safari and the installed Home Screen app have separate storage.** A session cannot be shared by storage; the address
  fragment is ignored when adding to the Home Screen (the manifest `start_url` wins); `navigator.share` opens a generic sheet
  that has no "Add to Home Screen". What works: the one-time handoff code (typed) and a short-lived cookie. Do not promise more.
- **`overflow: hidden` on the body does not stop the page behind a modal from scrolling on iPhone**: pin the body (`position:
  fixed` + restore scroll position on close).
- **A native `<select>` focused after a tap makes iOS open its picker again**; focusing the search box inside a custom list
  closed it (resize/scroll events); a list appended to `<body>` is inert while a modal `<dialog>` is open (keep it inside the
  dialog); a list taller than the dialog got clipped. See `dropdown.js` comments before touching it.
- Newer iOS `Intl` writes `Rp5.000` (no space) and may give IDR 2 decimals. Decimals are fixed in `expOf`; the space is forced by
  `rpSpace`. Each currency uses its own native locale (`NATIVE_LOCALE`), not the app language.
- A `:hover` background sticks after a tap on touch screens; do not use hover colours on tappable rows.
- Strict CSP: images only from `self` and `data:` (no `blob:`), connect only to Supabase. Use `createImageBitmap` and data URLs.
- `pointer-events: none` is used on enhanced `select` and `date` inputs (taps land on the label): Playwright cannot `click()`
  them; click by coordinates (`page.mouse.click`) or `fill` / `selectOption`.
- The OS calendar, OS pickers and OS share sheet look different from the app: the owner wants the **app's design** (custom
  dropdown, custom calendar), not the OS component.
- Keep text short on phones; long names must wrap or ellipsize, never push buttons off-screen. Check at 390 px wide.

## Testing

- Start the dev server before tests (`python3 tools/dev_server.py 5180 &`); `run_all.sh` does it, a single `node tests/e2e/x.js`
  does not. A "connection refused" is not a product failure.
- **Tests must not depend on today's date.** The "1st of the month" broke daily tests (entries dated the 5th were in the
  future and hidden). Use a past period (`lastMonths(2)[0]`) or relative dates.
- `Cloud.idle()` can resolve before an async submit handler finishes; wait for the visible result, not only `settle()`.
- Asynchronous `close` events: wait ~100 ms before asserting scroll position or `open` state.
- After `git checkout tests/e2e/*.png` (screenshots are regenerated by runs) before committing.
- One transient failure (`recurring`) happened during a full run and passed on rerun; always rerun a red test once before
  assuming a product bug, but never push on a red run.
- Headless browsers are dropped by PostHog's bot filter (`navigator.webdriver`, `userAgentData`): override both for a live check, and set `opt_out_useragent_filter` under test. Queries through the PostHog tool are cached: change the SQL text to force a fresh read.

## Working with the owner

- **Follow the working agreement every time**: read `context.md` and this file first; after every change update `context.md`
  (section + dated changelog line), `regression_scenario.md` (scenario + automated-coverage map), README / `docs/NEXT_STEPS.md`
  when affected; add Indonesian strings to `prototype/i18n-id.js`; run the e2e suite; commit with the two trailer lines;
  push the session branch and `main`.
- Ambiguous requests ("native design", "the 2nd image part", "this part", "Details"): pick the most likely meaning, say which
  one you picked, and offer the alternative. Do not ask long questions for small things.
- The owner often sends several changes in a row: finish the current one, fold new ones in, and report all of them.
- Be honest and short in replies: what changed, what was verified, what was not, and what the owner must do (run SQL, approve).
- Remember explicit preferences: not sticky, no helper subtitles under titles, compact spacing, description next to the
  question, one filled button per dialog, no emojis-as-icons for actions, same colour for income and expense amounts,
  `Rp 1.234` formatting, "Account" not "Wallet", dark purple (not bright) in dark mode, never zoom the PWA.
- Never send secrets; never delete or overwrite data without looking at it first and, if in doubt, asking.
- After any restart or long gap `git fetch` and re-read `CLAUDE.md` and `docs/AGENTS.md`: rules and the Figma file changed mid-session. Design in Figma (the file named in CLAUDE.md) before any UI code, include dark and phone screens, and ask who the integrator is before merging into `staging`.

## Session log (append a dated entry at the end of every coding session)

(Entries before 2026-11-03 are in `docs/learning-archive.md`.)
- 2026-11-04 (release tools): built `tools/gates.js`, `regression.js`, `release.js`; `gh` is not signed in in cloud sessions (PR via the GitHub MCP, then `release.js --verify-only <sha>`), and Node `fetch` bypasses the proxy so scripts use `curl`. Owner waived peer review for these docs/tooling-only tools (already exempt).
- 2026-11-04 (review standard): same-model agents share blind spots; reviews need evidence, risks listed before the diff, a different model for high-risk changes, and an escaped-defect log (AGENTS.md rule 9). Escaped defects so far: none logged.
- 2026-11-05 (Workspace answers failed with invalid_argument): the artifact db hands out FROZEN document bodies, so `x.id = d.id` on `d.data()` silently did nothing and every write went to `decisions/undefined` (update on a missing doc = invalid_argument; also shared pick state and broke reply quotes and backlog buttons). Copy with Object.assign before adding the id, and make test stubs freeze their data like the platform; my stub returned plain objects, so the harness passed while the real page failed. Never call a page working after testing only against a stub that is more forgiving than the platform.
- 2026-11-05 (Workspace decision card unusable on the phone): a long URL in a decision's detail text made the card wider than the screen (title and Recommended tag cut off), and the option cards had no visible selected state, so the owner typed the answer into the note field instead. Wrap long text (overflow-wrap anywhere, min-width 0 on grid children), show a radio check on choice cards, label optional fields, and test at 390px with the REAL document that was reported (my harness had no viewport meta, so it ran at 980px and hid the overflow). Give note fields no stable id: the host restores typed values by id.
- 2026-11-05 (household slice 1, fresh session): PostgREST retries SQLSTATE 40001 and ends in a 504, so stale edits raise PT409; edit `run_all.sh` only while no run is active; Supabase MCP prompts never reach the owner, so the Tech-Lead applies migrations; applied migrations are never edited; test locally (`tools/sql_local_test.sh`) before staging; a detached HEAD at session start needs `git branch -f` before committing; PM is reached with the claude-code-remote send_message (SendMessage cannot see it).
- 2026-11-05 (Tech-Lead session, mistakes): I almost let the Full-stack engineer re-apply migrations I had already applied (tell the other agent in the same message that you applied them); running e2e rewrites tools/__pycache__/*.pyc (restore it before the final commit; the file should be gitignored); a Supabase apply_migration with DROP FUNCTION timed out on an unseen owner prompt, so the owner ran it in the SQL editor and list_migrations did not show it (verify via the function signature); deploy_edge_function needs the shared file pasted into every call.
- 2026-11-05 (usage review, Tech-Lead): over 99% of tokens are cached re-reads, so one 585k-token PM session woken by every message was the main cost; I kept answering "no reply needed" relays at full context. Replace big relay sessions early, and prefer one message per event.
