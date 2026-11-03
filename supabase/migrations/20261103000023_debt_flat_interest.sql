-- a debt's interest can be a flat rate (charged on the original amount, usual for vehicle loans and paylater)
alter table public.debts add column if not exists interest_flat boolean not null default false;
