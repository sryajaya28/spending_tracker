-- pgTAP tests for migration 32: debts.lent_transaction_id (money lent comes out of an account).
begin;
select plan(4);
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000a1', 'o@test.dev', now());
select ok(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'debts' and column_name = 'lent_transaction_id'), 'the lent record has a link column');
insert into public.transactions (id, user_id, wallet_id, type, amount_minor, occurred_at, note, transfer_direction)
select '00000000-0000-0000-0000-00000000c001', w.user_id, w.id, 'transfer', 500000, current_date, 'Budi', 'out' from public.wallets w where w.user_id = '00000000-0000-0000-0000-0000000000a1' limit 1;
insert into public.debts (id, user_id, direction, name, original_minor, lent_transaction_id) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', 'lent', 'Budi', 500000, '00000000-0000-0000-0000-00000000c001');
select is((select lent_transaction_id::text from public.debts where id = '00000000-0000-0000-0000-00000000d001'), '00000000-0000-0000-0000-00000000c001', 'the link is stored');
insert into public.debts (id, user_id, direction, name, original_minor) values ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000000a1', 'lent', 'Old', 100);
select is((select lent_transaction_id from public.debts where id = '00000000-0000-0000-0000-00000000d002'), null, 'an older record keeps a null link');
select lives_ok($$ delete from public.transactions where id = '00000000-0000-0000-0000-00000000c001' $$, 'no foreign key: the transaction can go (the client ignores a dangling link)');
select * from finish();
rollback;
