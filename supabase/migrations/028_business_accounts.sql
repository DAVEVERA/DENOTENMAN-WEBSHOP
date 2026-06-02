create table if not exists public.business_accounts (
  id uuid primary key default extensions.uuid_generate_v4(),
  customer_id uuid references public.business_customers(id) on delete cascade,
  account_name text not null,
  status text not null default 'active',
  payment_terms text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.business_accounts enable row level security;
grant all on table public.business_accounts to service_role;

drop policy if exists "Service role can manage business accounts." on public.business_accounts;
create policy "Service role can manage business accounts."
  on public.business_accounts for all to service_role using (true) with check (true);
