-- Release 15 production: migrations 25..31 as ONE transaction (24 is already applied). Run in the Supabase dashboard SQL editor of project ukoxkwxmkwtlihbutryc.
begin;

-- ===== 20261104000025_household_hardening.sql =====
-- Household access, migration 1b: hardening found in Developer 2's review of migration 1 (24 is already applied and is not edited).
-- Notes that belong with migration 24 (kept here because an applied migration is never edited):
--  * the backfill in 24 rewrites every row of 11 tables in one transaction under a strong table lock: fine at today's data size;
--    for more than about 1 million rows, backfill in batches (or leave created_by NULL and use coalesce(created_by, user_id)).
--  * `select *` from household_invites fails for clients (token_hash is not granted): every client query lists its columns.

-- 1. household_state: readable only through household_owner(), so a member whose session was revoked cannot read it (M, answer 2)
drop policy household_state_select on public.household_state;
create policy household_state_select on public.household_state for select to authenticated
  using (owner_id = (select public.household_owner()));

-- 2. defence in depth: only an 'invited' user can become a member, only an 'owner' can have members (join-household sets the
--    member's status to 'member' AFTER inserting the membership, in the same transaction)
create or replace function public.household_members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select p.household_status from public.profiles p where p.id = new.member_id) is distinct from 'invited' then
    raise exception 'a household member must be an invited user' using errcode = '23514';
  end if;
  if (select p.household_status from public.profiles p where p.id = new.owner_id) is distinct from 'owner' then
    raise exception 'a household owner must have status owner' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.household_members_guard() from public, anon, authenticated;
create trigger household_members_guard before insert on public.household_members
  for each row execute function public.household_members_guard();

-- 3. why recurring_rule_id has no foreign key (M4)
comment on column public.transactions.recurring_rule_id is
  'Set by the client on rows a repeating rule generates; used by the BEFORE INSERT trigger to attribute the row to the rule creator. Deliberately NO foreign key: ON DELETE SET NULL would let an Editor who deletes a rule alter other people''s transactions (an RLS bypass). A dangling id is harmless; the trigger tolerates a missing rule.';

-- 4. household_status transitions (defence in depth, Opus 10): an owner cannot stop being an owner while members exist, and only an
--    'invited' profile can become 'member'
create or replace function public.household_status_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.household_status is distinct from old.household_status then
    if old.household_status = 'owner' and exists (select 1 from public.household_members m where m.owner_id = old.id) then
      raise exception 'an owner with members cannot change status' using errcode = '23514';
    end if;
    if new.household_status = 'member' and old.household_status <> 'invited' then
      raise exception 'only an invited profile can become a member' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.household_status_guard() from public, anon, authenticated;
create trigger household_status_guard before update of household_status on public.profiles
  for each row execute function public.household_status_guard();

-- 5. indexes the delete guards use (Opus 13)
create index if not exists holdings_account_idx on public.holdings (account_id);
create index if not exists holding_events_holding_idx on public.holding_events (holding_id);

-- 6. invite sends: one row per invite that was really created or resent (per-email cap across owners, E3). Attempts keep only the per-owner hourly limit.
create table public.invite_sends (
  id         bigint generated always as identity primary key,
  email_hash text not null,
  at         timestamptz not null default now()
);
create index invite_sends_email_idx on public.invite_sends (email_hash, at);
alter table public.invite_sends enable row level security;
revoke all on public.invite_sends from anon, authenticated;

-- 7. a join claims its invite before the password is set, so two simultaneous submits of the join form cannot both set a password
alter table public.household_invites add column claimed_at timestamptz;

-- ===== 20261104000026_household_rls.sql =====
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

-- ===== 20261104000027_household_triggers.sql =====
-- Error contract: the guards in this file raise 42501 with a message starting 'household_guard:<kind>:<n>' (or 'household_guard:recurring_date'); an
-- RLS violation is also 42501 but has no such prefix. The client maps by the prefix to the guard texts and maps any other 42501 to
-- "only the person who added it or the owner can change this". Rollback of the household rollout is the 26 down script only; 25 and 27 stay.
-- Lock cost: the backfill in step 0 takes a strong lock per table and rewrites its rows in one transaction (fine at today's size; batch above ~1M rows).
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
-- rev is NOT touched on insert (the column default is 1): in INSERT ... ON CONFLICT DO UPDATE the EXCLUDED row is the row after this trigger,
-- so resetting rev here would turn every upsert that carries the client's rev into a false conflict (S1)
create or replace function public.household_stamp_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.created_by := coalesce(auth.uid(), new.user_id);
  new.updated_by := new.created_by;
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
  -- Only for a row that does not exist yet: the INSERT half of an upsert of an existing row (a re-save, or a retry after the rule was
  -- already advanced) must not be judged against the rule's next_date (S2). No kind check: a transfer rule also generates an expense
  -- fee row and coin rules go through other paths, and amounts are not checked either (S4, accepted residual risk in the design).
  if new.recurring_rule_id is not null
     and not exists (select 1 from public.transactions x where x.id = new.id)
     and coalesce((select s.has_members from public.household_state s where s.owner_id = new.user_id), false) then
    select * into r from public.recurring_rules ru where ru.id = new.recurring_rule_id and ru.user_id = new.user_id and ru.active;
    if found then
      -- bound: a due, not-yet-made occurrence. current_date is the database's UTC day while the app runs on the user's local day
      -- (UTC+7 in Indonesia), so one day of slack is allowed (S3).
      if new.occurred_at < r.next_date or new.occurred_at > current_date + 1 then
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

-- ===== 20261104000028_household_functions.sql =====
-- Household access, migration 4: sign-up trigger change, household lookups, member actions, and the service-only functions the
-- invite / join Edge Functions call (design sections 3, 5, 8). Clients get only the member-facing functions; everything that
-- touches invites or sessions is executable by service_role only.

-- 1. sign-up trigger: an address with a pending invite becomes an 'invited' profile and is NOT seeded (design 5.1 step 4, F1) --
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_currency char(3) := upper(coalesce(nullif(new.raw_user_meta_data ->> 'currency', ''), 'USD'));
  v_invited boolean := exists (select 1 from public.household_invites i
                               where i.email = lower(new.email) and i.status = 'pending' and i.expires_at > now());
begin
  if v_currency !~ '^[A-Z]{3}$' then
    v_currency := 'USD';
  end if;

  insert into public.profiles (id, display_name, default_currency, household_status)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
          v_currency,
          case when v_invited then 'invited' else 'owner' end);

  if v_invited then
    return new;   -- nothing to seed: this person works on the owner's data after joining
  end if;

  insert into public.wallets (user_id, name, type, currency)
  values (new.id, 'Cash', 'cash', v_currency);

  insert into public.categories (user_id, name, type, icon, color) values
    (new.id, 'Groceries',          'expense', '🛒', '#4A44C6'),
    (new.id, 'Dining',             'expense', '🍽️', '#8B8FF0'),
    (new.id, 'Transport',          'expense', '🚌', '#F5B800'),
    (new.id, 'Shopping',           'expense', '🛍️', '#EC4899'),
    (new.id, 'Bills & Utilities',  'expense', '🧾', '#14B8A6'),
    (new.id, 'Entertainment',      'expense', '🎬', '#F97316'),
    (new.id, 'Health',             'expense', '🩺', '#EF4444'),
    (new.id, 'Travel',             'expense', '✈️', '#0EA5E9'),
    (new.id, 'Other',              'expense', '⋯',  '#94A3B8'),
    (new.id, 'Salary',             'income',  '💼', '#22C55E'),
    (new.id, 'Freelance',          'income',  '💻', '#84CC16'),
    (new.id, 'Other income',       'income',  '➕', '#94A3B8');

  insert into public.categories (user_id, parent_id, name, type, icon, color)
  select new.id, p.id, s.name, p.type, s.icon, p.color
  from (values
    ('Groceries',     'Supermarket',    '🏬'), ('Groceries',     'Fresh market',   '🥬'),
    ('Dining',        'Coffee',         '☕'), ('Dining',        'Restaurants',    '🍴'), ('Dining', 'Delivery', '🛵'),
    ('Transport',     'Fuel',           '⛽'), ('Transport',     'Ride-hailing',   '🚕'), ('Transport',     'Public transit', '🚇'),
    ('Entertainment', 'Movies',         '🎬'), ('Entertainment', 'Streaming',      '📺'), ('Entertainment', 'Events', '🎟️')
  ) as s (parent, name, icon)
  join public.categories p on p.user_id = new.id and p.parent_id is null and p.name = s.parent;

  return new;
end;
$$;

-- 2. what a member may read of the owner's profile: only the household-level settings (profiles itself stays self-only) ----
create or replace function public.household_profile()
returns table (default_currency public.profiles.default_currency%type, period_day public.profiles.period_day%type,
               sample_ids public.profiles.sample_ids%type, language public.profiles.language%type)
language sql stable security definer set search_path = '' as $$
  select p.default_currency, p.period_day, p.sample_ids, p.language
  from public.profiles p where p.id = (select public.household_owner())
$$;

-- people in my household (owner, members, former members): filtered inside by household_owner(), zero rows for non-members
create or replace function public.household_people()
returns table (user_id uuid, display_name text, role text, former boolean, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, 'owner'::text, false, null::timestamptz
    from public.profiles p where p.id = (select public.household_owner())
  union all
  select m.member_id, p.display_name, m.role, false, m.added_at
    from public.household_members m join public.profiles p on p.id = m.member_id
   where m.owner_id = (select public.household_owner())
  union all
  select f.member_id, f.display_name, 'former'::text, true, f.removed_at
    from public.household_former_members f where f.owner_id = (select public.household_owner())
$$;

-- 3. member actions (clients call these; each checks who is calling) -------------------------------------------------------
create or replace function public.household_touch(p_owner uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.household_state (owner_id, rev, has_members)
  values (p_owner, 1, exists (select 1 from public.household_members m where m.owner_id = p_owner))
  on conflict (owner_id) do update
    set rev = public.household_state.rev + 1,
        has_members = exists (select 1 from public.household_members m where m.owner_id = p_owner)
$$;

create or replace function public.set_member_role(p_member uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select public.household_owner()) is distinct from auth.uid() then raise exception 'only the owner can change roles' using errcode = '42501'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'invalid role' using errcode = '22023'; end if;
  update public.household_members set role = p_role where owner_id = auth.uid() and member_id = p_member;
  if not found then raise exception 'not a member of your household' using errcode = '42501'; end if;
  perform public.household_touch(auth.uid());
end $$;

-- shared by remove_member (owner) and leave_household (member): the name stays on past entries and the person keeps a login with no
-- ledger. Access ends because the status 'former_member' makes household_owner() NULL (their sessions are not deleted)
create or replace function public.household_detach(p_owner uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.household_former_members (owner_id, member_id, display_name)
  select p_owner, p_member, p.display_name from public.profiles p where p.id = p_member
  on conflict (owner_id, member_id) do update set display_name = excluded.display_name, removed_at = now();
  delete from public.household_members where owner_id = p_owner and member_id = p_member;
  update public.profiles set household_status = 'former_member' where id = p_member;
  perform public.household_touch(p_owner);
end $$;

create or replace function public.remove_member(p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select public.household_owner()) is distinct from auth.uid() then raise exception 'only the owner can remove members' using errcode = '42501'; end if;
  if not exists (select 1 from public.household_members where owner_id = auth.uid() and member_id = p_member) then
    raise exception 'not a member of your household' using errcode = '42501';
  end if;
  perform public.household_detach(auth.uid(), p_member);
end $$;

create or replace function public.leave_household() returns void
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select m.owner_id into v_owner from public.household_members m where m.member_id = auth.uid();
  if v_owner is null then raise exception 'you are not a member of a household' using errcode = '42501'; end if;
  perform public.household_detach(v_owner, auth.uid());
end $$;

-- 4. service-only functions used by the Edge Functions (service_role; clients cannot execute them) ----------------------------
-- create_invite: cap check, existence check and insert in one transaction (S-13)
create or replace function public.create_invite(p_owner uuid, p_email text, p_role text, p_token_hash text, p_expires timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(p_email); v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('household:' || p_owner::text));
  if p_role not in ('editor', 'viewer') then return jsonb_build_object('result', 'invalid'); end if;
  if (select p.household_status from public.profiles p where p.id = p_owner) is distinct from 'owner'
     or exists (select 1 from public.household_members m where m.member_id = p_owner) then
    return jsonb_build_object('result', 'cannot_invite');
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email and u.email_confirmed_at is not null)
     or exists (select 1 from public.household_members m join auth.users u on u.id = m.member_id where lower(u.email) = v_email) then
    return jsonb_build_object('result', 'cannot_invite');
  end if;
  -- expired-but-unswept invites must not block or count (M2): mark this owner's stale rows expired first (the login clean-up runs in the sweeper)
  update public.household_invites set status = 'expired', token_hash = null
   where owner_id = p_owner and status = 'pending' and expires_at <= now();
  if exists (select 1 from public.household_invites i where i.owner_id = p_owner and i.email = v_email and i.status = 'pending' and i.expires_at > now()) then
    return jsonb_build_object('result', 'already_invited');
  end if;
  if (select count(*) from public.household_members where owner_id = p_owner)
   + (select count(*) from public.household_invites where owner_id = p_owner and status = 'pending' and expires_at > now()) >= 4 then
    return jsonb_build_object('result', 'full');
  end if;
  insert into public.household_invites (owner_id, email, role, invited_by, token_hash, expires_at)
  values (p_owner, v_email, p_role, p_owner, p_token_hash, p_expires) returning id into v_id;
  return jsonb_build_object('result', 'ok', 'invite_id', v_id);
end $$;

-- resend: new token, new expiry, same row (the old link stops working)
create or replace function public.resend_invite(p_owner uuid, p_invite uuid, p_token_hash text, p_expires timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.household_invites set token_hash = p_token_hash, expires_at = p_expires
   where id = p_invite and owner_id = p_owner and status = 'pending';
  return found;
end $$;

-- may the invited auth user be deleted? (never a real person's account; design 5.3 guard)
create or replace function public.can_delete_invited_user(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is null)
     and (select p.household_status from public.profiles p where p.id = p_user) = 'invited'
     and not exists (select 1 from public.household_members m where m.member_id = p_user or m.owner_id = p_user)
     and not exists (select 1 from public.wallets where user_id = p_user)
     and not exists (select 1 from public.categories where user_id = p_user)
     and not exists (select 1 from public.transactions where user_id = p_user)
     and not exists (select 1 from public.budgets where user_id = p_user)
     and not exists (select 1 from public.debts where user_id = p_user)
     and not exists (select 1 from public.investment_accounts where user_id = p_user)
     and not exists (select 1 from public.occasions where user_id = p_user)
     and not exists (select 1 from public.recurring_rules where user_id = p_user)
     and not exists (select 1 from public.manual_prices where user_id = p_user)
     and not exists (select 1 from public.support_reports where user_id = p_user)
     and not exists (select 1 from public.household_invites i where i.invited_user_id = p_user and i.status = 'pending' and i.expires_at > now())
$$;

-- revoke: clears the token; returns the invited user id and whether that login may be deleted (the Edge Function deletes it)
create or replace function public.revoke_invite(p_owner uuid, p_invite uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  update public.household_invites set status = 'revoked', token_hash = null
   where id = p_invite and owner_id = p_owner and status = 'pending' returning invited_user_id into v_user;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  return jsonb_build_object('result', 'ok', 'invited_user_id', v_user, 'deletable', v_user is not null and public.can_delete_invited_user(v_user));
end $$;

-- expiry: marks old pending invites expired and clears their tokens; returns how many
create or replace function public.household_expire_invites() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with e as (update public.household_invites set status = 'expired', token_hash = null
              where status = 'pending' and expires_at < now() returning 1)
  select count(*) into n from e;
  return n;
end $$;

-- logins awaiting deletion: revoked or expired invites whose invited login the database still allows to delete (retried every sweep, E11)
create or replace function public.household_logins_to_delete() returns table (invited_user_id uuid)
language sql stable security definer set search_path = '' as $$
  select distinct i.invited_user_id from public.household_invites i
   where i.status in ('revoked', 'expired') and i.invited_user_id is not null and public.can_delete_invited_user(i.invited_user_id)
$$;

-- does an account with this address exist? (signup-gate: one generic answer for fresh / existing / pending-invite addresses)
create or replace function public.email_exists(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where lower(u.email) = lower(p_email))
$$;

-- all sessions of a user end (sessions and, by foreign key, their refresh tokens): used at join (design 5.2 step 6)
create or replace function public.delete_user_sessions(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  delete from auth.sessions where user_id = p_user
$$;

-- join, step 1b: atomically claim the invite before the password is set (a second simultaneous submit gets false and changes nothing).
-- A claim older than 2 minutes counts as abandoned. Release gives it back when the password step fails.
create or replace function public.join_household_claim(p_invite uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.household_invites set claimed_at = now()
   where id = p_invite and status = 'pending' and expires_at > now() and (claimed_at is null or claimed_at < now() - interval '2 minutes');
  return found;
end $$;
create or replace function public.join_household_release(p_invite uuid) returns void
language sql security definer set search_path = '' as $$
  update public.household_invites set claimed_at = null where id = p_invite and status = 'pending'
$$;

-- join, step 1 (read-only, E1): the reason the invited account may not join, or 'ok'. No writes.
create or replace function public.join_household_check(p_invite uuid, p_user uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare i record; u record;
begin
  select * into i from public.household_invites where id = p_invite and status = 'pending' and expires_at > now();
  if not found or i.invited_user_id is distinct from p_user then return 'invalid'; end if;
  select * into u from auth.users where id = p_user;
  return case
    when u.id is null then 'missing_user'
    when lower(u.email) is distinct from i.email then 'email_changed'
    when coalesce(u.email_change, '') <> '' then 'pending_email_change'
    when coalesce(u.phone, '') <> '' then 'phone'
    when coalesce(u.phone_change, '') <> '' then 'phone_change'
    when u.banned_until is not null and u.banned_until > now() then 'banned'
    when coalesce(u.is_anonymous, false) then 'anonymous'
    when exists (select 1 from auth.identities x where x.user_id = p_user and x.provider <> 'email') then 'extra_identity'
    when exists (select 1 from auth.mfa_factors f where f.user_id = p_user) then 'mfa_factor'
    when (select pr.household_status from public.profiles pr where pr.id = p_user) is distinct from 'invited' then 'not_invited'
    when not public.can_delete_invited_user_rows(p_user) then 'owns_rows'
    else 'ok' end;
end $$;

-- join, step 4 (E1): called AFTER the Edge Function has set the password and confirmed the email. Re-runs the checks, writes the membership,
-- and ends every session of the login in the same transaction, so no session created earlier survives and, with the password set, nobody else
-- can sign in. A refusal revokes the invite and records a security event.
create or replace function public.join_household_apply(p_invite uuid, p_user uuid, p_display_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i record; v_bad text;
begin
  select * into i from public.household_invites where id = p_invite and status = 'pending' and expires_at > now() for update;
  if not found or i.invited_user_id is distinct from p_user then return jsonb_build_object('result', 'invalid'); end if;
  v_bad := public.join_household_check(p_invite, p_user);
  if v_bad <> 'ok' then
    update public.household_invites set status = 'revoked', token_hash = null where id = p_invite;
    insert into public.security_events (owner_id, kind, detail) values (i.owner_id, 'join_refused', jsonb_build_object('reason', v_bad));
    return jsonb_build_object('result', 'refused');
  end if;
  insert into public.household_members (owner_id, member_id, role) values (i.owner_id, p_user, i.role);
  update public.profiles set household_status = 'member', display_name = coalesce(nullif(trim(p_display_name), ''), display_name) where id = p_user;
  update public.household_invites set status = 'accepted', token_hash = null where id = p_invite;
  delete from auth.sessions where user_id = p_user;
  perform public.household_touch(i.owner_id);
  return jsonb_build_object('result', 'ok', 'owner_id', i.owner_id, 'role', i.role);
end $$;

-- helper for the check above: the user owns no rows at all
create or replace function public.can_delete_invited_user_rows(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.wallets where user_id = p_user)
     and not exists (select 1 from public.categories where user_id = p_user)
     and not exists (select 1 from public.transactions where user_id = p_user)
     and not exists (select 1 from public.budgets where user_id = p_user)
     and not exists (select 1 from public.debts where user_id = p_user)
     and not exists (select 1 from public.investment_accounts where user_id = p_user)
     and not exists (select 1 from public.occasions where user_id = p_user)
     and not exists (select 1 from public.recurring_rules where user_id = p_user)
     and not exists (select 1 from public.manual_prices where user_id = p_user)
     and not exists (select 1 from public.support_reports where user_id = p_user)
$$;

-- 5. a login is deleted: an owner's members become former members first (they then see the no-access page); a deleted member leaves their name ---
create or replace function public.household_owner_deleting() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- a member whose login is deleted keeps their name on past entries (M4)
  insert into public.household_former_members (owner_id, member_id, display_name)
  select m.owner_id, m.member_id, p.display_name from public.household_members m join public.profiles p on p.id = m.member_id
   where m.member_id = old.id
  on conflict (owner_id, member_id) do nothing;
  insert into public.household_former_members (owner_id, member_id, display_name)
  select m.owner_id, m.member_id, p.display_name from public.household_members m join public.profiles p on p.id = m.member_id
   where m.owner_id = old.id
  on conflict (owner_id, member_id) do nothing;
  update public.profiles set household_status = 'former_member' where id in (select m.member_id from public.household_members m where m.owner_id = old.id);
  return old;
end $$;
create trigger household_owner_deleting before delete on auth.users for each row execute function public.household_owner_deleting();

-- Scheduling: household_expire_invites() is run by a scheduled Edge Function (`invite-sweep`, daily, deletes the logins it returns through
-- the admin API); until it exists stale invites are also swept lazily by create_invite. household_people() returns full display names:
-- the client shows first names only (PRD decision).

-- 6. privileges ------------------------------------------------------------------------------------------------------------------
revoke execute on function public.household_profile(), public.household_people(), public.household_touch(uuid), public.set_member_role(uuid, text),
  public.household_detach(uuid, uuid), public.remove_member(uuid), public.leave_household(),
  public.create_invite(uuid, text, text, text, timestamptz), public.resend_invite(uuid, uuid, text, timestamptz),
  public.can_delete_invited_user(uuid), public.can_delete_invited_user_rows(uuid), public.revoke_invite(uuid, uuid), public.household_expire_invites(), public.household_logins_to_delete(), public.join_household_check(uuid, uuid), public.join_household_claim(uuid), public.join_household_release(uuid),
  public.delete_user_sessions(uuid), public.join_household_apply(uuid, uuid, text), public.household_owner_deleting(), public.email_exists(text) from public, anon, authenticated;
grant execute on function public.household_profile(), public.household_people(), public.set_member_role(uuid, text),
  public.remove_member(uuid), public.leave_household() to authenticated;
grant execute on function public.create_invite(uuid, text, text, text, timestamptz), public.resend_invite(uuid, uuid, text, timestamptz),
  public.can_delete_invited_user(uuid), public.revoke_invite(uuid, uuid), public.household_expire_invites(), public.household_logins_to_delete(), public.join_household_check(uuid, uuid), public.join_household_claim(uuid), public.join_household_release(uuid),
  public.delete_user_sessions(uuid), public.join_household_apply(uuid, uuid, text), public.email_exists(text) to service_role;

-- ===== 20261104000029_household_people_email.sql =====
-- Household access, migration 5: household_people() also returns each person's email (Figma member rows; PRD: members see names and emails).
-- The return type changes, so the function is dropped and recreated (28 is already applied and is not edited). Same scope and grants as before.
drop function public.household_people();
create function public.household_people()
returns table (user_id uuid, display_name text, role text, former boolean, since timestamptz, email text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, 'owner'::text, false, null::timestamptz, u.email::text
    from public.profiles p join auth.users u on u.id = p.id where p.id = (select public.household_owner())
  union all
  select m.member_id, p.display_name, m.role, false, m.added_at, u.email::text
    from public.household_members m join public.profiles p on p.id = m.member_id join auth.users u on u.id = m.member_id
   where m.owner_id = (select public.household_owner())
  union all
  select f.member_id, f.display_name, 'former'::text, true, f.removed_at, null::text
    from public.household_former_members f where f.owner_id = (select public.household_owner())
$$;
revoke execute on function public.household_people() from public, anon;
grant execute on function public.household_people() to authenticated;

-- ===== 20261104000030_household_stale_409.sql =====
-- Household access, migration 6: a stale revision must answer at once, not loop. Found on staging (spike 2): PostgREST retries any SQLSTATE 40001
-- (serialization_failure) with backoff, so a stale edit raised 'household_stale' once a second for about a minute and then returned 504.
-- PT409 is PostgREST's own convention: it is returned as HTTP 409 with the message, and is not retried. Only the error code changes.
create or replace function public.household_stamp_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.user_id := old.user_id;
  new.created_by := old.created_by;
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  if new.rev is distinct from old.rev
     and coalesce((select s.has_members from public.household_state s where s.owner_id = old.user_id), false) then
    raise exception 'household_stale' using errcode = 'PT409';
  end if;
  new.rev := old.rev + 1;
  return new;
end $$;

-- ===== 20261105000031_household_activity.sql =====
-- Household access, slice 2 (migration 31): the Activity log. One row per add, edit or delete on the money tables, written by AFTER row triggers
-- (security definer, so clients cannot write or forge it). Only households that have members are logged: a solo ledger behaves exactly as before.
-- Readable by every member of the household (Viewers too) through RLS on household_owner(); no client write grants.
-- Minimal data (PRD): item name, amount, currency, type, no ids beyond the entity id. Retention 180 days, purged by purge_household_activity()
-- (called daily by the invite-sweep Edge Function with the service role). Additive: nothing existing changes. Rollback: drop table activity_log cascade
-- and drop the triggers/functions named below.

create table public.activity_log (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null,                       -- the data owner (household); no FK so an owner's deletion does not fight its own cascade
  actor_id    uuid,                                -- who did it (null if no JWT)
  actor_name  text not null default '',            -- snapshot of the display name, so a removed member keeps their name
  entity      text not null,                       -- table name
  entity_id   uuid not null,
  action      text not null check (action in ('create', 'update', 'delete')),
  summary     jsonb not null default '{}'::jsonb,  -- {name, amount_minor, currency, type, was_amount_minor, balance_minor, was_balance_minor}
  at          timestamptz not null default now()
);
create index activity_log_owner_at on public.activity_log (owner_id, at desc);
alter table public.activity_log enable row level security;
revoke all on public.activity_log from anon, authenticated;
grant select on public.activity_log to authenticated;
create policy activity_log_select on public.activity_log for select to authenticated using (owner_id = (select public.household_owner()));

create or replace function public.household_log_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb; o jsonb; r jsonb; act text; s jsonb; nm text;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); act := 'delete'; else r := to_jsonb(new); act := case when tg_op = 'INSERT' then 'create' else 'update' end; end if;
  if not coalesce((select st.has_members from public.household_state st where st.owner_id = (r ->> 'user_id')::uuid), false) then return null; end if;
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    -- nothing the person can see changed (stamps, revision, timestamps only): not an activity
    if (r - 'rev' - 'updated_by' - 'updated_at') = (o - 'rev' - 'updated_by' - 'updated_at') then return null; end if;
  end if;
  nm := left(coalesce(nullif(r ->> 'name', ''), nullif(r ->> 'note', ''), nullif(r ->> 'symbol', ''), nullif(r ->> 'kind', '')), 80);
  s := jsonb_strip_nulls(jsonb_build_object('name', nm, 'amount_minor', coalesce(r -> 'amount_minor', r -> 'original_minor'), 'currency', r -> 'currency', 'type', r -> 'type'));
  -- an edit that changed the amount keeps the old one ("was ..."); a balance change: an account whose starting balance was edited
  if tg_op = 'UPDATE' and coalesce(o -> 'amount_minor', o -> 'original_minor') is distinct from coalesce(r -> 'amount_minor', r -> 'original_minor') then
    s := s || jsonb_strip_nulls(jsonb_build_object('was_amount_minor', coalesce(o -> 'amount_minor', o -> 'original_minor')));
  end if;
  if tg_table_name = 'wallets' and tg_op = 'UPDATE' and (o -> 'opening_balance_minor') is distinct from (r -> 'opening_balance_minor') then
    s := s || jsonb_build_object('balance_minor', r -> 'opening_balance_minor', 'was_balance_minor', o -> 'opening_balance_minor');
  end if;
  insert into public.activity_log (owner_id, actor_id, actor_name, entity, entity_id, action, summary)
  values ((r ->> 'user_id')::uuid, auth.uid(),
          coalesce((select p.display_name from public.profiles p where p.id = auth.uid()), ''),
          tg_table_name, (r ->> 'id')::uuid, act, s);
  return null;
end $$;
revoke execute on function public.household_log_activity() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['wallets', 'transactions', 'categories', 'budgets', 'investment_accounts', 'holdings',
                           'holding_events', 'debts', 'debt_payments', 'occasions', 'recurring_rules'] loop
    execute format('create trigger household_log_ins after insert on public.%I for each row execute function public.household_log_activity()', t);
    execute format('create trigger household_log_upd after update on public.%I for each row execute function public.household_log_activity()', t);
    execute format('create trigger household_log_del after delete on public.%I for each row execute function public.household_log_activity()', t);
  end loop;
end $$;

-- 180-day retention, plus rows of owners that no longer exist; service role only
create or replace function public.purge_household_activity() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.activity_log a where a.at < now() - interval '180 days' or not exists (select 1 from public.profiles p where p.id = a.owner_id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_household_activity() from public, anon, authenticated;
grant execute on function public.purge_household_activity() to service_role;

commit;
