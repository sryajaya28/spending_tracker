-- two more kinds of debt: a bank loan and a paylater account
alter type public.debt_type add value if not exists 'bank';
alter type public.debt_type add value if not exists 'paylater';
