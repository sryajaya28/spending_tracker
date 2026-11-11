-- pgTAP tests for migration 33: an Editor cannot change the amount, currency, name or link of someone else's linked lent record.
begin;
select plan(6);
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'o@test.dev', now()), ('00000000-0000-0000-0000-0000000000b1', 'e@test.dev', now());
update public.profiles set household_status = 'invited' where id = '00000000-0000-0000-0000-0000000000b1';
insert into public.household_members (owner_id, member_id, role) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'editor');
update public.profiles set household_status = 'member' where id = '00000000-0000-0000-0000-0000000000b1';
insert into auth.sessions (id, user_id) values
  ('00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-00000000f0b1', '00000000-0000-0000-0000-0000000000b1');
insert into public.household_state (owner_id, rev, has_members) values ('00000000-0000-0000-0000-0000000000a1', 1, true);
-- the owner lent 500000 from an account (transfer out, created by the owner) and an older record has no link
insert into public.transactions (id, user_id, wallet_id, type, amount_minor, occurred_at, note, transfer_direction)
select '00000000-0000-0000-0000-00000000c001', w.user_id, w.id, 'transfer', 500000, current_date, 'Budi', 'out' from public.wallets w where w.user_id = '00000000-0000-0000-0000-0000000000a1' limit 1;
insert into public.debts (id, user_id, direction, name, original_minor, lent_transaction_id) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', 'lent', 'Budi', 500000, '00000000-0000-0000-0000-00000000c001');
insert into public.debts (id, user_id, direction, name, original_minor) values ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000000a1', 'lent', 'Old', 100);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0b1"}', true);
select throws_ok($$ update public.debts set original_minor = 1 where id = '00000000-0000-0000-0000-00000000d001' $$, '42501', 'household_guard:lent_link', 'editor cannot change the amount of the owner''s linked lent record');
select throws_ok($$ update public.debts set lent_transaction_id = null where id = '00000000-0000-0000-0000-00000000d001' $$, '42501', 'household_guard:lent_link', 'editor cannot drop the link (would free the amount)');
select throws_ok($$ update public.debts set currency = 'IDR' where id = '00000000-0000-0000-0000-00000000d001' $$, '42501', 'household_guard:lent_link', 'editor cannot change the currency');
select lives_ok($$ update public.debts set due_date = current_date + 30, note = 'later', archived = true where id = '00000000-0000-0000-0000-00000000d001' $$, 'editor can change the due date, note and archive state');
select lives_ok($$ update public.debts set original_minor = 200 where id = '00000000-0000-0000-0000-00000000d002' $$, 'an older record without a link stays editable');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0a1"}', true);
select lives_ok($$ update public.debts set original_minor = 400000 where id = '00000000-0000-0000-0000-00000000d001' $$, 'the owner can change the amount');
select * from finish();
rollback;
