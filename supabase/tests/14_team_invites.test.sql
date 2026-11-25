-- Team invites and member management: owners only, single-use hashed tokens, no self changes.
-- Users: a1 owner, a5 second owner, a2 team member, a3 and a7 invitees without profiles.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a5', 'second-owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'team@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'invitee@test.local'),
  ('00000000-0000-0000-0000-0000000000a7', 'other@test.local');
insert into public.admin_profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000a5', 'Second Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', 'Test Team', 'team_member');
insert into public.inquiries (id, guest_name, guest_email, guest_phone, check_in, check_out, adults, consent_given_at,
                              status, assigned_to) values
  ('50000000-0000-0000-0000-000000000001', 'Guest One', 'one@example.com', '0820000001', '2027-01-10', '2027-01-14', 2,
   now(), 'claimed', '00000000-0000-0000-0000-0000000000a2');
insert into public.team_invites (id, email, role, token_hash) values
  ('80000000-0000-0000-0000-000000000001', 'invitee@test.local', 'owner', repeat('a', 64)),
  ('80000000-0000-0000-0000-000000000002', 'late@test.local', 'team_member', repeat('b', 64)),
  ('80000000-0000-0000-0000-000000000003', 'withdrawn@test.local', 'team_member', repeat('c', 64));
update public.team_invites set expires_at = now() - interval '1 minute' where token_hash = repeat('b', 64);
update public.team_invites set cancelled_at = now() where token_hash = repeat('c', 64);

-- Structure
select ok((select relrowsecurity from pg_class where oid = 'public.team_invites'::regclass), 'team_invites has RLS enabled');
select ok(not has_table_privilege('anon', 'public.team_invites', 'select,insert,update,delete,truncate'),
  'anon has no access to team_invites');
select ok(not has_table_privilege('authenticated', 'public.team_invites', 'delete,truncate'),
  'authenticated cannot delete invites');
select ok(not has_column_privilege('authenticated', 'public.team_invites', 'expires_at', 'update'),
  'authenticated cannot change an expiry');
select ok(not has_column_privilege('authenticated', 'public.team_invites', 'accepted_at', 'update'),
  'authenticated cannot mark an invite accepted');
select ok(not has_function_privilege('authenticated', 'public.accept_team_invite(text, uuid, text)', 'execute'),
  'authenticated cannot accept invites directly');
select ok(not has_function_privilege('anon', 'public.accept_team_invite(text, uuid, text)', 'execute'),
  'anon cannot accept invites directly');
select ok(not has_function_privilege('anon', 'public.list_team()', 'execute'), 'anon cannot list the team');
select throws_ok($$insert into public.team_invites (email, token_hash) values ('Shout@Test.local', repeat('d', 64))$$,
  '23514', null, 'invite emails are stored in lower case');
select throws_ok($$insert into public.team_invites (email, token_hash) values ('invitee@test.local', repeat('e', 64))$$,
  '23505', null, 'only one pending invite per email');
select ok((select expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 minute'
  from public.team_invites where token_hash = repeat('a', 64)), 'invites expire 7 days after they are sent');

-- Team member
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty('select id from public.team_invites', 'team: cannot read invites');
select throws_ok($$insert into public.team_invites (email, token_hash) values ('new@test.local', repeat('f', 64))$$,
  '42501', null, 'team: cannot invite');
select is_empty($$update public.team_invites set cancelled_at = now() returning id$$, 'team: cannot cancel invites');
select is_empty('select id from public.list_team()', 'team: list_team returns nothing');
select results_eq($$select id from public.admin_profiles$$, $$values ('00000000-0000-0000-0000-0000000000a2'::uuid)$$,
  'team: reads only their own profile');
select is_empty($$update public.admin_profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a2' returning id$$,
  'team: cannot promote themselves');
select is_empty($$update public.admin_profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000a1' returning id$$,
  'team: cannot deactivate the owner');
reset role;

-- Owner
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from public.team_invites), 3, 'owner: reads every invite');
select is((select count(*)::int from public.list_team()), (select count(*)::int from public.admin_profiles),
  'owner: list_team returns every profile');
select is((select email from public.list_team() where id = '00000000-0000-0000-0000-0000000000a2'), 'team@test.local',
  'owner: list_team includes emails');
select lives_ok($$insert into public.team_invites (email, role, token_hash) values ('new@test.local', 'team_member', repeat('f', 64))$$,
  'owner: can invite');
select is((select invited_by from public.team_invites where token_hash = repeat('f', 64)),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'owner: the inviter is taken from the session');
select throws_ok($$update public.team_invites set expires_at = now() + interval '1 year' where token_hash = repeat('f', 64)$$,
  '42501', null, 'owner: cannot stretch an expiry');
select lives_ok($$update public.team_invites set token_hash = repeat('9', 64) where token_hash = repeat('f', 64)$$,
  'owner: can resend with a new token');
select is_empty($$select id from public.team_invites where token_hash = repeat('f', 64)$$,
  'owner: the old token is gone after a resend');
select is_empty($$update public.team_invites set cancelled_at = null where token_hash = repeat('c', 64) returning id$$,
  'owner: cannot revive a cancelled invite');
select throws_ok($$update public.admin_profiles set role = 'team_member' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'owner: cannot change their own role');
select throws_ok($$update public.admin_profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'owner: cannot deactivate themselves');
select lives_ok($$update public.admin_profiles set full_name = 'Renamed Owner' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'owner: can still change their own name');
select lives_ok($$update public.admin_profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  'owner: can promote a team member');
select lives_ok($$update public.admin_profiles set role = 'team_member' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  'owner: can demote another owner while owners remain');
reset role;

-- Accepting invites (the server calls this with the service role)
set local role service_role;
select throws_ok($$select public.accept_team_invite(repeat('a', 64), '00000000-0000-0000-0000-0000000000a7', 'Wrong Person')$$,
  '22023', null, 'service_role: the account email must match the invite');
select is(public.accept_team_invite(repeat('a', 64), '00000000-0000-0000-0000-0000000000a3', '  New Owner '), 'owner'::public.admin_role,
  'service_role: accepting returns the invited role');
select is((select role from public.admin_profiles where id = '00000000-0000-0000-0000-0000000000a3'), 'owner'::public.admin_role,
  'the new profile has exactly the invited role');
select is((select full_name from public.admin_profiles where id = '00000000-0000-0000-0000-0000000000a3'), 'New Owner',
  'the name is trimmed');
select is(public.accept_team_invite(repeat('a', 64), '00000000-0000-0000-0000-0000000000a3', 'Again'), null,
  'service_role: a used invite cannot be used again');
select is(public.accept_team_invite(repeat('b', 64), '00000000-0000-0000-0000-0000000000a7', 'Late'), null,
  'service_role: an expired invite is refused');
select is(public.accept_team_invite(repeat('c', 64), '00000000-0000-0000-0000-0000000000a7', 'Withdrawn'), null,
  'service_role: a cancelled invite is refused');
select is(public.accept_team_invite(repeat('0', 64), '00000000-0000-0000-0000-0000000000a7', 'Guess'), null,
  'service_role: an unknown token is refused');
select is((select count(*)::int from public.admin_profiles where id = '00000000-0000-0000-0000-0000000000a7'), 0,
  'refused invites create no profile');
reset role;

-- Last owner and removal
-- Other local admins would count as remaining owners. The transaction rolls this back.
update public.admin_profiles set is_active = false
  where id not in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
select throws_ok($$delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'the last active owner cannot be removed');
select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-0000000000a2'$$,
  'a team member can be removed');
select is((select assigned_to from public.inquiries where id = '50000000-0000-0000-0000-000000000001'), null,
  'a removed member''s inquiry stays, now unassigned');
select is((select status::text from public.inquiries where id = '50000000-0000-0000-0000-000000000001'), 'claimed',
  'a removed member''s inquiry keeps its status');

-- Deactivated members lose access at once
update public.admin_profiles set is_active = true where id = '00000000-0000-0000-0000-0000000000a5';
update public.admin_profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000a5';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select public.is_admin()), false, 'deactivated: is_admin() is false with a still-valid token');
select is_empty('select id from public.inquiries', 'deactivated: sees no inquiries');
select is_empty($$update public.inquiries set assigned_to = '00000000-0000-0000-0000-0000000000a5' returning id$$,
  'deactivated: cannot claim an inquiry');
select is_empty('select id from public.team_invites', 'deactivated owner: cannot read invites');
reset role;

select * from finish();
rollback;
