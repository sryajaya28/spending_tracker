-- Household access, slice 2 (migration 32): the Activity log also keeps the old amount (was_amount_minor) and, for an edited account balance,
-- the old balance (was_balance_minor), for the "was ..." rows of the Activity page. Function body only; migration 31 stays as applied.

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
