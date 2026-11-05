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
