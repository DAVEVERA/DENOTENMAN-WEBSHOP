create extension if not exists "uuid-ossp" with schema extensions;

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

alter table public.business_customers
  add column if not exists billing_address text,
  add column if not exists shipping_address text,
  add column if not exists kvk_number text,
  add column if not exists vat_number text,
  add column if not exists payment_on_account boolean not null default false,
  add column if not exists notes text;

update public.business_customers
set billing_address = coalesce(billing_address, invoice_address)
where invoice_address is not null;

alter table public.business_customers enable row level security;
grant all on table public.business_customers to service_role;

drop policy if exists "Service role can manage business customers." on public.business_customers;
create policy "Service role can manage business customers."
  on public.business_customers for all to service_role using (true) with check (true);
