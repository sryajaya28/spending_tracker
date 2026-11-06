-- Money lent comes out of an account (PRD 2026-11-06-lent-from-account): the lent record points at its transfer-out transaction, like a
-- repayment points at its transfer-in (debt_payments.transaction_id). Additive and backwards compatible: old rows keep null, old clients never
-- send or read the column. Deliberately NO foreign key: a save writes transactions and debts in separate steps and the client checks that the
-- transaction exists before it uses the link; a dangling id is ignored. The default category "Lent" is created by the client on first use
-- (like "Lent Repayment"), so no category seed is needed here.
alter table public.debts add column if not exists lent_transaction_id uuid;
comment on column public.debts.lent_transaction_id is 'Lent records only: the transfer-out transaction that took the money from an account (null for older records).';
