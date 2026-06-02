create table if not exists public.business_customers (
  id uuid primary key default extensions.uuid_generate_v4(),
  company text not null,
  contact_name text,
  email text not null,
  phone text,
  invoice_address text,
  status text not null default 'active',
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.business_customers enable row level security;
grant all on table public.business_customers to service_role;

drop policy if exists "Service role can manage business customers." on public.business_customers;
create policy "Service role can manage business customers."
  on public.business_customers for all to service_role using (true) with check (true);
