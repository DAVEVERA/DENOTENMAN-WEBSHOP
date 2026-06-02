drop policy if exists "Public products are viewable by everyone." on public.products;
create policy "Public products are viewable by everyone."
  on public.products
  for select
  to public
  using (true);

drop policy if exists "Public variants are viewable by everyone." on public.product_variants;
create policy "Public variants are viewable by everyone."
  on public.product_variants
  for select
  to public
  using (true);

drop policy if exists "Public weights are viewable by everyone." on public.product_weights;
create policy "Public weights are viewable by everyone."
  on public.product_weights
  for select
  to public
  using (true);

-- Remote has RLS enabled but no policies on public.orders and
-- public.backup_products_image. This means client access is blocked.
-- That is appropriate for orders until customer/admin policies are designed.
