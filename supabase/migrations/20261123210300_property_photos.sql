-- Property photos: rows point at WebP files in the public property-photos bucket.

create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  -- Paths inside the property-photos bucket: 1920px WebP and 640px thumbnail
  storage_path text not null check (char_length(storage_path) between 1 and 300 and storage_path !~ '\.\.'),
  thumb_path text not null check (char_length(thumb_path) between 1 and 300 and thumb_path !~ '\.\.'),
  alt_text text not null default '' check (char_length(alt_text) <= 250),
  sort_order int not null default 0,
  is_cover boolean not null default false,
  width int check (width between 1 and 1920),
  height int check (height between 1 and 10000),
  created_at timestamptz not null default now()
);

create index property_photos_property_id_idx on public.property_photos (property_id, sort_order);
create unique index property_photos_one_cover_idx on public.property_photos (property_id) where is_cover;

alter table public.property_photos enable row level security;

-- 20-photo cap per property. SECURITY DEFINER so the count is not filtered by RLS;
-- the property row lock serialises concurrent uploads.
create function public.enforce_property_photo_cap() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform 1 from public.properties where id = new.property_id for update;
  if (select count(*) from public.property_photos where property_id = new.property_id) >= 20 then
    raise exception 'A property can have at most 20 photos' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_property_photo_cap() from public, anon, authenticated;

create trigger property_photos_cap before insert on public.property_photos
  for each row execute function public.enforce_property_photo_cap();

revoke all on table public.property_photos from anon, authenticated, service_role;
grant select on table public.property_photos to anon;
grant select, insert, update, delete on table public.property_photos to authenticated;
grant select, insert, update, delete on table public.property_photos to service_role;

create policy "property_photos: anon reads photos of published properties" on public.property_photos
  for select to anon
  using (exists (
    select 1 from public.properties p
    where p.id = property_id and p.is_published and p.deleted_at is null
  ));

create policy "property_photos: authenticated read" on public.property_photos
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.properties p
      where p.id = property_id and p.is_published and p.deleted_at is null
    )
  );

create policy "property_photos: admins insert" on public.property_photos
  for insert to authenticated with check ((select public.is_admin()));

create policy "property_photos: admins update" on public.property_photos
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "property_photos: owner deletes" on public.property_photos
  for delete to authenticated using ((select public.is_owner()));
