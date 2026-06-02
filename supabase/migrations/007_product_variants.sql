create table if not exists public.product_variants (
  id uuid primary key default extensions.uuid_generate_v4(),
  product_id bigint not null references public.products(id) on delete cascade,
  variant_id text not null,
  name text not null,
  price numeric not null,
  image text,
  sku text,
  stock_status text default 'in_stock',
  stock_label text default 'Op voorraad',
  unique (product_id, variant_id)
);

alter table public.product_variants enable row level security;
