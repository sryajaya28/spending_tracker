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

(Entries before 2026-11-03 are in `docs/learning-archive.md`.)


- 2026-11-04 (PostHog EU): `const state` in a classic script is not on `window`, so another file must test `typeof state !== 'undefined'`, not `window.state`. posthog-js silently drops events from headless browsers (user-agent filter, `opt_out_useragent_filter`) and a fake-network test then sees nothing: check `before_send` / the bot filter first. Sign-in links carry tokens in `#` and `?`: scrub every URL-like property before sending to a third party. The owner's "integrated in this account" meant a connector; verify tools with ToolSearch instead of assuming nothing is connected. No mistakes in the repo code.
- 2026-11-04 (analytics events): track interactions from fixed code names (`data-act`, an allow-list of `data-*`), never from element text or values; `data-id` holds record ids, so it stays out. A leak test must skip the SDK's own `$` keys and `distinct_id`/`token` (they contain uuids) or it fails on harmless data.
- 2026-11-04 (analytics did not arrive): I verified analytics only against a stubbed `**/ingest/**` route, so a broken Vercel rewrite (trailing slash: `/ingest/:path*` misses `/ingest/e/`) shipped to production and no event ever arrived. After any change that depends on hosting config (rewrites, headers, CSP), probe the REAL deployed URL (curl the exact path and method the client uses) and confirm the data shows up at the destination (PostHog query) before saying it works. Headless browsers are dropped by PostHog's bot filter (`navigator.webdriver`, `userAgentData` brand HeadlessChrome), so a live check needs those overridden.
- 2026-11-04 (paylater sign bug): a filtered view must not invent its own sign convention. The loan view showed `+` for charges (the loan's point of view) while the owner reads every list as money out = minus; a test had even asserted `+Rp 150.000`, so green tests hid the problem. When the owner reports a sign or total "wrong", change the test that encoded the old rule and add a sum check (day total = signed rows) so the two can never disagree.
- 2026-11-04 (repeating debt payments): `recurring_rules.kind` has a DB check constraint (txn/transfer/invest), so a new rule kind needs a migration; storing the new thing inside the existing kind's `spec` jsonb (`spec.debt`) avoided the migration and kept the preview testable on the staging database. Every place that handles `txn` rules (first-entry linking, edit dialog, unit sync, title) must learn the new variant: grep `r.kind === 'txn'` and `sp.wallet_id` before shipping. Screenshots showed the two-span meta line wrapping on cards with an interest rate: check long text on 390 px.
- 2026-11-04 (Figma first, again + wrong file): I built the repeating-debt-payment feature (cards, Record payment, Settings) before sharing a Figma design, although the Design first rule was already in CLAUDE.md, and then designed it in the OLD Figma file (GmKRa3rj8x7WJjANv4ciWS, called "Stiver design"). The owner's current file is "Stiver" (DnfE4wtwMDGQyOW76MkVRW, pages Mobile, Desktop, Components, Features). The owner's correction "stiver not stiver design" meant a different FILE, not a different name: when a correction names a file, check the file key in CLAUDE.md on the latest `staging` (`git fetch` first) before building anything. The design must include dark-mode and phone-width screens. `figma.root.name` returns "Document", so the title cannot be read from the plugin API.
- 2026-11-04 (Edit debt repeat): `addRule` treats a start date in the future as "the first payment is already booked" (`first_made`), so a rule whose first payment is NOT booked yet (Next payment in the Edit debt form) must be pushed directly. Hidden form fields still submit: a hidden "Monthly payment" box that held a weekly rule's amount became the debt's monthly payment when the rule was removed; decide per field what a hidden value means before saving. Fields hidden with `display:none` cannot be `fill`ed by tests: choose the repeat first, wait with `{ state: 'attached' }` for hidden ones.
- 2026-11-03: Node's built-in `fetch` does not use the sandbox proxy (use curl or the browser for network calls from scripts). A `//` comment inserted mid-line in a scripted edit swallowed the rest of the line again; put comments on their own line. For hosted smoke tests wait for the save queue AND the network to settle before reloading, or a still-pending save looks like data loss.
- 2026-11-04 (Figma first): I built the archived-categories feature before designing it. New owner rule: for every UI change, create the design in Figma first, share the link and screenshot, wait for approval, only then write code. Figma file: "Stiver" (key GmKRa3rj8x7WJjANv4ciWS). Figma screenshot URLs cannot be downloaded through the sandbox proxy; use `node.screenshot()` inside `use_figma` to see the result.

- 2026-11-04 (Figma import): Figma file uploads (`upload_assets`) POST to `mcp.figma.com`, which the cloud environment blocks by default; add it to Allowed domains. A Starter Figma plan allows only 3 pages, so use sections. Imported SVG frames clip content: turn `clipsContent` off on components (the raised Add button was cut). Crop very tall screens (the 52,000 px all-periods transactions page) instead of importing them whole.
- 2026-11-04 (Developer 1, long session): **Figma first** is now a rule: I built archived categories before designing it and the owner corrected me; design (with dark mode and phone width) is approved before any code, and the file is the owner's "Stiver" Figma file (not a new file per feature). **Roles:** I am Developer 1 (feature branches, report "ready"); Developer 2 is the integrator who merges to `staging` and releases, unless the owner says otherwise for a task. Lessons: (1) a design review changes behaviour rules ("button only when something is archived"): ask for the rules in the request, not after the build; (2) one scripted edit that fails halfway leaves a partial commit: apply edits in one script that checks every anchor first, and re-read the target text before matching (a `sub` on text I had not re-read failed twice); (3) parallel e2e runs exposed a test racing the app's own timer (`recurring`): make tests accept either order, never retry until green; (4) merge conflicts on the service-worker cache number and the changelog happened live when two agents worked: both are now removed as hotspots (stamp at deploy, one change file per change); (5) Figma screenshot URLs and `*.vercel.app` previews are blocked in the sandbox: use `node.screenshot()` inside `use_figma` and the Vercel MCP (`web_fetch_vercel_url`) instead of curl; (6) the permission classifier can fail transiently: retry once, then do read-only work and report; (7) never tell the owner something is done without saying what was and was not verified.
