-- Money lent comes out of an account, review fix (PR 59, Copilot): the amount of a lent record is tied to its transfer-out transaction, and
-- a household Editor may change a transaction only if they created it (transactions_update). debts_update lets any Editor patch a debt, so an
-- Editor could change someone else's lent amount, currency or link while the protected transfer stays unchanged. This trigger closes that:
-- when the record has a link to an existing transaction and the caller is neither the household owner nor that transaction's creator, the
-- fields that the transaction mirrors (direction, name, original_minor, currency, lent_transaction_id, start_month) cannot change. Due date,
-- note and archive stay open to every Editor, like the client. Rows without a link (older records) and calls without a JWT are unaffected.
-- Additive: a function and a trigger only. Down: drop trigger lent_link_guard on public.debts; drop function public.lent_link_guard().
create or replace function public.lent_link_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  if old.direction = 'lent' and old.lent_transaction_id is not null and auth.uid() is not null
     and (select public.household_owner()) is distinct from auth.uid() then
    select t.created_by into c from public.transactions t where t.id = old.lent_transaction_id and t.user_id = old.user_id;
    if found and c is distinct from auth.uid()
       and (new.direction is distinct from old.direction or new.name is distinct from old.name or new.original_minor is distinct from old.original_minor
            or new.currency is distinct from old.currency or new.lent_transaction_id is distinct from old.lent_transaction_id
            or new.start_month is distinct from old.start_month) then
      raise exception 'household_guard:lent_link' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists lent_link_guard on public.debts;
create trigger lent_link_guard before update on public.debts for each row execute function public.lent_link_guard();
