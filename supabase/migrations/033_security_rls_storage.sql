-- Security hardening for current remote findings.
-- This migration keeps backup/order data private and leaves admin writes
-- server-side through the service-role key.

alter table if exists public.image_backup_products enable row level security;
alter table if exists public.image_backup_product_variants enable row level security;
alter table if exists public.backup_products_image enable row level security;
alter table if exists public.orders enable row level security;

revoke all on table public.image_backup_products from anon, authenticated;
revoke all on table public.image_backup_product_variants from anon, authenticated;
revoke all on table public.backup_products_image from anon, authenticated;
revoke all on table public.orders from anon, authenticated;

grant all on table public.image_backup_products to service_role;
grant all on table public.image_backup_product_variants to service_role;
grant all on table public.backup_products_image to service_role;
grant all on table public.orders to service_role;

drop policy if exists "Service role can manage image backup products." on public.image_backup_products;
create policy "Service role can manage image backup products."
  on public.image_backup_products
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage image backup product variants." on public.image_backup_product_variants;
create policy "Service role can manage image backup product variants."
  on public.image_backup_product_variants
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage backup product images." on public.backup_products_image;
create policy "Service role can manage backup product images."
  on public.backup_products_image
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage orders." on public.orders;
create policy "Service role can manage orders."
  on public.orders
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.image_backup_products is
  'Private image backup table. RLS enabled; no anon/authenticated access.';
comment on table public.image_backup_product_variants is
  'Private variant image backup table. RLS enabled; no anon/authenticated access.';
comment on table public.orders is
  'Private order baseline table. Keep closed until checkout, customer auth, and payment policies are designed.';

drop policy if exists "Public product images are viewable." on storage.objects;

-- product-images is a public bucket, so direct object URL reads do not require
-- a broad storage.objects SELECT policy. Intentionally no anon/authenticated
-- INSERT, UPDATE or DELETE policy is defined for product-images. The admin app
-- uploads server-side with the service-role key.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;
