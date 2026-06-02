create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.admin_settings enable row level security;
grant all on table public.admin_settings to service_role;

drop policy if exists "Service role can manage admin settings." on public.admin_settings;
create policy "Service role can manage admin settings."
  on public.admin_settings for all to service_role using (true) with check (true);
