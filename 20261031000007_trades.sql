-- Buying or selling an asset moves money between a wallet and a holding, so the money stays in
-- circulation. Each trade is a holding_event (the quantity change) plus a linked 'transfer'
-- transaction on the wallet. Transfers are not income or spending, so budgets and monthly
-- spend functions (which only look at type = 'expense') ignore them.

create type public.transfer_direction as enum ('in', 'out');   -- 'out' = buy (money leaves the wallet), 'in' = sell

alter table public.holding_events add constraint holding_events_id_user_uniq unique (id, user_id);

alter table public.transactions
  add column transfer_direction public.transfer_direction,
  add column holding_event_id uuid,
  add constraint transactions_transfer_dir_chk check ((type = 'transfer') = (transfer_direction is not null)),
  -- removing the trade event also removes its wallet transfer, which restores the wallet balance
  add constraint transactions_holding_event_fk foreign key (holding_event_id, user_id)
    references public.holding_events (id, user_id) on delete cascade;

-- Paying with (or receiving) a stablecoin instead of a wallet: the trade becomes two holding_events
-- that share a pair_id, e.g. +0.005 BTC and -400 USDT. No wallet transfer is created for a pair.
alter table public.holding_events add column pair_id uuid;
create index holding_events_pair_idx on public.holding_events (pair_id) where pair_id is not null;

create unique index transactions_holding_event_uniq
  on public.transactions (holding_event_id) where holding_event_id is not null;

-- Wallet balance now counts transfers in and out.
create or replace view public.wallet_balances
with (security_invoker = true) as
select
  w.id as wallet_id,
  w.user_id,
  w.name,
  w.currency,
  w.opening_balance_minor
    + coalesce(sum(case
        when t.type = 'income'  or (t.type = 'transfer' and t.transfer_direction = 'in')  then  t.amount_minor
        when t.type = 'expense' or (t.type = 'transfer' and t.transfer_direction = 'out') then -t.amount_minor
        else 0
      end), 0) as balance_minor
from public.wallets w
left join public.transactions t on t.wallet_id = w.id
group by w.id;
