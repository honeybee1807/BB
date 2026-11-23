-- admin_profiles, is_admin(), is_owner(), list_active_admins()
-- Fixture users: a1 owner, a2 active team member, a3 inactive team member,
-- a4 authenticated user with no profile.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'team@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'inactive@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'outsider@test.local');
insert into public.admin_profiles (id, full_name, role, is_active) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Owner', 'owner', true),
  ('00000000-0000-0000-0000-0000000000a2', 'Test Team', 'team_member', true),
  ('00000000-0000-0000-0000-0000000000a3', 'Test Inactive', 'team_member', false);

-- Structure -----------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.admin_profiles'::regclass),
  'admin_profiles has RLS enabled');
select ok(not has_table_privilege('anon', 'public.admin_profiles', 'select,insert,update,delete,truncate'),
  'anon has no privileges on admin_profiles');
select ok(not has_table_privilege('authenticated', 'public.admin_profiles', 'insert,delete,truncate'),
  'authenticated cannot insert, delete or truncate admin_profiles');
select ok(not has_function_privilege('anon', 'public.is_admin()', 'execute'), 'anon cannot execute is_admin()');
select ok(not has_function_privilege('anon', 'public.is_owner()', 'execute'), 'anon cannot execute is_owner()');
select ok(not has_function_privilege('anon', 'public.list_active_admins()', 'execute'),
  'anon cannot execute list_active_admins()');

-- Anon ----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select * from public.admin_profiles', '42501', null, 'anon: select admin_profiles is denied');
select throws_ok('select public.is_admin()', '42501', null, 'anon: is_admin() is denied');
select throws_ok('select * from public.list_active_admins()', '42501', null, 'anon: list_active_admins() is denied');
reset role;

-- Team member ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select is((select public.is_admin()), true, 'team: is_admin() is true');
select is((select public.is_owner()), false, 'team: is_owner() is false');
select results_eq('select id from public.admin_profiles',
  $$values ('00000000-0000-0000-0000-0000000000a2'::uuid)$$, 'team: sees only own profile');
select is((select count(*)::int from public.list_active_admins()), 2,
  'team: list_active_admins() returns the 2 active admins (id and name only)');
select is_empty($$update public.admin_profiles set role = 'owner'
  where id = '00000000-0000-0000-0000-0000000000a2' returning id$$, 'team: cannot promote self to owner');
select is_empty($$update public.admin_profiles set is_active = false
  where id = '00000000-0000-0000-0000-0000000000a1' returning id$$, 'team: cannot deactivate the owner');
select throws_ok($$insert into public.admin_profiles (id, full_name) values ('00000000-0000-0000-0000-0000000000a4', 'x')$$,
  '42501', null, 'team: cannot insert profiles');
select throws_ok($$delete from public.admin_profiles where id = '00000000-0000-0000-0000-0000000000a3'$$,
  '42501', null, 'team: cannot delete profiles');
select throws_ok($$update public.admin_profiles set created_at = now()$$,
  '42501', null, 'team: cannot update columns outside the column grant');
reset role;
select is((select role::text from public.admin_profiles where id = '00000000-0000-0000-0000-0000000000a2'),
  'team_member', 'team member role is unchanged');

-- Inactive team member and outsider -----------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
select is((select public.is_admin()), false, 'inactive: is_admin() is false');
select is((select count(*)::int from public.list_active_admins()), 0, 'inactive: list_active_admins() is empty');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
set local role authenticated;
select is((select public.is_admin()), false, 'outsider: is_admin() is false');
select is_empty('select id from public.admin_profiles', 'outsider: sees no profiles');
reset role;

-- Owner ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is((select public.is_owner()), true, 'owner: is_owner() is true');
select is((select count(*)::int from public.admin_profiles), 3, 'owner: sees all profiles');
select isnt_empty($$update public.admin_profiles set is_active = false
  where id = '00000000-0000-0000-0000-0000000000a2' returning id$$, 'owner: can deactivate a team member');
select throws_ok($$delete from public.admin_profiles where id = '00000000-0000-0000-0000-0000000000a3'$$,
  '42501', null, 'owner: cannot hard delete profiles through the API role');
reset role;

-- Deactivation removes access immediately
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select is((select public.is_admin()), false, 'deactivated team member: is_admin() is false at once');
reset role;

-- Service role (server-side invitations) ------------------------------------
set local role service_role;
select lives_ok($$insert into public.admin_profiles (id, full_name) values ('00000000-0000-0000-0000-0000000000a4', 'Invited')$$,
  'service_role: can create a profile (invitation route)');
reset role;

select * from finish();
rollback;
