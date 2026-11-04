-- pgTAP tests for household migration 1. Run with: supabase test db
begin;
select plan(13);

-- rows that existed before this test (created before the migration ran) were backfilled to their owner
select is((select count(*)::int from public.wallets where created_by is null), 0, 'wallets: existing rows backfilled');
select is((select count(*)::int from public.categories where created_by is null), 0, 'categories: existing rows backfilled');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.dev'),
  ('00000000-0000-0000-0000-0000000000b1', 'editor@test.dev'),
  ('00000000-0000-0000-0000-0000000000c1', 'viewer@test.dev'),
  ('00000000-0000-0000-0000-0000000000d1', 'invited@test.dev'),
  ('00000000-0000-0000-0000-0000000000e1', 'former@test.dev');

update public.profiles set household_status = 'invited' where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1');
update public.profiles set household_status = 'former_member' where id = '00000000-0000-0000-0000-0000000000e1';
insert into public.household_members (owner_id, member_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'editor'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'viewer');
update public.profiles set household_status = 'member' where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
insert into auth.sessions (id, user_id) values
  ('00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000f0b1', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000f0c1', '00000000-0000-0000-0000-0000000000c1');

select col_is_null('public', 'transactions', 'recurring_rule_id', 'transactions.recurring_rule_id exists and is nullable');

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(public.household_owner(), '00000000-0000-0000-0000-0000000000a1'::uuid, 'owner works on own data (no session claim needed)');
select ok(public.is_writer(), 'owner is a writer');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0b1"}', true);
select is(public.household_owner(), '00000000-0000-0000-0000-0000000000a1'::uuid, 'editor with a live session works on the owner''s data');
select ok(public.is_writer(), 'editor is a writer');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0c1"}', true);
select ok(not public.is_writer(), 'viewer is not a writer');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000ffff"}', true);
select is(public.household_owner(), null, 'member without a live session gets no access (fail closed)');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(public.household_owner(), null, 'member without the session claim gets no access (fail closed)');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is(public.household_owner(), null, 'invited user has no access');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is(public.household_owner(), null, 'former member has no access');

select * from finish();
rollback;
