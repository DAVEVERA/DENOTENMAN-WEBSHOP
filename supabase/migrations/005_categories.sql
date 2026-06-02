create table if not exists public.categories (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.categories enable row level security;
grant select on table public.categories to anon, authenticated;
grant all on table public.categories to service_role;

drop policy if exists "Public categories are viewable by everyone." on public.categories;
create policy "Public categories are viewable by everyone."
  on public.categories for select to public using (is_active = true);

drop policy if exists "Service role can manage categories." on public.categories;
create policy "Service role can manage categories."
  on public.categories for all to service_role using (true) with check (true);
