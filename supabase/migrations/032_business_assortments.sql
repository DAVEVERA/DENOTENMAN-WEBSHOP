create table if not exists public.business_assortments (
  id uuid primary key default extensions.uuid_generate_v4(),
  account_id uuid references public.business_accounts(id) on delete cascade,
  product_id bigint references public.products(id) on delete cascade,
  is_enabled boolean not null default true,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique(account_id, product_id)
);

alter table public.business_assortments enable row level security;
grant all on table public.business_assortments to service_role;

drop policy if exists "Service role can manage business assortments." on public.business_assortments;
create policy "Service role can manage business assortments."
  on public.business_assortments for all to service_role using (true) with check (true);
