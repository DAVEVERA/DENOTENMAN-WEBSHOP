create table if not exists public.business_price_tiers (
  id uuid primary key default extensions.uuid_generate_v4(),
  account_id uuid references public.business_accounts(id) on delete cascade,
  product_id bigint references public.products(id) on delete cascade,
  min_quantity integer not null default 1,
  price numeric not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.business_price_tiers enable row level security;
grant all on table public.business_price_tiers to service_role;

drop policy if exists "Service role can manage business price tiers." on public.business_price_tiers;
create policy "Service role can manage business price tiers."
  on public.business_price_tiers for all to service_role using (true) with check (true);
