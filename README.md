# Stiver

**One place for your whole financial picture: what you earn, spend, invest, owe and are owed, in the currencies you actually hold.**

Live at **https://stiver.io**.

## The problem

I could not find an app that lets me manage income, spending, investments, debt and money I lent in a single place.
Budgeting apps stop at spending. Investment apps stop at the portfolio. Almost all of them pick **one currency and apply it to everything**,
so the moment you hold a savings account in one currency, shares in another and a loan in a third, the numbers stop meaning anything.

Stiver is the net worth tracker I wanted: built from those pain points, for individuals and, next, for households.

## Who it is for

- **Individuals** who want to know where they stand: what they save each month, how their investments are growing, how much they still owe and how fast it is going down.
- **Households** (in development, see below) who manage money together and need to see who did what.
- People who live with **more than one currency** (salary in one, savings or investments in another, a loan in a third).

## The questions it answers

| You ask | Stiver shows |
|---|---|
| How much do I really save a month? | Monthly income, spending and net, per day and per category, against your budgets |
| Are my investments growing? | Holdings with buys and sells, priced at live market prices, in your own reporting currency |
| What do I owe, and how close am I to zero? | Loans with payments that reduce the balance, recurring repayments and the months or weeks left |
| Who owes me, and how much is still out? | A Lent tab: money lent leaves one of your accounts, repayments come back into one, and what is still out stays on the card |
| What am I worth? | Net worth with month-over-month change, across savings, investments, money lent and loans, with a switch to hide every balance when someone is looking over your shoulder |
| Who did what with our money? | Household access: everyone sees the same books and every record shows who added or changed it |
| Can I trust the totals when currencies move? | Each account keeps its own currency; values follow current exchange rates and market prices, converted for your preferred currency (IDR, USD, EUR, GBP, SGD, AUD, JPY, HKD, CNY, INR, PHP) |

## How it works for you

- **Everything in one view:** savings accounts, investments, money lent and loans sit next to your day-to-day spending, so net worth is a result, not a spreadsheet.
- **Multi-currency by design:** every account and holding keeps its own currency; nothing is forced into one. Totals are converted at current rates, so they move over time with actual prices.
- **Investments with real cost:** buys and sells with an average price, profit and loss (a loss on a sale is not counted as spending), holdings history, and live prices for crypto and US stocks/ETFs (Finnhub), Indonesian stocks (IDX) and commodities such as gold, silver and oil (Yahoo Finance, unofficial source). USDT/USDC can be used as a wallet for income and expenses.
- **Money in, money out of real accounts:** assets can be moved between investment accounts, money you lend leaves a chosen account, repayments land in one, and loan payments can be paid from an account. Transfers between your own accounts (with a fee and a different currency on the other side) are never counted as income or spending.
- **Hide balance:** one eye button on Overview and Portfolio masks every balance, total and chart value on the screen. Transactions, budgets and spending stay visible. It is remembered on the device only.
- **Budgets that fit real life:** overall and per-category monthly budgets (ok / warning / exceeded), a budget period that can start on any day 1 to 28, and **special occasions** (a one-off budget such as "Bali Trip") you tag expenses to.
- **Recurring made easy:** repeat an expense, income, transfer, investment buy or loan payment every week or month; pause, resume or delete a rule in Settings.
- **Fast entry:** daily summaries with drill-down, categories and sub-categories, automatic tagging that stays uncategorized when unsure, categories you can add from the transaction form, search in long category, account and occasion lists, a "Spent today" figure on the Overview, and a guided first run (account, budget, first transaction) for new sign-ups.
- **English and Bahasa Indonesia**, light, dark or match-device appearance, saved to your account. Works on a phone as an app on your Home Screen.
- **Tell us what is wrong:** a built-in button sends a bug report or an idea (with screenshots) straight to the team.
- **Sample data** switch in Settings: a demo account in memory that never touches your real data, localized to your reporting currency.

## Household access (released)

A family can run its money together. The owner invites people by email as **Editor** (read and write) or **Viewer** (read only); everyone sees the same data and **every record shows who created or changed it**, so everyone knows who did what with the money. There is an Activity feed of changes (kept 180 days). Editors can only change transactions they created; the owner can change anything. In this first version an email that already has a Stiver account cannot be invited (they need a different address), and one person belongs to one household.

## Built with AI, one task at a time

Stiver is built by Claude (Anthropic) working with one human, the owner, who sets the direction and approves what goes to production. The workflow ("v2") is deliberately lean: **one task = one fresh session = one branch = one pull request**, with the rules in `CLAUDE.md`. Changes are sorted into three risk tiers by what files they touch (`node tools/path_tier.js`): small docs, styling and translation changes only need CI; app and database changes also get an automated pull-request review, and the riskiest ones (money, sign-in, database) get a fresh independent review and the owner's check on staging. Every task ships its own tests, and nothing reaches production without the owner's explicit "Release". The earlier multi-agent team (Product Manager, Designer, Tech-Lead, QA) is archived in `docs/archive/`.

## Current status

Live at https://stiver.io with early users. Recently shipped: household access with an activity feed, money lent from an account, loans and repeating loan payments from an account, investment cost basis and profit/loss, bug and feedback reporting, product analytics, hide balance (Release 19), a Settings hub, "Spent today" on the Overview, search in long account and occasion lists, and a person filter on Transactions for households with two or more writers (Releases 20 to 23, 2026-11-13). The code of the app was also split from one big file into small files under `prototype/app/`. Next up: hardening the sign-in handoff and the pre-launch checklist below. Priorities and known gaps are in `docs/NEXT_STEPS.md`; release history is in `docs/RELEASES.md` and `docs/CHANGELOG.md`.

## Success metrics

How we know Stiver is working. Measured in PostHog (EU); event names are in `docs/ANALYTICS.md`. Everything below excludes the team's own accounts, test accounts, staging traffic and sample-data mode. **The targets are initial hypotheses, set before launch data exists, and will be revised after we have a baseline.**

### The thesis: one place for everything

People need income, spending, investments, debt, money lent and several currencies **in one place**. The headline metric tests that, not just activity.

| Metric | Definition | Initial target |
|---|---|---|
| **Activation (headline)** | Share of new users who, within their first 7 days, set up at least **two kinds of things beyond spending**: an investment, a loan, money lent, or an account in a second currency | Above 25% |

If it is high, the thesis holds. If almost everyone only logs expenses, we have built a budgeting app with extras, which is just as valuable to know.

### Engagement and retention

| Metric | Definition | Initial target |
|---|---|---|
| **WAU** (lead) | Distinct users who record at least one transaction in a 7-day window | Tracked weekly |
| **Stickiness** | WAU divided by MAU | Tracked monthly |
| **DAU** (secondary) | Distinct users who record at least one transaction on a day; many people log in batches every few days | Tracked |
| **Cohort retention** | Share of each week's sign-ups still active in week 1, week 4 and week 8 | Week 4 above 25% |
| **Churned users** | Users with no record for 30 days, counted **from their last record**: a transaction or an account change (balance, new account) | Reported by cohort |

Tuning notes: a person can check net worth or budgets without recording anything, so the headline engagement metric is WAU, not DAU; a 7-day churn window would wrongly count someone who logs every Sunday and skips a week.

### Revenue (later)

Paid conversion: subscribed users divided by active users. Starts when pricing and a payment gateway exist (Xendit for Indonesia, Stripe for international customers).

### Performance (guardrail metrics)

These must stay healthy while the product metrics grow.

| Metric | What it measures | Initial target |
|---|---|---|
| **Data freshness** | Time from submitting a transaction until it is saved and visible, here and on another household member's device | Other members see a change within about 30 seconds or when they return to the app |
| **App speed** | Load time and time from tapping save to confirmation, tested on a mid-range Android phone over 4G (Android dominates Indonesia) as well as iPhone | Load under about 3 seconds |
| **Save reliability** | Share of saves that succeed without an error or reload | 99.9% or higher |
| **Price freshness** | Age of live prices and exchange rates used in net worth | No older than 15 minutes during market hours |
| **Recurring accuracy** | Recurring entries created on the right day | Zero missed or duplicated entries |

## Deliberately not building (yet)

- **Bank syncing: not now.** Bank API coverage in Indonesia is uneven, and holding bank credentials or tokens is a serious security responsibility. The end goal is unchanged, though: **fewer manual entries and more automated records**, through other routes than bank or exchange syncing.
- **Tax filing or advice:** out of scope.
- **Trading through the app:** Stiver tracks investments; it does not place trades.
- **Investment recommendations:** not yet.
- **Native iOS and Android apps:** later. Today it is a web app you can add to your Home Screen.

## Known limits (we will improve these)

- Entries are still mostly manual.
- Indonesian stocks and commodities use Yahoo Finance's unofficial endpoints, which can break or be blocked; a typed-in price always works.
- US stocks and crypto prices use Finnhub's free plan, which is for personal use; a public product needs a suitable plan or another source.
- Recurring entries are created when you open the app, not by a background job.

## Under the hood

A static web app (plain HTML, CSS and JavaScript, no build step) hosted on Vercel, with Supabase for sign-in, the database and row-level security. The app folder is called `prototype/` for historical reasons; it is the production app.

| Part | Where |
|---|---|
| App | `prototype/`: `app/` (utilities, state, calculations, charts, views, dialogs, trades, recurring, household, events; map: `docs/MAP.md`), `app.js` (start-up), `cloud.js` (sign-in, data sync, household layer), `i18n*.js` (translations and theme), `dropdown.js` (app-styled select lists) |
| Landing page, privacy policy, terms | `prototype/app.js` (landing), `prototype/privacy.html`, `prototype/terms.html` |
| Hosted API for live prices and exchange rates | `api/index.py` (Vercel function reusing `tools/dev_server.py`) |
| Hosting config and security headers | `vercel.json` |
| Product analytics (PostHog EU, privacy rules in the file header) | `prototype/analytics.js` |
| Database (tables, access rules, functions) | `supabase/migrations/` (33 SQL files, in order) |
| Household server code (invites, join, sign-up gate) | `supabase/functions/` (Edge Functions; deploy notes in `supabase/functions/DEPLOY.md`) |
| Auth email templates | `supabase/templates/` (generated by `tools/build_email_templates.py`) |
| Tests | `tests/e2e/` (browser, `bash tests/e2e/run_all.sh`), `tests/smoke/`, `tests/staging/`, SQL tests (`bash tools/sql_local_test.sh`) |
| CI and release tools | `.github/workflows/` (CI and deploy), `tools/` (`path_tier.js`, `affected_tests.js`, `ci_wait.js`, `ship.js`) |

Saving is diff-based: every change is mapped to database rows, compared with the last known server state, and only changed rows are sent. Row-level security means a signed-in user only sees their own data, or the household they belong to. Money is stored as whole minor units plus a currency code, never as floats.

## Run it locally

Requires Python 3. No Node needed to run the app.

```bash
cp .env.example .env.local     # put your Finnhub key after FINNHUB_API_KEY= (optional)
python3 tools/dev_server.py 5173
```

Open http://localhost:5173. The dev server serves `prototype/` and proxies Finnhub so the key stays server-side. Without a key the app still works with built-in demo assets. Signing in uses the Supabase project in `prototype/config.js`; add `http://localhost:5173` to the redirect URLs in Supabase to use Google sign-in locally.

## How we work

Work goes **design (Figma) → feature branch → pull request into `staging` → production**. Details: `CLAUDE.md` (the rules), `docs/workflows/README.md` (the tiers), `docs/DEV_WORKFLOW.md`.

- **Start here:** read `context.md` (architecture, services, decisions, open items, the source of truth), then the rows of `learning.md` for your area (mistakes made and how to avoid them).
- **Run the tests before every push:** `node tools/affected_tests.js` prints the command for your diff; `bash tests/e2e/run_all.sh` runs everything.
- **Keep docs current in the same pull request:** `context.md`, a change file in `docs/changes/`, `regression_scenario.md` and `docs/FEATURE_TESTS.md` for features, and event tracking for every new button or outcome (`docs/ANALYTICS.md`).
- **Design** lives only in Figma: https://www.figma.com/design/DnfE4wtwMDGQyOW76MkVRW/Stiver. The `design/` folder is a frozen old snapshot. The iPhone launch images (`prototype/splash/`) come from `node tools/design/startup_images.js`.
- **Releases:** every release report lists its items in plain words first, then exact contents (`docs/RELEASES.md`). Cost per task is tracked in `docs/COSTS.md`.

## Deploying

Production is deployed by merging `staging` into `main` (Vercel builds it), and that only happens after the owner's explicit "Release"; `node tools/ship.js` then waits for the new build and checks the site. `staging` (https://staging.stiver.io) is the pre-production environment with its own Supabase project, and every change goes there first. `FINNHUB_API_KEY` lives only in the Vercel project's environment variables. Database changes are SQL files in `supabase/migrations/`, applied to staging first and production at release; the repo file names and the version numbers recorded in Supabase differ, so do not run `supabase db push` blindly.

Supabase settings the app relies on: Email provider with **Confirm email** on (production), Google provider enabled, URL Configuration (Site URL `https://stiver.io`, redirect URLs include `https://stiver.io/**` and `http://localhost:5173/**`), custom SMTP (Resend, sender on `stiver.io`), and the templates in `supabase/templates/`.

## Before opening to the public

Planned hardening, tracked on the team's backlog and not done yet:

- [ ] CAPTCHA (Cloudflare Turnstile): set `TURNSTILE_SITE_KEY` in `prototype/config.js` and enable it in Supabase together.
- [ ] Minimum password length of 8 in Supabase.
- [ ] Two-factor sign-in on the Supabase, Vercel, GitHub and Google accounts.
- [ ] A license. (`CONTACT_EMAIL` is set to the support address, so the privacy and terms pages show it.)
- [ ] A suitable price-data plan (see Known limits).

Never commit secrets. Only the public Supabase key and Turnstile *site* key belong in this repo.
