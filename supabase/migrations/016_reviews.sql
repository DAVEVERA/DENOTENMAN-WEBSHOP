create table if not exists public.reviews (
  id uuid primary key default extensions.uuid_generate_v4(),
  product_id bigint references public.products(id) on delete set null,
  customer_email text,
  customer_name text,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  status text not null default 'pending',
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists reviews_product_id_idx on public.reviews(product_id);

alter table public.reviews enable row level security;
grant select on table public.reviews to anon, authenticated;
grant all on table public.reviews to service_role;

drop policy if exists "Public published reviews are viewable." on public.reviews;
create policy "Public published reviews are viewable."
  on public.reviews for select to public using (status = 'published');

drop policy if exists "Service role can manage reviews." on public.reviews;
create policy "Service role can manage reviews."
  on public.reviews for all to service_role using (true) with check (true);
