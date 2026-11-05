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
