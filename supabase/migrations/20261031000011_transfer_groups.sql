-- A transfer between two wallets is stored as linked transactions that share a transfer_group_id:
-- the 'out' leg (source wallet), the 'in' leg (destination wallet, in its own currency) and an
-- optional fee as an ordinary expense on the source wallet. Deleting a transfer removes the whole group.
-- The group id is just a shared label, so there is no foreign key.

alter table public.transactions add column transfer_group_id uuid;
create index transactions_transfer_group_idx on public.transactions (transfer_group_id) where transfer_group_id is not null;
