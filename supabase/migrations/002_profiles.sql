create table if not exists public.profiles (
  id uuid primary key,
  email text unique,
  full_name text,
  role text not null default 'customer',
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;
grant all on table public.profiles to service_role;

drop policy if exists "Service role can manage profiles." on public.profiles;
create policy "Service role can manage profiles."
  on public.profiles for all to service_role using (true) with check (true);
