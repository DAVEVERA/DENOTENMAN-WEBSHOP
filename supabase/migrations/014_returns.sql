create table if not exists public.returns (
  id uuid primary key default extensions.uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade,
  status text not null default 'requested',
  reason text,
  customer_email text,
  items jsonb not null default '[]'::jsonb,
  return_label_url text,
  raw_payload jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists returns_order_id_idx on public.returns(order_id);

alter table public.returns enable row level security;
grant all on table public.returns to service_role;

drop policy if exists "Service role can manage returns." on public.returns;
create policy "Service role can manage returns."
  on public.returns for all to service_role using (true) with check (true);
