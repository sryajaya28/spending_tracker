-- Core schema. Every user-owned table carries user_id -> auth.users(id).
-- Money is stored as integer minor units (e.g. cents), never floats.

create type public.wallet_type as enum ('cash', 'bank', 'ewallet', 'card');
create type public.category_type as enum ('expense', 'income');
create type public.transaction_type as enum ('expense', 'income', 'transfer');
create type public.category_source as enum ('user', 'ai', 'rule');

-- Shared updated_at trigger ------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles: one row per auth user (id = auth.users.id) ----------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text,
  default_currency    char(3) not null default 'USD',
  timezone            text not null default 'UTC',
  ai_tagging_enabled  boolean not null default true,
  created_at          timestamptz not null default now()
);

-- wallets --------------------------------------------------------------------
create table public.wallets (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                  text not null check (length(trim(name)) > 0),
  type                  public.wallet_type not null default 'cash',
  currency              char(3) not null default 'USD',
  opening_balance_minor bigint not null default 0,
  archived              boolean not null default false,
  created_at            timestamptz not null default now(),
  -- lets child tables prove a wallet belongs to the same user
  unique (id, user_id)
);
create index wallets_user_id_idx on public.wallets (user_id);

-- categories -----------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id   uuid,                         -- null = top-level; sub-categories are one level deep
  name        text not null check (length(trim(name)) > 0),
  type        public.category_type not null default 'expense',
  icon        text,
  color       text,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (id, user_id),
  -- a sub-category's parent must belong to the same user
  foreign key (parent_id, user_id) references public.categories (id, user_id),
  check (parent_id is distinct from id)
);
create index categories_user_id_idx on public.categories (user_id);
create index categories_parent_idx  on public.categories (parent_id);
-- names are unique among siblings (same user, same parent, same type), case-insensitive
create unique index categories_sibling_name_uniq
  on public.categories (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), type, lower(name));

-- Keep the tree to one level and the type consistent with the parent.
create function public.check_category_tree()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p public.categories;
begin
  if new.parent_id is not null then
    select * into p from public.categories where id = new.parent_id;
    if p.parent_id is not null then
      raise exception 'sub-categories cannot have their own sub-categories';
    end if;
    if p.type <> new.type then
      raise exception 'sub-category type must match its parent';
    end if;
    if exists (select 1 from public.categories where parent_id = new.id) then
      raise exception 'a category with sub-categories cannot become a sub-category';
    end if;
  end if;
  return new;
end;
$$;

create trigger categories_check_tree
  before insert or update of parent_id, type on public.categories
  for each row execute function public.check_category_tree();

-- transactions -----------------------------------------------------------------
-- id may be generated client-side (offline queue) so syncs are idempotent.
create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  wallet_id        uuid not null,
  category_id      uuid,                       -- null = uncategorized (also the AI fallback)
  type             public.transaction_type not null,
  amount_minor     bigint not null check (amount_minor > 0),
  currency         char(3) not null default 'USD',
  occurred_at      date not null default current_date,
  note             text,
  category_source  public.category_source not null default 'user',
  ai_confidence    numeric(4, 3) check (ai_confidence between 0 and 1),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- composite FKs: a transaction can only reference wallets/categories of the same user
  foreign key (wallet_id, user_id)   references public.wallets (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id)
);
create index transactions_user_date_idx     on public.transactions (user_id, occurred_at desc);
create index transactions_user_category_idx on public.transactions (user_id, category_id, occurred_at);
create index transactions_wallet_idx        on public.transactions (wallet_id);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- budgets ------------------------------------------------------------------------
-- category_id NULL = global budget. A row applies from start_month onward until a
-- later row for the same scope supersedes it (see budget_status()).
create table public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id   uuid,
  amount_minor  bigint not null check (amount_minor > 0),
  currency      char(3) not null default 'USD',
  start_month   date not null check (start_month = date_trunc('month', start_month)::date),
  created_at    timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id)
);
create index budgets_user_id_idx on public.budgets (user_id);
-- one global budget per user per start month, one per category per start month
create unique index budgets_global_uniq   on public.budgets (user_id, start_month)              where category_id is null;
create unique index budgets_category_uniq on public.budgets (user_id, category_id, start_month) where category_id is not null;
