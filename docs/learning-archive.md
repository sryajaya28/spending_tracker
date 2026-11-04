# Learning archive

Older session-log entries moved out of `learning.md` (still valid lessons; search here when a topic comes up).

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

## Moved from learning.md on 2026-11-04

- 2026-11-04 (PostHog EU): `const state` in a classic script is not on `window`, so another file must test `typeof state !== 'undefined'`, not `window.state`. posthog-js silently drops events from headless browsers (user-agent filter, `opt_out_useragent_filter`) and a fake-network test then sees nothing: check `before_send` / the bot filter first. Sign-in links carry tokens in `#` and `?`: scrub every URL-like property before sending to a third party. The owner's "integrated in this account" meant a connector; verify tools with ToolSearch instead of assuming nothing is connected. No mistakes in the repo code.
- 2026-11-04 (analytics events): track interactions from fixed code names (`data-act`, an allow-list of `data-*`), never from element text or values; `data-id` holds record ids, so it stays out. A leak test must skip the SDK's own `$` keys and `distinct_id`/`token` (they contain uuids) or it fails on harmless data.
- 2026-11-04 (analytics did not arrive): I verified analytics only against a stubbed `**/ingest/**` route, so a broken Vercel rewrite (trailing slash: `/ingest/:path*` misses `/ingest/e/`) shipped to production and no event ever arrived. After any change that depends on hosting config (rewrites, headers, CSP), probe the REAL deployed URL (curl the exact path and method the client uses) and confirm the data shows up at the destination (PostHog query) before saying it works. Headless browsers are dropped by PostHog's bot filter (`navigator.webdriver`, `userAgentData` brand HeadlessChrome), so a live check needs those overridden.
- 2026-11-04 (paylater sign bug): a filtered view must not invent its own sign convention. The loan view showed `+` for charges (the loan's point of view) while the owner reads every list as money out = minus; a test had even asserted `+Rp 150.000`, so green tests hid the problem. When the owner reports a sign or total "wrong", change the test that encoded the old rule and add a sum check (day total = signed rows) so the two can never disagree.
- 2026-11-04 (repeating debt payments): `recurring_rules.kind` has a DB check constraint (txn/transfer/invest), so a new rule kind needs a migration; storing the new thing inside the existing kind's `spec` jsonb (`spec.debt`) avoided the migration and kept the preview testable on the staging database. Every place that handles `txn` rules (first-entry linking, edit dialog, unit sync, title) must learn the new variant: grep `r.kind === 'txn'` and `sp.wallet_id` before shipping. Screenshots showed the two-span meta line wrapping on cards with an interest rate: check long text on 390 px.
- 2026-11-04 (Figma first, again + wrong file): I built the repeating-debt-payment feature (cards, Record payment, Settings) before sharing a Figma design, although the Design first rule was already in CLAUDE.md, and then designed it in the OLD Figma file (GmKRa3rj8x7WJjANv4ciWS, called "Stiver design"). The owner's current file is "Stiver" (DnfE4wtwMDGQyOW76MkVRW, pages Mobile, Desktop, Components, Features). The owner's correction "stiver not stiver design" meant a different FILE, not a different name: when a correction names a file, check the file key in CLAUDE.md on the latest `staging` (`git fetch` first) before building anything. The design must include dark-mode and phone-width screens. `figma.root.name` returns "Document", so the title cannot be read from the plugin API.
- 2026-11-04 (Edit debt repeat): `addRule` treats a start date in the future as "the first payment is already booked" (`first_made`), so a rule whose first payment is NOT booked yet (Next payment in the Edit debt form) must be pushed directly. Hidden form fields still submit: a hidden "Monthly payment" box that held a weekly rule's amount became the debt's monthly payment when the rule was removed; decide per field what a hidden value means before saving. Fields hidden with `display:none` cannot be `fill`ed by tests: choose the repeat first, wait with `{ state: 'attached' }` for hidden ones.
