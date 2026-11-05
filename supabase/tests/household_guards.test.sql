-- pgTAP tests for household migrations 2-4: delete guards (FK cascade and set-null bypass), linked-row policies, transfer legs,
-- manual_prices, join refusal reasons and owner deletion. Run with: supabase test db.
begin;
select plan(25);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'o@test.dev', now()), ('00000000-0000-0000-0000-0000000000b1', 'e@test.dev', now());
update public.profiles set household_status = 'invited' where id = '00000000-0000-0000-0000-0000000000b1';
insert into public.household_members (owner_id, member_id, role) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'editor');
update public.profiles set household_status = 'member' where id = '00000000-0000-0000-0000-0000000000b1';
insert into auth.sessions (id, user_id) values
  ('00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-00000000f0b1', '00000000-0000-0000-0000-0000000000b1');
insert into public.household_state (owner_id, rev, has_members) values ('00000000-0000-0000-0000-0000000000a1', 1, true);

-- fixtures owned by the owner (created_by = user_id because there is no JWT): a debt, an investment chain, linked transactions
insert into public.debts (id, user_id, direction, name, original_minor) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', 'owed', 'Loan', 1000);
insert into public.transactions (id, user_id, wallet_id, type, amount_minor, occurred_at, note, debt_id)
select '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a1', w.id, 'expense', 100, current_date, 'owner debt row', '00000000-0000-0000-0000-00000000d001'
from public.wallets w where w.user_id = '00000000-0000-0000-0000-0000000000a1' limit 1;
insert into public.investment_accounts (id, user_id, name) values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a1', 'Broker');
insert into public.holdings (id, user_id, account_id, symbol, asset_type) values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000e001', 'BTC', 'crypto');
insert into public.holding_events (id, user_id, holding_id, quantity_delta) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000f001', 1),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000f001', 2);
insert into public.transactions (id, user_id, type, amount_minor, occurred_at, note, holding_event_id)
values ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a1', 'expense', 50, current_date, 'owner coin row', '00000000-0000-0000-0000-00000000a001');
insert into public.debt_payments (id, user_id, debt_id, amount_minor, transaction_id) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000d001', 100, '00000000-0000-0000-0000-00000000c001'),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000d001', 5, null);
insert into public.transactions (user_id, wallet_id, type, amount_minor, occurred_at, note, transfer_group_id, transfer_direction)
select '00000000-0000-0000-0000-0000000000a1', w.id, 'transfer', 70, current_date, 'owner transfer ' || d, '00000000-0000-0000-0000-00000000aa77', d::public.transfer_direction
from public.wallets w, (values ('out'), ('in')) v(d) where w.user_id = '00000000-0000-0000-0000-0000000000a1' limit 2;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0b1"}', true);

-- 1. delete guards as an Editor: rejected with kind and count, nothing cascaded -----------------------------------------------------
select throws_ok($$ delete from public.debts where id = '00000000-0000-0000-0000-00000000d001' $$, '42501', 'household_guard:debt:1', 'editor cannot delete a debt that the owner''s transaction points at (would null debt_id)');
select throws_ok($$ delete from public.holding_events where id = '00000000-0000-0000-0000-00000000a001' $$, '42501', 'household_guard:holding_event:1', 'editor cannot delete a holding event behind the owner''s transaction (would cascade-delete it)');
select throws_ok($$ delete from public.holdings where id = '00000000-0000-0000-0000-00000000f001' $$, '42501', 'household_guard:holding:1', 'editor cannot delete a holding whose events back the owner''s transaction');
select throws_ok($$ delete from public.investment_accounts where id = '00000000-0000-0000-0000-00000000e001' $$, '42501', 'household_guard:account:1', 'editor cannot delete an investment account holding the owner''s transactions');
select is((select count(*)::int from public.transactions where note in ('owner debt row', 'owner coin row') and (debt_id is not null or holding_event_id is not null)), 2, 'after the refusals both of the owner''s transactions are untouched (nothing nulled, nothing cascaded)');
select lives_ok($$ delete from public.holding_events where id = '00000000-0000-0000-0000-00000000a002' $$, 'an Editor can delete a holding event that no one else''s transaction uses');

-- 2. linked rows follow their transaction ---------------------------------------------------------------------------------------------
with u as (update public.holding_events set note = 'x' where id = '00000000-0000-0000-0000-00000000a001' returning 1) select is((select count(*)::int from u), 0, 'editor cannot update a holding event behind the owner''s transaction');
with u as (update public.debt_payments set amount_minor = 9 where id = '00000000-0000-0000-0000-00000000b001' returning 1) select is((select count(*)::int from u), 0, 'editor cannot update a debt payment linked to the owner''s transaction');
with u as (update public.debt_payments set amount_minor = 6 where id = '00000000-0000-0000-0000-00000000b002' returning 1) select is((select count(*)::int from u), 1, 'editor can update an unlinked debt payment');
select throws_ok($$ insert into public.debt_payments (debt_id, amount_minor, transaction_id) values ('00000000-0000-0000-0000-00000000d001', 1, '00000000-0000-0000-0000-00000000c001') $$, '42501', 'new row violates row-level security policy for table "debt_payments"', 'editor cannot attach a new debt payment to the owner''s transaction');
select lives_ok($$ insert into public.debt_payments (debt_id, amount_minor) values ('00000000-0000-0000-0000-00000000d001', 1) $$, 'editor can add an unlinked debt payment');

-- 3. transfer legs: the owner's pair is untouchable for the Editor; the Editor's own pair works ---------------------------------------------
with d as (delete from public.transactions where transfer_group_id = '00000000-0000-0000-0000-00000000aa77' returning 1) select is((select count(*)::int from d), 0, 'editor cannot delete either leg of the owner''s transfer');
insert into public.transactions (wallet_id, type, amount_minor, occurred_at, note, transfer_group_id, transfer_direction)
select w.id, 'transfer', 30, current_date, 'editor transfer ' || v.d, '00000000-0000-0000-0000-00000000aa88', v.d::public.transfer_direction
from (select id from public.wallets limit 1) w, (values ('out'), ('in')) v(d);
select is((select count(distinct created_by)::int from public.transactions where transfer_group_id = '00000000-0000-0000-0000-00000000aa88'), 1, 'both legs of an Editor''s transfer carry the same creator');
with d as (delete from public.transactions where transfer_group_id = '00000000-0000-0000-0000-00000000aa88' returning 1) select is((select count(*)::int from d), 2, 'editor can delete both legs of their own transfer');

-- 4. manual_prices belong to the household: a member writes with the owner id, not their own -----------------------------------------------
select lives_ok($$ insert into public.manual_prices (symbol, price_date, price_usd) values ('BTC', current_date, 1) $$, 'editor writes a manual price (user_id defaults to the owner)');
select is((select user_id from public.manual_prices where symbol = 'BTC'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'and it lands on the owner''s household');
select throws_ok($$ insert into public.manual_prices (user_id, symbol, price_date, price_usd) values ('00000000-0000-0000-0000-0000000000b1', 'ETH', current_date, 1) $$, '42501', 'new row violates row-level security policy for table "manual_prices"', 'editor cannot write a manual price under their own id');

-- 5. the owner is never blocked ------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000f0a1"}', true);
select lives_ok($$ delete from public.debts where id = '00000000-0000-0000-0000-00000000d001' $$, 'the owner can delete the debt');
select is((select debt_id from public.transactions where note = 'owner debt row'), null, 'its transaction keeps existing with debt_id set null (as before)');
select lives_ok($$ delete from public.investment_accounts where id = '00000000-0000-0000-0000-00000000e001' $$, 'the owner can delete the investment account');
select is((select count(*)::int from public.transactions where note = 'owner coin row'), 0, 'its cascade removes the linked coin transaction (as before)');
reset role;

-- 6. join refusal: a second-factor device on the invited login ------------------------------------------------------------------------------
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b9', 'mfa@test.dev');
insert into public.household_invites (id, owner_id, email, role, invited_by, invited_user_id, token_hash, expires_at)
values ('00000000-0000-0000-0000-00000000aa09', '00000000-0000-0000-0000-0000000000a1', 'mfa@test.dev', 'viewer', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b9', 'j9', now() + interval '7 days');
update public.profiles set household_status = 'invited' where id = '00000000-0000-0000-0000-0000000000b9';
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at) values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000b9', 'totp', 'unverified', now(), now());
select is(public.join_household_apply('00000000-0000-0000-0000-00000000aa09', '00000000-0000-0000-0000-0000000000b9', 'M') ->> 'result', 'refused', 'an invited login with a second-factor device is refused');
select is((select detail ->> 'reason' from public.security_events order by id desc limit 1), 'mfa_factor', 'and the reason is recorded');

-- 7. owner deletion: the members become former members first -----------------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
select is((select household_status from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'former_member', 'when an owner''s login is deleted the member becomes a former member');
select is((select count(*)::int from public.household_former_members where member_id = '00000000-0000-0000-0000-0000000000b1'), 1, 'and their name is kept');

select * from finish();
rollback;
