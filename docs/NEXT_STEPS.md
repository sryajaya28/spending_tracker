# Roadmap and open items

The app is live and used by real accounts. The original plan was to port the prototype to Next.js; that has not
been needed so far (see `context.md`, "Decisions"). Next.js stays optional for when `prototype/app.js` (about 1,700
lines in one file) becomes hard to maintain: components, TypeScript, server-side routes in one codebase.

## Pending before the local → staging → production workflow can start (see `docs/DEV_WORKFLOW.md`)
1. **Staging database: DONE for the schema** (project `cujmgyacxbcmltxfjkxo`, all 23 migrations applied and compared with production). Auth settings DONE (email confirmation off, so test accounts sign up without an inbox; checked by creating and deleting a throwaway account). Original note: a second Supabase project (free plan allows two active ones; the paused "sryajaya28's Project" could be restored or deleted),
   all 23 migrations applied, Auth URL/redirect settings, Google OAuth redirect for the staging host, a test email path (Resend or auto-confirm).
2. **Staging site: DONE** (branch `staging`, `staging.stiver.io`, Vercel Authentication switched off for previews; production domain unaffected). Original note: a `staging` branch with its own hosted URL (for example `staging.stiver.io`, branch domain on Vercel; previews already build per branch).
3. **Per-environment config:** `prototype/config.js` has the production Supabase URL/key and `vercel.json` CSP pins that host; staging needs its own.
   Also `FINNHUB_API_KEY` exists only for the production target, so previews/staging have no price feed until it is added.
4. **Network access for the assistant: DONE (2026-11-03).** Original note: the cloud sandbox cannot reach `stiver.io`, Supabase or the Vercel hosts (connections are refused), so it cannot run
   regression or smoke tests against staging/production. Add the hosts under Allowed domains in the environment settings (or use a broader level).
5. **Smoke-test and staging test accounts: DONE 2026-11-03** (accounts created on both databases, `tests/smoke/smoke.js` and `docs/SMOKE_TEST.md` written; passes 14/14 on staging and production). Still to do: the owner stores the two passwords as environment secrets `SMOKE_STAGING_PASSWORD` / `SMOKE_PROD_PASSWORD`. Original note: (never the owner's real account) with credentials kept as environment secrets, plus a written smoke-test checklist.
6. **How the owner reviews "local": DECIDED 2026-11-03: a preview link per feature branch** (built by Vercel, wired to the staging database, labelled "Staging · test data"). Original note: the assistant's local app is not reachable from the phone. Decide between a branch preview link, screenshots/recordings, or
   Remote Control to the owner's computer.
7. **Housekeeping (2026-11-03): `docs/FEATURE_TESTS.md` and the `CLAUDE.md` workflow rule written; branch protection on `main` DONE, shared repo `sryajaya28/dev-workflow` DONE; still open: the first release through the workflow (it carries the per-environment config and the smoke-test files to `main`).** Original note: `docs/FEATURE_TESTS.md` (the list the owner adds to), GitHub branch protection on `main` (no direct pushes), `CLAUDE.md` pointing to the workflow
   (its current rule "pushing to `main` deploys to production" changes), and a decision on where the shared workflow file lives for the other projects.

## Open items, by priority
0. **Risk-tiered workflow automation (owner-approved 2026-11-05, `docs/workflows/README.md`):** build (1) a strict test fake that rejects columns not in the migrations, (2) GitHub Actions: e2e on every PR (blocking), path-rule label with the minimum tier, Vercel preview on every PR, (3) CI job (Supabase CLI) that applies migrations and deploys Edge Functions: staging on merge, production on "Release", (4) scheduled run of `tests/staging/household/`, (5) split `learning.md` by area, (6) baseline cost of the last 5 tasks, (7) run Tier 1 on the next 10 small changes, then review cost, send-back rate and production defects.
1. **Finnhub licence:** free plan is personal-use only. Needed before a public launch.
2. **Google verification:** Search Console TXT record is added; wait for Google to finish the branding check, then
   re-request verification in Google Cloud > Auth Platform > Branding. Upload `prototype/brand/stiver-logo-120.png`.
3. **Contact email** for the privacy and terms pages: set `CONTACT_EMAIL` in `prototype/config.js`.
4. **CAPTCHA:** create a Cloudflare Turnstile widget, put the site key in `config.js`, enable it in Supabase with the secret.
5. **Supabase hardening:** minimum password length 8, leaked-password check (Pro plan), custom SMTP already on Resend.
6. **Staging environment:** separate Supabase project + `staging` branch; make `config.js` pick the project by hostname.
7. **Cross-user security test:** prove user B cannot read user A's rows (run as the `authenticated` role in a rolled-back transaction).
8. **Analytics follow-ups (PostHog EU is wired in, see `context.md` changelog 2026-11-04):** build the sign-up -> first account -> first budget -> first transaction funnel and a retention insight in PostHog; decide on an in-app opt-out switch / consent banner; confirm events arrive from the preview link.
9. **Plans:** Vercel Hobby and Supabase Free are fine for now; public/commercial use needs Vercel Pro and Supabase Pro
   (free Supabase projects pause after a week of inactivity and have no daily backups).

## Rules the app encodes (keep them)
- Money is integer minor units plus a currency code, with a fixed decimals table (IDR/JPY/etc. have 0). Never use floats
  for money and never ask the browser (`Intl`) for decimals: iPhones disagree with Chrome.
- Sub-categories are one level deep and roll up into their parent for totals and budgets.
- A budget applies from its `start_month` until a later row for the same scope replaces it.
- Transfers (wallet to wallet, or buying/selling assets) are not income or spending. A transfer fee is spending.
- Special-occasion expenses still count in monthly budgets; the occasion budget is an extra lens.
- A wallet counts from its `since_month`; its opening balance and transactions do not appear in earlier months.
- Loan and lent payments are not spending or income; balance = original minus payments.
- Net worth = savings + investments + money lent - loans, in the reporting currency.
- Saves must never delete-then-insert rows that share a unique key in one batch (upserts run before deletes).

## Known gaps

- Recurring entries are created when the app is opened, not on a server schedule. A Supabase scheduled job could add them while nobody is signed in.
- Recurring has no end date or edit screen yet (pause or delete and re-create), and no Repeat on the buy/sell dialog of an existing holding.
- `budget_status` (SQL) only counts spending in the budget's own currency; the app converts, the database needs `fx_rates` filled.
- No SQL tests yet for investments, debts, trades, occasions or transfers.
- Advisor warning: `public.rls_auto_enable()` is callable by anon and signed-in users (not created by this repo).
- Not built: trade fees, average buy price and profit/loss, savings goals, a real LLM for AI tagging, offline queue,
  auto-translated default category names (they are stored in the database in English), email language per user.
