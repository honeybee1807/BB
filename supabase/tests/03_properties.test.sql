-- properties: public sees published only; admins write; owner-only soft delete (trigger + policy).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'team@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'outsider@test.local');
insert into public.admin_profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', 'Test Team', 'team_member');
insert into public.regions (id, slug, name) values ('10000000-0000-0000-0000-000000000001', 'drakensberg', 'Drakensberg');
insert into public.estates (id, region_id, slug, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'cathkin-estate', 'Cathkin Estate');
-- p1 published, p2 draft, p3 published but soft-deleted
insert into public.properties (id, estate_id, slug, name, is_published, deleted_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'published-home', 'Published', true, null),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'draft-home', 'Draft', false, null),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'deleted-home', 'Deleted', true, now());

-- Structure -----------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.properties'::regclass), 'properties has RLS enabled');
select ok(has_table_privilege('anon', 'public.properties', 'select'), 'anon has select on properties');
select ok(not has_table_privilege('anon', 'public.properties', 'insert,update,delete,truncate'), 'anon has no write on properties');
select ok(not has_table_privilege('authenticated', 'public.properties', 'delete'), 'authenticated has NO delete grant on properties');
select ok(not has_table_privilege('authenticated', 'public.properties', 'truncate'), 'authenticated cannot truncate properties');
select ok((select with_check like '%deleted_at%' and with_check like '%is_owner%' from pg_policies
  where tablename = 'properties' and cmd = 'UPDATE'), 'update policy also restricts deleted_at to the owner');
select has_trigger('public', 'properties', 'properties_owner_soft_delete', 'owner soft delete trigger exists');

-- Anon ----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq('select id from public.properties',
  $$values ('30000000-0000-0000-0000-000000000001'::uuid)$$, 'anon: sees only published, non-deleted properties (no error)');
select is_empty($$select id from public.properties where slug = 'draft-home'$$, 'anon: draft is invisible (empty, not an error)');
select throws_ok($$insert into public.properties (estate_id, slug, name) values ('20000000-0000-0000-0000-000000000001', 'x', 'X')$$,
  '42501', null, 'anon: cannot insert');
select throws_ok($$update public.properties set name = 'X'$$, '42501', null, 'anon: cannot update');
select throws_ok($$delete from public.properties$$, '42501', null, 'anon: cannot delete');
reset role;

-- Outsider (authenticated, no profile) --------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
set local role authenticated;
select results_eq('select id from public.properties',
  $$values ('30000000-0000-0000-0000-000000000001'::uuid)$$, 'outsider: sees only published properties');
select throws_ok($$insert into public.properties (estate_id, slug, name) values ('20000000-0000-0000-0000-000000000001', 'o', 'O')$$,
  '42501', null, 'outsider: cannot insert');
select is_empty($$update public.properties set name = 'X' returning id$$, 'outsider: cannot update');
reset role;

-- Team member ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select results_eq('select id from public.properties order by id',
  $$values ('30000000-0000-0000-0000-000000000001'::uuid), ('30000000-0000-0000-0000-000000000002'::uuid)$$,
  'team: sees published and draft, not soft-deleted');
select lives_ok($$insert into public.properties (id, estate_id, slug, name, is_halal, custom_fields) values
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'team-home', 'Team Home', true,
   '[{"label":"Braai","value":"Gas braai on the deck"}]')$$, 'team: can create a property');
select isnt_empty($$update public.properties set is_published = true where slug = 'draft-home' returning id$$,
  'team: can edit and publish a property');
select throws_ok($$update public.properties set deleted_at = now() where slug = 'draft-home'$$, '42501', null,
  'team: cannot soft delete (set deleted_at)');
select is_empty($$update public.properties set deleted_at = null where slug = 'deleted-home' returning id$$,
  'team: cannot restore (clear deleted_at): row is not reachable');
select throws_ok($$insert into public.properties (estate_id, slug, name, deleted_at) values
  ('20000000-0000-0000-0000-000000000001', 'pre-deleted', 'X', now())$$, '42501', null,
  'team: cannot insert a row that is already deleted');
select throws_ok($$delete from public.properties where slug = 'draft-home'$$, '42501', null,
  'team: cannot hard delete (no grant)');
reset role;
select ok((select deleted_at is null from public.properties where slug = 'draft-home'), 'draft-home is still not deleted');
select ok((select deleted_at is not null from public.properties where slug = 'deleted-home'), 'deleted-home is still deleted');

-- Owner ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from public.properties), 4, 'owner: sees all properties, including soft-deleted');
select isnt_empty($$update public.properties set deleted_at = now() where slug = 'team-home' returning id$$,
  'owner: can soft delete');
select isnt_empty($$update public.properties set deleted_at = null where slug = 'deleted-home' returning id$$,
  'owner: can restore');
select throws_ok($$delete from public.properties where slug = 'team-home'$$, '42501', null,
  'owner: cannot hard delete through the API role (purge is server-side)');
reset role;

-- Service role (owner-only purge route) -------------------------------------
set local role service_role;
select isnt_empty($$delete from public.properties where slug = 'team-home' returning id$$, 'service_role: can purge');
reset role;

-- Constraints ---------------------------------------------------------------
select throws_ok($$insert into public.properties (estate_id, slug, name, custom_fields) values
  ('20000000-0000-0000-0000-000000000001', 'cf-obj', 'X', '{"label":"a","value":"b"}')$$, '23514', null,
  'custom_fields must be an array');
select throws_ok($$insert into public.properties (estate_id, slug, name, custom_fields) values
  ('20000000-0000-0000-0000-000000000001', 'cf-missing', 'X', '[{"label":"a"}]')$$, '23514', null,
  'custom_fields items need label and value');
select throws_ok($$insert into public.properties (estate_id, slug, name, custom_fields) values
  ('20000000-0000-0000-0000-000000000001', 'cf-extra', 'X', '[{"label":"a","value":"b","x":1}]')$$, '23514', null,
  'custom_fields items reject unknown keys');
select throws_ok($$insert into public.properties (estate_id, slug, name, instagram_video_url) values
  ('20000000-0000-0000-0000-000000000001', 'ig-http', 'X', 'http://instagram.com/reel/abc')$$, '23514', null,
  'instagram_video_url must be https');
select throws_ok($$insert into public.properties (estate_id, slug, name, instagram_video_url) values
  ('20000000-0000-0000-0000-000000000001', 'ig-other', 'X', 'https://evil.example/instagram.com/reel/abc')$$, '23514', null,
  'instagram_video_url must be on instagram.com');
select lives_ok($$insert into public.properties (estate_id, slug, name, instagram_video_url) values
  ('20000000-0000-0000-0000-000000000001', 'ig-ok', 'X', 'https://www.instagram.com/reel/C1a2B3c4D5e/')$$,
  'a valid Instagram reel URL is accepted');
select throws_ok($$insert into public.properties (slug, name) values ('no-estate', 'X')$$, '23502', null,
  'estate_id is required');
select throws_ok($$delete from public.estates where id = '20000000-0000-0000-0000-000000000001'$$, '23503', null,
  'an estate with properties cannot be deleted');

select * from finish();
rollback;
