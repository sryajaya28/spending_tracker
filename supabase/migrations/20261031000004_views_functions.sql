-- Read-side helpers. Both run as the caller (security invoker) so RLS applies.

-- Wallet balance = opening + income - expense (transfers arrive in v1.1).
create view public.wallet_balances
with (security_invoker = true) as
select
  w.id as wallet_id,
  w.user_id,
  w.name,
  w.currency,
  w.opening_balance_minor
    + coalesce(sum(case t.type
                     when 'income'  then  t.amount_minor
                     when 'expense' then -t.amount_minor
                     else 0
                   end), 0) as balance_minor
from public.wallets w
left join public.transactions t on t.wallet_id = w.id
group by w.id;

-- Spend for a month (expenses only), rolled up to top-level categories.
-- Rows with a non-null sub_category_id are the sub-category breakdown of their parent;
-- the parent's own total is the row where sub_category_id is null.
create function public.spending_by_category(p_month date)
returns table (category_id uuid, category_name text, color text,
               sub_category_id uuid, sub_category_name text, spent_minor bigint)
language sql
stable
set search_path = ''
as $$
  select root.id, coalesce(root.name, 'Uncategorized'), root.color,
         sub.id, sub.name, sum(t.amount_minor)::bigint
  from public.transactions t
  left join public.categories leaf on leaf.id = t.category_id
  left join public.categories root on root.id = coalesce(leaf.parent_id, leaf.id)
  left join public.categories sub  on sub.id = leaf.id and leaf.parent_id is not null
  where t.user_id = auth.uid()
    and t.type = 'expense'
    and t.occurred_at >= date_trunc('month', p_month)::date
    and t.occurred_at <  (date_trunc('month', p_month) + interval '1 month')::date
  group by grouping sets ((root.id, root.name, root.color), (root.id, root.name, root.color, sub.id, sub.name))
  order by sum(t.amount_minor) desc;
$$;

-- Budget progress for a month. For each scope (global / each category) the budget
-- in effect is the row with the latest start_month <= the requested month.
-- status: ok (<80%), warning (80-100%), exceeded (>100%).
create function public.budget_status(p_month date)
returns table (
  budget_id       uuid,
  category_id     uuid,
  category_name   text,
  budget_minor    bigint,
  spent_minor     bigint,
  remaining_minor bigint,
  pct_used        numeric,
  status          text
)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select date_trunc('month', p_month)::date as m_start,
           (date_trunc('month', p_month) + interval '1 month')::date as m_next
  ),
  effective as (
    select distinct on (b.category_id) b.*
    from public.budgets b, bounds
    where b.user_id = auth.uid()
      and b.start_month <= bounds.m_start
    order by b.category_id, b.start_month desc
  ),
  spend as (
    select e.id as budget_id,
           coalesce(sum(t.amount_minor), 0)::bigint as spent
    from effective e
    cross join bounds
    left join public.transactions t
      on t.user_id = e.user_id
     and t.type = 'expense'
     and t.currency = e.currency
     and t.occurred_at >= bounds.m_start
     and t.occurred_at <  bounds.m_next
     -- a category budget counts its sub-categories too
     and (e.category_id is null
          or t.category_id = e.category_id
          or t.category_id in (select c.id from public.categories c where c.parent_id = e.category_id))
    group by e.id
  )
  select e.id,
         e.category_id,
         coalesce(c.name, 'All spending'),
         e.amount_minor,
         s.spent,
         e.amount_minor - s.spent,
         round(s.spent * 100.0 / e.amount_minor, 1),
         case when s.spent > e.amount_minor            then 'exceeded'
              when s.spent * 100 >= e.amount_minor * 80 then 'warning'
              else 'ok' end
  from effective e
  join spend s on s.budget_id = e.id
  left join public.categories c on c.id = e.category_id
  order by (e.category_id is not null), c.name;
$$;

grant execute on function public.spending_by_category(date), public.budget_status(date)
  to authenticated;
revoke execute on function public.spending_by_category(date), public.budget_status(date)
  from anon, public;
