-- Household access, migration 3: who-made-it stamps, the stale-edit check, recurring-entry attribution, the poll counter
-- and the delete guards (design sections 6, 7, 4a). Owners and solo users: stamps only, no new rejections.

-- 0. second backfill: rows written since migration 1 (including new sign-ups' seed rows) have no creator yet (triggers off)
do $$
declare t text;
begin
  foreach t in array array['wallets', 'transactions', 'categories', 'budgets', 'investment_accounts', 'holdings',
                           'holding_events', 'debts', 'debt_payments', 'occasions', 'recurring_rules'] loop
    execute format('alter table public.%I disable trigger user', t);
    execute format('update public.%I set created_by = coalesce(created_by, user_id), updated_by = coalesce(updated_by, user_id) where created_by is null or updated_by is null', t);
    execute format('alter table public.%I enable trigger user', t);
  end loop;
end $$;

-- 1. stamps: the client cannot choose who made a row ---------------------------------------------------------------------
create or replace function public.household_stamp_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.created_by := coalesce(auth.uid(), new.user_id);
  new.updated_by := new.created_by;
  new.rev := 1;
  return new;
end $$;

-- transactions: same, plus attribution of rows a repeating rule generates (design 4a, C2, C2b). Only for households that have
-- members; a rule that does not exist yet (created in the same save: transactions are written before recurring_rules) or an
-- unknown id is ignored and the row belongs to the sender.
create or replace function public.household_stamp_insert_txn() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  new.created_by := coalesce(auth.uid(), new.user_id);
  new.updated_by := new.created_by;
  new.rev := 1;
  if new.recurring_rule_id is not null
     and coalesce((select s.has_members from public.household_state s where s.owner_id = new.user_id), false) then
    select * into r from public.recurring_rules ru where ru.id = new.recurring_rule_id and ru.user_id = new.user_id and ru.active;
    if found then
      -- structural kind check only (never amounts or currencies: transfer legs, invest and debt rows differ per kind)
      if (r.kind = 'txn' and new.type not in ('income', 'expense')) or (r.kind = 'transfer' and new.type <> 'transfer') then
        raise exception 'household_guard:recurring_kind' using errcode = '42501';
      end if;
      -- bound: a due, not-yet-made occurrence (the rule's next_date is advanced in the same save, after these rows)
      if new.occurred_at < r.next_date or new.occurred_at > current_date then
        raise exception 'household_guard:recurring_date' using errcode = '42501';
      end if;
      new.created_by := coalesce(r.created_by, new.created_by);
    end if;
  end if;
  return new;
end $$;

-- updates: ownership and the owner are pinned (ON CONFLICT DO UPDATE sends client values); the revision check runs only for
-- households that have members, so a solo ledger behaves exactly as before (no false conflicts after a lost response)
create or replace function public.household_stamp_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.user_id := old.user_id;
  new.created_by := old.created_by;
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  if new.rev is distinct from old.rev
     and coalesce((select s.has_members from public.household_state s where s.owner_id = old.user_id), false) then
    raise exception 'household_stale' using errcode = '40001';
  end if;
  new.rev := old.rev + 1;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['wallets', 'transactions', 'categories', 'budgets', 'investment_accounts', 'holdings',
                           'holding_events', 'debts', 'debt_payments', 'occasions', 'recurring_rules'] loop
    execute format('create trigger household_stamp_insert before insert on public.%I for each row execute function public.%s()',
                   t, case when t = 'transactions' then 'household_stamp_insert_txn' else 'household_stamp_insert' end);
    execute format('create trigger household_stamp_update before update on public.%I for each row execute function public.household_stamp_update()', t);
  end loop;
end $$;

-- 2. poll counter: one row per household, bumped by statement-level triggers (insert, update, delete) --------------------
create or replace function public.household_bump_new() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.household_state s set rev = s.rev + 1
   where s.has_members and s.owner_id in (select distinct n.user_id from new_rows n);
  return null;
end $$;
create or replace function public.household_bump_old() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.household_state s set rev = s.rev + 1
   where s.has_members and s.owner_id in (select distinct o.user_id from old_rows o);
  return null;
end $$;
do $$
declare t text;
begin
  foreach t in array array['wallets', 'transactions', 'categories', 'budgets', 'investment_accounts', 'holdings',
                           'holding_events', 'debts', 'debt_payments', 'occasions', 'recurring_rules'] loop
    execute format('create trigger household_bump_ins after insert on public.%I referencing new table as new_rows for each statement execute function public.household_bump_new()', t);
    execute format('create trigger household_bump_upd after update on public.%I referencing new table as new_rows for each statement execute function public.household_bump_new()', t);
    execute format('create trigger household_bump_del after delete on public.%I referencing old table as old_rows for each statement execute function public.household_bump_old()', t);
  end loop;
end $$;

-- 3. delete guards: foreign-key actions (cascade, set null) bypass RLS, so a member may not delete a row that other people's
--    transactions point at (design 4a, C1/C1b). Owner and service paths return immediately.
create or replace function public.household_delete_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text := tg_argv[0]; n int := 0;
begin
  if auth.uid() is null or (select public.household_owner()) is not distinct from auth.uid() then
    return old;
  end if;
  if k = 'wallet' then
    select count(*) into n from public.transactions t where t.user_id = old.user_id and t.wallet_id = old.id and t.created_by is distinct from auth.uid();
  elsif k = 'category' then
    select count(*) into n from public.transactions t
     where t.user_id = old.user_id and t.created_by is distinct from auth.uid()
       and t.category_id in (select c.id from public.categories c where c.user_id = old.user_id and (c.id = old.id or c.parent_id = old.id));
  elsif k = 'debt' then
    select count(*) into n from public.transactions t where t.user_id = old.user_id and t.debt_id = old.id and t.created_by is distinct from auth.uid();
  elsif k = 'occasion' then
    select count(*) into n from public.transactions t where t.user_id = old.user_id and t.occasion_id = old.id and t.created_by is distinct from auth.uid();
  elsif k = 'holding_event' then
    select count(*) into n from public.transactions t where t.user_id = old.user_id and t.holding_event_id = old.id and t.created_by is distinct from auth.uid();
  elsif k = 'holding' then
    select count(*) into n from public.transactions t
     where t.user_id = old.user_id and t.created_by is distinct from auth.uid()
       and t.holding_event_id in (select e.id from public.holding_events e where e.user_id = old.user_id and e.holding_id = old.id);
  elsif k = 'account' then
    select count(*) into n from public.transactions t
     where t.user_id = old.user_id and t.created_by is distinct from auth.uid()
       and t.holding_event_id in (select e.id from public.holding_events e join public.holdings h on h.id = e.holding_id and h.user_id = e.user_id
                                  where e.user_id = old.user_id and h.account_id = old.id);
  end if;
  if n > 0 then
    raise exception 'household_guard:%:%', k, n using errcode = '42501';
  end if;
  return old;
end $$;

create trigger household_delete_guard before delete on public.wallets for each row execute function public.household_delete_guard('wallet');
create trigger household_delete_guard before delete on public.categories for each row execute function public.household_delete_guard('category');
create trigger household_delete_guard before delete on public.debts for each row execute function public.household_delete_guard('debt');
create trigger household_delete_guard before delete on public.occasions for each row execute function public.household_delete_guard('occasion');
create trigger household_delete_guard before delete on public.holding_events for each row execute function public.household_delete_guard('holding_event');
create trigger household_delete_guard before delete on public.holdings for each row execute function public.household_delete_guard('holding');
create trigger household_delete_guard before delete on public.investment_accounts for each row execute function public.household_delete_guard('account');

-- trigger functions are not callable by clients
revoke execute on function public.household_stamp_insert(), public.household_stamp_insert_txn(), public.household_stamp_update(),
  public.household_bump_new(), public.household_bump_old(), public.household_delete_guard() from public, anon, authenticated;
