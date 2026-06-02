create table if not exists public.product_weights (
  id uuid primary key default extensions.uuid_generate_v4(),
  product_id bigint not null references public.products(id) on delete cascade,
  label text not null,
  grams integer not null,
  price numeric not null,
  unique (product_id, grams)
);

alter table public.product_weights enable row level security;

-- Remote inventory status currently lives on product_variants.stock_status and
-- product_variants.stock_label. A separate inventory ledger can be added later
-- when admin stock mutations are implemented.

create table if not exists public.inventory_mutations (
  id uuid primary key default extensions.uuid_generate_v4(),
  product_id bigint not null references public.products(id) on delete cascade,
  variant_id text,
  sku text,
  delta integer not null,
  reason text not null,
  note text,
  admin_email text,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists inventory_mutations_product_id_idx
  on public.inventory_mutations(product_id, created_at desc);

alter table public.inventory_mutations enable row level security;
grant all on table public.inventory_mutations to service_role;

drop policy if exists "Service role can manage inventory mutations." on public.inventory_mutations;
create policy "Service role can manage inventory mutations."
  on public.inventory_mutations for all to service_role using (true) with check (true);
