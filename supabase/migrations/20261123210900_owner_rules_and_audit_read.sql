-- Owners, and anyone with a verified TOTP factor, only count in an aal2 session,
-- so a stolen password alone gets nothing. Enrolment needs neither function.
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

-- The file itself is removed by the server route.
drop policy "property_photos: owner deletes" on public.property_photos;
create policy "property_photos: admins delete" on public.property_photos
  for delete to authenticated using ((select public.is_admin()));

grant select on table public.audit_log to authenticated;
create policy "audit_log: owner reads" on public.audit_log
  for select to authenticated using ((select public.is_owner()));

-- The UI falls back to the post title.
alter table public.blog_posts
  add column featured_image_alt text check (char_length(featured_image_alt) <= 250);

-- Security definer so the count sees every profile. The row locks stop two owners
-- demoting each other at the same time.
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

-- Pages are edited, not removed.
drop policy "seo_pages: owner delete" on public.seo_pages;
revoke delete on table public.seo_pages from authenticated;
