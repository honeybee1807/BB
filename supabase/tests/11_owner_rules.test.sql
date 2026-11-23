-- Users: a1 owner, a5 recovery owner, a2 team member, a6 team member with TOTP.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a5', 'recovery-owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'team@test.local'),
  ('00000000-0000-0000-0000-0000000000a6', 'team-totp@test.local');
insert into public.admin_profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000a5', 'Recovery Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', 'Test Team', 'team_member'),
  ('00000000-0000-0000-0000-0000000000a6', 'Team With TOTP', 'team_member');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a6', 'phone', 'totp', 'verified', now(), now());
insert into public.regions (id, slug, name) values ('10000000-0000-0000-0000-000000000001', 'pgtap-drakensberg', 'Drakensberg');
insert into public.estates (id, region_id, slug, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'pgtap-cathkin-estate', 'Cathkin Estate');
insert into public.properties (id, estate_id, slug, name, is_published) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'pgtap-published-home', 'Published', true);
insert into public.inquiries (id, guest_name, guest_email, guest_phone, check_in, check_out, adults, consent_given_at) values
  ('50000000-0000-0000-0000-000000000001', 'Guest One', 'one@example.com', '0820000001', '2027-01-10', '2027-01-14', 2, now());

-- TOTP layer: owner at aal1 is refused
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select public.is_owner()), false, 'owner at aal1: is_owner() is false');
select is((select public.is_admin()), false, 'owner at aal1: is_admin() is false (password alone gives no access)');
select results_eq($$select role::text from public.admin_profiles$$, $$values ('owner')$$,
  'owner at aal1: can still read own profile (app knows TOTP is required; enrolment needs no owner rights)');
select is_empty('select id from public.inquiries', 'owner at aal1: sees no inquiries');
select is_empty($$update public.regions set name = 'X' returning id$$, 'owner at aal1: cannot edit regions');
select throws_ok($$insert into public.regions (slug, name) values ('aal1', 'X')$$, '42501', null, 'owner at aal1: cannot add regions');
select is_empty($$update public.properties set deleted_at = now() returning id$$, 'owner at aal1: cannot soft delete');
reset role;

-- Missing aal claim is treated as aal1
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is((select public.is_owner()), false, 'owner with no aal claim: is_owner() is false');
reset role;

-- Recovery owner at aal1 is refused, but can read own row (to enrol TOTP)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select public.is_owner()), false, 'recovery owner at aal1: is_owner() is false');
select results_eq($$select role::text from public.admin_profiles$$, $$values ('owner')$$,
  'recovery owner at aal1: can read own profile to start enrolment');
reset role;

-- TOTP layer: aal2 is allowed
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select public.is_owner()), true, 'owner at aal2: is_owner() is true');
select is((select public.is_admin()), true, 'owner at aal2: is_admin() is true');
select isnt_empty('select id from public.inquiries', 'owner at aal2: sees inquiries');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select public.is_owner()), true, 'recovery owner at aal2: is_owner() is true');
reset role;

-- Team members: optional TOTP
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select public.is_admin()), true, 'team without a factor at aal1: is_admin() is true');
select is((select public.is_owner()), false, 'team at aal1: is_owner() is false');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select public.is_admin()), false, 'team WITH a verified factor at aal1: is_admin() is false');
select is_empty('select id from public.inquiries', 'team with a factor at aal1: sees no inquiries');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select public.is_admin()), true, 'team with a factor at aal2: is_admin() is true');
select is((select public.is_owner()), false, 'team at aal2: is_owner() is still false');
reset role;

-- Last active owner
-- Other local admins would count as remaining owners. The transaction rolls this back.
update public.admin_profiles set is_active = false
  where id not in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a5',
                   '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a6');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$update public.admin_profiles set role = 'team_member' where id = '00000000-0000-0000-0000-0000000000a5'$$,
  'owner: can demote another owner while one active owner remains');
select throws_ok($$update public.admin_profiles set role = 'team_member' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'owner: cannot demote the last active owner');
select throws_ok($$update public.admin_profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'owner: cannot deactivate the last active owner');
select lives_ok($$update public.admin_profiles set full_name = 'Renamed Owner' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'owner: can still edit their own name');
reset role;
set local role service_role;
select throws_ok($$update public.admin_profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'service_role: cannot deactivate the last active owner either');
reset role;
update public.admin_profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a5';
select lives_ok($$update public.admin_profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'an owner can be deactivated once another active owner exists');
select throws_ok($$update public.admin_profiles set role = 'team_member' where id = '00000000-0000-0000-0000-0000000000a5'$$,
  '23514', null, 'an inactive owner does not count as a remaining owner');

-- Columns and grants
select has_column('public', 'blog_posts', 'featured_image_alt', 'blog_posts has featured_image_alt');
select col_is_null('public', 'blog_posts', 'featured_image_alt', 'featured_image_alt is nullable (UI falls back to the title)');
select has_column('public', 'property_photos', 'alt_text', 'property_photos has alt_text');
select ok(not has_table_privilege('authenticated', 'public.seo_pages', 'delete'), 'authenticated has no DELETE on seo_pages');
select is((select count(*)::int from pg_policies where tablename = 'seo_pages' and cmd = 'DELETE'), 0,
  'seo_pages has no delete policy');
select is((select count(*)::int from pg_policies where tablename = 'property_photos' and cmd = 'DELETE'
  and qual like '%is_admin%'), 1, 'property_photos delete policy is for admins (team may delete photos)');

-- Anon policies filter soft-deleted rows
select ok((select qual like '%deleted_at IS NULL%' from pg_policies
  where tablename = 'properties' and 'anon' = any(roles)), 'anon properties policy requires deleted_at is null');
select ok((select qual like '%deleted_at IS NULL%' from pg_policies
  where tablename = 'blog_posts' and 'anon' = any(roles)), 'anon blog_posts policy requires deleted_at is null');
select ok((select qual like '%deleted_at IS NULL%' from pg_policies
  where tablename = 'property_photos' and 'anon' = any(roles)),
  'anon property_photos policy requires the parent property deleted_at is null (photos have no deleted_at)');

select * from finish();
rollback;
