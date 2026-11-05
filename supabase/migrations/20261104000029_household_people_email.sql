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
