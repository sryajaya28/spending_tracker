-- Budgets for special occasions (a trip, a birthday dinner): a named one-off amount with optional dates.
-- Expenses are tagged to an occasion through transactions.occasion_id. They still count as normal spending
-- in monthly budgets; the occasion budget is an extra lens on a group of expenses.

create table public.occasions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  amount_minor  bigint not null check (amount_minor > 0),
  currency      char(3) not null default 'USD',
  start_date    date,
  end_date      date,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (id, user_id),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index occasions_user_idx on public.occasions (user_id);

alter table public.occasions enable row level security;
create policy occasions_all on public.occasions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.occasions from anon;

-- Deleting an occasion keeps its expenses and just clears the tag (only occasion_id is nulled, not user_id).
alter table public.transactions
  add column occasion_id uuid,
  add constraint transactions_occasion_fk foreign key (occasion_id, user_id)
    references public.occasions (id, user_id) on delete set null (occasion_id);
create index transactions_occasion_idx on public.transactions (occasion_id) where occasion_id is not null;
