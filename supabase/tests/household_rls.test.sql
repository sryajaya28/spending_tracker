-- pgTAP tests for household migrations 2 and 3 (RLS, ownership, stamps, stale-edit check, recurring attribution, delete guards).
-- Run with: supabase test db. (Written against the design; first run happens on the staging database before anything is applied.)
begin;
select plan(29);

-- people: owner O, editor E, viewer V, stranger S (own household), former F ------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'o@test.dev'), ('00000000-0000-0000-0000-0000000000b1', 'e@test.dev'),
  ('00000000-0000-0000-0000-0000000000c1', 'v@test.dev'), ('00000000-0000-0000-0000-0000000000d1', 's@test.dev'),
  ('00000000-0000-0000-0000-0000000000e1', 'f@test.dev');
update public.profiles set household_status = 'invited' where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
insert into public.household_members (owner_id, member_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'editor'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'viewer');
update public.profiles set household_status = 'member' where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
update public.profiles set household_status = 'former_member' where id = '00000000-0000-0000-0000-0000000000e1';
insert into auth.sessions (id, user_id) values
  ('00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000f0b1', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000f0c1', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-00000000f0d1', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-00000000f0e1', '00000000-0000-0000-0000-0000000000e1');
insert into public.household_state (owner_id, rev, has_members) values ('00000000-0000-0000-0000-0000000000a1', 1, true);

-- fixtures made as the owner (superuser here; stamps give created_by = user_id when there is no JWT)
insert into public.occasions (user_id, name, currency) values ('00000000-0000-0000-0000-0000000000a1', 'Trip', 'IDR');
insert into public.transactions (user_id, wallet_id, type, amount_minor, occurred_at, note, occasion_id)
select '00000000-0000-0000-0000-0000000000a1', w.id, 'expense', 1000, current_date, 'owner row', (select id from public.occasions where name = 'Trip')
from public.wallets w where w.user_id = '00000000-0000-0000-0000-0000000000a1' limit 1;
insert into public.recurring_rules (user_id, kind, frequency, start_date, next_date, spec)
values ('00000000-0000-0000-0000-0000000000a1', 'txn', 'monthly', current_date - 40, current_date - 10, '{}');

-- 1. no policy on the data tables uses a bare auth.uid() (must be an initplan) ---------------------------------------------
select is((select count(*)::int from pg_policies
           where schemaname = 'public' and tablename in ('wallets','categories','transactions','budgets','investment_accounts','holdings','holding_events','manual_prices','debts','debt_payments','occasions','recurring_rules')
             and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\.uid\(\)'
             and (coalesce(qual, '') || coalesce(with_check, '')) !~ 'SELECT auth\.uid\(\)'), 0, 'no policy uses a bare auth.uid()');

-- 2. who sees what ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0a1"}', true);
select is((select count(*)::int from public.transactions where note = 'owner row'), 1, 'owner sees own transaction');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0b1"}', true);
select is((select count(*)::int from public.transactions where note = 'owner row'), 1, 'editor sees the owner''s transaction');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0c1"}', true);
select is((select count(*)::int from public.transactions where note = 'owner row'), 1, 'viewer sees the owner''s transaction');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0d1"}', true);
select is((select count(*)::int from public.transactions where note = 'owner row'), 0, 'a stranger sees nothing of the household');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0e1"}', true);
select is((select count(*)::int from public.wallets), 0, 'a former member sees no data');

-- 3. writes: viewer and former cannot; editor can and lands on the owner's household, created_by stamped, client value ignored --
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0c1"}', true);
select throws_ok($$ insert into public.transactions (wallet_id, type, amount_minor, occurred_at) select id, 'expense', 5, current_date from public.wallets limit 1 $$, '42501', null, 'a viewer cannot insert');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0e1"}', true);
select throws_ok($$ insert into public.wallets (name, type, currency) values ('x', 'cash', 'IDR') $$, '42501', null, 'a former member cannot insert');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0b1"}', true);
insert into public.transactions (wallet_id, type, amount_minor, occurred_at, note, created_by)
select id, 'expense', 2000, current_date, 'editor row', '00000000-0000-0000-0000-0000000000a1' from public.wallets limit 1;
select is((select user_id from public.transactions where note = 'editor row'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'an editor''s row lands on the owner''s household');
select is((select created_by from public.transactions where note = 'editor row'), '00000000-0000-0000-0000-0000000000b1'::uuid, 'created_by is the editor even when the client sent another id');
select throws_ok($$ insert into public.wallets (user_id, name, type, currency) values ('00000000-0000-0000-0000-0000000000b1', 'mine', 'cash', 'IDR') $$, '42501', null, 'a member cannot write rows with user_id = own id');

-- 4. an editor changes only their own transactions; the owner changes any -----------------------------------------------------
with u as (update public.transactions set amount_minor = 2500 where note = 'editor row' returning 1) select is((select count(*)::int from u), 1, 'editor updates their own transaction');
with u as (update public.transactions set amount_minor = 9 where note = 'owner row' returning 1) select is((select count(*)::int from u), 0, 'editor cannot update the owner''s transaction');
with d as (delete from public.transactions where note = 'owner row' returning 1) select is((select count(*)::int from d), 0, 'editor cannot delete the owner''s transaction');
select throws_ok($$ insert into public.transactions (id, user_id, wallet_id, type, amount_minor, occurred_at) select (select id from public.transactions where note = 'owner row'), '00000000-0000-0000-0000-0000000000a1', id, 'expense', 1, current_date from public.wallets limit 1 on conflict (id) do update set amount_minor = 1 $$, null, null, 'upsert onto another person''s transaction id is rejected');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0a1"}', true);
with u as (update public.transactions set amount_minor = 2600 where note = 'editor row' returning 1) select is((select count(*)::int from u), 1, 'the owner updates an editor''s transaction');

-- 5. stale-edit check only for households with members; ownership pinned ------------------------------------------------------
select throws_ok($$ update public.transactions set amount_minor = 1, rev = 99 where note = 'owner row' $$, '40001', null, 'a wrong revision is a conflict when the household has members');
select lives_ok($$ update public.transactions set amount_minor = 1100, rev = (select rev from public.transactions where note = 'owner row') where note = 'owner row' $$, 'the current revision is accepted');
select is((select rev from public.transactions where note = 'owner row'), 2, 'revision increases by one per update');
update public.transactions set created_by = '00000000-0000-0000-0000-0000000000b1' where note = 'owner row';
select is((select created_by from public.transactions where note = 'owner row'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'created_by cannot be changed by an update');

-- 6. repeating rules: attribution to the rule creator, kind and due-date bounds, unknown rule ids ignored -------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0b1"}', true);
insert into public.transactions (wallet_id, type, amount_minor, occurred_at, note, recurring_rule_id)
select w.id, 'expense', 300, current_date - 5, 'generated', (select id from public.recurring_rules limit 1) from public.wallets w limit 1;
select is((select created_by from public.transactions where note = 'generated'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'a generated row belongs to the rule creator');
select throws_ok($$ insert into public.transactions (wallet_id, type, amount_minor, occurred_at, recurring_rule_id) select w.id, 'expense', 1, current_date + 3, (select id from public.recurring_rules limit 1) from public.wallets w limit 1 $$, '42501', null, 'a future-dated generated row is rejected');
select throws_ok($$ insert into public.transactions (wallet_id, type, amount_minor, occurred_at, recurring_rule_id) select w.id, 'expense', 1, current_date - 20, (select id from public.recurring_rules limit 1) from public.wallets w limit 1 $$, '42501', null, 'a row dated before the rule''s next date is rejected');
insert into public.transactions (wallet_id, type, amount_minor, occurred_at, note, recurring_rule_id)
select w.id, 'expense', 1, current_date, 'unknown rule', gen_random_uuid() from public.wallets w limit 1;
select is((select created_by from public.transactions where note = 'unknown rule'), '00000000-0000-0000-0000-0000000000b1'::uuid, 'an unknown rule id is ignored and the row belongs to the sender');

-- 7. delete guard: an editor cannot delete what other people's transactions point at; the owner can --------------------------------
select throws_ok($$ delete from public.occasions where name = 'Trip' $$, '42501', null, 'editor cannot delete an occasion used by the owner''s transactions');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0a1"}', true);
select lives_ok($$ delete from public.occasions where name = 'Trip' $$, 'the owner can delete it (set null as before)');

-- 8. profiles: household_status is not writable by a client; ordinary settings are -------------------------------------------------
select throws_ok($$ update public.profiles set household_status = 'owner' where id = '00000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'a client cannot write household_status');
select lives_ok($$ update public.profiles set display_name = 'Owner' where id = '00000000-0000-0000-0000-0000000000a1' $$, 'a client can still write its settings');

-- 9. poll counter bumps for a household with members -----------------------------------------------------------------------------
select cmp_ok((select rev from public.household_state where owner_id = '00000000-0000-0000-0000-0000000000a1'), '>', 1::bigint, 'writes bump the household_state revision');

select * from finish();
rollback;
