-- Down script for household migration 2 (RLS). Restores one owner-only policy per data table and the old defaults/grants.
-- Run only if the household rollout is abandoned; any member rows stop working (members get no access).
do $$
declare t text; pol record;
begin
  foreach t in array array['wallets', 'categories', 'transactions', 'budgets', 'investment_accounts', 'holdings',
                           'holding_events', 'manual_prices', 'debts', 'debt_payments', 'occasions', 'recurring_rules'] loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_all', t);
    execute format('alter table public.%I alter column user_id set default auth.uid()', t);
  end loop;
end $$;
grant update on public.profiles to authenticated;
