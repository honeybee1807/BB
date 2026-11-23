-- Journal posts and static-page SEO.

-- ---------------------------------------------------------------------------
-- blog_posts: public sees published, non-deleted. Admins write. Owner soft deletes.
-- ---------------------------------------------------------------------------
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  excerpt text check (char_length(excerpt) <= 300),
  -- Markdown, rendered without raw HTML.
  body_md text not null default '' check (char_length(body_md) <= 50000),
  -- Path inside the blog-images bucket
  featured_image_path text check (char_length(featured_image_path) <= 300 and featured_image_path !~ '\.\.'),
  author_id uuid references public.admin_profiles (id) on delete set null,
  is_published boolean not null default false,
  published_at timestamptz,
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_published_has_date check (not is_published or published_at is not null)
);

create index blog_posts_author_id_idx on public.blog_posts (author_id);
create index blog_posts_public_listing_idx on public.blog_posts (published_at desc)
  where is_published and deleted_at is null;

alter table public.blog_posts enable row level security;

-- Stamp published_at the first time a post is published (kept on unpublish/republish).
create function public.set_blog_published_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_published and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.set_blog_published_at() from public, anon, authenticated;

create trigger blog_posts_set_published_at before insert or update on public.blog_posts
  for each row execute function public.set_blog_published_at();
create trigger blog_posts_set_updated_at before update on public.blog_posts
  for each row execute function public.set_updated_at();
create trigger blog_posts_owner_soft_delete before insert or update on public.blog_posts
  for each row execute function public.enforce_owner_soft_delete();

revoke all on table public.blog_posts from anon, authenticated, service_role;
grant select on table public.blog_posts to anon;
grant select, insert, update on table public.blog_posts to authenticated;
grant select, insert, update, delete on table public.blog_posts to service_role;

create policy "blog_posts: anon reads published" on public.blog_posts
  for select to anon
  using (is_published and deleted_at is null);

create policy "blog_posts: authenticated read" on public.blog_posts
  for select to authenticated
  using (
    (is_published and deleted_at is null)
    or (deleted_at is null and (select public.is_admin()))
    or (select public.is_owner())
  );

create policy "blog_posts: admins insert" on public.blog_posts
  for insert to authenticated
  with check ((select public.is_admin()) and (deleted_at is null or (select public.is_owner())));

create policy "blog_posts: admins update, owner soft deletes" on public.blog_posts
  for update to authenticated
  using ((select public.is_admin()) and (deleted_at is null or (select public.is_owner())))
  with check ((select public.is_admin()) and (deleted_at is null or (select public.is_owner())));

-- ---------------------------------------------------------------------------
-- seo_pages: title and meta for static pages. Public read, owner write.
-- ---------------------------------------------------------------------------
create table public.seo_pages (
  path text primary key check (path ~ '^/[a-z0-9/-]*$' and char_length(path) <= 200),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 320),
  -- Path inside the property-photos bucket, or null for the site default
  og_image_path text check (char_length(og_image_path) <= 300 and og_image_path !~ '\.\.'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seo_pages enable row level security;

create trigger seo_pages_set_updated_at before update on public.seo_pages
  for each row execute function public.set_updated_at();

revoke all on table public.seo_pages from anon, authenticated, service_role;
grant select on table public.seo_pages to anon;
grant select, insert, update, delete on table public.seo_pages to authenticated;
grant select, insert, update, delete on table public.seo_pages to service_role;

create policy "seo_pages: anon read" on public.seo_pages
  for select to anon using (true);
create policy "seo_pages: authenticated read" on public.seo_pages
  for select to authenticated using (true);
create policy "seo_pages: owner insert" on public.seo_pages
  for insert to authenticated with check ((select public.is_owner()));
create policy "seo_pages: owner update" on public.seo_pages
  for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "seo_pages: owner delete" on public.seo_pages
  for delete to authenticated using ((select public.is_owner()));

-- Default rows for the static pages (editable by the owner in Settings).
-- Titles are complete; the app does not append a suffix to them.
insert into public.seo_pages (path, title, description) values
  ('/', 'Halal Accommodation South Africa | Bargain Breaks',
   'Halal-conscious holiday homes and resorts from the coast to the mountains, each one personally reviewed.'),
  ('/properties', 'Holiday Homes and Resorts | Bargain Breaks',
   'Browse halal accommodation across the Drakensberg and beyond, with details of every home.'),
  ('/about', 'About Us | Bargain Breaks',
   'Who we are and how we choose halal-conscious holiday accommodation for families.'),
  ('/journal', 'Journal | Bargain Breaks',
   'Travel ideas and guides for halal-friendly holidays in South Africa.'),
  ('/contact', 'Contact Us | Bargain Breaks',
   'Send us an inquiry about halal accommodation and we will confirm the details personally.'),
  ('/privacy', 'Privacy Policy | Bargain Breaks',
   'How Bargain Breaks collects, uses and protects your personal information under POPIA.')
on conflict (path) do nothing;
