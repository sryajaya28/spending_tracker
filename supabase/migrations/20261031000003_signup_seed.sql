-- On signup: create the profile, a default wallet, and default categories.

create function public.handle_new_user()
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
          coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
          v_currency);

  insert into public.wallets (user_id, name, type, currency)
  values (new.id, 'Cash', 'cash', v_currency);

  insert into public.categories (user_id, name, type, icon, color) values
    (new.id, 'Groceries',          'expense', 'shopping-cart', '#4F46E5'),
    (new.id, 'Dining',             'expense', 'utensils',      '#818CF8'),
    (new.id, 'Transport',          'expense', 'bus',           '#FACC15'),
    (new.id, 'Shopping',           'expense', 'shopping-bag',  '#EC4899'),
    (new.id, 'Bills & Utilities',  'expense', 'receipt',       '#14B8A6'),
    (new.id, 'Entertainment',      'expense', 'film',          '#F97316'),
    (new.id, 'Health',             'expense', 'heart-pulse',   '#EF4444'),
    (new.id, 'Travel',             'expense', 'plane',         '#0EA5E9'),
    (new.id, 'Other',              'expense', 'ellipsis',      '#94A3B8'),
    (new.id, 'Salary',             'income',  'briefcase',     '#22C55E'),
    (new.id, 'Freelance',          'income',  'laptop',        '#84CC16'),
    (new.id, 'Other income',       'income',  'plus-circle',   '#94A3B8');

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
