-- Advanced schema additions

-- Dynamic tax rates
create table if not exists public.taxes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rate numeric(6,4) not null check (rate >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_taxes_active on public.taxes(active);

-- Saved carts for multi-cart workflow
create table if not exists public.saved_carts (
  id uuid primary key default gen_random_uuid(),
  label text,
  cart_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_carts_created_at on public.saved_carts(created_at);

-- Business settings for receipt customization
create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'My Business',
  address text,
  receipt_footer text,
  updated_at timestamptz not null default now()
);

-- Ensure only a single settings row (optional enforcement)
create unique index if not exists uniq_business_settings_singleton on public.business_settings((true));


