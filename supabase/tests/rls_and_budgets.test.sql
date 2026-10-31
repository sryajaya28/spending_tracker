-- pgTAP tests. Run with: supabase test db
begin;
select plan(11);

-- Two users; the signup trigger seeds profile, wallet and categories for each.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev');

select is((select count(*)::int from public.categories where user_id = '00000000-0000-0000-0000-00000000000a'),
          12, 'signup seeds default categories');

-- ---- act as user A -------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*)::int from public.categories), 12, 'A sees only own categories');

insert into public.transactions (wallet_id, category_id, type, amount_minor, occurred_at)
select w.id, c.id, 'expense', 9000, date_trunc('month', current_date)::date
from public.wallets w, public.categories c
where c.name = 'Groceries';

select is((select user_id from public.transactions limit 1),
          '00000000-0000-0000-0000-00000000000a'::uuid, 'user_id defaults to auth.uid()');

insert into public.budgets (category_id, amount_minor, start_month)
values (null, 10000, date_trunc('month', current_date)::date);

select is((select status from public.budget_status(current_date)), 'warning',
          '90% of global budget -> warning');

insert into public.transactions (wallet_id, type, amount_minor, occurred_at)
select id, 'expense', 2000, date_trunc('month', current_date)::date from public.wallets;

select is((select status from public.budget_status(current_date)), 'exceeded',
          '110% of global budget -> exceeded');

-- sub-categories: breakdown rows roll up, and the tree stays one level deep
insert into public.categories (name, parent_id)
select 'Supermarket', id from public.categories where name = 'Groceries';
insert into public.transactions (wallet_id, category_id, type, amount_minor, occurred_at)
select w.id, c.id, 'expense', 1000, date_trunc('month', current_date)::date
from public.wallets w, public.categories c where c.name = 'Supermarket';

select is((select spent_minor from public.spending_by_category(current_date)
           where category_name = 'Groceries' and sub_category_id is null), 10000::bigint,
          'parent total includes sub-category spend (9000 + 1000)');
select throws_ok(
  $$ insert into public.categories (name, parent_id)
     select 'Nested', id from public.categories where name = 'Supermarket' $$,
  'P0001', null, 'sub-category cannot have its own sub-category');

-- ---- act as user B ---------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is((select count(*)::int from public.transactions), 0, 'B cannot read A transactions');
select is((select count(*)::int from public.budget_status(current_date)), 0, 'B sees none of A budgets');

-- B tries to attach a transaction to A's wallet (composite FK must reject it)
reset role;
create temp table a_wallet as
  select id from public.wallets where user_id = '00000000-0000-0000-0000-00000000000a';
grant select on a_wallet to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select throws_ok(
  $$ insert into public.transactions (wallet_id, type, amount_minor)
     select id, 'expense', 100 from a_wallet $$,
  '23503', null, 'B cannot reference A wallet');

with upd as (
  update public.transactions set note = 'hacked' returning 1
) select is((select count(*)::int from upd), 0, 'B cannot update A transactions');

select * from finish();
rollback;
