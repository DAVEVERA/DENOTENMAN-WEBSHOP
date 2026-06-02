create table if not exists public.addresses (
  id uuid primary key default extensions.uuid_generate_v4(),
  customer_id uuid references public.customers(id) on delete cascade,
  type text not null default 'shipping',
  name text,
  company text,
  line1 text not null,
  line2 text,
  postal_code text not null,
  city text not null,
  country text not null default 'NL',
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists addresses_customer_id_idx on public.addresses(customer_id);

alter table public.addresses enable row level security;
grant all on table public.addresses to service_role;

drop policy if exists "Service role can manage addresses." on public.addresses;
create policy "Service role can manage addresses."
  on public.addresses for all to service_role using (true) with check (true);
