-- Mollie-ready order draft schema.
-- Keeps the existing remote orders table intact, but removes the Stripe-only
-- blocker and adds normalized order lines and payment records.

alter table if exists public.orders
  alter column stripe_payment_intent_id drop not null;

alter table if exists public.orders
  add column if not exists order_number text,
  add column if not exists currency text not null default 'EUR',
  add column if not exists subtotal_cents integer not null default 0,
  add column if not exists shipping_cents integer not null default 0,
  add column if not exists tax_cents integer not null default 0,
  add column if not exists total_cents integer,
  add column if not exists payment_status text not null default 'draft',
  add column if not exists checkout_state jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamp with time zone not null default timezone('utc'::text, now());

update public.orders
set total_cents = coalesce(total_cents, amount_total)
where total_cents is null;

create unique index if not exists orders_order_number_key
  on public.orders (order_number)
  where order_number is not null;

create table if not exists public.order_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id bigint,
  variant_id text,
  weight_id uuid,
  name text not null,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  image text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.payments (
  id uuid primary key default extensions.uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'mollie',
  provider_payment_id text,
  status text not null default 'draft',
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR',
  checkout_url text,
  raw_payload jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.refund_requests (
  id uuid primary key default extensions.uuid_generate_v4(),
  payment_id uuid references public.payments(id) on delete set null,
  order_id uuid references public.orders(id) on delete cascade,
  provider text not null default 'mollie',
  amount_cents integer not null check (amount_cents >= 0),
  reason text,
  status text not null default 'draft',
  provider_refund_id text,
  raw_payload jsonb,
  requested_by text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create unique index if not exists payments_provider_payment_id_key
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists refund_requests_order_id_idx on public.refund_requests(order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.refund_requests enable row level security;

revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.refund_requests from anon, authenticated;

grant all on table public.orders to service_role;
grant all on table public.order_items to service_role;
grant all on table public.payments to service_role;
grant all on table public.refund_requests to service_role;

drop policy if exists "Service role can manage orders." on public.orders;
create policy "Service role can manage orders."
  on public.orders
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage order items." on public.order_items;
create policy "Service role can manage order items."
  on public.order_items
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage payments." on public.payments;
create policy "Service role can manage payments."
  on public.payments
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage refund requests." on public.refund_requests;
create policy "Service role can manage refund requests."
  on public.refund_requests
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.order_items is
  'Private order line table. Browser roles remain blocked until customer auth/RLS is designed.';
comment on table public.payments is
  'Private payment table prepared for Mollie create/webhook flow.';
