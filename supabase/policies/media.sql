-- Backup image tables are private.
-- They exist for parity with the remote project but must never be exposed to
-- the storefront or browser clients.

alter table if exists public.image_backup_products enable row level security;
alter table if exists public.image_backup_product_variants enable row level security;
alter table if exists public.backup_products_image enable row level security;

revoke all on table public.image_backup_products from anon, authenticated;
revoke all on table public.image_backup_product_variants from anon, authenticated;
revoke all on table public.backup_products_image from anon, authenticated;

grant all on table public.image_backup_products to service_role;
grant all on table public.image_backup_product_variants to service_role;
grant all on table public.backup_products_image to service_role;

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

drop policy if exists "Public product images are viewable." on storage.objects;

-- product-images is public at bucket level; no broad storage.objects SELECT
-- policy is needed for direct object URL reads.
-- No browser upload/update/delete policy is defined for product-images.
-- Admin uploads stay server-side through the service-role key.
