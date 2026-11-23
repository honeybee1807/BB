-- Regions and estates: public read, owner write.

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 10000),
  -- path in the property-photos bucket
  hero_image_path text check (char_length(hero_image_path) <= 300),
  sort_order int not null default 0,
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.regions enable row level security;

create trigger regions_set_updated_at before update on public.regions
  for each row execute function public.set_updated_at();

revoke all on table public.regions from anon, authenticated, service_role;
grant select on table public.regions to anon;
grant select, insert, update, delete on table public.regions to authenticated;
grant select, insert, update, delete on table public.regions to service_role;

create policy "regions: anon read" on public.regions
  for select to anon using (true);
create policy "regions: authenticated read" on public.regions
  for select to authenticated using (true);
create policy "regions: owner insert" on public.regions
  for insert to authenticated with check ((select public.is_owner()));
create policy "regions: owner update" on public.regions
  for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "regions: owner delete" on public.regions
  for delete to authenticated using ((select public.is_owner()));

create table public.estates (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 10000),
  -- path in the property-photos bucket
  hero_image_path text check (char_length(hero_image_path) <= 300),
  sort_order int not null default 0,
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index estates_region_id_idx on public.estates (region_id);

alter table public.estates enable row level security;

create trigger estates_set_updated_at before update on public.estates
  for each row execute function public.set_updated_at();

revoke all on table public.estates from anon, authenticated, service_role;
grant select on table public.estates to anon;
grant select, insert, update, delete on table public.estates to authenticated;
grant select, insert, update, delete on table public.estates to service_role;

create policy "estates: anon read" on public.estates
  for select to anon using (true);
create policy "estates: authenticated read" on public.estates
  for select to authenticated using (true);
create policy "estates: owner insert" on public.estates
  for insert to authenticated with check ((select public.is_owner()));
create policy "estates: owner update" on public.estates
  for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "estates: owner delete" on public.estates
  for delete to authenticated using ((select public.is_owner()));
