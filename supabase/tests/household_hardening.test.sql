-- pgTAP tests for household migration 1b (hardening). Run with: supabase test db
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'owner2@test.dev'),
  ('00000000-0000-0000-0000-0000000000b2', 'editor2@test.dev'),
  ('00000000-0000-0000-0000-0000000000f2', 'stranger2@test.dev'),
  ('00000000-0000-0000-0000-0000000000a3', 'owner3@test.dev');
-- the guard: only an invited user can become a member, only an owner can have members
select throws_ok($$ insert into public.household_members (owner_id, member_id, role) values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f2', 'viewer') $$,
  '23514', 'a household member must be an invited user', 'a non-invited user cannot become a member');
update public.profiles set household_status = 'invited' where id = '00000000-0000-0000-0000-0000000000b2';
update public.profiles set household_status = 'former_member' where id = '00000000-0000-0000-0000-0000000000a3';
select throws_ok($$ insert into public.household_members (owner_id, member_id, role) values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b2', 'viewer') $$,
  '23514', 'a household owner must have status owner', 'a non-owner cannot have members');
insert into public.household_members (owner_id, member_id, role) values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', 'editor');
update public.profiles set household_status = 'member' where id = '00000000-0000-0000-0000-0000000000b2';
select throws_ok($$ update public.profiles set household_status = 'boss' where id = '00000000-0000-0000-0000-0000000000a2' $$, '23514', null, 'invalid household_status values are rejected');

insert into auth.sessions (id, user_id) values
  ('00000000-0000-0000-0000-00000000f1a2', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-00000000f1b2', '00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-00000000f1f2', '00000000-0000-0000-0000-0000000000f2');
insert into public.household_state (owner_id, rev, has_members) values ('00000000-0000-0000-0000-0000000000a2', 1, true);
insert into public.household_invites (owner_id, email, role, invited_by, expires_at, token_hash)
  values ('00000000-0000-0000-0000-0000000000a2', 'x@test.dev', 'viewer', '00000000-0000-0000-0000-0000000000a2', now() + interval '7 days', 'secret');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*)::int from public.household_state), 1, 'owner reads the household_state row');
select is((select count(id)::int from public.household_invites), 1, 'owner lists the invites (granted columns)');
select throws_ok($$ select token_hash from public.household_invites $$, '42501', null, 'token_hash is not readable by clients');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f1b2"}', true);
select is((select count(*)::int from public.household_state), 1, 'a member with a live session reads household_state');
select is((select count(id)::int from public.household_invites), 0, 'a member cannot read the invites');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000dead"}', true);
select is((select count(*)::int from public.household_state), 0, 'a member with a revoked session cannot read household_state');

select * from finish();
rollback;
