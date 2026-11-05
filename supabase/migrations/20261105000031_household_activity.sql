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
