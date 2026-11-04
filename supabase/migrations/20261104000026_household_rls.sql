-- Household access, migration 2: row-level security for households (design section 4, 4a, 8).
-- Owner and solo behaviour is identical to before: household_owner() = auth.uid() for them, evaluated once per query as an
-- initplan (never per row). Members work on the owner's rows through the same policies. Down script:
-- supabase/migrations_down/20261104000026_household_rls.down.sql

-- Cost note: household_owner() is a security definer function; as `(select household_owner())` it is evaluated once per query (initplan). As a column
-- default it runs once per inserted row: for an owner it is one profiles primary-key lookup. Service-role inserts must send user_id.
-- support_reports is deliberately person-scoped (a support request belongs to the person who sent it) and is not changed here.

-- 1. every policy on the 12 data tables is replaced (found by loop, not by name: recurring_rules has four of its own) -----
do $$
declare t text; pol record;
begin
  foreach t in array array['wallets', 'categories', 'transactions', 'budgets', 'investment_accounts', 'holdings',
                           'holding_events', 'manual_prices', 'debts', 'debt_payments', 'occasions', 'recurring_rules'] loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select public.household_owner()))',
                   t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select public.household_owner()) and (select public.is_writer()))',
                   t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select public.household_owner()) and (select public.is_writer())) with check (user_id = (select public.household_owner()) and (select public.is_writer()))',
                   t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select public.household_owner()) and (select public.is_writer()))',
                   t || '_delete', t);
    -- a row written without a user_id lands on the household owner
    execute format('alter table public.%I alter column user_id set default public.household_owner()', t);
  end loop;
end $$;

-- 2. Editors change only the transactions they created; the owner changes any (design 4a) --------------------------------
drop policy transactions_update on public.transactions;
drop policy transactions_delete on public.transactions;
create policy transactions_update on public.transactions for update to authenticated
  using (user_id = (select public.household_owner()) and (select public.is_writer())
         and ((select public.household_owner()) = (select auth.uid()) or created_by = (select auth.uid())))
  with check (user_id = (select public.household_owner()) and (select public.is_writer())
         and ((select public.household_owner()) = (select auth.uid()) or created_by = (select auth.uid())));
create policy transactions_delete on public.transactions for delete to authenticated
  using (user_id = (select public.household_owner()) and (select public.is_writer())
         and ((select public.household_owner()) = (select auth.uid()) or created_by = (select auth.uid())));

-- rows that exist because of someone's transaction follow that transaction: an investment event behind another person's
-- transaction, and a debt payment record that points at one
drop policy holding_events_update on public.holding_events;
drop policy holding_events_delete on public.holding_events;
create policy holding_events_update on public.holding_events for update to authenticated
  using (user_id = (select public.household_owner()) and (select public.is_writer())
         and ((select public.household_owner()) = (select auth.uid())
              or not exists (select 1 from public.transactions t
                             where t.holding_event_id = holding_events.id and t.user_id = holding_events.user_id
                               and t.created_by is distinct from (select auth.uid()))))
  with check (user_id = (select public.household_owner()) and (select public.is_writer())
         and ((select public.household_owner()) = (select auth.uid())
              or not exists (select 1 from public.transactions t
                             where t.holding_event_id = holding_events.id and t.user_id = holding_events.user_id
                               and t.created_by is distinct from (select auth.uid()))));
create policy holding_events_delete on public.holding_events for delete to authenticated
  using (user_id = (select public.household_owner()) and (select public.is_writer())
         and ((select public.household_owner()) = (select auth.uid())
              or not exists (select 1 from public.transactions t
                             where t.holding_event_id = holding_events.id and t.user_id = holding_events.user_id
                               and t.created_by is distinct from (select auth.uid()))));

-- an Editor cannot attach a new debt payment record to the owner's (or anyone else's) transaction
drop policy debt_payments_insert on public.debt_payments;
create policy debt_payments_insert on public.debt_payments for insert to authenticated
  with check (user_id = (select public.household_owner()) and (select public.is_writer())
         and ((select public.household_owner()) = (select auth.uid()) or transaction_id is null
              or exists (select 1 from public.transactions t
                         where t.id = debt_payments.transaction_id and t.user_id = debt_payments.user_id and t.created_by = (select auth.uid()))));
drop policy debt_payments_update on public.debt_payments;
drop policy debt_payments_delete on public.debt_payments;
create policy debt_payments_update on public.debt_payments for update to authenticated
  using (user_id = (select public.household_owner()) and (select public.is_writer())
         and ((select public.household_owner()) = (select auth.uid()) or transaction_id is null
              or exists (select 1 from public.transactions t
                         where t.id = debt_payments.transaction_id and t.user_id = debt_payments.user_id and t.created_by = (select auth.uid()))))
  with check (user_id = (select public.household_owner()) and (select public.is_writer())
         and ((select public.household_owner()) = (select auth.uid()) or transaction_id is null
              or exists (select 1 from public.transactions t
                         where t.id = debt_payments.transaction_id and t.user_id = debt_payments.user_id and t.created_by = (select auth.uid()))));
create policy debt_payments_delete on public.debt_payments for delete to authenticated
  using (user_id = (select public.household_owner()) and (select public.is_writer())
         and ((select public.household_owner()) = (select auth.uid()) or transaction_id is null
              or exists (select 1 from public.transactions t
                         where t.id = debt_payments.transaction_id and t.user_id = debt_payments.user_id and t.created_by = (select auth.uid()))));

-- 3. profiles: a client may write only the settings it really writes; household_status is not writable by any client (B-3) -
revoke update on public.profiles from authenticated;
grant update (display_name, default_currency, ai_tagging_enabled, sample_ids, language, theme, period_day) on public.profiles to authenticated;
