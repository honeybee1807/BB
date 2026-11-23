-- Properties, the owner-only soft-delete trigger (shared with blog_posts and inquiries)
-- and the custom_fields validator.

-- ---------------------------------------------------------------------------
-- Owner-only soft delete. Enforced here AND in the RLS policies.
-- Applies to API roles only: the service role (server-side purge/restore) and
-- migrations are not API callers and are trusted.
-- ---------------------------------------------------------------------------
create function public.enforce_owner_soft_delete() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.deleted_at is not null and not public.is_owner() then
      raise exception 'Only the owner can delete records' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at and not public.is_owner() then
      raise exception 'Only the owner can delete or restore records' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_owner_soft_delete() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- custom_fields: a JSON array of at most 30 {"label": text, "value": text} objects.
-- Used in a CHECK constraint, so writers need EXECUTE. It is pure and reveals nothing.
-- ---------------------------------------------------------------------------
create function public.is_valid_custom_fields(p_fields jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select case
    when p_fields is null or jsonb_typeof(p_fields) <> 'array' then false
    when jsonb_array_length(p_fields) > 30 then false
    else not exists (
      select 1
      from jsonb_array_elements(p_fields) as e(item)
      where jsonb_typeof(e.item) <> 'object'
         or coalesce(jsonb_typeof(e.item -> 'label'), '') <> 'string'
         or coalesce(jsonb_typeof(e.item -> 'value'), '') <> 'string'
         or char_length(e.item ->> 'label') not between 1 and 60
         or char_length(e.item ->> 'value') > 500
         or (select count(*) from jsonb_object_keys(e.item)) <> 2
    )
  end;
$$;

revoke execute on function public.is_valid_custom_fields(jsonb) from public, anon;
grant execute on function public.is_valid_custom_fields(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
create type public.property_type as enum ('resort', 'holiday_home');

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  summary text check (char_length(summary) <= 300),
  description text check (char_length(description) <= 10000),
  property_type public.property_type not null default 'holiday_home',
  town text check (char_length(town) <= 120),
  max_guests int check (max_guests between 1 and 100),
  bedrooms int check (bedrooms between 0 and 50),
  bathrooms int check (bathrooms between 0 and 50),
  is_halal boolean not null default false,
  halal_details text check (char_length(halal_details) <= 3000),
  instagram_video_url text check (
    char_length(instagram_video_url) <= 300
    and instagram_video_url ~ '^https://(www\.)?instagram\.com/(p|reel|reels|tv)/[A-Za-z0-9_-]+/?(\?[A-Za-z0-9_=&%.-]*)?$'
  ),
  custom_fields jsonb not null default '[]'::jsonb check (public.is_valid_custom_fields(custom_fields)),
  -- Optional "From R... / night". Hidden in the UI when null.
  price_from_zar int check (price_from_zar between 0 and 10000000),
  is_featured boolean not null default false,
  featured_sort_order int not null default 0,
  is_published boolean not null default false,
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_estate_id_idx on public.properties (estate_id);
create index properties_public_listing_idx on public.properties (is_featured desc, featured_sort_order, name)
  where is_published and deleted_at is null;

alter table public.properties enable row level security;

create trigger properties_set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();
create trigger properties_owner_soft_delete before insert or update on public.properties
  for each row execute function public.enforce_owner_soft_delete();

revoke all on table public.properties from anon, authenticated, service_role;
grant select on table public.properties to anon;
-- No DELETE for authenticated: removal is a soft delete; purge runs with the service role.
grant select, insert, update on table public.properties to authenticated;
grant select, insert, update, delete on table public.properties to service_role;

create policy "properties: anon reads published" on public.properties
  for select to anon
  using (is_published and deleted_at is null);

create policy "properties: authenticated read" on public.properties
  for select to authenticated
  using (
    (is_published and deleted_at is null)
    or (deleted_at is null and (select public.is_admin()))
    or (select public.is_owner())
  );

create policy "properties: admins insert" on public.properties
  for insert to authenticated
  with check ((select public.is_admin()) and (deleted_at is null or (select public.is_owner())));

create policy "properties: admins update, owner soft deletes" on public.properties
  for update to authenticated
  using ((select public.is_admin()) and (deleted_at is null or (select public.is_owner())))
  with check ((select public.is_admin()) and (deleted_at is null or (select public.is_owner())));
