create table if not exists public.media_assets (
  id uuid primary key default extensions.uuid_generate_v4(),
  bucket text not null,
  object_path text not null,
  public_url text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  source text not null default 'admin',
  created_by text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique(bucket, object_path)
);

alter table public.media_assets enable row level security;
grant all on table public.media_assets to service_role;

drop policy if exists "Service role can manage media assets." on public.media_assets;
create policy "Service role can manage media assets."
  on public.media_assets for all to service_role using (true) with check (true);
