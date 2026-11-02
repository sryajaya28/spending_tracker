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

## Database and Supabase

- **Supabase write tools (`apply_migration`, `execute_sql` for writes) wait for the owner's approval and time out after ~230 s**
  when nobody answers. Never retry in the same turn. Give the owner the SQL and the SQL Editor URL
  (`https://supabase.com/dashboard/project/ukoxkwxmkwtlihbutryc/sql/new`), then verify with a read-only query afterwards.
- Reads (`select`) work without approval; deletes and DDL do not. Before any destructive statement: look at the rows first,
  delete by exact id with extra guards (`user_id`, `note`), and confirm identity when an email differs from the signed-in
  user's (the owner once typed `suryajaya.378@` instead of `suryajaya378@`; check both with `ilike` before acting).
- **Upsert order must follow foreign keys.** `debts` before `transactions` (an expense can point at a loan) and `debt_payments`
  after `transactions` (a charge points at its expense). Deletes run in reverse. Update `STAGES` in `cloud.js` when adding links.
- Server-side defaults and triggers, not the client, must set identity columns (`user_id`, `email`) for anything the user submits.
- Apply a migration file AND commit it (`supabase/migrations/…`), keep numbering sequential, document it in `context.md` §6.

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

## Session log (append a dated entry at the end of every coding session)

- **2026-11-01** (long session: investments cost basis, localized sample data, loans as payment accounts, support form, calendar):
  - A native `<select>` needs `text-align-last: center` to centre its text, `text-align` alone does nothing.
  - A debugging detour cost time because a hidden `change` event (removed focused input) reset state: when a click "does
    nothing", log the state after the handler and look for events fired by the re-render itself.
  - `git push` after a red test run happened again once; the check is "every line says PASS" before the push command, not after.
  - Owner wording like "native design" means the app's own design language (see UI notes), not the OS component.
  - Wrapping a new feature behind a new DB column: hold `main` until the owner confirms the SQL ran (done for migrations 18-20).
  - Design export: a modal pins the body (`position: fixed`), so a whole-document SVG came out empty; content behind a modal
    is inert and its text is lost; native selects/inputs are drawn by the browser (no text in SVG); a viewport resize closes
    open popovers. Export dialogs as the `dialog` element, swap form controls for styled boxes, open popovers after resizing.
  - Opening `#/portfolio/<id>` directly crashed (`render` assumed the portfolio value chart). Guard page-specific bindings.
  - Python `str.replace` failed on a line containing non-breaking spaces (`  ↳ `): edit such lines by line index or regex.
  - The owner's image numbering can be swapped ("first image" was the second screenshot): match each request to the screenshot it describes.
  - iOS Safari draws `<input type="date">` with centred text and an intrinsic width that ignores `max-width`; `appearance: none` + `width: 100%` + `::-webkit-date-and-time-value { text-align: left }` fixes it. Chromium cannot show this, so it stays unverified until seen on an iPhone.
  - New UI parts go into the design exporter (`SCREENS` / `COMPONENTS`) in the same change (owner request).
  - A placeholder looks like a value: the 🏷️ placeholder in the icon field could not be "deleted". Prefill real values the user may want to change; `maxlength` on emoji fields counts UTF-16 units and blocks some emoji.
  - After `appearance: none`, iOS puts a date input's text at the top of the box; and the date's display format is the browser's (11/01/2026 in en-US). Drawing the text ourselves (`.dp-text`) is the only way to get "2 Nov 2026" everywhere.
  - The owner prefers text links (like Reset filters) over filled buttons for secondary list actions.
  - Before adding a column, check the schema: `transactions.created_at` already existed (default `now()`), so same-day ordering needed no migration; read it back but do not send it (sending it would make the diff sync see every row as changed).
  - Number formatting must depend on what is counted: one shared 8-decimal quantity formatter showed float noise on fiat cash. Pass the holding/symbol to the formatter.
  - A black screen when an iPhone Home Screen app starts means there is no matching `apple-touch-startup-image` (one per exact screen size). Generate them; never quantize gradients to 256 colours (banding, colours shift).
  - Number formatting must also follow the currency's own locale (`nativeLocale`) whenever a currency amount is shown, not only in `money()`.
  - Look at the owner's real rows (read-only SQL) before guessing: the bug was an unlinked entry (`first_tx` missing on 4 of 5 rules), not the edit form. Fixing the edit path alone would not have repaired data that was already inconsistent; add a one-time repair too.
  - I again put a `//` comment in the middle of a generated line (a template-string replacement) and it broke the file: keep explanations out of replaced single-line code, put them on their own line. `node --check` caught it at once.
  - A `required` field inside a hidden block blocks form submit (the browser cannot focus it): validate in the handler instead, or toggle `required`.
  - A rule that hides things ("occasions show only in the months they span") looks like a bug to the owner when something they just set up is missing. When adding a feature next to it, check what the page will show for the new data (a future trip) before saying it works.
  - Tests that type an emoji key by key can race a focus timer (select-on-focus): make timers check the state still matches, and type whole values with `fill` when the real input is a single event. A flaky test that fails at different lines is a race, not a typo: loop it (8x) before and after the fix.
  - Date-dependent fixtures keep biting: fixed dates (Nov 6-8) made tests fail once the date passed. Build occasion/trip dates relative to today.
  - CSS on phones can be a grid (`.brow.wrap` is 44px 1fr, tools on their own row): check the layout in a screenshot after adding a row type.
  - A button that appears only when data exists looks "missing" to the owner (History hidden until a past occasion existed). Show entry points always and put the empty state in what they open.
  - Read the owner's follow-up carefully before reworking: "center align these" turned out to mean the text inside the pressed pill, not the row (three messages to get there). When the wording is ambiguous and cheap to check, do the most literal reading and say which one, instead of changing the layout.
  - A `:hover` background sticks after a tap on phones (already in this file): scope hover colours to `@media (hover: hover)` and give touch a short `:active` state.
  - A `//` comment inside a line I rewrote with a script swallowed the rest of that test line (a whole assertion) AGAIN, and the test kept passing. After editing a test line, re-read it, and keep comments on their own line. A suspicious "still passes" after changing behaviour means an assertion may not be running.
  - Writing to the database on load (adding the Fee category) shows up as an extra upsert in tests that count what is sent: drain the log after sign-in and test the load-time save in its own test.
  - A linked pair of rows (a trade leg and its fee) must not share `trade_id`: cloud.js maps it to `holding_event_id` and a lookup keeps one row per event.
  - A scenario that depends on the owner's period start day must not rely on a calendar month: the 25th-to-24th period put my "two-period" sample occasion in one period. Make such data span more than a month (40 days).
  - Check the fallback currency path when changing sample data (unknown currency = USD profile with USD-priced holdings): prices are in the holding's cost currency, money in the account's.
  - Keep adding to this log; each future session should add at least one line, even if it is "no new mistakes".

## Checklist before you start

1. Read `context.md` and `learning.md`; `git status`; start the dev server.
2. `grep` for any name you are about to add (function, `data-act`, `data-form`, CSS class, i18n key).
3. Make the change with asserted replacements; `node --check`.
4. Add/adjust the e2e test; run the full suite; read the output.
5. Update docs (`context.md`, `regression_scenario.md`, README, `NEXT_STEPS.md`) and `i18n-id.js`.
6. Look at the screenshot; commit; push (`&&` chain); if a migration is involved, wait for the owner to apply it.
7. **Before you finish the session: append your learnings to the Session log above** and commit it.
