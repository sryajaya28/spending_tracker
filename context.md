# Stiver: project context

Everything a new person (or a new AI session) needs to continue this project. It describes the project as it stands
on 2026-10-31. It contains **no secrets**: it says where each secret lives, never what it is.

## 0. Working agreement (read this first)

1. **Before doing anything** on this project (code, database, config, docs, answering a question about the project),
   read this file **and `learning.md`** (past mistakes and how to avoid them; add to it whenever you make a mistake or are corrected, and append your learnings to its Session log at the end of every coding session). If it disagrees with the code, trust the code, then fix this file.
2. **After doing anything**, update this file in the same commit: edit the sections that changed (features, data model,
   services, open items, decisions) and add a change file in `docs/changes/` (folded into `docs/CHANGELOG.md` by the integrating agent).
3. **Design lives in Figma** (https://www.figma.com/design/DnfE4wtwMDGQyOW76MkVRW/Stiver), updated per `docs/DEV_WORKFLOW.md` section 0. The old `design/` export is a frozen snapshot and `tools/design/export.js` is deleted.
4. **Also update `README.md`** whenever the change affects what it describes (features, how to run, how it is built,
   deploying, release checklist), and `docs/NEXT_STEPS.md` when priorities or known gaps change.
5. Never put secrets in this file, the README or any committed file: say where a secret lives, never what it is.
6. **Keep `regression_scenario.md` current** (detailed regression scenarios per feature, plus which e2e test covers what): for every new or
   changed feature, add or edit the relevant scenarios in the same commit, and add a line to that file's change log.

7. **Event tracking is a required step of every feature** (new page, button, feature or interaction): add the PostHog tracking, test it in `tests/e2e/analytics.js`, and update the catalog in `docs/ANALYTICS.md` in the same commit (details and privacy rules there).

`CLAUDE.md` at the repo root repeats this rule so assistant sessions load it automatically.

## 1. What this is

Stiver is a personal finance app: record and categorize spending, track budgets, and see net worth across savings,
investments, money lent and loans owed. It started as a Spendee-inspired prototype and is now **live with real
sign-ups** at https://stiver.io. The name was changed from "Spendly" to "Stiver" (the old name still exists in a few
infrastructure names, see section 8).

- Owner: the repo owner `sryajaya28` (GitHub). Based in Indonesia; default reporting currency IDR.
- Stack: a static browser app (plain HTML/CSS/JS, **no build step**) + Supabase (Postgres, Auth, RLS) + Vercel
  (hosting + one small Python function). Next.js was planned but never needed (section 14).

## 2. How the owner works (preferences learned in this project)

- Works from the cloud session only; has no local clone. Every change is committed and pushed to `main`, which
  auto-deploys. Pushing to `main` is explicitly authorized for this project.
- Likes screenshots: after a UI change, send a before/after or "after" preview image (rendered from the local copy with
  sample data) instead of asking them to screenshot. They send screenshots of what they see; they often look at an
  older deployed version, so remind them to refresh.
- Wants honest status: say what was and was not verified. Several things cannot be verified from the cloud sandbox
  (live site, real Google sign-in, real emails): say so and ask them to test.
- Wants step-by-step guidance for dashboard-only tasks (Google Cloud, Supabase, Resend, Search Console, Vercel).
  They paste public values (DNS records, DKIM keys) into chat; never ask them to paste secrets/tokens.
- Small, direct UI requests ("remove this", "make it one row"). Keep layouts compact and phone-friendly.
- Commit messages end with the attribution lines from the session instructions; no model names in repo artifacts.

## 3. Features (current)

- **Landing page** for signed-out visitors (hero with product mock, demo video, feature grid, how it works, final CTA,
  footer with Privacy/Terms), language selector, light/dark toggle. Rendered by the app itself (`viewLanding`).
- **Auth:** email + password with **email confirmation link**, Google sign-in, password reset, resend, "I've confirmed my
  email" button; while the "Check your email" screen is open, it retries sign-in every 15s and on tab focus so
  confirming on a phone continues on the desktop. Auth links return to `SITE_URL` (`https://stiver.io`).
- **Transactions:** the list is grouped **by day** (one row per day: count, income, spent, net); clicking a day opens
  `#/transactions/YYYY-MM-DD` with that day's detailed rows (edit/delete, `+ Add` prefilled with the date). Expense/income with categories + one level of sub-categories, add a category inline from the form,
  AI-style auto-tagging (mock: history match, null when unsure), search/filter, special-occasion tag.
- **USDT/USDC as a wallet for income and expenses:** the Wallet field of the add-transaction dialog also lists stablecoin holdings
  ("Binance (USDT)" under the heading "Investment Account"; for income also "new" USDT/USDC in any investment account, created on save). Income received there raises the coin quantity; an expense paid from it lowers it (refused if you hold less).
  Stored as a holding trade with `kind` income/expense (holding_events.note) linked to a normal income/expense transaction with
  `wallet_id` null, currency USD, 1 coin = 1 USD (amount in cents). It counts in income/spending, budgets, categories and net
  worth (via the holding); it does not touch any wallet balance. Edit changes the trade too; delete reverses it (`removeTrade`).
  Transactions can be filtered by the coin, and recurring rules can use it.
- **Budget period:** Settings > Profile > "Budget period starts on" (day 1-28, saved as `profiles.period_day`). "Month" then means that
  period everywhere: period key `YYYY-MM` is the one that STARTS in that month (start day 25: `2026-10` = 25 Oct to 24 Nov). Month totals, Money
  Flow, budgets, spending donut, occasions, balances/holdings history and the month pickers all follow it (`periodStart/End`, `inPeriod`,
  `periodKeyOf`, `currentPeriod`, `lastMonths`, period-aware `monthLabel`). Budgets keep `start_month` as the first of the period's month.
- **Indonesian stocks (IDX) and commodities:** the asset picker has "Indonesia (IDX)" and "Commodities" dropdown options. Prices come from Yahoo
  Finance's public but **unofficial** endpoints through `tools/dev_server.py` (`/api/assets?type=idx|commodity`, `/api/price?yh=&mult=`; no key;
  `yahoo_price` converts to USD with the existing fx rates, IDX quotes are in IDR). IDX holdings use the key `BBCA.JK` (shown as BBCA), type stock;
  commodities are Gold/Silver per troy oz or per gram (`mult` = 1/31.1035), Platinum, WTI, Brent, natural gas, copper. Stored in
  `holdings.provider_symbol` as `yh:<yahoo symbol>|<multiplier>|<type>` (commodity uses asset_type `manual`; the app restores type `commodity`), so no
  migration. It can break or be blocked from Vercel's IPs; a typed-in price still works. The sandbox cannot reach Yahoo, so it was only tested with stubs.
- **Recurring:** a **Repeat** choice (does not repeat / every week / every month) on new expenses, income, transfers, investment buys and **debt payments** (Record payment on a debt).
  A repeating debt payment can also be set in **Edit debt / Add debt** ("Repeat payment": Does not repeat hides the payment fields and removes the rule; Every month / Every week show Monthly/Weekly payment, Next payment, Paid from and "Installments remaining (Monthly/Weekly)").
  A repeating debt payment is a normal `txn` rule with `spec.debt` = the debt id (+ `wallet_id` of the paying account, or '' for none; no migration): when due, `debtPaymentDue` adds the debt's payment (and the Debt Payment expense when an account was chosen), ids derived from rule + date.
   A rule is saved (`recurring_rules`); due entries are created **when the app opens or the tab returns to the front**
  (no server job), dated on their due day, with ids derived from rule+date so two devices never double-add. Settings > Recurring
  lists rules with Pause/Resume (skips what was missed) and delete (past entries stay). Monthly keeps the day-of-month, clamped to short months.
- **Budgets:** overall + per-category monthly budgets; Overview shows only the overall budget bar (tap the card for the Budgets page); **special
  occasions** (one-off budgets with optional dates, tagged expenses, archive/delete).
- **Portfolio** tabs: Savings (accounts, called wallets in the code, in any currency, compact cards with a ⋯ menu, archive/restore/delete, edit
  name/type/current balance, **transfers between wallets** with optional fee and cross-currency received amount),
  Investment (accounts, holdings, buy/sell with a wallet or USDT/USDC counterpart, live prices via Finnhub),
  Lent, Loan (payments reduce balance).
- **Net worth** with month-over-month change; preferred-currency dropdown (IDR, USD, EUR, GBP, SGD, AUD, JPY).
- **Hide balance** (2026-11-11): the eye button on the Overview "Total Balance" and Portfolio "Net worth" cards is one switch (`hideBal()`/`setHideBal()` in `util.js`, `data-act="toggle-hide-balance"`, event `balance_visibility_changed`), remembered per device in localStorage `stiver.hidebal.v1` (not synced, no database change). While on, `moneyP()`/`moneyHtmlP()` print `Rp ••••••••` for both totals, Breakdown amounts, tab totals, account/debt/lent/holding balances, P&L, history and chart values; the % pill and "this month" line go. Transactions, budgets and spending are never masked. "Total Balance" has a thin dotted underline and opens its tooltip (no (i)); the hero pill (`deltaPill()`) is red when negative, green when positive. Test `hidebal`.
- **Dropdowns:** every `<select>` opens an app-styled popover list (`prototype/dropdown.js`, `.cs-pop`) instead of the OS picker. The native select stays
  as the visible field and value holder (so forms, `change` handlers and tests are unchanged) but gets `pointer-events: none`; the script finds the select under the
  tap, builds the list (optgroups as headings), writes the value and dispatches `input` + `change`. Add `data-native` to a select to keep the OS picker.
- **Language:** English and Bahasa Indonesia (about 510 strings). **Appearance:** match device / light / dark.
  Both saved to the profile and remembered per device.
- **Sample data** is a demo mode (switch in Settings, and a card on Overview for empty accounts): a seeded demo account lives only in memory, saves are disabled,
  a banner explains it, and turning it off restores the user's own data.
- Legal pages: `prototype/privacy.html`, `prototype/terms.html`. Brand files in `prototype/brand/`.

## 4. Architecture

```
Browser (prototype/*)  ──HTTPS──►  Vercel (static files + api/index.py)
   │  supabase-js (vendored)             │  /api/status, /api/fx, /api/assets, /api/price  → Finnhub / Frankfurter
   ▼                                     ▼
Supabase (Auth + PostgREST + Postgres, RLS on every table)        Resend (SMTP for auth emails, domain stiver.io)
```

- **Static app, no build.** Scripts load in this order (see `prototype/index.html`): `vendor/supabase.js`, `config.js`,
  `cloud.js`, `i18n.js`, `i18n-id.js`, then the files in `prototype/app/` and last `app.js` (the split of the old single `app.js` is in progress; map in `docs/MAP.md`). CSP forbids inline scripts and external scripts (except Cloudflare
  Turnstile), so everything is a file.
- **State:** one in-memory object `state.data` (profile, categories, wallets, transactions, budgets, occasions,
  investments, holdings, loans, lent, customAssets, livePrices). The UI renders from it with template strings
  (`render()` rebuilds `#app`; delegated click/change/input/submit handlers at the bottom of `app.js`).
- **Saving is diff-based** (`cloud.js`): `rowsFromData` maps the app object to DB rows; `diff` compares with the last
  server snapshot; `apply` upserts changed rows (in dependency order), updates the profile, then deletes. `save()`
  just queues it (serialized). If a save fails, `onSaveError` reloads the server state. Loading is `dataFromRows`
  (inverse mapping). When adding a field: update both mappings, the migration, and the tests.
- **Demo mode:** `setDemo(true)` swaps `state.data` for `seed()` output and sets `state.real`; `save()` returns early
  while `state.real` is set. Remembered in localStorage (`stiver.demo.v1`).
- **i18n:** `__('English text', {vars})`; English text is the key; `{name}` placeholders; missing keys fall back to
  English. `DICT.id` in `i18n-id.js`. Wrappers (`toast`, `topbar`, nav links, `tabBtn`, `authLink`, `viewSplash`, `row`)
  translate their static arguments. Stored data (wallet/category names, notes) is never translated.
  `Intl` formatting uses the language's locale (`Rp 1.500.000`, `Oktober 2026`).
- **Theme:** CSS variables on `:root`; `:root[data-theme="dark"]` overrides. `applyTheme()` in `i18n.js` sets
  `data-theme` (and the `theme-color` meta). Charts use `var(--line)/var(--muted)` via `style=`.
- **Money:** integer minor units + currency. Decimals come from a fixed table (`ZERO_DECIMAL` in `app.js`: IDR, JPY,
  KRW, VND, ...), **not** from `Intl` (an iPhone reported 2 decimals for IDR and showed values 100x too small).
- **Hosted API:** `api/index.py` is a Vercel function that imports `tools/dev_server.py`'s handler and patches the cache
  path to `/tmp`. It reads `FINNHUB_API_KEY` from the environment and never exposes it.
- **Service worker** (`sw.js`): network-first shell cache; bump `CACHE` when adding shell files.

## 5. Repo map

```
prototype/          the app: index.html, app.js (views, dialogs, events; being split, see docs/MAP.md) and app/ (utils, state, selectors, calculations, loaded before app.js), dropdown.js (custom select lists), cloud.js (auth + sync), config.js (public config),
                    i18n.js, i18n-id.js, styles.css, sw.js, manifest, icon.svg, privacy.html, terms.html, legal.js,
                    brand/ (logo svg/png 120+512), media/ (demo video mp4+webm, poster), vendor/supabase.js (v2.45.4)
api/index.py        Vercel function for /api/* (Finnhub proxy, FX)
tools/              dev_server.py (local server + same API), build_email_templates.py
supabase/migrations/  16 SQL files (see section 6)        supabase/templates/  6 auth email templates + README
supabase/tests/     pgTAP tests (first migrations only)
tests/e2e/          Playwright browser tests with a fake Supabase; run_all.sh; record_demo_tour.js
docs/NEXT_STEPS.md  roadmap, rules, known gaps            vercel.json  hosting, rewrites, security headers
regression_scenario.md  manual regression scenarios per feature + automated coverage map (keep current)
tools/release_contents.js, docs/RELEASES.md  exact release contents (never a summary)
docs/WORKSPACE.md  Workspace artifact: shared feed + Needs-you tray (URL, schema, rules)
docs/WORKFLOW.md  agent-to-agent workflow, diagram, hand-off formats
docs/roles/, docs/PRD_TEMPLATE.md  agent team (PM, Designer, QA, developers): flow, hand-offs, registry
tools/regression.js, release.js, gates.js  one-command regression and release; docs/tooling-only diffs skip regression and the prod smoke test
tools/ship.js        after the owner's "Release": waits for the merge and the new build stamp, checks the site, runs the prod smoke test when the tier needs it, writes the record into docs/RELEASES.md (tools/ship.test.js, offline)
tests/test_yahoo.py  python check of the Yahoo price source (stubbed)
.env.example        FINNHUB_API_KEY=                      .claude/launch.json  dev server config
```

## 6. Data model (Supabase, schema `public`)

All user tables have `user_id uuid default auth.uid()` and RLS policies `user_id = auth.uid()`; `anon` has no access.
Composite foreign keys `(id, user_id)` stop rows referencing another user's rows.

| Table | Notes |
|---|---|
| `profiles` | `id = auth.users.id`, `display_name`, `default_currency`, `ai_tagging_enabled`, `sample_ids` (legacy), `language`, `theme`, `period_day` (1-28) |
| `wallets` | `type` cash/bank/ewallet/card, `currency`, `opening_balance_minor`, `archived`, `since_month` |
| `categories` | one level of `parent_id`, `type` expense/income, emoji `icon`, `color`, unique sibling names |
| `transactions` | `wallet_id` is null for USDT/USDC income/expense (then `holding_event_id` is set; check `transactions_source_chk`), `type` expense/income/transfer, `amount_minor`, `currency`, `occurred_at`, `category_source` user/ai/rule, `transfer_direction` in/out, `holding_event_id`, `occasion_id`, `transfer_group_id` |
| `budgets` | `category_id` null = global, `start_month` (first of month), unique per scope+month |
| `occasions` | name, `amount_minor` (null = no budget, migration 21), `currency`, optional `start_date`/`end_date`, `archived` |
| `debt_payments` / `transactions.debt_id` | (migration 20) `debt_payments.kind` 'payment'\|'charge' and `transaction_id` (a charge raises the loan and points at its expense); `transactions.debt_id` = the loan an expense was paid with (wallet_id null) |
| `support_reports` | bug reports / feedback (migration 19): `type` 'bug'\|'feedback', `message` (<= 250 chars), `attachments` text[] (<= 5 storage paths), `user_id`/`email` set by trigger, `context` jsonb, `status`; private bucket `support-attachments` (1 MB, images) |
| `auth_handoffs` | one-time session handoff codes (migration 18); no RLS policies, reachable only through `create_handoff` / `claim_handoff` |
| `investment_accounts`, `holdings`, `holding_events` | holdings keyed by symbol (`AAPL.US` when a stock shares a symbol with a crypto); events carry `quantity_delta` and `pair_id` for stablecoin pairs; opening event has `note='opening'`; `since_month`; **cost basis (migration 17):** `holdings.cost_currency` (the currency prices are quoted in, `h.ccy`), `holding_events.unit_price` (price per unit of a trade, `tr.price`; on the opening event it is the starting average price, `h.open_price`) |
| `manual_prices` | user-entered USD prices for custom assets |
| `price_snapshots`, `fx_rates` | shared market data, read-only for users (written by a future server job) |
| `recurring_rules` | `kind` txn/transfer/invest, `frequency` weekly/monthly, `start_date`, `next_date`, `end_date`, `active`, `spec` jsonb (what to create) |
| `debts`, `debt_payments` | `direction` owed/lent, `type`, `monthly_minor`, `interest_rate`, `due_date`, `note`, `start_month` |

Views: `wallet_balances`, `debt_balances`. Functions: `spending_by_category`, `budget_status`, `portfolio_history`
(the app currently computes these client-side). Trigger `handle_new_user` seeds on sign-up: profile (name, currency
from `options.data`), a **Cash** wallet, 12 default categories with emoji icons and 11 sub-categories.

Migrations (repo file names; applied through the Supabase tools with different recorded version numbers):
1 schema, 2 RLS, 3 signup seed, 4 views+functions, 5 portfolio, 6 debts, 7 trades, 8 app seed + `holdings.since_month`,
9 occasions, 10 `wallets.since_month`, 11 transfer groups, 12 `profiles.sample_ids`, 13 profile language/theme, 14 `recurring_rules`, 15 nullable `transactions.wallet_id` for coin income/expense 16 `profiles.period_day`, 21 optional occasion budget (14, 15 and 16 applied to the live project).

## 6b. Household (several people on one set of books; RELEASED in Release 15, 2026-11-05, main 52b656e; migrations 24-31 and 6 Edge Functions are on production)

- **Model:** one data owner per household; every row keeps `user_id = owner`, RLS reads `household_owner()` and writes need `is_writer()` (migrations 24-30, applied to STAGING only; production is applied by the Tech-Lead at release). New columns on the money tables: `created_by`, `updated_by`, `rev`; `household_members`, `household_invites` (token hash only), `household_state(rev)`, `household_former_members`. Roles: owner, editor, viewer. Editors change only their own transactions and transfers (others read-only), but may add/edit/delete accounts, debts, lent, investments, budgets, categories, occasions and recurring rules. Generated recurring rows belong to the rule's creator.
- **Server:** RPCs `household_people` (names and emails), `household_profile`, `set_member_role`, `remove_member`, `leave_household`; delete guards raise `42501 household_guard:<kind>:<n>`; stale edits raise `PT409 household_stale` (HTTP 409; SQLSTATE 40001 is retried by PostgREST and ends in a 504, so never use it). Edge Functions on staging: `invite-member`, `manage-invite`, `delete-my-login` (JWT required), `join-household`, `signup-gate`, `invite-sweep` (public); see `supabase/functions/DEPLOY.md`.
- **Client:** `prototype/cloud.js` household layer (status load, strict insert/update/delete with `rev` only when the household has members, 30 s poll, `Cloud.classify()` error contract); `app.js`: Settings > Household card, invite/role/remove/leave dialogs, `/join#t=` page (token only in memory), no-access page, Viewer write guard (`WRITE_ACT`), who-submitted labels and "Added by / Edited by", named delete confirmations, guard messages that name the item (`hhLastDel`), "Your access changed" toast. Sign-up now goes through `signup-gate` (same answer for fresh, existing and invited addresses; the sent screen says to use the invite email). A Viewer's app never generates recurring entries.
- **Tests:** e2e `household_join`, `household_labels`, the household block in `analytics`; SQL `bash tools/sql_local_test.sh` (local PostgreSQL 16 + pgTAP shim). Slice 2: migration 31 `activity_log` (AFTER row triggers on the 11 money tables write add/edit/delete rows only for households with members, no-op saves skipped, summary = name, amount, currency, type, was_amount, balance/was_balance; RLS select for every member, no client writes; `purge_household_activity()` 180 days via the invite-sweep function). Client: `#/activity` (`viewActivity`, `Cloud.activity()` latest 300 rows, person and type filters in the client), entry row in the Household card, event `activity_opened`. e2e `household_activity`; SQL `household_activity.test.sql` (13).

## 6c. Money lent comes out of an account (2026-11-06)
Adding money lent needs a "From account" (savings accounts, not cards): one transfer-out transaction (category Lent, created on first use like Lent Repayment) leaves that account and is linked to the lent record by `lent.txn_id` (`debts.lent_transaction_id`, migration 32, no foreign key). The currency follows the account; the same low-balance rule as loan payments; edits keep the transaction in step; older records have no link and no transaction. In Transactions the row is a transfer out with a Lent chip and opens a read-only detail ("Managed from Money lent"); repayment rows now read "Transfer in" with the Lent Repayment chip. The principal cannot be set below the repayments already recorded or scheduled. `lentUSD` counts a loan from its transfer's exact date. Migration 33 (`lent_link_guard` trigger on `debts`): an Editor cannot change the amount, currency, name or link of someone else's linked lent record (only due date, note, archive). There is no delete action for a lent record today (only Archive, which keeps the transaction). Tests: e2e `lent`, SQL `household_lent.test.sql`. Release order: migration 32 on the database BEFORE the client, because the client sends the new column.

## 7. Business rules the code encodes

- Entries dated after today do not change balances, holdings or net worth until their date arrives.

- Transfers (wallet to wallet, buying/selling assets) are not income or spending; **a transfer fee is spending**.
  A wallet transfer is stored as linked transactions sharing `transfer_group_id`: out leg, in leg (own currency), fee.
- Occasion expenses still count in monthly budgets. Budgets apply from `start_month` until replaced.
- Wallet history: a wallet counts only from `since_month` (its opening balance and transactions are excluded earlier).
- Loan/lent payments are not spending/income. Net worth = savings + investments + lent - loans.
- Stablecoin counterpart trades create paired `holding_events` (no wallet transfer).
- Deleting a holding unlinks its wallet transfers first (they stay as plain transfers).

## 8. Services, accounts and identifiers (no secrets)

| Service | Identifier / state |
|---|---|
| GitHub | `sryajaya28/spending_tracker`; `main` is production; the session branch `claude/eager-goodall-8cth8z` is pushed in parallel |
| Vercel | project `spending_tracker` (`prj_r2PLF6bURYUcWuhJJdRfWhkWuan6`), team `team_nAtEdryAgGPuTiRN0i3TAPUv` (`suryajaya378-4429s-projects`), Hobby plan; Git-connected; every push builds; production env var `FINNHUB_API_KEY` (sensitive) is the only secret |
| Domain `stiver.io` | nameservers at Vercel DNS. Records: A to Vercel, Resend DKIM TXT (`resend._domainkey`), CNAMEs `rsend` and `send` (Resend), Google Search Console verification TXT at the root |
| Supabase | project `spending_tracker`, ref `ukoxkwxmkwtlihbutryc`, region eu-west-1, Free plan. An older paused project "sryajaya28's Project" exists and is unused |
| Supabase (staging) | project `spending_tracker_staging` (the restored old project), ref `cujmgyacxbcmltxfjkxo`, region ap-southeast-1. All 23 migrations applied 2026-11-03; schema compared with production (tables, columns, constraints, indexes, policies, enums, triggers identical; only the platform's own `rls_auto_enable` function differs). Auth settings (URLs, Google, email) not set yet; no real data |
| Resend | domain `stiver.io` verified; used as custom SMTP in Supabase (user `resend`, the API key lives only in Supabase) |
| Google Cloud | project id `resounding-sled-474109-i3`; Auth Platform: app "Stiver", **published to production**; Search Console TXT added, branding re-verification pending (up to 24h); logo to upload: `prototype/brand/stiver-logo-120.png`; Supabase callback is the redirect URI |
| Finnhub | free plan (personal use only); stock/ETF/crypto lists and quotes; key in Vercel env and `.env.local` |
| Frankfurter / open.er-api | free FX rates (no key), proxied via `/api/fx` |
| Cloudflare Turnstile | **not set up yet**; code is dormant until `TURNSTILE_SITE_KEY` is set |
| PostHog | **Cloud EU** (Frankfurt, matches the production Supabase region), project "Default project" id 334082, host `eu.i.posthog.com`. The public project token is `POSTHOG_KEY` in `prototype/config.js`; production, staging and previews share it and are told apart by the event property `env`. Browser traffic goes through our own `/ingest` rewrite in `vercel.json`. The PostHog connector (MCP) is attached to the owner's Claude account for reading data. Dashboard **"Stiver key flows"** (id 1083794, https://eu.posthog.com/project/334082/dashboard/1083794; filter `env = production`, last 30 days): sign-up funnel, activation funnel, daily active users, mobile vs desktop, transactions per day, feature adoption, most clicked buttons, page views by page, weekly retention. Built in PostHog (not in the repo); tiles stay empty until production sends events |

Old names: the Vercel project, repo and Supabase project are still called `spending_tracker`; Vercel also keeps the
aliases `spendingtracker-three.vercel.app` and `spendingtracker-suryajaya378-4429s-projects.vercel.app`.
Google's "Authorized domains" must contain `stiver.io` and the full `ukoxkwxmkwtlihbutryc.supabase.co` (not `supabase.co`,
which is a public suffix and is rejected).

## 9. Configuration and secrets

- `prototype/config.js` (committed, public): Supabase URL, publishable anon key, `TURNSTILE_SITE_KEY` (empty),
  `SITE_URL` (`https://stiver.io`), `CONTACT_EMAIL` (empty).
- Secrets and where they live: `FINNHUB_API_KEY` (Vercel env, local `.env.local`, gitignored), Resend API key (Supabase
  SMTP settings), Google OAuth client secret (Supabase Google provider), future Turnstile secret (Supabase). None are in
  the repo and none should ever be pasted in chat. The Supabase `service_role` key is not used anywhere.
- `.env.local` is gitignored; `.env.example` only lists names.

## 10. Auth and email setup (state at time of writing)

- Sign-up passes `options.data = { full_name, currency }`; Google users get currency USD by default.
- Supabase Auth settings are managed in the dashboard (the tools available to the assistant cannot change them):
  Confirm email on, Google on, URL configuration (Site URL `https://stiver.io`; redirect URLs should include
  `https://stiver.io/**`, the vercel.app aliases and `http://localhost:5173/**`), custom SMTP (sender on `stiver.io`),
  email templates pasted from `supabase/templates/` (subjects in that folder's README). Treat the exact dashboard
  state as user-managed and verify it when debugging.
- Email confirmation links go to `redirect_to` = `SITE_URL` (when the page is on a `*.vercel.app` host) else the current origin.
- The built-in Supabase mailer is rate-limited and was replaced with Resend after the first tests.

## 11. Security posture

- RLS on every table; revoke from `anon`; composite FKs for same-user references.
- `vercel.json` sets a strict CSP (self + Supabase + Turnstile), nosniff, referrer policy, permissions policy, HSTS.
- Passwords are hashed by Supabase Auth (bcrypt). Sessions are Supabase JWT + refresh tokens in localStorage.
- Not done yet: cross-user RLS test, CAPTCHA enabled, server-side minimum password length 8, 2FA on the owner's accounts.
- Advisor note: `public.rls_auto_enable()` is callable by anon/authenticated (not created by this repo).
- The e2e tests used a rolled-back transaction with a fake user to validate SQL shapes against the real schema.

## 12. Deployment and workflow

**Risk-tiered workflow (owner, 2026-11-05):** changes take Tier 1 (presentation only), Tier 2 (standard) or Tier 3 (full); the minimum tier comes from the files touched and agents can only raise it. See `docs/workflows/README.md` and `TIER_1-3.md`, AGENTS.md rule 17. CI automation is still to build (`docs/NEXT_STEPS.md` item 0).

Agents: **Tech-Lead is the integrator** (merges into `staging`, folds `docs/changes/` into the changelog, releases); **Full-stack engineer** works on feature branches and reports "ready" (owner, 2026-11-04; see `docs/AGENTS.md`).

1. Edit files, run `bash tests/e2e/run_all.sh`, commit, `git push origin HEAD:main` (and the session branch).
2. Vercel builds in seconds. Check with the Vercel tools (`list_deployments`) when available.
3. DB changes: write `supabase/migrations/2026103100000N_name.sql`, apply it with the Supabase `apply_migration` tool,
   keep the file in the repo. Never edit applied migrations.
4. Email templates: edit `tools/build_email_templates.py`, run it, paste into Supabase (manual).
5. Demo video: start the dev server, run `node tests/e2e/record_demo_tour.js` (records a scripted tour of the sample-data app), then
   `bash tests/e2e/encode_demo.sh` (needs ffmpeg) to trim, speed up 1.25x and encode `prototype/media/demo.mp4/.webm` + `demo-poster.jpg`.

## 13. Testing and tools

- `tests/e2e/` (Playwright, fake Supabase in `fake_supabase.js`): `run_all.sh` starts the dev server and runs ~17 tests.
  The fake seeds a new user like the signup trigger (12 categories + 11 sub-categories + Cash wallet).
- Workflow tools: `node tools/affected_tests.js` (which tests a change needs; rules in `tests/e2e/affects.json`; `--verify` checks them against history), `node tools/trim_learnings.js` (moves old `learning.md` log entries to `docs/learning-archive.md`), `node tools/doc_budget.js` (size budget for the always-read files), `node tools/fold_changes.js`, `node tools/staging_shot.js`; Figma: `docs/FIGMA.md` with `tools/figma/helpers.js` (component and variable helpers, section starter) and `tools/figma/lint.js` (checks every Feature section).
- Many screens were verified only through these tests and screenshots, never on the real live site (the cloud sandbox
  cannot reach stiver.io, Supabase Auth or Google). Ask the owner to confirm real-world flows.
- Useful one-offs: Supabase `query_logs` (`auth_logs`) shows email sends/errors; `execute_sql` inside `begin; ... rollback;`
  validates SQL safely; `idcrawl.js` finds untranslated text in Indonesian.

## 14. Decisions and lessons (read before changing things)

- **No Next.js (yet).** Plain static files were enough and kept the repo deployable by pushing. Revisit when `app.js` is unwieldy.
- **Diff-based sync** keeps the ~40 `save()` call sites unchanged. Upserts run before deletes: never replace a row that
  shares a unique key (budget per category+month, sibling category names) by delete+insert in one save; update in place.
- **Sample data became demo mode** after the first design (writing demo rows into the account, then removing them) proved
  clumsy. `profiles.sample_ids` remains only to clean up rows an older version saved.
- **Fixed decimals table** instead of `Intl` (iPhone/Chrome disagree on IDR).
- **`since` months** on wallets, holdings and debts stop later-added money from rewriting history.
- **Landing page lives in the app** (not a separate page) so the sign-in flow, OAuth return and language/theme share state.
- **CSP forbids inline scripts**; the theme is applied from `i18n.js` right after load (no flash for most users).
- **Auth emails** can only be one language; the app UI is bilingual.
- Cross-device email confirmation: the original tab polls sign-in using the password kept in memory only; with CAPTCHA on, only the manual button works.
- The Playwright video cannot show a cursor; `record_demo_tour.js` injects a fake one.

## 15. Timeline (short)

Files flattened by a web upload → restructured into `prototype/ tools/ supabase/ docs/` → Vercel API function →
Supabase auth + diff-based sync → occasions, transfers, wallet editing/archiving → Google sign-in published → Resend email +
custom domain → CSP + dormant CAPTCHA → email templates → demo mode → landing page + demo video → privacy/terms →
language (EN/ID) → dark mode → docs and this file.

## 16. Open items and next ideas

See `docs/NEXT_STEPS.md` for the prioritized list. Owner-only tasks: finish Google branding re-verification and upload
the logo; choose the contact email; create the Turnstile widget; Supabase password minimum + 2FA everywhere; decide on
the Finnhub plan and paid plans before a public launch; consider a staging project. Assistant tasks when asked: cross-user
RLS test, staging setup, Turnstile wiring (site key into `config.js`), README/context upkeep, auto-translating default
category names, SQL tests for newer tables.

## 17. Quick commands

```bash
python3 tools/dev_server.py 5173            # run locally (http://localhost:5173)
bash tests/e2e/run_all.sh [name]            # browser tests
python3 tools/build_email_templates.py      # regenerate email templates
git push origin HEAD:main                   # deploy (Vercel builds on push)
```

## 18. Changelog

The changelog lives in **`docs/CHANGELOG.md`** (newest first, one dated line per change). Add new entries there, at the top, not here.
