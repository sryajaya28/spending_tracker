-- Household access, migration 1 of 4 (additive; no policy changes, so every existing client keeps working).
-- Design: docs/prd/household-technical-design.md (sections 2, 3). Nothing here changes what an owner can read or write.

-- 1. who is what ------------------------------------------------------------------------------------------------
alter table public.profiles
  add column household_status text not null default 'owner'
  check (household_status in ('owner', 'invited', 'member', 'former_member'));

-- 2. new tables (RLS on; clients only get what is granted below, everything else goes through definer functions) ------
create table public.household_members (
  owner_id  uuid not null references auth.users (id) on delete cascade,
  member_id uuid not null unique references auth.users (id) on delete cascade,
  role      text not null check (role in ('editor', 'viewer')),
  added_at  timestamptz not null default now(),
  primary key (owner_id, member_id),
  check (owner_id <> member_id)
);

create table public.household_former_members (
  owner_id     uuid not null,
  member_id    uuid not null,
  display_name text not null,
  removed_at   timestamptz not null default now(),
  primary key (owner_id, member_id)
);

create table public.household_invites (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  email           text not null check (email = lower(email)),
  role            text not null check (role in ('editor', 'viewer')),
  invited_by      uuid not null references auth.users (id) on delete cascade,
  invited_user_id uuid references auth.users (id) on delete set null,
  token_hash      text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired'))
);
create unique index household_invites_pending_uniq on public.household_invites (owner_id, email) where status = 'pending';
create index household_invites_user_idx on public.household_invites (invited_user_id);
create index household_invites_email_idx on public.household_invites (email) where status = 'pending';

create table public.invite_attempts (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null,
  email_hash text not null,
  at         timestamptz not null default now()
);
create index invite_attempts_owner_idx on public.invite_attempts (owner_id, at);
create index invite_attempts_email_idx on public.invite_attempts (email_hash, at);

create table public.join_attempts (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  token_hash text not null,
  at         timestamptz not null default now()
);
create index join_attempts_ip_idx on public.join_attempts (ip_hash, at);
create index join_attempts_token_idx on public.join_attempts (token_hash, at);

create table public.household_state (
  owner_id    uuid primary key references auth.users (id) on delete cascade,
  rev         bigint not null default 0,
  has_members boolean not null default false
);

create table public.security_events (
  id       bigint generated always as identity primary key,
  owner_id uuid,
  kind     text not null,
  detail   jsonb not null default '{}',
  at       timestamptz not null default now()
);

alter table public.household_members        enable row level security;
alter table public.household_former_members enable row level security;
alter table public.household_invites        enable row level security;
alter table public.invite_attempts          enable row level security;
alter table public.join_attempts            enable row level security;
alter table public.household_state          enable row level security;
alter table public.security_events          enable row level security;

revoke all on public.household_members, public.household_former_members, public.household_invites, public.invite_attempts,
              public.join_attempts, public.household_state, public.security_events from anon, authenticated;

-- an owner or a member can read their own membership row; an owner lists pending invites without the token hash
grant select on public.household_members to authenticated;
create policy household_members_select on public.household_members for select to authenticated
  using (owner_id = (select auth.uid()) or member_id = (select auth.uid()));
grant select (id, owner_id, email, role, invited_user_id, created_at, expires_at, status) on public.household_invites to authenticated;
create policy household_invites_select on public.household_invites for select to authenticated
  using (owner_id = (select auth.uid()));
-- the poll row (section 7): readable by the household; written only by definer functions
grant select on public.household_state to authenticated;
create policy household_state_select on public.household_state for select to authenticated
  using (owner_id = (select auth.uid()) or owner_id in (select m.owner_id from public.household_members m where m.member_id = (select auth.uid())));

-- 3. who made a row, and the revision used for the stale-edit check (section 6 and 7) ---------------------------------
do $$
declare t text;
begin
  foreach t in array array['wallets', 'transactions', 'categories', 'budgets', 'investment_accounts', 'holdings',
                           'holding_events', 'debts', 'debt_payments', 'occasions', 'recurring_rules'] loop
    execute format('alter table public.%I add column created_by uuid, add column updated_by uuid, add column rev int not null default 1', t);
  end loop;
end $$;
alter table public.transactions add column recurring_rule_id uuid;

-- Backfill: everything that exists today was made by its owner. User triggers are switched off for the update so that
-- updated_at, tree checks and later audit triggers are not touched (design S3); the triggers that set created_by come later.
do $$
declare t text;
begin
  foreach t in array array['wallets', 'transactions', 'categories', 'budgets', 'investment_accounts', 'holdings',
                           'holding_events', 'debts', 'debt_payments', 'occasions', 'recurring_rules'] loop
    execute format('alter table public.%I disable trigger user', t);
    execute format('update public.%I set created_by = user_id, updated_by = user_id where created_by is null', t);
    execute format('alter table public.%I enable trigger user', t);
  end loop;
end $$;

-- 4. helper functions (security definer, fixed search_path, executable by signed-in users only) -----------------------
-- household_owner(): whose data the caller works on. Owners and solo users get their own id (a profile with status 'owner').
-- A member gets the owner's id only while their session still exists (instant revocation); if auth.sessions or the claim is
-- unreadable the member gets NULL = no access (fail closed). 'invited' and 'former_member' always get NULL.
create or replace function public.household_owner() returns uuid
language sql stable security definer set search_path = '' as $$
  select case
    when (select p.household_status from public.profiles p where p.id = auth.uid()) = 'owner' then auth.uid()
    else (select m.owner_id from public.household_members m
          where m.member_id = auth.uid()
            and (select p.household_status from public.profiles p where p.id = auth.uid()) = 'member'
            and exists (select 1 from auth.sessions s
                        where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid and s.user_id = auth.uid()))
  end
$$;

-- is_writer(): owner or editor (never a viewer, an invited or a former member)
create or replace function public.is_writer() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select public.household_owner()) = auth.uid()
    or exists (select 1 from public.household_members m
               where m.member_id = auth.uid() and m.owner_id = (select public.household_owner()) and m.role = 'editor'),
    false)
$$;

revoke execute on function public.household_owner(), public.is_writer() from public, anon;
grant execute on function public.household_owner(), public.is_writer() to authenticated;
