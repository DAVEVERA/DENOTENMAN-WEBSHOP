-- Remote currently stores product image URLs directly on products/variants.
-- These backup tables also exist remotely and are captured here for parity.

create table if not exists public.product_media (
  id uuid primary key default extensions.uuid_generate_v4(),
  product_id bigint not null references public.products(id) on delete cascade,
  bucket text not null default 'product-images',
  object_path text not null,
  public_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  mime_type text,
  size_bytes bigint,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique(bucket, object_path)
);

create unique index if not exists product_media_one_primary_idx
  on public.product_media(product_id)
  where is_primary = true;

create index if not exists product_media_product_id_sort_idx
  on public.product_media(product_id, sort_order, created_at);

alter table public.product_media enable row level security;
grant select on table public.product_media to anon, authenticated;
grant all on table public.product_media to service_role;

drop policy if exists "Public product media is viewable by everyone." on public.product_media;
create policy "Public product media is viewable by everyone."
  on public.product_media for select to public using (true);

drop policy if exists "Service role can manage product media." on public.product_media;
create policy "Service role can manage product media."
  on public.product_media for all to service_role using (true) with check (true);

create table if not exists public.backup_products_image (
  id bigint,
  image text,
  backed_up_at timestamp with time zone
);

create table if not exists public.image_backup_products (
  id bigint,
  image text,
  backed_up_at timestamp with time zone
);

create table if not exists public.image_backup_product_variants (
  id uuid,
  image text,
  product_id bigint,
  backed_up_at timestamp with time zone
);

alter table public.backup_products_image enable row level security;
alter table public.image_backup_products enable row level security;
alter table public.image_backup_product_variants enable row level security;

revoke all on table public.backup_products_image from anon, authenticated;
revoke all on table public.image_backup_products from anon, authenticated;
revoke all on table public.image_backup_product_variants from anon, authenticated;

grant all on table public.backup_products_image to service_role;
grant all on table public.image_backup_products to service_role;
grant all on table public.image_backup_product_variants to service_role;
