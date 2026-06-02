-- Public storefront read access for active catalog data.
-- Mirrors remote policy names captured on 2026-05-15.

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
