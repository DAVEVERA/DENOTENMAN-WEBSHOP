create table if not exists public.cms_pages (
  id uuid primary key default extensions.uuid_generate_v4(),
  title text not null,
  slug text not null unique,
  content text,
  seo_title text,
  seo_description text,
  status text not null default 'draft',
  published_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.cms_pages enable row level security;
grant select on table public.cms_pages to anon, authenticated;
grant all on table public.cms_pages to service_role;

drop policy if exists "Public CMS pages are viewable." on public.cms_pages;
create policy "Public CMS pages are viewable."
  on public.cms_pages for select to public using (status = 'published');

drop policy if exists "Service role can manage CMS pages." on public.cms_pages;
create policy "Service role can manage CMS pages."
  on public.cms_pages for all to service_role using (true) with check (true);
