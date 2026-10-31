# Roadmap and open items

The app is live and used by real accounts. The original plan was to port the prototype to Next.js; that has not
been needed so far (see `context.md`, "Decisions"). Next.js stays optional for when `prototype/app.js` (about 1,700
lines in one file) becomes hard to maintain: components, TypeScript, server-side routes in one codebase.

## Open items, by priority
1. **Finnhub licence:** free plan is personal-use only. Needed before a public launch.
2. **Google verification:** Search Console TXT record is added; wait for Google to finish the branding check, then
   re-request verification in Google Cloud > Auth Platform > Branding. Upload `prototype/brand/stiver-logo-120.png`.
3. **Contact email** for the privacy and terms pages: set `CONTACT_EMAIL` in `prototype/config.js`.
4. **CAPTCHA:** create a Cloudflare Turnstile widget, put the site key in `config.js`, enable it in Supabase with the secret.
5. **Supabase hardening:** minimum password length 8, leaked-password check (Pro plan), custom SMTP already on Resend.
6. **Staging environment:** separate Supabase project + `staging` branch; make `config.js` pick the project by hostname.
7. **Cross-user security test:** prove user B cannot read user A's rows (run as the `authenticated` role in a rolled-back transaction).
8. **Plans:** Vercel Hobby and Supabase Free are fine for now; public/commercial use needs Vercel Pro and Supabase Pro
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
- `budget_status` (SQL) only counts spending in the budget's own currency; the app converts, the database needs `fx_rates` filled.
- No SQL tests yet for investments, debts, trades, occasions or transfers.
- Advisor warning: `public.rls_auto_enable()` is callable by anon and signed-in users (not created by this repo).
- Not built: trade fees, average buy price and profit/loss, savings goals, a real LLM for AI tagging, offline queue,
  auto-translated default category names (they are stored in the database in English), email language per user.
