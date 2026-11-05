-- pgTAP tests for household migration 4 (functions). Run with: supabase test db. (First run: staging dry-run, before anything is applied.)
begin;
select plan(41);

-- owner O, a normal confirmed user X (cannot be invited), people for the invite flow ---------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'o@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000a9', 'x@test.dev', now());

-- handle_new_user: an address with a pending invite becomes 'invited' and is not seeded; a normal address is seeded -----------------
insert into public.household_invites (id, owner_id, email, role, invited_by, token_hash, expires_at)
values ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000a1', 'inv1@test.dev', 'editor', '00000000-0000-0000-0000-0000000000a1', 'h1', now() + interval '7 days');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'inv1@test.dev');
update public.household_invites set invited_user_id = '00000000-0000-0000-0000-0000000000b1' where id = '00000000-0000-0000-0000-00000000aa01';
select is((select household_status from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'invited', 'an invited address gets an invited profile');
select is((select count(*)::int from public.wallets where user_id = '00000000-0000-0000-0000-0000000000b1'), 0, 'and is not seeded');
select is((select household_status from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'owner', 'a normal address is an owner');
select is((select count(*)::int from public.wallets where user_id = '00000000-0000-0000-0000-0000000000a1'), 1, 'and is seeded as before');

-- create_invite: ok, already invited, existing account, not an owner, invalid role, cap (members + pending <= 4) -------------------
select is(public.create_invite('00000000-0000-0000-0000-0000000000a1', 'New@Test.dev', 'viewer', 'h2', now() + interval '7 days') ->> 'result', 'ok', 'create_invite ok (email stored lower-case)');
select is((select count(*)::int from public.household_invites where email = 'new@test.dev'), 1, 'the address is stored lower-cased');
select is(public.create_invite('00000000-0000-0000-0000-0000000000a1', 'new@test.dev', 'viewer', 'h3', now() + interval '7 days') ->> 'result', 'already_invited', 'a second invite to the same address is already_invited');
select is(public.create_invite('00000000-0000-0000-0000-0000000000a1', 'X@test.dev', 'viewer', 'h4', now() + interval '7 days') ->> 'result', 'cannot_invite', 'an address that already has an account cannot be invited');
select is(public.create_invite('00000000-0000-0000-0000-0000000000a1', 'z@test.dev', 'boss', 'h5', now() + interval '7 days') ->> 'result', 'invalid', 'an invalid role is refused');
select is(public.create_invite('00000000-0000-0000-0000-0000000000b1', 'q@test.dev', 'viewer', 'h6', now() + interval '7 days') ->> 'result', 'cannot_invite', 'a non-owner cannot invite');
select is(public.create_invite('00000000-0000-0000-0000-0000000000a1', 'c@test.dev', 'viewer', 'h7', now() + interval '7 days') ->> 'result', 'ok', 'third pending invite');
select is(public.create_invite('00000000-0000-0000-0000-0000000000a1', 'd@test.dev', 'viewer', 'h8', now() + interval '7 days') ->> 'result', 'ok', 'fourth pending invite');
select is(public.create_invite('00000000-0000-0000-0000-0000000000a1', 'e@test.dev', 'viewer', 'h9', now() + interval '7 days') ->> 'result', 'full', 'a fifth person (owner + 4) is refused: household is full');
update public.household_invites set expires_at = now() - interval '1 day' where email = 'd@test.dev';
select is(public.create_invite('00000000-0000-0000-0000-0000000000a1', 'e@test.dev', 'viewer', 'h9', now() + interval '7 days') ->> 'result', 'ok', 'an expired invite no longer counts toward the cap');

-- resend rotates the token; revoke clears it; can_delete_invited_user guards ---------------------------------------------------------
select is(public.resend_invite('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000aa01', 'h1-new', now() + interval '7 days'), true, 'resend works for a pending invite');
select is((select token_hash from public.household_invites where id = '00000000-0000-0000-0000-00000000aa01'), 'h1-new', 'resend replaced the token (old link dead)');
select is(public.can_delete_invited_user('00000000-0000-0000-0000-0000000000b1'), false, 'an invited user with a pending invite is not deletable while another pending invite points at them');
update public.household_invites set status = 'revoked', token_hash = null where id = '00000000-0000-0000-0000-00000000aa01';
select is(public.can_delete_invited_user('00000000-0000-0000-0000-0000000000b1'), true, 'an unconfirmed, empty, invited user without a pending invite is deletable');
select is(public.can_delete_invited_user('00000000-0000-0000-0000-0000000000a9'), false, 'a confirmed user is never deletable');

-- join_household_apply: ok, and the account checks refuse tampered accounts ---------------------------------------------------------------
insert into public.household_invites (id, owner_id, email, role, invited_by, invited_user_id, token_hash, expires_at)
values ('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000a1', 'inv1@test.dev', 'editor', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'j1', now() + interval '7 days');
insert into auth.sessions (id, user_id) values ('00000000-0000-0000-0000-00000000f0b0', '00000000-0000-0000-0000-0000000000b1');
select is(public.join_household_check('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000b1'), 'ok', 'the read-only join check passes for a clean invited account');
select is((select status from public.household_invites where id = '00000000-0000-0000-0000-00000000aa02'), 'pending', 'and the check changed nothing');
select is(public.join_household_apply('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000b1', 'Rina Sari') ->> 'result', 'ok', 'a clean invited account joins');
select is((select household_status from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'member', 'the profile becomes member');
select is((select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-0000000000b1'), 0, 'joining ends every session of the login in the same transaction');
select is((select has_members from public.household_state where owner_id = '00000000-0000-0000-0000-0000000000a1'), true, 'household_state says the household has members');
select is((select token_hash from public.household_invites where id = '00000000-0000-0000-0000-00000000aa02'), null, 'the used invite no longer holds a token');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b2', 'phone@test.dev');
insert into public.household_invites (id, owner_id, email, role, invited_by, invited_user_id, token_hash, expires_at)
values ('00000000-0000-0000-0000-00000000aa03', '00000000-0000-0000-0000-0000000000a1', 'phone@test.dev', 'viewer', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'j2', now() + interval '7 days');
update public.profiles set household_status = 'invited' where id = '00000000-0000-0000-0000-0000000000b2';
update auth.users set phone = '+620000000' where id = '00000000-0000-0000-0000-0000000000b2';
select is(public.join_household_check('00000000-0000-0000-0000-00000000aa03', '00000000-0000-0000-0000-0000000000b2'), 'phone', 'the read-only check names the reason for an account that gained a phone number');
select is(public.join_household_apply('00000000-0000-0000-0000-00000000aa03', '00000000-0000-0000-0000-0000000000b2', 'P') ->> 'result', 'refused', 'an account that gained a phone number is refused');
select is((select detail ->> 'reason' from public.security_events order by id desc limit 1), 'phone', 'and the reason is recorded');

-- reverse order fails: a profile that is not 'invited' cannot be inserted as a member --------------------------------------------------
select throws_ok($$ insert into public.household_members (owner_id, member_id, role) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a9', 'viewer') $$, '23514', 'a household member must be an invited user', 'the member must be invited first; setting status member before inserting fails');

-- member actions: who may do what, and what removal leaves behind -------------------------------------------------------------------------------
insert into auth.sessions (id, user_id) values
  ('00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000f0b1', '00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0b1"}', true);
select throws_ok($$ select public.set_member_role('00000000-0000-0000-0000-0000000000b1', 'viewer') $$, '42501', 'only the owner can change roles', 'a member cannot change roles');
select throws_ok($$ select public.remove_member('00000000-0000-0000-0000-0000000000b1') $$, '42501', 'only the owner can remove members', 'a member cannot remove members');
select is((select count(*)::int from public.household_people()), 2, 'a member sees the owner and the members (names for the labels)');
select is((select count(*)::int from public.household_profile()), 1, 'a member reads the owner''s household settings through household_profile()');
select throws_ok($$ select public.create_invite('00000000-0000-0000-0000-0000000000a1', 'hack@test.dev', 'viewer', 'x', now() + interval '1 day') $$, '42501', 'permission denied for function create_invite', 'clients cannot call the service-only invite function');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0a1"}', true);
select lives_ok($$ select public.set_member_role('00000000-0000-0000-0000-0000000000b1', 'viewer') $$, 'the owner changes a role');
select lives_ok($$ select public.remove_member('00000000-0000-0000-0000-0000000000b1') $$, 'the owner removes a member');
reset role;
select is((select household_status from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'former_member', 'a removed member becomes a former member');
select is((select count(*)::int from public.household_former_members where owner_id = '00000000-0000-0000-0000-0000000000a1' and member_id = '00000000-0000-0000-0000-0000000000b1'), 1, 'and their name is kept for past entries');
select is((select has_members from public.household_state where owner_id = '00000000-0000-0000-0000-0000000000a1'), false, 'the household has no members left');
select public.delete_user_sessions('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-0000000000b1'), 0, 'delete_user_sessions ends all sessions of a user');

select * from finish();
rollback;
