create table if not exists public.orders (
  id uuid primary key default extensions.uuid_generate_v4(),
  stripe_payment_intent_id text not null unique,
  amount_total integer not null,
  customer_email text,
  customer_name text,
  status text default 'pending',
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  items jsonb
);

alter table public.orders enable row level security;

-- NOTE:
-- Remote currently uses stripe_payment_intent_id. The application roadmap says
-- Mollie. Keep this column for baseline parity until the checkout/payment
-- migration is designed.
