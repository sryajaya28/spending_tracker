-- Investments: accounts hold several assets (crypto, US stocks/ETFs). Quantities change through
-- dated events, so month-end holdings can be rebuilt and valued with cached prices.
-- Cost basis is v2: holding_events.unit_price_usd is reserved for it and unused for now.

create type public.asset_type as enum ('crypto', 'stablecoin', 'stock', 'etf', 'manual');

create table public.investment_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index investment_accounts_user_idx on public.investment_accounts (user_id);

create table public.holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id  uuid not null,
  -- unique key per asset: plain symbol, or "<SYMBOL>.US" when a stock/ETF shares its symbol with a
  -- crypto asset (BTC = Bitcoin vs a Bitcoin ETF). Display text comes from the Finnhub list.
  symbol      text not null check (symbol = upper(symbol) and length(symbol) between 1 and 16),
  provider_symbol text,                 -- what to quote, e.g. AAPL or BINANCE:BTCUSDT; null for manual assets
  name        text,
  asset_type  public.asset_type not null,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (id, user_id),
  unique (account_id, symbol),
  foreign key (account_id, user_id) references public.investment_accounts (id, user_id)
);
create index holdings_user_idx on public.holdings (user_id);

-- quantity_delta: + buy/deposit, - sell/withdraw. Quantity at a date = sum of deltas up to it.
create table public.holding_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  holding_id      uuid not null,
  occurred_at     date not null default current_date,
  quantity_delta  numeric(30, 12) not null check (quantity_delta <> 0),
  unit_price_usd  numeric(24, 8),             -- v2 (cost basis); null for now
  note            text,
  created_at      timestamptz not null default now(),
  foreign key (holding_id, user_id) references public.holdings (id, user_id) on delete cascade
);
create index holding_events_holding_date_idx on public.holding_events (holding_id, occurred_at);

-- Prices the user types in for assets no feed covers (gold, local funds, ...).
create table public.manual_prices (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol      text not null,
  price_date  date not null default current_date,
  price_usd   numeric(24, 8) not null check (price_usd >= 0),
  primary key (user_id, symbol, price_date)
);

-- Shared market data, written only by the server job (service role bypasses RLS).
-- Filled daily from Finnhub (stocks/ETFs), CoinGecko (crypto) and an FX source.
create table public.price_snapshots (
  symbol      text not null,
  price_date  date not null,
  price_usd   numeric(24, 8) not null check (price_usd >= 0),
  source      text,
  primary key (symbol, price_date)
);
create table public.fx_rates (
  currency   char(3) not null,
  rate_date  date not null,
  per_usd    numeric(24, 8) not null check (per_usd > 0),   -- units of currency per 1 USD
  primary key (currency, rate_date)
);

-- RLS ---------------------------------------------------------------------------
alter table public.investment_accounts enable row level security;
alter table public.holdings            enable row level security;
alter table public.holding_events      enable row level security;
alter table public.manual_prices       enable row level security;
alter table public.price_snapshots     enable row level security;
alter table public.fx_rates            enable row level security;

create policy investment_accounts_all on public.investment_accounts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy holdings_all on public.holdings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy holding_events_all on public.holding_events for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy manual_prices_all on public.manual_prices for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- market data: readable by any signed-in user, writable by nobody through the API
create policy price_snapshots_read on public.price_snapshots for select to authenticated using (true);
create policy fx_rates_read        on public.fx_rates        for select to authenticated using (true);

revoke all on public.investment_accounts, public.holdings, public.holding_events,
              public.manual_prices, public.price_snapshots, public.fx_rates from anon;
revoke insert, update, delete on public.price_snapshots, public.fx_rates from authenticated;

-- Portfolio value at the end of each of the last p_months months (current month = to date),
-- in the reporting currency's minor units. p_exponent is that currency's decimal places
-- (IDR 0, USD 2). Prices/rates use the latest snapshot on or before each month end.
create function public.portfolio_history(p_base char(3), p_exponent int default 2, p_months int default 6)
returns table (month date, value_minor bigint)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select (date_trunc('month', current_date) - make_interval(months => n))::date as m_start,
           least((date_trunc('month', current_date) - make_interval(months => n) + interval '1 month' - interval '1 day')::date, current_date) as m_end
    from generate_series(0, p_months - 1) as n
  ),
  qty as (
    select b.m_start, b.m_end, h.symbol, sum(e.quantity_delta) as q
    from bounds b
    join public.holdings h on h.user_id = auth.uid() and not h.archived
    join public.investment_accounts a on a.id = h.account_id and not a.archived
    join public.holding_events e on e.holding_id = h.id and e.occurred_at <= b.m_end
    group by b.m_start, b.m_end, h.symbol
  ),
  priced as (
    select q.m_start,
           q.q * coalesce(p.price_usd, mp.price_usd, 0) as usd
    from qty q
    left join lateral (
      select s.price_usd from public.price_snapshots s
      where s.symbol = q.symbol and s.price_date <= q.m_end
      order by s.price_date desc limit 1) p on true
    left join lateral (
      select m.price_usd from public.manual_prices m
      where m.user_id = auth.uid() and m.symbol = q.symbol and m.price_date <= q.m_end
      order by m.price_date desc limit 1) mp on true
  ),
  fx as (
    select b.m_start,
           case when p_base = 'USD' then 1
                else (select r.per_usd from public.fx_rates r
                      where r.currency = p_base and r.rate_date <= b.m_end
                      order by r.rate_date desc limit 1) end as rate
    from bounds b
  )
  select f.m_start,
         round(coalesce(sum(pr.usd), 0) * coalesce(f.rate, 0) * power(10, p_exponent))::bigint
  from fx f
  left join priced pr on pr.m_start = f.m_start
  group by f.m_start, f.rate
  order by f.m_start;
$$;

grant execute on function public.portfolio_history(char, int, int) to authenticated;
revoke execute on function public.portfolio_history(char, int, int) from anon, public;
