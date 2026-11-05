-- pgTAP tests for migration 31: the Activity log (written by triggers, readable by members, not writable by clients, purged after 180 days).
begin;
select plan(13);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'o@test.dev', now()), ('00000000-0000-0000-0000-0000000000b1', 'e@test.dev', now()), ('00000000-0000-0000-0000-0000000000c1', 'v@test.dev', now());
update public.profiles set display_name = 'Sari' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set display_name = 'Budi' where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set household_status = 'invited' where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
insert into public.household_members (owner_id, member_id, role) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'editor'), ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'viewer');
update public.profiles set household_status = 'member' where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
insert into auth.sessions (id, user_id) values ('00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-00000000f0b1', '00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-00000000f0c1', '00000000-0000-0000-0000-0000000000c1');

-- a solo ledger logs nothing (the household has no members yet)
insert into public.occasions (id, user_id, name) values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a1', 'Solo trip');
select is((select count(*)::int from public.activity_log), 0, 'no members yet: nothing is logged');
insert into public.household_state (owner_id, rev, has_members) values ('00000000-0000-0000-0000-0000000000a1', 1, true)
  on conflict (owner_id) do update set has_members = true;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0b1"}', true);
insert into public.transactions (id, wallet_id, type, amount_minor, currency, occurred_at, note)
select '00000000-0000-0000-0000-00000000c001', w.id, 'expense', 25000, 'IDR', current_date, 'Coffee' from public.wallets w where w.user_id = '00000000-0000-0000-0000-0000000000a1' limit 1;
select is((select actor_name || '/' || action || '/' || (summary ->> 'name') || '/' || (summary ->> 'amount_minor') from public.activity_log where entity_id = '00000000-0000-0000-0000-00000000c001'),
          'Budi/create/Coffee/25000', 'an add is logged with the actor name, item and amount');
update public.transactions set note = 'Coffee beans' where id = '00000000-0000-0000-0000-00000000c001';
select is((select count(*)::int from public.activity_log where entity_id = '00000000-0000-0000-0000-00000000c001' and action = 'update'), 1, 'an edit is logged');
update public.transactions set note = 'Coffee beans' where id = '00000000-0000-0000-0000-00000000c001';
select is((select count(*)::int from public.activity_log where entity_id = '00000000-0000-0000-0000-00000000c001' and action = 'update'), 1, 'a save that changes nothing visible is not logged');
update public.wallets set opening_balance_minor = 777 where user_id = '00000000-0000-0000-0000-0000000000a1' and id = (select id from public.wallets where user_id = '00000000-0000-0000-0000-0000000000a1' limit 1);
select is((select (summary ->> 'balance_minor') from public.activity_log where entity = 'wallets' and action = 'update'), '777', 'a balance change carries the new balance');
update public.transactions set amount_minor = 30000 where id = '00000000-0000-0000-0000-00000000c001';
select is((select summary ->> 'was_amount_minor' from public.activity_log where entity_id = '00000000-0000-0000-0000-00000000c001' and summary ? 'was_amount_minor'), '25000', 'an edit that changes the amount keeps the old amount');
delete from public.transactions where id = '00000000-0000-0000-0000-00000000c001';
select is((select count(*)::int from public.activity_log where entity_id = '00000000-0000-0000-0000-00000000c001' and action = 'delete'), 1, 'a delete is logged');
select is((select count(*)::int from public.activity_log) >= 4, true, 'the Editor reads the log');

-- clients cannot write the log
select throws_ok($$ insert into public.activity_log (owner_id, entity, entity_id, action) values ('00000000-0000-0000-0000-0000000000a1', 'x', gen_random_uuid(), 'create') $$, '42501', null, 'no client insert');
select throws_ok($$ delete from public.activity_log $$, '42501', null, 'no client delete');

-- a Viewer reads it too; a stranger sees nothing
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0c1"}', true);
select is((select count(*)::int from public.activity_log) >= 4, true, 'a Viewer reads the log');
reset role;
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000d1', 'x@test.dev', now());
insert into auth.sessions (id, user_id) values ('00000000-0000-0000-0000-00000000f0d1', '00000000-0000-0000-0000-0000000000d1');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0d1"}', true);
select is((select count(*)::int from public.activity_log), 0, 'someone outside the household sees nothing');
reset role;
-- retention
update public.activity_log set at = now() - interval '181 days' where action = 'delete';
select cmp_ok(public.purge_household_activity(), '>=', 1, 'rows older than 180 days are purged');

select * from finish();
rollback;
