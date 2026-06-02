create table if not exists public.discounts (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null unique,
  name text,
  discount_type text not null default 'percent',
  value numeric not null default 0,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  is_active boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.discounts enable row level security;
grant all on table public.discounts to service_role;

drop policy if exists "Service role can manage discounts." on public.discounts;
create policy "Service role can manage discounts."
  on public.discounts for all to service_role using (true) with check (true);
