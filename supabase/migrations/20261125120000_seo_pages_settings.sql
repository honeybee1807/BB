-- Page SEO is edited from Settings. A blank title or description means "use the built-in
-- default", so both may now be null, and the database records who last changed a page.

alter table public.seo_pages alter column title drop not null;
alter table public.seo_pages alter column description drop not null;
alter table public.seo_pages drop constraint seo_pages_title_check;
alter table public.seo_pages drop constraint seo_pages_description_check;
alter table public.seo_pages add constraint seo_pages_title_check
  check (title is null or char_length(btrim(title)) between 1 and 120);
alter table public.seo_pages add constraint seo_pages_description_check
  check (description is null or char_length(btrim(description)) between 1 and 320);

alter table public.seo_pages
  add column updated_by uuid references public.admin_profiles (id) on delete set null;

-- Taken from the session, never from the request.
create function public.set_seo_updated_by() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

revoke execute on function public.set_seo_updated_by() from public, anon, authenticated;

create trigger seo_pages_set_updated_by before insert or update on public.seo_pages
  for each row execute function public.set_seo_updated_by();

-- The public site reads these as anon. Signed in, only the owner sees the settings.
drop policy "seo_pages: authenticated read" on public.seo_pages;
create policy "seo_pages: owner reads" on public.seo_pages
  for select to authenticated using ((select public.is_owner()));

revoke insert, update on table public.seo_pages from authenticated;
grant insert (path, title, description, og_image_path) on table public.seo_pages to authenticated;
grant update (title, description, og_image_path) on table public.seo_pages to authenticated;
