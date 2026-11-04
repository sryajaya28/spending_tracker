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
