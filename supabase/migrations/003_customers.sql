create table if not exists public.customers (
  id uuid primary key default extensions.uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete set null,
  email text not null,
  name text,
  phone text,
  marketing_opt_in boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create unique index if not exists customers_email_key on public.customers(lower(email));

alter table public.customers enable row level security;
grant all on table public.customers to service_role;

drop policy if exists "Service role can manage customers." on public.customers;
create policy "Service role can manage customers."
  on public.customers for all to service_role using (true) with check (true);
