-- Remote baseline:
-- public.orders has RLS enabled and no policies. Keep client access blocked.
--
-- Admin/customer order policies must be designed together with authentication
-- and Mollie checkout before this table is exposed.

alter table if exists public.orders enable row level security;

revoke all on table public.orders from anon, authenticated;
grant all on table public.orders to service_role;

drop policy if exists "Service role can manage orders." on public.orders;
create policy "Service role can manage orders."
  on public.orders
  for all
  to service_role
  using (true)
  with check (true);

alter table if exists public.order_items enable row level security;
alter table if exists public.payments enable row level security;

revoke all on table public.order_items from anon, authenticated;
revoke all on table public.payments from anon, authenticated;

grant all on table public.order_items to service_role;
grant all on table public.payments to service_role;

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
