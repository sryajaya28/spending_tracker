# Stiver: spending tracker

Record and categorize spending, track monthly budgets (overall or per category), and see your whole
net worth: savings, investments, money you lent, and loans you owe. Inspired by Spendee.

> **Status: working prototype with accounts.** Users sign up and sign in (email + password with email
> confirmation, or Google). Each user's data is stored in Supabase and protected by row-level security.
> The UI is a static browser app in `prototype/`; the planned stack is Next.js (PWA) + Supabase.

## What it does

- **Transactions:** expenses and income with categories and sub-categories, multi-currency wallets, and AI-style
  auto-tagging that falls back to "uncategorized" when unsure.
- **Budgets:** overall and per-category monthly budgets with ok / warning / exceeded states.
- **Portfolio** (one page, four tabs): Savings (wallets), Investment (crypto, US stocks and ETFs searched from
  Finnhub's full lists, with buy/sell and a Buy/Sell counterpart of a wallet or USDT/USDC), Lent (money others owe you),
  Loan (debts you owe, with payments).
- **Net worth** with month-over-month growth, shown in your reporting currency (IDR by default) or USD.
- **Special occasions:** one-off budgets such as "Bali Trip" or "Birthday Dinner"; tag expenses to them when you add a transaction.
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

## Accounts and data

`prototype/config.js` holds the Supabase project URL and the public (anon) key; the key is safe to publish because
row-level security guards the data. Never put the `service_role` key anywhere in this repo.
`prototype/cloud.js` signs users in, loads their rows and saves only what changed. In the Supabase dashboard:

- Authentication > Providers > Email: keep **Confirm email** on.
- Authentication > Providers > Google: add a Google OAuth client ID and secret (redirect URI shown on that page).
- Authentication > URL Configuration: set the Site URL to the deployed address and add it (and `http://localhost:5173`) to the redirect URLs.

New accounts start empty (a Cash wallet and starter categories). Settings has an optional "Load sample data" button.

## Database

`supabase/migrations/` holds the schema in order (tables, row-level security, signup seeding, budget and
spending functions, investments, debts, trades, special occasions). `supabase/tests/` has pgTAP tests for the first migrations
(run with `supabase test db`).

## Before releasing publicly

- Replace the browser-only storage with Supabase (auth, per-user data) in the Next.js app.
- Finnhub's free plan is for personal use. A public or commercial product needs a suitable Finnhub plan or another data source.
- Add a license and review third-party data terms.
- Never commit `.env.local`; it is gitignored.
