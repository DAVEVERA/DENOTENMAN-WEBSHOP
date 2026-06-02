create table if not exists public.products (
  id bigint primary key,
  name text not null,
  slug text not null unique,
  category text not null,
  category_label text,
  image text,
  description text,
  base_price numeric not null,
  unit text,
  badge text,
  origin text,
  is_active boolean default true,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  weights jsonb
);

alter table public.products enable row level security;
