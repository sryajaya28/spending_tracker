# Spendly: spending tracker

Record and categorize spending, track monthly budgets (overall or per category), and see your whole
net worth: savings, investments, money you lent, and loans you owe. Inspired by Spendee.

> **Status: working prototype.** The UI runs in the browser with demo data stored locally
> (`localStorage`). There is no sign-in and no multi-user backend yet. The Supabase schema is
> designed and applied, but the app does not use it yet. The planned stack is Next.js (PWA) + Supabase.

## What it does

- **Transactions:** expenses and income with categories and sub-categories, multi-currency wallets, and AI-style
  auto-tagging that falls back to "uncategorized" when unsure.
- **Budgets:** overall and per-category monthly budgets with ok / warning / exceeded states.
- **Portfolio** (one page, four tabs): Savings (wallets), Investment (crypto, US stocks and ETFs searched from
  Finnhub's full lists, with buy/sell and a Buy/Sell counterpart of a wallet or USDT/USDC), Lent (money others owe you),
  Loan (debts you owe, with payments).
- **Net worth** with month-over-month growth, shown in your reporting currency (IDR by default) or USD.
- Every record belongs to one user (`user_id`) and is protected by row-level security in the database schema.

## Run the prototype

Requires Python 3 (macOS has it). No Node needed.

```bash
cp .env.example .env.local     # then put your Finnhub key after FINNHUB_API_KEY=
python3 tools/dev_server.py 5173
```

Open http://localhost:5173. The dev server serves `prototype/` and proxies Finnhub so the API key stays
server-side. Without a key the app still works with built-in demo assets and demo exchange rates.

Data sources: Finnhub (stock/ETF/crypto symbols and prices), Frankfurter / ECB (fiat exchange rates, daily).

## Database

`supabase/migrations/` holds the schema in order (tables, row-level security, signup seeding, budget and
spending functions, investments, debts, trades). `supabase/tests/` has pgTAP tests for the first migrations
(run with `supabase test db`).

## Before releasing publicly

- Replace the browser-only storage with Supabase (auth, per-user data) in the Next.js app.
- Finnhub's free plan is for personal use. A public or commercial product needs a suitable Finnhub plan or another data source.
- Add a license and review third-party data terms.
- Never commit `.env.local`; it is gitignored.
