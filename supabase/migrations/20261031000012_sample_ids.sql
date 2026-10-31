-- Remember which rows came from the optional "Load sample data" button, so they can be removed later
-- without touching anything the user added. Shape: {"categories": [ids], "wallets": [ids], "transactions": [ids], ...}

alter table public.profiles add column sample_ids jsonb;
