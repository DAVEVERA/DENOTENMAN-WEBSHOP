create table if not exists public.marketing_banners (
  id uuid primary key default extensions.uuid_generate_v4(),
  title text not null,
  position text not null,
  image text,
  href text,
  status text not null default 'draft',
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default extensions.uuid_generate_v4(),
  title text not null,
  channel text not null default 'site',
  status text not null default 'draft',
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.newsletter_campaigns (
  id uuid primary key default extensions.uuid_generate_v4(),
  title text not null,
  subject text,
  status text not null default 'draft',
  audience text,
  sent_at timestamp with time zone,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.marketing_banners enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.newsletter_campaigns enable row level security;
grant all on table public.marketing_banners to service_role;
grant all on table public.marketing_campaigns to service_role;
grant all on table public.newsletter_campaigns to service_role;

drop policy if exists "Service role can manage marketing banners." on public.marketing_banners;
create policy "Service role can manage marketing banners."
  on public.marketing_banners for all to service_role using (true) with check (true);

drop policy if exists "Service role can manage marketing campaigns." on public.marketing_campaigns;
create policy "Service role can manage marketing campaigns."
  on public.marketing_campaigns for all to service_role using (true) with check (true);

drop policy if exists "Service role can manage newsletter campaigns." on public.newsletter_campaigns;
create policy "Service role can manage newsletter campaigns."
  on public.newsletter_campaigns for all to service_role using (true) with check (true);
