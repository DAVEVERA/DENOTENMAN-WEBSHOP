create table if not exists public.business_quotes (
  id uuid primary key default extensions.uuid_generate_v4(),
  account_id uuid references public.business_accounts(id) on delete set null,
  quote_number text,
  status text not null default 'draft',
  items jsonb not null default '[]'::jsonb,
  total_cents integer not null default 0,
  valid_until date,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.business_quotes enable row level security;
grant all on table public.business_quotes to service_role;

drop policy if exists "Service role can manage business quotes." on public.business_quotes;
create policy "Service role can manage business quotes."
  on public.business_quotes for all to service_role using (true) with check (true);
