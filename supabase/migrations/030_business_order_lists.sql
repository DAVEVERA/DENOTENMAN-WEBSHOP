create table if not exists public.business_order_lists (
  id uuid primary key default extensions.uuid_generate_v4(),
  account_id uuid references public.business_accounts(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.business_order_lists enable row level security;
grant all on table public.business_order_lists to service_role;

drop policy if exists "Service role can manage business order lists." on public.business_order_lists;
create policy "Service role can manage business order lists."
  on public.business_order_lists for all to service_role using (true) with check (true);
