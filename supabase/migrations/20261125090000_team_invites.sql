-- Owners invite team members by email. Only a hash of the token is stored, and an
-- invite can be used once, within 7 days of being sent.

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (
    char_length(email) <= 254 and email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  role public.admin_role not null default 'team_member',
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid references public.admin_profiles (id) on delete set null,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index team_invites_one_pending_per_email on public.team_invites (email)
  where accepted_at is null and cancelled_at is null;

alter table public.team_invites enable row level security;

-- The database sets the expiry and the inviter, so neither can be stretched or forged from the API.
create function public.team_invite_defaults() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.invited_by := coalesce((select auth.uid()), new.invited_by);
    new.sent_at := now();
    new.expires_at := now() + interval '7 days';
  elsif new.token_hash is distinct from old.token_hash then
    new.sent_at := now();
    new.expires_at := now() + interval '7 days';
  end if;
  return new;
end;
$$;

revoke execute on function public.team_invite_defaults() from public, anon, authenticated;

create trigger team_invites_defaults before insert or update on public.team_invites
  for each row execute function public.team_invite_defaults();

revoke all on table public.team_invites from anon, authenticated, service_role;
grant select on table public.team_invites to authenticated;
grant insert (email, role, token_hash) on table public.team_invites to authenticated;
-- a new token resends the invite; cancelled_at withdraws it
grant update (token_hash, cancelled_at) on table public.team_invites to authenticated;
grant select, insert, update, delete on table public.team_invites to service_role;

create policy "team_invites: owner reads" on public.team_invites
  for select to authenticated using ((select public.is_owner()));
create policy "team_invites: owner invites" on public.team_invites
  for insert to authenticated
  with check ((select public.is_owner()) and accepted_at is null and cancelled_at is null);
create policy "team_invites: owner changes pending invites" on public.team_invites
  for update to authenticated
  using ((select public.is_owner()) and accepted_at is null and cancelled_at is null)
  with check ((select public.is_owner()) and accepted_at is null);

-- Uses up the invite and creates the profile in one step, with the role from the invite.
-- Returns null when the invite is unknown, used, cancelled or expired.
create function public.accept_team_invite(p_token_hash text, p_user_id uuid, p_full_name text)
returns public.admin_role
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text;
  v_role public.admin_role;
begin
  update public.team_invites
     set accepted_at = now()
   where token_hash = p_token_hash
     and accepted_at is null
     and cancelled_at is null
     and expires_at > now()
  returning email, role into v_email, v_role;

  if v_role is null then
    return null;
  end if;

  if not exists (select 1 from auth.users where id = p_user_id and lower(email) = v_email) then
    raise exception 'The account does not match the invite' using errcode = '22023';
  end if;

  insert into public.admin_profiles (id, full_name, role) values (p_user_id, btrim(p_full_name), v_role);
  return v_role;
end;
$$;

revoke execute on function public.accept_team_invite(text, uuid, text) from public, anon, authenticated;
grant execute on function public.accept_team_invite(text, uuid, text) to service_role;

-- Emails live in auth.users, so the owner's team list comes through here. Others get no rows.
create function public.list_team()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.admin_role,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.full_name, u.email::text, p.role, p.is_active, p.created_at, u.last_sign_in_at
  from public.admin_profiles p
  join auth.users u on u.id = p.id
  where (select public.is_owner())
  order by p.is_active desc, p.role, p.full_name;
$$;

revoke execute on function public.list_team() from public, anon;
grant execute on function public.list_team() to authenticated;

-- Nobody signed in changes their own role or switches themselves off, even an owner.
create function public.protect_own_profile() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and old.id = (select auth.uid())
     and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'You cannot change your own role or access' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_own_profile() from public, anon, authenticated;

create trigger admin_profiles_protect_own_profile before update on public.admin_profiles
  for each row execute function public.protect_own_profile();

-- Removing someone deletes their auth user, which cascades here, so deletes need the same guard.
create function public.protect_last_owner_delete() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' and old.is_active then
    perform 1 from public.admin_profiles where role = 'owner' and is_active for update;
    if not exists (
      select 1 from public.admin_profiles
      where role = 'owner' and is_active and id <> old.id
    ) then
      raise exception 'The last active owner cannot be removed' using errcode = '23514';
    end if;
  end if;
  return old;
end;
$$;

revoke execute on function public.protect_last_owner_delete() from public, anon, authenticated;

create trigger admin_profiles_protect_last_owner_delete before delete on public.admin_profiles
  for each row execute function public.protect_last_owner_delete();
