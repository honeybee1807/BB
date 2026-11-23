-- property_photos: public sees photos of published properties only; 20-photo cap; one cover.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'team@test.local');
insert into public.admin_profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', 'Test Team', 'team_member');
insert into public.regions (id, slug, name) values ('10000000-0000-0000-0000-000000000001', 'drakensberg', 'Drakensberg');
insert into public.estates (id, region_id, slug, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'cathkin-estate', 'Cathkin Estate');
insert into public.properties (id, estate_id, slug, name, is_published, deleted_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'published-home', 'Published', true, null),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'draft-home', 'Draft', false, null),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'deleted-home', 'Deleted', true, now());
insert into public.property_photos (id, property_id, storage_path, thumb_path, is_cover) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'p1/a.webp', 'p1/a-thumb.webp', true),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'p2/a.webp', 'p2/a-thumb.webp', false),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'p3/a.webp', 'p3/a-thumb.webp', false);

-- Structure -----------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.property_photos'::regclass), 'property_photos has RLS enabled');
select ok(has_table_privilege('anon', 'public.property_photos', 'select'), 'anon has select on property_photos');
select ok(not has_table_privilege('anon', 'public.property_photos', 'insert,update,delete,truncate'),
  'anon has no write on property_photos');

-- Anon ----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq('select id from public.property_photos',
  $$values ('40000000-0000-0000-0000-000000000001'::uuid)$$,
  'anon: sees only photos of published, non-deleted properties (no error)');
select throws_ok($$insert into public.property_photos (property_id, storage_path, thumb_path)
  values ('30000000-0000-0000-0000-000000000001', 'x.webp', 'x-t.webp')$$, '42501', null, 'anon: cannot insert');
select throws_ok($$delete from public.property_photos$$, '42501', null, 'anon: cannot delete');
reset role;

-- Team member ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.property_photos), 3, 'team: sees all photos');
select lives_ok($$insert into public.property_photos (property_id, storage_path, thumb_path, alt_text)
  values ('30000000-0000-0000-0000-000000000002', 'p2/b.webp', 'p2/b-thumb.webp', 'Halal accommodation lounge')$$,
  'team: can add a photo');
select isnt_empty($$update public.property_photos set alt_text = 'Mountain view', sort_order = 2
  where id = '40000000-0000-0000-0000-000000000002' returning id$$, 'team: can edit alt text and order');
select isnt_empty($$delete from public.property_photos where id = '40000000-0000-0000-0000-000000000002' returning id$$,
  'team: can delete a photo row');
reset role;

-- Owner ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select isnt_empty($$delete from public.property_photos where id = '40000000-0000-0000-0000-000000000003' returning id$$,
  'owner: can delete a photo row');
reset role;

-- Constraints ---------------------------------------------------------------
select throws_ok($$insert into public.property_photos (property_id, storage_path, thumb_path, is_cover)
  values ('30000000-0000-0000-0000-000000000001', 'p1/b.webp', 'p1/b-t.webp', true)$$, '23505', null,
  'only one cover photo per property');
select throws_ok($$insert into public.property_photos (property_id, storage_path, thumb_path)
  values ('30000000-0000-0000-0000-000000000001', '../x.webp', 'x-t.webp')$$, '23514', null,
  'paths cannot contain ..');

-- 20-photo cap: published-home has 1, add 19 more, the 21st fails.
insert into public.property_photos (property_id, storage_path, thumb_path)
  select '30000000-0000-0000-0000-000000000001', 'p1/n' || g || '.webp', 'p1/n' || g || '-t.webp'
  from generate_series(1, 19) g;
select is((select count(*)::int from public.property_photos where property_id = '30000000-0000-0000-0000-000000000001'),
  20, 'a property can hold 20 photos');
select throws_ok($$insert into public.property_photos (property_id, storage_path, thumb_path)
  values ('30000000-0000-0000-0000-000000000001', 'p1/21.webp', 'p1/21-t.webp')$$, '23514', null,
  'the 21st photo is rejected');

-- Cascade from the property purge
set local role service_role;
delete from public.properties where id = '30000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from public.property_photos where property_id = '30000000-0000-0000-0000-000000000001'),
  0, 'photo rows cascade when a property is purged');

select * from finish();
rollback;
