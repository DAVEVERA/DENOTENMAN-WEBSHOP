create table if not exists public.blog_posts (
  id uuid primary key default extensions.uuid_generate_v4(),
  title text not null,
  slug text not null unique,
  category text,
  excerpt text,
  content text,
  image text,
  seo_title text,
  seo_description text,
  status text not null default 'draft',
  published_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.blog_posts enable row level security;
grant select on table public.blog_posts to anon, authenticated;
grant all on table public.blog_posts to service_role;

drop policy if exists "Public blog posts are viewable." on public.blog_posts;
create policy "Public blog posts are viewable."
  on public.blog_posts for select to public using (status = 'published');

drop policy if exists "Service role can manage blog posts." on public.blog_posts;
create policy "Service role can manage blog posts."
  on public.blog_posts for all to service_role using (true) with check (true);
