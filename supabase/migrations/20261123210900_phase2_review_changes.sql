-- Phase 2 review changes.

-- ---------------------------------------------------------------------------
-- 1. Two-factor layer in the database.
--    is_owner(): the owner role counts only in an aal2 (TOTP-verified) session.
--    is_admin(): an owner, or anyone who has enrolled a verified factor, counts
--    only in an aal2 session. Otherwise a stolen owner password alone (aal1)
--    would still give team-member access through the API.
--    TOTP enrolment needs neither helper: it uses the Auth API with an aal1
--    session, and a user can always read their own admin_profiles row
--    (policy: id = auth.uid()), so the app can see "owner, must verify".
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and (
        coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
        or (
          p.role <> 'owner'
          and not exists (
            select 1 from auth.mfa_factors f
            where f.user_id = p.id and f.status = 'verified'
          )
        )
      )
  );
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role = 'owner'
      and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Team members may delete property photo rows (the file is removed by the
--    server route, which also writes the audit row).
-- ---------------------------------------------------------------------------
drop policy "property_photos: owner deletes" on public.property_photos;
create policy "property_photos: admins delete" on public.property_photos
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 3. audit_log: the owner may read (read only). Writes stay service role only.
-- ---------------------------------------------------------------------------
grant select on table public.audit_log to authenticated;
create policy "audit_log: owner reads" on public.audit_log
  for select to authenticated using ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- 4. blog_posts.featured_image_alt (nullable; the UI falls back to the title).
--    property_photos already has alt_text.
-- ---------------------------------------------------------------------------
alter table public.blog_posts
  add column featured_image_alt text check (char_length(featured_image_alt) <= 250);

-- ---------------------------------------------------------------------------
-- 5. The last active owner cannot be demoted or deactivated (any role, including
--    the service role). SECURITY DEFINER so the count sees every profile; the
--    row locks serialise two owners demoting each other at the same time.
-- ---------------------------------------------------------------------------
create function public.protect_last_owner() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' and old.is_active
     and (new.role <> 'owner' or not new.is_active) then
    perform 1 from public.admin_profiles where role = 'owner' and is_active for update;
    if not exists (
      select 1 from public.admin_profiles
      where role = 'owner' and is_active and id <> old.id
    ) then
      raise exception 'The last active owner cannot be demoted or deactivated' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_last_owner() from public, anon, authenticated;

create trigger admin_profiles_protect_last_owner before update on public.admin_profiles
  for each row execute function public.protect_last_owner();

-- ---------------------------------------------------------------------------
-- 6. seo_pages: no DELETE for authenticated (rows are edited, not removed).
-- ---------------------------------------------------------------------------
drop policy "seo_pages: owner delete" on public.seo_pages;
revoke delete on table public.seo_pages from authenticated;
