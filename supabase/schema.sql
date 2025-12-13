-- Core schema for POS MVP
-- Products table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique not null,
  price numeric(10,2) not null,
  cost numeric(10,2),
  stock integer not null default 0 check (stock >= 0),
  category text,
  created_at timestamptz not null default now()
);

-- Transactions header
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  subtotal numeric(10,2) not null,
  discount_total numeric(10,2) not null default 0,
  tax_total numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  cart_discount_percent numeric(5,2) default 0,
  payment_method text default 'cash',
  created_at timestamptz not null default now()
);

-- Transaction line items
create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  item_discount numeric(10,2) not null default 0,
  tax_total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Safely decrement stock; returns updated product row when successful
create or replace function public.decrement_stock(p_product_id uuid, p_qty integer)
returns public.products
language sql
security definer
as $$
  update public.products
    set stock = stock - p_qty
  where id = p_product_id
    and stock >= p_qty
  returning *;
$$;

-- Helpful indexes
create index if not exists idx_products_sku on public.products(sku);
create index if not exists idx_transaction_items_tx on public.transaction_items(transaction_id);
create index if not exists idx_transactions_created_at on public.transactions(created_at);


