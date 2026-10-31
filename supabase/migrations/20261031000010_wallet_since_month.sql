-- A wallet's opening balance only counts from the month the wallet starts, so net-worth history
-- for earlier months is not inflated by money that was added later.

alter table public.wallets
  add column since_month date not null default date_trunc('month', current_date)::date,
  add constraint wallets_since_month_chk check (since_month = date_trunc('month', since_month)::date);

-- existing wallets start in the month they were created
update public.wallets set since_month = date_trunc('month', created_at)::date;
