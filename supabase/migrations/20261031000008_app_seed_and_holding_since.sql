-- Make the signup seed match what the app shows (emoji icons, sub-categories) and let a holding
-- remember the month it counts from, so the app can store and reload portfolios without loss.

alter table public.holdings
  add column since_month date not null default date_trunc('month', current_date)::date,
  add constraint holdings_since_month_chk check (since_month = date_trunc('month', since_month)::date);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- chosen on the signup form (options.data.currency); changeable later in the profile
  v_currency char(3) := upper(coalesce(nullif(new.raw_user_meta_data ->> 'currency', ''), 'USD'));
begin
  if v_currency !~ '^[A-Z]{3}$' then
    v_currency := 'USD';
  end if;

  insert into public.profiles (id, display_name, default_currency)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
          v_currency);

  insert into public.wallets (user_id, name, type, currency)
  values (new.id, 'Cash', 'cash', v_currency);

  insert into public.categories (user_id, name, type, icon, color) values
    (new.id, 'Groceries',          'expense', '🛒', '#4A44C6'),
    (new.id, 'Dining',             'expense', '🍽️', '#8B8FF0'),
    (new.id, 'Transport',          'expense', '🚌', '#F5B800'),
    (new.id, 'Shopping',           'expense', '🛍️', '#EC4899'),
    (new.id, 'Bills & Utilities',  'expense', '🧾', '#14B8A6'),
    (new.id, 'Entertainment',      'expense', '🎬', '#F97316'),
    (new.id, 'Health',             'expense', '🩺', '#EF4444'),
    (new.id, 'Travel',             'expense', '✈️', '#0EA5E9'),
    (new.id, 'Other',              'expense', '⋯',  '#94A3B8'),
    (new.id, 'Salary',             'income',  '💼', '#22C55E'),
    (new.id, 'Freelance',          'income',  '💻', '#84CC16'),
    (new.id, 'Other income',       'income',  '➕', '#94A3B8');

  -- sub-categories (one level), inheriting the parent's type and color
  insert into public.categories (user_id, parent_id, name, type, icon, color)
  select new.id, p.id, s.name, p.type, s.icon, p.color
  from (values
    ('Groceries',     'Supermarket',    '🏬'), ('Groceries',     'Fresh market',   '🥬'),
    ('Dining',        'Coffee',         '☕'), ('Dining',        'Restaurants',    '🍴'), ('Dining', 'Delivery', '🛵'),
    ('Transport',     'Fuel',           '⛽'), ('Transport',     'Ride-hailing',   '🚕'), ('Transport', 'Public transit', '🚇'),
    ('Entertainment', 'Movies',         '🎬'), ('Entertainment', 'Streaming',      '📺'), ('Entertainment', 'Events', '🎟️')
  ) as s (parent, name, icon)
  join public.categories p on p.user_id = new.id and p.parent_id is null and p.name = s.parent;

  return new;
end;
$$;
