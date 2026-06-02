create table if not exists public.carts (
  id uuid primary key default extensions.uuid_generate_v4(),
  cart_token text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'active',
  items jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.carts enable row level security;
grant all on table public.carts to service_role;

drop policy if exists "Service role can manage carts." on public.carts;
create policy "Service role can manage carts."
  on public.carts for all to service_role using (true) with check (true);
