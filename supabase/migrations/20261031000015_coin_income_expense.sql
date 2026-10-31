-- Income received into, and expenses paid from, a stablecoin (USDT/USDC) held in an investment account.
-- Such a transaction has no wallet; it points at the holding event that moved the coins instead.
alter table public.transactions alter column wallet_id drop not null;
alter table public.transactions
  add constraint transactions_source_chk check (wallet_id is not null or holding_event_id is not null);
