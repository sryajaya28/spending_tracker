# Next steps: porting the prototype to Next.js

The prototype in `prototype/` is the product spec. `prototype/app.js` is one file; its selectors and
rules deliberately mirror the SQL in `supabase/migrations/`. Build the Next.js app against that.

## Stack (decided)
Next.js (App Router, TypeScript) as an installable PWA, Tailwind + shadcn/ui, Supabase (Postgres, Auth, RLS),
Vercel. Money is stored as integer minor units plus a currency code. Never use floats for money.

## Environment variables
| Name | Where | Notes |
|---|---|---|
| `FINNHUB_API_KEY` | server only | Never `NEXT_PUBLIC_*`. Free plan is personal-use only. |
| Supabase URL + anon key | client | Project name: `spending_tracker` (ask the owner for the ref). |

## Suggested order
1. Scaffold Next.js PWA (manifest, service worker). Add Supabase auth with sessions that never expire
   (refresh-token rotation on, no time-box or inactivity timeout, a devices screen to revoke sessions).
2. Generate TS types from the schema. Wire sign-up to pass `options.data.currency` (the `handle_new_user`
   trigger seeds the profile, a Cash wallet and 12 default categories).
3. Port screens in this order: Transactions, Budgets, Overview, Portfolio (Savings, Investment, Lent, Loan).
   Use the SQL functions for reads: `budget_status`, `spending_by_category`, `portfolio_history`, view `wallet_balances`.
4. Replace `tools/dev_server.py` with Next.js route handlers: Finnhub symbol search (cache the ~31k-symbol list),
   price quotes, and fiat FX (Frankfurter/ECB, daily). Add a daily job that writes `price_snapshots` and `fx_rates`
   so growth history does not depend on API history limits.
5. Offline queue for new transactions (client-generated UUID ids make syncs idempotent).
6. Tests: extend `supabase/tests/` (investments, debts, trades, stablecoin swaps) and add Playwright e2e.

## Rules the prototype already encodes (keep them)
- Sub-categories are one level deep and roll up into their parent for totals and budgets.
- A budget applies from its `start_month` until a later row for the same scope replaces it.
- Wallet transfers (buying or selling assets) are not income or spending. Budgets ignore them.
- Paying with or receiving USDT/USDC creates two paired `holding_events` (`pair_id`), no wallet transfer.
- Loan and lent payments are not spending or income; balance = original minus payments.
- Net worth = savings + investments + money lent - loans, converted to the reporting currency at the day's rate.

## Known gaps
- `budget_status` only counts spending in the budget's own currency. The prototype converts; the database needs `fx_rates`.
- No SQL tests yet for investments, debts or trades.
- Advisor warning: `public.rls_auto_enable()` is callable by anon and signed-in users (not created by this repo).
- Not built yet: trade fees, average buy price and profit/loss (v2), savings goals (v2), the real LLM for AI tagging,
  coin-to-coin swaps other than via USDT/USDC, linking loan payments to a wallet.
