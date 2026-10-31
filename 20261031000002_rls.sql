-- Row Level Security: a user can only touch rows where user_id = their own id.
-- (select auth.uid()) is wrapped so Postgres evaluates it once per query.

alter table public.profiles     enable row level security;
alter table public.wallets      enable row level security;
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets      enable row level security;

-- profiles are keyed by id, not user_id
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- insert/delete: profile is created by the signup trigger and removed by cascade.

create policy wallets_all on public.wallets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy categories_all on public.categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy transactions_all on public.transactions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy budgets_all on public.budgets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Anonymous callers get nothing.
revoke all on public.profiles, public.wallets, public.categories,
              public.transactions, public.budgets from anon;
