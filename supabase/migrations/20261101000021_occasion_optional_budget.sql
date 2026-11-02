-- A special occasion may have no budget: it then only groups the expenses tagged to it (transactions.occasion_id).
-- amount_minor becomes optional (null = no budget); when set it must still be above zero.
alter table public.occasions alter column amount_minor drop not null;
alter table public.occasions drop constraint if exists occasions_amount_minor_check;
alter table public.occasions add constraint occasions_amount_minor_check check (amount_minor is null or amount_minor > 0);
