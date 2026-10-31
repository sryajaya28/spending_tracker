# Stiver: project context

Everything a new person (or a new AI session) needs to continue this project. It describes the project as it stands
on 2026-10-31. It contains **no secrets**: it says where each secret lives, never what it is.

## 0. Working agreement (read this first)

1. **Before doing anything** on this project (code, database, config, docs, answering a question about the project),
   read this file. If it disagrees with the code, trust the code, then fix this file.
2. **After doing anything**, update this file in the same commit: edit the sections that changed (features, data model,
   services, open items, decisions) and add a dated line to the **Changelog** at the bottom.
3. **Also update `README.md`** whenever the change affects what it describes (features, how to run, how it is built,
   deploying, release checklist), and `docs/NEXT_STEPS.md` when priorities or known gaps change.
4. Never put secrets in this file, the README or any committed file: say where a secret lives, never what it is.

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
- **Budgets:** overall + per-category monthly budgets; Overview shows horizontal bars with percentages; **special
  occasions** (one-off budgets with optional dates, tagged expenses, archive/delete).
- **Portfolio** tabs: Savings (wallets in any currency, compact cards with a ⋯ menu, archive/restore/delete, edit
  name/type/current balance, **transfers between wallets** with optional fee and cross-currency received amount),
  Investment (accounts, holdings, buy/sell with a wallet or USDT/USDC counterpart, live prices via Finnhub),
  Lent, Loan (payments reduce balance).
- **Net worth** with month-over-month change; preferred-currency dropdown (IDR, USD, EUR, GBP, SGD, AUD, JPY).
- **Language:** English and Bahasa Indonesia (about 510 strings). **Appearance:** match device / light / dark.
  Both saved to the profile and remembered per device.
- **Sample data** is a demo mode (switch in Settings): a seeded demo account lives only in memory, saves are disabled,
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
prototype/          the app: index.html, app.js (UI, ~1.7k lines), cloud.js (auth + sync), config.js (public config),
                    i18n.js, i18n-id.js, styles.css, sw.js, manifest, icon.svg, privacy.html, terms.html, legal.js,
                    brand/ (logo svg/png 120+512), media/ (demo video mp4+webm, poster), vendor/supabase.js (v2.45.4)
api/index.py        Vercel function for /api/* (Finnhub proxy, FX)
tools/              dev_server.py (local server + same API), build_email_templates.py
supabase/migrations/  13 SQL files (see section 6)        supabase/templates/  6 auth email templates + README
supabase/tests/     pgTAP tests (first migrations only)
tests/e2e/          Playwright browser tests with a fake Supabase; run_all.sh; record_demo_tour.js
docs/NEXT_STEPS.md  roadmap, rules, known gaps            vercel.json  hosting, rewrites, security headers
.env.example        FINNHUB_API_KEY=                      .claude/launch.json  dev server config
```

## 6. Data model (Supabase, schema `public`)

All user tables have `user_id uuid default auth.uid()` and RLS policies `user_id = auth.uid()`; `anon` has no access.
Composite foreign keys `(id, user_id)` stop rows referencing another user's rows.

| Table | Notes |
|---|---|
| `profiles` | `id = auth.users.id`, `display_name`, `default_currency`, `ai_tagging_enabled`, `sample_ids` (legacy), `language`, `theme` |
| `wallets` | `type` cash/bank/ewallet/card, `currency`, `opening_balance_minor`, `archived`, `since_month` |
| `categories` | one level of `parent_id`, `type` expense/income, emoji `icon`, `color`, unique sibling names |
| `transactions` | `type` expense/income/transfer, `amount_minor`, `currency`, `occurred_at`, `category_source` user/ai/rule, `transfer_direction` in/out, `holding_event_id`, `occasion_id`, `transfer_group_id` |
| `budgets` | `category_id` null = global, `start_month` (first of month), unique per scope+month |
| `occasions` | name, `amount_minor`, `currency`, optional `start_date`/`end_date`, `archived` |
| `investment_accounts`, `holdings`, `holding_events` | holdings keyed by symbol (`AAPL.US` when a stock shares a symbol with a crypto); events carry `quantity_delta` and `pair_id` for stablecoin pairs; opening event has `note='opening'`; `since_month` |
| `manual_prices` | user-entered USD prices for custom assets |
| `price_snapshots`, `fx_rates` | shared market data, read-only for users (written by a future server job) |
| `debts`, `debt_payments` | `direction` owed/lent, `type`, `monthly_minor`, `interest_rate`, `due_date`, `note`, `start_month` |

Views: `wallet_balances`, `debt_balances`. Functions: `spending_by_category`, `budget_status`, `portfolio_history`
(the app currently computes these client-side). Trigger `handle_new_user` seeds on sign-up: profile (name, currency
from `options.data`), a **Cash** wallet, 12 default categories with emoji icons and 11 sub-categories.

Migrations (repo file names; applied through the Supabase tools with different recorded version numbers):
1 schema, 2 RLS, 3 signup seed, 4 views+functions, 5 portfolio, 6 debts, 7 trades, 8 app seed + `holdings.since_month`,
9 occasions, 10 `wallets.since_month`, 11 transfer groups, 12 `profiles.sample_ids`, 13 profile language/theme.

## 7. Business rules the code encodes

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
5. Demo video: `tests/e2e/record_demo_tour.js` records a scripted tour (needs the dev server and ffmpeg); trim and
   encode to `prototype/media/demo.mp4/.webm` and `demo-poster.jpg` (see the encode commands in git history).

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

