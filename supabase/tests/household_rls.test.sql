-- pgTAP tests for household migrations 2 and 3 (RLS, ownership, stamps, stale-edit check, recurring attribution, delete guards).
-- Run with: supabase test db. (Written against the design; first run happens on the staging database before anything is applied.)
begin;
select plan(37);

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
-- every public table with a user_id column, except the two person-scoped ones (support_reports, auth_handoffs), is covered: a bare
-- auth.uid() or a bare per-row household_owner()/is_writer() would defeat the initplan
select is((select count(*)::int from pg_policies p
           where p.schemaname = 'public'
             and p.tablename in (select c.table_name from information_schema.columns c
                                 where c.table_schema = 'public' and c.column_name = 'user_id' and c.table_name not in ('support_reports', 'auth_handoffs')
                                   and c.table_name in (select t.table_name from information_schema.tables t where t.table_schema = 'public' and t.table_type = 'BASE TABLE'))
             and ((coalesce(p.qual, '') || coalesce(p.with_check, '')) ~ 'auth\.uid\(\)' and (coalesce(p.qual, '') || coalesce(p.with_check, '')) !~ 'SELECT auth\.uid\(\)'
                  or (coalesce(p.qual, '') || coalesce(p.with_check, '')) ~ '(household_owner|is_writer)\(\)' and (coalesce(p.qual, '') || coalesce(p.with_check, '')) !~ 'SELECT (public\.)?(household_owner|is_writer)\(\)')), 0,
          'no policy on a data table uses a bare auth.uid(), household_owner() or is_writer()');

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
select throws_ok($$ insert into public.transactions (wallet_id, type, amount_minor, occurred_at) select id, 'expense', 5, current_date from public.wallets limit 1 $$, '42501', 'new row violates row-level security policy for table "transactions"', 'a viewer cannot insert (plain RLS, no guard prefix)');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0e1"}', true);
select throws_ok($$ insert into public.wallets (name, type, currency) values ('x', 'cash', 'IDR') $$, '42501', 'new row violates row-level security policy for table "wallets"', 'a former member cannot insert');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0b1"}', true);
insert into public.transactions (wallet_id, type, amount_minor, occurred_at, note, created_by)
select id, 'expense', 2000, current_date, 'editor row', '00000000-0000-0000-0000-0000000000a1' from public.wallets limit 1;
select is((select user_id from public.transactions where note = 'editor row'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'an editor''s row lands on the owner''s household');
select is((select created_by from public.transactions where note = 'editor row'), '00000000-0000-0000-0000-0000000000b1'::uuid, 'created_by is the editor even when the client sent another id');
select throws_ok($$ insert into public.wallets (user_id, name, type, currency) values ('00000000-0000-0000-0000-0000000000b1', 'mine', 'cash', 'IDR') $$, '42501', 'new row violates row-level security policy for table "wallets"', 'a member cannot write rows with user_id = own id');

-- 4. an editor changes only their own transactions; the owner changes any -----------------------------------------------------
with u as (update public.transactions set amount_minor = 2500 where note = 'editor row' returning 1) select is((select count(*)::int from u), 1, 'editor updates their own transaction');
with u as (update public.transactions set amount_minor = 9 where note = 'owner row' returning 1) select is((select count(*)::int from u), 0, 'editor cannot update the owner''s transaction');
with d as (delete from public.transactions where note = 'owner row' returning 1) select is((select count(*)::int from d), 0, 'editor cannot delete the owner''s transaction');
select throws_ok($$ insert into public.transactions (id, user_id, wallet_id, type, amount_minor, occurred_at) select (select id from public.transactions where note = 'owner row'), '00000000-0000-0000-0000-0000000000a1', id, 'expense', 1, current_date from public.wallets limit 1 on conflict (id) do update set amount_minor = 1 $$, null, null, 'upsert onto another person''s transaction id is rejected');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0a1"}', true);
with u as (update public.transactions set amount_minor = 2600 where note = 'editor row' returning 1) select is((select count(*)::int from u), 1, 'the owner updates an editor''s transaction');

-- 5. stale-edit check only for households with members; ownership pinned ------------------------------------------------------
select throws_ok($$ update public.transactions set amount_minor = 1, rev = 99 where note = 'owner row' $$, '40001', 'household_stale', 'a wrong revision is a conflict when the household has members');
select lives_ok($$ update public.transactions set amount_minor = 1100, rev = (select rev from public.transactions where note = 'owner row') where note = 'owner row' $$, 'the current revision is accepted');
select is((select rev from public.transactions where note = 'owner row'), 2, 'revision increases by one per update');
update public.transactions set created_by = '00000000-0000-0000-0000-0000000000b1' where note = 'owner row';
select is((select created_by from public.transactions where note = 'owner row'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'created_by cannot be changed by an update');

-- 6. repeating rules: attribution to the rule creator, kind and due-date bounds, unknown rule ids ignored -------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0b1"}', true);
insert into public.transactions (wallet_id, type, amount_minor, occurred_at, note, recurring_rule_id)
select w.id, 'expense', 300, current_date - 5, 'generated', (select id from public.recurring_rules limit 1) from public.wallets w limit 1;
select is((select created_by from public.transactions where note = 'generated'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'a generated row belongs to the rule creator');
select throws_ok($$ insert into public.transactions (wallet_id, type, amount_minor, occurred_at, recurring_rule_id) select w.id, 'expense', 1, current_date + 3, (select id from public.recurring_rules limit 1) from public.wallets w limit 1 $$, '42501', 'household_guard:recurring_date', 'a generated row dated more than one day ahead is rejected');
select throws_ok($$ insert into public.transactions (wallet_id, type, amount_minor, occurred_at, recurring_rule_id) select w.id, 'expense', 1, current_date - 20, (select id from public.recurring_rules limit 1) from public.wallets w limit 1 $$, '42501', 'household_guard:recurring_date', 'a row dated before the rule''s next date is rejected');
insert into public.transactions (wallet_id, type, amount_minor, occurred_at, note, recurring_rule_id)
select w.id, 'expense', 1, current_date, 'unknown rule', gen_random_uuid() from public.wallets w limit 1;
select is((select created_by from public.transactions where note = 'unknown rule'), '00000000-0000-0000-0000-0000000000b1'::uuid, 'an unknown rule id is ignored and the row belongs to the sender');

-- 6b. generated-row edge cases: UTC slack, and a re-save of a generated row after the rule was advanced (S2, S3) ------------------------------
insert into public.transactions (wallet_id, type, amount_minor, occurred_at, note, recurring_rule_id)
select w.id, 'expense', 1, current_date + 1, 'generated tomorrow (local day ahead of UTC)', (select id from public.recurring_rules limit 1) from public.wallets w limit 1;
select is((select count(*)::int from public.transactions where note like 'generated tomorrow%'), 1, 'a row dated one day ahead (user''s local day) is accepted');
reset role;
update public.recurring_rules set next_date = current_date + 30;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0b1"}', true);
select lives_ok($$ insert into public.transactions (id, user_id, wallet_id, type, amount_minor, occurred_at, recurring_rule_id)
  select t.id, t.user_id, t.wallet_id, t.type, t.amount_minor + 1, t.occurred_at, t.recurring_rule_id from public.transactions t where t.note = 'generated'
  on conflict (id) do update set amount_minor = excluded.amount_minor $$, 're-upserting a generated row after the rule moved on is not rejected (checks apply only to new rows)');

-- 6c. upsert that carries the row's current revision succeeds; a stale one conflicts (S1) --------------------------------------------------
select lives_ok($$ insert into public.transactions (id, user_id, wallet_id, type, amount_minor, occurred_at, rev)
  select t.id, t.user_id, t.wallet_id, t.type, 4242, t.occurred_at, t.rev from public.transactions t where t.note = 'editor row'
  on conflict (id) do update set amount_minor = excluded.amount_minor, rev = excluded.rev $$, 'an upsert carrying the current rev is accepted (rev is not reset on insert)');
select throws_ok($$ insert into public.transactions (id, user_id, wallet_id, type, amount_minor, occurred_at, rev)
  select t.id, t.user_id, t.wallet_id, t.type, 1, t.occurred_at, t.rev - 1 from public.transactions t where t.note = 'editor row'
  on conflict (id) do update set amount_minor = excluded.amount_minor, rev = excluded.rev $$, '40001', 'household_stale', 'an upsert carrying a stale rev conflicts');

-- 6d. a solo ledger (the stranger has no household_state row): stale rev causes no conflict and household_state is not written -----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0d1"}', true);
insert into public.transactions (wallet_id, type, amount_minor, occurred_at, note) select id, 'expense', 7, current_date, 'solo row' from public.wallets limit 1;
select lives_ok($$ update public.transactions set amount_minor = 8, rev = 99 where note = 'solo row' $$, 'a solo ledger has no stale-edit conflicts');
select is((select count(*)::int from public.household_state where owner_id = '00000000-0000-0000-0000-0000000000d1'), 0, 'solo writes leave household_state alone (no row created)');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0b1"}', true);

-- 7. delete guard: an editor cannot delete what other people's transactions point at; the owner can --------------------------------
select throws_ok($$ delete from public.occasions where name = 'Trip' $$, '42501', 'household_guard:occasion:1', 'editor cannot delete an occasion used by the owner''s transactions (message carries kind and count)');
select is((select count(*)::int from public.occasions where name = 'Trip'), 1, 'nothing was cascaded or removed after the refusal');
select is((select occasion_id is not null from public.transactions where note = 'owner row'), true, 'the owner''s transaction still has its occasion');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0a1"}', true);
select lives_ok($$ delete from public.occasions where name = 'Trip' $$, 'the owner can delete it (set null as before)');

-- 8. profiles: household_status is not writable by a client; ordinary settings are -------------------------------------------------
select throws_ok($$ update public.profiles set household_status = 'owner' where id = '00000000-0000-0000-0000-0000000000a1' $$, '42501', 'permission denied for table profiles', 'a client cannot write household_status');
select lives_ok($$ update public.profiles set display_name = 'Owner' where id = '00000000-0000-0000-0000-0000000000a1' $$, 'a client can still write its settings');

-- 9. poll counter bumps for a household with members -----------------------------------------------------------------------------
select cmp_ok((select rev from public.household_state where owner_id = '00000000-0000-0000-0000-0000000000a1'), '>', 1::bigint, 'writes bump the household_state revision');

select * from finish();
rollback;
