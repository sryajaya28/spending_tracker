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
  - A card that stretches to its neighbour in a grid cannot also grow with its own content: put the flexible list in an absolutely positioned box (`inset: 0; overflow: hidden`) and hide the rows that do not fit, so it never changes the row height. A bare test account has short neighbours: force the neighbour's height in the test instead of assuming the real layout.
  - Session state lives in more than `state`: the URL hash and the page's scroll position also survive logout/login. Reset them (with `history.replaceState`, which does not fire `hashchange`) whenever a session starts or ends, and tell a real login (`SIGNED_IN`) from reopening with a saved session (`INITIAL_SESSION`).
  - A host the sandbox cannot reach can still be checked through the deployed app: Vercel's `web_fetch_vercel_url` on the app's own `/api/...` endpoint returned the real Frankfurter rates. Check live data that way instead of trusting documentation search alone.
  - Built-in fallback rates go stale (INR 88 vs 94.95 live): keep them in the right ballpark, they show whenever the rate service is down.
  - When a list gets a button-plus-pop-up for a state (History, Archived), remove that state from the inline list in the same change and update every test that clicked rows of that state in the list.
  - I put a `//` comment mid-line in a one-line function (`open()`) for the third time, and `node --check` caught it. Rule: comments go on their own line above, never at the end of a line that I am inserting into with a script.
  - Removing a control from many templates (Cancel) changes tests that count buttons or their `data-act`s: grep the tests for the selector before and after.
  - A first-run screen changes what every test sees on a bare account (no hero, no charts, no budgets card): list the tests that use a fresh account and give them money/budget (or open dialogs directly) instead of assuming the normal Overview.
  - I added a `//` comment mid-line in a `replace` once more and the file broke; `node --check` right after every script edit is the only reliable guard. Also never `pkill -f` a pattern that appears in my own command line (it killed the shell).
  - Auto-adding data on load (categories) needs a policy for existing accounts: the owner's accounts get only the named essentials, new accounts get the full list.
  - A completion rule written for the test data ("balance of at least 1 USD") fails for real people who enter small test amounts or rename the default item: define "done" as "differs from the untouched default", and test each way of getting there.
  - Read screen recordings of the owner's flow before reasoning about a bug: the video showed my earlier "fix" made the stepper vanish after step 2, while they wanted to finish step 3 and then be congratulated. I had answered a guess about the cause instead of asking what they expected to see at each step.
  - A mandatory first-run flow needs an exit (Skip), or people who never do the last step are stuck.
  - A new validation breaks every older test that did the forbidden thing with convenient data (spending from a 0 balance): give the test account money first, and drain that save from the log.
  - A `<button>` styled as a chip shows the browser's default border while a link chip does not: reset `border` on shared pill classes instead of fixing one screen.
  - Check the schema before assuming a migration: `debt_payments.transaction_id` already existed for loan charges and had no constraint tying it to `kind`, so linking repayments needed no SQL, only the cloud.js mapping.
  - When one action must create two records (payment + expense) decide the single source of truth for display up front (here: the account's expense), and make edit and delete keep the pair in sync.
  - Reordering sections breaks tests that assume neighbours or scroll position (wide-screen height test, donut mouse coordinates): scroll targets into view in tests and look up neighbours by role, not by DOM position.
  - Flag emoji are not drawn on Windows desktop browsers; they are fine for phones. If desktop Windows matters, ship SVG flags instead (CSP allows data: images).
  - After renaming something, grep for every spelling of the old name (lowercase comparisons too): a lowercase `'loan repayment'` lookup survived my rename and created a duplicate category on every repayment, which the database refused. A test that only checks the name of the chosen category cannot see this: assert there is exactly one.
  - Defaults created independently by two clients need deterministic ids, or the second one hits the unique-name constraint and its whole save is thrown away.
  - NEVER write `open(p, 'w').write(open(p).read())` in a script: opening for write truncates the file before it is read. I emptied app.js that way (`node --check` passes on an empty file!). Check file size after every script edit, and rely on git to restore.
  - When every test suddenly fails at the first step with no page error, check that the main script is not empty or half-loaded (`typeof state`).
  - An author `display` rule (`.two { display: grid }`) silently beats the `[hidden]` attribute: a block I "hid" with `hidden` was visible for weeks. Test visibility with `isVisible`, or add `[hidden] { display: none !important }` for such blocks.
  - I wrote `open(p,'w').write(open(p).read())` AGAIN at the end of a script (it did not run only because an earlier step failed first). Never end a script with a no-op rewrite of the file; `cp` a backup first and check `wc -c` afterwards.
  - Visually hidden radio inputs (segmented controls) are not "visible" to Playwright: wait with `{ state: 'attached' }` or click the label.
  - Keep adding to this log; each future session should add at least one line, even if it is "no new mistakes".

## Checklist before you start

1. Read `context.md` and `learning.md`; `git status`; start the dev server.
2. `grep` for any name you are about to add (function, `data-act`, `data-form`, CSS class, i18n key).
3. Make the change with asserted replacements; `node --check`.
4. Add/adjust the e2e test; run the full suite; read the output.
5. Update docs (`context.md`, `regression_scenario.md`, README, `NEXT_STEPS.md`) and `i18n-id.js`.
5b. **Add event tracking** for every new page, button, feature or interaction (`docs/ANALYTICS.md` checklist): `data-act` / `data-form`, a named `Analytics.track` event, an assertion in `tests/e2e/analytics.js`, catalog updated.
6. Look at the screenshot; commit; push (`&&` chain); if a migration is involved, wait for the owner to apply it.
7. **Before you finish the session: append your learnings to the Session log above** and commit it.
- 2026-11-02: Never rewrite app.js with a script that reads and writes the same open file (truncated it to 0 bytes); always `wc -c` after scripted edits. The owner changed the P&L UI direction several times; confirm the final shape before building. Section titles: use "Realized P&L".
- 2026-11-04 (PostHog EU): `const state` in a classic script is not on `window`, so another file must test `typeof state !== 'undefined'`, not `window.state`. posthog-js silently drops events from headless browsers (user-agent filter, `opt_out_useragent_filter`) and a fake-network test then sees nothing: check `before_send` / the bot filter first. Sign-in links carry tokens in `#` and `?`: scrub every URL-like property before sending to a third party. The owner's "integrated in this account" meant a connector; verify tools with ToolSearch instead of assuming nothing is connected. No mistakes in the repo code.
- 2026-11-04 (analytics events): track interactions from fixed code names (`data-act`, an allow-list of `data-*`), never from element text or values; `data-id` holds record ids, so it stays out. A leak test must skip the SDK's own `$` keys and `distinct_id`/`token` (they contain uuids) or it fails on harmless data.
- 2026-11-04 (analytics did not arrive): I verified analytics only against a stubbed `**/ingest/**` route, so a broken Vercel rewrite (trailing slash: `/ingest/:path*` misses `/ingest/e/`) shipped to production and no event ever arrived. After any change that depends on hosting config (rewrites, headers, CSP), probe the REAL deployed URL (curl the exact path and method the client uses) and confirm the data shows up at the destination (PostHog query) before saying it works. Headless browsers are dropped by PostHog's bot filter (`navigator.webdriver`, `userAgentData` brand HeadlessChrome), so a live check needs those overridden.
- 2026-11-04 (paylater sign bug): a filtered view must not invent its own sign convention. The loan view showed `+` for charges (the loan's point of view) while the owner reads every list as money out = minus; a test had even asserted `+Rp 150.000`, so green tests hid the problem. When the owner reports a sign or total "wrong", change the test that encoded the old rule and add a sum check (day total = signed rows) so the two can never disagree.
- 2026-11-04 (repeating debt payments): `recurring_rules.kind` has a DB check constraint (txn/transfer/invest), so a new rule kind needs a migration; storing the new thing inside the existing kind's `spec` jsonb (`spec.debt`) avoided the migration and kept the preview testable on the staging database. Every place that handles `txn` rules (first-entry linking, edit dialog, unit sync, title) must learn the new variant: grep `r.kind === 'txn'` and `sp.wallet_id` before shipping. Screenshots showed the two-span meta line wrapping on cards with an interest rate: check long text on 390 px.
- 2026-11-04 (Figma first, again + file name): I built the repeating-debt-payment feature (cards, Record payment, Settings) before sharing a Figma design, although the Design first rule was already in CLAUDE.md. Before ANY UI code, read CLAUDE.md rules and share the Figma link + screenshot, then wait for the owner's approval of the design. The owner's Figma file is called "Stiver" (not "Stiver design"); key GmKRa3rj8x7WJjANv4ciWS. `figma.root.name` returns "Document", so the title cannot be read from the plugin API.
- 2026-11-03: Node's built-in `fetch` does not use the sandbox proxy (use curl or the browser for network calls from scripts). A `//` comment inserted mid-line in a scripted edit swallowed the rest of the line again; put comments on their own line. For hosted smoke tests wait for the save queue AND the network to settle before reloading, or a still-pending save looks like data loss.
- 2026-11-04 (Figma first): I built the archived-categories feature before designing it. New owner rule: for every UI change, create the design in Figma first, share the link and screenshot, wait for approval, only then write code. Figma file: "Stiver" (key GmKRa3rj8x7WJjANv4ciWS). Figma screenshot URLs cannot be downloaded through the sandbox proxy; use `node.screenshot()` inside `use_figma` to see the result.
