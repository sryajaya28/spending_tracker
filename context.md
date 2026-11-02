# Stiver: project context

Everything a new person (or a new AI session) needs to continue this project. It describes the project as it stands
on 2026-10-31. It contains **no secrets**: it says where each secret lives, never what it is.

## 0. Working agreement (read this first)

1. **Before doing anything** on this project (code, database, config, docs, answering a question about the project),
   read this file **and `learning.md`** (past mistakes and how to avoid them; add to it whenever you make a mistake or are corrected, and append your learnings to its Session log at the end of every coding session). If it disagrees with the code, trust the code, then fix this file.
2. **After doing anything**, update this file in the same commit: edit the sections that changed (features, data model,
   services, open items, decisions) and add a dated line to the **Changelog** at the bottom.
3. **After a UI change, regenerate the design files** (`node tools/design/export.js`, see `design/README.md`) and commit them.
4. **Also update `README.md`** whenever the change affects what it describes (features, how to run, how it is built,
   deploying, release checklist), and `docs/NEXT_STEPS.md` when priorities or known gaps change.
5. Never put secrets in this file, the README or any committed file: say where a secret lives, never what it is.
6. **Keep `regression_scenario.md` current** (detailed regression scenarios per feature, plus which e2e test covers what): for every new or
   changed feature, add or edit the relevant scenarios in the same commit, and add a line to that file's change log.

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
- **Recurring:** a **Repeat** choice (does not repeat / every week / every month) on new expenses, income, transfers and
  investment buys. A rule is saved (`recurring_rules`); due entries are created **when the app opens or the tab returns to the front**
  (no server job), dated on their due day, with ids derived from rule+date so two devices never double-add. Settings > Recurring
  lists rules with Pause/Resume (skips what was missed) and delete (past entries stay). Monthly keeps the day-of-month, clamped to short months.
- **Budgets:** overall + per-category monthly budgets; Overview shows only the overall budget bar (tap the card for the Budgets page); **special
  occasions** (one-off budgets with optional dates, tagged expenses, archive/delete).
- **Portfolio** tabs: Savings (accounts, called wallets in the code, in any currency, compact cards with a ⋯ menu, archive/restore/delete, edit
  name/type/current balance, **transfers between wallets** with optional fee and cross-currency received amount),
  Investment (accounts, holdings, buy/sell with a wallet or USDT/USDC counterpart, live prices via Finnhub),
  Lent, Loan (payments reduce balance).
- **Net worth** with month-over-month change; preferred-currency dropdown (IDR, USD, EUR, GBP, SGD, AUD, JPY).
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
  `cloud.js`, `i18n.js`, `i18n-id.js`, `app.js`. CSP forbids inline scripts and external scripts (except Cloudflare
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
prototype/          the app: index.html, app.js (UI, ~1.7k lines), dropdown.js (custom select lists), cloud.js (auth + sync), config.js (public config),
                    i18n.js, i18n-id.js, styles.css, sw.js, manifest, icon.svg, privacy.html, terms.html, legal.js,
                    brand/ (logo svg/png 120+512), media/ (demo video mp4+webm, poster), vendor/supabase.js (v2.45.4)
api/index.py        Vercel function for /api/* (Finnhub proxy, FX)
tools/              dev_server.py (local server + same API), build_email_templates.py
supabase/migrations/  16 SQL files (see section 6)        supabase/templates/  6 auth email templates + README
supabase/tests/     pgTAP tests (first migrations only)
tests/e2e/          Playwright browser tests with a fake Supabase; run_all.sh; record_demo_tour.js
docs/NEXT_STEPS.md  roadmap, rules, known gaps            vercel.json  hosting, rewrites, security headers
regression_scenario.md  manual regression scenarios per feature + automated coverage map (keep current)
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
| Resend | domain `stiver.io` verified; used as custom SMTP in Supabase (user `resend`, the API key lives only in Supabase) |
| Google Cloud | project id `resounding-sled-474109-i3`; Auth Platform: app "Stiver", **published to production**; Search Console TXT added, branding re-verification pending (up to 24h); logo to upload: `prototype/brand/stiver-logo-120.png`; Supabase callback is the redirect URI |
| Finnhub | free plan (personal use only); stock/ETF/crypto lists and quotes; key in Vercel env and `.env.local` |
| Frankfurter / open.er-api | free FX rates (no key), proxied via `/api/fx` |
| Cloudflare Turnstile | **not set up yet**; code is dormant until `TURNSTILE_SITE_KEY` is set |

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

Newest first. One line per change; keep it short and dated.

- 2026-11-02: Budgets > Special occasions now also lists occasions that **have not ended yet** (upcoming or ongoing), whichever period is open, so a budget set for a trip in December is visible in November (`occasionInMonth`: dates overlap the period, or not ended yet, or has expenses in the period; undated always). Ended occasions still show only in their own periods (or when archived, under Past occasions). SW cache `stiver-shell-v15`.
- 2026-11-02: **Special occasions can have no budget** (migration `20261101000021_occasion_optional_budget.sql`: `occasions.amount_minor` nullable, null = no budget, still > 0 when set). Settings has a new **Special occasions** card (`occasionsCard`, `#occasions-card`) listing every occasion (dates, budget or "No budget", number of expenses, Archived badge) with + Add and Edit; the dialog's budget is optional there. Budgets > Special occasions lists only occasions with a budget; its **+ Add** (`add-occasion-budget`, `occasionDialog(null, true)`) offers the pre-added occasions without a budget in an **Occasion** picker (+ New occasion for a brand-new one; picking an existing one asks only for the budget) so an occasion made from Budgets also shows in Settings. Clearing the budget in Edit keeps the occasion (Settings only). Tagging expenses works for every occasion. `occasionStatus` returns `hasBudget`. `tests/e2e/occnobudget.js`. SW cache `stiver-shell-v14`. **Hold `main` until the migration is applied** (cloud.js now writes null budgets). Design export adds `dialog-occasion-budget` and `rows/occasion-settings`.
- 2026-11-02: The Overview **Spending donut has a legend** under it (`.donut-legend` in `halfDonut`): the same top 5 categories plus Others, in the arcs' order and colours, with each category's icon, centred and wrapping. SW cache `stiver-shell-v13`. The design component `graphs/spending-donut` now includes the card, so the legend is part of it.
- 2026-11-02: **Editing a recurring rule (Manage) always updates its upcoming first entry** (account, amount, category, date). The entry is found by `spec.first_tx` or, for rules made before that link existed, by the same note and type among upcoming entries not linked to another rule (`firstEntryOf`, `syncFirstEntry`). `linkFirstEntries()` (run at the start of `runRecurring`, i.e. on load and when the app is reopened) repairs such unlinked entries once: it links them and makes them match their rule, so an entry left on the old account/date no longer sits next to the rule, and the rule no longer adds a second entry when its date arrives. Rules paid from investment or loan accounts are not touched.
- 2026-11-01: **Faster start, no black screen on iPhone**: `index.html` lists `apple-touch-startup-image` launch images for every iPhone size (`prototype/splash/iphone-<w>x<h>.png`, the splash without animation, made by `tools/design/startup_images.js`, which also rewrites the links between `<!--startup-->` marks); the splash markup is in `index.html` itself so it shows before the scripts load; all scripts load with `defer`. SW cache `stiver-shell-v12`. Fiat cash quantities use the currency's own separators (`fiatOf`, `nativeLocale`): "46.600.561 IDR".
- 2026-11-01: Quantities of **fiat cash** in investment accounts (holding row, asset dialog, cash source list, trade history, toasts) show at most 2 decimals (`qtyFmt(q, of)` with `of` = true, a holding or a symbol; `isFiatQty`); crypto, stablecoins and stocks keep up to 8. Fixes "46,600,560.99999999 IDR".
- 2026-11-01: Transactions on the **same date are ordered latest entered first** everywhere (Recent transactions, Transactions days, day page): the client keeps `created_at` (read from the database column, which defaults to `now()` on insert and is never sent by the client; new entries are stamped locally) and `sortTxns()` / `byRecent` sorts by date then `created_at`; `save()` sorts. No migration. The e2e fake sets `created_at` on insert like the database.
- 2026-11-01: The category icon row (`.icon-picks`) shows only while the icon field is focused (`.open` on `focusin`, removed on `focusout` unless focus moves into the row); tapping an icon keeps the focus on the field (`pointerdown` `preventDefault`). SW cache `stiver-shell-v11`.
- 2026-11-01: (1) **Category icon field** (quick add in the transaction form and the category dialog): holds the icon as a real value (🏷️ by default, was only a placeholder that could not be deleted), selects it on focus so typing replaces it, keeps only the last emoji typed (`lastEmoji`, no `maxlength`, which blocked some emoji), and offers a row of 20 common icons to tap (`iconField`, `iconPicks`, act `pick-icon`, `.icon-picks`). (2) **See upcoming transactions** is now a plain centred text link like Reset filters. (3) **Date fields** show the date as "2 Nov 2026" on every browser: `datepicker.js` wraps each date input (`.dp-wrap`), hides the OS text and draws `.dp-text` over it, updating on input/change and on `value` set from code (instance setter); text vertically centred (iOS put it at the top). SW cache `stiver-shell-v10`. Design export adds `form-fields/icon-picker` and `form-fields/quick-add-category`.
- 2026-11-01: Transactions: when the period has upcoming (future-dated) entries matching the filters, a **See upcoming transactions (n)** button under the list (`.see-upcoming`, act `see-upcoming`) opens `upcomingDialog` (soonest first; tap one to edit). `filteredTxns(upcoming)` serves both. Date fields are left-aligned and full width like the other fields (iPhone centred the value and let the box overflow): `appearance: none`, `::-webkit-date-and-time-value { text-align: left }`. Service worker cache `stiver-shell-v8`. Design export adds `transactions-upcoming`, `dialog-upcoming` and `buttons/see-upcoming`.
- 2026-11-01: **Design files for Figma** in `design/` (see `design/README.md`): every page (mobile light/dark, main pages desktop), every dialog, and the components split by group (buttons, text, banners, graphs, popups, form fields, date picker, dropdown, filters, navigation, cards, rows; light and dark) as SVG (editable layers in Figma) plus PNG previews, and `design/tokens/stiver.tokens.json` (W3C design tokens for Tokens Studio / Figma variables). Generated from the running app by `tools/design/export.js` (Playwright + vendored dom-to-svg, fake backend, sample data); re-run it after UI changes. On the way: fixed a crash when opening an asset page directly (`render` called `bindValue` without a value chart).
- 2026-11-01: The Transactions category filter list shows each category's icon (and searches parent names). A category row on Budgets > By category opens Transactions filtered to that category for the same period (`cat-txns`); its Edit button still edits the budget.
- 2026-11-01: `learning.md` has a **Session log**; appending what you learned at the end of every coding session is now a step of the working agreement (README, CLAUDE.md, §0, learning.md checklist step 7).
- 2026-11-01: The Transactions filter pills (category, occasion, account) centre their text.
- 2026-11-01: Added `learning.md` (mistakes made so far and how to avoid them) and made reading it a step of the working agreement (README, CLAUDE.md, §0).
- 2026-11-01: Transactions: **Reset filters** link (left of Expand all / Hide all, also shown when nothing matches) appears while any of search, category, occasion or account is set and clears all four (the period is kept). Fixed on the way: a `change` event from a removed, focused search box used to bring its old text back after a re-render (the `[data-filter]` change handler now only handles selects).
- 2026-11-01: **Scroll position is remembered per page within a session** (`scrollPos`, `pageKey`, `hashchange` handler; memory only): leaving a page saves where you were, coming back (tab, link or browser back) restores it; a page not visited yet opens at the top. Buttons that open Transactions with a new filter (trend bar, occasion/loan Details, global search) call `forgetScroll('#/transactions')` so that view starts at the top. Replaces the earlier "every page opens at the top" rule (UI-13). e2e `scrollpos`.
- 2026-11-01: **App-styled calendar** (`prototype/datepicker.js`, in the service worker shell, cache `stiver-shell-v7`): tapping any date field opens a popover calendar in the app's design (month header with arrows, weekday row, day grid, **Today**, selected/today marks, `min`/`max` respected, light and dark) instead of the iOS/OS calendar; the `<input type=date>` stays in the DOM (ISO value, forms, tests; made non-interactive by CSS like the dropdown selects), typing still works, Esc or a tap outside closes only the calendar, `data-native` keeps the OS one. **Active filters are highlighted** on Transactions: category, occasion, account and search get a tinted `f-on` style (brand colour, bold) while set.
- 2026-11-01: Budgets page: the Special occasions button reads **+ Add** (was + Occasion) and the **By category** card got its own **+ Add** (`add-budget` with `data-preset="category"`, `budgetDialog(null, 'category')` preselects the first category without a budget).
- 2026-11-01: The special-occasion card button that opens the occasion's expenses is now labelled **Details** (was Expenses).
- 2026-11-01: Amounts paid/received in a stablecoin are written as `USDT 5,584.00` / `USDC ...` (`coinAmount`) instead of `$5,584.00` in transaction rows and the Recurring list (totals and reports still convert to the reporting currency).
- 2026-11-01: Overview > Recent transactions no longer lists upcoming (future-dated) entries either. Fixed a regression from the loan view: `txnRow(t, loanView)` was called through `.map(txnRow)`, so the array index became `loanView` and expenses after the first row showed `+`; calls now pass only the transaction (test `daily` checks the sign on every row).
- 2026-11-01: **Loan Details = the Transactions page** filtered to that loan (`history-loan` sets `ui.wallet = 'l:<id>'` and the period of its latest entry): the account filter now has three groups (Savings / Investment / **Loan Account**); in the loan view each charged expense shows as `+amount`, each payment as a `Loan payment` row with `−amount` (`loanPaymentRows`, `txnRow(t, loanView)`), day totals are charges minus payments, the period picker gives the month-over-month view, and the word "charged" is gone. Lent cards keep the Details dialog (`loanHistoryDialog`). Investment-account stablecoin options show just the account name (`coinLabel`); the coin symbol is added only when the account holds more than one stablecoin.
- 2026-11-01: Removed the "Includes Rp ... charged to this account" line from loan cards (the charged amount is in Details).
- 2026-11-01: The expense **Account** list is grouped under three titles: **Savings Account**, **Investment Account** and **Loan Account** (`acctOptions`); dropdown group titles (`.cs-group`) are tinted bands with space before each group so the three read as separate sections.
- 2026-11-01: Release of four small changes: (1) the Transactions list hides upcoming (future-dated) entries; (2) the Help & feedback dialog is centred (title, type switch, message, screenshots, buttons), the type switch reads **Report a bug** / **Share an idea**, and the "We include your account email..." note is gone; (3) loan accounts in the Account list show just `Name (CUR)` (no owed amount); (4) loan and lent cards no longer list repayments: a **Details** button opens `loanHistoryDialog` with balance, original amount, charged, paid and every payment/charge (payments can be removed there, charges only by deleting their expense).
- 2026-11-01: The Transactions (Activity) list no longer shows **upcoming** (future-dated) entries (`filteredTxns`); they still show on Overview > Recent transactions and in budgets/recurring as before, and appear in the history on their day.
- 2026-11-01: **Loan accounts can pay for expenses.** In Add/Edit expense the Account list has a **Loan accounts** group (`l:<loan id>`, expenses only; income cannot go to a loan). The expense counts as spending as usual but is not tied to a wallet (`transaction.loan_id`, `wallet_id` null); a **charge** row (`kind: 'charge'`, `txn_id`) is added to the loan's `payments`, and the loan balance = original + charges - payments (`chargedOf`, `loanBalance`; charges dated later are not in yet). Editing the amount/date/account moves or removes the charge, deleting the expense removes it, recurring expense rules can use a loan account (`generateRecurring`). The loan card shows only the balance (the charged amount and the charged rows are in Details; a charge cannot be removed on its own). Sample data: the credit card has a few charges. DB: migration 20 (`debt_payments.kind`, `debt_payments.transaction_id`, `transactions.debt_id` + check `transactions_source_chk`); `cloud.js` upserts debts before transactions and debt_payments after. **Migration 20 must be applied before this reaches main** (every transaction save now includes `debt_id`). e2e `loanpay`.
- 2026-11-01: **Every modal closes when you tap or click the dimmed area outside it** (web and phone). A press that starts inside and ends outside (text selection), and a tap that only closes an open dropdown list, do not close it. (Replaces the install-dialog-only `data-close-outside`.)
- 2026-11-01: **Support entry point** (bug reports and feedback). A chat button just left of the profile icon in every page's top bar opens `supportDialog`: type **Report a bug** / **Suggest an improvement**, a message of at most 250 characters (counter), up to 5 screenshots of at most 1 MB each (bigger photos are shrunk in the browser by `shrinkImage`; thumbnails are data URLs because the CSP has no `blob:` images). `Cloud.submitSupport` uploads the images to the private storage bucket `support-attachments` (`<user id>/<report id>/<n>.<ext>`), then inserts a row in **`support_reports`** (migration 19): `type` ('bug' | 'feedback'), `message`, `attachments` (paths), `user_id` and `email` (filled by a BEFORE INSERT trigger from the signed-in session, never from the client), `context` (language, theme, screen, viewport, standalone, currency, user agent), `status` ('new' default), `created_at`. RLS: signed-in users can insert and read only their own; nobody else can read. Read reports in the Supabase dashboard (Table Editor; Storage > support-attachments for images). Not sent from sample mode. e2e `support`. **Migration 19 must be applied to production before this is merged to main.**
- 2026-11-01: Editing a recurring rule (Manage) whose first payment is still upcoming (`spec.first_tx` = the entry entered by hand, `spec.first_made` = its date) moves/updates that upcoming entry too (date, amount, account, category) so no stale copy is left next to the rule's own next entry; an entry that already happened is never touched. Only for expense/income rules paid from an account.
- 2026-11-01: The recurring **Manage** dialog also edits the **Category** of expense/income rules (applies to later entries only).
- 2026-11-01: Rupiah amounts always have a non-breaking space after `Rp` (`Rp 1.234.567`): newer iOS number formatting drops it, so `rpSpace` normalises it in `money`, `moneyHtml` and `priceFmt`.
- 2026-11-01: Recurring **Manage** dialog also edits the payment account (expense/income: Account; transfer: From and To; investment buy: Pay with); the amount unit follows the chosen account (`syncRuleUnit`), past entries keep their account. In the Recurring list an expense amount is red, an income green (`.pl.down` / `.pl.up`; the sign comes from `ruleTitle`).
- 2026-11-01: **Recurring**: (1) a first payment dated later no longer shows next month as the next payment: `addRule` sets `next` to that date and marks `spec.first_made` so the rule does not create that entry again (it was already entered by hand as an Upcoming entry); (2) each rule in Settings has one **Manage** button (`rec-manage`) opening `ruleDialog` (form `recedit`) with the amount and next-payment fields plus Pause/Resume and Delete; saving changes the amount and the next payment date from then on (the date also becomes the new start, so later payments keep the new day) and never touches entries already made; a date before today is refused. For investment rules the amount is the amount paid. e2e `recedit`.
- 2026-11-01: Fix: the preselected account now also works for records made before it was remembered, on another device, or after clearing storage: with nothing remembered, `latestAcct` uses the account of the latest matching record (newest expense/income not dated in the future; for Invest the newest buy's paying account and its investment account). A value remembered on this device still wins.
- 2026-11-01: Day rows on Transactions have no hover/pressed/focus background (it stayed highlighted after a tap on touch screens); the chevron shows open/closed.
- 2026-11-01: Transaction amounts have one colour for income and expense (the +/− sign tells them apart); the green income colour on `.amt.income` was removed, including the day totals.
- 2026-11-01: The open part of a day on Transactions (`.day-body`) has its own rounded block background: very light grey (#f2f3f9) in light mode, slightly lighter indigo (#212059) in dark mode (softened from the first version), so it separates from the day rows.
- 2026-11-01: **Modal scroll lock**: while a modal is open the page behind cannot scroll (`lockScroll` pins the body with `body.scroll-locked` and a negative top, `unlockScroll` restores the scroll position on the dialog's `close` event; `overscroll-behavior: contain` on dialogs and dropdown lists). Needed on iPhone, where `overflow:hidden` alone still lets the background move. e2e `modalscroll`.
- 2026-11-01: **The account selected when adding follows the one used last**, separately for expense, income and investment (Pay with, plus the investment account): `rememberAcct` / `recallAcct` keep it in localStorage `stiver.lastacct.v1` on this device when a new transaction/investment is saved; switching the type inside the dialog picks that type's last account; an account that is archived or gone is not preselected (falls back to the first account in the reporting currency); sample data never writes it. e2e `lastacct`.
- 2026-11-01: Changing the reporting currency (Settings or the Overview/Portfolio selector) while **sample data** is on now rebuilds the sample for that country (`applySetting`), keeping the demo name/theme/language; your own profile currency is untouched. Signing in with a saved currency already seeded the sample for it (`setDemo`).
- 2026-11-01: **Localized sample data.** Sample mode builds a country profile from the reporting currency (`prototype/sample.js`, `SAMPLE[cur]`, used by `seed()`): IDR (Indonesian, as before), SGD, HKD, JPY, USD, EUR, GBP, AUD, CNY, each with local banks, e-wallets, merchants, a local broker plus a global one, local stocks (Yahoo symbols such as D05.SI, 0700.HK, 7203.T, ASML.AS, HSBA.L, CBA.AX; the Chinese symbols are unverified), loans, a friend you lent to, a trip occasion and budgets. Non-rupiah profiles are written in USD terms and scaled by the live/demo rate and a local price level, then rounded to natural amounts; any other currency falls back to the USD profile. HKD and CNY were added to the supported currencies (`RATES`). AED was tried and removed again (no live rate source, unverified exchange symbols). New shell file `sample.js` (service worker cache `stiver-shell-v6`). e2e `samplelocal` checks all of them (names, merchants, categorized, no negative accounts, average prices, pages render).
- 2026-11-01: Money Flow tooltip (hover/touch on the chart) now shows the month with **Income**, **Spending** and **Net** (was only the net), kept inside the card at the top of the chart.
- 2026-11-01: **Transactions days expand in place** instead of opening a day page: tap a day to show its transactions under it (`toggle-day`, state `ui.openDays`, kept while you stay in the app), plus **Expand all** / **Hide all** above the list; a search opens every matching day. The day page route `#/transactions/<date>` still exists but nothing links to it. Tests `daily`, `run`, `transfer` updated.
- 2026-11-01: **Category trend** card on Overview (between Spending and Budgets): stacked bar chart of spending per period (`trendCard`, `trendData`, `trendChart`, `trendDialog`; colour legend under the chart, no hint text). Time frame 1 / 3 / 6 / 12 months and one category (searchable): All categories = bars split by top-level category (top 6 + Others); a category with sub-categories = split by sub-category (+ "Not in a sub-category"); a sub-category or a category without children = one colour. Tap a bar for the breakdown of that period (amounts, share) with **View transactions**, which opens Transactions filtered to that period and category. Uses expenses only, converted to the reporting currency, future-dated entries excluded. e2e `trend`.
- 2026-11-01: **Install dialog differs by platform.** iPhone: a looping, silent how-to animation drawn in CSS (`installGuide`, tabs Safari / Chrome, default by user agent; Safari 5 scenes: the ≡ button in the address bar, Share, Add to Home Screen, Open as Web App + Add, the Stiver icon highlighted among other apps on the Home Screen; Chrome 4 scenes: Share icon in the address bar, scroll to Add to Home Screen, Add, icon), plus the transfer code when signed in; button **Close**; tap outside closes. Android: the real install prompt when the browser offers one, otherwise plain menu steps (⋮ > Install app), no animation and no transfer code (Android Chrome shares its sign-in with the installed app). The animation is illustration only (no real screen recordings, so no personal data).
- 2026-11-01: Removed the **Open share menu** button again: `navigator.share` opens a generic link-share sheet on iPhone that has no Add to Home Screen, unlike the browser's own Share button (which shares the page and lists it). The install dialog now names the right Share button per browser (Chrome: icon in the address bar; Safari: toolbar or under ⋯), has a **Got it** button and closes on a tap outside.
- 2026-11-01: Install dialog on iPhone: **Open share menu** (`navigator.share`, opens the share sheet whose actions list has Add to Home Screen; Chrome's sheet needs a scroll) is the single main button again and there is no Done button; tapping outside the dialog closes it (`data-close-outside`). Browsers without `navigator.share` (and Android) keep Done.
- 2026-11-01: PWA `start_url` is now `./` (was `./index.html`), so the installed app opens at `stiver.io/` without the file name (the service worker still serves `index.html` for it).
- 2026-11-01: Install nudge fixes after a real iPhone recording (Chrome): the Home Screen shortcut used the manifest start page (`index.html`), so the code in the address did not arrive. The code now also rides in a 15-minute cookie `stiver_handoff` set when the install dialog opens; the installed app (standalone only) claims it on start and clears it (iOS may copy the browser's cookies into a new Home Screen app; unverified), and the landing page of the installed app shows **Transfer from browser** for typing the code. Removed the **Open share menu** button (Chrome's share sheet hides Add to Home Screen below the fold); step 2 now says to scroll down the list. e2e `handoff` covers the cookie path and that a plain browser never takes it.
- 2026-11-01: **Install nudge + session handoff.** In a mobile browser only (`MOBILE_BROWSER`: iOS/Android and not standalone) a prominent **Use mobile app experience** button (`installBtn`) sits under Sign in on the landing page and under the Total Balance hero on Overview; it opens Add-to-Home-Screen steps (`installDialog`; Android Chrome uses the real install prompt; on iPhone, Safari and Chrome both add via the Share sheet; the steps include keeping "Open as Web App" on). When signed in it also calls RPC `create_handoff` (migration 18: table `auth_handoffs`, no direct access, 15 minutes, single use, 10-char code) and puts `#/overview?handoff=CODE` in the address and shows the code; the installed app (separate storage on iOS) claims it with `claim_handoff` + `refreshSession` (`consumeHandoffFromUrl`, or typed via **Transfer from browser** on the sign-in screen, `handoffDialog`, form `handoff`). The browser session is revoked when the app takes over. iOS may not keep the address fragment for the Home Screen shortcut, so the typed code is the reliable path. e2e `handoff` (the fake Supabase gained `rpc` and `refreshSession`).
- 2026-11-01: **Currency formatting**: every amount follows its own currency's native format regardless of the app language (`NATIVE_LOCALE`/`nativeLocale`: IDR `id-ID` = `Rp 1.234.567` with dot thousands and comma decimals; USD/SGD/AUD/JPY `en-US`; EUR `de-DE`; GBP `en-GB`); IDR is shown as `Rp` everywhere (`money`, `compact`, `priceFmt`). The reporting-currency dropdown (`heroCurrency`) now sits right next to the big amount on both **Total Balance** (Overview) and **Net worth** (Portfolio) heroes instead of a corner pill; it changes the reporting currency.
- 2026-11-01: Trade and Add-asset dialogs put **Pay with / Paid from** (or Receive into) first; Amount and **Price per unit** follow that account's currency (an account's own currency, a cash balance's currency, or USD for USDT/USDC), so amount = quantity x price with no conversion. When the trade is saved the price is converted once into the holding's cost currency (`h.ccy`, set from the first paying account) with the latest fiat rates fetched then from `/api/fx` (`freshFx`, only when a conversion is needed; falls back to the loaded rates offline) and stored as `tr.price`, so the average does not drift when rates move later. `srcCcy`, `needsFx`.
- 2026-11-01: Dark mode purple toned down (twice): filled surfaces (buttons, progress bars, avatar, Add circle, step numbers) use darker `--navy`/`--fill`/`--fill-2`; `--brand` stays the lighter purple for text and links.
- 2026-11-01: The **Upcoming** tag on a transaction row moved from beside the title to the left of the date (right column), so every row keeps two lines.
- 2026-11-01: Investment account card header (`.acct-head`): long names wrap inside their own space and, on phones, Edit / + Cash / + Asset always sit in one even three-column row below the name.
- 2026-11-01: The asset dialog no longer lists trades: a **View history** button opens a full page `#/portfolio/<holdingId>` (`viewAsset`, routed from `viewPortfolio` via `routeArg()`) with summary, Buy/Sell, Edit and the full trade list (`tradeList`, no limit, dates with year).
- 2026-11-01: Investment accounts get a **+ Cash** button (opens Add asset on Cash balance); for the Cash balance type the asset box becomes a searchable currency dropdown (`select[data-cash-ccy]`, currencies = `RATES` keys) and the choice fills that field directly (`syncPickType`). `cashacct` test extended.
- 2026-11-01: **Average price and P&L per asset** (weighted average cost). `holdingCost(h)`: opening qty q0 (= quantity minus signed trades) at `h.open_price`, buys add qty x price to the cost, sells realize qty x (price - average) and remove qty x average; trade price = typed `tr.price` or derived from the wallet amount / swapped coins; trades dated later are ignored; cash and stablecoins have no cost basis (`trackCost`); unknown starting price shows "—" with **Set average price** (`costDialog`, form `cost`). Add asset has Average price + currency for owned assets (`addOpening` blends more owned quantity into the starting price); the trade dialog has Price per unit that syncs with quantity and amount (`syncTradePrice`); the holding row shows P&L % instead of share; summary shows Average price, Cost, Profit / loss, Realized P&L, Starting price; history shows price per trade and realized P&L per sell. Sample holdings carry starting prices. e2e `avgprice`. Not built: account/portfolio P&L totals, P&L chart over time.
- 2026-11-01: Investment accounts can hold a **fiat cash balance**: a holding with key `CASH:<CUR>` (`customAssets[...] = { cash: 'IDR', type: 'cash' }`, priced at face value from `RATES`,
  stored as asset_type `manual` + `provider_symbol` `cash:IDR`, so no migration). Created from the asset picker (type "Cash balance"); Deposit/Withdraw reuse the buy/sell code with a savings
  account as the other side; the same account's cash is offered under Pay with > Cash balance when buying or selling assets (paired trades, as with stablecoins). Sample data has IDR cash in
  Stockbit and Ajaib. e2e `cashacct`. Not done: income/expense straight into the cash balance, and cross-account cash use.

- 2026-11-01: Holding rows no longer show the unit price. Tapping a row opens a detail (`holdingSummary`, in `holdingDialog`): quantity, current price, value, share of the account, Buy / Sell
  buttons, trade history, Move to account, Remove. (Profit/loss is not shown: the app does not track cost basis.)

- 2026-11-01: Holding rows: name, `qty SYMBOL` and `@ price` on three clean lines (no type badge or type text); no focus outline on rows/buttons after a tap (`outline: none`).

- 2026-11-01: Activity day rows show only the weekday and the transaction count (no income/spent text); every route change scrolls to the top (`hashchange` handler).

- 2026-11-01: Sample data: removed the monthly allowance for parents (transactions, recurring rule and the Parents category); 5 recurring rules remain.

- 2026-11-01: Sample data: removed the DBS SG (SGD) account, added a Housing loan (Rp 900 mn, 7.2%, mortgage type), and sample mode uses a budget period starting on the 25th
  (`setDemo` sets `period: 25` on the demo profile only).

- 2026-11-01: Tooltips (`.info-pop`) are smaller (12px text); the Total Balance one sits beside its icon on the blue card (it used to cover the amount).

- 2026-11-01: Overview **Total Balance** = savings + investments (`totalBalance()`, `savingsTotal()`); money lent and loans are not included (Portfolio > Net worth covers them); an (i) tooltip next to the label says "Savings + investments". The hero
  "this month" % uses this total as its base.

- 2026-11-01: (1) Sample data rebuilt as an Indonesian account (`seed()` in `app.js`, amounts in IDR, converted for other reporting currencies): BCA, Mandiri, Bank Jago, Cash,
  Gopay/ShopeePay/OVO, DBS SG; Stockbit (IDX stocks) and Ajaib (IDX stock, US stocks, BTC, USDT, gold); ~Rp 5 bn of savings+investments; Indonesian merchants, fixed monthly items (salary, subscriptions),
  e-wallet top-ups, a Bali Trip occasion, budgets, 5 recurring rules; November is filled up to today with later items as Upcoming; every transaction is categorized. Opening balances are
  derived so each account ends at its target. (2) Dropdown popover now uses the Popover API (top layer) but stays inside the dialog (outside it everything is inert), so a long list is
  not clipped by the dialog edge; "Add new category" is the last item of the scrolling list again (not fixed/sticky), as requested.

- 2026-11-01: Dropdown popover restructured (`dropdown.js`): `.cs-pop` is a flex column with a fixed search box, a `.cs-scroll` area that is the only scrolling part, and a fixed
  footer for `data-cta` entries ("Add new category"), sized with `visualViewport` and 28px bottom margin. The sticky-bottom approach was not enough on iOS: the end of the list could
  not be scrolled into view (rubber-band). Not testable on a real phone from the sandbox.

- 2026-11-01: In the category dropdown the "Add new category" entry is `position: sticky; bottom: 0` (always visible), after a screen recording showed it cut off / hard to reach
  at the end of a long list on a phone browser.

- 2026-11-01: Fix: after a reload with sample mode on, the app could show the sample banner over your own (empty) data. Two `loadUserData()` runs overlapped (sign-in events
  arrive in pairs); the later one overwrote the demo data while `state.real` was already set, so `setDemo(true)` was skipped. `loadUserData` now has a sequence guard
  (`loadSeq`, only the newest load applies) and clears `state.real` before assigning. e2e `sample` simulates the overlap (verified to fail on the old code).

- 2026-11-01: (1) The Overview sample-data banner has a short "Try" button (description stays next to the question), (`data-act=demo-on`), not a switch. (2) Reverted the global `overscroll-behavior: none`: pull-to-refresh
  stays enabled in phone browsers (still disabled in the installed app); only lists/dialogs contain their scroll. (3) Transaction rows: title and amount on one line, date under
  the amount (`.amt-col`), the "Uncategorized" badge removed.

- 2026-11-01: The Overview sample-data offer now uses the yellow banner style (`.demo-bar.sample-promo`) at the top of the page instead of a white card.

- 2026-11-01 (REVERTED, see above): `overscroll-behavior: none` on html/body for every display mode (was installed-app only) so a downward pull at the top of a page in a phone browser does not trigger
  pull-to-refresh. Not verifiable from the sandbox. If Chrome on iOS still refreshes (it ignores overscroll-behavior), the fallback is to make `#app` the scroll container
  (position: fixed; overflow-y: auto) so the document itself never scrolls; that touches `window.scrollTo` uses and the e2e scroll checks.

- 2026-11-01: The sample-data banner is NOT sticky (owner preference; it was briefly pinned). On phones it is a single compact line ("Sample data · not saved" + button; `.demo-short`), the long sentence stays on desktop (`.demo-long`);
  the 3-line version looked messy when it overlapped the content.

- 2026-11-01: Transaction rows show just the category (sub-category) name, not "Parent › Child", to keep the detail line short (`catPath` is still used elsewhere).

- 2026-11-01: The sample-data banner was briefly sticky; reverted (not sticky). The Overview sample-data card and Settings switch remain.

- 2026-11-01: Landing page: more space above the header on phones, outlined Sign in button (`.land-cta .btn.secondary`), the hero product mock-up card removed (hero is
  now centred text), demo video re-recorded for the current UI (new `tests/e2e/encode_demo.sh`; the tour now shows the donut, category search, day page, Portfolio time frame)
  and its caption updated.

- 2026-11-01: Overview shows a "Just looking around?" card with a sample-data switch (`samplePromo`, `.sample-promo`) when the total balance is under 1 USD and sample
  mode is off, so new users can try the app without finding the Settings toggle. It reuses the `[data-demo]` switch handler.

- 2026-11-01: New loading screen (`viewSplash`, `.splash*` CSS): floating logo with a pulsing ring and an orbiting coin, a running bar, and a line that rotates through four
  friendly messages with pure CSS (no timers); respects `prefers-reduced-motion`; themed for dark mode.

- 2026-11-01: Searchable dropdowns show a "not found" line above the add button when nothing matches (`data-empty` on the select, `.cs-empty`); set to "Category not found" on the category selects.

- 2026-11-01: Fix: tapping the search box inside a dropdown list closed the list (the phone keyboard fires resize/scroll, which `dropdown.js` treated as "page moved").
  While focus is inside the list those events are ignored and the list is re-fitted to the visual viewport (`fit()`). e2e `dropdown` dispatches them.

- 2026-11-01: Fix (from a screen recording): after choosing an option in the app-styled list, iOS opened its native picker again because `dropdown.js` focused the
  select. Focus now returns to the select only when the list was opened from the keyboard; after a tap the select is blurred. e2e `dropdown` asserts it.

- 2026-11-01: Category picking: "＋ Add new category" is the last entry of the Category dropdown (`option value=__new data-cta`), replacing the separate button; it opens the quick-add
  form without focusing a field (no keyboard), choosing a real category hides it. `dropdown.js` gained `data-search` (search box on long lists; `data-s` on an option
  widens what it matches, sub-categories carry their parent's name), `data-cta` entries, and remembers the select under the finger at pointerdown so a tap is not lost
  when the keyboard closes between pointerdown and click. `data-search` is on the transaction, budget and filter category selects.

- 2026-11-01: Bottom bar: the Add item is now as tall as the other tabs (52px, 5.5px bottom padding), so its label is level with theirs (measured to 0.1px; `noscroll` asserts it).

- 2026-11-01: Investment holding rows: smaller type tag (`.badge.sm`) and a space after the × in `qty SYMBOL × price`.

- 2026-11-01: Day page (`#/transactions/<date>`) got a search box (`state.ui.dayQ`, `dayTxns`, `dayListHtml`) and more space under the Back link.

- 2026-11-01: Settings > Categories: no collapse toggle; separate Expense and Income groups (`.cat-sec`, headings + counts, no type badge); on phones each shows the first
  5 with See more / Show less (`state.ui['more_cat-<type>']`; the shared `toggle-more` action now takes any `data-key`). `catsOpen` removed.

- 2026-11-01: Portfolio hero: removed the "after loans / no loans" label. Activity header: search (left) + period dropdown (right) on line 1 (`+ Add` only on desktop, `.add-desk`),
  filters "All categories / All occasions / All accounts" on line 2 sized by flex ratios so the text is not cut at 360-390 px (`dropdown.js` also supports a short field label with a fuller `data-list` label).

- 2026-11-01: Phone pages get a little more room at the top (24px, was 12px) so the greeting and the profile icon do not touch the status bar.

- 2026-11-01: USDT/USDC accounts are listed like savings accounts, `Binance (USDT)`, under a group headed "Investment Account" (dialog, filter and transaction rows).

- 2026-11-01: Phone bottom bar: less space under the labels (padding 6px top, 2px + 40% of the home-indicator inset at the bottom, was 8px + 100%); page bottom padding reduced to match.

- 2026-11-01: Overview Budgets card shows only the overall budget (no category tiles, no special occasions), the button is "Details", and the whole card
  (`.tap-card`, `data-act=goto`) opens the Budgets page. Full budgets and occasions live on the Budgets page.

- 2026-11-01: Overview hero percentage is now the period's balance change % (net / starting balance, `balChange`), so it matches the sign of the amount
  beside it; it used to be the saved-income % and showed +0% with a negative amount. `—` when the starting balance is not positive.

- 2026-11-01: App-styled dropdown lists for all selects (`dropdown.js`, CSS `.cs-*`, service worker cache `stiver-shell-v5`); e2e `dropdown`; regression UI-11.

- 2026-11-01: Removed the "N accounts" label from the Overview hero card.

- 2026-11-01: (i) tooltip icon is vertically centred with the title text (heading is a flex row when it holds an `.info-wrap`).

- 2026-11-01: (i) tooltip icon made smaller (16px) with an invisible larger tap area.

- 2026-11-01: The price disclaimer moved into an (i) tooltip next to the Investments title (`infoTip()`, `.info-wrap/.info-pop`, `state.ui.infoOpen`); no description
  paragraph. The helper is reusable for other titles.

- 2026-11-01: Live prices (Finnhub and Yahoo) are cached on the server for 6 hours like FX (`cached_price`, `PRICE_TTL`; `/api/price` and `/api/fx` also send
  `Cache-Control: public, s-maxage=21600` so Vercel's edge holds them). One disclaimer on the Investment tab ("update every 6 hours and can be delayed");
  the Refresh prices button and "Last refreshed" line were removed since a refresh would return the same cached price.

- 2026-11-01: Investment tab: removed the "Current prices are live..." description; added a disclaimer (prices refresh on open or Refresh prices, quotes up to
  15 min delayed, FX about every 6 h, not advice) and "Last refreshed HH:MM" (`state.pricesAt`, in memory). There is no timed refresh while the app stays open.

- 2026-11-01: Added `regression_scenario.md` (manual regression scenarios per area + automated coverage map) and made keeping it current part of
  the working agreement (section 0, `CLAUDE.md`, README).

- 2026-11-01: Asset type option "Gold, oil & more" renamed "Commodities".

- 2026-11-01: Asset picker: the five type pills became a dropdown beside the search box (`.asset-search`, `[data-pick-type]`); the long hint line is gone.

- 2026-11-01: Transaction rows: a space after the middle dot before the account name ("Salary · USDT · Binance · Nov 25").

- 2026-11-01: Added IDX stocks and commodities (Yahoo Finance, unofficial) as investment assets; e2e `idx`, `tests/test_yahoo.py` (python, stubbed).
  BUG FIX: since the recurring release (2026-10-31) a buy with a payment source also added its quantity a second time to the holding
  (an `else` bound to the wrong `if` in the holding form). Fixed; production DB checked: no holding was affected.

- 2026-10-31: See more / Show less (savings accounts, Portfolio month history) is phone-only: every item is rendered, the extras carry `.more-item`
  and are hidden by CSS under 900px while the list is `.collapsed`; on desktop all items show and the button is hidden.

- 2026-10-31: Portfolio history list under the chart shows the latest 3 months, then "See more (n)" / "Show less" (`state.ui.histMore`; the
  shared `toggle-more` action takes `data-key`).

- 2026-10-31: Overview on desktop: Recent transactions moved into the card grid, next to Budgets (no empty cell); phones still stack it.

- 2026-10-31: Budgets > Overall budget footer: the status badge and Edit button now share one vertically centred line (`.budget-foot`/`.budget-end`).
  Reminder: Vercel is on Pro; push to `main` only (the session branch makes a second build per change).

- 2026-10-31: Bug fix: with a custom period start day, accounts created in the calendar month the period ends in (e.g. made on 1 Nov while the
  period is 25 Oct-24 Nov) were left out of Portfolio Savings, so it disagreed with Overview's Total Balance. `since` fields stay calendar
  months and are now compared with `liveIn(since, k)` (since <= the period's last day) for wallets, holdings, loans and lent.

- 2026-10-31: Removed the balance line chart from the Overview hero card (and the unused `sparkline()`); the card is now just balance, change and the four action buttons, with tight spacing; on desktop it spans the full width so no empty space is left
beside or inside it.

- 2026-10-31: Portfolio > Savings shows the 3 largest accounts, then "See more (n)" / "Show less" (`state.ui.walletsMore`).

- 2026-10-31: Portfolio Breakdown: removed the stacked bar; Savings, Investments and Lent show their share of assets, and Loans sit apart
  as "Less: Loans" (a deduction, no percentage).

- 2026-10-31: The Transactions period dropdown shows the custom period ("Oct 25–Nov 24", `periodShort`) instead of a calendar month; the
  list already filtered by period. e2e `period` covers it.

- 2026-10-31: Period customization (migration 16 applied to production): Settings > Profile > Budget period starts on. All month logic
  goes through the period helpers; `render()` re-selects the current period when the start day changes. e2e `period`.

- 2026-10-31: Portfolio lists sort from the highest amount (compared in USD): savings accounts, investment accounts and the assets inside
  each, lent and loans (`byValue`). e2e `pfrange` checks savings and loans.

- 2026-10-31: Portfolio account cards more compact: type and currency sit beside the name (they drop below only for long names), tighter padding.

- 2026-10-31: Money not yet received/spent is left out of all analysis: `inMonth()` (month totals, Money Flow, "this month" change,
  saved %, spending donut and breakdown, budgets), special-occasion spent, loan/lent balances and payments all ignore entries dated
  after today. Such rows stay in the Transactions list with an **Upcoming** badge and count again on their day.

- 2026-10-31: Stop phone zoom/pan: viewport locked (`maximum-scale=1, user-scalable=no`), `touch-action: manipulation`, `overflow-x: clip`,
  and the real cause fixed: the Portfolio tab bar (402px) and the landing header (498px) were wider than a 390px screen. e2e `noscroll`
  checks every page and tab at 360 and 390px. Keep new layouts within the screen width.

- 2026-10-31: Future-dated entries wait for their day: `walletBalance`, `balanceAtEnd` and `qtyAt` ignore anything dated after today
  (`todayIso`, `heldNow`), so a USDT income dated next week does not raise your holding, net worth or any account balance until that
  date; coins dated later are not spendable. Month reports (income/spending by month) still list them in their month.

- 2026-10-31: Removed the "(new)" tag from the USDT/USDC income choices in the Account list.

- 2026-10-31: Add-transaction flow: the **Account** field is now first (the amount's currency/unit follows it, `syncTxnUnit`). Income can go
  into USDT/USDC **without holding any yet**: the Account list (`acctOptions`) offers "USDT · <investment account> (new)" (value
  `n:SYMBOL:accountId`); saving creates the holding (and a "Crypto" investment account if you have none). Those choices appear for
  income only; the list is rebuilt when the type changes.

- 2026-10-31: UI wording: savings "wallets" are now called **accounts** everywhere in the interface (English and Indonesian "Akun");
  code, database and the E-wallet type keep the wallet names. The add-transaction account list always has an
  "Investment accounts (USDT/USDC)" group, with a hint when no stablecoin is held yet.

- 2026-10-31: USDT/USDC income and expenses (migration 15 applied to production). `recordCoinTxn`, `coinOf`, `txnWhere`; the cloud layer
  stores trade `kind` in `holding_events.note`. e2e `coin`. Amounts are USD at 1 coin = 1 USD (no live peg price).

- 2026-10-31: Recurring transactions (migration 14 applied to production; `cloud.js` maps `recurring_rules` <-> `d.recurring`). `Repeat`
  field on add expense/income, transfer and invest; `runRecurring()` runs after load and on tab focus; `recurringCard()` in Settings.
  Dialog fields no longer overflow (date box). e2e `recurring`. Limits: entries appear only when the app is opened; recurring
  investment buys repeat the same quantity and amount; the trade dialog for an existing holding has no Repeat yet.

- 2026-10-31: Portfolio chart + history list have a time-frame dropdown (`state.ui.pfRange`, `PF_RANGES`, `pfMonths()`): 1 month (two
  points), 3, 6 (default), 9 months, 1, 3, 5 years, All time (from the earliest wallet/holding/loan/transaction month). Long ranges
  thin the axis labels and hide dots. The net-worth card and breakdown stay on the current month. New e2e test `pfrange`; new i18n keys.

- 2026-10-31: Portfolio history under the chart is now a list (`.mlist`/`.mrow`: month left, value with change and % stacked right)
  instead of a 4-column table, so very large amounts (checked up to tens of trillions on a 390px phone) never overflow.

- 2026-10-31: Portfolio currency dropdown made smaller (28px tall pill, 12px text).

- 2026-10-31: Portfolio net-worth card made smaller: removed the "1 USD = ... live rate" line and the "Preferred currency" label; the
  currency dropdown is now a small pill in the card's top-right corner.

- 2026-10-31: Budgets > Special occasions rows now show only the date range under the bar (no expense count, no amount left/over);
  nothing is shown when the occasion has no dates.

- 2026-10-31: Bottom bar Add button: label now shares the other tabs' baseline (button is the same 50px height; the 60px circle
  rises above the bar with an 8px gap above the label).

- 2026-10-31: Phone navigation: removed the floating + button and the Settings tab; bottom bar is now Overview, Activity, a raised
  highlighted **Add** button in the middle (opens the add-transaction dialog), Budgets, Portfolio. The round profile avatar at the
  top right (`.profile`, now a link) opens Settings on phones; desktop keeps the name pill and the sidebar. Overview hero buttons
  stay on one row down to 290px container width.

- 2026-10-31: Dialogs no longer autofocus a field (removed every `autofocus`; `open()` focuses the dialog box itself), so the phone
  keyboard stays down until the user taps an input. e2e `daily` checks it.

- 2026-10-31: Removed the top-3 category buttons under the Overview Spending donut (the donut hover/tap and Details cover it).

- 2026-10-31: Transactions controls compacted to two lines: search + `+ Add`, then month (short "Oct 2026"), category, occasion (if any)
  and wallet sharing one row (long names cut with an ellipsis). The "Activity" card title was removed. New i18n key "Search".

- 2026-10-31: Settings > Categories rows tidied (`.cat-row`): tile, name with type badge and sub-category toggle underneath, and compact
  `+ Sub` / `Edit` buttons right-aligned on the same line, on phone and desktop.

- 2026-10-31: Special occasions now only show in the budget month(s) they span (`occasionInMonth`: start..end months, or any month
  with an expense tagged to it; undated occasions show every month). Applies to the Overview Budgets card and the Budgets page;
  spent/budget numbers are unchanged. e2e `ovocc` covers it.

- 2026-10-31: Installable app polish: iOS meta tags (`apple-mobile-web-app-capable`, status bar `default`), PNG icons
  (`icon-192/512.png`, maskable, `apple-touch-icon.png`, full-bleed squares made from the brand logo), manifest `display: standalone`
  with PNG icons, standalone-only CSS (no bounce/selection), service worker cache `stiver-shell-v4`. Existing home-screen installs
  must be removed and re-added once to pick this up. A page opened from a link inside another app still shows that app's browser bar.

- 2026-10-31: Overview Budgets card got a month picker next to Manage. The month is shared state (`state.ui.month`), so it also
  switches the Spending chart on the same page. e2e `donut` covers it.

- 2026-10-31: Overview Spending chart is now a donut (`halfDonut()` in `app.js`, name kept; SVG circles with dash arcs, top 5 categories +
  Others). Hover (mouse) or tap (pins) an arc to show category, amount and % of total in the centre; tap elsewhere to clear.
  New e2e test `donut`; new i18n key "of total spending".

- 2026-10-31: Fixed Settings markup: the Profile card closed after Reporting currency, leaving Language and Appearance outside
  it and misaligned. All Settings controls now sit right-aligned inside their cards.

- 2026-10-31: Settings rows (`.form-row`): label left, input/select/toggle/button flush right on one line with a shared right edge
  (phone and desktop); controls no longer wrap or overflow.

- 2026-10-31: Tighter spacing everywhere (`styles.css`: page padding, card padding 16/18px (12/14 on phones), card/stack gaps 12px,
  list rows, form rows, topbar margin, h1 24px/22px). Keep new layouts compact.

- 2026-10-31: Removed descriptive text for a cleaner, phone-friendly UI: page subtitles under titles (`topbar` now renders only the
  title), Settings row descriptions, the Categories count line, and the explainer paragraphs on Lent, Loan and Special occasions.
  Keep new screens free of helper text; hints inside dialogs stay.

- 2026-10-31: Transactions page is now a daily cumulative view; a day opens a detail page (`#/transactions/<date>`, `viewDay`,
  `route()` now reads only the first path segment, `routeArg()` the second). New e2e test `daily`; `run`/`transfer` updated.

- 2026-10-31: Added the working agreement (section 0) and `CLAUDE.md`; README gained a "Working on this project" note.
- 2026-10-31: Added `context.md`, refreshed `README.md` and `docs/NEXT_STEPS.md`, moved the browser tests into `tests/e2e/`
  (with `run_all.sh`), removed a stray wheel file from the repo root.
- 2026-10-31: Dark mode (Settings > Appearance; `profiles.theme`; landing toggle). Overview budgets became horizontal bars.
- 2026-10-31: Language option (English, Bahasa Indonesia; `profiles.language`); landing note removed; hero buttons on one
  row; demo video re-recorded.
- 2026-10-31: Landing page + demo video + privacy/terms pages; sample data became demo mode; wallet cards compacted with a
  menu; wallet edit/archive/restore/delete; transfers with fees; special occasions; email confirmation auto sign-in;
  Resend + custom domain; CSP + dormant CAPTCHA; email templates; Google sign-in published.

