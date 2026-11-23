-- Foundation: shared trigger function, admin roles, admin_profiles and role helpers.
--
-- Grant convention for every table in this project:
--   1. revoke all from anon, authenticated, service_role (the local default ACL hands
--      them TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on new tables),
--   2. grant exactly the privileges each role needs,
--   3. RLS enabled in the same migration, policies split by role ("to anon" policies
--      never call is_admin()/is_owner(), which anon cannot execute).

-- Functions created later in public must not be executable by PUBLIC by default.
alter default privileges in schema public revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_profiles
-- ---------------------------------------------------------------------------
create type public.admin_role as enum ('owner', 'team_member');

create table public.admin_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  role public.admin_role not null default 'team_member',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;

revoke all on table public.admin_profiles from anon, authenticated, service_role;
-- Signed-in admins read profiles; the owner changes name, role and active flag.
-- New profiles are created only by the owner's invitation route (service role).
grant select on table public.admin_profiles to authenticated;
grant update (full_name, role, is_active) on table public.admin_profiles to authenticated;
grant select, insert, update, delete on table public.admin_profiles to service_role;

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so they can read admin_profiles under RLS.
-- Roles live in the table, not the token: deactivation takes effect at once.
-- ---------------------------------------------------------------------------
create function public.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles
    where id = (select auth.uid()) and is_active
  );
$$;

create function public.is_owner() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles
    where id = (select auth.uid()) and is_active and role = 'owner'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_owner() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- admin_profiles policies (authenticated only; anon has no grant at all)
-- ---------------------------------------------------------------------------
create policy "admin_profiles: read own row or owner reads all"
  on public.admin_profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_owner()));

create policy "admin_profiles: owner updates"
  on public.admin_profiles for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- Assignee list. The guide keeps full profile rows owner-only; team members
-- still need names to assign inquiries, so this returns id and name only,
-- and only to an active admin.
-- ---------------------------------------------------------------------------
create function public.list_active_admins()
returns table (id uuid, full_name text)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.full_name
  from public.admin_profiles p
  where p.is_active and (select public.is_admin())
  order by p.full_name;
$$;

revoke execute on function public.list_active_admins() from public, anon;
grant execute on function public.list_active_admins() to authenticated;
