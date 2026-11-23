-- storage buckets
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'team@test.local');
insert into public.admin_profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', 'Test Team', 'team_member');

-- Buckets
select results_eq($$select id, public from storage.buckets
  where id in ('uploads-tmp', 'property-photos', 'blog-images') order by id$$,
  $$values ('blog-images'::text, true), ('property-photos'::text, true), ('uploads-tmp'::text, false)$$,
  'uploads-tmp is private; property-photos and blog-images are public');
select is((select allowed_mime_types from storage.buckets where id = 'uploads-tmp'),
  array['image/jpeg', 'image/png', 'image/webp'], 'uploads-tmp accepts JPEG, PNG and WebP only (no HEIC)');
select is((select allowed_mime_types from storage.buckets where id = 'property-photos'), array['image/webp'],
  'property-photos accepts WebP only');
select is((select allowed_mime_types from storage.buckets where id = 'blog-images'), array['image/webp'],
  'blog-images accepts WebP only');
select ok((select bool_and(file_size_limit is not null) from storage.buckets
  where id in ('uploads-tmp', 'property-photos', 'blog-images')), 'every bucket has a size limit');
select ok((select relrowsecurity from pg_class where oid = 'storage.objects'::regclass), 'storage.objects has RLS enabled');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')), 0, 'no insert, update or delete policies on storage.objects');
select is((select count(*)::int from pg_policies where schemaname = 'storage'), 0, 'no storage policies at all');

-- A file the service role wrote, to test reads and deletes against.
insert into storage.objects (bucket_id, name) values ('property-photos', 'pgtap/existing.webp'), ('uploads-tmp', 'pgtap/raw.jpg');

-- Anon
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$insert into storage.objects (bucket_id, name) values ('property-photos', 'anon.webp')$$, '42501', null,
  'anon: cannot upload to property-photos');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('uploads-tmp', 'anon.jpg')$$, '42501', null,
  'anon: cannot upload to uploads-tmp');
select is_empty($$select name from storage.objects$$, 'anon: cannot list objects');
select throws_ok($$delete from storage.objects$$, null, null, 'anon: direct deletes are refused (also tested through the Storage API)');
reset role;

-- Team member and owner
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into storage.objects (bucket_id, name) values ('property-photos', 'team.webp')$$, '42501', null,
  'team: cannot upload to property-photos directly');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('blog-images', 'team.webp')$$, '42501', null,
  'team: cannot upload to blog-images directly');
select is_empty($$update storage.objects set name = 'moved.webp' returning name$$, 'team: cannot update objects');
select throws_ok($$delete from storage.objects$$, null, null, 'team: direct deletes are refused (also tested through the Storage API)');
select is_empty($$select name from storage.objects where bucket_id = 'uploads-tmp'$$, 'team: cannot read uploads-tmp');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$insert into storage.objects (bucket_id, name) values ('property-photos', 'owner.webp')$$, '42501', null,
  'owner: cannot upload directly either (server pipeline only)');
select throws_ok($$delete from storage.objects$$, null, null, 'owner: direct deletes are refused (also tested through the Storage API)');
reset role;

select is((select count(*)::int from storage.objects where name like 'pgtap/%'), 2, 'both service-written objects still exist');

select * from finish();
rollback;
