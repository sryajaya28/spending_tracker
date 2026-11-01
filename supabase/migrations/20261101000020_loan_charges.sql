-- A loan account (credit card, personal loan...) can pay for an expense: the expense is recorded as usual
-- (it counts as spending) and the loan balance goes UP by the same amount. That increase is a "charge" row
-- in debt_payments (kind = 'charge'), linked to its expense transaction so deleting the expense removes it.
alter table public.debt_payments
  add column if not exists kind text not null default 'payment' check (kind in ('payment', 'charge')),
  add column if not exists transaction_id uuid references public.transactions (id) on delete cascade;
create index if not exists debt_payments_transaction_idx on public.debt_payments (transaction_id);

-- the expense points at the loan it was paid with (instead of a wallet)
alter table public.transactions add column if not exists debt_id uuid;
alter table public.transactions drop constraint if exists transactions_debt_fk;
alter table public.transactions add constraint transactions_debt_fk foreign key (debt_id, user_id) references public.debts (id, user_id) on delete set null (debt_id);
alter table public.transactions drop constraint if exists transactions_source_chk;
alter table public.transactions add constraint transactions_source_chk check (wallet_id is not null or holding_event_id is not null or debt_id is not null);
create index if not exists transactions_debt_idx on public.transactions (debt_id);
