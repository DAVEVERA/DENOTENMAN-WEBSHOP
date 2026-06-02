create table if not exists public.shipments (
  id uuid primary key default extensions.uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade,
  provider text not null default 'postnl',
  status text not null default 'draft',
  tracking_code text,
  tracking_url text,
  shipping_method text,
  recipient_name text,
  recipient_email text,
  address jsonb not null default '{}'::jsonb,
  raw_payload jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.shipment_labels (
  id uuid primary key default extensions.uuid_generate_v4(),
  shipment_id uuid references public.shipments(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  provider text not null default 'postnl',
  label_url text,
  label_format text not null default 'pdf',
  status text not null default 'draft',
  raw_payload jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists shipments_order_id_idx on public.shipments(order_id);
create index if not exists shipment_labels_order_id_idx on public.shipment_labels(order_id);

alter table public.shipments enable row level security;
alter table public.shipment_labels enable row level security;
grant all on table public.shipments to service_role;
grant all on table public.shipment_labels to service_role;

drop policy if exists "Service role can manage shipments." on public.shipments;
create policy "Service role can manage shipments."
  on public.shipments for all to service_role using (true) with check (true);

drop policy if exists "Service role can manage shipment labels." on public.shipment_labels;
create policy "Service role can manage shipment labels."
  on public.shipment_labels for all to service_role using (true) with check (true);
