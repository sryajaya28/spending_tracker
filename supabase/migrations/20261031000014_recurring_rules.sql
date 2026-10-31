-- Recurring transactions: a rule repeats an expense, income, transfer or investment buy every week or month.
-- The app creates the due entries when it opens (with deterministic ids, so two devices never double-add).
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('txn', 'transfer', 'invest')),
  frequency text not null check (frequency in ('weekly', 'monthly')),
  start_date date not null,
  next_date date not null,
  end_date date,
  active boolean not null default true,
  spec jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index recurring_rules_user_idx on public.recurring_rules (user_id, active, next_date);
alter table public.recurring_rules enable row level security;
create policy recurring_rules_select on public.recurring_rules for select to authenticated using (user_id = auth.uid());
create policy recurring_rules_insert on public.recurring_rules for insert to authenticated with check (user_id = auth.uid());
create policy recurring_rules_update on public.recurring_rules for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy recurring_rules_delete on public.recurring_rules for delete to authenticated using (user_id = auth.uid());
revoke all on public.recurring_rules from anon;
