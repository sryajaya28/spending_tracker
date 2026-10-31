-- Loans you owe and money you lent share one shape: an original amount reduced by dated payments.
-- direction 'owed'  = a debt you owe (mortgage, car loan, credit card): subtracts from net worth.
-- direction 'lent'  = money someone owes you: counts as an asset until repaid.
-- Balance at any date = original_minor - sum(payments up to that date), so past months can be rebuilt.
-- Payments are not spending or income, so they never touch transactions or budgets.

create type public.debt_direction as enum ('owed', 'lent');
create type public.debt_type as enum ('mortgage', 'car', 'card', 'personal', 'other');

create table public.debts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  direction       public.debt_direction not null,
  name            text not null check (length(trim(name)) > 0),       -- loan name, or who borrowed from you
  type            public.debt_type,                                    -- only for direction = 'owed'
  currency        char(3) not null default 'USD',
  original_minor  bigint not null check (original_minor > 0),
  monthly_minor   bigint not null default 0 check (monthly_minor >= 0), -- planned monthly payment (owed)
  interest_rate   numeric(6, 3) check (interest_rate >= 0),             -- % per year, informational
  due_date        date,                                                -- optional, mostly for money lent
  note            text,
  start_month     date not null default date_trunc('month', current_date)::date,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (id, user_id)
);
create index debts_user_idx on public.debts (user_id);

create table public.debt_payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  debt_id       uuid not null,
  paid_on       date not null default current_date,
  amount_minor  bigint not null check (amount_minor > 0),
  created_at    timestamptz not null default now(),
  foreign key (debt_id, user_id) references public.debts (id, user_id) on delete cascade
);
create index debt_payments_debt_date_idx on public.debt_payments (debt_id, paid_on);

alter table public.debts         enable row level security;
alter table public.debt_payments enable row level security;

create policy debts_all on public.debts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy debt_payments_all on public.debt_payments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.debts, public.debt_payments from anon;

-- Outstanding balance per debt (original minus everything paid so far), for the signed-in user.
create view public.debt_balances
with (security_invoker = true) as
select d.id as debt_id, d.user_id, d.direction, d.name, d.currency, d.original_minor,
       d.original_minor - coalesce(sum(p.amount_minor), 0) as balance_minor
from public.debts d
left join public.debt_payments p on p.debt_id = d.id
group by d.id;
