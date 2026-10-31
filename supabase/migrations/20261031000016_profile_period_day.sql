-- The day of the month a budget period starts on (1 = calendar months; 25 = 25th to the 24th, for a payroll on the 25th).
alter table public.profiles add column period_day smallint not null default 1;
alter table public.profiles add constraint profiles_period_day_chk check (period_day between 1 and 28);
